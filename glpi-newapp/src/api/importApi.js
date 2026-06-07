import clientGlpiLegacy from './glpiLegacyClient';

const MARQUAGE_IMPORT = 'NEWAPP_IMPORT_JUIN_2026';

const TYPES_ELEMENTS_VALIDES = [
  'Computer',
  'Monitor',
  'Printer',
  'Phone',
  'NetworkEquipment',
  'Peripheral',
];

// Retourne true si la valeur est non nulle et non vide
function estValide(valeur) {
  return valeur !== null && valeur !== undefined && String(valeur).trim() !== '';
}

// Normalise la réponse GLPI en tableau, quelle que soit la structure retournée
function normaliserEnTableau(donnees) {
  if (Array.isArray(donnees)) return donnees;
  if (Array.isArray(donnees?.data)) return donnees.data;
  if (Array.isArray(donnees?.items)) return donnees.items;
  if (Array.isArray(donnees?.member)) return donnees.member;
  return [];
}

// Charge tous les éléments d'un type donné depuis GLPI (API v1)
async function chargerElementsParType(itemtype) {
  try {
    const reponse = await clientGlpiLegacy.get(`/${itemtype}?range=0-9999&expand_dropdowns=true`);
    return normaliserEnTableau(reponse.data);
  } catch {
    return [];
  }
}

// Charge tous les tickets depuis GLPI (API v1)
async function chargerTousLesTickets() {
  try {
    const reponse = await clientGlpiLegacy.get('/Ticket?range=0-9999&expand_dropdowns=true');
    return normaliserEnTableau(reponse.data);
  } catch {
    return [];
  }
}

// Charge tous les éléments de tous les types reconnus
async function chargerTousLesElements() {
  const tous = [];
  for (const type of TYPES_ELEMENTS_VALIDES) {
    const elements = await chargerElementsParType(type);
    elements.forEach((el) => tous.push({ ...el, itemtype: type }));
  }
  return tous;
}

// Recherche un doublon d'élément par nom ou numéro d'inventaire
function trouverDoublonElement(elementsExistants, nom, numeroInventaire) {
  return elementsExistants.find((el) => {
    if (estValide(nom) && (el.name || '') === nom) return true;
    if (estValide(numeroInventaire) && (el.otherserial || '') === numeroInventaire) return true;
    return false;
  });
}

// Recherche un doublon de ticket par référence dans le contenu ou par titre exact
function trouverDoublonTicket(tickets, refTicket, titre) {
  return tickets.find((ticket) => {
    if (estValide(refTicket) && (ticket.content || '').includes(`Ref_Ticket: ${refTicket}`)) {
      return true;
    }
    if (estValide(titre) && (ticket.name || '') === titre) return true;
    return false;
  });
}

// Recherche un ticket par référence (Ref_Ticket stocké dans le contenu)
function trouverTicketParReference(tickets, refTicket) {
  if (!estValide(refTicket)) return null;
  return tickets.find((ticket) =>
    (ticket.content || '').includes(`Ref_Ticket: ${refTicket}`)
  ) || null;
}

