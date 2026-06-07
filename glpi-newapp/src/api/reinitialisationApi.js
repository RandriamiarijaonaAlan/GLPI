import clientGlpiLegacy from './glpiLegacyClient';

export const MARQUEUR_IMPORT_NEWAPP = 'NEWAPP_IMPORT_JUIN_2026';

const typesElementsAReinitialiser = [
  'Computer',
  'Monitor',
  'Printer',
  'Phone',
  'NetworkEquipment',
  'Peripheral',
];

const champsTickets = ['name', 'content', 'comment'];
const champsElements = ['name', 'comment', 'serial', 'otherserial', 'inventory_number'];

function convertirEnTableau(donnees) {
  return Array.isArray(donnees) ? donnees : [];
}

function normaliserValeur(valeur) {
  return String(valeur ?? '').trim().toLowerCase();
}

function recupererMessageErreur(erreur) {
  return erreur?.message || 'Erreur inconnue';
}

function creerErreurSuppression(typeDonnee, idDonnee, erreur) {
  return `${typeDonnee} #${idDonnee} : ${recupererMessageErreur(erreur)}`;
}

function recupererListeConfiguration(nomsVariables) {
  return nomsVariables.flatMap((nomVariable) => {
    const valeur = import.meta.env[nomVariable];

    if (!valeur) {
      return [];
    }

    return valeur
      .split(/[\n,;|]+/)
      .map((element) => element.trim())
      .filter(Boolean);
  });
}

const referencesTicketsCsv = recupererListeConfiguration([
  'VITE_NEWAPP_REFS_TICKETS',
  'VITE_NEWAPP_REFERENCES_TICKETS',
  'VITE_NEWAPP_REFERENCES_CSV',
  'VITE_NEWAPP_REF_TICKET_CSV',
]);

const titresTicketsCsv = recupererListeConfiguration([
  'VITE_NEWAPP_TITRES_TICKETS',
  'VITE_NEWAPP_TITRES_CSV',
]);

const descriptionsTicketsCsv = recupererListeConfiguration([
  'VITE_NEWAPP_DESCRIPTIONS_TICKETS',
  'VITE_NEWAPP_DESCRIPTIONS_CSV',
]);

const nomsElementsCsv = recupererListeConfiguration([
  'VITE_NEWAPP_NOMS_ELEMENTS',
  'VITE_NEWAPP_NOMS_ELEMENTS_CSV',
]);

const numerosSerieElementsCsv = recupererListeConfiguration([
  'VITE_NEWAPP_SERIALS_ELEMENTS',
  'VITE_NEWAPP_NUMEROS_SERIE_ELEMENTS',
  'VITE_NEWAPP_SERIALS_CSV',
]);

function valeurCorrespondAListe(valeur, liste) {
  const valeurNormalisee = normaliserValeur(valeur);

  return Boolean(
    valeurNormalisee &&
      liste.some((reference) => {
        const referenceNormalisee = normaliserValeur(reference);
        return (
          referenceNormalisee &&
          (valeurNormalisee === referenceNormalisee ||
            valeurNormalisee.includes(referenceNormalisee) ||
            referenceNormalisee.includes(valeurNormalisee))
        );
      }),
  );
}

function objetContientTexte(objet, texte) {
  const texteNormalise = normaliserValeur(texte);

  if (!texteNormalise) {
    return false;
  }

  return Object.values(objet).some((valeur) => normaliserValeur(valeur).includes(texteNormalise));
}

function champsContiennentMarqueur(donnee, champs) {
  return champs.some((champ) => contientMarqueur(donnee[champ]));
}

export function contientMarqueur(valeur) {
  return String(valeur ?? '').includes(MARQUEUR_IMPORT_NEWAPP);
}

function ticketCorrespondAuxDonneesCsv(ticket) {
  return (
    valeurCorrespondAListe(ticket.name, referencesTicketsCsv) ||
    valeurCorrespondAListe(ticket.name, titresTicketsCsv) ||
    valeurCorrespondAListe(ticket.content, descriptionsTicketsCsv) ||
    referencesTicketsCsv.some((reference) => objetContientTexte(ticket, reference))
  );
}

function ticketCreeDepuisNewApp(ticket) {
  return (
    objetContientTexte(ticket, 'NewAPP') ||
    objetContientTexte(ticket, 'FrontOffice') ||
    objetContientTexte(ticket, 'GLPI NewAPP')
  );
}

function ticketEstConcerne(ticket) {
  return (
    champsContiennentMarqueur(ticket, champsTickets) ||
    ticketCorrespondAuxDonneesCsv(ticket) ||
    ticketCreeDepuisNewApp(ticket)
  );
}

