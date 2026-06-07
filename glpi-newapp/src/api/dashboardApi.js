import clientGlpiLegacy from './glpiLegacyClient';
import clientGlpiV2 from './glpiV2Client';

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

const cheminsElements = [
  ['ordinateurs', '/Computer?range=0-999&expand_dropdowns=true', '/Asset/Computer?limit=1000'],
  ['moniteurs', '/Monitor?range=0-999&expand_dropdowns=true', '/Asset/Monitor?limit=1000'],
  ['imprimantes', '/Printer?range=0-999&expand_dropdowns=true', '/Asset/Printer?limit=1000'],
  ['telephones', '/Phone?range=0-999&expand_dropdowns=true', '/Asset/Phone?limit=1000'],
  [
    'equipementsReseau',
    '/NetworkEquipment?range=0-999&expand_dropdowns=true',
    '/Asset/NetworkEquipment?limit=1000',
  ],
  ['peripheriques', '/Peripheral?range=0-999&expand_dropdowns=true', '/Asset/Peripheral?limit=1000'],
];

function normaliserListe(donnees) {
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

function compterTicketsParValeur(tickets, champ, valeur) {
  return tickets.filter((ticket) => Number(ticket[champ]) === valeur).length;
}

async function recupererListe(endpoint) {
  const reponse = await clientGlpiLegacy.get(endpoint);
  return normaliserListe(reponse.data);
}

async function recupererListeV2(chemin) {
  const reponse = await clientGlpiV2.get(chemin);
  return normaliserListe(reponse.data);
}

function calculerStatistiques(tickets, groupesElements) {
  const statistiquesElements = cheminsElements.reduce((accumulateur, [cle], index) => {
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

async function recupererStatistiquesDashboardLegacy() {
  const [tickets, ...groupesElements] = await Promise.all([
    recupererListe('/Ticket?range=0-999&expand_dropdowns=true'),
    ...cheminsElements.map(([, chemin]) => recupererListe(chemin)),
  ]);

  return calculerStatistiques(tickets, groupesElements);
}

async function recupererStatistiquesDashboardV2() {
  const [tickets, ...groupesElements] = await Promise.all([
    recupererListeV2('/Assistance/Ticket?limit=1000'),
    ...cheminsElements.map(([, , cheminV2]) => recupererListeV2(cheminV2)),
  ]);

  return calculerStatistiques(tickets, groupesElements);
}

export async function recupererStatistiquesDashboard() {
  try {
    return await recupererStatistiquesDashboardV2();
  } catch {
    return recupererStatistiquesDashboardLegacy();
  }
}

export async function recupererStatsDashboard() {
  return recupererStatistiquesDashboard();
}
