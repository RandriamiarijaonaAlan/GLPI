import { useState } from 'react';
import { lireFichierCsv, convertirCsvEnJson, detecterTypeCsv } from '../../utils/csv';
import {
  ajouterResumeFinalImport,
  importerElementsCsv,
  importerTicketsCsv,
  importerCoutsCsv,
} from '../../api/importApi';

const NB_EMPLACEMENTS_FICHIERS = 3;

const LIBELLES_TYPES = {
  ASSET: 'Éléments (ASSET)',
  TICKET: 'Tickets (TICKET)',
  COUT: 'Coûts (COUT)',
  INCONNU: 'Type inconnu',
};

const COULEURS_BADGES_TYPES = {
  ASSET: '#087443',
  TICKET: '#1d4ed8',
  COUT: '#92400e',
  INCONNU: '#b42318',
};

// Détermine la couleur d'une entrée du journal selon son contenu
function couleurLigneJournal(message) {
  if (message.toLowerCase().includes('erreur')) return '#fca5a5';
  if (
    message.toLowerCase().includes('doublon') ||
    message.toLowerCase().includes('ignoré') ||
    message.toLowerCase().includes('introuvable') ||
    message.toLowerCase().includes('avertissement')
  ) {
    return '#fde68a';
  }
  return '#dbeafe';
}

