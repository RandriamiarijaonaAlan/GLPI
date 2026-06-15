const CLE_STOCKAGE = 'glpi_newapp_offline_store_v1';
const MARQUAGE_IMPORT = 'NEWAPP_IMPORT_JUIN_2026';

const typesAssets = [
  'Computer',
  'Monitor',
  'Printer',
  'Phone',
  'NetworkEquipment',
  'Peripheral',
  'Software',
  'SoftwareLicense',
  'Certificate',
  'Appliance',
  'Rack',
  'Enclosure',
  'PDU',
  'Cable',
  'Socket',
  'Cartridge',
  'Consumable',
  'Unmanaged',
  'PassiveDCEquipment',
];

const aliasRessources = {
  'Glpi\\Socket': 'Socket',
  'Glpi%5CSocket': 'Socket',
  AssistanceTicket: 'Ticket',
};

const ressourcesInitiales = [
  'Ticket',
  'Item_Ticket',
  'TicketCost',
  'User',
  'Document',
  'Document_Item',
  'State',
  'Location',
  'Manufacturer',
  'ComputerModel',
  'MonitorModel',
  'PrinterModel',
  'PhoneModel',
  'NetworkEquipmentModel',
  'PeripheralModel',
  ...typesAssets,
];

function creerEtatInitial() {
  return {
    version: 1,
    sequences: Object.fromEntries(ressourcesInitiales.map((ressource) => [ressource, 1])),
    tables: Object.fromEntries(ressourcesInitiales.map((ressource) => [ressource, []])),
  };
}

function cloner(valeur) {
  return JSON.parse(JSON.stringify(valeur));
}

function chargerEtat() {
  try {
    const donnees = JSON.parse(localStorage.getItem(CLE_STOCKAGE) || 'null');
    const etat = donnees && typeof donnees === 'object' ? donnees : creerEtatInitial();

    for (const ressource of ressourcesInitiales) {
      if (!Array.isArray(etat.tables?.[ressource])) etat.tables[ressource] = [];
      if (!Number(etat.sequences?.[ressource])) {
        const maxId = etat.tables[ressource].reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
        etat.sequences[ressource] = maxId + 1;
      }
    }

    return etat;
  } catch {
    return creerEtatInitial();
  }
}

function sauvegarderEtat(etat) {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(etat));
}

function normaliserUrl(url = '') {
  const urlSansBase = String(url).replace(/^https?:\/\/[^/]+/i, '');
  return urlSansBase.startsWith('/') ? urlSansBase : `/${urlSansBase}`;
}

function analyserUrl(url) {
  const normalisee = normaliserUrl(url);
  const [cheminBrut, requeteBrute = ''] = normalisee.split('?');
  const segments = cheminBrut.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(requeteBrute);

  if (segments[0] === 'Assets') {
    return { ressource: normaliserRessource(segments[1]), id: segments[2], params };
  }

  if (segments[0] === 'Assistance' && segments[1] === 'Ticket') {
    return { ressource: 'Ticket', id: segments[2], params };
  }

  return { ressource: normaliserRessource(segments[0]), id: segments[1], params };
}

function normaliserRessource(ressource) {
  return aliasRessources[ressource] || ressource;
}

function table(etat, ressource) {
  if (!etat.tables[ressource]) etat.tables[ressource] = [];
  if (!etat.sequences[ressource]) etat.sequences[ressource] = 1;
  return etat.tables[ressource];
}

function creerReponse(config, data, status = 200) {
  return {
    data: cloner(data),
    status,
    statusText: status >= 400 ? 'Error' : 'OK',
    headers: {},
    config,
  };
}

function creerErreur(config, status, data) {
  const erreur = new Error(status === 404 ? 'Item not found' : 'Erreur GLPI locale');
  erreur.config = config;
  erreur.response = creerReponse(config, data, status);
  return erreur;
}

function extraireInput(data) {
  if (typeof data === 'string') {
    try {
      return extraireInput(JSON.parse(data));
    } catch {
      return {};
    }
  }

  return data?.input || data || {};
}

function prochainId(etat, ressource) {
  const id = etat.sequences[ressource] || 1;
  etat.sequences[ressource] = id + 1;
  return id;
}

