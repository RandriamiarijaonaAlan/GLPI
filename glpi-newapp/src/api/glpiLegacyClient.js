import axios from 'axios';
import { adapterGlpiOffline, modeGlpiOfflineActif } from './offlineGlpiStore';
import {
  estErreurSessionLegacy,
  garantirSessionLegacy,
  initialiserSessionLegacy,
  recupererErreurLisible,
  supprimerSessionLegacy,
} from './authApi';

const clientGlpiLegacy = axios.create({
  baseURL: import.meta.env.VITE_GLPI_LEGACY_API_URL,
  adapter: modeGlpiOfflineActif() ? adapterGlpiOffline : undefined,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'App-Token': import.meta.env.VITE_GLPI_APP_TOKEN,
  },
});

function estRequeteInitSession(config) {
  return config.url?.includes('/initSession');
}

clientGlpiLegacy.interceptors.request.use(async (config) => {
  config.headers.Accept = 'application/json';
  config.headers['Content-Type'] = 'application/json';
  config.headers['App-Token'] = import.meta.env.VITE_GLPI_APP_TOKEN;

  if (estRequeteInitSession(config)) {
    delete config.headers['Session-Token'];
    return config;
  }

  if (modeGlpiOfflineActif()) {
    config.headers['Session-Token'] = 'offline-session';
    return config;
  }

  const jetonSession = await garantirSessionLegacy();
  config.headers['Session-Token'] = jetonSession;

  return config;
});

clientGlpiLegacy.interceptors.response.use(
  (reponse) => reponse,
  async (erreur) => {
    const requeteOriginale = erreur.config;

    if (!requeteOriginale || estRequeteInitSession(requeteOriginale)) {
      return Promise.reject(new Error(recupererErreurLisible(erreur)));
    }

    if (requeteOriginale._retry || !estErreurSessionLegacy(erreur)) {
      return Promise.reject(new Error(recupererErreurLisible(erreur)));
    }

    requeteOriginale._retry = true;
    supprimerSessionLegacy();

    try {
      const nouveauJeton = await initialiserSessionLegacy();
      requeteOriginale.headers['Session-Token'] = nouveauJeton;
      requeteOriginale.headers['App-Token'] = import.meta.env.VITE_GLPI_APP_TOKEN;
      requeteOriginale.headers.Accept = 'application/json';
      requeteOriginale.headers['Content-Type'] = 'application/json';

      return clientGlpiLegacy(requeteOriginale);
    } catch (erreurInitialisation) {
      return Promise.reject(new Error(recupererErreurLisible(erreurInitialisation)));
    }
  },
);

export default clientGlpiLegacy;
