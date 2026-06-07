import clientGlpiLegacy from './glpiLegacyClient';
import clientGlpiV2 from './glpiV2Client';

function extraireIdTicketCree(donnees) {
  if (donnees?.id) {
    return donnees.id;
  }

  if (Array.isArray(donnees)) {
    return donnees[0]?.id || donnees[0]?.items_id;
  }

  return donnees?.items_id;
}

function normaliserListeTickets(donnees) {
  if (Array.isArray(donnees)) {
    return donnees;
  }

  if (Array.isArray(donnees?.data)) {
    return donnees.data;
  }

  if (Array.isArray(donnees?.items)) {
    return donnees.items;
  }

  if (Array.isArray(donnees?.member)) {
    return donnees.member;
  }

  return [];
}

function creerCorpsTicket(donneesTicket) {
  return {
    name: donneesTicket.titre,
    content: donneesTicket.description,
    type: donneesTicket.type || 1,
    urgency: donneesTicket.urgence || 3,
    priority: donneesTicket.priorite || 3,
    status: 1,
    entities_id: 0,
  };
}

async function recupererTicketsLegacy() {
  const reponse = await clientGlpiLegacy.get('/Ticket?range=0-99&expand_dropdowns=true');

  return normaliserListeTickets(reponse.data);
}

async function recupererTicketsV2() {
  const reponse = await clientGlpiV2.get('/Assistance/Ticket?limit=1000');

  return normaliserListeTickets(reponse.data);
}

export async function recupererTickets() {
  try {
    return await recupererTicketsV2();
  } catch {
    return recupererTicketsLegacy();
  }
}

async function recupererTicketParIdLegacy(idTicket) {
  const reponse = await clientGlpiLegacy.get(`/Ticket/${idTicket}?expand_dropdowns=true`);

  return reponse.data;
}

async function recupererTicketParIdV2(idTicket) {
  const reponse = await clientGlpiV2.get(`/Assistance/Ticket/${idTicket}`);

  return reponse.data;
}

export async function recupererTicketParId(idTicket) {
  try {
    return await recupererTicketParIdV2(idTicket);
  } catch {
    return recupererTicketParIdLegacy(idTicket);
  }
}

async function creerTicketLegacy(donneesTicket) {
  const reponse = await clientGlpiLegacy.post('/Ticket', {
    input: creerCorpsTicket(donneesTicket),
  });

  return {
    ...reponse.data,
    id: extraireIdTicketCree(reponse.data),
  };
}

async function creerTicketV2(donneesTicket) {
  const reponse = await clientGlpiV2.post('/Assistance/Ticket', creerCorpsTicket(donneesTicket));

  return {
    ...reponse.data,
    id: extraireIdTicketCree(reponse.data),
  };
}

export async function creerTicket(donneesTicket) {
  try {
    return await creerTicketV2(donneesTicket);
  } catch {
    return creerTicketLegacy(donneesTicket);
  }
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

export async function recupererElementsDuTicket(idTicket) {
  const reponse = await clientGlpiLegacy.get(
    `/Item_Ticket?searchText[tickets_id]=${encodeURIComponent(idTicket)}&expand_dropdowns=true`,
  );

  return Array.isArray(reponse.data) ? reponse.data : [];
}

export const recupererElementsTicket = recupererElementsDuTicket;