function valeurTexte(valeur) {
  if (valeur === null || valeur === undefined) return '';
  if (typeof valeur === 'object') return String(valeur.name || valeur.realname || valeur.id || '');
  return String(valeur);
}

function correspondRecherche(item, params) {
  for (const [cle, valeur] of params.entries()) {
    const match = cle.match(/^searchText\[(.+)]$/);
    if (!match) continue;

    const champ = match[1];
    const texteItem = valeurTexte(item[champ]).toLowerCase();
    const texteRecherche = String(valeur || '').toLowerCase();
    if (!texteItem.includes(texteRecherche)) return false;
  }

  return true;
}

function lister(etat, ressource, params) {
  return table(etat, ressource)
    .filter((item) => item?.is_deleted !== 1 && item?.is_deleted !== true)
    .filter((item) => correspondRecherche(item, params));
}

function recuperer(etat, ressource, id) {
  return table(etat, ressource).find((item) => String(item.id) === String(id) && item.is_deleted !== 1);
}

function creer(etat, ressource, input) {
  const item = {
    id: prochainId(etat, ressource),
    entities_id: 0,
    is_deleted: 0,
    ...input,
  };

  table(etat, ressource).push(item);
  return item;
}

function modifier(etat, ressource, id, input) {
  const item = recuperer(etat, ressource, id);
  if (!item) return null;
  Object.assign(item, input);
  return item;
}

function supprimer(etat, ressource, id) {
  const elements = table(etat, ressource);
  const index = elements.findIndex((item) => String(item.id) === String(id));
  if (index < 0) return false;
  elements.splice(index, 1);
  return true;
}

function routeInitSession(config, url) {
  if (normaliserUrl(url).includes('/initSession')) {
    return creerReponse(config, { session_token: 'offline-session' });
  }

  return null;
}

function routeOAuth(config, url) {
  if (String(url || '').includes('oauth') || String(url || '').includes('token')) {
    return creerReponse(config, { access_token: 'offline-token', expires_in: 3600 });
  }

  return null;
}

export function modeGlpiOfflineActif() {
  return import.meta.env.VITE_GLPI_OFFLINE !== 'false';
}

export async function adapterGlpiOffline(config) {
  const url = config.url || '';
  const reponseSession = routeInitSession(config, url) || routeOAuth(config, url);
  if (reponseSession) return reponseSession;

  const etat = chargerEtat();
  const methode = String(config.method || 'get').toLowerCase();
  const { ressource, id, params } = analyserUrl(url);

  if (!ressource || !ressourcesInitiales.includes(ressource)) {
    return creerReponse(config, []);
  }

  if (methode === 'get') {
    if (id) {
      const item = recuperer(etat, ressource, id);
      if (!item) throw creerErreur(config, 404, ['ERROR_ITEM_NOT_FOUND']);
      return creerReponse(config, item);
    }

    return creerReponse(config, lister(etat, ressource, params));
  }

  if (methode === 'post') {
    const input = extraireInput(config.data);
    const item = creer(etat, ressource, input);
    sauvegarderEtat(etat);
    return creerReponse(config, { id: item.id, items_id: item.id }, 201);
  }

  if (methode === 'put' || methode === 'patch') {
    const input = extraireInput(config.data);
    const item = modifier(etat, ressource, id, input);
    if (!item) throw creerErreur(config, 404, ['ERROR_ITEM_NOT_FOUND']);
    sauvegarderEtat(etat);
    return creerReponse(config, item);
  }

  if (methode === 'delete') {
    const supprime = supprimer(etat, ressource, id);
    if (!supprime) throw creerErreur(config, 404, ['ERROR_ITEM_NOT_FOUND']);
    sauvegarderEtat(etat);
    return creerReponse(config, { deleted: true });
  }

  return creerReponse(config, []);
}

export async function importerDocumentOffline(fichier, commentaire = MARQUAGE_IMPORT) {
  const etat = chargerEtat();
  const document = creer(etat, 'Document', {
    name: fichier?.name || `${MARQUAGE_IMPORT}.png`,
    filename: fichier?.name || `${MARQUAGE_IMPORT}.png`,
    filepath: fichier?.name || `${MARQUAGE_IMPORT}.png`,
    comment: commentaire,
  });
  sauvegarderEtat(etat);
  return { id: document.id, items_id: document.id };
}
