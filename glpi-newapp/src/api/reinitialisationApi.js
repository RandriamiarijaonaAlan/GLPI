import clientGlpiLegacy from './glpiLegacyClient';
import clientGlpiV2 from './glpiV2Client';
import { afficherValeurGlpi } from '../utils/affichage';

const MARQUAGE_IMPORT_IMAGES = 'NEWAPP_IMPORT_JUIN_2026';
const NOMS_UTILISATEURS_PROTEGES = ['glpi', 'post-only', 'tech', 'normal', 'super-admin'];

const typesElementsMetier = [
  ['Computer', 'Ordinateurs'],
  ['Monitor', 'Moniteurs'],
  ['Printer', 'Imprimantes'],
  ['Phone', 'Téléphones'],
  ['NetworkEquipment', 'Équipements réseau'],
  ['Peripheral', 'Périphériques'],
  ['Software', 'Logiciels'],
  ['SoftwareLicense', 'Licences logiciel'],
  ['Certificate', 'Certificats'],
  ['Appliance', 'Applicatifs'],
  ['Rack', 'Baies'],
  ['Enclosure', 'Boîtiers'],
  ['PDU', 'Unités de distribution'],
  ['Cable', 'Câbles'],
  ['Socket', 'Prises'],
  ['Cartridge', 'Cartouches'],
  ['Consumable', 'Consommables'],
  ['Unmanaged', 'Non gérés'],
  ['PassiveDCEquipment', 'Équipements passifs DC'],
];

const configurationsReferentielsAssets = [
  { cle: 'states_id', chemin: '/State', libelle: 'État' },
  { cle: 'locations_id', chemin: '/Location', libelle: 'Localisation' },
  { cle: 'manufacturers_id', chemin: '/Manufacturer', libelle: 'Fabricant' },
  { cle: 'computermodels_id', chemin: '/ComputerModel', libelle: 'Modèle ordinateur', itemtype: 'Computer' },
  { cle: 'monitormodels_id', chemin: '/MonitorModel', libelle: 'Modèle moniteur', itemtype: 'Monitor' },
  { cle: 'printermodels_id', chemin: '/PrinterModel', libelle: 'Modèle imprimante', itemtype: 'Printer' },
  { cle: 'phonemodels_id', chemin: '/PhoneModel', libelle: 'Modèle téléphone', itemtype: 'Phone' },
  {
    cle: 'networkequipmentmodels_id',
    chemin: '/NetworkEquipmentModel',
    libelle: 'Modèle équipement réseau',
    itemtype: 'NetworkEquipment',
  },
  { cle: 'peripheralmodels_id', chemin: '/PeripheralModel', libelle: 'Modèle périphérique', itemtype: 'Peripheral' },
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

async function executerAvecConcurrence(elements, limite, traiter) {
  let index = 0;

  async function executerTacheSuivante() {
    while (index < elements.length) {
      const indexCourant = index;
      index += 1;
      await traiter(elements[indexCourant], indexCourant);
    }
  }

  const nombreExecutants = Math.min(limite, elements.length);
  await Promise.all(Array.from({ length: nombreExecutants }, executerTacheSuivante));
}

function extraireIdGlpi(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') {
    return null;
  }

  if (typeof valeur === 'object') {
    return valeur.id || valeur.value || null;
  }

  return valeur;
}

function normaliserIdGlpi(valeur) {
  const id = extraireIdGlpi(valeur);
  return id === null || id === undefined || id === '' ? null : String(id);
}

function valeurContientMarqueurImport(valeur) {
  return String(valeur || '').includes(MARQUAGE_IMPORT_IMAGES);
}

function nomElementEstVide(element) {
  const nom = String(element?.name || '').trim();
  return !nom || nom === '0';
}

function elementEstMarqueImporte(element) {
  return (
    valeurContientMarqueurImport(element?.comment) ||
    valeurContientMarqueurImport(element?.comments) ||
    valeurContientMarqueurImport(element?.name) ||
    nomElementEstVide(element)
  );
}

function utilisateurEstMarqueImporte(utilisateur) {
  return valeurContientMarqueurImport(utilisateur?.comment) ||
    valeurContientMarqueurImport(utilisateur?.comments);
}

