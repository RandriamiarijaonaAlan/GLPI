import {
  creerCoutKanbanSqlite,
  recupererCoutsKanbanSqlite,
  supprimerDernierCoutKanbanSqlite,
} from './kanbanCostsApi';
import clientGlpiLegacy from './glpiLegacyClient';

// Texte ou code numerique acceptes : cancel/2, open/5, close/closed
function normaliserMvt(valeur) {
  const v = String(valeur || '').trim().toLowerCase();
  if (v === 'cancel' || v === '2') return 'cancel';
  if (v === 'open' || v === '5') return 'open';
  if (v === 'close' || v === 'closed') return 'close';
  return null;
}

// Accepte virgule ou point decimal
function lireValeurNumerique(valeur) {
  if (valeur === null || valeur === undefined) return null;
  const texte = String(valeur).trim().replace(/\s+/g, '').replace(',', '.');
  if (!texte) return null;
  const nombre = Number(texte);
  return Number.isNaN(nombre) ? null : nombre;
}

function lireColonne(ligne, ...noms) {
  for (const nom of noms) {
    if (Object.prototype.hasOwnProperty.call(ligne, nom)) {
      return String(ligne[nom] ?? '').trim();
    }
  }
  return '';
}

function normaliserListe(donnees) {
  if (Array.isArray(donnees)) return donnees;
  if (Array.isArray(donnees?.data)) return donnees.data;
  if (Array.isArray(donnees?.items)) return donnees.items;
  if (Array.isArray(donnees?.member)) return donnees.member;
  return [];
}

function extraireReferenceTicketDepuisContenu(contenu) {
  const correspondance = String(contenu || '').match(/Ref_Ticket:\s*([^\n\r]+)/i);
  return correspondance ? correspondance[1].trim() : '';
}

async function creerCoutDepuisMouvement(ticketId, coutFixe, commentaire, coutReference = null) {
  const nombreItems = Math.max(1, Number(coutReference?.nombre_items || 1));
  const items = lireItemsCout(coutReference);

  return creerCoutKanbanSqlite({
    ticketId,
    coutFixe,
    commentaire,
    nombreItems,
    items,
  });
}

function lireItemsCout(cout) {
  try {
    const items = JSON.parse(cout?.items_json || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function construireIndexTickets(tickets) {
  const parId = new Map();
  const parReference = new Map();

  normaliserListe(tickets).forEach((ticket) => {
    const id = String(ticket.id || '').trim();
    const reference =
      extraireReferenceTicketDepuisContenu(ticket.content) ||
      extraireReferenceTicketDepuisContenu(ticket.comment) ||
      extraireReferenceTicketDepuisContenu(ticket.comments);

    if (id) parId.set(id, ticket);
    if (reference) parReference.set(reference, ticket);
  });

  return { parId, parReference };
}

async function recupererIndexTickets() {
  const reponse = await clientGlpiLegacy.get('/Ticket?range=0-9999&expand_dropdowns=true');
  return construireIndexTickets(reponse.data);
}

// Importe les mouvements depuis un CSV ticket/mvt/valeur.
// open cree un cout de reouverture calcule sur le dernier cout Kanban du ticket.
export async function importerMouvementsCsv(donnees, ajouterLog) {
  const resultat = {
    importes: 0,
    ignores: 0,
    erreurs: 0,
    avertissements: [],
  };
  let indexTickets = null;

  async function resoudreTicket(ticketBrut) {
    if (!indexTickets) {
      indexTickets = await recupererIndexTickets();
    }

    const cle = String(ticketBrut || '').trim();
    // Le CSV mouvement utilise d'abord la reference importee Ref_Ticket.
    return indexTickets.parReference.get(cle) || indexTickets.parId.get(cle) || null;
  }

  async function recupererDernierCoutKanban(ticketId) {
    const couts = await recupererCoutsKanbanSqlite();
    return normaliserListe(couts)
      .filter((cout) => Number(cout.ticket_id) === Number(ticketId))
      .sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        if (dateA !== dateB) return dateB - dateA;
        return Number(b.id || 0) - Number(a.id || 0);
      })[0] || null;
  }

  for (const ligne of donnees) {
    const ticketBrut = lireColonne(ligne, 'ticket', 'Ticket', 'TICKET');
    const mvtBrut = lireColonne(ligne, 'mvt', 'Mvt', 'MVT');
    const valeurBrut = lireColonne(ligne, 'valeur', 'Valeur', 'VALEUR');

    if (!ticketBrut) {
      ajouterLog('Mouvement ignore : colonne Ticket vide');
      resultat.ignores++;
      continue;
    }

    const ticketId = Number(ticketBrut);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      ajouterLog(`Mouvement ignore : ID ticket invalide "${ticketBrut}"`);
      resultat.ignores++;
      continue;
    }

    const action = normaliserMvt(mvtBrut);
    if (!action) {
      const avert = `Mouvement ticket #${ticketId} ignore : mvt inconnu "${mvtBrut}" (attendu : cancel, 2, open, 5, close, closed)`;
      ajouterLog(avert);
      resultat.avertissements.push(avert);
      resultat.ignores++;
      continue;
    }

    const valeur = lireValeurNumerique(valeurBrut);

    try {
      const ticket = await resoudreTicket(ticketId);
      const ticketGlpiId = Number(ticket?.id || ticketId);

      if (!Number.isInteger(ticketGlpiId) || ticketGlpiId <= 0) {
        const avert = `Mouvement ticket "${ticketBrut}" ignore : ticket GLPI introuvable`;
        ajouterLog(avert);
        resultat.avertissements.push(avert);
        resultat.ignores++;
        continue;
      }

      if (action === 'cancel') {
        await supprimerDernierCoutKanbanSqlite(ticketGlpiId);
        ajouterLog(`Ticket #${ticketGlpiId} : annulation du dernier cout`);
      } else if (action === 'open') {
        const pourcentage = valeur ?? 0;
        const dernierCout = await recupererDernierCoutKanban(ticketGlpiId);
        const baseReouverture = lireValeurNumerique(dernierCout?.cout_fixe) ?? 0;
        const montantReouverture = (baseReouverture * pourcentage) / 100;
        await creerCoutDepuisMouvement(
          ticketGlpiId,
          montantReouverture,
          `Import reouverture +${pourcentage}%`,
          dernierCout,
        );
        ajouterLog(`Ticket #${ticketGlpiId} : reouverture importee ${montantReouverture} sur base ${baseReouverture}`);
      } else if (action === 'close') {
        const coutFixe = valeur ?? 0;
        await creerCoutDepuisMouvement(ticketGlpiId, coutFixe, 'Import close');
        ajouterLog(`Ticket #${ticketGlpiId} : cloture avec supercost ${coutFixe}`);
      }

      resultat.importes++;
    } catch (erreur) {
      const message = `Erreur mouvement ticket #${ticketId} (${action}) : ${erreur.message}`;
      ajouterLog(message);
      resultat.avertissements.push(message);
      resultat.erreurs++;
    }
  }

  return resultat;
}
