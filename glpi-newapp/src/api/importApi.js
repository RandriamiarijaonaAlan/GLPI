import clientGlpiLegacy from './glpiLegacyClient';
import clientGlpiV2 from './glpiV2Client';
import { creerTicket, creerCoutTicket } from './ticketsApi';
import { creerElement } from './assetsApi';

const MARQUAGE_IMPORT = 'NEWAPP_IMPORT_JUIN_2026';

// Correspondance des tickets créés pendant l'import courant : Ref_Ticket -> id GLPI
const correspondancesTicketsImportes = new Map();

// Cache des utilisateurs trouvés ou créés en cours d'import : nom_normalise -> { id, cree }
const cacheUtilisateursImport = new Map();

// Cache des éléments par type pour la recherche en cours d'import tickets ; réinitialisé à chaque appel
let cacheElementsTicketImport = null;
let indexElementsTicketImport = null;

// Compteur des référentiels créés pendant l'import assets courant
let nombreReferentielsCreesImport = 0;

export const typesElementsSupportes = {
  Computer: {
    endpointV1: '/Computer',
    endpointV2: '/Assets/Computer',
    libelle: 'Ordinateur',
    champModele: 'computermodels_id',
    modeleEndpointV1: '/ComputerModel',
  },
  Monitor: {
    endpointV1: '/Monitor',
    endpointV2: '/Assets/Monitor',
    libelle: 'Moniteur',
    champModele: 'monitormodels_id',
    modeleEndpointV1: '/MonitorModel',
  },
  Printer: {
    endpointV1: '/Printer',
    endpointV2: '/Assets/Printer',
    libelle: 'Imprimante',
    champModele: 'printermodels_id',
    modeleEndpointV1: '/PrinterModel',
  },
  Phone: {
    endpointV1: '/Phone',
    endpointV2: '/Assets/Phone',
    libelle: 'Téléphone',
    champModele: 'phonemodels_id',
    modeleEndpointV1: '/PhoneModel',
  },
  NetworkEquipment: {
    endpointV1: '/NetworkEquipment',
    endpointV2: '/Assets/NetworkEquipment',
    libelle: 'Équipement réseau',
    champModele: 'networkequipmentmodels_id',
    modeleEndpointV1: '/NetworkEquipmentModel',
  },
  Peripheral: {
    endpointV1: '/Peripheral',
    endpointV2: '/Assets/Peripheral',
    libelle: 'Périphérique',
    champModele: 'peripheralmodels_id',
    modeleEndpointV1: '/PeripheralModel',
  },
  Software: { endpointV1: '/Software', endpointV2: '/Assets/Software', libelle: 'Logiciel' },
  SoftwareLicense: {
    endpointV1: '/SoftwareLicense',
    endpointV2: '/Assets/SoftwareLicense',
    libelle: 'Licence logiciel',
  },
  Certificate: { endpointV1: '/Certificate', endpointV2: '/Assets/Certificate', libelle: 'Certificat' },
  Appliance: { endpointV1: '/Appliance', endpointV2: '/Assets/Appliance', libelle: 'Applicatif' },
  Rack: { endpointV1: '/Rack', endpointV2: '/Assets/Rack', libelle: 'Baie' },
  Enclosure: { endpointV1: '/Enclosure', endpointV2: '/Assets/Enclosure', libelle: 'Boîtier' },
  PDU: { endpointV1: '/PDU', endpointV2: '/Assets/PDU', libelle: 'Unité de distribution' },
  Cable: { endpointV1: '/Cable', endpointV2: '/Assets/Cable', libelle: 'Câble' },
  // Socket est namespacé dans GLPI 10+ : l'API v1 attend Glpi\Socket (encodé %5C),
  // mais l'API v2 utilise le nom court /Assets/Socket.
  Socket: { endpointV1: '/Glpi%5CSocket', endpointV2: '/Assets/Socket', libelle: 'Prise', itemtypeApi: 'Glpi\\Socket' },
  Cartridge: { endpointV1: '/Cartridge', endpointV2: '/Assets/Cartridge', libelle: 'Cartouche' },
  Consumable: { endpointV1: '/Consumable', endpointV2: '/Assets/Consumable', libelle: 'Consommable' },
  Unmanaged: { endpointV1: '/Unmanaged', endpointV2: '/Assets/Unmanaged', libelle: 'Non géré' },
  PassiveDCEquipment: {
    endpointV1: '/PassiveDCEquipment',
    endpointV2: '/Assets/PassiveDCEquipment',
    libelle: 'Équipement passif DC',
  },
};

const CHAMPS_MODELES_PAR_TYPE = Object.fromEntries(
  Object.entries(typesElementsSupportes)
    .filter(([, configuration]) => configuration.champModele && configuration.modeleEndpointV1)
    .map(([itemtype, configuration]) => [
      itemtype,
      { chemin: configuration.modeleEndpointV1, champ: configuration.champModele },
    ]),
);

const TYPES_ELEMENTS_VALIDES = Object.keys(typesElementsSupportes);

// Retourne l'itemtype réel attendu par l'API GLPI (ex: Glpi\Socket pour les types namespacés)
// Pour la plupart des types, l'itemtype API est identique à la clé de configuration.
function itemtypeApiPourType(type) {
  return typesElementsSupportes[type]?.itemtypeApi || type;
}

const aliasItemType = {
  ordinateur: 'Computer',
  computer: 'Computer',
  computers: 'Computer',
  pc: 'Computer',
  moniteur: 'Monitor',
  monitor: 'Monitor',
  monitors: 'Monitor',
  ecran: 'Monitor',
  écran: 'Monitor',
  imprimante: 'Printer',
  printer: 'Printer',
  printers: 'Printer',
  telephone: 'Phone',
  téléphone: 'Phone',
  phone: 'Phone',
  phones: 'Phone',
  networkequipment: 'NetworkEquipment',
  network_equipment: 'NetworkEquipment',
  equipementreseau: 'NetworkEquipment',
  équipementréseau: 'NetworkEquipment',
  reseau: 'NetworkEquipment',
  réseau: 'NetworkEquipment',
  peripherique: 'Peripheral',
  périphérique: 'Peripheral',
  peripheral: 'Peripheral',
  software: 'Software',
  logiciel: 'Software',
  softwarelicense: 'SoftwareLicense',
  licence: 'SoftwareLicense',
  licencelogiciel: 'SoftwareLicense',
  certificate: 'Certificate',
  certificat: 'Certificate',
  appliance: 'Appliance',
  applicatif: 'Appliance',
  rack: 'Rack',
  baie: 'Rack',
  enclosure: 'Enclosure',
  boitier: 'Enclosure',
  boîtier: 'Enclosure',
  pdu: 'PDU',
  cable: 'Cable',
  câble: 'Cable',
  socket: 'Socket',
  prise: 'Socket',
  cartridge: 'Cartridge',
  cartouche: 'Cartridge',
  consumable: 'Consumable',
  consommable: 'Consumable',
  unmanaged: 'Unmanaged',
  nongere: 'Unmanaged',
  nongéré: 'Unmanaged',
  passivedcequipment: 'PassiveDCEquipment',
  equipementpassifdc: 'PassiveDCEquipment',
  équipementpassifdc: 'PassiveDCEquipment',
};

