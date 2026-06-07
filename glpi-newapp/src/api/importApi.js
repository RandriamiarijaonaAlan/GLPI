import clientGlpiLegacy from './glpiLegacyClient';

const MARQUAGE_IMPORT = 'NEWAPP_IMPORT_JUIN_2026';

// Correspondance des tickets créés pendant l'import courant : Ref_Ticket -> id GLPI
const correspondancesTicketsImportes = new Map();

// Cache des utilisateurs trouvés ou créés en cours d'import : nom_normalise -> { id, cree }
const cacheUtilisateursImport = new Map();

// Cache des éléments par type pour la recherche en cours d'import tickets ; réinitialisé à chaque appel
let cacheElementsTicketImport = null;

const CHAMPS_MODELES_PAR_TYPE = {
  Computer: { chemin: '/ComputerModel', champ: 'computermodels_id' },
  Monitor: { chemin: '/MonitorModel', champ: 'monitormodels_id' },
  Printer: { chemin: '/PrinterModel', champ: 'printermodels_id' },
  Phone: { chemin: '/PhoneModel', champ: 'phonemodels_id' },
  NetworkEquipment: { chemin: '/NetworkEquipmentModel', champ: 'networkequipmentmodels_id' },
  Peripheral: { chemin: '/PeripheralModel', champ: 'peripheralmodels_id' },
};

const TYPES_ELEMENTS_VALIDES = [
  'Computer',
  'Monitor',
  'Printer',
  'Phone',
  'NetworkEquipment',
  'Peripheral',
];

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

function normaliserComparaisonElement(valeur) {
  return String(valeur ?? '').trim().replace(/\s+/g, '').toLowerCase();
}

function formaterErreurApiComplete(erreur) {
  const statut = erreur.response?.status;
  const donnees = erreur.response?.data;
  const message = donnees ? JSON.stringify(donnees) : erreur.message || 'Erreur inconnue';
  return statut ? `HTTP ${statut} - ${message}` : message;
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

async function recupererOuCreerReferenceGenerique(chemin, nomReference, champsComplementaires = {}) {
  const nomNormalise = String(nomReference ?? '').trim();

  if (!nomNormalise) {
    return null;
  }

  const referencesExistantes = await chargerReferentielGlpi(chemin);
  const referenceExistante = trouverReferenceParNom(referencesExistantes, nomNormalise);

  if (referenceExistante?.id) {
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
      return idCree;
    }
  } catch {
    return null;
  }

  return null;
}

export async function recupererOuCreerEtatGlpi(nomEtat) {
  return recupererOuCreerReferenceGenerique('/State', nomEtat);
}

export async function recupererOuCreerLocalisationGlpi(nomLocalisation) {
  return recupererOuCreerReferenceGenerique('/Location', nomLocalisation);
}

export async function recupererOuCreerFabricantGlpi(nomFabricant) {
  return recupererOuCreerReferenceGenerique('/Manufacturer', nomFabricant);
}

export async function recupererOuCreerModeleGlpi(itemtype, nomModele, idFabricant = null) {
  const configurationModele = CHAMPS_MODELES_PAR_TYPE[itemtype];

  if (!configurationModele || !String(nomModele || '').trim()) {
    return null;
  }

  return recupererOuCreerReferenceGenerique(configurationModele.chemin, nomModele, {
    ...(idFabricant ? { manufacturers_id: idFabricant } : {}),
  });
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
  const nomBrut = String(nomUtilisateur ?? '').trim();
  if (!nomBrut) return null;

  const cleCache = nomBrut.toLowerCase();

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
  } catch {
    // Création échouée : import continue sans utilisateur
  }

  ajouterLog('Création utilisateur échouée, asset créé sans utilisateur');
  return null;
}

function construireCommentaireImportElement(ligne) {
  const lignesCommentaire = [
    MARQUAGE_IMPORT,
    `Status: ${String(ligne?.Status || '').trim() || '-'}`,
    `Location: ${String(ligne?.Location || '').trim() || '-'}`,
    `Manufacturer: ${String(ligne?.Manufacturer || '').trim() || '-'}`,
    `Model: ${String(ligne?.Model || '').trim() || '-'}`,
    `Inventory_Number: ${String(ligne?.Inventory_Number || '').trim() || '-'}`,
    `User: ${String(ligne?.User || '').trim() || '-'}`,
  ];

  return lignesCommentaire.join('\n');
}

