import axios from 'axios';
import {
  recupererTokenV2 as recupererTokenOAuthV2,
  sauvegarderTokenV2,
  supprimerTokenV2 as supprimerTokenOAuthV2,
  testerConnexionGlpiV2,
} from './glpiV2Client';

export { testerConnexionGlpiV2 };

const CLE_ACCES_BACKOFFICE = 'backoffice_access';
const CLE_SESSION_LEGACY = 'glpi_legacy_session_token';

const messagesErreurGlpi = {
  ERROR_APP_TOKEN_PARAMETERS_MISSING: 'App Token GLPI manquant dans le fichier .env',
  ERROR_WRONG_APP_TOKEN_PARAMETER: 'App Token GLPI invalide',
  ERROR_RIGHT_MISSING: 'User Token GLPI invalide ou droits API insuffisants',
  ERROR_NOT_ALLOWED_IP: 'IP non autorisée dans le client API GLPI',
  ERROR_SESSION_TOKEN_INVALID: 'Session GLPI expirée',
  ERROR_SESSION_TOKEN_MISSING: 'Session GLPI manquante',
};

function verifierConfigurationLegacy() {
  if (!import.meta.env.VITE_GLPI_APP_TOKEN) {
    throw new Error('App Token GLPI manquant dans le fichier .env');
  }

  if (!import.meta.env.VITE_GLPI_USER_TOKEN) {
    throw new Error('User Token GLPI manquant dans le fichier .env');
  }
}

export function recupererCodeErreurGlpi(donnees) {
  if (Array.isArray(donnees)) {
    return donnees.find((element) => typeof element === 'string' && element.startsWith('ERROR_'));
  }

  if (typeof donnees === 'string' && donnees.startsWith('ERROR_')) {
    return donnees;
  }

  return donnees?.code || donnees?.status || donnees?.error;
}

export function estErreurSessionLegacy(erreur) {
  const code = recupererCodeErreurGlpi(erreur.response?.data);
  const message = JSON.stringify(erreur.response?.data || '').toLowerCase();

  return (
    code === 'ERROR_SESSION_TOKEN_INVALID' ||
    code === 'ERROR_SESSION_TOKEN_MISSING' ||
    erreur.response?.status === 401 ||
    (erreur.response?.status === 400 && message.includes('session'))
  );
}

export function recupererErreurLisible(erreur) {
  if (erreur.message && !erreur.response) {
    return erreur.message;
  }

  const statutHttp = erreur.response?.status;
  const donnees = erreur.response?.data;
  const code = recupererCodeErreurGlpi(donnees);

  if (code && messagesErreurGlpi[code]) {
    return messagesErreurGlpi[code];
  }

  if (statutHttp === 401) {
    return 'User Token GLPI invalide ou droits API insuffisants';
  }

  const messageApi =
    donnees?.message ||
    donnees?.error ||
    (Array.isArray(donnees) ? donnees.join(' - ') : '') ||
    (typeof donnees === 'string' ? donnees : '') ||
    (donnees ? JSON.stringify(donnees) : '') ||
    erreur.message ||
    'Erreur inconnue';

  return statutHttp ? `HTTP ${statutHttp} - ${messageApi}` : messageApi;
}

export function enregistrerAccesBackoffice() {
  sessionStorage.setItem(CLE_ACCES_BACKOFFICE, 'true');
}

export function supprimerAccesBackoffice() {
  sessionStorage.removeItem(CLE_ACCES_BACKOFFICE);
}

export function aAccesBackoffice() {
  return sessionStorage.getItem(CLE_ACCES_BACKOFFICE) === 'true';
}

export function enregistrerJetonV2(jeton) {
  sauvegarderTokenV2(jeton, Date.now() + 3600 * 1000);
}

export function recupererJetonV2() {
  return recupererTokenOAuthV2();
}

export function supprimerJetonV2() {
  supprimerTokenOAuthV2();
}

export function aJetonV2() {
  return Boolean(recupererJetonV2());
}

export function enregistrerSessionLegacy(jeton) {
  sessionStorage.setItem(CLE_SESSION_LEGACY, jeton);
}

export function recupererSessionLegacy() {
  return sessionStorage.getItem(CLE_SESSION_LEGACY);
}

export function supprimerSessionLegacy() {
  sessionStorage.removeItem(CLE_SESSION_LEGACY);
}

export function aSessionLegacy() {
  return Boolean(recupererSessionLegacy());
}

export async function initialiserSessionLegacy() {
  verifierConfigurationLegacy();
  supprimerSessionLegacy();

  // Cette requête n'utilise pas glpiLegacyClient pour éviter de déclencher ses interceptors.
  const reponse = await axios.get(`${import.meta.env.VITE_GLPI_LEGACY_API_URL}/initSession`, {
    headers: {
      'App-Token': import.meta.env.VITE_GLPI_APP_TOKEN,
      Authorization: `user_token ${import.meta.env.VITE_GLPI_USER_TOKEN}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  const jetonSession = reponse.data?.session_token;

  if (!jetonSession) {
    throw new Error(`Réponse initSession sans session_token: ${JSON.stringify(reponse.data)}`);
  }

  enregistrerSessionLegacy(jetonSession);
  return jetonSession;
}

export async function garantirSessionLegacy() {
  const jetonSession = recupererSessionLegacy();

  if (jetonSession) {
    return jetonSession;
  }

  return initialiserSessionLegacy();
}

export async function testerConnexionGlpiLegacy() {
  try {
    const jetonSession = await garantirSessionLegacy();

    return {
      succes: Boolean(jetonSession),
      api: 'legacy',
      message: 'Connexion API GLPI legacy réussie',
    };
  } catch (erreur) {
    return {
      succes: false,
      api: 'legacy',
      message: 'Connexion API GLPI legacy échouée',
      erreur: recupererErreurLisible(erreur),
    };
  }
}
