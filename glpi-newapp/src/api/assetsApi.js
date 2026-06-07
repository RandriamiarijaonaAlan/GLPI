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
  return normaliserListeElements(donnees).map((element) => ({
    ...element,
    itemtype,
    typeAffiche: libellesTypesElements[itemtype] || itemtype,
    statut: afficherValeurGlpi(element.states_id),
    localisation: afficherValeurGlpi(element.locations_id),
    fabricant: afficherValeurGlpi(element.manufacturers_id),
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
