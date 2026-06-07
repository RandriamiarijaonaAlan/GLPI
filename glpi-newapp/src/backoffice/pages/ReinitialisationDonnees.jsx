import { useState } from 'react';
import {
  recupererModulesDisponibles,
  reinitialiserToutesLesDonneesMetier,
} from '../../api/reinitialisationApi';

const messageConfirmation =
  'Attention : cette action supprimera toutes les données métier détectées : tickets, associations, coûts et éléments du parc. Continuer ?';

export default function ReinitialisationDonnees() {
  const [modules, definirModules] = useState([]);
  const [journal, definirJournal] = useState([]);
  const [resume, definirResume] = useState(null);
  const [chargementAnalyse, definirChargementAnalyse] = useState(false);
  const [chargementReinitialisation, definirChargementReinitialisation] = useState(false);
  const [erreur, definirErreur] = useState('');

  function ajouterLog(message) {
    definirJournal((journalCourant) => [
      ...journalCourant,
      `${new Date().toLocaleTimeString('fr-FR')} - ${message}`,
    ]);
  }

  async function analyserDonnees() {
    definirChargementAnalyse(true);
    definirErreur('');
    definirResume(null);
    definirJournal([]);
    ajouterLog('Analyse des données GLPI démarrée');

    try {
      const donnees = await recupererModulesDisponibles();
      definirModules(donnees.modules);
      ajouterLog('Analyse terminée');
      donnees.modules.forEach((module) => {
        ajouterLog(`${module.libelle} : ${module.nombre}`);
      });
    } catch (erreurAnalyse) {
      const message = `Erreur analyse : ${erreurAnalyse.message}`;
      definirErreur(message);
      ajouterLog(message);
    } finally {
      definirChargementAnalyse(false);
    }
  }

  async function reinitialiserDonnees() {
    if (!window.confirm(messageConfirmation)) {
      return;
    }

    definirChargementReinitialisation(true);
    definirErreur('');
    definirResume(null);
    ajouterLog('Réinitialisation de toutes les données métier démarrée');

    try {
      const resultat = await reinitialiserToutesLesDonneesMetier(ajouterLog);
      definirResume(resultat);
      ajouterLog('Réinitialisation terminée');

      const donnees = await recupererModulesDisponibles();
      definirModules(donnees.modules);
      ajouterLog('Modules disponibles actualisés');
    } catch (erreurReinitialisation) {
      const message = `Erreur réinitialisation : ${erreurReinitialisation.message}`;
      definirErreur(message);
      ajouterLog(message);
    } finally {
      definirChargementReinitialisation(false);
    }
  }

  return (
    <main className="backoffice-page">
      <div className="page-header">
        <div>
          <h1>Réinitialisation des données GLPI</h1>
          <p>API v1 pour les relations/coûts, API v2 pour les tickets et les assets.</p>
        </div>
        <button type="button" onClick={analyserDonnees} disabled={chargementAnalyse}>
          {chargementAnalyse ? 'Analyse en cours...' : 'Analyser les données GLPI'}
        </button>
      </div>

      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      <section className="detail-panel">
        <h2>Modules disponibles</h2>
        <div className="stats-grid">
          {modules.length === 0 ? <p>Aucune analyse lancée.</p> : null}
          {modules.map((module) => (
            <article className="stat-card" key={module.cle}>
              <span>{module.libelle}</span>
              <strong>{module.nombre}</strong>
            </article>
          ))}
        </div>
      </section>

      <div className="button-row">
        <button
          type="button"
          onClick={reinitialiserDonnees}
          disabled={chargementAnalyse || chargementReinitialisation}
        >
          {chargementReinitialisation
            ? 'Réinitialisation en cours...'
            : 'Réinitialiser toutes les données métier'}
        </button>
      </div>

      {resume ? (
        <section className="detail-panel">
          <h2>Résumé final</h2>
          <dl className="resume-reinitialisation">
            <div>
              <dt>Tickets trouvés</dt>
              <dd>{resume.ticketsTrouves}</dd>
            </div>
            <div>
              <dt>Tickets supprimés</dt>
              <dd>{resume.ticketsSupprimes}</dd>
            </div>
            <div>
              <dt>Tickets non supprimés</dt>
              <dd>{resume.ticketsNonSupprimes}</dd>
            </div>
            <div>
              <dt>Relations trouvées</dt>
              <dd>{resume.relationsTrouvees}</dd>
            </div>
            <div>
              <dt>Relations supprimées</dt>
              <dd>{resume.relationsSupprimees}</dd>
            </div>
            <div>
              <dt>Coûts trouvés</dt>
              <dd>{resume.coutsTrouves}</dd>
            </div>
            <div>
              <dt>Coûts supprimés</dt>
              <dd>{resume.coutsSupprimes}</dd>
            </div>
            <div>
              <dt>Éléments trouvés</dt>
              <dd>{resume.elementsTrouves}</dd>
            </div>
            <div>
              <dt>Éléments supprimés</dt>
              <dd>{resume.elementsSupprimes}</dd>
            </div>
            <div>
              <dt>Éléments non supprimés</dt>
              <dd>{resume.elementsNonSupprimes}</dd>
            </div>
          </dl>

          {resume.erreurs.length > 0 ? (
            <div className="erreurs-reinitialisation">
              <h2>Erreurs rencontrées</h2>
              <ul>
                {resume.erreurs.map((messageErreur) => (
                  <li key={messageErreur}>{messageErreur}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="message-succes">Réinitialisation terminée sans erreur.</p>
          )}
        </section>
      ) : null}

      <section className="detail-panel">
        <h2>Journal</h2>
        <div className="journal-reinitialisation" aria-live="polite">
          {journal.length === 0 ? <p>Aucune action enregistrée.</p> : null}
          {journal.map((message, index) => (
            <p key={`${message}-${index}`}>{message}</p>
          ))}
        </div>
      </section>
    </main>
  );
}
