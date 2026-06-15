import {
  creerCoutKanbanSqlite,
  supprimerDernierCoutKanbanSqlite,
  reouvrirDernierCoutKanbanSqlite,
} from './kanbanCostsApi';

// Normalise la valeur du champ mvt en action interne
// Texte ou code numérique acceptés : cancel/2, open/5, close
function normaliserMvt(valeur) {
  const v = String(valeur || '').trim().toLowerCase();
  if (v === 'cancel' || v === '2') return 'cancel';
  if (v === 'open' || v === '5') return 'open';
  if (v === 'close') return 'close';
  return null;
}

// Convertit une valeur CSV en nombre ; accepte virgule ou point décimal
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

// Importe les mouvements depuis un CSV Ticket/mvt/valeur
// mvt cancel (2) → supprime le dernier coût Kanban du ticket
// mvt open  (5) → rouvre le dernier coût avec le pourcentage indiqué dans valeur
// mvt close     → crée un nouveau coût Kanban avec la valeur comme cout_fixe
export async function importerMouvementsCsv(donnees, ajouterLog) {
  const resultat = {
    importes: 0,
    ignores: 0,
    erreurs: 0,
    avertissements: [],
  };

  for (const ligne of donnees) {
    const ticketBrut = lireColonne(ligne, 'ticket', 'Ticket', 'TICKET');
    const mvtBrut = lireColonne(ligne, 'mvt', 'Mvt', 'MVT');
    const valeurBrut = lireColonne(ligne, 'valeur', 'Valeur', 'VALEUR');

    if (!ticketBrut) {
      ajouterLog('Mouvement ignoré : colonne Ticket vide');
      resultat.ignores++;
      continue;
    }

    const ticketId = Number(ticketBrut);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      ajouterLog(`Mouvement ignoré : ID ticket invalide "${ticketBrut}"`);
      resultat.ignores++;
      continue;
    }

    const action = normaliserMvt(mvtBrut);
    if (!action) {
      const avert = `Mouvement ticket #${ticketId} ignoré : mvt inconnu "${mvtBrut}" (attendu : cancel, 2, open, 5, close)`;
      ajouterLog(avert);
      resultat.avertissements.push(avert);
      resultat.ignores++;
      continue;
    }

    const valeur = lireValeurNumerique(valeurBrut);

    try {
      if (action === 'cancel') {
        await supprimerDernierCoutKanbanSqlite(ticketId);
        ajouterLog(`Ticket #${ticketId} : annulation du dernier coût`);
      } else if (action === 'open') {
        const pourcentage = valeur ?? 0;
        await reouvrirDernierCoutKanbanSqlite(ticketId, pourcentage);
        ajouterLog(`Ticket #${ticketId} : réouverture à ${pourcentage}%`);
      } else if (action === 'close') {
        const coutFixe = valeur ?? 0;
        await creerCoutKanbanSqlite({
          ticketId,
          coutFixe,
          commentaire: 'Import close',
          nombreItems: 1,
          items: [],
        });
        ajouterLog(`Ticket #${ticketId} : clôture avec supercost ${coutFixe}`);
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