export default function ImporterFichiers() {
  const [fichiersCsv, definirFichiersCsv] = useState(
    Array(NB_EMPLACEMENTS_FICHIERS).fill(null)
  );
  const [analyses, definirAnalyses] = useState([]);
  const [journal, definirJournal] = useState([]);
  const [resume, definirResume] = useState(null);
  const [enAnalyse, definirEnAnalyse] = useState(false);
  const [enImport, definirEnImport] = useState(false);

  function ajouterLog(message) {
    definirJournal((precedent) => [
      ...precedent,
      `${new Date().toLocaleTimeString('fr-FR')} - ${message}`,
    ]);
  }

  function selectionnerFichier(index, fichier) {
    definirFichiersCsv((precedent) => {
      const copie = [...precedent];
      copie[index] = fichier || null;
      return copie;
    });
    // Réinitialiser l'analyse et le résumé dès qu'un fichier change
    definirAnalyses([]);
    definirResume(null);
  }

  async function analyserFichiers() {
    definirEnAnalyse(true);
    definirAnalyses([]);
    definirJournal([]);
    definirResume(null);
    ajouterLog('Analyse démarrée');

    const fichiersSelectionnes = fichiersCsv.filter(Boolean);

    if (fichiersSelectionnes.length === 0) {
      ajouterLog('Aucun fichier sélectionné');
      definirEnAnalyse(false);
      return;
    }

    const resultatsAnalyse = [];

    for (let i = 0; i < fichiersCsv.length; i++) {
      const fichier = fichiersCsv[i];
      if (!fichier) continue;

      try {
        const texteCsv = await lireFichierCsv(fichier);

        if (!texteCsv.trim()) {
          ajouterLog(`Le fichier "${fichier.name}" est vide et a été ignoré.`);
          continue;
        }

        const donnees = convertirCsvEnJson(texteCsv);

        if (donnees.length === 0) {
          ajouterLog(`Le fichier "${fichier.name}" ne contient aucune donnée valide.`);
          continue;
        }

        const type = detecterTypeCsv(donnees);
        ajouterLog(`Type détecté : ${type} — ${donnees.length} ligne(s) dans "${fichier.name}"`);

        if (type === 'INCONNU') {
          ajouterLog(`Fichier "${fichier.name}" ignoré : type de données non reconnu.`);
          continue;
        }

        resultatsAnalyse.push({ fichier, type, donnees });
      } catch (erreurLecture) {
        ajouterLog(`Erreur lecture "${fichier.name}" : ${erreurLecture.message}`);
      }
    }

    definirAnalyses(resultatsAnalyse);
    ajouterLog(`Analyse terminée — ${resultatsAnalyse.length} fichier(s) reconnu(s)`);
    definirEnAnalyse(false);
  }

  async function importerDonnees() {
    if (analyses.length === 0) return;

    definirEnImport(true);
    definirResume(null);

    const resumeGlobal = {
      fichiersAnalyses: analyses.length,
      fichiersIgnores: fichiersCsv.filter(Boolean).length - analyses.length,
      lignesAnalysees: 0,
      lignesImportees: 0,
      elementsImportes: 0,
      ticketsImportes: 0,
      coutsImportes: 0,
      associationsCreees: 0,
      doublons: 0,
      lignesIgnorees: 0,
      avertissements: [],
      erreurs: [],
    };
    const resumeJournal = {
      fichiersAnalyses: analyses.length,
      fichiersImportes: 0,
      elementsImportes: 0,
      ticketsImportes: 0,
      associationsCreees: 0,
      coutsImportes: 0,
      doublons: 0,
      erreurs: 0,
    };
    const resumesFichiers = [];

    for (let index = 0; index < analyses.length; index++) {
      const analyse = analyses[index];
      const { fichier, type, donnees } = analyse;
      resumeGlobal.lignesAnalysees += donnees.length;

      const resumeFichier = {
        libelle: `CSV ${index + 1} - ${
          type === 'ASSET' ? 'Éléments' : type === 'TICKET' ? 'Tickets' : 'Coûts'
        }`,
        type,
        analyse: true,
        importe: false,
        lignesAnalysees: donnees.length,
        elementsImportes: 0,
        ticketsImportes: 0,
        associationsCreees: 0,
        coutsImportes: 0,
        doublons: 0,
        erreurs: 0,
      };

      ajouterLog(`Import démarré : "${fichier.name}" (${type}, ${donnees.length} lignes)`);

      try {
        if (type === 'ASSET') {
          const res = await importerElementsCsv(donnees, ajouterLog);
          resumeFichier.importe = true;
          resumeFichier.elementsImportes = res.importes;
          resumeFichier.doublons = res.doublons;
          resumeFichier.erreurs = res.erreurs;
          resumeGlobal.elementsImportes += res.importes;
          resumeGlobal.doublons += res.doublons;
          resumeGlobal.lignesImportees += res.importes;
          resumeGlobal.lignesIgnorees += res.doublons + res.erreurs;
          resumeGlobal.avertissements.push(...res.avertissements);
        } else if (type === 'TICKET') {
          const res = await importerTicketsCsv(donnees, ajouterLog);
          resumeFichier.importe = true;
          resumeFichier.ticketsImportes = res.importes;
          resumeFichier.associationsCreees = res.associations;
          resumeFichier.doublons = res.doublons;
          resumeFichier.erreurs = res.erreurs;
          resumeGlobal.ticketsImportes += res.importes;
          resumeGlobal.doublons += res.doublons;
          resumeGlobal.associationsCreees += res.associations;
          resumeGlobal.lignesImportees += res.importes;
          resumeGlobal.lignesIgnorees += res.doublons + res.erreurs;
          resumeGlobal.avertissements.push(...res.avertissements);
        } else if (type === 'COUT') {
          const res = await importerCoutsCsv(donnees, ajouterLog);
          resumeFichier.importe = true;
          resumeFichier.coutsImportes = res.importes;
          resumeFichier.erreurs = res.erreurs;
          resumeGlobal.coutsImportes += res.importes;
          resumeGlobal.lignesImportees += res.importes;
          resumeGlobal.lignesIgnorees += res.erreurs;
          resumeGlobal.avertissements.push(...res.avertissements);
        }
      } catch (erreurNonGeree) {
        const message = `Erreur non gérée pour "${fichier.name}" : ${erreurNonGeree.message}`;
        ajouterLog(message);
        resumeGlobal.erreurs.push(message);
        resumeFichier.erreurs += 1;
      }

      resumeJournal.fichiersImportes += resumeFichier.importe ? 1 : 0;
      resumeJournal.elementsImportes += resumeFichier.elementsImportes;
      resumeJournal.ticketsImportes += resumeFichier.ticketsImportes;
      resumeJournal.associationsCreees += resumeFichier.associationsCreees;
      resumeJournal.coutsImportes += resumeFichier.coutsImportes;
      resumeJournal.doublons += resumeFichier.doublons;
      resumeJournal.erreurs += resumeFichier.erreurs;
      resumesFichiers.push(resumeFichier);

      ajouterLog(`Import terminé : "${fichier.name}"`);
    }

    ajouterResumeFinalImport(ajouterLog, resumeJournal, resumesFichiers);
    definirResume(resumeGlobal);
    definirEnImport(false);
  }

  const peutImporter = analyses.length > 0 && !enImport && !enAnalyse;

  return (
    <main className="backoffice-page">
      <div className="page-header">
        <div>
          <h1>Import fichiers CSV</h1>
          <p>Sélectionnez jusqu'à 3 fichiers CSV (ASSET, TICKET ou COUT) puis analysez-les.</p>
        </div>
      </div>

      {/* Sélection des fichiers */}
      <section className="detail-panel">
        <h2>Sélection des fichiers</h2>
        <div style={{ display: 'grid', gap: '14px', marginTop: '16px' }}>
          {Array.from({ length: NB_EMPLACEMENTS_FICHIERS }, (_, index) => (
            <label key={index} style={{ display: 'grid', gap: '6px', fontWeight: 700 }}>
              Fichier {index + 1}
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ fontWeight: 'normal', minHeight: 'auto', padding: '6px 0' }}
                onChange={(e) => selectionnerFichier(index, e.target.files[0])}
                disabled={enAnalyse || enImport}
              />
            </label>
          ))}
        </div>
        <div className="button-row" style={{ marginTop: '20px' }}>
          <button type="button" onClick={analyserFichiers} disabled={enAnalyse || enImport}>
            {enAnalyse ? 'Analyse en cours...' : 'Analyser les fichiers'}
          </button>
        </div>
      </section>

      {/* Aperçu des données analysées */}
      {analyses.length > 0 ? (
        <section className="detail-panel">
          <h2>Aperçu des données</h2>
          <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
            {analyses.map((analyse, index) => (
              <div
                key={index}
                style={{
                  border: '1px solid #e7ebf2',
                  borderRadius: '8px',
                  padding: '14px',
                  background: '#f8fafc',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '12px',
                  }}
                >
                  <strong>{analyse.fichier.name}</strong>
                  <span
                    style={{
                      padding: '2px 10px',
                      borderRadius: '99px',
                      background: COULEURS_BADGES_TYPES[analyse.type],
                      color: '#fff',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                    }}
                  >
                    {LIBELLES_TYPES[analyse.type]}
                  </span>
                  <span style={{ color: '#5e6a7d', fontSize: '0.9rem' }}>
                    {analyse.donnees.length} ligne(s)
                  </span>
                </div>

                {/* Aperçu des 3 premières lignes du fichier */}
                <div className="table-wrap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(analyse.donnees[0] || {}).map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analyse.donnees.slice(0, 3).map((ligne, i) => (
                        <tr key={i}>
                          {Object.values(ligne).map((valeur, j) => (
                            <td key={j}>{valeur}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className="button-row" style={{ marginTop: '20px' }}>
            <button type="button" onClick={importerDonnees} disabled={!peutImporter}>
              {enImport ? 'Import en cours...' : 'Importer dans GLPI'}
            </button>
          </div>
        </section>
      ) : null}

      {/* Journal d'import */}
      <section className="detail-panel">
        <h2>Journal d'import</h2>
        <div
          className="journal-reinitialisation"
          aria-live="polite"
          style={{ marginTop: '12px' }}
        >
          {journal.length === 0 ? <p>Aucune action enregistrée.</p> : null}
          {journal.map((message, index) => (
            <p
              key={`${index}-${message}`}
              style={{ color: couleurLigneJournal(message) }}
            >
              {message}
            </p>
          ))}
        </div>
      </section>

      {/* Résumé final */}
      {resume ? (
        <section className="detail-panel">
          <h2>Résumé final</h2>
          <dl className="resume-reinitialisation" style={{ marginTop: '16px' }}>
            <div>
              <dt>Fichiers analysés</dt>
              <dd>{resume.fichiersAnalyses}</dd>
            </div>
            <div>
              <dt>Fichiers ignorés</dt>
              <dd>{resume.fichiersIgnores}</dd>
            </div>
            <div>
              <dt>Lignes analysées</dt>
              <dd>{resume.lignesAnalysees}</dd>
            </div>
            <div>
              <dt>Lignes importées</dt>
              <dd>{resume.lignesImportees}</dd>
            </div>
            <div>
              <dt>Éléments importés</dt>
              <dd>{resume.elementsImportes}</dd>
            </div>
            <div>
              <dt>Tickets importés</dt>
              <dd>{resume.ticketsImportes}</dd>
            </div>
            <div>
              <dt>Coûts importés</dt>
              <dd>{resume.coutsImportes}</dd>
            </div>
            <div>
              <dt>Associations créées</dt>
              <dd>{resume.associationsCreees}</dd>
            </div>
            <div>
              <dt>Doublons ignorés</dt>
              <dd>{resume.doublons}</dd>
            </div>
            <div>
              <dt>Lignes ignorées</dt>
              <dd>{resume.lignesIgnorees}</dd>
            </div>
          </dl>

          {resume.avertissements.length > 0 ? (
            <div className="avertissements-reinitialisation">
              <h2>Avertissements ({resume.avertissements.length})</h2>
              <ul className="liste-avertissements">
                {resume.avertissements.map((avert, i) => (
                  <li key={i}>{avert}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {resume.erreurs.length > 0 ? (
            <div className="erreurs-reinitialisation">
              <h2>Erreurs ({resume.erreurs.length})</h2>
              <ul>
                {resume.erreurs.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {resume.avertissements.length === 0 && resume.erreurs.length === 0 ? (
            <p className="message-succes" style={{ marginTop: '16px' }}>
              Import terminé sans avertissement ni erreur.
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