// Retourne true si la valeur est non nulle et non vide
function estValide(valeur) {
  return valeur !== null && valeur !== undefined && String(valeur).trim() !== '';
}

// Normalise la réponse GLPI en tableau, quelle que soit la structure retournée
function normaliserEnTableau(donnees) {
  if (Array.isArray(donnees)) return donnees;
  if (Array.isArray(donnees?.data)) return donnees.data;
  if (Array.isArray(donnees?.items)) return donnees.items;
  if (Array.isArray(donnees?.member)) return donnees.member;
  return [];
}

function normaliserNomRecherche(valeur) {
  return String(valeur ?? '').trim().toLowerCase();
}

export function normaliserTexteCsv(valeur) {
  return String(valeur ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function normaliserCleTexte(valeur) {
  return normaliserTexteCsv(valeur)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '')
    .toLowerCase();
}

export function normaliserItemType(valeur) {
  const texte = normaliserTexteCsv(valeur);

  if (!texte) {
    return '';
  }

  const typeExact = TYPES_ELEMENTS_VALIDES.find((itemtype) => itemtype.toLowerCase() === texte.toLowerCase());
  if (typeExact) {
    return typeExact;
  }

  return aliasItemType[normaliserCleTexte(texte)] || '';
}

function normaliserComparaisonElement(valeur) {
  return normaliserTexteCsv(valeur).replace(/\s+/g, '').toLowerCase();
}

function valeurColonneCsv(ligne, nomColonne) {
  const cleLower = String(nomColonne || '').toLowerCase();

  if (Object.prototype.hasOwnProperty.call(ligne, cleLower)) {
    return ligne[cleLower];
  }

  if (Object.prototype.hasOwnProperty.call(ligne, nomColonne)) {
    return ligne[nomColonne];
  }

  return '';
}

function formaterErreurApiComplete(erreur) {
  const statut = erreur.response?.status;
  const donnees = erreur.response?.data;
  const message = donnees ? JSON.stringify(donnees) : erreur.message || 'Erreur inconnue';
  return statut ? `HTTP ${statut} - ${message}` : message;
}

// Retourne true si l'erreur indique que le type n'est pas exposé par l'API REST GLPI
function estErreurTypeNonSupporte(erreur) {
  return String(erreur?.message || '').includes('ERROR_RESOURCE_NOT_FOUND_NOR_COMMONDBTM');
}

function extraireNomReference(reference) {
  if (!reference) return '';

  return normaliserNomRecherche(
    reference.name ||
      reference.completename ||
      reference.realname ||
      [reference.firstname, reference.lastname].filter(Boolean).join(' ') ||
      reference.firstname ||
      reference.lastname ||
      reference.value,
  );
}

const cacheReferentielsGlpi = new Map();

function creerCleReferentiel(chemin) {
  return String(chemin || '').trim();
}

async function chargerReferentielGlpi(chemin) {
  const cle = creerCleReferentiel(chemin);

  if (!cacheReferentielsGlpi.has(cle)) {
    const promesse = clientGlpiLegacy
      .get(`${chemin}?range=0-9999&expand_dropdowns=true`)
      .then((reponse) => normaliserEnTableau(reponse.data))
      .catch(() => []);

    cacheReferentielsGlpi.set(cle, promesse);
  }

  return cacheReferentielsGlpi.get(cle);
}

function trouverReferenceParNom(references, nomRecherche) {
  const recherche = normaliserNomRecherche(nomRecherche);
  if (!recherche) return null;

  return (
    references.find((reference) => extraireNomReference(reference) === recherche) ||
    references.find((reference) => normaliserNomRecherche(reference?.name) === recherche) ||
    null
  );
}

async function recupererOuCreerReferenceGenerique(chemin, nomReference, champsComplementaires = {}, ajouterLog = null, libelle = 'Référence') {
  const nomNormalise = normaliserTexteCsv(nomReference);

  if (!nomNormalise) {
    return null;
  }

  if (ajouterLog) ajouterLog(`Recherche ${libelle.toLowerCase()} : ${nomNormalise}`);
  const referencesExistantes = await chargerReferentielGlpi(chemin);
  const referenceExistante = trouverReferenceParNom(referencesExistantes, nomNormalise);

  if (referenceExistante?.id) {
    if (ajouterLog) ajouterLog(`${libelle} existant réutilisé : ${nomNormalise} #${referenceExistante.id}`);
    return referenceExistante.id;
  }

  try {
    const reponseCreation = await clientGlpiLegacy.post(chemin, {
      input: {
        name: nomNormalise,
        entities_id: 0,
        is_recursive: 1,
        ...champsComplementaires,
      },
    });

    const idCree = extraireIdCree(reponseCreation.data);

    if (idCree) {
      referencesExistantes.push({ id: idCree, name: nomNormalise, ...champsComplementaires });
      if (ajouterLog) ajouterLog(`${libelle} créé : ${nomNormalise} #${idCree}`);
      nombreReferentielsCreesImport += 1;
      return idCree;
    }
  } catch (erreur) {
    if (ajouterLog) ajouterLog(`${libelle} non créé : ${nomNormalise} (${formaterErreurApiComplete(erreur)})`);
    return null;
  }

  return null;
}

export async function recupererOuCreerEtatGlpi(nomEtat, ajouterLog = null) {
  return recupererOuCreerReferenceGenerique('/State', nomEtat, {}, ajouterLog, 'État');
}

export async function recupererOuCreerLocalisationGlpi(nomLocalisation, ajouterLog = null) {
  return recupererOuCreerReferenceGenerique('/Location', nomLocalisation, {}, ajouterLog, 'Localisation');
}

export async function recupererOuCreerFabricantGlpi(nomFabricant, ajouterLog = null) {
  return recupererOuCreerReferenceGenerique('/Manufacturer', nomFabricant, {}, ajouterLog, 'Fabricant');
}

export async function recupererOuCreerModeleGlpi(itemtype, nomModele, idFabricant = null, ajouterLog = null) {
  const configurationModele = CHAMPS_MODELES_PAR_TYPE[itemtype];

  if (!configurationModele || !normaliserTexteCsv(nomModele)) {
    if (!configurationModele && normaliserTexteCsv(nomModele) && ajouterLog) {
      ajouterLog(`Model non applicable pour ${itemtype}, valeur conservée dans comment`);
    }
    return null;
  }

  return recupererOuCreerReferenceGenerique(configurationModele.chemin, nomModele, {
    ...(idFabricant ? { manufacturers_id: idFabricant } : {}),
  }, ajouterLog, 'Modèle');
}

export async function rechercherUtilisateurGlpi(nomUtilisateur) {
  const nomNormalise = String(nomUtilisateur ?? '').trim();

  if (!nomNormalise) {
    return null;
  }

  const utilisateurs = await chargerReferentielGlpi('/User');
  const recherche = normaliserNomRecherche(nomNormalise);

  const utilisateur =
    utilisateurs.find((item) => normaliserNomRecherche(item?.name) === recherche) ||
    utilisateurs.find((item) => normaliserNomRecherche(item?.realname) === recherche) ||
    utilisateurs.find((item) => normaliserNomRecherche([item?.firstname, item?.lastname].filter(Boolean).join(' ')) === recherche) ||
    null;

  return utilisateur?.id || null;
}

// Cherche un utilisateur GLPI via searchText sur un champ donné (name ou realname)
// Retourne le premier résultat dont la valeur correspond exactement, ou null
async function rechercherUtilisateurParChamp(champ, valeur) {
  if (!valeur) return null;
  const recherche = normaliserNomRecherche(valeur);
  try {
    const reponse = await clientGlpiLegacy.get(
      `/User?searchText[${champ}]=${encodeURIComponent(valeur)}&range=0-49`
    );
    const utilisateurs = normaliserEnTableau(reponse.data);
    return utilisateurs.find((u) => normaliserNomRecherche(u[champ]) === recherche) || null;
  } catch {
    return null;
  }
}

// Recherche un utilisateur GLPI puis le crée s'il n'existe pas
// Retourne { id, cree } ou null sans bloquer l'import en cas d'échec
export async function recupererOuCreerUtilisateurGlpi(nomUtilisateur, ajouterLog) {
  const nomBrut = normaliserTexteCsv(nomUtilisateur);
  if (!nomBrut) return null;

  const cleCache = normaliserNomRecherche(nomBrut);

  // Réutiliser depuis le cache local sans appel réseau
  if (cacheUtilisateursImport.has(cleCache)) {
    const entreeCache = cacheUtilisateursImport.get(cleCache);
    if (entreeCache) {
      ajouterLog(`Utilisateur existant réutilisé : ${nomBrut} #${entreeCache.id}`);
    }
    return entreeCache;
  }

  ajouterLog(`Recherche utilisateur : ${nomBrut}`);

  // Normaliser le login GLPI (name = identifiant de connexion)
  const nomLogin =
    nomBrut
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9._-]/g, '') || nomBrut.toLowerCase().replace(/\s+/g, '.');

  // 1. Chercher par name (login GLPI)
  let utilisateurTrouve = await rechercherUtilisateurParChamp('name', nomLogin);

  // 2. Chercher par realname si non trouvé par name
  if (!utilisateurTrouve) {
    utilisateurTrouve = await rechercherUtilisateurParChamp('realname', nomBrut);
  }

  if (utilisateurTrouve?.id) {
    const resultatTrouve = { id: utilisateurTrouve.id, cree: false };
    ajouterLog(`Utilisateur existant réutilisé : ${nomBrut} #${utilisateurTrouve.id}`);
    cacheUtilisateursImport.set(cleCache, resultatTrouve);
    return resultatTrouve;
  }

  // Créer l'utilisateur s'il n'existe pas dans GLPI
  try {
    const reponseCreation = await clientGlpiLegacy.post('/User', {
      input: {
        name: nomLogin,
        realname: nomBrut,
        entities_id: 0,
        is_active: 1,
        comment: MARQUAGE_IMPORT,
      },
    });

    const idCree = extraireIdCree(reponseCreation.data);
    if (idCree) {
      const resultatCree = { id: idCree, cree: true };
      ajouterLog(`Utilisateur créé : ${nomBrut} #${idCree}`);
      cacheUtilisateursImport.set(cleCache, resultatCree);
      return resultatCree;
    }
  } catch (erreur) {
    ajouterLog(`Création utilisateur échouée : ${formaterErreurApiComplete(erreur)}`);
    // Création échouée : import continue sans utilisateur
  }

  ajouterLog('Création utilisateur échouée, asset créé sans utilisateur');
  return null;
}

