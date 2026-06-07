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
  if (Array.isArray(donnees)) return donnees;
  if (Array.isArray(donnees?.data)) return donnees.data;
  if (Array.isArray(donnees?.items)) return donnees.items;
  if (Array.isArray(donnees?.member)) return donnees.member;
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

// Formate l'erreur avec le statut HTTP et la réponse GLPI brute pour le journal
function formaterErreurDetaillee(erreur) {
  const statut = erreur.response?.status;
  const corps = erreur.response?.data;
  const messageApi = corps ? JSON.stringify(corps) : (erreur.message || 'Erreur inconnue');
  return statut ? `HTTP ${statut} - ${messageApi}` : messageApi;
}

// Retourne true si l'erreur signifie que la ressource n'existe pas (404 ou NOT_FOUND)
function estErreurIntrouvable(erreur) {
  const statut = erreur.response?.status;
  const corps = JSON.stringify(erreur.response?.data || erreur.message || '').toLowerCase();
  return (
    statut === 404 ||
    corps.includes('not found') ||
    corps.includes('introuvable') ||
    corps.includes('item_not_found') ||
    corps.includes('error_item_not_found')
  );
}

// ─── VÉRIFICATION ─────────────────────────────────────────────────────────────

// Vérifie si un ticket existe encore dans GLPI
// Retourne { supprime, alaCorbeille } — essaie v2 puis v1 en fallback
export async function verifierSuppressionTicket(idTicket) {
  // Vérification via API v2
  try {
    const reponse = await clientGlpiV2.get(`/Assistance/Ticket/${idTicket}`);
    const donnees = reponse.data;
    const alaCorbeille = donnees?.is_deleted === 1 || donnees?.is_deleted === true;
    return { supprime: false, alaCorbeille };
  } catch (erreur) {
    if (estErreurIntrouvable(erreur)) {
      return { supprime: true, alaCorbeille: false };
    }
  }

  // Fallback vérification via API v1
  try {
    const reponse = await clientGlpiLegacy.get(`/Ticket/${idTicket}`);
    const donnees = reponse.data;
    const alaCorbeille = donnees?.is_deleted === 1 || donnees?.is_deleted === true;
    return { supprime: false, alaCorbeille };
  } catch (erreurV1) {
    if (estErreurIntrouvable(erreurV1)) {
      return { supprime: true, alaCorbeille: false };
    }
  }

  return { supprime: false, alaCorbeille: false };
}

// Vérifie si un élément/asset existe encore dans GLPI
// Retourne { supprime, alaCorbeille } — essaie v2 puis v1 en fallback
export async function verifierSuppressionElement(element) {
  // Vérification via API v2
  try {
    const reponse = await clientGlpiV2.get(`/Assets/${element.itemtype}/${element.id}`);
    const donnees = reponse.data;
    const alaCorbeille = donnees?.is_deleted === 1 || donnees?.is_deleted === true;
    return { supprime: false, alaCorbeille };
  } catch (erreur) {
    if (estErreurIntrouvable(erreur)) {
      return { supprime: true, alaCorbeille: false };
    }
  }

  // Fallback vérification via API v1
  try {
    const reponse = await clientGlpiLegacy.get(`/${element.itemtype}/${element.id}`);
    const donnees = reponse.data;
    const alaCorbeille = donnees?.is_deleted === 1 || donnees?.is_deleted === true;
    return { supprime: false, alaCorbeille };
  } catch (erreurV1) {
    if (estErreurIntrouvable(erreurV1)) {
      return { supprime: true, alaCorbeille: false };
    }
  }

  return { supprime: false, alaCorbeille: false };
}

// ─── SUPPRESSION ROBUSTE ───────────────────────────────────────────────────────

