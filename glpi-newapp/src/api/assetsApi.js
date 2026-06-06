import clientGlpiLegacy from './glpiLegacyClient';

const endpointsElements = [
  ['Computer', '/Computer?range=0-99&expand_dropdowns=true'],
  ['Monitor', '/Monitor?range=0-99&expand_dropdowns=true'],
  ['Printer', '/Printer?range=0-99&expand_dropdowns=true'],
  ['Phone', '/Phone?range=0-99&expand_dropdowns=true'],
  ['NetworkEquipment', '/NetworkEquipment?range=0-99&expand_dropdowns=true'],
  ['Peripheral', '/Peripheral?range=0-99&expand_dropdowns=true'],
];

async function recupererElementsParType(itemtype, endpoint) {
  const reponse = await clientGlpiLegacy.get(endpoint);
  const donnees = Array.isArray(reponse.data) ? reponse.data : [];

  return donnees.map((element) => ({
    ...element,
    itemtype,
  }));
}

export function recupererOrdinateurs() {
  return recupererElementsParType('Computer', '/Computer?range=0-99&expand_dropdowns=true');
}

export function recupererMoniteurs() {
  return recupererElementsParType('Monitor', '/Monitor?range=0-99&expand_dropdowns=true');
}

export function recupererImprimantes() {
  return recupererElementsParType('Printer', '/Printer?range=0-99&expand_dropdowns=true');
}

export function recupererTelephones() {
  return recupererElementsParType('Phone', '/Phone?range=0-99&expand_dropdowns=true');
}

export function recupererEquipementsReseau() {
  return recupererElementsParType('NetworkEquipment', '/NetworkEquipment?range=0-99&expand_dropdowns=true');
}

export function recupererPeripheriques() {
  return recupererElementsParType('Peripheral', '/Peripheral?range=0-99&expand_dropdowns=true');
}

export async function recupererTousLesElements() {
  const groupesElements = await Promise.all(
    endpointsElements.map(([itemtype, endpoint]) => recupererElementsParType(itemtype, endpoint)),
  );

  return groupesElements.flat();
}
