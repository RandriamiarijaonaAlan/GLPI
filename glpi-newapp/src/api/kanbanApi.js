import { creerTicket, recupererTickets } from './ticketsApi';
import clientGlpiLegacy from './glpiLegacyClient';

function normaliserListe(donnees) {
  if (Array.isArray(donnees)) return donnees;
  if (Array.isArray(donnees?.data)) return donnees.data;
  if (Array.isArray(donnees?.items)) return donnees.items;
  if (Array.isArray(donnees?.member)) return donnees.member;
  return [];
}

function extraireValeurGlpi(valeur) {
  if (valeur === null || valeur === undefined) return '';
  if (typeof valeur === 'object') return valeur.id || valeur.value || valeur.name || '';
  return valeur;
}

function lireLibelle(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return '-';
  if (typeof valeur === 'object') {
    return valeur.name || valeur.completename || valeur.value || valeur.id || '-';
  }
  return String(valeur);
}

function extraireItemtypeRelation(relation) {
  const itemtype = relation.itemtype || relation.item_type || relation.items_id?.itemtype || relation.items_id?.type;
  return String(extraireValeurGlpi(itemtype) || '').trim();
}

function extraireIdElementRelation(relation) {
  return extraireValeurGlpi(relation.items_id?.id || relation.items_id?.items_id || relation.items_id);
}

function normaliserCheminItemtype(itemtype) {
  return itemtype === 'Glpi\\Socket' ? 'Glpi%5CSocket' : encodeURIComponent(itemtype);
}

async function recupererDetailElementLie(relation) {
  const itemtype = extraireItemtypeRelation(relation);
  const idElement = extraireIdElementRelation(relation);

  if (!itemtype || !idElement) {
    return {
      ...relation,
      itemtype: itemtype || '-',
      items_id: idElement || '',
      nom: '-',
    };
  }

  try {
    const reponse = await clientGlpiLegacy.get(
      `/${normaliserCheminItemtype(itemtype)}/${encodeURIComponent(idElement)}?expand_dropdowns=true`,
    );
    const detail = reponse.data || {};

    return {
      ...relation,
      detail,
      itemtype,
      items_id: idElement,
      nom: lireLibelle(detail.name),
      statut: lireLibelle(detail.states_id || detail.status),
      localisation: lireLibelle(detail.locations_id || detail.location),
      fabricant: lireLibelle(detail.manufacturers_id || detail.manufacturer),
      numeroInventaire: lireLibelle(detail.otherserial || detail.inventory_number || detail.serial),
    };
  } catch {
    return {
      ...relation,
      itemtype,
      items_id: idElement,
      nom: lireLibelle(relation.items_id?.name || relation.name),
    };
  }
}

export async function recupererDetailTicketKanban(idTicket) {
  const reponseTicket = await clientGlpiLegacy.get(`/Ticket/${idTicket}?expand_dropdowns=true`);

  let elementsLies = [];

  try {
    const reponseRelations = await clientGlpiLegacy.get(
      `/Item_Ticket?searchText[tickets_id]=${encodeURIComponent(idTicket)}&range=0-9999&expand_dropdowns=true`,
    );
    const relations = normaliserListe(reponseRelations.data);
    elementsLies = await Promise.all(relations.map(recupererDetailElementLie));
  } catch (erreur) {
    console.warn('Impossible de recuperer les elements lies :', erreur);
  }

  return {
    ticket: reponseTicket.data,
    elementsLies,
  };
}

export async function recupererTicketsKanban() {
  return recupererTickets();
}

export async function creerTicketKanban(donneesTicket) {
  return creerTicket({
    titre: donneesTicket.titre,
    description: donneesTicket.description || 'Ticket cree depuis Kanban NewAPP',
    type: 1,
    urgence: 3,
    priorite: donneesTicket.priorite || 3,
  });
}

export async function modifierStatutTicketKanban(idTicket, statutGlpi) {
  const reponse = await clientGlpiLegacy.put(`/Ticket/${idTicket}`, {
    input: {
      id: idTicket,
      status: statutGlpi,
    },
  });

  return reponse.data;
}