// Supprime un ticket avec fallback progressif :
// 1. API v2  →  2. API v1 force_purge  →  3. API v1 simple + force_purge
// Retourne true si le ticket est effectivement supprimé
export async function supprimerTicketRobuste(idTicket, ajouterLog) {
  // Étape 1 — suppression via API v2
  ajouterLog(`Suppression Ticket #${idTicket} via API v2`);
  try {
    await clientGlpiV2.delete(`/Assistance/Ticket/${idTicket}`);
  } catch (erreur) {
    ajouterLog(`Erreur API v2 Ticket #${idTicket} : ${formaterErreurDetaillee(erreur)}`);
  }

  // Vérification après API v2
  ajouterLog(`Vérification Ticket #${idTicket} après API v2`);
  let verification = await verifierSuppressionTicket(idTicket);
  if (verification.supprime) {
    ajouterLog(`Ticket #${idTicket} suppression confirmée`);
    return true;
  }

  if (verification.alaCorbeille) {
    ajouterLog(`Ticket #${idTicket} mis à la corbeille mais pas supprimé définitivement`);
  } else {
    ajouterLog(`Ticket #${idTicket} existe encore, tentative API v1 force_purge`);
  }

  // Étape 2 — suppression via API v1 force_purge
  ajouterLog(`Suppression Ticket #${idTicket} via API v1 force_purge`);
  try {
    await clientGlpiLegacy.delete(`/Ticket/${idTicket}?force_purge=true`);
  } catch (erreur) {
    ajouterLog(`Erreur API v1 force_purge Ticket #${idTicket} : ${formaterErreurDetaillee(erreur)}`);
  }

  // Vérification après force_purge
  ajouterLog(`Vérification Ticket #${idTicket} après force_purge`);
  verification = await verifierSuppressionTicket(idTicket);
  if (verification.supprime) {
    ajouterLog(`Ticket #${idTicket} suppression confirmée`);
    return true;
  }

  // Étape 3 — suppression simple v1 puis force_purge (mise à la corbeille d'abord)
  ajouterLog(`Ticket #${idTicket} existe encore, tentative API v1 suppression simple`);
  try {
    await clientGlpiLegacy.delete(`/Ticket/${idTicket}`);
  } catch (erreur) {
    ajouterLog(`Erreur API v1 simple Ticket #${idTicket} : ${formaterErreurDetaillee(erreur)}`);
  }

  try {
    await clientGlpiLegacy.delete(`/Ticket/${idTicket}?force_purge=true`);
  } catch (erreur) {
    ajouterLog(`Erreur API v1 force_purge final Ticket #${idTicket} : ${formaterErreurDetaillee(erreur)}`);
  }

  // Vérification finale
  verification = await verifierSuppressionTicket(idTicket);
  if (verification.supprime) {
    ajouterLog(`Ticket #${idTicket} suppression confirmée`);
    return true;
  }

  ajouterLog(`Ticket #${idTicket} non supprimé après toutes les tentatives`);
  return false;
}

