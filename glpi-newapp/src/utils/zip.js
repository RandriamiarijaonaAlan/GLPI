import JSZip from 'jszip';

const EXTENSIONS_IMAGES_ACCEPTEES = ['jpg', 'jpeg', 'png', 'webp'];

function estFichierSystemeIgnore(cheminRelatif, nomFichier, taille) {
  if (!nomFichier) return false;
  if (taille === 0) return true;
  if (cheminRelatif.includes('__MACOSX')) return true;
  if (nomFichier.startsWith('._')) return true;
  if (nomFichier.startsWith('.') ) return true;
  return false;
}

// Décompose un nom de fichier en { nomSansExtension, extension }
function decomposerNomFichier(nomFichier) {
  const dernierPoint = nomFichier.lastIndexOf('.');
  if (dernierPoint === -1) {
    return { nomSansExtension: nomFichier, extension: '' };
  }
  return {
    nomSansExtension: nomFichier.slice(0, dernierPoint),
    extension: nomFichier.slice(dernierPoint + 1).toLowerCase(),
  };
}

// Retourne le nom d'une image sans son extension, sans espaces parasites
// Exemple : "PC-ADM-001.png" → "PC-ADM-001"
export function nettoyerNomImage(nomFichier) {
  const { nomSansExtension } = decomposerNomFichier(nomFichier);
  return nomSansExtension.trim();
}

// Lit un fichier ZIP et retourne les images reconnues ainsi que les fichiers système ignorés
// Ignore les dossiers, les fichiers système macOS et les fichiers non image
// Retourne { images, fichiersSystemeIgnores }
export async function lireFichierZip(fichierZip, ajouterLog = () => {}) {
  const zip = await JSZip.loadAsync(fichierZip);
  const promessesImages = [];
  let fichiersSystemeIgnores = 0;

  zip.forEach((cheminRelatif, entree) => {
    if (entree.dir) return;

    // Extraire le nom seul, sans le chemin de sous-dossier éventuel
    const nomFichier = cheminRelatif.split('/').pop();
    if (!nomFichier) return;

    if (estFichierSystemeIgnore(cheminRelatif, nomFichier, entree._data?.uncompressedSize || 0)) {
      fichiersSystemeIgnores++;
      ajouterLog(`Fichier système ignoré : ${cheminRelatif}`);
      return;
    }

    const { nomSansExtension, extension } = decomposerNomFichier(nomFichier);

    if (!EXTENSIONS_IMAGES_ACCEPTEES.includes(extension)) return;

    promessesImages.push(
      entree.async('blob').then((blob) => ({
        nomFichier,
        nomSansExtension,
        extension,
        blob,
        taille: blob.size,
      }))
    );
  });

  const images = await Promise.all(promessesImages);
  return { images, fichiersSystemeIgnores };
}