function construireCommentaireImportElement(ligne) {
  const lignesCommentaire = [
    MARQUAGE_IMPORT,
    `Name: ${normaliserTexteCsv(ligne?.Name) || '-'}`,
    `Status: ${normaliserTexteCsv(ligne?.Status) || '-'}`,
    `Location: ${normaliserTexteCsv(ligne?.Location) || '-'}`,
    `Manufacturer: ${normaliserTexteCsv(ligne?.Manufacturer) || '-'}`,
    `Item_Type: ${normaliserTexteCsv(ligne?.Item_Type) || '-'}`,
    `Model: ${normaliserTexteCsv(ligne?.Model) || '-'}`,
    `Inventory_Number: ${normaliserTexteCsv(ligne?.Inventory_Number) || '-'}`,
    `User: ${normaliserTexteCsv(ligne?.User) || '-'}`,
  ];

  return lignesCommentaire.join('\n');
}

function determinerChampModelePourType(itemtype) {
  return CHAMPS_MODELES_PAR_TYPE[itemtype]?.champ || null;
}

// Charge tous les éléments d'un type donné depuis GLPI (API v1)
async function chargerElementsParType(itemtype) {
  const configuration = typesElementsSupportes[itemtype];
  if (!configuration) return [];

  try {
    const reponseV2 = await clientGlpiV2.get(`${configuration.endpointV2}?limit=9999`);
    const resultats = normaliserEnTableau(reponseV2.data);
    if (resultats.length > 0) return resultats;
    // v2 a répondu mais sans données : on essaie v1 pour ne pas manquer des éléments existants
  } catch {
    // API v2 indisponible : fallback API v1.
  }

  try {
    const reponse = await clientGlpiLegacy.get(`${configuration.endpointV1}?range=0-9999&expand_dropdowns=true`);
    return normaliserEnTableau(reponse.data);
  } catch {
    return [];
  }
}

async function chargerElementsParTypePourAssociation(itemtype) {
  const configuration = typesElementsSupportes[itemtype];
  if (!configuration) return [];

  try {
    const reponse = await clientGlpiLegacy.get(`${configuration.endpointV1}?range=0-999&expand_dropdowns=true`);
    return normaliserEnTableau(reponse.data);
  } catch {
    return [];
  }
}

// Charge tous les tickets depuis GLPI (API v1)
async function chargerTousLesTickets() {
  try {
    const reponse = await clientGlpiLegacy.get('/Ticket?range=0-9999&expand_dropdowns=true');
    return normaliserEnTableau(reponse.data);
  } catch {
    return [];
  }
}

async function chargerTousLesCoutsTicket() {
  try {
    const reponse = await clientGlpiLegacy.get('/TicketCost?range=0-9999&expand_dropdowns=true');
    return normaliserEnTableau(reponse.data);
  } catch {
    return [];
  }
}

function normaliserNombreCleCout(valeur) {
  return String(convertirNombreCsv(valeur, 0));
}

function construireCleCoutTicket(idTicket, numTicket, actiontime = 0, costTime = 0, costFixed = 0) {
  return [
    String(idTicket || '').trim(),
    String(numTicket || '').trim(),
    normaliserNombreCleCout(actiontime),
    normaliserNombreCleCout(costTime),
    normaliserNombreCleCout(costFixed),
  ].join('#');
}

function construireIndexCoutsTickets(couts) {
  const index = new Set();

  for (const cout of couts) {
    const nom = String(cout.name || '').trim();
    const correspondance = nom.match(/Ref\s+([^\s]+)/i);
    const numTicket = correspondance ? correspondance[1].trim() : '';
    const idTicket = normaliserTexteCsv(cout.tickets_id?.id || cout.tickets_id);

    if (idTicket && numTicket) {
      index.add(construireCleCoutTicket(idTicket, numTicket, cout.actiontime, cout.cost_time, cout.cost_fixed));
    }
  }

  return index;
}

// Extrait la valeur textuelle d'un champ GLPI qui peut être une chaîne ou un objet expand_dropdowns
function extraireTexteChamp(valeur) {
  if (valeur === null || valeur === undefined) return '';
  if (typeof valeur === 'object') return String(valeur?.name || valeur?.value || valeur?.id || '');
  return String(valeur);
}

