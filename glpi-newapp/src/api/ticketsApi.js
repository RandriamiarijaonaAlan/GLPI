import clientGlpiLegacy from './glpiLegacyClient';
import clientGlpiV2 from './glpiV2Client';

const MARQUAGE_NEWAPP = 'NEWAPP_IMPORT_JUIN_2026';

function convertirNombreFormulaire(valeur) {
  if (valeur === null || valeur === undefined) {
    return 0;
  }

  const texte = String(valeur).trim().replace(',', '.');

  if (!texte) {
    return 0;
  }

  const nombre = Number(texte);
  return Number.isNaN(nombre) ? 0 : nombre;
}

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

function ticketEstVisible(ticket) {
  return ticket?.is_deleted !== 1 && ticket?.is_deleted !== true && String(ticket?.is_deleted || '') !== '1';
}

function construireContenuTicket(donneesTicket) {
  const lignes = [];
  const description = String(donneesTicket.description || '').trim();
  const refTicket = String(donneesTicket.refTicket || '').trim();

  if (description) {
    lignes.push(description);
  }

  if (!description.includes(MARQUAGE_NEWAPP)) {
    if (lignes.length > 0) {
      lignes.push('');
    }
    lignes.push(MARQUAGE_NEWAPP);
  }

  if (refTicket) {
    lignes.push(`Ref_Ticket: ${refTicket}`);
  }

  return lignes.join('\n');
}

function creerCorpsTicket(donneesTicket) {
  return {
    name: donneesTicket.titre,
    content: construireContenuTicket(donneesTicket),
    type: donneesTicket.type || 1,
    urgency: donneesTicket.urgence || 3,
    priority: donneesTicket.priorite || 3,
    status: donneesTicket.status || 1,
    entities_id: 0,
  };
}

async function recupererTicketsLegacy() {
  const reponse = await clientGlpiLegacy.get('/Ticket?range=0-9999&expand_dropdowns=true');

  return normaliserListeTickets(reponse.data).filter(ticketEstVisible);
}

async function recupererTicketsV2() {
  const reponse = await clientGlpiV2.get('/Assistance/Ticket?limit=9000');

  return normaliserListeTickets(reponse.data).filter(ticketEstVisible);
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

export async function creerCoutTicket(idTicket, donneesCout) {
  const corpsCout = {
    tickets_id: idTicket,
    name: donneesCout?.nom || `${MARQUAGE_NEWAPP} - Coût saisi depuis NewAPP`,
    actiontime: convertirNombreFormulaire(donneesCout?.dureeSecondes),
    cost_time: convertirNombreFormulaire(donneesCout?.coutTemps),
    cost_fixed: convertirNombreFormulaire(donneesCout?.coutFixe),
    entities_id: 0,
  };

  const reponse = await clientGlpiLegacy.post('/TicketCost', {
    input: corpsCout,
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
export { convertirNombreFormulaire };
