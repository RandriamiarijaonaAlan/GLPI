import clientGlpiLegacy from './glpiLegacyClient';
import clientGlpiV2 from './glpiV2Client';
import { typesElementsSupportes } from './importApi';
import { afficherValeurGlpi } from '../utils/affichage';

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

export const libellesElements = Object.fromEntries(
  Object.entries(typesElementsSupportes).map(([itemtype, config]) => [itemtype, config.libelle]),
);

export const categoriesElements = [
  { libelle: 'Matériel', types: ['Computer', 'Monitor', 'Printer', 'Phone', 'NetworkEquipment', 'Peripheral'] },
  { libelle: 'Logiciels', types: ['Software', 'SoftwareLicense', 'Certificate', 'Appliance'] },
  {
    libelle: 'Infrastructure DC',
    types: ['Rack', 'Enclosure', 'PDU', 'PassiveDCEquipment', 'Cable', 'Socket'],
  },
  { libelle: 'Consommables', types: ['Cartridge', 'Consumable'] },
  { libelle: 'Autres', types: ['Unmanaged'] },
];

const cheminsElements = Object.entries(typesElementsSupportes).map(([itemtype, config]) => [
  itemtype,
  `${config.endpointV1}?range=0-999&expand_dropdowns=true`,
  `${config.endpointV2}?limit=1000`,
]);

function normaliserListe(donnees) {
  if (Array.isArray(donnees)) return donnees;
  if (Array.isArray(donnees?.data)) return donnees.data;
  if (Array.isArray(donnees?.items)) return donnees.items;
  if (Array.isArray(donnees?.member)) return donnees.member;
  return [];
}

function compterTicketsParValeur(tickets, champ, valeur) {
  return tickets.filter((ticket) => Number(ticket[champ]) === valeur).length;
}

function ticketEstVisible(ticket) {
  return ticket?.is_deleted !== 1 && ticket?.is_deleted !== true && String(ticket?.is_deleted || '') !== '1';
}

function recupererIdGlpi(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') {
    return '';
  }

  if (typeof valeur === 'object') {
    return String(valeur.id || valeur.value || afficherValeurGlpi(valeur) || '').trim();
  }

  return String(valeur).trim();
}

function coutEstLieATicketVisible(cout, idsTicketsVisibles) {
  const idTicket = recupererIdGlpi(cout?.tickets_id);

  if (!idsTicketsVisibles?.size) {
    return true;
  }

  return !idTicket || idsTicketsVisibles.has(idTicket);
}

function convertirNombreGlpi(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') {
    return 0;
  }

  const nombre = Number(String(valeur).trim().replace(/\s+/g, '').replace(',', '.'));
  return Number.isNaN(nombre) ? 0 : nombre;
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
  const elements = {};
  cheminsElements.forEach(([itemtype], index) => {
    elements[itemtype] = groupesElements[index]?.length || 0;
  });

  const totalElements = Object.values(elements).reduce((total, v) => total + v, 0);

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
    prioriteTresBasse: compterTicketsParValeur(tickets, 'priority', 1),
    prioriteBasse: compterTicketsParValeur(tickets, 'priority', 2),
    prioriteMoyenne: compterTicketsParValeur(tickets, 'priority', 3),
    prioriteHaute: compterTicketsParValeur(tickets, 'priority', 4),
    prioriteTresHaute: compterTicketsParValeur(tickets, 'priority', 5),
    prioriteMajeure: compterTicketsParValeur(tickets, 'priority', 6),
    totalElements,
    elements,
  };
}

async function recupererStatistiquesDashboardLegacy() {
  const [tickets, ...groupesElements] = await Promise.all([
    recupererListe('/Ticket?range=0-999&expand_dropdowns=true'),
    ...cheminsElements.map(([, chemin]) => recupererListe(chemin).catch(() => [])),
  ]);
  return calculerStatistiques(tickets.filter(ticketEstVisible), groupesElements);
}

async function recupererStatistiquesDashboardV2() {
  const [tickets, ...groupesElements] = await Promise.all([
    recupererListeV2('/Assistance/Ticket?limit=1000'),
    ...cheminsElements.map(([, , cheminV2]) => recupererListeV2(cheminV2).catch(() => [])),
  ]);
  return calculerStatistiques(tickets.filter(ticketEstVisible), groupesElements);
}

async function recupererIdsTicketsVisiblesDashboard() {
  try {
    const tickets = await recupererListeV2('/Assistance/Ticket?limit=1000');
    return new Set(tickets.filter(ticketEstVisible).map((ticket) => String(ticket.id)));
  } catch {
    const tickets = await recupererListe('/Ticket?range=0-999&expand_dropdowns=true');
    return new Set(tickets.filter(ticketEstVisible).map((ticket) => String(ticket.id)));
  }
}

async function recupererCoutsDashboard(idsTicketsVisibles) {
  try {
    const reponse = await clientGlpiLegacy.get('/TicketCost?range=0-999');
    const couts = normaliserListe(reponse.data).filter((cout) => coutEstLieATicketVisible(cout, idsTicketsVisibles));
    return couts.reduce(
      (acc, cout) => {
        acc.dureeSecondes += convertirNombreGlpi(cout.actiontime);
        acc.coutTemps += convertirNombreGlpi(cout.cost_time);
        acc.coutFixe += convertirNombreGlpi(cout.cost_fixed);
        acc.nombreCouts += 1;
        return acc;
      },
      { dureeSecondes: 0, coutTemps: 0, coutFixe: 0, nombreCouts: 0 },
    );
  } catch {
    return { dureeSecondes: 0, coutTemps: 0, coutFixe: 0, nombreCouts: 0 };
  }
}

export async function recupererStatistiquesDashboard() {
  const idsTicketsVisibles = await recupererIdsTicketsVisiblesDashboard();
  const [stats, couts] = await Promise.allSettled([
    recupererStatistiquesDashboardV2().catch(() => recupererStatistiquesDashboardLegacy()),
    recupererCoutsDashboard(idsTicketsVisibles),
  ]);

  return {
    ...(stats.value ?? stats.reason ?? {}),
    couts: couts.value ?? { dureeSecondes: 0, coutTemps: 0, coutFixe: 0, nombreCouts: 0 },
  };
}

export async function recupererStatsDashboard() {
  return recupererStatistiquesDashboard();
}