function elementCorrespondAuxDonneesCsv(element) {
  return (
    valeurCorrespondAListe(element.name, nomsElementsCsv) ||
    valeurCorrespondAListe(element.serial, numerosSerieElementsCsv) ||
    valeurCorrespondAListe(element.otherserial, numerosSerieElementsCsv) ||
    valeurCorrespondAListe(element.inventory_number, numerosSerieElementsCsv)
  );
}

function elementEstConcerne(element) {
  return (
    contientMarqueur(element.comment) ||
    elementCorrespondAuxDonneesCsv(element) ||
    objetContientTexte(element, 'NewAPP')
  );
}

function verifierConfigurationCorrespondances(avertissements) {
  const aucuneReferenceCsv =
    referencesTicketsCsv.length === 0 &&
    titresTicketsCsv.length === 0 &&
    descriptionsTicketsCsv.length === 0 &&
    nomsElementsCsv.length === 0 &&
    numerosSerieElementsCsv.length === 0;

  if (aucuneReferenceCsv) {
    avertissements.push(
      'Aucune liste CSV configurée dans les variables VITE_NEWAPP_*. La réinitialisation utilisera seulement le marqueur et les champs contenant NewAPP.',
    );
  }
}

async function supprimerAvecPurgeForcee(chemin, cheminSimple) {
  try {
    const reponse = await clientGlpiLegacy.delete(`${chemin}?force_purge=true`);
    return reponse.data;
  } catch (erreurPurge) {
    await clientGlpiLegacy.delete(cheminSimple || chemin);
    const reponse = await clientGlpiLegacy.delete(`${chemin}?force_purge=true`);
    return reponse.data;
  }
}

async function recupererElementsParType(itemtype) {
  const reponse = await clientGlpiLegacy.get(`/${itemtype}?range=0-999&expand_dropdowns=true`);
  const donnees = convertirEnTableau(reponse.data);

  return donnees
    .map((element) => ({
      ...element,
      itemtype,
    }))
    .filter(elementEstConcerne);
}

export async function recupererTicketsAReinitialiser() {
  const reponse = await clientGlpiLegacy.get('/Ticket?range=0-999&expand_dropdowns=true');
  const tickets = convertirEnTableau(reponse.data);

  return tickets.filter(ticketEstConcerne);
}

export async function recupererElementsAReinitialiser() {
  const resultats = await Promise.all(
    typesElementsAReinitialiser.map((itemtype) => recupererElementsParType(itemtype)),
  );

  return resultats.flat();
}

export async function recupererRelationsTicketElement(idTicket) {
  const reponse = await clientGlpiLegacy.get(
    `/Item_Ticket?searchText[tickets_id]=${encodeURIComponent(idTicket)}&expand_dropdowns=true`,
  );

  return convertirEnTableau(reponse.data);
}

export async function supprimerRelationTicketElement(idRelation) {
  const reponse = await clientGlpiLegacy.delete(`/Item_Ticket/${idRelation}`);

  return reponse.data;
}

export async function recupererCoutsTicket(idTicket) {
  const reponse = await clientGlpiLegacy.get(`/Ticket/${idTicket}/TicketCost`);

  return convertirEnTableau(reponse.data);
}

export async function supprimerCoutTicket(idCout) {
  return supprimerAvecPurgeForcee(`/TicketCost/${idCout}`);
}

export async function supprimerTicketAReinitialiser(idTicket) {
  return supprimerAvecPurgeForcee(`/Ticket/${idTicket}`);
}

export async function supprimerElementAReinitialiser(element) {
  if (!typesElementsAReinitialiser.includes(element.itemtype)) {
    throw new Error(`Type GLPI non autorisé pour la suppression : ${element.itemtype}`);
  }

  if (!elementEstConcerne(element)) {
    throw new Error('Élément ignoré : aucun lien sûr avec NewAPP ou CSV.');
  }

  return supprimerAvecPurgeForcee(`/${element.itemtype}/${element.id}`);
}

export async function analyserDonneesConcernees() {
  const avertissements = [];
  verifierConfigurationCorrespondances(avertissements);

  const [ticketsTrouves, elementsTrouves] = await Promise.all([
    recupererTicketsAReinitialiser(),
    recupererElementsAReinitialiser(),
  ]);
  const totalDonnees = ticketsTrouves.length + elementsTrouves.length;
  const message = totalDonnees
    ? `${totalDonnees} donnée(s) concernée(s) trouvée(s).`
    : 'Aucune donnée concernée par NewAPP ou les références CSV trouvée.';

  return {
    ticketsTrouves,
    elementsTrouves,
    avertissements,
    message,
  };
}

async function recupererTicketsPourReinitialisation(resume) {
  try {
    return await recupererTicketsAReinitialiser();
  } catch (erreur) {
    resume.erreurs.push(`Recherche des Ticket concernés : ${recupererMessageErreur(erreur)}`);
    return [];
  }
}

