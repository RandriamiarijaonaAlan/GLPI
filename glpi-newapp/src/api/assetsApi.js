import axios from 'axios';
import clientGlpiLegacy from './glpiLegacyClient';
import clientGlpiV2 from './glpiV2Client';
import { afficherValeurGlpi } from '../utils/affichage';
import { garantirSessionLegacy } from './authApi';

const libellesTypesElements = {
  Computer: 'Ordinateur',
  Monitor: 'Moniteur',
  Printer: 'Imprimante',
  Phone: 'Téléphone',
  NetworkEquipment: 'Équipement réseau',
  Peripheral: 'Périphérique',
  Software: 'Logiciel',
  SoftwareLicense: 'Licence logiciel',
  Certificate: 'Certificat',
  Appliance: 'Applicatif',
  Rack: 'Baie',
  Enclosure: 'Boîtier',
  PDU: 'Unité de distribution',
  Cable: 'Câble',
  Socket: 'Prise',
  Cartridge: 'Cartouche',
  Consumable: 'Consommable',
  Unmanaged: 'Non géré',
  PassiveDCEquipment: 'Équipement passif DC',
};

const champsModeleParType = {
  Computer: 'computermodels_id',
  Monitor: 'monitormodels_id',
  Printer: 'printermodels_id',
  Phone: 'phonemodels_id',
  NetworkEquipment: 'networkequipmentmodels_id',
  Peripheral: 'peripheralmodels_id',
};

const cheminsElements = [
  ['Computer', '/Computer?range=0-999&expand_dropdowns=true', '/Assets/Computer?range=0-999&expand_dropdowns=true'],
  ['Monitor', '/Monitor?range=0-999&expand_dropdowns=true', '/Assets/Monitor?range=0-999&expand_dropdowns=true'],
  ['Printer', '/Printer?range=0-999&expand_dropdowns=true', '/Assets/Printer?range=0-999&expand_dropdowns=true'],
  ['Phone', '/Phone?range=0-999&expand_dropdowns=true', '/Assets/Phone?range=0-999&expand_dropdowns=true'],
  [
    'NetworkEquipment',
    '/NetworkEquipment?range=0-999&expand_dropdowns=true',
    '/Assets/NetworkEquipment?range=0-999&expand_dropdowns=true',
  ],
  ['Peripheral', '/Peripheral?range=0-999&expand_dropdowns=true', '/Assets/Peripheral?range=0-999&expand_dropdowns=true'],
  ['Software', '/Software?range=0-999&expand_dropdowns=true', '/Assets/Software?range=0-999&expand_dropdowns=true'],
  [
    'SoftwareLicense',
    '/SoftwareLicense?range=0-999&expand_dropdowns=true',
    '/Assets/SoftwareLicense?range=0-999&expand_dropdowns=true',
  ],
  ['Certificate', '/Certificate?range=0-999&expand_dropdowns=true', '/Assets/Certificate?range=0-999&expand_dropdowns=true'],
  ['Appliance', '/Appliance?range=0-999&expand_dropdowns=true', '/Assets/Appliance?range=0-999&expand_dropdowns=true'],
  ['Rack', '/Rack?range=0-999&expand_dropdowns=true', '/Assets/Rack?range=0-999&expand_dropdowns=true'],
  ['Enclosure', '/Enclosure?range=0-999&expand_dropdowns=true', '/Assets/Enclosure?range=0-999&expand_dropdowns=true'],
  ['PDU', '/PDU?range=0-999&expand_dropdowns=true', '/Assets/PDU?range=0-999&expand_dropdowns=true'],
  ['Cable', '/Cable?range=0-999&expand_dropdowns=true', '/Assets/Cable?range=0-999&expand_dropdowns=true'],
  ['Socket', '/Glpi%5CSocket?range=0-999&expand_dropdowns=true', '/Assets/Socket?range=0-999&expand_dropdowns=true'],
  ['Cartridge', '/Cartridge?range=0-999&expand_dropdowns=true', '/Assets/Cartridge?range=0-999&expand_dropdowns=true'],
  ['Consumable', '/Consumable?range=0-999&expand_dropdowns=true', '/Assets/Consumable?range=0-999&expand_dropdowns=true'],
  ['Unmanaged', '/Unmanaged?range=0-999&expand_dropdowns=true', '/Assets/Unmanaged?range=0-999&expand_dropdowns=true'],
  [
    'PassiveDCEquipment',
    '/PassiveDCEquipment?range=0-999&expand_dropdowns=true',
    '/Assets/PassiveDCEquipment?range=0-999&expand_dropdowns=true',
  ],
];

