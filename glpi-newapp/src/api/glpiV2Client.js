import axios from 'axios';

const CLE_JETON_V2 = 'glpi_v2_access_token';
const CLE_EXPIRATION_V2 = 'glpi_v2_expiration';
const MARGE_EXPIRATION_MS = 60_000;

function verifierConfigurationV2() {
  const variablesManquantes = [
    ['VITE_GLPI_V2_API_URL', import.meta.env.VITE_GLPI_V2_API_URL],
    ['VITE_GLPI_OAUTH_TOKEN_URL', import.meta.env.VITE_GLPI_OAUTH_TOKEN_URL],
    ['VITE_GLPI_CLIENT_ID', import.meta.env.VITE_GLPI_CLIENT_ID],
    ['VITE_GLPI_CLIENT_SECRET', import.meta.env.VITE_GLPI_CLIENT_SECRET],
    ['VITE_GLPI_USERNAME', import.meta.env.VITE_GLPI_USERNAME],
    ['VITE_GLPI_PASSWORD', import.meta.env.VITE_GLPI_PASSWORD],
  ]
    .filter(([, valeur]) => !valeur)
    .map(([nom]) => nom);

  if (variablesManquantes.length > 0) {
    throw new Error(`Configuration API v2 incomplète : ${variablesManquantes.join(', ')}`);
  }
}

function recupererExpirationDepuisReponse(donnees) {
  const delaiSecondes = Number(donnees.expires_in || donnees.expires || 3600);
  return Date.now() + delaiSecondes * 1000;
}

function recupererErreurLisibleV2(erreur) {
  if (erreur.message && !erreur.response) {
    return erreur.message;
  }

  const statutHttp = erreur.response?.status;
  const donnees = erreur.response?.data;
  const messageApi =
    donnees?.error_description ||
    donnees?.message ||
    donnees?.error ||
    (donnees ? JSON.stringify(donnees) : '') ||
    erreur.message ||
    'Erreur inconnue';

  return statutHttp ? `HTTP ${statutHttp} - ${messageApi}` : messageApi;
}

function recupererMessageTestConnexionV2(erreur) {
  if (erreur.response?.status === 403) {
    return 'API v2 accessible mais droits insuffisants ou scope OAuth incorrect.';
  }

  if (erreur.response?.status === 401) {
    return 'Token OAuth2 invalide ou expiré.';
  }

  return recupererErreurLisibleV2(erreur);
}

function tokenEncoreValide(expiration) {
  return Number(expiration || 0) > Date.now() + MARGE_EXPIRATION_MS;
}

export async function obtenirTokenV2() {
  verifierConfigurationV2();

  const corps = new URLSearchParams();
  corps.set('grant_type', 'password');
  corps.set('client_id', import.meta.env.VITE_GLPI_CLIENT_ID);
  corps.set('client_secret', import.meta.env.VITE_GLPI_CLIENT_SECRET);
  corps.set('username', import.meta.env.VITE_GLPI_USERNAME);
  corps.set('password', import.meta.env.VITE_GLPI_PASSWORD);
  corps.set('scope', 'api');

  const reponse = await axios.post(import.meta.env.VITE_GLPI_OAUTH_TOKEN_URL, corps, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const jeton = reponse.data?.access_token;

  if (!jeton) {
    throw new Error(`Réponse OAuth2 sans access_token : ${JSON.stringify(reponse.data)}`);
  }

  const expiration = recupererExpirationDepuisReponse(reponse.data);
  sauvegarderTokenV2(jeton, expiration);

  return jeton;
}

export function sauvegarderTokenV2(token, expiration) {
  sessionStorage.setItem(CLE_JETON_V2, token);
  sessionStorage.setItem(CLE_EXPIRATION_V2, String(expiration));
}

export function recupererTokenV2() {
  const token = sessionStorage.getItem(CLE_JETON_V2);
  const expiration = sessionStorage.getItem(CLE_EXPIRATION_V2);

  if (!token || !tokenEncoreValide(expiration)) {
    return null;
  }

  return token;
}

export function supprimerTokenV2() {
  sessionStorage.removeItem(CLE_JETON_V2);
  sessionStorage.removeItem(CLE_EXPIRATION_V2);
}

export async function garantirTokenV2() {
  const token = recupererTokenV2();

  if (token) {
    return token;
  }

  return obtenirTokenV2();
}

const clientGlpiV2 = axios.create({
  baseURL: import.meta.env.VITE_GLPI_V2_API_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

clientGlpiV2.interceptors.request.use(async (config) => {
  const token = await garantirTokenV2();

  config.headers.Accept = 'application/json';
  config.headers['Content-Type'] = 'application/json';
  config.headers.Authorization = `Bearer ${token}`;

  return config;
});

clientGlpiV2.interceptors.response.use(
  (reponse) => reponse,
  async (erreur) => {
    const requeteOriginale = erreur.config;

    if (!requeteOriginale || requeteOriginale._retryV2 || erreur.response?.status !== 401) {
      return Promise.reject(new Error(recupererErreurLisibleV2(erreur)));
    }

    requeteOriginale._retryV2 = true;
    supprimerTokenV2();

    try {
      const nouveauToken = await obtenirTokenV2();
      requeteOriginale.headers.Authorization = `Bearer ${nouveauToken}`;
      return clientGlpiV2(requeteOriginale);
    } catch (erreurToken) {
      return Promise.reject(new Error(recupererErreurLisibleV2(erreurToken)));
    }
  },
);

export async function testerConnexionGlpiV2() {
  try {
    supprimerTokenV2();
    const token = await obtenirTokenV2();

    await axios.get(`${import.meta.env.VITE_GLPI_V2_API_URL}/Assistance/Ticket?limit=10`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      succes: true,
      api: 'v2',
      message: 'Connexion API GLPI v2 réussie',
    };
  } catch (erreur) {
    return {
      succes: false,
      api: 'v2',
      message: 'Connexion API GLPI v2 échouée',
      erreur: recupererMessageTestConnexionV2(erreur),
    };
  }
}

export default clientGlpiV2;
