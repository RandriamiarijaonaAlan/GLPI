import clientGlpiLegacy from './glpiLegacyClient';

const libellesTypesElements = {
  Computer: 'Ordinateur',
  Monitor: 'Moniteur',
  Printer: 'Imprimante',
  Phone: 'Téléphone',
  NetworkEquipment: 'Équipement réseau',
  Peripheral: 'Périphérique',
};

const cheminsElements = [
  ['Computer', '/Computer?range=0-999&expand_dropdowns=true'],
  ['Monitor', '/Monitor?range=0-999&expand_dropdowns=true'],
  ['Printer', '/Printer?range=0-999&expand_dropdowns=true'],
  ['Phone', '/Phone?range=0-999&expand_dropdowns=true'],
  ['NetworkEquipment', '/NetworkEquipment?range=0-999&expand_dropdowns=true'],
  ['Peripheral', '/Peripheral?range=0-999&expand_dropdowns=true'],
];

async function recupererElementsParType(itemtype, chemin) {
  const reponse = await clientGlpiLegacy.get(chemin);
  const donnees = Array.isArray(reponse.data) ? reponse.data : [];

  return donnees.map((element) => ({
    ...element,
    itemtype,
    typeAffiche: libellesTypesElements[itemtype] || itemtype,
  }));
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
  const groupesElements = await Promise.all(
    cheminsElements.map(([itemtype, chemin]) => recupererElementsParType(itemtype, chemin)),
  );

  return groupesElements.flat();
}