function recupererNomUtilisateur(utilisateur) {
  return String(utilisateur?.name || '').trim();
}

function utilisateurEstProtege(utilisateur) {
  return NOMS_UTILISATEURS_PROTEGES.includes(recupererNomUtilisateur(utilisateur).toLowerCase());
}

function valeurCorrespondUtilisateur(valeur, idUtilisateur) {
  if (valeur === null || valeur === undefined) {
    return false;
  }

  if (Array.isArray(valeur)) {
    return valeur.some((element) => valeurCorrespondUtilisateur(element, idUtilisateur));
  }

  if (typeof valeur === 'object') {
    if (String(valeur.id || '') === String(idUtilisateur)) {
      return true;
    }

    return Object.values(valeur).some((sousValeur) =>
      valeurCorrespondUtilisateur(sousValeur, idUtilisateur),
    );
  }

  return String(valeur) === String(idUtilisateur);
}

function donneeEstLieeAUtilisateur(donnee, idUtilisateur) {
  return Object.entries(donnee || {}).some(([cle, valeur]) => {
    const cleUtilisateur = cle.toLowerCase().includes('user') || cle.toLowerCase().includes('users_id');
    return cleUtilisateur && valeurCorrespondUtilisateur(valeur, idUtilisateur);
  });
}

function extraireIdDocumentDepuisLien(lien) {
  return lien?.documents_id || lien?.document_id || null;
}

function recupererNomDocument(document) {
  return String(document?.name || document?.filename || '').trim();
}

function documentEstMarquePourSuppression(document) {
  const nom = recupererNomDocument(document).toUpperCase();
  const commentaire = String(document?.comment || document?.comments || '').toUpperCase();
  return nom.includes(MARQUAGE_IMPORT_IMAGES) || commentaire.includes(MARQUAGE_IMPORT_IMAGES);
}

function documentEstImageImporte(document) {
  return documentEstMarquePourSuppression(document);
}

function cleLienAsset(lien) {
  return `${lien.itemtype}#${lien.items_id}`;
}

function documentEstIntrouvable(erreur) {
  return estErreurIntrouvable(erreur);
}

async function verifierSuppressionDocument(idDocument) {
  try {
    await clientGlpiLegacy.get(`/Document/${idDocument}`);
    return { supprime: false };
  } catch (erreur) {
    if (documentEstIntrouvable(erreur)) {
      return { supprime: true };
    }

    return { supprime: false };
  }
}

export async function recupererDocumentsImagesImportes() {
  try {
    const reponse = await clientGlpiLegacy.get('/Document?range=0-999&expand_dropdowns=true');
    return convertirEnTableau(reponse.data).filter(documentEstImageImporte);
  } catch {
    return [];
  }
}

async function recupererTousLesDocuments() {
  try {
    const reponse = await clientGlpiLegacy.get('/Document?range=0-9999');
    return convertirEnTableau(reponse.data);
  } catch {
    return [];
  }
}

export async function recupererLiensDocuments() {
  try {
    // Sans expand_dropdowns : documents_id et items_id restent des IDs numériques
    const reponse = await clientGlpiLegacy.get('/Document_Item?range=0-999');
    return convertirEnTableau(reponse.data);
  } catch {
    return [];
  }
}

export async function supprimerLienDocumentElement(idLien) {
  const reponse = await clientGlpiLegacy.delete(`/Document_Item/${idLien}`);
  return reponse.data;
}

export async function supprimerDocumentImage(idDocument) {
  try {
    await clientGlpiLegacy.delete(`/Document/${idDocument}?force_purge=true`);
    return true;
  } catch {
    try {
      await clientGlpiLegacy.delete(`/Document/${idDocument}`);
    } catch {
      // Tentative de suppression simple avant le forçage final.
    }

    try {
      await clientGlpiLegacy.delete(`/Document/${idDocument}?force_purge=true`);
      return true;
    } catch {
      return false;
    }
  }
}

