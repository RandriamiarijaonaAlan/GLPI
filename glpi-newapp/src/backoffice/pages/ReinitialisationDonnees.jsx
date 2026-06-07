import { useState } from 'react';
import {
  analyserDonneesConcernees,
  reinitialiserDonneesConcernees,
} from '../../api/reinitialisationApi';

const messageConfirmation =
  'Attention : cette action supprimera les tickets concernés, leurs coûts, leurs associations, puis les éléments concernés. Continuer ?';

export default function ReinitialisationDonnees() {
  const [analyse, definirAnalyse] = useState(null);
  const [resume, definirResume] = useState(null);
  const [chargementAnalyse, definirChargementAnalyse] = useState(false);
  const [chargementReinitialisation, definirChargementReinitialisation] = useState(false);
  const [erreur, definirErreur] = useState('');

  async function analyserDonnees() {
    definirChargementAnalyse(true);
    definirErreur('');
    definirResume(null);

    try {
      const resultatAnalyse = await analyserDonneesConcernees();
      definirAnalyse(resultatAnalyse);
    } catch (erreurAnalyse) {
      definirErreur(`Impossible d'analyser les données concernées : ${erreurAnalyse.message}`);
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

    try {
      const resultatReinitialisation = await reinitialiserDonneesConcernees();
      definirResume(resultatReinitialisation);

      // Une nouvelle analyse évite d'afficher des compteurs devenus obsolètes.
      const nouvelleAnalyse = await analyserDonneesConcernees();
      definirAnalyse(nouvelleAnalyse);
    } catch (erreurReinitialisation) {
      definirErreur(
        `Impossible de finaliser la réinitialisation : ${erreurReinitialisation.message}`,
      );
    } finally {
      definirChargementReinitialisation(false);
    }
  }

  const ticketsTrouves = analyse?.ticketsTrouves?.length ?? 0;
  const elementsTrouves = analyse?.elementsTrouves?.length ?? 0;
  const aucuneDonneeTrouvee = Boolean(analyse) && ticketsTrouves === 0 && elementsTrouves === 0;

  return (
    <main className="backoffice-page">
      <div className="page-header">
        <div>
          <h1>Réinitialisation des données</h1>
          <p>
            Cette action supprime uniquement les tickets, associations, coûts et éléments
            explicitement liés à NewAPP ou aux références CSV configurées.
          </p>
        </div>
      </div>

      <section className="detail-panel">
        <div className="button-row">
          <button type="button" onClick={analyserDonnees} disabled={chargementAnalyse}>
            {chargementAnalyse ? 'Analyse en cours...' : 'Analyser les données concernées'}
          </button>
          <button
            type="button"
            onClick={reinitialiserDonnees}
            disabled={chargementReinitialisation || chargementAnalyse || aucuneDonneeTrouvee}
          >
            {chargementReinitialisation
              ? 'Réinitialisation en cours...'
              : 'Réinitialiser les données concernées'}
          </button>
        </div>

        {erreur ? <p className="message-erreur">{erreur}</p> : null}
      </section>

      {analyse ? (
        <section className="stats-grid">
          <article className="stat-card">
            <span>Tickets trouvés</span>
            <strong>{ticketsTrouves}</strong>
          </article>
          <article className="stat-card">
            <span>Éléments trouvés</span>
            <strong>{elementsTrouves}</strong>
          </article>
        </section>
      ) : null}

      {analyse?.message ? <p>{analyse.message}</p> : null}

      {analyse?.avertissements?.length > 0 ? (
        <section className="detail-panel">
          <h2>Avertissements</h2>
          <ul className="liste-avertissements">
            {analyse.avertissements.map((avertissement) => (
              <li key={avertissement}>{avertissement}</li>
            ))}
          </ul>
        </section>
      ) : null}

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
              <dt>Relations Item_Ticket supprimées</dt>
              <dd>{resume.relationsSupprimees}</dd>
            </div>
            <div>
              <dt>Coûts TicketCost supprimés</dt>
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
          </dl>

          {resume.avertissements.length > 0 ? (
            <div className="avertissements-reinitialisation">
              <h2>Avertissements</h2>
              <ul>
                {resume.avertissements.map((avertissement) => (
                  <li key={avertissement}>{avertissement}</li>
                ))}
              </ul>
            </div>
          ) : null}

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
    </main>
  );
}