function valeurVide(valeur) {
  if (valeur === null || valeur === undefined) {
    return true;
  }

  return String(valeur).trim() === '' || String(valeur).trim() === '0';
}

function lireLibelleGlpi(valeur) {
  if (valeur === null || valeur === undefined) {
    return '';
  }

  if (Array.isArray(valeur)) {
    return valeur.map((element) => lireLibelleGlpi(element)).filter(Boolean).join(', ');
  }

  if (typeof valeur === 'string' || typeof valeur === 'number') {
    const texte = String(afficherValeurGlpi(valeur)).trim();
    return texte === '0' ? '' : texte;
  }

  if (typeof valeur === 'object') {
    const clesLibelle = ['name', 'completename', 'label', 'realname', 'firstname', 'username'];

    for (const cle of clesLibelle) {
      if (!valeurVide(valeur[cle])) {
        return String(valeur[cle]).trim();
      }
    }

    if (!valeurVide(valeur.value)) {
      return lireLibelleGlpi(valeur.value);
    }

    if (!valeurVide(valeur.id)) {
      return String(valeur.id).trim();
    }

    const texte = String(afficherValeurGlpi(valeur)).trim();
    return texte === '0' || texte === '-' ? '' : texte;
  }

  return '';
}

function premiereValeurNonVide(asset, champs) {
  for (const champ of champs) {
    const valeur = lireLibelleGlpi(asset?.[champ]);

    if (!valeurVide(valeur)) {
      return valeur;
    }
  }

  return '';
}

function normaliserAffichageVide(valeur) {
  return valeurVide(valeur) ? '-' : valeur;
}