function determinerChampModelePourType(itemtype) {
  return CHAMPS_MODELES_PAR_TYPE[itemtype]?.champ || null;
}

// Charge tous les éléments d'un type donné depuis GLPI (API v1)
async function chargerElementsParType(itemtype) {
  try {
    const reponse = await clientGlpiLegacy.get(`/${itemtype}?range=0-9999&expand_dropdowns=true`);
    return normaliserEnTableau(reponse.data);
  } catch {
    return [];
  }
}

async function chargerElementsParTypePourAssociation(itemtype) {
  try {
    const reponse = await clientGlpiLegacy.get(`/${itemtype}?range=0-999&expand_dropdowns=true`);
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

// Recherche un doublon d'élément par nom ou numéro d'inventaire
function trouverDoublonElement(elementsExistants, nom, numeroInventaire) {
  return elementsExistants.find((el) => {
    if (estValide(nom) && (el.name || '') === nom) return true;
    if (estValide(numeroInventaire) && (el.otherserial || '') === numeroInventaire) return true;
    return false;
  });
}

// Recherche un doublon de ticket par référence dans le contenu ou par titre exact
function trouverDoublonTicket(tickets, refTicket, titre) {
  return tickets.find((ticket) => {
    if (estValide(refTicket) && (ticket.content || '').includes(`Ref_Ticket: ${refTicket}`)) {
      return true;
    }
    if (estValide(titre) && (ticket.name || '') === titre) return true;
    return false;
  });
}

// Recherche un ticket par référence (Ref_Ticket stocké dans le contenu)
function trouverTicketParReference(tickets, refTicket) {
  if (!estValide(refTicket)) return null;
  return tickets.find((ticket) =>
    (ticket.content || '').includes(`Ref_Ticket: ${refTicket}`)
  ) || null;
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
  const dateBrute = String(ligne?.Date || '').trim();
  const heureBrute = String(ligne?.Heure || '').trim();

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

function estErreurChampDateGLPI(erreur) {
  const message = String(erreur?.response?.data ? JSON.stringify(erreur.response.data) : erreur?.message || '').toLowerCase();
  return (
    message.includes('date_creation') ||
    message.includes('date') && (message.includes('unknown') || message.includes('invalid') || message.includes('not allowed') || message.includes('refused'))
  );
}

async function creerTicketAvecFallbackDate(corpsTicket, dateGLPI, ajouterLog) {
  if (!dateGLPI) {
    return clientGlpiLegacy.post('/Ticket', { input: corpsTicket });
  }

  // Envoyer date et date_creation simultanément dans le body de création
  try {
    return await clientGlpiLegacy.post('/Ticket', {
      input: { ...corpsTicket, date: dateGLPI, date_creation: dateGLPI },
    });
  } catch (erreurDate) {
    if (!estErreurChampDateGLPI(erreurDate)) throw erreurDate;
    ajouterLog('Champs date refusés à la création par GLPI, ticket créé sans date CSV');
    return clientGlpiLegacy.post('/Ticket', { input: corpsTicket });
  }
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

// Convertit une valeur CSV en nombre
// Remplace la virgule décimale par un point, retourne valeurParDefaut si vide ou NaN
export function convertirNombreCsv(valeur, valeurParDefaut = 0) {
  if (valeur === null || valeur === undefined) return valeurParDefaut;
  const texte = String(valeur).trim().replace(/\s+/g, '').replace(',', '.');
  if (!texte) return valeurParDefaut;
  const nombre = Number(texte);
  return Number.isNaN(nombre) ? valeurParDefaut : nombre;
}

// Recherche un élément par nom, otherserial ou serial (insensible à la casse)
function trouverElementParNom(elements, nomRecherche) {
  if (!estValide(nomRecherche)) return null;
  const recherche = nomRecherche.toLowerCase();
  return (
    elements.find((el) => (el.name || '').toLowerCase() === recherche) ||
    elements.find((el) => estValide(el.otherserial) && el.otherserial.toLowerCase() === recherche) ||
    elements.find((el) => estValide(el.serial) && el.serial.toLowerCase() === recherche) ||
    null
  );
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

function relationItemTicketDejaExistante(relationsExistantes, element) {
  const cleRecherchee = normaliserCleRelation(element.itemtype, element.id);

  return relationsExistantes.some((relation) => {
    const itemtypeRelation = relation.itemtype || relation.items_id?.itemtype || relation.items_id?.type;
    const itemsIdRelation = relation.items_id?.id || relation.items_id?.items_id || relation.items_id;
    return normaliserCleRelation(itemtypeRelation, itemsIdRelation) === cleRecherchee;
  });
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

function trouverElementPourAssociation(elements, nomRecherche) {
  const rechercheNormalisee = String(nomRecherche || '').trim().toLowerCase();

  if (!rechercheNormalisee) {
    return null;
  }

  return (
    elements.find((element) => String(element.name || '').trim().toLowerCase() === rechercheNormalisee) ||
    elements.find((element) => String(element.serial || '').trim().toLowerCase() === rechercheNormalisee) ||
    elements.find((element) => String(element.otherserial || '').trim().toLowerCase() === rechercheNormalisee) ||
    null
  );
}

// Recherche un élément dans tous les types reconnus par name, serial, otherserial ou inventory_number
// Charge chaque type à la demande et met en cache le résultat pour l'import en cours
async function rechercherElementParNomOuInventaire(nomElement, ajouterLog = () => {}) {
  const recherche = normaliserComparaisonElement(nomElement);
  if (!recherche) return null;

  if (!cacheElementsTicketImport) {
    cacheElementsTicketImport = {};
    for (const type of TYPES_ELEMENTS_VALIDES) {
      cacheElementsTicketImport[type] = await chargerElementsParTypePourAssociation(type);
    }
  }

  for (const type of TYPES_ELEMENTS_VALIDES) {
    const elements = cacheElementsTicketImport[type] || [];
    const trouve = elements.find(
      (el) =>
        normaliserComparaisonElement(el.name) === recherche ||
        normaliserComparaisonElement(el.serial) === recherche ||
        normaliserComparaisonElement(el.otherserial) === recherche ||
        normaliserComparaisonElement(el.inventory_number) === recherche
    );

    if (trouve) {
      ajouterLog(`Recherche ${nomElement} dans ${type} : trouvé #${trouve.id}`);
      return { ...trouve, itemtype: type };
    }

    ajouterLog(`Recherche ${nomElement} dans ${type} : non trouvé`);
  }

  return null;
}

// Extrait l'identifiant créé depuis la réponse GLPI (format variable selon la version)
function extraireIdCree(donnees) {
  if (donnees?.id) return donnees.id;
  if (Array.isArray(donnees)) return donnees[0]?.id || donnees[0]?.items_id;
  return donnees?.items_id || null;
}

// ─── IMPORT ÉLÉMENTS (ASSET) ───────────────────────────────────────────────

// Importe les éléments du parc depuis les données CSV analysées
// Évite les doublons, continue en cas d'erreur API sur une ligne
export async function importerElementsCsv(donnees, ajouterLog) {
  const resultat = {
    importes: 0,
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
    const nom = (ligne.Name || '').trim();
    const itemType = (ligne.Item_Type || '').trim();
    const numeroInventaire = (ligne.Inventory_Number || '').trim();

    if (!estValide(nom)) {
      ajouterLog('Ligne ignorée : colonne Name manquante ou vide');
      continue;
    }

    if (!TYPES_ELEMENTS_VALIDES.includes(itemType)) {
      const avert = `Ligne ignorée : type inconnu "${itemType}" pour "${nom}"`;
      ajouterLog(avert);
      resultat.avertissements.push(avert);
      continue;
    }

    const existants = elementsParType[itemType] || [];
    const doublon = trouverDoublonElement(existants, nom, numeroInventaire);

    if (doublon) {
      const avert = `Doublon ignoré : ${nom} (${itemType}) — id existant ${doublon.id}`;
      ajouterLog(avert);
      resultat.avertissements.push(avert);
      resultat.doublons++;
      continue;
    }

    try {
      const commentaireImport = construireCommentaireImportElement(ligne);
      const etatGlpi = await recupererOuCreerEtatGlpi(ligne.Status);
      const localisationGlpi = await recupererOuCreerLocalisationGlpi(ligne.Location);
      const fabricantGlpi = await recupererOuCreerFabricantGlpi(ligne.Manufacturer);
      const modeleGlpi = await recupererOuCreerModeleGlpi(itemType, ligne.Model, fabricantGlpi);

      let utilisateurGlpi = null;
      const nomUtilisateur = String(ligne.User || '').trim();
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

      const reponse = await clientGlpiLegacy.post(`/${itemType}`, { input: corpsElement });
      const idCree = extraireIdCree(reponse.data);

      ajouterLog(`Import élément : ${nom} (${itemType})${idCree ? ` — id ${idCree}` : ''}`);
      resultat.importes++;

      // Mémoriser localement pour détecter les doublons des lignes suivantes
      elementsParType[itemType].push({ id: idCree, name: nom, otherserial: numeroInventaire });
    } catch (erreurApi) {
      const message = `Erreur import ${nom} (${itemType}) : ${erreurApi.message}`;
      ajouterLog(message);
      resultat.avertissements.push(message);
      resultat.erreurs++;
    }
  }

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

  const ticketsExistants = await chargerTousLesTickets();

  for (const ligne of donnees) {
    const refTicket = (ligne.Ref_Ticket || '').trim();
    const titre = (ligne.Titre || '').trim();
    const description = (ligne.Description || '').trim();
    const itemsColonne = String(ligne.Items ?? '').trim();
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

    const doublon = trouverDoublonTicket(ticketsExistants, refTicket, titre);
    if (doublon) {
      const avert = `Doublon ignoré : ticket "${titre}"${refTicket ? ` (Ref: ${refTicket})` : ''} — id ${doublon.id}`;
      ajouterLog(avert);
      resultat.avertissements.push(avert);
      resultat.doublons++;
      continue;
    }

    // Construire le contenu avec marquage et référence pour traçabilité
    const lignesContenu = [];
    if (estValide(description)) lignesContenu.push(description);
    lignesContenu.push('');
    lignesContenu.push(MARQUAGE_IMPORT);
    if (estValide(refTicket)) lignesContenu.push(`Ref_Ticket: ${refTicket}`);
    const contenu = lignesContenu.join('\n');

    try {
      const corpsTicket = {
        name: titre,
        content: contenu,
        type: 1,
        urgency: 3,
        priority: 3,
        status: 1,
        entities_id: 0,
      };

      const reponseCreation = await creerTicketAvecFallbackDate(corpsTicket, dateGLPI, ajouterLog);
      const idTicket = extraireIdCree(reponseCreation.data);

      ajouterLog(`Ticket Ref ${refTicket || titre} créé avec ID #${idTicket}`);
      resultat.importes++;

      if (estValide(refTicket) && idTicket) {
        correspondancesTicketsImportes.set(refTicket, idTicket);
      }

      // Forcer la date CSV via PUT après création (GLPI peut ignorer date à la création)
      if (dateGLPI && idTicket) {
        await mettreAJourDateTicket(idTicket, dateGLPI, ajouterLog);
      }

      // Mémoriser localement pour la détection de doublons des lignes suivantes
      ticketsExistants.push({ id: idTicket, name: titre, content: contenu });

      // Créer les relations Item_Ticket si la colonne Items est renseignée
      if (estValide(itemsColonne) && idTicket) {
        ajouterLog(`Ticket ${titre} : Items brut = ${itemsColonne}`);

        const nomsElements = extraireNomsElementsDepuisItems(itemsColonne);
        resultat.elementsDemandes += nomsElements.length;
        ajouterLog(`Ticket ${titre} : Items extraits = ${nomsElements.join(', ') || '-'}`);
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

          if (relationItemTicketDejaExistante(relationsExistantes, element)) {
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
            ajouterLog(`Relation créée : Ticket #${idTicket} → ${element.itemtype} #${element.id}`);
            resultat.associationsCreees++;
            resultat.associations++;
            relationsExistantes.push({ itemtype: element.itemtype, items_id: element.id });
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

  const ticketsExistants = await chargerTousLesTickets();

  for (const ligne of donnees) {
    const numTicket = String(ligne.Num_Ticket ?? '').trim();

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
      const valeurActiontime = convertirNombreCsv(ligne.Duration_second, 0);
      const valeurCoutTemps = convertirNombreCsv(ligne.Time_Cost, 0);
      const valeurCoutFixe = convertirNombreCsv(ligne.Fixed_Cost, 0);

      ajouterLog(`Coût Ref ${numTicket} : actiontime=${valeurActiontime}, cost_time=${valeurCoutTemps}, cost_fixed=${valeurCoutFixe}`);

      const corpsCout = {
        tickets_id: ticket.id,
        name: `${MARQUAGE_IMPORT} - Ref ${numTicket}`,
        actiontime: valeurActiontime,
        cost_time: valeurCoutTemps,
        cost_fixed: valeurCoutFixe,
        entities_id: 0,
      };

      await clientGlpiLegacy.post('/TicketCost', { input: corpsCout });
      ajouterLog(`Coût Ref ${numTicket} : TicketCost créé`);
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
