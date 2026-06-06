import clientGlpiLegacy from './glpiLegacyClient';

function extraireIdTicketCree(donnees) {
  if (donnees?.id) {
    return donnees.id;
  }

  if (Array.isArray(donnees)) {
    return donnees[0]?.id || donnees[0]?.items_id;
  }

  return donnees?.items_id;
}

export async function recupererTickets() {
  const reponse = await clientGlpiLegacy.get('/Ticket?range=0-99&expand_dropdowns=true');

  return Array.isArray(reponse.data) ? reponse.data : [];
}

export async function recupererTicketParId(id) {
  const reponse = await clientGlpiLegacy.get(`/Ticket/${id}?expand_dropdowns=true`);

  return reponse.data;
}

export async function creerTicket(donnees) {
  const reponse = await clientGlpiLegacy.post('/Ticket', {
    input: {
      name: donnees.titre,
      content: donnees.description,
      type: donnees.type || 1,
      urgency: donnees.urgence || 3,
      priority: donnees.priorite || 3,
      status: 1,
      entities_id: 0,
    },
  });

  return {
    ...reponse.data,
    id: extraireIdTicketCree(reponse.data),
  };
}

export async function lierElementAuTicket(idTicket, element) {
  const reponse = await clientGlpiLegacy.post('/Item_Ticket', {
    input: {
      tickets_id: idTicket,
      itemtype: element.itemtype,
      items_id: element.id,
    },
  });

  return reponse.data;
}

export async function recupererElementsTicket(idTicket) {
  const reponse = await clientGlpiLegacy.get(
    `/Item_Ticket?searchText[tickets_id]=${encodeURIComponent(idTicket)}&expand_dropdowns=true`,
  );

  return Array.isArray(reponse.data) ? reponse.data : [];
}