function normaliserListeElements(donnees) {
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

function normaliserElementGlpi(asset, typeElement) {
  const champModeleType = champsModeleParType[typeElement];
  const champsModele = [
    champModeleType,
    'computermodels_id',
    'monitormodels_id',
    'printermodels_id',
    'phonemodels_id',
    'networkequipmentmodels_id',
    'peripheralmodels_id',
    'model',
  ].filter(Boolean);

  return {
    id: asset?.id,
    nom: premiereValeurNonVide(asset, ['name', 'designation', 'nom']),
    statut: premiereValeurNonVide(asset, ['states_id', 'state', 'status']),
    localisation: premiereValeurNonVide(asset, ['locations_id', 'location']),
    fabricant: premiereValeurNonVide(asset, ['manufacturers_id', 'manufacturer']),
    typeElement: libellesTypesElements[typeElement] || typeElement,
    modele: premiereValeurNonVide(asset, champsModele),
    numeroInventaire: premiereValeurNonVide(asset, ['otherserial', 'inventory_number', 'serial']),
    utilisateur: premiereValeurNonVide(asset, ['users_id', 'user']),
    itemtype: typeElement,
  };
}

function enrichirElements(donnees, typeElement) {
  const elements = normaliserListeElements(donnees);

  return elements.map((asset) => {
    const elementNormalise = normaliserElementGlpi(asset, typeElement);

    return {
      ...asset,
      ...elementNormalise,
      name: normaliserAffichageVide(elementNormalise.nom),
      status: normaliserAffichageVide(elementNormalise.statut),
      location: normaliserAffichageVide(elementNormalise.localisation),
      manufacturer: normaliserAffichageVide(elementNormalise.fabricant),
      itemType: typeElement,
      model: normaliserAffichageVide(elementNormalise.modele),
      inventoryNumber: normaliserAffichageVide(elementNormalise.numeroInventaire),
      user: normaliserAffichageVide(elementNormalise.utilisateur),
      itemtype: typeElement,
      typeAffiche: elementNormalise.typeElement,
    };
  });
}

async function recupererElementsParType(itemtype, chemin) {
  const reponse = await clientGlpiLegacy.get(chemin);
  const elements = enrichirElements(reponse.data, itemtype);

  console.log(`${itemtype} : fallback API v1 utilisé, ${elements.length} éléments`);

  return elements;
}

async function recupererElementsParTypeV2(itemtype, cheminV2) {
  const reponse = await clientGlpiV2.get(cheminV2);
  const elements = enrichirElements(reponse.data, itemtype);

  console.log(`${itemtype} : récupération API v2 réussie, ${elements.length} éléments`);

  return elements;
}

export function recupererOrdinateurs() {
  return recupererElementsParType('Computer', '/Computer?range=0-999&expand_dropdowns=true');
}

export function recupererMoniteurs() {
  return recupererElementsParType('Monitor', '/Monitor?range=0-999&expand_dropdowns=true');
}

export function recupererImprimantes() {
  return recupererElementsParType('Printer', '/Printer?range=0-999&expand_dropdowns=true');
}

export function recupererTelephones() {
  return recupererElementsParType('Phone', '/Phone?range=0-999&expand_dropdowns=true');
}

export function recupererEquipementsReseau() {
  return recupererElementsParType('NetworkEquipment', '/NetworkEquipment?range=0-999&expand_dropdowns=true');
}

export function recupererPeripheriques() {
  return recupererElementsParType('Peripheral', '/Peripheral?range=0-999&expand_dropdowns=true');
}

function dedupliquerElements(elements) {
  const elementsUniques = [];
  const clesVues = new Set();

  for (const element of elements) {
    const cle = `${element.itemtype}#${element.id}`;

    if (clesVues.has(cle)) {
      console.log(`Doublon ignoré : ${element.itemtype} #${element.id}`);
      continue;
    }

    clesVues.add(cle);
    elementsUniques.push(element);
  }

  return elementsUniques;
}

// Vérifie que les éléments retournés par l'API ont des données utilisables (au moins un name non vide)
function reponseContientDonnees(elements) {
  return elements.length > 0 && elements.some((el) => !valeurVide(el.nom));
}

// Charge toutes les liaisons Document_Item + métadonnées Document pour filtrer les images.
// Retourne une Map : "itemtype#id" → idDocument (ex. "Computer#103" → 5)
export async function recupererDocumentsParElement() {
  const formatsImages = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg']);
  try {
    // Sans expand_dropdowns : les champs documents_id et items_id restent des IDs numériques
    const [reponseRelations, reponseDocuments] = await Promise.all([
      clientGlpiLegacy.get('/Document_Item?range=0-9999'),
      clientGlpiLegacy.get('/Document?range=0-9999'),
    ]);
    const relations = normaliserListeElements(reponseRelations.data);
    const documents = normaliserListeElements(reponseDocuments.data);

    const indexDocuments = new Map(documents.map((d) => [String(d.id), d]));
    const mapDocuments = new Map();

    for (const relation of relations) {
      const { itemtype, items_id: itemsId, documents_id: documentsId } = relation;
      if (!itemtype || !itemsId || !documentsId) continue;

      const doc = indexDocuments.get(String(documentsId));
      if (!doc) continue;

      // Ne garder que les documents avec un fichier réellement stocké dans GLPI
      if (!doc.filepath) continue;

      const extension = (doc.filename || doc.name || '').split('.').pop().toLowerCase();
      if (!formatsImages.has(extension)) continue;

      const cle = `${itemtype}#${itemsId}`;
      if (!mapDocuments.has(cle)) {
        mapDocuments.set(cle, Number(doc.id));
      }
    }
    return mapDocuments;
  } catch {
    return new Map();
  }
}

// Télécharge un document GLPI en blob et retourne une URL objet utilisable dans <img src>.
// L'appelant est responsable de révoquer l'URL via URL.revokeObjectURL quand elle n'est plus nécessaire.
export async function chargerUrlImageDocument(idDocument) {
  try {
    const jeton = await garantirSessionLegacy();
    const reponse = await axios.get(
      `${import.meta.env.VITE_GLPI_LEGACY_API_URL}/Document/${idDocument}`,
      {
        responseType: 'blob',
        headers: {
          Accept: 'application/octet-stream',
          'App-Token': import.meta.env.VITE_GLPI_APP_TOKEN,
          'Session-Token': jeton,
        },
      },
    );
    return URL.createObjectURL(reponse.data);
  } catch {
    return null;
  }
}

export async function recupererTousLesElements() {
  const groupesElements = await Promise.all(
    cheminsElements.map(async ([itemtype, chemin, cheminV2]) => {
      // API v1 en priorité : retourne les champs complets avec expand_dropdowns
      try {
        const elementsV1 = await recupererElementsParType(itemtype, chemin);
        if (reponseContientDonnees(elementsV1) || elementsV1.length > 0) {
          return elementsV1;
        }
      } catch {
        console.log(`${itemtype} : API v1 échouée, tentative v2`);
      }

      // API v2 en fallback si v1 échoue ou retourne vide
      try {
        return await recupererElementsParTypeV2(itemtype, cheminV2);
      } catch {
        console.log(`${itemtype} : API v2 aussi échouée, aucun élément`);
        return [];
      }
    }),
  );

  return dedupliquerElements(groupesElements.flat());
}
