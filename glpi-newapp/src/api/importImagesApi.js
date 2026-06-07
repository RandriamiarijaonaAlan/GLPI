import axios from 'axios';
import clientGlpiLegacy from './glpiLegacyClient';
import { garantirSessionLegacy } from './authApi';
import { recupererTousLesElements } from './assetsApi';
import { lireFichierZip } from '../utils/zip';

// ─── RÉCUPÉRATION DES ÉLÉMENTS ────────────────────────────────────────────────

// Récupère tous les éléments du parc GLPI pour la correspondance par nom d'image
// Retourne chaque élément avec au minimum { id, name, serial, otherserial, itemtype, typeAffiche }
export async function recupererTousLesElementsPourImages() {
  try {
    return await recupererTousLesElements();
  } catch {
    return [];
  }
}

// ─── CORRESPONDANCE IMAGE ↔ ÉLÉMENT ──────────────────────────────────────────

// Recherche l'élément GLPI correspondant à une image par son nom sans extension
// Compare de façon insensible à la casse avec name, serial puis otherserial
export function trouverElementPourImage(image, elements) {
  const recherche = image.nomSansExtension.trim().toLowerCase();
  if (!recherche) return null;

  return (
    elements.find((el) => (el.name || '').trim().toLowerCase() === recherche) ||
    elements.find((el) => (el.serial || '').trim().toLowerCase() === recherche) ||
    elements.find((el) => (el.otherserial || '').trim().toLowerCase() === recherche) ||
    null
  );
}

// ─── UPLOAD DOCUMENT ──────────────────────────────────────────────────────────

// Extrait l'identifiant du Document créé depuis la réponse GLPI (format variable)
function extraireIdDocument(donnees) {
  if (Array.isArray(donnees)) return donnees[0]?.id || null;
  if (donnees?.id) return donnees.id;
  return null;
}

// Téléverse une image comme Document GLPI via multipart/form-data (API v1 legacy)
// Exception JSON justifiée : GLPI exige multipart/form-data pour l'upload de fichiers
export async function televerserImageCommeDocument(image) {
  const jetonSession = await garantirSessionLegacy();

  const formData = new FormData();

  // Le manifest décrit le Document à créer côté GLPI
  const manifest = JSON.stringify({
    input: {
      name: image.nomFichier,
      _filename: [image.nomFichier],
    },
  });
  formData.append('uploadManifest', manifest);

  // Fichier image sous forme de Blob avec son nom d'origine
  formData.append('filename[0]', image.blob, image.nomFichier);

  const reponse = await axios.post(
    `${import.meta.env.VITE_GLPI_LEGACY_API_URL}/Document`,
    formData,
    {
      headers: {
        Accept: 'application/json',
        'App-Token': import.meta.env.VITE_GLPI_APP_TOKEN,
        'Session-Token': jetonSession,
        // Content-Type non forcé : axios détecte FormData et pose la boundary multipart
      },
    }
  );

  return reponse.data;
}

// ─── LIAISON DOCUMENT → ÉLÉMENT ──────────────────────────────────────────────

// Crée une liaison Document_Item entre un Document GLPI et un élément du parc
export async function lierDocumentAElement(idDocument, element) {
  const reponse = await clientGlpiLegacy.post('/Document_Item', {
    input: {
      documents_id: idDocument,
      itemtype: element.itemtype,
      items_id: element.id,
    },
  });

  return reponse.data;
}

// ─── IMPORT COMPLET ZIP ───────────────────────────────────────────────────────

// Importe les images d'un fichier ZIP comme Documents GLPI liés aux éléments correspondants
// Étapes : lecture ZIP → détection images → chargement éléments → upload + liaison par image
// Une erreur sur une image ne bloque jamais les autres images
export async function importerImagesZip(fichierZip, ajouterLog) {
  const resultat = {
    imagesDetectees: 0,
    imagesAssociees: 0,
    imagesImportees: 0,
    documentsLies: 0,
    imagesIgnorees: 0,
    fichiersSystemeIgnores: 0,
    erreursImages: 0,
    avertissementsImages: [],
  };

  ajouterLog('Analyse ZIP démarrée');

  // Étape 1 : lire le ZIP et extraire les images reconnues
  let images;
  try {
    const resultatLecture = await lireFichierZip(fichierZip, ajouterLog);
    images = resultatLecture.images;
    resultat.fichiersSystemeIgnores = resultatLecture.fichiersSystemeIgnores;
  } catch (erreurZip) {
    const message = `Erreur lecture ZIP : ${erreurZip.message}`;
    ajouterLog(message);
    resultat.avertissementsImages.push(message);
    return resultat;
  }

  if (images.length === 0) {
    ajouterLog('ZIP vide ou aucune image reconnue (formats acceptés : jpg, jpeg, png, webp)');
    return resultat;
  }

  resultat.imagesDetectees = images.length;
  ajouterLog(`${images.length} image(s) détectée(s)`);
  for (const image of images) {
    ajouterLog(`Image ${image.nomFichier} détectée`);
  }

  // Étape 2 : charger tous les éléments GLPI pour la correspondance
  ajouterLog('Récupération des éléments GLPI en cours...');
  const elements = await recupererTousLesElementsPourImages();
  ajouterLog(`${elements.length} élément(s) GLPI chargé(s)`);

  // Étape 3 : traiter chaque image indépendamment
  for (const image of images) {
    ajouterLog(`Recherche élément : ${image.nomSansExtension}`);
    const element = trouverElementPourImage(image, elements);

    if (!element) {
      const avert = `Image ${image.nomFichier} : aucun élément trouvé pour "${image.nomSansExtension}"`;
      ajouterLog(avert);
      resultat.avertissementsImages.push(avert);
      resultat.imagesIgnorees++;
      continue;
    }

    ajouterLog(`Élément trouvé : ${element.itemtype} #${element.id} (${element.nom || element.name})`);
    resultat.imagesAssociees++;

    // Upload de l'image comme Document GLPI
    let idDocument;
    try {
      const reponseUpload = await televerserImageCommeDocument(image);
      idDocument = extraireIdDocument(reponseUpload);

      if (!idDocument) {
        const avert = `Upload ${image.nomFichier} : identifiant Document non reçu dans la réponse`;
        ajouterLog(avert);
        resultat.avertissementsImages.push(avert);
        resultat.erreursImages++;
        continue;
      }

      ajouterLog(`Upload document ${image.nomFichier} réussi (id ${idDocument})`);
      resultat.imagesImportees++;
    } catch (erreurUpload) {
      const avert = `Erreur upload ${image.nomFichier} : ${erreurUpload.message}`;
      ajouterLog(avert);
      resultat.avertissementsImages.push(avert);
      resultat.erreursImages++;
      continue;
    }

    // Liaison du Document à l'élément via Document_Item
    try {
      await lierDocumentAElement(idDocument, element);
      ajouterLog(`Document lié à ${element.itemtype} #${element.id}`);
      resultat.documentsLies++;
    } catch (erreurLiaison) {
      const avert = `Erreur liaison Document #${idDocument} → ${element.itemtype} #${element.id} : ${erreurLiaison.message}`;
      ajouterLog(avert);
      resultat.avertissementsImages.push(avert);
    }
  }

  ajouterLog('Import ZIP terminé');
  return resultat;
}
