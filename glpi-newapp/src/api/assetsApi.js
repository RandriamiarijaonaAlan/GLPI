import clientGlpiLegacy from './glpiLegacyClient';
import clientGlpiV2 from './glpiV2Client';
import { afficherValeurGlpi } from '../utils/affichage';

const libellesTypesElements = {
  Computer: 'Ordinateur',
  Monitor: 'Moniteur',
  Printer: 'Imprimante',
  Phone: 'Téléphone',
  NetworkEquipment: 'Équipement réseau',
  Peripheral: 'Périphérique',
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
  ['Computer', '/Computer?range=0-999&expand_dropdowns=true', '/Asset/Computer?limit=1000'],
  ['Monitor', '/Monitor?range=0-999&expand_dropdowns=true', '/Asset/Monitor?limit=1000'],
  ['Printer', '/Printer?range=0-999&expand_dropdowns=true', '/Asset/Printer?limit=1000'],
  ['Phone', '/Phone?range=0-999&expand_dropdowns=true', '/Asset/Phone?limit=1000'],
  [
    'NetworkEquipment',
    '/NetworkEquipment?range=0-999&expand_dropdowns=true',
    '/Asset/NetworkEquipment?limit=1000',
  ],
  ['Peripheral', '/Peripheral?range=0-999&expand_dropdowns=true', '/Asset/Peripheral?limit=1000'],
];

function normaliserValeurAffichage(valeur) {
  const valeurAffichee = afficherValeurGlpi(valeur);
  const texte = String(valeurAffichee ?? '').trim();

  if (!texte || texte === '0') {
    return '-';
  }

  return texte;
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

function enrichirElements(donnees, itemtype) {
  const champModele = champsModeleParType[itemtype];

  return normaliserListeElements(donnees).map((element) => ({
    ...element,
    id: element.id,
    name: normaliserValeurAffichage(element.name),
    status: normaliserValeurAffichage(element.status || element.states_id),
    location: normaliserValeurAffichage(element.location || element.locations_id),
    manufacturer: normaliserValeurAffichage(element.manufacturer || element.manufacturers_id),
    itemType: itemtype,
    model: normaliserValeurAffichage(element.model || element[champModele]),
    inventoryNumber: normaliserValeurAffichage(element.otherserial || element.inventory_number),
    user: normaliserValeurAffichage(element.user || element.users_id),
    itemtype,
    typeAffiche: libellesTypesElements[itemtype] || itemtype,
  }));
}

async function recupererElementsParType(itemtype, chemin) {
  const reponse = await clientGlpiLegacy.get(chemin);

  return enrichirElements(reponse.data, itemtype);
}

async function recupererElementsParTypeV2(itemtype, cheminV2) {
  const reponse = await clientGlpiV2.get(cheminV2);

  return enrichirElements(reponse.data, itemtype);
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

export async function recupererTousLesElements() {
  try {
    const groupesElementsV2 = await Promise.all(
      cheminsElements.map(([itemtype, , cheminV2]) => recupererElementsParTypeV2(itemtype, cheminV2)),
    );

    return groupesElementsV2.flat();
  } catch {
    const groupesElementsLegacy = await Promise.all(
      cheminsElements.map(([itemtype, chemin]) => recupererElementsParType(itemtype, chemin)),
    );

    return groupesElementsLegacy.flat();
  }
}
