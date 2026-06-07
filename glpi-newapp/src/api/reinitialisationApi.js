import clientGlpiLegacy from './glpiLegacyClient';
import clientGlpiV2 from './glpiV2Client';
import { afficherValeurGlpi } from '../utils/affichage';

const typesElementsMetier = [
  ['Computer', 'Ordinateurs'],
  ['Monitor', 'Moniteurs'],
  ['Printer', 'Imprimantes'],
  ['Phone', 'Téléphones'],
  ['NetworkEquipment', 'Équipements réseau'],
  ['Peripheral', 'Périphériques'],
];

function convertirEnTableau(donnees) {
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

function normaliserTicket(ticket) {
  return {
    ...ticket,
    statut: afficherValeurGlpi(ticket.status),
    type: afficherValeurGlpi(ticket.type),
    priorite: afficherValeurGlpi(ticket.priority),
  };
}

function normaliserElement(element, itemtype) {
  return {
    ...element,
    itemtype,
    nom: afficherValeurGlpi(element.name),
    statut: afficherValeurGlpi(element.states_id),
    localisation: afficherValeurGlpi(element.locations_id),
    fabricant: afficherValeurGlpi(element.manufacturers_id),
  };
}

function recupererMessageErreur(erreur) {
  return erreur?.message || 'Erreur inconnue';
}

function estErreurIntrouvable(erreur) {
  const statutHttp = erreur.response?.status;
  const message = JSON.stringify(erreur.response?.data || erreur.message || '').toLowerCase();

  return statutHttp === 404 || message.includes('not found') || message.includes('introuvable');
}

export async function recupererTicketsV2() {
  const reponse = await clientGlpiV2.get('/Assistance/Ticket?limit=500');

  return convertirEnTableau(reponse.data).map(normaliserTicket);
}

async function recupererElementsParTypeV2(itemtype) {
  const reponse = await clientGlpiV2.get(`/Assets/${itemtype}?limit=500`);

  return convertirEnTableau(reponse.data).map((element) => normaliserElement(element, itemtype));
}

export async function recupererElementsV2() {
  const groupesElements = await Promise.all(
    typesElementsMetier.map(([itemtype]) => recupererElementsParTypeV2(itemtype)),
  );

  return groupesElements.flat();
}

export async function recupererRelationsItemTicketV1() {
  try {
    const reponse = await clientGlpiLegacy.get('/Item_Ticket?range=0-999&expand_dropdowns=true');
    return convertirEnTableau(reponse.data);
  } catch {
    return [];
  }
}

export async function recupererCoutsTicketV1() {
  try {
    const reponse = await clientGlpiLegacy.get('/TicketCost?range=0-999&expand_dropdowns=true');
    return convertirEnTableau(reponse.data);
  } catch {
    return [];
  }
}

export async function recupererModulesDisponibles() {
  const [tickets, relations, couts, ...groupesElements] = await Promise.all([
    recupererTicketsV2(),
    recupererRelationsItemTicketV1(),
    recupererCoutsTicketV1(),
    ...typesElementsMetier.map(([itemtype]) => recupererElementsParTypeV2(itemtype)),
  ]);

  const modulesElements = typesElementsMetier.map(([, libelle], index) => ({
    cle: `assets-${typesElementsMetier[index][0]}`,
    libelle,
    nombre: groupesElements[index]?.length || 0,
  }));

  return {
    modules: [
      { cle: 'tickets', libelle: 'Tickets', nombre: tickets.length },
      { cle: 'relations', libelle: 'Relations Item_Ticket', nombre: relations.length },
      { cle: 'couts', libelle: 'Coûts TicketCost si disponibles', nombre: couts.length },
      ...modulesElements,
    ],
    tickets,
    relations,
    couts,
    elements: groupesElements.flat(),
  };
}

export async function supprimerRelationItemTicketV1(id) {
  const reponse = await clientGlpiLegacy.delete(`/Item_Ticket/${id}`);

  return reponse.data;
}

export async function supprimerCoutTicketV1(id) {
  const reponse = await clientGlpiLegacy.delete(`/TicketCost/${id}?force_purge=true`);

  return reponse.data;
}

export async function supprimerTicketV2(id) {
  const reponse = await clientGlpiV2.delete(`/Assistance/Ticket/${id}`);

  return reponse.data;
}

export async function supprimerElementV2(element) {
  const reponse = await clientGlpiV2.delete(`/Assets/${element.itemtype}/${element.id}`);

  return reponse.data;
}

export async function verifierSuppressionTicketV2(id) {
  try {
    await clientGlpiV2.get(`/Assistance/Ticket/${id}`);
    return false;
  } catch (erreur) {
    return estErreurIntrouvable(erreur);
  }
}

export async function verifierSuppressionElementV2(element) {
  try {
    await clientGlpiV2.get(`/Assets/${element.itemtype}/${element.id}`);
    return false;
  } catch (erreur) {
    return estErreurIntrouvable(erreur);
  }
}

export async function reinitialiserToutesLesDonneesMetier(ajouterLog) {
  const erreurs = [];
  const resume = {
    ticketsTrouves: 0,
    ticketsSupprimes: 0,
    ticketsNonSupprimes: 0,
    relationsTrouvees: 0,
    relationsSupprimees: 0,
    coutsTrouves: 0,
    coutsSupprimes: 0,
    elementsTrouves: 0,
    elementsSupprimes: 0,
    elementsNonSupprimes: 0,
    erreurs,
  };

  ajouterLog('Récupération des données métier détectées');
  const [tickets, relations, couts, elements] = await Promise.all([
    recupererTicketsV2().catch((erreur) => {
      erreurs.push(`Tickets v2 : ${recupererMessageErreur(erreur)}`);
      ajouterLog(`Erreur récupération tickets v2 : ${recupererMessageErreur(erreur)}`);
      return [];
    }),
    recupererRelationsItemTicketV1(),
    recupererCoutsTicketV1(),
    recupererElementsV2().catch((erreur) => {
      erreurs.push(`Assets v2 : ${recupererMessageErreur(erreur)}`);
      ajouterLog(`Erreur récupération assets v2 : ${recupererMessageErreur(erreur)}`);
      return [];
    }),
  ]);

  resume.ticketsTrouves = tickets.length;
  resume.relationsTrouvees = relations.length;
  resume.coutsTrouves = couts.length;
  resume.elementsTrouves = elements.length;

  ajouterLog(`${relations.length} relations Item_Ticket récupérées`);
  for (const relation of relations) {
    try {
      await supprimerRelationItemTicketV1(relation.id);
      resume.relationsSupprimees += 1;
      ajouterLog(`Relation Item_Ticket #${relation.id} supprimée`);
    } catch (erreur) {
      const message = `Relation Item_Ticket #${relation.id} : ${recupererMessageErreur(erreur)}`;
      erreurs.push(message);
      ajouterLog(`Erreur ${message}`);
    }
  }

  ajouterLog(`${couts.length} coûts TicketCost récupérés`);
  for (const cout of couts) {
    try {
      await supprimerCoutTicketV1(cout.id);
      resume.coutsSupprimes += 1;
      ajouterLog(`Coût TicketCost #${cout.id} supprimé`);
    } catch (erreur) {
      const message = `TicketCost #${cout.id} : ${recupererMessageErreur(erreur)}`;
      erreurs.push(message);
      ajouterLog(`Erreur ${message}`);
    }
  }

  ajouterLog(`${tickets.length} tickets récupérés via API v2`);
  for (const ticket of tickets) {
    try {
      await supprimerTicketV2(ticket.id);

      if (await verifierSuppressionTicketV2(ticket.id)) {
        resume.ticketsSupprimes += 1;
        ajouterLog(`Ticket #${ticket.id} suppression confirmée`);
      } else {
        resume.ticketsNonSupprimes += 1;
        ajouterLog(`Ticket #${ticket.id} existe encore après suppression`);
      }
    } catch (erreur) {
      resume.ticketsNonSupprimes += 1;
      const message = `Ticket #${ticket.id} : ${recupererMessageErreur(erreur)}`;
      erreurs.push(message);
      ajouterLog(`Erreur ${message}`);
    }
  }

  ajouterLog(`${elements.length} éléments/assets récupérés via API v2`);
  for (const element of elements) {
    try {
      await supprimerElementV2(element);

      if (await verifierSuppressionElementV2(element)) {
        resume.elementsSupprimes += 1;
        ajouterLog(`Élément ${element.itemtype} #${element.id} suppression confirmée`);
      } else {
        resume.elementsNonSupprimes += 1;
        ajouterLog(`Élément ${element.itemtype} #${element.id} existe encore après suppression`);
      }
    } catch (erreur) {
      resume.elementsNonSupprimes += 1;
      const message = `${element.itemtype} #${element.id} : ${recupererMessageErreur(erreur)}`;
      erreurs.push(message);
      ajouterLog(`Erreur ${message}`);
    }
  }

  return resume;
}
