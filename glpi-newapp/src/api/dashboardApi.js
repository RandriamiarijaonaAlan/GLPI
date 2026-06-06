import clientGlpiLegacy from './glpiLegacyClient';

export const libellesStatut = {
  1: 'Nouveau',
  2: 'En cours attribué',
  3: 'En cours planifié',
  4: 'En attente',
  5: 'Résolu',
  6: 'Clos',
};

export const libellesType = {
  1: 'Incident',
  2: 'Demande',
};

export const libellesPriorite = {
  1: 'Très basse',
  2: 'Basse',
  3: 'Moyenne',
  4: 'Haute',
  5: 'Très haute',
  6: 'Majeure',
};

const endpointsElements = [
  ['ordinateurs', '/Computer?range=0-999&expand_dropdowns=true'],
  ['moniteurs', '/Monitor?range=0-999&expand_dropdowns=true'],
  ['imprimantes', '/Printer?range=0-999&expand_dropdowns=true'],
  ['telephones', '/Phone?range=0-999&expand_dropdowns=true'],
  ['equipementsReseau', '/NetworkEquipment?range=0-999&expand_dropdowns=true'],
  ['peripheriques', '/Peripheral?range=0-999&expand_dropdowns=true'],
];

function normaliserListe(donnees) {
  return Array.isArray(donnees) ? donnees : [];
}

function compterTicketsParValeur(tickets, champ, valeur) {
  return tickets.filter((ticket) => Number(ticket[champ]) === valeur).length;
}

async function recupererListe(endpoint) {
  const reponse = await clientGlpiLegacy.get(endpoint);
  return normaliserListe(reponse.data);
}

export async function recupererStatistiquesDashboard() {
  const [tickets, ...groupesElements] = await Promise.all([
    recupererListe('/Ticket?range=0-999&expand_dropdowns=true'),
    ...endpointsElements.map(([, endpoint]) => recupererListe(endpoint)),
  ]);

  const statistiquesElements = endpointsElements.reduce((accumulateur, [cle], index) => {
    accumulateur[cle] = groupesElements[index]?.length || 0;
    return accumulateur;
  }, {});

  const totalElements = Object.values(statistiquesElements).reduce(
    (total, valeur) => total + valeur,
    0,
  );

  return {
    totalTickets: tickets.length,
    ticketsNouveaux: compterTicketsParValeur(tickets, 'status', 1),
    ticketsEnCoursAttribues: compterTicketsParValeur(tickets, 'status', 2),
    ticketsEnCoursPlanifies: compterTicketsParValeur(tickets, 'status', 3),
    ticketsEnAttente: compterTicketsParValeur(tickets, 'status', 4),
    ticketsResolus: compterTicketsParValeur(tickets, 'status', 5),
    ticketsClos: compterTicketsParValeur(tickets, 'status', 6),
    incidents: compterTicketsParValeur(tickets, 'type', 1),
    demandes: compterTicketsParValeur(tickets, 'type', 2),
    totalElements,
    ordinateurs: statistiquesElements.ordinateurs,
    moniteurs: statistiquesElements.moniteurs,
    imprimantes: statistiquesElements.imprimantes,
    telephones: statistiquesElements.telephones,
    equipementsReseau: statistiquesElements.equipementsReseau,
    peripheriques: statistiquesElements.peripheriques,
  };
}

export async function recupererStatsDashboard() {
  return recupererStatistiquesDashboard();
}