async function recupererElementsPourReinitialisation(resume) {
  const resultats = await Promise.allSettled(
    typesElementsAReinitialiser.map((itemtype) => recupererElementsParType(itemtype)),
  );

  return resultats.flatMap((resultat, index) => {
    if (resultat.status === 'fulfilled') {
      return resultat.value;
    }

    resume.erreurs.push(
      `Recherche des ${typesElementsAReinitialiser[index]} concernés : ${recupererMessageErreur(
        resultat.reason,
      )}`,
    );
    return [];
  });
}

async function supprimerRelationsDuTicket(ticket, resume) {
  let relations = [];

  try {
    relations = await recupererRelationsTicketElement(ticket.id);
  } catch (erreur) {
    resume.erreurs.push(creerErreurSuppression('Recherche Item_Ticket du Ticket', ticket.id, erreur));
    return;
  }

  for (const relation of relations) {
    try {
      await supprimerRelationTicketElement(relation.id);
      resume.relationsSupprimees += 1;
    } catch (erreur) {
      resume.erreurs.push(creerErreurSuppression('Item_Ticket', relation.id, erreur));
    }
  }
}

async function supprimerCoutsDuTicket(ticket, resume) {
  let couts = [];

  try {
    couts = await recupererCoutsTicket(ticket.id);
  } catch (erreur) {
    resume.erreurs.push(creerErreurSuppression('Recherche TicketCost du Ticket', ticket.id, erreur));
    return;
  }

  for (const cout of couts) {
    try {
      await supprimerCoutTicket(cout.id);
      resume.coutsSupprimes += 1;
    } catch (erreur) {
      resume.erreurs.push(creerErreurSuppression('TicketCost', cout.id, erreur));
    }
  }
}

async function supprimerRelationsDesTickets(ticketsTrouves, resume) {
  for (const ticket of ticketsTrouves) {
    if (!ticketEstConcerne(ticket)) {
      resume.avertissements.push(`Ticket #${ticket.id} ignoré : lien NewAPP ou CSV insuffisant.`);
      continue;
    }

    await supprimerRelationsDuTicket(ticket, resume);
  }
}

async function supprimerCoutsDesTickets(ticketsTrouves, resume) {
  for (const ticket of ticketsTrouves) {
    if (ticketEstConcerne(ticket)) {
      await supprimerCoutsDuTicket(ticket, resume);
    }
  }
}

async function supprimerTickets(ticketsTrouves, resume) {
  for (const ticket of ticketsTrouves) {
    if (!ticketEstConcerne(ticket)) {
      continue;
    }

    try {
      await supprimerTicketAReinitialiser(ticket.id);
      resume.ticketsSupprimes += 1;
    } catch (erreur) {
      resume.erreurs.push(creerErreurSuppression('Ticket', ticket.id, erreur));
    }
  }
}

async function supprimerElements(elementsTrouves, resume) {
  for (const element of elementsTrouves) {
    try {
      await supprimerElementAReinitialiser(element);
      resume.elementsSupprimes += 1;
    } catch (erreur) {
      resume.erreurs.push(creerErreurSuppression(element.itemtype, element.id, erreur));
    }
  }
}

export async function reinitialiserDonneesConcernees() {
  const resume = {
    ticketsTrouves: 0,
    ticketsSupprimes: 0,
    relationsSupprimees: 0,
    coutsSupprimes: 0,
    elementsTrouves: 0,
    elementsSupprimes: 0,
    avertissements: [],
    erreurs: [],
  };

  verifierConfigurationCorrespondances(resume.avertissements);

  const ticketsTrouves = await recupererTicketsPourReinitialisation(resume);
  resume.ticketsTrouves = ticketsTrouves.length;

  // Ordre obligatoire : tickets, relations, coûts, tickets supprimés, puis recherche des assets.
  await supprimerRelationsDesTickets(ticketsTrouves, resume);
  await supprimerCoutsDesTickets(ticketsTrouves, resume);
  await supprimerTickets(ticketsTrouves, resume);

  const elementsTrouves = await recupererElementsPourReinitialisation(resume);
  resume.elementsTrouves = elementsTrouves.length;
  await supprimerElements(elementsTrouves, resume);

  return resume;
}

export const recupererTicketsImportes = recupererTicketsAReinitialiser;
export const recupererElementsImportes = recupererElementsAReinitialiser;
export const analyserDonneesImportees = analyserDonneesConcernees;
export const reinitialiserDonneesImportees = reinitialiserDonneesConcernees;
export const supprimerTicketImporte = supprimerTicketAReinitialiser;
export const supprimerElementImporte = supprimerElementAReinitialiser;
