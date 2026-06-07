import { useState } from 'react';
import { lireFichierCsv, convertirCsvEnJson, detecterTypeCsv } from '../../utils/csv';
import {
  ajouterResumeFinalImport,
  importerElementsCsv,
  importerTicketsCsv,
  importerCoutsCsv,
} from '../../api/importApi';
import { importerImagesZip } from '../../api/importImagesApi';

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

const LIBELLES_ETATS_IMPORT = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  reussi: 'Réussi',
  ignore: 'Ignoré',
  erreur: 'Erreur',
};

function creerCarteImport() {
  return {
    statut: 'en_attente',
    reussi: 0,
    total: 0,
    erreurs: 0,
  };
}

function creerEtatImportInitial() {
  return {
    elements: creerCarteImport(),
    tickets: creerCarteImport(),
    couts: creerCarteImport(),
    images: creerCarteImport(),
  };
}

function obtenirLibelleStatutImport(statut) {
  return LIBELLES_ETATS_IMPORT[statut] || LIBELLES_ETATS_IMPORT.en_attente;
}

function obtenirCouleurStatutImport(statut) {
  if (statut === 'reussi') return '#166534';
  if (statut === 'en_cours') return '#1d4ed8';
  if (statut === 'ignore') return '#92400e';
  if (statut === 'erreur') return '#b42318';
  return '#475467';
}

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
  const [progressionGlobale, definirProgressionGlobale] = useState(0);
  const [etatImport, definirEtatImport] = useState(creerEtatImportInitial());
  const [enImport, definirEnImport] = useState(false);

  // État ZIP images
  const [fichierZip, definirFichierZip] = useState(null);
  const [resumeImages, definirResumeImages] = useState(null);

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
    // Réinitialiser les résultats dès qu'un fichier change
    definirAnalyses([]);
    definirResume(null);
    definirResumeImages(null);
    definirProgressionGlobale(0);
    definirEtatImport(creerEtatImportInitial());
  }

  async function analyserFichiersSelectionnes() {
    const fichiersSelectionnes = fichiersCsv.filter(Boolean);

    if (fichiersSelectionnes.length === 0) {
      ajouterLog('Aucun fichier CSV sélectionné');
      return [];
    }

    const resultatsAnalyse = [];
    ajouterLog('Analyse CSV démarrée');

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
    ajouterLog(`Analyse CSV terminée — ${resultatsAnalyse.length} fichier(s) reconnu(s)`);
    return resultatsAnalyse;
  }

  async function importerToutesLesDonnees() {
    definirEnImport(true);
    definirAnalyses([]);
    definirJournal([]);
    definirResume(null);
    definirResumeImages(null);
    definirProgressionGlobale(0);
    definirEtatImport(creerEtatImportInitial());

    const fichiersSelectionnes = fichiersCsv.filter(Boolean);

    if (fichiersSelectionnes.length === 0 && !fichierZip) {
      ajouterLog('Aucun fichier CSV ni ZIP sélectionné');
      definirEnImport(false);
      return;
    }

    ajouterLog('Import global démarré');
    const resultatsAnalyse = await analyserFichiersSelectionnes();
    definirProgressionGlobale(25);

    const fichiersElements = resultatsAnalyse.filter((analyse) => analyse.type === 'ASSET');
    const fichiersTickets = resultatsAnalyse.filter((analyse) => analyse.type === 'TICKET');
    const fichiersCouts = resultatsAnalyse.filter((analyse) => analyse.type === 'COUT');
    const fichiersImages = fichierZip ? [fichierZip] : [];

    definirEtatImport({
      elements: {
        statut: fichiersElements.length === 0 ? 'ignore' : 'en_attente',
        reussi: 0,
        total: fichiersElements.length,
        erreurs: 0,
      },
      tickets: {
        statut: fichiersTickets.length === 0 ? 'ignore' : 'en_attente',
        reussi: 0,
        total: fichiersTickets.length,
        erreurs: 0,
      },
      couts: {
        statut: fichiersCouts.length === 0 ? 'ignore' : 'en_attente',
        reussi: 0,
        total: fichiersCouts.length,
        erreurs: 0,
      },
      images: {
        statut: fichiersImages.length === 0 ? 'ignore' : 'en_attente',
        reussi: 0,
        total: fichiersImages.length,
        erreurs: 0,
      },
    });

    const resumeGlobal = {
      fichiersAnalyses: resultatsAnalyse.length,
      fichiersIgnores: fichiersSelectionnes.length - resultatsAnalyse.length,
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
      fichiersAnalyses: resultatsAnalyse.length,
      fichiersImportes: 0,
      elementsImportes: 0,
      ticketsImportes: 0,
      associationsCreees: 0,
      coutsImportes: 0,
      doublons: 0,
      erreurs: 0,
    };
    const resumesFichiers = [];

    async function traiterFichiersCsv(cle, fichiers, importer, libelleCategorie) {
      if (fichiers.length === 0) {
        definirEtatImport((precedent) => ({
          ...precedent,
          [cle]: {
            ...precedent[cle],
            statut: 'ignore',
            total: 0,
          },
        }));
        return { totalTraitables: 0, importes: 0, erreurs: 0 };
      }

      definirEtatImport((precedent) => ({
        ...precedent,
        [cle]: {
          ...precedent[cle],
          statut: 'en_cours',
          total: fichiers.length,
        },
      }));

      ajouterLog(`Import ${libelleCategorie.toLowerCase()} démarré`);

      let reussis = 0;
      let erreurs = 0;
      let importes = 0;
      let totalTraitables = 0;

      for (let index = 0; index < fichiers.length; index++) {
        const analyse = fichiers[index];
        const { fichier, type, donnees } = analyse;
        resumeGlobal.lignesAnalysees += donnees.length;
        totalTraitables += donnees.length;

        const resumeFichier = {
          libelle: `CSV ${resumesFichiers.length + 1} - ${libelleCategorie}`,
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
          const res = await importer(donnees, ajouterLog);
          resumeFichier.importe = res.erreurs === 0;
          resumeFichier.erreurs = res.erreurs;

          if (cle === 'elements') {
            resumeFichier.elementsImportes = res.importes;
            resumeFichier.doublons = res.doublons;
            resumeGlobal.elementsImportes += res.importes;
            resumeGlobal.doublons += res.doublons;
            resumeGlobal.lignesImportees += res.importes;
            resumeGlobal.lignesIgnorees += res.doublons + res.erreurs;
          } else if (cle === 'tickets') {
            resumeFichier.ticketsImportes = res.importes;
            resumeFichier.associationsCreees = res.associations;
            resumeFichier.doublons = res.doublons;
            resumeGlobal.ticketsImportes += res.importes;
            resumeGlobal.doublons += res.doublons;
            resumeGlobal.associationsCreees += res.associations;
            resumeGlobal.lignesImportees += res.importes;
            resumeGlobal.lignesIgnorees += res.doublons + res.erreurs;
          } else if (cle === 'couts') {
            resumeFichier.coutsImportes = res.importes;
            resumeGlobal.coutsImportes += res.importes;
            resumeGlobal.lignesImportees += res.importes;
            resumeGlobal.lignesIgnorees += res.erreurs;
          }

          resumeGlobal.avertissements.push(...res.avertissements);

          if (res.erreurs > 0) {
            erreurs += 1;
          } else {
            reussis += 1;
          }

          importes += res.importes || 0;
        } catch (erreurNonGeree) {
          const message = `Erreur non gérée pour "${fichier.name}" : ${erreurNonGeree.message}`;
          ajouterLog(message);
          resumeGlobal.erreurs.push(message);
          resumeFichier.erreurs += 1;
          erreurs += 1;
        }

        resumeJournal.fichiersImportes += 1;
        resumeJournal.elementsImportes += resumeFichier.elementsImportes;
        resumeJournal.ticketsImportes += resumeFichier.ticketsImportes;
        resumeJournal.associationsCreees += resumeFichier.associationsCreees;
        resumeJournal.coutsImportes += resumeFichier.coutsImportes;
        resumeJournal.doublons += resumeFichier.doublons;
        resumeJournal.erreurs += resumeFichier.erreurs;
        resumesFichiers.push(resumeFichier);

        definirEtatImport((precedent) => ({
          ...precedent,
          [cle]: {
            ...precedent[cle],
            reussi: reussis,
            erreurs,
            statut: erreurs > 0 ? 'erreur' : 'en_cours',
          },
        }));

        ajouterLog(`Import terminé : "${fichier.name}"`);
      }

      definirEtatImport((precedent) => ({
        ...precedent,
        [cle]: {
          ...precedent[cle],
          reussi: reussis,
          erreurs,
          statut: erreurs > 0 ? 'erreur' : 'reussi',
        },
      }));

      ajouterLog(`Import ${libelleCategorie.toLowerCase()} terminé : réussi ${importes} / ${totalTraitables}, erreurs ${erreurs}`);
      return { totalTraitables, importes, erreurs };
    }

    const resumeElements = await traiterFichiersCsv('elements', fichiersElements, importerElementsCsv, 'Éléments');
    definirProgressionGlobale(50);

    const resumeTickets = await traiterFichiersCsv('tickets', fichiersTickets, importerTicketsCsv, 'Tickets');
    definirProgressionGlobale(70);

    const resumeCouts = await traiterFichiersCsv('couts', fichiersCouts, importerCoutsCsv, 'Coûts');
    definirProgressionGlobale(90);

    let resumeImagesImport = { totalTraitables: 0, importes: 0, erreurs: 0 };
    if (fichierZip) {
      ajouterLog('Import images démarré');
      ajouterLog(`Import ZIP démarré : "${fichierZip.name}"`);
      definirEtatImport((precedent) => ({
        ...precedent,
        images: {
          ...precedent.images,
          statut: 'en_cours',
          total: 1,
        },
      }));
      const resultatImages = await importerImagesZip(fichierZip, ajouterLog);
      definirResumeImages(resultatImages);
      resumeImagesImport = {
        totalTraitables: resultatImages.imagesDetectees || 0,
        importes: resultatImages.imagesImportees || 0,
        erreurs: resultatImages.erreursImages || 0,
      };
      definirEtatImport((precedent) => ({
        ...precedent,
        images: {
          ...precedent.images,
          reussi: resultatImages.imagesImportees > 0 ? 1 : 0,
          erreurs: resultatImages.erreursImages,
          statut:
            resultatImages.erreursImages > 0
              ? 'erreur'
              : resultatImages.imagesImportees > 0
                ? 'reussi'
                : 'ignore',
        },
      }));
      ajouterLog(
        `Import images terminé : réussi ${resumeImagesImport.importes} / ${resumeImagesImport.totalTraitables}, erreurs ${resumeImagesImport.erreurs}`
      );
    } else {
      definirResumeImages(null);
      definirEtatImport((precedent) => ({
        ...precedent,
        images: {
          ...precedent.images,
          statut: 'ignore',
          reussi: 0,
          erreurs: 0,
          total: 0,
        },
      }));
      ajouterLog('Import images terminé : réussi 0 / 0, erreurs 0');
    }

    definirProgressionGlobale(90);

    ajouterResumeFinalImport(ajouterLog, resumeJournal, resumesFichiers);
    definirResume(resumeGlobal);
    definirProgressionGlobale(100);
    definirEtatImport((precedent) => ({
      ...precedent,
      elements: {
        ...precedent.elements,
        statut:
          precedent.elements.total === 0
            ? 'ignore'
            : precedent.elements.erreurs > 0
              ? 'erreur'
              : 'reussi',
      },
      tickets: {
        ...precedent.tickets,
        statut:
          precedent.tickets.total === 0
            ? 'ignore'
            : precedent.tickets.erreurs > 0
              ? 'erreur'
              : 'reussi',
      },
      couts: {
        ...precedent.couts,
        statut:
          precedent.couts.total === 0
            ? 'ignore'
            : precedent.couts.erreurs > 0
              ? 'erreur'
              : 'reussi',
      },
      images: {
        ...precedent.images,
        statut:
          precedent.images.total === 0
            ? 'ignore'
            : precedent.images.erreurs > 0
              ? 'erreur'
              : precedent.images.reussi > 0
                ? 'reussi'
                : 'ignore',
      },
    }));
    ajouterLog('Import global terminé');
    ajouterLog(
      `Résultat final : Réussi : ${resumeGlobal.elementsImportes + resumeGlobal.ticketsImportes + resumeGlobal.coutsImportes + resumeImagesImport.importes} / ${resumeElements.totalTraitables + resumeTickets.totalTraitables + resumeCouts.totalTraitables + resumeImagesImport.totalTraitables}, Erreur : ${resumeGlobal.erreurs.length + resumeImagesImport.erreurs}`
    );
    ajouterLog(`fichiers ignorés : ${resumeGlobal.fichiersIgnores}`);
    ajouterLog(`doublons ignorés : ${resumeGlobal.doublons}`);
    ajouterLog(`avertissements : ${resumeGlobal.avertissements.length + (resumeImages?.avertissementsImages?.length || 0)}`);

    if (resumeGlobal.erreurs.length + resumeImagesImport.erreurs === 0) {
      ajouterLog('IMPORT GLOBAL RÉUSSI');
    } else {
      ajouterLog('IMPORT TERMINÉ AVEC ERREURS');
    }
    definirEnImport(false);
  }

  // ─── GESTION ZIP IMAGES ────────────────────────────────────────────────────

  function selectionnerZip(fichier) {
    definirFichierZip(fichier || null);
    definirResumeImages(null);
    definirEtatImport(creerEtatImportInitial());
  }

  const peutImporterToutesLesDonnees = !enImport && (fichiersCsv.some(Boolean) || Boolean(fichierZip));

  return (
    <main className="backoffice-page">
      <div className="page-header">
        <div>
          <h1>Import fichiers CSV et ZIP</h1>
          <p>Sélectionnez les fichiers CSV, le ZIP images, puis lancez un import unique.</p>
          <p style={{ marginTop: '8px', fontWeight: 700 }}>
            Progression globale : {progressionGlobale}%
          </p>
          <div
            style={{
              marginTop: '10px',
              width: '100%',
              maxWidth: '420px',
              height: '10px',
              borderRadius: '999px',
              background: '#e7ebf2',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressionGlobale}%`,
                height: '100%',
                borderRadius: '999px',
                background: 'linear-gradient(90deg, #2f6fed 0%, #19a974 100%)',
                transition: 'width 180ms ease',
              }}
            />
          </div>
        </div>
      </div>

      <section className="detail-panel">
        <h2>Suivi d'import</h2>
        <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: '16px' }}>
          {[
            ['elements', 'Éléments'],
            ['tickets', 'Tickets'],
            ['couts', 'Coûts'],
            ['images', 'Images'],
          ].map(([cle, libelle]) => {
            const carte = etatImport[cle];
            return (
              <article
                key={cle}
                style={{
                  border: '1px solid #d8deea',
                  borderRadius: '10px',
                  padding: '14px',
                  background: '#f8fafc',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1rem' }}>{libelle}</h3>
                <p style={{ margin: '10px 0 0', fontWeight: 700, color: obtenirCouleurStatutImport(carte.statut) }}>
                  Statut : {obtenirLibelleStatutImport(carte.statut)}
                </p>
                <p style={{ margin: '6px 0 0' }}>
                  Réussi : {carte.reussi} / {carte.total}
                </p>
                <p style={{ margin: '6px 0 0' }}>
                  Erreurs : {carte.erreurs}
                </p>
              </article>
            );
          })}
        </div>
      </section>

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
                disabled={enImport}
              />
            </label>
          ))}
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

        </section>
      ) : null}

      {/* ─── SECTION IMPORT IMAGES ZIP ─────────────────────────────────── */}
      <section className="detail-panel">
        <h2>Import images ZIP</h2>
        <p style={{ margin: '8px 0 0', color: '#5e6a7d' }}>
          Les images doivent être nommées comme les éléments GLPI (ex : PC-ADM-001.png).
          Formats acceptés : jpg, jpeg, png, webp.
        </p>

        <div style={{ display: 'grid', gap: '14px', marginTop: '16px' }}>
          <label style={{ display: 'grid', gap: '6px', fontWeight: 700 }}>
            Fichier ZIP
            <input
              type="file"
              accept=".zip,application/zip"
              style={{ fontWeight: 'normal', minHeight: 'auto', padding: '6px 0' }}
              onChange={(e) => selectionnerZip(e.target.files[0])}
              disabled={enImport}
            />
          </label>
        </div>
      </section>

      <div className="button-row" style={{ marginTop: '20px' }}>
        <button type="button" onClick={importerToutesLesDonnees} disabled={!peutImporterToutesLesDonnees}>
          {enImport ? 'Import en cours...' : 'Importer toutes les données'}
        </button>
      </div>

      {/* ─── RÉSUMÉ IMAGES ─────────────────────────────────────────────── */}
      {resumeImages ? (
        <section className="detail-panel">
          <h2>Résumé images</h2>
          <dl className="resume-reinitialisation" style={{ marginTop: '16px' }}>
            <div>
              <dt>Images détectées</dt>
              <dd>{resumeImages.imagesDetectees}</dd>
            </div>
            <div>
              <dt>Images associées</dt>
              <dd>{resumeImages.imagesAssociees}</dd>
            </div>
            <div>
              <dt>Images importées</dt>
              <dd>{resumeImages.imagesImportees}</dd>
            </div>
            <div>
              <dt>Documents liés</dt>
              <dd>{resumeImages.documentsLies}</dd>
            </div>
            <div>
              <dt>Images ignorées</dt>
              <dd>{resumeImages.imagesIgnorees}</dd>
            </div>
            <div>
              <dt>Fichiers système ignorés</dt>
              <dd>{resumeImages.fichiersSystemeIgnores}</dd>
            </div>
            <div>
              <dt>Erreurs</dt>
              <dd>{resumeImages.erreursImages}</dd>
            </div>
          </dl>

          {resumeImages.imagesImportees > 0 ? (
            <div
              style={{
                marginTop: '14px',
                padding: '12px',
                border: '1px solid #d8deea',
                borderRadius: '6px',
                background: '#f0fdf4',
                color: '#166534',
                fontSize: '0.9rem',
              }}
            >
              Les images importées sont visibles dans GLPI :<br />
              — <strong>Gestion → Documents</strong><br />
              — ou dans la <strong>fiche de l'élément concerné → onglet Documents</strong>
            </div>
          ) : null}

          {resumeImages.avertissementsImages.length > 0 ? (
            <div className="avertissements-reinitialisation">
              <h2>Avertissements ({resumeImages.avertissementsImages.length})</h2>
              <ul className="liste-avertissements">
                {resumeImages.avertissementsImages.map((avert, i) => (
                  <li key={i}>{avert}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {resumeImages.avertissementsImages.length === 0 && resumeImages.erreursImages === 0 ? (
            <p className="message-succes" style={{ marginTop: '16px' }}>
              Import images terminé sans avertissement ni erreur.
            </p>
          ) : null}
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
          <div
            style={{
              marginTop: '16px',
              padding: '14px',
              border: '1px solid #d8deea',
              borderRadius: '8px',
              background: '#f8fafc',
            }}
          >
            <p style={{ margin: 0, fontWeight: 700 }}>
              Résultat final :
            </p>
            <p style={{ margin: '8px 0 0' }}>
              - Réussi : {resume.elementsImportes + resume.ticketsImportes + resume.coutsImportes + (resumeImages?.imagesImportees || 0)} / {resume.lignesAnalysees + (resumeImages?.imagesDetectees || 0)}
            </p>
            <p style={{ margin: '6px 0 0' }}>
              - Erreur : {resume.erreurs.length + (resumeImages?.erreursImages || 0)}
            </p>
            <p style={{ margin: '6px 0 0' }}>
              - fichiers ignorés : {resume.fichiersIgnores}
            </p>
            <p style={{ margin: '6px 0 0' }}>
              - doublons ignorés : {resume.doublons}
            </p>
            <p style={{ margin: '6px 0 0' }}>
              - avertissements : {resume.avertissements.length + (resumeImages?.avertissementsImages?.length || 0)}
            </p>
            <p
              className="message-succes"
              style={{ marginTop: '12px', fontWeight: 700 }}
            >
              {resume.erreurs.length + (resumeImages?.erreursImages || 0) === 0
                ? 'IMPORT GLOBAL RÉUSSI'
                : 'IMPORT TERMINÉ AVEC ERREURS'}
            </p>
          </div>

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
