// Colonnes caractéristiques de chaque type CSV reconnu
const COLONNES_ASSET = ['Name', 'Status', 'Location', 'Manufacturer', 'Item_Type', 'Model', 'Inventory_Number', 'User'];
const COLONNES_TICKET = ['Ref_Ticket', 'Date', 'Heure', 'Type', 'Titre', 'Description', 'Status', 'Priority', 'Items'];
const COLONNES_COUT = ['Num_Ticket', 'Duration_second', 'Time_Cost', 'Fixed_Cost'];

// Retourne true si le texte contient des séquences typiques de double-encodage UTF-8/Latin-1
// (ex : "Ã©" au lieu de "é", "Ã " au lieu de "à")
// Un fichier Latin-1 lu en UTF-8 produit Ã ou Â suivi d'un octet de continuation (U+0080–U+00FF).
function contientDoubleEncodage(texte) {
  return /[\u00c2\u00c3][\u0080-\u00ff]/.test(texte);
}

// Lit un fichier CSV en UTF-8. Si le texte obtenu contient des artefacts de double-encodage,
// relit en Latin-1 (Windows-1252) qui est l'encodage réel du fichier.
export function lireFichierCsv(fichier) {
  return new Promise((resoudre, rejeter) => {
    const lecteurUtf8 = new FileReader();

    lecteurUtf8.onload = (evenement) => {
      const texteUtf8 = evenement.target.result;

      if (!contientDoubleEncodage(texteUtf8)) {
        resoudre(texteUtf8);
        return;
      }

      // Fichier en Latin-1/Windows-1252 : relire avec le bon encodage
      const lecteurLatin1 = new FileReader();
      lecteurLatin1.onload = (ev) => resoudre(ev.target.result);
      lecteurLatin1.onerror = () => rejeter(new Error(`Impossible de lire le fichier : ${fichier.name}`));
      lecteurLatin1.readAsText(fichier, 'windows-1252');
    };

    lecteurUtf8.onerror = () => rejeter(new Error(`Impossible de lire le fichier : ${fichier.name}`));
    lecteurUtf8.readAsText(fichier, 'UTF-8');
  });
}

// Détecte le séparateur utilisé dans le CSV (point-virgule ou virgule)
function detecterSeparateur(texteCsv) {
  const premiereLigne = texteCsv.split('\n')[0] || '';
  const nbVirgule = (premiereLigne.match(/,/g) || []).length;
  const nbPointVirgule = (premiereLigne.match(/;/g) || []).length;
  return nbPointVirgule >= nbVirgule ? ';' : ',';
}

// Découpe une ligne CSV en respectant les champs entre guillemets
function decouperLigneCsv(ligne, separateur) {
  const valeurs = [];
  let valeurCourante = '';
  let dansGuillemets = false;

  for (let index = 0; index < ligne.length; index++) {
    const caractere = ligne[index];
    const caractereSuivant = ligne[index + 1];

    if (caractere === '"') {
      if (dansGuillemets && caractereSuivant === '"') {
        valeurCourante += '"';
        index++;
      } else {
        dansGuillemets = !dansGuillemets;
      }
      continue;
    }

    if (caractere === separateur && !dansGuillemets) {
      valeurs.push(valeurCourante.trim());
      valeurCourante = '';
      continue;
    }

    valeurCourante += caractere;
  }

  valeurs.push(valeurCourante.trim());
  return valeurs;
}

// Convertit un texte CSV en tableau d'objets JSON
// Supporte UTF-8, séparateur ; et ,, ignore les lignes vides et nettoie les espaces
export function convertirCsvEnJson(texteCsv) {
  if (!texteCsv || !texteCsv.trim()) {
    return [];
  }

  const separateur = detecterSeparateur(texteCsv);
  const lignes = texteCsv.split('\n');

  // Trouver la première ligne non vide qui servira d'en-tête
  let indexEntete = -1;
  for (let i = 0; i < lignes.length; i++) {
    if (lignes[i].trim()) {
      indexEntete = i;
      break;
    }
  }

  if (indexEntete === -1) {
    return [];
  }

  const colonnes = decouperLigneCsv(lignes[indexEntete], separateur).map((col) => col.trim());

  const donnees = [];
  for (let i = indexEntete + 1; i < lignes.length; i++) {
    const ligne = lignes[i];

    // Ignorer les lignes totalement vides
    if (!ligne.trim()) {
      continue;
    }

    const valeurs = decouperLigneCsv(ligne, separateur);
    const objet = {};

    colonnes.forEach((colonne, index) => {
      objet[colonne] = (valeurs[index] || '').trim();
    });

    donnees.push(objet);
  }

  return donnees;
}

// Calcule le nombre de colonnes reconnues du CSV parmi les colonnes attendues
function calculerScore(colonnesCsv, colonnesAttendues) {
  return colonnesAttendues.filter((col) => colonnesCsv.includes(col)).length;
}

// Détecte automatiquement le type des données CSV selon ses colonnes
// Retourne : 'ASSET', 'TICKET', 'COUT' ou 'INCONNU'
export function detecterTypeCsv(donnees) {
  if (!donnees || donnees.length === 0) {
    return 'INCONNU';
  }

  const colonnesCsv = Object.keys(donnees[0]);

  const scoreAsset = calculerScore(colonnesCsv, COLONNES_ASSET);
  const scoreTicket = calculerScore(colonnesCsv, COLONNES_TICKET);
  const scoreCout = calculerScore(colonnesCsv, COLONNES_COUT);

  if (scoreAsset === 0 && scoreTicket === 0 && scoreCout === 0) {
    return 'INCONNU';
  }

  if (scoreAsset >= scoreTicket && scoreAsset >= scoreCout) {
    return 'ASSET';
  }

  if (scoreTicket >= scoreCout) {
    return 'TICKET';
  }

  return 'COUT';
}