// Recherche un doublon d'élément par nom, numéro d'inventaire ou commentaire d'import
function trouverDoublonElement(elementsExistants, nom, numeroInventaire) {
  const nomNormalise = normaliserComparaisonElement(nom);
  const inventaireNormalise = normaliserComparaisonElement(numeroInventaire);

  return elementsExistants.find((el) => {
    if (nomNormalise && normaliserComparaisonElement(extraireTexteChamp(el.name)) === nomNormalise) return true;
    if (inventaireNormalise && normaliserComparaisonElement(extraireTexteChamp(el.otherserial)) === inventaireNormalise) return true;
    if (inventaireNormalise && normaliserComparaisonElement(extraireTexteChamp(el.serial)) === inventaireNormalise) return true;
    if (inventaireNormalise && normaliserComparaisonElement(extraireTexteChamp(el.inventory_number)) === inventaireNormalise) return true;
    // Contrôle de secours : l'import stocke le numéro d'inventaire dans le commentaire
    if (inventaireNormalise) {
      const commentaire = String(el.comment || el.comments || '');
      if (commentaire.includes(`Inventory_Number: ${numeroInventaire}`)) return true;
    }
    return false;
  });
}

// Recherche un doublon de ticket par référence dans le contenu ou par titre exact
function extraireReferenceTicketDepuisContenu(contenu) {
  const correspondance = String(contenu || '').match(/Ref_Ticket:\s*([^\n\r]+)/i);
  return correspondance ? correspondance[1].trim() : '';
}

function construireIndexDoublonsTickets(tickets) {
  const parReference = new Map();
  const parTitre = new Map();

  for (const ticket of tickets) {
    const reference = extraireReferenceTicketDepuisContenu(ticket.content);
    const titre = normaliserTexteCsv(ticket.name);

    if (reference && !parReference.has(reference)) {
      parReference.set(reference, ticket);
    }

    if (titre && !parTitre.has(titre)) {
      parTitre.set(titre, ticket);
    }
  }

  return { parReference, parTitre };
}

function trouverDoublonTicket(indexDoublonsTickets, refTicket, titre) {
  const referenceNormalisee = normaliserTexteCsv(refTicket);
  const titreNormalise = normaliserTexteCsv(titre);

  return (
    (referenceNormalisee ? indexDoublonsTickets.parReference.get(referenceNormalisee) : null) ||
    (titreNormalise ? indexDoublonsTickets.parTitre.get(titreNormalise) : null) ||
    null
  );
}

function ajouterTicketDansIndexDoublons(indexDoublonsTickets, ticket) {
  const reference = extraireReferenceTicketDepuisContenu(ticket.content);
  const titre = normaliserTexteCsv(ticket.name);

  if (reference) {
    indexDoublonsTickets.parReference.set(reference, ticket);
  }

  if (titre) {
    indexDoublonsTickets.parTitre.set(titre, ticket);
  }
}


// Recherche un ticket par référence dans le contenu ou le commentaire GLPI
function trouverTicketParReferenceDansGlpi(tickets, refTicket) {
  if (!estValide(refTicket)) return null;

  return (
    tickets.find((ticket) => (ticket.content || '').includes(`Ref_Ticket: ${refTicket}`)) ||
    tickets.find((ticket) => String(ticket.comment || ticket.comments || '').includes(`Ref_Ticket: ${refTicket}`)) ||
    null
  );
}

function formaterDeuxChiffres(valeur) {
  return String(valeur).padStart(2, '0');
}

function construireDateTicketDepuisCsv(ligne) {
  const dateBrute = String(valeurColonneCsv(ligne, 'date') || '').trim();
  const heureBrute = String(valeurColonneCsv(ligne, 'heure') || '').trim();

  if (!dateBrute) {
    return { dateGLPI: null, avertissement: 'Date invalide pour ticket, date GLPI par défaut utilisée' };
  }

  let jour = null;
  let mois = null;
  let annee = null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateBrute)) {
    [annee, mois, jour] = dateBrute.split('-');
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateBrute)) {
    [jour, mois, annee] = dateBrute.split('/');
  } else {
    const dateNormalisee = new Date(dateBrute);
    if (Number.isNaN(dateNormalisee.getTime())) {
      return { dateGLPI: null, avertissement: 'Date invalide pour ticket, date GLPI par défaut utilisée' };
    }

    annee = String(dateNormalisee.getFullYear());
    mois = formaterDeuxChiffres(dateNormalisee.getMonth() + 1);
    jour = formaterDeuxChiffres(dateNormalisee.getDate());
  }

  const heureNormalisee = heureBrute || '00:00:00';
  const morceauxHeure = heureNormalisee.split(':').map((partie) => partie.trim()).filter(Boolean);
  const heures = formaterDeuxChiffres(morceauxHeure[0] || '00');
  const minutes = formaterDeuxChiffres(morceauxHeure[1] || '00');
  const secondes = formaterDeuxChiffres(morceauxHeure[2] || '00');

  const dateGLPI = `${annee}-${formaterDeuxChiffres(mois)}-${formaterDeuxChiffres(jour)} ${heures}:${minutes}:${secondes}`;
  return { dateGLPI, avertissement: null };
}

// Met à jour la date d'un ticket existant via PUT (après création)
// Essaie date + date_creation, puis date seul en cas d'échec partiel
async function mettreAJourDateTicket(idTicket, dateGLPI, ajouterLog) {
  ajouterLog(`Mise à jour date ticket #${idTicket} : ${dateGLPI}`);

  try {
    await clientGlpiLegacy.put(`/Ticket/${idTicket}`, {
      input: { date: dateGLPI, date_creation: dateGLPI },
    });
    ajouterLog(`Date CSV appliquée pour ticket #${idTicket}`);
    return;
  } catch {
    // date_creation refusé : essayer champ date seul
  }

  try {
    await clientGlpiLegacy.put(`/Ticket/${idTicket}`, {
      input: { date: dateGLPI },
    });
    ajouterLog(`Date CSV appliquée (champ date) pour ticket #${idTicket}`);
  } catch (erreurMaj) {
    ajouterLog(`Date CSV non appliquée pour ticket #${idTicket} : ${erreurMaj.message}`);
  }
}