async function supprimerDocumentsImagesImportes(ajouterLog, resume, elementsImportes = []) {
  ajouterLog('Recherche des documents images importés');

  const formatsImages = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg']);

  // Noms des éléments importés en minuscule pour correspondance avec le nom de fichier
  // Exemple : élément "PC-ADM-001" → document "PC-ADM-001.png"
  const nomsElementsImportes = new Set(
    elementsImportes
      .map((el) => String(el.name || el.nom || '').trim().toLowerCase())
      .filter(Boolean),
  );

  // Charger toutes les liaisons Document_Item (IDs numériques, sans expand_dropdowns)
  const [liensGlobaux, tousLesDocumentsGlpi] = await Promise.all([
    recupererLiensDocuments(),
    recupererTousLesDocuments(),
  ]);

  // Construire la map document → liens ET détecter les docs liés à des éléments importés
  const clesElementsImportes = new Set(elementsImportes.map((el) => `${el.itemtype}#${String(el.id)}`));
  const liensParDocument = new Map();
  const idsDocumentsASupprimer = new Set();

  for (const lien of liensGlobaux) {
    const idDocument = String(lien.documents_id || '');
    if (!idDocument || idDocument === '0') continue;

    if (!liensParDocument.has(idDocument)) liensParDocument.set(idDocument, []);
    liensParDocument.get(idDocument).push(lien);

    const cleElement = `${lien.itemtype}#${String(lien.items_id || '')}`;
    if (clesElementsImportes.has(cleElement)) {
      idsDocumentsASupprimer.add(idDocument);
    }
  }

  // Détecter aussi les documents par :
  // 1. nom de fichier correspondant à un élément importé
  // 2. commentaire portant le marqueur
  // 3. document image orphelin (aucune liaison Document_Item) — artefacts d'imports précédents
  for (const doc of tousLesDocumentsGlpi) {
    const idDoc = String(doc.id);
    const nomDoc = String(doc.name || '').trim();
    const dernierPoint = nomDoc.lastIndexOf('.');
    if (dernierPoint <= 0) continue;

    const extension = nomDoc.slice(dernierPoint + 1).toLowerCase();
    if (!formatsImages.has(extension)) continue;

    const nomSansExtension = nomDoc.slice(0, dernierPoint).toLowerCase();
    const estOrphelin = !liensParDocument.has(idDoc);

    if (
      nomsElementsImportes.has(nomSansExtension) ||
      documentEstMarquePourSuppression(doc) ||
      estOrphelin
    ) {
      idsDocumentsASupprimer.add(idDoc);
    }
  }

  // Construire la liste finale des documents à supprimer avec leurs données
  const indexDocuments = new Map(tousLesDocumentsGlpi.map((d) => [String(d.id), d]));
  const tousLesDocuments = [...idsDocumentsASupprimer]
    .map((id) => indexDocuments.get(id))
    .filter(Boolean);

  resume.documentsTrouves = tousLesDocuments.length;

  if (tousLesDocuments.length === 0) {
    ajouterLog('Aucun document image trouvé');
    return;
  }

  ajouterLog(`${tousLesDocuments.length} document(s) image(s) trouvé(s)`);

  await executerAvecConcurrence(tousLesDocuments, 4, async (document) => {
    const idDocument = String(document?.id || '');
    const nomDocument = recupererNomDocument(document);
    const liensDocument = liensParDocument.get(idDocument) || [];

    if (liensDocument.length === 0) {
      ajouterLog(`Document ${nomDocument} : aucun lien Document_Item, suppression directe`);
    }

    let erreurLien = false;
    await executerAvecConcurrence(liensDocument, 6, async (lien) => {
      try {
        await supprimerLienDocumentElement(lien.id);
        resume.liensDocumentsSupprimes += 1;
        ajouterLog(`Document_Item #${lien.id} supprimé`);
      } catch (erreur) {
        erreurLien = true;
        resume.documentsNonSupprimes += 1;
        ajouterLog(`Erreur suppression Document_Item #${lien.id} : ${recupererMessageErreur(erreur)}`);
      }
    });

    if (erreurLien && liensDocument.length > 0) return;

    ajouterLog(`Suppression Document #${idDocument} ${nomDocument}`);
    const supprime = await supprimerDocumentImage(idDocument);
    if (supprime) {
      const verification = await verifierSuppressionDocument(idDocument);
      if (verification.supprime) {
        resume.documentsSupprimes += 1;
        ajouterLog(`Document ${nomDocument} supprimé`);
      } else {
        resume.documentsNonSupprimes += 1;
        ajouterLog(`Document ${nomDocument} toujours présent après suppression`);
      }
    } else {
      resume.documentsNonSupprimes += 1;
      ajouterLog(`Document #${idDocument} non supprimé`);
    }
  });
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

function ticketEstMarqueImporte(ticket) {
  return (
    valeurContientMarqueurImport(ticket?.content) ||
    valeurContientMarqueurImport(ticket?.comment) ||
    valeurContientMarqueurImport(ticket?.comments)
  );
}

async function recupererTicketsImportes() {
  const tickets = await recupererTicketsV2();
  return tickets.filter(ticketEstMarqueImporte);
}

async function recupererElementsParTypeV2(itemtype) {
  let donneesBrutes = [];

  try {
    const reponse = await clientGlpiV2.get(`/Assets/${itemtype}?limit=9999`);
    donneesBrutes = convertirEnTableau(reponse.data);
  } catch {
    // API v2 indisponible
  }

  // Fallback v1 : toujours tenté pour obtenir le champ comment (absent en v2)
  // On fusionne les deux sources par id pour ne rien manquer
  try {
    const reponseV1 = await clientGlpiLegacy.get(`/${itemtype}?range=0-9999&expand_dropdowns=true`);
    const donneesV1 = convertirEnTableau(reponseV1.data);
    if (donneesV1.length > 0) {
      const idsV2 = new Set(donneesBrutes.map((el) => String(el.id)));
      const supplementsV1 = donneesV1.filter((el) => !idsV2.has(String(el.id)));
      // Enrichir les éléments v2 avec le comment v1 (non retourné par v2)
      const commentParId = Object.fromEntries(donneesV1.map((el) => [String(el.id), el.comment || el.comments || '']));
      donneesBrutes = donneesBrutes.map((el) => ({
        ...el,
        comment: el.comment || commentParId[String(el.id)] || '',
      }));
      donneesBrutes = [...donneesBrutes, ...supplementsV1];
    }
  } catch {
    // v1 indisponible, on continue avec v2 seul
  }

  return donneesBrutes
    .map((element) => normaliserElement(element, itemtype))
    .filter(elementEstMarqueImporte);
}

export async function recupererElementsV2() {
  const groupesElements = await Promise.all(
    typesElementsMetier.map(([itemtype]) => recupererElementsParTypeV2(itemtype).catch(() => [])),
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

async function recupererRelationsImportees(idsTicketsImportes, idsAssetsImportes) {
  const toutes = await recupererRelationsItemTicketV1();
  return toutes.filter((relation) => {
    const idTicket = String(relation.tickets_id || '');
    const cleAsset = `${relation.itemtype}#${String(relation.items_id || '')}`;
    return idsTicketsImportes.has(idTicket) || idsAssetsImportes.has(cleAsset);
  });
}

export async function recupererCoutsTicketV1() {
  try {
    const reponse = await clientGlpiLegacy.get('/TicketCost?range=0-999&expand_dropdowns=true');
    return convertirEnTableau(reponse.data);
  } catch {
    return [];
  }
}

async function recupererCoutsImportes() {
  const tous = await recupererCoutsTicketV1();
  return tous.filter((cout) => valeurContientMarqueurImport(cout?.name));
}

export async function recupererUtilisateursImportes() {
  const reponse = await clientGlpiLegacy.get('/User?range=0-999&expand_dropdowns=true');

  return convertirEnTableau(reponse.data)
    .filter(utilisateurEstMarqueImporte)
    .map((utilisateur) => ({
      id: utilisateur.id,
      name: utilisateur.name,
      realname: utilisateur.realname,
      comment: utilisateur.comment || utilisateur.comments || '',
      donneesOriginales: utilisateur,
    }));
}

export async function recupererModulesDisponibles() {
  const [tickets, relations, couts, ...groupesElements] = await Promise.all([
    recupererTicketsImportes(),
    recupererRelationsItemTicketV1(),
    recupererCoutsImportes(),
    ...typesElementsMetier.map(([itemtype]) => recupererElementsParTypeV2(itemtype).catch(() => [])),
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

async function recupererTicketsRestantsPourUtilisateur() {
  try {
    return await recupererTicketsV2();
  } catch {
    try {
      const reponse = await clientGlpiLegacy.get('/Ticket?range=0-999&expand_dropdowns=true');
      return convertirEnTableau(reponse.data);
    } catch {
      return null;
    }
  }
}

async function recupererElementsRestantsPourUtilisateur() {
  try {
    return await recupererElementsV2();
  } catch {
    try {
      const groupesElements = await Promise.all(
        typesElementsMetier.map(async ([itemtype]) => {
          const reponse = await clientGlpiLegacy.get(`/${itemtype}?range=0-999&expand_dropdowns=true`);
          return convertirEnTableau(reponse.data)
            .map((element) => normaliserElement(element, itemtype))
            .filter(elementEstMarqueImporte);
        }),
      );
      return groupesElements.flat();
    } catch {
      return null;
    }
  }
}

async function utilisateurEstLieADonneesNonImportees(idUtilisateur, ajouterLog) {
  const [ticketsRestants, elementsRestants] = await Promise.all([
    recupererTicketsRestantsPourUtilisateur(),
    recupererElementsRestantsPourUtilisateur(),
  ]);

  if (!ticketsRestants || !elementsRestants) {
    ajouterLog('Utilisateur non supprimé car la vérification des liens GLPI a échoué.');
    return true;
  }

  const ticketNonImporteLie = ticketsRestants.some((ticket) =>
    donneeEstLieeAUtilisateur(ticket, idUtilisateur),
  );
  const elementNonImporteLie = elementsRestants.some((element) =>
    donneeEstLieeAUtilisateur(element, idUtilisateur),
  );

  return ticketNonImporteLie || elementNonImporteLie;
}

export async function supprimerUtilisateurImporte(idUtilisateur, ajouterLog = () => {}) {
  const reponseUtilisateur = await clientGlpiLegacy.get(`/User/${idUtilisateur}?expand_dropdowns=true`);
  const utilisateur = reponseUtilisateur.data;

  if (utilisateurEstProtege(utilisateur)) {
    return { supprime: false, ignore: true, raison: 'utilisateur système protégé' };
  }

  if (!utilisateurEstMarqueImporte(utilisateur)) {
    return { supprime: false, ignore: true, raison: 'marqueur import absent' };
  }

  if (await utilisateurEstLieADonneesNonImportees(idUtilisateur, ajouterLog)) {
    return {
      supprime: false,
      ignore: false,
      raison: 'Utilisateur non supprimé car encore lié à des données GLPI non importées.',
    };
  }

  try {
    await clientGlpiLegacy.delete(`/User/${idUtilisateur}?force_purge=true`);
  } catch {
    await clientGlpiLegacy.delete(`/User/${idUtilisateur}`);
  }

  return { supprime: true, ignore: false, raison: '' };
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

function collecterReferentielsDepuisElements(elements) {
  const referentiels = new Map();

  for (const configuration of configurationsReferentielsAssets) {
    referentiels.set(configuration.chemin, {
      ...configuration,
      ids: new Set(),
    });
  }

  for (const element of elements) {
    for (const configuration of configurationsReferentielsAssets) {
      if (configuration.itemtype && configuration.itemtype !== element.itemtype) {
        continue;
      }

      const idReference = normaliserIdGlpi(element[configuration.cle]);
      if (!idReference || idReference === '0') {
        continue;
      }

      referentiels.get(configuration.chemin).ids.add(idReference);
    }
  }

  return referentiels;
}

function referentielEstEncoreUtilise(configuration, idReference, elementsRestants) {
  return elementsRestants.some((element) => {
    if (configuration.itemtype && configuration.itemtype !== element.itemtype) {
      return false;
    }

    return normaliserIdGlpi(element[configuration.cle]) === String(idReference);
  });
}

async function supprimerReferentielAsset(configuration, idReference) {
  try {
    await clientGlpiLegacy.delete(`${configuration.chemin}/${idReference}?force_purge=true`);
    return true;
  } catch {
    try {
      await clientGlpiLegacy.delete(`${configuration.chemin}/${idReference}`);
    } catch {
      // La suppression simple peut échouer si GLPI attend un purge définitif.
    }

    try {
      await clientGlpiLegacy.delete(`${configuration.chemin}/${idReference}?force_purge=true`);
      return true;
    } catch {
      return false;
    }
  }
}

async function supprimerReferentielsAssetsOrphelins(elementsAvantSuppression, ajouterLog, resume, erreurs) {
  ajouterLog('Recherche des référentiels liés aux assets supprimés');
  const referentiels = collecterReferentielsDepuisElements(elementsAvantSuppression);
  const totalTrouves = [...referentiels.values()].reduce((total, configuration) => total + configuration.ids.size, 0);
  resume.referentielsTrouves = totalTrouves;

  if (totalTrouves === 0) {
    ajouterLog('Aucun référentiel asset à vérifier');
    return;
  }

  let elementsRestants = [];
  try {
    const groupes = await Promise.all(
      typesElementsMetier.map(async ([itemtype]) => {
        const reponse = await clientGlpiLegacy.get(`/${itemtype}?range=0-9999&expand_dropdowns=true`);
        return convertirEnTableau(reponse.data).map((el) => ({ ...el, itemtype }));
      }),
    );
    elementsRestants = groupes.flat();
  } catch (erreur) {
    const message = `Référentiels assets : vérification des assets restants impossible (${recupererMessageErreur(erreur)})`;
    erreurs.push(message);
    ajouterLog(`Erreur ${message}`);
    resume.referentielsNonSupprimes += totalTrouves;
    return;
  }

  for (const configuration of referentiels.values()) {
    for (const idReference of configuration.ids) {
      if (referentielEstEncoreUtilise(configuration, idReference, elementsRestants)) {
        resume.referentielsNonSupprimes += 1;
        ajouterLog(`${configuration.libelle} #${idReference} non supprimé car encore utilisé`);
        continue;
      }

      ajouterLog(`Suppression référentiel ${configuration.libelle} #${idReference}`);
      const supprime = await supprimerReferentielAsset(configuration, idReference);

      if (supprime) {
        resume.referentielsSupprimes += 1;
        ajouterLog(`Référentiel ${configuration.libelle} #${idReference} supprimé`);
      } else {
        resume.referentielsNonSupprimes += 1;
        const message = `Référentiel ${configuration.libelle} #${idReference} non supprimé`;
        erreurs.push(message);
        ajouterLog(message);
      }
    }
  }
}

// ─── RÉINITIALISATION COMPLÈTE ────────────────────────────────────────────────

export async function reinitialiserToutesLesDonneesMetier(ajouterLog, options = {}) {
  const supprimerUtilisateursImportes = options.supprimerUtilisateursImportes === true;
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
    referentielsTrouves: 0,
    referentielsSupprimes: 0,
    referentielsNonSupprimes: 0,
    documentsTrouves: 0,
    liensDocumentsSupprimes: 0,
    documentsSupprimes: 0,
    documentsNonSupprimes: 0,
    utilisateursTrouves: 0,
    utilisateursSupprimes: 0,
    utilisateursNonSupprimes: 0,
    utilisateursIgnores: 0,
    erreurs,
  };

  ajouterLog('Récupération des données métier détectées');
  const [tickets, elements] = await Promise.all([
    recupererTicketsImportes().catch((erreur) => {
      erreurs.push(`Tickets importés : ${recupererMessageErreur(erreur)}`);
      ajouterLog(`Erreur récupération tickets importés : ${recupererMessageErreur(erreur)}`);
      return [];
    }),
    recupererElementsV2().catch((erreur) => {
      erreurs.push(`Assets v2 : ${recupererMessageErreur(erreur)}`);
      ajouterLog(`Erreur récupération assets v2 : ${recupererMessageErreur(erreur)}`);
      return [];
    }),
  ]);

  const idsTicketsImportes = new Set(tickets.map((t) => String(t.id)));
  const idsAssetsImportes = new Set(elements.map((el) => `${el.itemtype}#${String(el.id)}`));

  const [relations, couts] = await Promise.all([
    recupererRelationsImportees(idsTicketsImportes, idsAssetsImportes),
    recupererCoutsImportes(),
  ]);

  resume.ticketsTrouves = tickets.length;
  resume.relationsTrouvees = relations.length;
  resume.coutsTrouves = couts.length;
  resume.elementsTrouves = elements.length;

  // Suppression des relations Item_Ticket (API v1)
  ajouterLog(`${relations.length} relations Item_Ticket récupérées`);
  await executerAvecConcurrence(relations, 8, async (relation) => {
    try {
      await supprimerRelationItemTicketV1(relation.id);
      resume.relationsSupprimees += 1;
      ajouterLog(`Relation Item_Ticket #${relation.id} supprimée`);
    } catch (erreur) {
      const message = `Relation Item_Ticket #${relation.id} : ${recupererMessageErreur(erreur)}`;
      erreurs.push(message);
      ajouterLog(`Erreur ${message}`);
    }
  });

  // Suppression des coûts TicketCost (API v1 avec force_purge)
  ajouterLog(`${couts.length} coûts TicketCost récupérés`);
  await executerAvecConcurrence(couts, 8, async (cout) => {
    try {
      await supprimerCoutTicketV1(cout.id);
      resume.coutsSupprimes += 1;
      ajouterLog(`Coût TicketCost #${cout.id} supprimé`);
    } catch (erreur) {
      const message = `TicketCost #${cout.id} : ${recupererMessageErreur(erreur)}`;
      erreurs.push(message);
      ajouterLog(`Erreur ${message}`);
    }
  });

  // Suppression des liens Document_Item puis des documents images GLPI
  // On passe les éléments importés pour retrouver aussi les docs sans marqueur
  await supprimerDocumentsImagesImportes(ajouterLog, resume, elements);

  // Suppression des tickets avec fallback robuste v2 → v1 force_purge → v1 simple
  ajouterLog(`${tickets.length} tickets récupérés via API v2`);
  await executerAvecConcurrence(tickets, 3, async (ticket) => {
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
  });

  // Suppression des éléments/assets avec fallback robuste v2 → v1 force_purge → v1 simple
  ajouterLog(`${elements.length} éléments/assets récupérés via API v2`);
  await executerAvecConcurrence(elements, 3, async (element) => {
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
  });

  // Suppression des référentiels devenus orphelins après suppression des assets
  await supprimerReferentielsAssetsOrphelins(elements, ajouterLog, resume, erreurs);

  if (supprimerUtilisateursImportes) {
    ajouterLog('Recherche utilisateurs importés');

    try {
      const utilisateurs = await recupererUtilisateursImportes();
      resume.utilisateursTrouves = utilisateurs.length;
      ajouterLog(`${utilisateurs.length} utilisateurs importés trouvés`);

      for (const utilisateur of utilisateurs) {
        const nomUtilisateur = recupererNomUtilisateur(utilisateur) || utilisateur.realname || `#${utilisateur.id}`;

        if (utilisateurEstProtege(utilisateur)) {
          resume.utilisateursIgnores += 1;
          ajouterLog(`Utilisateur ${nomUtilisateur} ignoré`);
          continue;
        }

        ajouterLog(`Suppression utilisateur ${nomUtilisateur} #${utilisateur.id}`);

        try {
          const resultat = await supprimerUtilisateurImporte(utilisateur.id, ajouterLog);

          if (resultat.supprime) {
            resume.utilisateursSupprimes += 1;
            ajouterLog(`Utilisateur ${nomUtilisateur} supprimé`);
          } else if (resultat.ignore) {
            resume.utilisateursIgnores += 1;
            ajouterLog(`Utilisateur ${nomUtilisateur} ignoré`);
          } else {
            resume.utilisateursNonSupprimes += 1;
            ajouterLog(`Utilisateur ${nomUtilisateur} non supprimé car encore lié à des données GLPI non importées`);
          }
        } catch (erreur) {
          resume.utilisateursNonSupprimes += 1;
          const message = `Utilisateur ${nomUtilisateur} #${utilisateur.id} : ${formaterErreurDetaillee(erreur)}`;
          erreurs.push(message);
          ajouterLog(`Erreur ${message}`);
        }
      }
    } catch (erreur) {
      const message = `Recherche utilisateurs importés : ${formaterErreurDetaillee(erreur)}`;
      erreurs.push(message);
      ajouterLog(`Erreur ${message}`);
    }
  } else {
    ajouterLog('Suppression des utilisateurs importés désactivée');
  }

  return resume;
}