// Supprime un élément/asset avec fallback progressif :
// 1. API v2  →  2. API v1 force_purge  →  3. API v1 simple + force_purge
// Retourne true si l'élément est effectivement supprimé
export async function supprimerElementRobuste(element, ajouterLog) {
  const libelle = `${element.itemtype} #${element.id}`;

  // Étape 1 — suppression via API v2
  ajouterLog(`Suppression ${libelle} via API v2`);
  try {
    await clientGlpiV2.delete(`/Assets/${element.itemtype}/${element.id}`);
  } catch (erreur) {
    ajouterLog(`Erreur API v2 ${libelle} : ${formaterErreurDetaillee(erreur)}`);
  }

  // Vérification après API v2
  ajouterLog(`Vérification ${libelle} après API v2`);
  let verification = await verifierSuppressionElement(element);
  if (verification.supprime) {
    ajouterLog(`${libelle} suppression confirmée`);
    return true;
  }

  if (verification.alaCorbeille) {
    ajouterLog(`${libelle} mis à la corbeille mais pas supprimé définitivement`);
  } else {
    ajouterLog(`${libelle} existe encore, tentative API v1 force_purge`);
  }

  // Étape 2 — suppression via API v1 force_purge
  ajouterLog(`Suppression ${libelle} via API v1 force_purge`);
  try {
    await clientGlpiLegacy.delete(`/${element.itemtype}/${element.id}?force_purge=true`);
  } catch (erreur) {
    ajouterLog(`Erreur API v1 force_purge ${libelle} : ${formaterErreurDetaillee(erreur)}`);
  }

  // Vérification après force_purge
  ajouterLog(`Vérification ${libelle} après force_purge`);
  verification = await verifierSuppressionElement(element);
  if (verification.supprime) {
    ajouterLog(`${libelle} suppression confirmée`);
    return true;
  }

  // Étape 3 — suppression simple v1 puis force_purge (mise à la corbeille d'abord)
  ajouterLog(`${libelle} existe encore, tentative API v1 suppression simple`);
  try {
    await clientGlpiLegacy.delete(`/${element.itemtype}/${element.id}`);
  } catch (erreur) {
    ajouterLog(`Erreur API v1 simple ${libelle} : ${formaterErreurDetaillee(erreur)}`);
  }

  try {
    await clientGlpiLegacy.delete(`/${element.itemtype}/${element.id}?force_purge=true`);
  } catch (erreur) {
    ajouterLog(`Erreur API v1 force_purge final ${libelle} : ${formaterErreurDetaillee(erreur)}`);
  }

  // Vérification finale
  verification = await verifierSuppressionElement(element);
  if (verification.supprime) {
    ajouterLog(`${libelle} suppression confirmée`);
    return true;
  }

  ajouterLog(`${libelle} non supprimé après toutes les tentatives`);
  return false;
}

// ─── RÉCUPÉRATION ─────────────────────────────────────────────────────────────

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

// ─── SUPPRESSION DES RELATIONS ET COÛTS ───────────────────────────────────────

export async function supprimerRelationItemTicketV1(id) {
  const reponse = await clientGlpiLegacy.delete(`/Item_Ticket/${id}`);

  return reponse.data;
}

export async function supprimerCoutTicketV1(id) {
  const reponse = await clientGlpiLegacy.delete(`/TicketCost/${id}?force_purge=true`);

  return reponse.data;
}

// ─── RÉINITIALISATION COMPLÈTE ────────────────────────────────────────────────

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

  // Suppression des relations Item_Ticket (API v1)
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

  // Suppression des coûts TicketCost (API v1 avec force_purge)
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

  // Suppression des tickets avec fallback robuste v2 → v1 force_purge → v1 simple
  ajouterLog(`${tickets.length} tickets récupérés via API v2`);
  for (const ticket of tickets) {
    try {
      const supprime = await supprimerTicketRobuste(ticket.id, ajouterLog);
      if (supprime) {
        resume.ticketsSupprimes += 1;
      } else {
        resume.ticketsNonSupprimes += 1;
        const message = `Ticket #${ticket.id} non supprimé après toutes les tentatives`;
        erreurs.push(message);
      }
    } catch (erreur) {
      resume.ticketsNonSupprimes += 1;
      const message = `Ticket #${ticket.id} : ${formaterErreurDetaillee(erreur)}`;
      erreurs.push(message);
      ajouterLog(`Erreur ${message}`);
    }
  }

  // Suppression des éléments/assets avec fallback robuste v2 → v1 force_purge → v1 simple
  ajouterLog(`${elements.length} éléments/assets récupérés via API v2`);
  for (const element of elements) {
    try {
      const supprime = await supprimerElementRobuste(element, ajouterLog);
      if (supprime) {
        resume.elementsSupprimes += 1;
      } else {
        resume.elementsNonSupprimes += 1;
        const message = `${element.itemtype} #${element.id} non supprimé après toutes les tentatives`;
        erreurs.push(message);
      }
    } catch (erreur) {
      resume.elementsNonSupprimes += 1;
      const message = `${element.itemtype} #${element.id} : ${formaterErreurDetaillee(erreur)}`;
      erreurs.push(message);
      ajouterLog(`Erreur ${message}`);
    }
  }

  return resume;
}