// Nettoie une valeur CSV de la colonne Items et retourne la liste des noms d'éléments
// Gère : guillemets doubles répétés (""), tableaux JSON ["A","B"], séparateurs , et ;
export function nettoyerNomElementDepuisCsv(valeur) {
  if (!valeur || typeof valeur !== 'string' || !valeur.trim()) return [];

  // Remplacer les guillemets doubles consécutifs (artéfact d'export CSV Excel/LibreOffice)
  let texte = valeur.replace(/""/g, '"').trim();

  // Retirer les guillemets extérieurs si le texte est entièrement entouré de guillemets
  if (texte.startsWith('"') && texte.endsWith('"')) {
    texte = texte.slice(1, -1).trim();
  }

  // Essayer de parser comme tableau JSON valide : ["PC-ADM-001","PC-RH-002"]
  if (texte.startsWith('[')) {
    try {
      const tableau = JSON.parse(texte);
      if (Array.isArray(tableau)) {
        return tableau.map((n) => String(n).trim()).filter(Boolean);
      }
    } catch {
      // JSON invalide : retirer les crochets et traiter manuellement
    }
    texte = texte.replace(/^\[/, '').replace(/\]$/, '').trim();
  }

  // Détecter le séparateur dominant (point-virgule prioritaire)
  const separateur = texte.includes(';') ? ';' : ',';

  // Découper, retirer guillemets et crochets résiduels autour de chaque nom
  return texte
    .split(separateur)
    .map((nom) => nom.trim().replace(/^["'[]+|["'\]]+$/g, '').trim())
    .filter(Boolean);
}

// Convertit la colonne Type du CSV en valeur GLPI (1=Incident, 2=Demande)
function convertirTypeTicket(valeur) {
  const texte = normaliserCleTexte(valeur);
  if (texte === 'request' || texte === 'demande') return 2;
  return 1; // Incident par défaut
}

// Convertit la colonne Priority du CSV en valeur GLPI (1=Très basse … 6=Majeure)
function convertirPrioriteTicket(valeur) {
  const texte = normaliserCleTexte(valeur);
  const correspondances = {
    verylow: 1, tresbasse: 1, trèsbasse: 1,
    low: 2, basse: 2,
    medium: 3, moyenne: 3,
    high: 4, haute: 4,
    veryhigh: 5, treshaute: 5, trèshaute: 5,
    major: 6, majeure: 6,
  };
  return correspondances[texte] || 3; // Moyenne par défaut
}

// Convertit la colonne Status du CSV en valeur GLPI (1=Nouveau … 6=Clos)
function normaliserStatutTicketCsv(valeur) {
  return normaliserCleTexte(valeur).replace(/[^a-z0-9]/g, '');
}

function convertirStatutTicket(valeur) {
  const texte = normaliserStatutTicketCsv(valeur);
  const correspondances = {
    new: 1, nouveau: 1,
    assigned: 2, encoursattribue: 2, encoursattribué: 2,
    planned: 3, encoursplanifie: 3, encoursplanifié: 3,
    waiting: 4, pending: 4, enattente: 4,
    solved: 5, resolved: 5, resolu: 5, résolu: 5,
    closed: 6, clos: 6,
    open: 1,
    inprogress: 2,
    inprogressassigned: 2,
    encours: 2,
    encoursassigne: 2,
    planned: 2,
    encoursplanifie: 2,
    waiting: 2,
    pending: 2,
    enattente: 2,
    solved: 6,
    resolved: 6,
    resolu: 6,
    close: 6,
    ferme: 6,
    fermee: 6,
  };
  return correspondances[texte] || 1; // Nouveau par défaut
}

// Convertit une valeur CSV en nombre
// Remplace la virgule décimale par un point, retourne valeurParDefaut si vide ou NaN
export function convertirNombreCsv(valeur, valeurParDefaut = 0) {
  if (valeur === null || valeur === undefined) return valeurParDefaut;
  const texte = String(valeur).trim().replace(/\s+/g, '').replace(',', '.');
  if (!texte) return valeurParDefaut;
  const nombre = Number(texte);
  return Number.isNaN(nombre) ? valeurParDefaut : nombre;
}


function extraireNomsElementsDepuisItems(valeurItems) {
  if (Array.isArray(valeurItems)) {
    return valeurItems
      .map((valeur) => String(valeur || '').trim().replace(/^["'[\s]+|["'\]\s]+$/g, '').trim())
      .filter(Boolean);
  }

  let texte = String(valeurItems ?? '').trim();
  if (!texte) return [];

  // Décoder les guillemets doublés (artéfact CSV Excel/LibreOffice : ""value"")
  texte = texte.replace(/""/g, '"');

  // Retirer un éventuel guillemet extérieur englobant tout le champ CSV
  if (texte.startsWith('"') && texte.endsWith('"')) {
    texte = texte.slice(1, -1).trim();
  }

  if (!texte) return [];

  // Tentative de parse JSON si le texte ressemble à un tableau : ["A","B"]
  if (texte.startsWith('[') && texte.endsWith(']')) {
    try {
      const tableau = JSON.parse(texte);
      if (Array.isArray(tableau)) {
        return tableau.map((valeur) => String(valeur || '').trim()).filter(Boolean);
      }
    } catch {
      // JSON invalide : retirer les crochets et traiter manuellement
      texte = texte.slice(1, -1).trim();
    }
  }

  // Séparateur : point-virgule en priorité, puis virgule
  const separateur = texte.includes(';') ? /;/ : /,/;

  return texte
    .split(separateur)
    .map((valeur) => valeur.trim().replace(/^["'[\s]+|["'\]\s]+$/g, '').trim())
    .filter(Boolean);
}

function recupererDoublonsNomsElements(nomsElements) {
  const dejaVus = new Set();
  const doublons = [];

  for (const nom of nomsElements) {
    const nomPropre = String(nom || '').trim();
    const cleComparaison = normaliserComparaisonElement(nomPropre);

    if (!cleComparaison) {
      continue;
    }

    if (dejaVus.has(cleComparaison)) {
      doublons.push(nomPropre);
      continue;
    }

    dejaVus.add(cleComparaison);
  }

  return doublons;
}

function supprimerDoublonsNomsElements(nomsElements) {
  const dejaVus = new Set();
  const nomsUniques = [];

  for (const nom of nomsElements) {
    const nomPropre = String(nom || '').trim();

    if (!nomPropre) {
      continue;
    }

    const cleComparaison = normaliserComparaisonElement(nomPropre);

    if (dejaVus.has(cleComparaison)) {
      continue;
    }

    dejaVus.add(cleComparaison);
    nomsUniques.push(nomPropre);
  }

  return nomsUniques;
}

function normaliserCleRelation(itemtype, itemsId) {
  return `${String(itemtype || '').trim().toLowerCase()}#${String(itemsId || '').trim()}`;
}


function construireIndexRelationsTicket(relationsExistantes) {
  return new Set(
    relationsExistantes.map((relation) => {
      const itemtypeRelation = relation.itemtype || relation.items_id?.itemtype || relation.items_id?.type;
      const itemsIdRelation = relation.items_id?.id || relation.items_id?.items_id || relation.items_id;
      return normaliserCleRelation(itemtypeRelation, itemsIdRelation);
    }),
  );
}

async function recupererRelationsTicketExistantes(idTicket) {
  try {
    const reponse = await clientGlpiLegacy.get(
      `/Item_Ticket?searchText[tickets_id]=${encodeURIComponent(idTicket)}&expand_dropdowns=true`,
    );

    return normaliserEnTableau(reponse.data);
  } catch {
    return [];
  }
}


// Recherche un élément dans tous les types reconnus par name, serial, otherserial ou inventory_number
// Charge chaque type à la demande et met en cache le résultat pour l'import en cours
function ajouterElementDansIndexAssociation(index, element, type) {
  for (const valeur of [element.name, element.serial, element.otherserial, element.inventory_number]) {
    const cle = normaliserComparaisonElement(valeur);

    if (cle && !index.has(cle)) {
      index.set(cle, { ...element, itemtype: itemtypeApiPourType(type) });
    }
  }
}

function construireIndexElementsAssociation(elementsParType) {
  const index = new Map();

  for (const type of TYPES_ELEMENTS_VALIDES) {
    const elements = elementsParType[type] || [];

    for (const element of elements) {
      ajouterElementDansIndexAssociation(index, element, type);
    }
  }

  return index;
}

async function rechercherElementParNomOuInventaire(nomElement, ajouterLog = () => {}) {
  const recherche = normaliserComparaisonElement(nomElement);
  if (!recherche) return null;

  if (!cacheElementsTicketImport) {
    cacheElementsTicketImport = {};
    for (const type of TYPES_ELEMENTS_VALIDES) {
      cacheElementsTicketImport[type] = await chargerElementsParTypePourAssociation(type);
    }
    indexElementsTicketImport = construireIndexElementsAssociation(cacheElementsTicketImport);
  } else if (!indexElementsTicketImport) {
    indexElementsTicketImport = construireIndexElementsAssociation(cacheElementsTicketImport);
  }

  const trouveIndex = indexElementsTicketImport.get(recherche);

  if (trouveIndex) {
    ajouterLog(`Recherche element ${nomElement} : trouve ${trouveIndex.itemtype} #${trouveIndex.id}`);
    return trouveIndex;
  }

  ajouterLog(`Recherche element ${nomElement} : non trouve`);
  return null;
}

// ─── IMPORT ÉLÉMENTS (ASSET) ───────────────────────────────────────────────

// Importe les éléments du parc depuis les données CSV analysées
// Évite les doublons, continue en cas d'erreur API sur une ligne
export async function importerElementsCsv(donnees, ajouterLog) {
  nombreReferentielsCreesImport = 0;

  const resultat = {
    importes: 0,
    elementsImportes: 0,
    elementsExistants: 0,
    elementsIgnores: 0,
    typesNonSupportes: 0,
    referentielsCrees: 0,
    doublons: 0,
    erreurs: 0,
    avertissements: [],
    utilisateursCrees: 0,
    utilisateursExistants: 0,
    utilisateursNonCrees: 0,
  };

  // Charger les éléments existants par type pour détection de doublons
  const elementsParType = {};
  for (const type of TYPES_ELEMENTS_VALIDES) {
    elementsParType[type] = await chargerElementsParType(type);
  }

  for (const ligne of donnees) {
    ajouterLog('Import élément démarré');
    const nom = normaliserTexteCsv(valeurColonneCsv(ligne, 'name'));
    const itemTypeBrut = normaliserTexteCsv(valeurColonneCsv(ligne, 'item_type'));
    const itemType = normaliserItemType(itemTypeBrut);
    const numeroInventaire = normaliserTexteCsv(valeurColonneCsv(ligne, 'inventory_number'));

    if (!estValide(nom)) {
      ajouterLog('Ligne ignorée : Name vide');
      resultat.elementsIgnores++;
      continue;
    }

    if (!itemType || !typesElementsSupportes[itemType]) {
      const avert = `Ligne ignorée : Item_Type inconnu ${itemTypeBrut || '-'}`;
      ajouterLog(avert);
      resultat.avertissements.push(avert);
      resultat.typesNonSupportes++;
      resultat.elementsIgnores++;
      continue;
    }

    ajouterLog(`Type supporté détecté : ${itemType}`);
    ajouterLog(`Recherche doublon : ${nom}`);
    const existants = elementsParType[itemType] || [];
    const doublon = trouverDoublonElement(existants, nom, numeroInventaire);

    if (doublon) {
      const avert = `Doublon ignoré : ${nom}`;
      ajouterLog(avert);
      resultat.avertissements.push(avert);
      resultat.doublons++;
      resultat.elementsExistants++;
      continue;
    }

    try {
      const commentaireImport = construireCommentaireImportElement(ligne);
      const etatGlpi = await recupererOuCreerEtatGlpi(valeurColonneCsv(ligne, 'status'), ajouterLog);
      const localisationGlpi = await recupererOuCreerLocalisationGlpi(valeurColonneCsv(ligne, 'location'), ajouterLog);
      const fabricantGlpi = await recupererOuCreerFabricantGlpi(valeurColonneCsv(ligne, 'manufacturer'), ajouterLog);
      const modeleGlpi = await recupererOuCreerModeleGlpi(itemType, valeurColonneCsv(ligne, 'model'), fabricantGlpi, ajouterLog);

      let utilisateurGlpi = null;
      const nomUtilisateur = normaliserTexteCsv(valeurColonneCsv(ligne, 'user'));
      if (!estValide(nomUtilisateur)) {
        ajouterLog('User vide : asset créé sans utilisateur');
      } else {
        const resultatUtilisateur = await recupererOuCreerUtilisateurGlpi(nomUtilisateur, ajouterLog);
        if (resultatUtilisateur) {
          utilisateurGlpi = resultatUtilisateur.id;
          if (resultatUtilisateur.cree) {
            resultat.utilisateursCrees++;
          } else {
            resultat.utilisateursExistants++;
          }
        } else {
          resultat.utilisateursNonCrees++;
          resultat.avertissements.push(`Utilisateur "${nomUtilisateur}" non créé pour asset "${nom}"`);
        }
      }

      const corpsElement = {
        name: nom,
        entities_id: 0,
        comment: commentaireImport,
      };

      if (estValide(numeroInventaire)) {
        corpsElement.otherserial = numeroInventaire;
      }

      if (etatGlpi) {
        corpsElement.states_id = etatGlpi;
      }

      if (localisationGlpi) {
        corpsElement.locations_id = localisationGlpi;
      }

      if (fabricantGlpi) {
        corpsElement.manufacturers_id = fabricantGlpi;
      }

      const champModele = determinerChampModelePourType(itemType);
      if (champModele && modeleGlpi) {
        corpsElement[champModele] = modeleGlpi;
      }

      if (utilisateurGlpi) {
        corpsElement.users_id = utilisateurGlpi;
      }

      ajouterLog(`Création asset ${itemType}`);
      const elementCree = await creerElement(itemType, corpsElement);
      const idCree = elementCree.id;

      ajouterLog(`Asset créé : ${nom}`);
      resultat.importes++;
      resultat.elementsImportes++;

      // Mémoriser localement pour détecter les doublons des lignes suivantes
      elementsParType[itemType].push({ id: idCree, name: nom, otherserial: numeroInventaire, itemtype: itemType });
    } catch (erreurApi) {
      if (estErreurTypeNonSupporte(erreurApi)) {
        const avert = `Type non supporté dans cette version de GLPI : ${itemType} — ${nom} ignoré`;
        ajouterLog(avert);
        resultat.avertissements.push(avert);
        resultat.typesNonSupportes++;
      } else {
        const message = `Erreur import ${nom} (${itemType}) : ${erreurApi.message}`;
        ajouterLog(message);
        resultat.avertissements.push(message);
        resultat.erreurs++;
      }
      resultat.elementsIgnores++;
    }
  }

  resultat.referentielsCrees = nombreReferentielsCreesImport;
  return resultat;
}

// ─── IMPORT TICKETS ────────────────────────────────────────────────────────

// Importe les tickets depuis les données CSV analysées
// Ajoute le marquage et la référence dans le contenu, crée les relations Item_Ticket
export async function importerTicketsCsv(donnees, ajouterLog) {
  const resultat = {
    importes: 0,
    doublons: 0,
    erreurs: 0,
    associations: 0,
    elementsDemandes: 0,
    elementsUniques: 0,
    doublonsItemsIgnores: 0,
    associationsCreees: 0,
    associationsDejaExistantes: 0,
    elementsIntrouvables: 0,
    avertissements: [],
  };

  correspondancesTicketsImportes.clear();
  cacheElementsTicketImport = null;
  indexElementsTicketImport = null;

  const ticketsExistants = await chargerTousLesTickets();
  const indexDoublonsTickets = construireIndexDoublonsTickets(ticketsExistants);

  for (const ligne of donnees) {
    const refTicket = String(valeurColonneCsv(ligne, 'ref_ticket') || '').trim();
    const titre = String(valeurColonneCsv(ligne, 'titre') || '').trim();
    const description = String(valeurColonneCsv(ligne, 'description') || '').trim();
    const itemsColonne = String(valeurColonneCsv(ligne, 'items') ?? '').trim();
    const { dateGLPI, avertissement: avertissementDate } = construireDateTicketDepuisCsv(ligne);

    if (!estValide(titre)) {
      ajouterLog('Ligne ignorée : colonne Titre manquante ou vide');
      continue;
    }

    if (avertissementDate) {
      const avert = `Date invalide pour ticket Ref ${refTicket || titre}, date GLPI par défaut utilisée`;
      ajouterLog(avert);
      resultat.avertissements.push(avert);
    }

    if (dateGLPI) {
      ajouterLog(`Date CSV détectée pour ticket Ref ${refTicket || titre} : ${dateGLPI}`);
    }

    const doublon = trouverDoublonTicket(indexDoublonsTickets, refTicket, titre);
    if (doublon) {
      const avert = `Doublon ignoré : ticket "${titre}"${refTicket ? ` (Ref: ${refTicket})` : ''} — id ${doublon.id}`;
      ajouterLog(avert);
      resultat.avertissements.push(avert);
      resultat.doublons++;
      continue;
    }

    try {
      const ticketCree = await creerTicket({
        titre,
        description,
        type: convertirTypeTicket(valeurColonneCsv(ligne, 'type')),
        urgence: convertirPrioriteTicket(valeurColonneCsv(ligne, 'priority')),
        priorite: convertirPrioriteTicket(valeurColonneCsv(ligne, 'priority')),
        status: convertirStatutTicket(valeurColonneCsv(ligne, 'status')),
        refTicket,
      });
      const idTicket = ticketCree.id;

      ajouterLog(`Ticket créé : ${refTicket || titre} → ID GLPI #${idTicket}`);
      resultat.importes++;

      if (estValide(refTicket) && idTicket) {
        correspondancesTicketsImportes.set(refTicket, idTicket);
      }

      // Forcer la date CSV via PUT après création (GLPI peut ignorer date à la création)
      if (dateGLPI && idTicket) {
        await mettreAJourDateTicket(idTicket, dateGLPI, ajouterLog);
      }

      // Mémoriser localement pour la détection de doublons des lignes suivantes
      const contenuIndex = estValide(refTicket) ? `Ref_Ticket: ${refTicket}` : '';
      ajouterTicketDansIndexDoublons(indexDoublonsTickets, { id: idTicket, name: titre, content: contenuIndex });

      // Créer les relations Item_Ticket si la colonne Items est renseignée
      if (estValide(itemsColonne) && idTicket) {
        ajouterLog(`Ticket ${refTicket || titre} : Items brut = ${itemsColonne}`);

        const nomsElements = extraireNomsElementsDepuisItems(itemsColonne);
        resultat.elementsDemandes += nomsElements.length;
        ajouterLog(`Items extraits pour ${refTicket || titre} : ${nomsElements.join(', ') || '-'}`);
        ajouterLog(`Ticket ${titre} : nombre éléments extraits = ${nomsElements.length}`);

        const doublonsNomsElements = recupererDoublonsNomsElements(nomsElements);
        for (const nomElementDoublon of doublonsNomsElements) {
          ajouterLog(`Doublon ignoré : ${nomElementDoublon}`);
        }

        const nomsElementsUniques = supprimerDoublonsNomsElements(nomsElements);
        resultat.elementsUniques += nomsElementsUniques.length;
        resultat.doublonsItemsIgnores += Math.max(0, nomsElements.length - nomsElementsUniques.length);
        ajouterLog(`Ticket ${titre} : ${nomsElementsUniques.length} éléments uniques après suppression des doublons`);

        const relationsExistantes = await recupererRelationsTicketExistantes(idTicket);
        const indexRelationsExistantes = construireIndexRelationsTicket(relationsExistantes);

        for (const nomElement of nomsElementsUniques) {
          ajouterLog(`Recherche élément : ${nomElement}`);
          const element = await rechercherElementParNomOuInventaire(nomElement, ajouterLog);

          if (!element) {
            const avert = `Élément introuvable : ${nomElement}`;
            ajouterLog(avert);
            resultat.avertissements.push(avert);
            resultat.elementsIntrouvables++;
            continue;
          }

          ajouterLog(`Élément trouvé : ${element.itemtype} #${element.id}`);

          const cleRelation = normaliserCleRelation(element.itemtype, element.id);

          if (indexRelationsExistantes.has(cleRelation)) {
            ajouterLog(`POST Item_Ticket Ticket #${idTicket} → ${element.itemtype} #${element.id} : relation déjà existante`);
            ajouterLog(`Relation déjà existante : Ticket #${idTicket} → ${element.itemtype} #${element.id}`);
            resultat.associationsDejaExistantes++;
            continue;
          }

          try {
            ajouterLog(`Tentative POST /Item_Ticket Ticket #${idTicket} → ${element.itemtype} #${element.id}`);
            await clientGlpiLegacy.post('/Item_Ticket', {
              input: {
                tickets_id: idTicket,
                itemtype: element.itemtype,
                items_id: element.id,
              },
            });
            ajouterLog(`POST Item_Ticket Ticket #${idTicket} → ${element.itemtype} #${element.id} : OK`);
            ajouterLog(`Relation créée : ${refTicket || idTicket} → ${nomElement}`);
            resultat.associationsCreees++;
            resultat.associations++;
            indexRelationsExistantes.add(cleRelation);
          } catch (erreurAssoc) {
            const avert = `POST Item_Ticket Ticket #${idTicket} → ${element.itemtype} #${element.id} : ${formaterErreurApiComplete(erreurAssoc)}`;
            ajouterLog(avert);
            resultat.avertissements.push(avert);
          }
        }
      }
    } catch (erreurApi) {
      const message = `Erreur import ticket "${titre}" : ${erreurApi.message}`;
      ajouterLog(message);
      resultat.avertissements.push(message);
      resultat.erreurs++;
    }
  }

  return resultat;
}

// ─── IMPORT COÛTS ──────────────────────────────────────────────────────────

// Importe les coûts depuis les données CSV analysées
// Recherche le ticket par Num_Ticket (= Ref_Ticket stocké dans le contenu du ticket)
export async function importerCoutsCsv(donnees, ajouterLog) {
  const resultat = { importes: 0, coutsIgnores: 0, erreursCouts: 0, erreurs: 0, avertissements: [] };

  const [ticketsExistants, coutsExistants] = await Promise.all([
    chargerTousLesTickets(),
    chargerTousLesCoutsTicket(),
  ]);
  const indexCoutsTickets = construireIndexCoutsTickets(coutsExistants);

  for (const ligne of donnees) {
    const numTicket = String(valeurColonneCsv(ligne, 'num_ticket') ?? '').trim();

    if (!estValide(numTicket)) {
      ajouterLog('Ligne coût ignorée : Num_Ticket manquant');
      resultat.coutsIgnores++;
      continue;
    }

    ajouterLog(`Coût Ref ${numTicket} : recherche ticket correspondant`);

    let ticket = null;

    if (correspondancesTicketsImportes.has(numTicket)) {
      const idTicketGlpi = correspondancesTicketsImportes.get(numTicket);
      ticket = ticketsExistants.find((ticketCourant) => String(ticketCourant.id) === String(idTicketGlpi)) || null;
    }

    if (!ticket) {
      ticket = trouverTicketParReferenceDansGlpi(ticketsExistants, numTicket);
    }

    if (!ticket) {
      const avert = `Coût Ref ${numTicket} : ticket introuvable, coût ignoré`;
      ajouterLog(avert);
      resultat.avertissements.push(avert);
      resultat.coutsIgnores++;
      continue;
    }

    ajouterLog(`Coût Ref ${numTicket} : ticket GLPI trouvé #${ticket.id}`);

    try {
      // Convertir toutes les valeurs numériques — jamais null ni NaN envoyé à GLPI
      const valeurActiontime = convertirNombreCsv(valeurColonneCsv(ligne, 'duration_second'), 0);
      const valeurCoutTemps = convertirNombreCsv(valeurColonneCsv(ligne, 'time_cost'), 0);
      const valeurCoutFixe = convertirNombreCsv(valeurColonneCsv(ligne, 'fixed_cost'), 0);
      const cleCout = construireCleCoutTicket(ticket.id, numTicket, valeurActiontime, valeurCoutTemps, valeurCoutFixe);

      if (indexCoutsTickets.has(cleCout)) {
        const avert = `Cout Ref ${numTicket} : TicketCost deja existant pour le ticket #${ticket.id}, cout ignore`;
        ajouterLog(avert);
        resultat.avertissements.push(avert);
        resultat.coutsIgnores++;
        continue;
      }

      ajouterLog(`Coût ${numTicket} : actiontime=${valeurActiontime}, cost_time=${valeurCoutTemps}, cost_fixed=${valeurCoutFixe}`);

      await creerCoutTicket(ticket.id, {
        nom: `${MARQUAGE_IMPORT} - Ref ${numTicket}`,
        dureeSecondes: valeurActiontime,
        coutTemps: valeurCoutTemps,
        coutFixe: valeurCoutFixe,
      });
      indexCoutsTickets.add(cleCout);
      ajouterLog(`TicketCost créé pour ${numTicket}`);
      resultat.importes++;
    } catch (erreurApi) {
      const message = `Erreur import coût Ref ${numTicket} : ${erreurApi.message}`;
      ajouterLog(message);
      resultat.avertissements.push(message);
      resultat.erreurs++;
      resultat.erreursCouts++;
    }
  }

  return resultat;
}

function formaterOuiNon(valeur) {
  return valeur ? 'Oui' : 'Non';
}

function ajouterLigneJournal(ajouterLog, libelle, valeur) {
  ajouterLog(`- ${libelle} : ${valeur}`);
}

// Ajoute le résumé final d'import à la fin du journal détaillé
export function ajouterResumeFinalImport(ajouterLog, resumeGlobal, resumeFichiers) {
  ajouterLog('=== IMPORT TERMINÉ ===');

  for (const resumeFichier of resumeFichiers) {
    ajouterLog(`${resumeFichier.libelle} :`);
    ajouterLigneJournal(ajouterLog, 'Analysé', formaterOuiNon(resumeFichier.analyse));
    ajouterLigneJournal(ajouterLog, 'Importé', formaterOuiNon(resumeFichier.importe));
    ajouterLigneJournal(ajouterLog, 'Lignes analysées', resumeFichier.lignesAnalysees);

    if (resumeFichier.type === 'ASSET') {
      ajouterLigneJournal(ajouterLog, 'Éléments créés', resumeFichier.elementsImportes);
      ajouterLigneJournal(ajouterLog, 'Doublons ignorés', resumeFichier.doublons);
      ajouterLigneJournal(ajouterLog, 'Utilisateurs créés', resumeFichier.utilisateursCrees || 0);
      ajouterLigneJournal(ajouterLog, 'Utilisateurs existants', resumeFichier.utilisateursExistants || 0);
      ajouterLigneJournal(ajouterLog, 'Utilisateurs non créés', resumeFichier.utilisateursNonCrees || 0);
      ajouterLigneJournal(ajouterLog, 'Erreurs', resumeFichier.erreurs);
    } else if (resumeFichier.type === 'TICKET') {
      ajouterLigneJournal(ajouterLog, 'Tickets créés', resumeFichier.ticketsImportes);
      ajouterLigneJournal(ajouterLog, 'Éléments demandés', resumeFichier.elementsDemandes);
      ajouterLigneJournal(ajouterLog, 'Éléments uniques', resumeFichier.elementsUniques);
      ajouterLigneJournal(ajouterLog, 'Doublons Items ignorés', resumeFichier.doublonsItemsIgnores);
      ajouterLigneJournal(ajouterLog, 'Associations Item_Ticket créées', resumeFichier.associationsCreees);
      ajouterLigneJournal(ajouterLog, 'Associations déjà existantes', resumeFichier.associationsDejaExistantes);
      ajouterLigneJournal(ajouterLog, 'Éléments introuvables', resumeFichier.elementsIntrouvables);
      ajouterLigneJournal(ajouterLog, 'Doublons ignorés', resumeFichier.doublons);
      ajouterLigneJournal(ajouterLog, 'Erreurs', resumeFichier.erreurs);
    } else if (resumeFichier.type === 'COUT') {
      ajouterLigneJournal(ajouterLog, 'Coûts créés', resumeFichier.coutsImportes);
      ajouterLigneJournal(ajouterLog, 'Erreurs', resumeFichier.erreurs);
    } else if (resumeFichier.type === 'MVT') {
      ajouterLigneJournal(ajouterLog, 'Mouvements appliqués', resumeFichier.mouvementsImportes);
      ajouterLigneJournal(ajouterLog, 'Erreurs', resumeFichier.erreurs);
    }
  }

  ajouterLog('Résumé global :');
  ajouterLigneJournal(ajouterLog, 'fichiersAnalyses', resumeGlobal.fichiersAnalyses);
  ajouterLigneJournal(ajouterLog, 'fichiersImportes', resumeGlobal.fichiersImportes);
  ajouterLigneJournal(ajouterLog, 'elementsImportes', resumeGlobal.elementsImportes);
  ajouterLigneJournal(ajouterLog, 'ticketsImportes', resumeGlobal.ticketsImportes);
  ajouterLigneJournal(ajouterLog, 'associationsCreees', resumeGlobal.associationsCreees);
  ajouterLigneJournal(ajouterLog, 'coutsImportes', resumeGlobal.coutsImportes);
  ajouterLigneJournal(ajouterLog, 'doublons', resumeGlobal.doublons);
  ajouterLigneJournal(ajouterLog, 'erreurs', resumeGlobal.erreurs);

  ajouterLog(resumeGlobal.erreurs === 0 ? 'IMPORT GLOBAL RÉUSSI' : 'IMPORT TERMINÉ AVEC ERREURS');
}