// Nettoie une valeur CSV de la colonne Items et retourne la liste des noms d'éléments
// Gère : guillemets doubles répétés (""), tableaux JSON ["A","B"], séparateurs , et ;
export function nettoyerNomElementDepuisCsv(valeur) {
  if (!valeur || typeof valeur !== 'string' || !valeur.trim()) return [];

  // Remplacer les guillemets doubles consécutifs (artéfact d'export CSV Excel/LibreOffice)
  let texte = valeur.replace(/""/g, '"').trim();

  // Retirer les guillemets extérieurs si le texte est entièrement entouré de guillemets
  if (texte.startsWith('"') && texte.endsWith('"')) {
    texte = texte.slice(1, -1).trim();
  }

  // Essayer de parser comme tableau JSON valide : ["PC-ADM-001","PC-RH-002"]
  if (texte.startsWith('[')) {
    try {
      const tableau = JSON.parse(texte);
      if (Array.isArray(tableau)) {
        return tableau.map((n) => String(n).trim()).filter(Boolean);
      }
    } catch {
      // JSON invalide : retirer les crochets et traiter manuellement
    }
    texte = texte.replace(/^\[/, '').replace(/\]$/, '').trim();
  }

  // Détecter le séparateur dominant (point-virgule prioritaire)
  const separateur = texte.includes(';') ? ';' : ',';

  // Découper, retirer guillemets et crochets résiduels autour de chaque nom
  return texte
    .split(separateur)
    .map((nom) => nom.trim().replace(/^["'[]+|["'\]]+$/g, '').trim())
    .filter(Boolean);
}

// Convertit une valeur CSV en nombre
// Remplace la virgule décimale par un point, retourne valeurParDefaut si vide ou NaN
function convertirNombreCsv(valeur, valeurParDefaut = 0) {
  if (valeur === null || valeur === undefined) return valeurParDefaut;
  const texte = String(valeur).trim().replace(',', '.');
  if (!texte) return valeurParDefaut;
  const nombre = Number(texte);
  return Number.isNaN(nombre) ? valeurParDefaut : nombre;
}

// Recherche un élément par nom, otherserial ou serial (insensible à la casse)
function trouverElementParNom(elements, nomRecherche) {
  if (!estValide(nomRecherche)) return null;
  const recherche = nomRecherche.toLowerCase();
  return (
    elements.find((el) => (el.name || '').toLowerCase() === recherche) ||
    elements.find((el) => estValide(el.otherserial) && el.otherserial.toLowerCase() === recherche) ||
    elements.find((el) => estValide(el.serial) && el.serial.toLowerCase() === recherche) ||
    null
  );
}

// Extrait l'identifiant créé depuis la réponse GLPI (format variable selon la version)
function extraireIdCree(donnees) {
  if (donnees?.id) return donnees.id;
  if (Array.isArray(donnees)) return donnees[0]?.id || donnees[0]?.items_id;
  return donnees?.items_id || null;
}

// ─── IMPORT ÉLÉMENTS (ASSET) ───────────────────────────────────────────────

// Importe les éléments du parc depuis les données CSV analysées
// Évite les doublons, continue en cas d'erreur API sur une ligne
export async function importerElementsCsv(donnees, ajouterLog) {
  const resultat = { importes: 0, doublons: 0, erreurs: 0, avertissements: [] };

  // Charger les éléments existants par type pour détection de doublons
  const elementsParType = {};
  for (const type of TYPES_ELEMENTS_VALIDES) {
    elementsParType[type] = await chargerElementsParType(type);
  }

  for (const ligne of donnees) {
    const nom = (ligne.Name || '').trim();
    const itemType = (ligne.Item_Type || '').trim();
    const numeroInventaire = (ligne.Inventory_Number || '').trim();

    if (!estValide(nom)) {
      ajouterLog('Ligne ignorée : colonne Name manquante ou vide');
      continue;
    }

    if (!TYPES_ELEMENTS_VALIDES.includes(itemType)) {
      const avert = `Ligne ignorée : type inconnu "${itemType}" pour "${nom}"`;
      ajouterLog(avert);
      resultat.avertissements.push(avert);
      continue;
    }

    const existants = elementsParType[itemType] || [];
    const doublon = trouverDoublonElement(existants, nom, numeroInventaire);

    if (doublon) {
      const avert = `Doublon ignoré : ${nom} (${itemType}) — id existant ${doublon.id}`;
      ajouterLog(avert);
      resultat.avertissements.push(avert);
      resultat.doublons++;
      continue;
    }

    try {
      const corpsElement = {
        name: nom,
        comment: MARQUAGE_IMPORT,
      };

      if (estValide(numeroInventaire)) {
        corpsElement.otherserial = numeroInventaire;
      }

      const reponse = await clientGlpiLegacy.post(`/${itemType}`, { input: corpsElement });
      const idCree = extraireIdCree(reponse.data);

      ajouterLog(`Import élément : ${nom} (${itemType})${idCree ? ` — id ${idCree}` : ''}`);
      resultat.importes++;

      // Mémoriser localement pour détecter les doublons des lignes suivantes
      elementsParType[itemType].push({ id: idCree, name: nom, otherserial: numeroInventaire });
    } catch (erreurApi) {
      const message = `Erreur import ${nom} (${itemType}) : ${erreurApi.message}`;
      ajouterLog(message);
      resultat.avertissements.push(message);
      resultat.erreurs++;
    }
  }

  return resultat;
}

// ─── IMPORT TICKETS ────────────────────────────────────────────────────────

// Importe les tickets depuis les données CSV analysées
// Ajoute le marquage et la référence dans le contenu, crée les relations Item_Ticket
export async function importerTicketsCsv(donnees, ajouterLog) {
  const resultat = { importes: 0, doublons: 0, erreurs: 0, associations: 0, avertissements: [] };

  const ticketsExistants = await chargerTousLesTickets();
  const elementsExistants = await chargerTousLesElements();

  for (const ligne of donnees) {
    const refTicket = (ligne.Ref_Ticket || '').trim();
    const titre = (ligne.Titre || '').trim();
    const description = (ligne.Description || '').trim();
    const itemsColonne = (ligne.Items || '').trim();

    if (!estValide(titre)) {
      ajouterLog('Ligne ignorée : colonne Titre manquante ou vide');
      continue;
    }

    const doublon = trouverDoublonTicket(ticketsExistants, refTicket, titre);
    if (doublon) {
      const avert = `Doublon ignoré : ticket "${titre}"${refTicket ? ` (Ref: ${refTicket})` : ''} — id ${doublon.id}`;
      ajouterLog(avert);
      resultat.avertissements.push(avert);
      resultat.doublons++;
      continue;
    }

    // Construire le contenu avec marquage et référence pour traçabilité
    const lignesContenu = [];
    if (estValide(description)) lignesContenu.push(description);
    lignesContenu.push('');
    lignesContenu.push(MARQUAGE_IMPORT);
    if (estValide(refTicket)) lignesContenu.push(`Ref_Ticket: ${refTicket}`);
    const contenu = lignesContenu.join('\n');

    try {
      const corpsTicket = {
        name: titre,
        content: contenu,
        type: 1,
        urgency: 3,
        priority: 3,
        status: 1,
        entities_id: 0,
      };

      const reponseCreation = await clientGlpiLegacy.post('/Ticket', { input: corpsTicket });
      const idTicket = extraireIdCree(reponseCreation.data);

      ajouterLog(`Import ticket : ${titre}${refTicket ? ` (Ref: ${refTicket})` : ''}`);
      resultat.importes++;

      // Mémoriser localement pour la détection de doublons des lignes suivantes
      ticketsExistants.push({ id: idTicket, name: titre, content: contenu });

      // Créer les relations Item_Ticket si la colonne Items est renseignée
      if (estValide(itemsColonne) && idTicket) {
        ajouterLog(`Items brut : ${itemsColonne}`);

        const nomsElements = nettoyerNomElementDepuisCsv(itemsColonne);
        ajouterLog(`Items nettoyés : ${nomsElements.join(', ') || '(aucun)'}`);

        for (const nomElement of nomsElements) {
          ajouterLog(`Recherche élément : ${nomElement}`);
          const element = trouverElementParNom(elementsExistants, nomElement);

          if (!element) {
            const avert = `Élément introuvable : "${nomElement}" (ticket : ${titre})`;
            ajouterLog(avert);
            resultat.avertissements.push(avert);
            continue;
          }

          ajouterLog(`Élément trouvé : ${nomElement} — id ${element.id} (${element.itemtype})`);

          try {
            await clientGlpiLegacy.post('/Item_Ticket', {
              input: {
                tickets_id: idTicket,
                itemtype: element.itemtype,
                items_id: element.id,
              },
            });
            ajouterLog(`Association créée : ticket "${titre}" ↔ "${nomElement}"`);
            resultat.associations++;
          } catch (erreurAssoc) {
            const avert = `Erreur association "${nomElement}" → ticket "${titre}" : ${erreurAssoc.message}`;
            ajouterLog(avert);
            resultat.avertissements.push(avert);
          }
        }
      }
    } catch (erreurApi) {
      const message = `Erreur import ticket "${titre}" : ${erreurApi.message}`;
      ajouterLog(message);
      resultat.avertissements.push(message);
      resultat.erreurs++;
    }
  }

  return resultat;
}

// ─── IMPORT COÛTS ──────────────────────────────────────────────────────────

// Importe les coûts depuis les données CSV analysées
// Recherche le ticket par Num_Ticket (= Ref_Ticket stocké dans le contenu du ticket)
export async function importerCoutsCsv(donnees, ajouterLog) {
  const resultat = { importes: 0, erreurs: 0, avertissements: [] };

  const ticketsExistants = await chargerTousLesTickets();

  for (const ligne of donnees) {
    const numTicket = (ligne.Num_Ticket || '').trim();
    const durationSeconde = ligne.Duration_second;
    const coutTemps = ligne.Time_Cost;
    const coutFixe = ligne.Fixed_Cost;

    if (!estValide(numTicket)) {
      ajouterLog('Ligne coût ignorée : Num_Ticket manquant');
      continue;
    }

    const ticket = trouverTicketParReference(ticketsExistants, numTicket);

    if (!ticket) {
      const avert = `Ticket introuvable pour coût (Ref: ${numTicket}) — coût ignoré`;
      ajouterLog(avert);
      resultat.avertissements.push(avert);
      continue;
    }

    try {
      // Convertir toutes les valeurs numériques — jamais null ni NaN envoyé à GLPI
      const valeurCoutTemps = convertirNombreCsv(coutTemps, 0);
      const valeurCoutFixe = convertirNombreCsv(coutFixe, 0);
      const valeurActiontime = convertirNombreCsv(durationSeconde, 0);

      ajouterLog(
        `Coût converti : cost_time=${valeurCoutTemps}, cost_fixed=${valeurCoutFixe}, actiontime=${valeurActiontime}`
      );

      const corpsCout = {
        tickets_id: ticket.id,
        name: `${MARQUAGE_IMPORT} - Ref ${numTicket}`,
        cost_time: valeurCoutTemps,
        cost_fixed: valeurCoutFixe,
        actiontime: valeurActiontime,
        entities_id: 0,
      };

      await clientGlpiLegacy.post('/TicketCost', { input: corpsCout });
      ajouterLog(`Import coût : ticket "${ticket.name}" (Ref: ${numTicket})`);
      resultat.importes++;
    } catch (erreurApi) {
      const message = `Erreur import coût (Ref: ${numTicket}) : ${erreurApi.message}`;
      ajouterLog(message);
      resultat.avertissements.push(message);
      resultat.erreurs++;
    }
  }

  return resultat;
}

function formaterOuiNon(valeur) {
  return valeur ? 'Oui' : 'Non';
}

function ajouterLigneJournal(ajouterLog, libelle, valeur) {
  ajouterLog(`- ${libelle} : ${valeur}`);
}

// Ajoute le résumé final d'import à la fin du journal détaillé
export function ajouterResumeFinalImport(ajouterLog, resumeGlobal, resumeFichiers) {
  ajouterLog('=== IMPORT TERMINÉ ===');

  for (const resumeFichier of resumeFichiers) {
    ajouterLog(`${resumeFichier.libelle} :`);
    ajouterLigneJournal(ajouterLog, 'Analysé', formaterOuiNon(resumeFichier.analyse));
    ajouterLigneJournal(ajouterLog, 'Importé', formaterOuiNon(resumeFichier.importe));
    ajouterLigneJournal(ajouterLog, 'Lignes analysées', resumeFichier.lignesAnalysees);

    if (resumeFichier.type === 'ASSET') {
      ajouterLigneJournal(ajouterLog, 'Éléments créés', resumeFichier.elementsImportes);
      ajouterLigneJournal(ajouterLog, 'Doublons ignorés', resumeFichier.doublons);
      ajouterLigneJournal(ajouterLog, 'Erreurs', resumeFichier.erreurs);
    } else if (resumeFichier.type === 'TICKET') {
      ajouterLigneJournal(ajouterLog, 'Tickets créés', resumeFichier.ticketsImportes);
      ajouterLigneJournal(ajouterLog, 'Associations Item_Ticket créées', resumeFichier.associationsCreees);
      ajouterLigneJournal(ajouterLog, 'Doublons ignorés', resumeFichier.doublons);
      ajouterLigneJournal(ajouterLog, 'Erreurs', resumeFichier.erreurs);
    } else if (resumeFichier.type === 'COUT') {
      ajouterLigneJournal(ajouterLog, 'Coûts créés', resumeFichier.coutsImportes);
      ajouterLigneJournal(ajouterLog, 'Erreurs', resumeFichier.erreurs);
    }
  }

  ajouterLog('Résumé global :');
  ajouterLigneJournal(ajouterLog, 'fichiersAnalyses', resumeGlobal.fichiersAnalyses);
  ajouterLigneJournal(ajouterLog, 'fichiersImportes', resumeGlobal.fichiersImportes);
  ajouterLigneJournal(ajouterLog, 'elementsImportes', resumeGlobal.elementsImportes);
  ajouterLigneJournal(ajouterLog, 'ticketsImportes', resumeGlobal.ticketsImportes);
  ajouterLigneJournal(ajouterLog, 'associationsCreees', resumeGlobal.associationsCreees);
  ajouterLigneJournal(ajouterLog, 'coutsImportes', resumeGlobal.coutsImportes);
  ajouterLigneJournal(ajouterLog, 'doublons', resumeGlobal.doublons);
  ajouterLigneJournal(ajouterLog, 'erreurs', resumeGlobal.erreurs);

  ajouterLog(resumeGlobal.erreurs === 0 ? 'IMPORT GLOBAL RÉUSSI' : 'IMPORT TERMINÉ AVEC ERREURS');
}
