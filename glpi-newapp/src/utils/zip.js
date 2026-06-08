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

// Convertit un Blob image quelconque en JPEG via un canvas navigateur.
// Les PNG transparents reçoivent un fond blanc avant conversion.
// Retourne le Blob JPEG, ou le Blob original si la conversion échoue.
function convertirBlobEnJpeg(blob) {
  return new Promise((resoudre) => {
    const urlBlob = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(urlBlob);
      canvas.toBlob(
        (blobJpeg) => resoudre(blobJpeg || blob),
        'image/jpeg',
        0.90,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(urlBlob);
      resoudre(blob);
    };

    img.src = urlBlob;
  });
}

// Lit un fichier ZIP et retourne les images reconnues ainsi que les fichiers système ignorés.
// Toutes les images sont normalisées en JPEG avant l'upload pour garantir la compatibilité GLPI.
// Retourne { images, fichiersSystemeIgnores }
export async function lireFichierZip(fichierZip, ajouterLog = () => {}) {
  const zip = await JSZip.loadAsync(fichierZip);
  const promessesImages = [];
  let fichiersSystemeIgnores = 0;

  zip.forEach((cheminRelatif, entree) => {
    if (entree.dir) return;

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
      entree.async('blob').then(async (blob) => {
        const estDejaJpeg = extension === 'jpg' || extension === 'jpeg';

        // Convertir en JPEG si nécessaire : évite les problèmes de MIME type avec GLPI
        const blobFinal = estDejaJpeg
          ? new Blob([blob], { type: 'image/jpeg' })
          : await convertirBlobEnJpeg(blob);

        const nomFichierFinal = `${nomSansExtension}.jpeg`;

        return {
          nomFichier: nomFichierFinal,
          nomSansExtension,
          extension: 'jpeg',
          blob: blobFinal,
          taille: blobFinal.size,
        };
      }),
    );
  });

  const images = await Promise.all(promessesImages);
  return { images, fichiersSystemeIgnores };
}
