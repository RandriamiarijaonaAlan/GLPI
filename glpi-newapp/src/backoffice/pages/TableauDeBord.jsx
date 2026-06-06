import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supprimerAccesBackoffice } from '../../api/authApi';
import { recupererStatistiquesDashboard } from '../../api/dashboardApi';

function CarteStatistique({ libelle, valeur }) {
  return (
    <article className="stat-card">
      <strong>{valeur ?? 0}</strong>
      <span>{libelle}</span>
    </article>
  );
}

export default function TableauDeBord() {
  const navigate = useNavigate();
  const [statistiques, setStatistiques] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const cartesTickets = useMemo(() => {
    return [
      ['Total tickets', statistiques?.totalTickets],
      ['Nouveaux', statistiques?.ticketsNouveaux],
      ['En cours attribués', statistiques?.ticketsEnCoursAttribues],
      ['En cours planifiés', statistiques?.ticketsEnCoursPlanifies],
      ['En attente', statistiques?.ticketsEnAttente],
      ['Résolus', statistiques?.ticketsResolus],
      ['Clos', statistiques?.ticketsClos],
      ['Incidents', statistiques?.incidents],
      ['Demandes', statistiques?.demandes],
    ];
  }, [statistiques]);

  const cartesElements = useMemo(() => {
    return [
      ['Total éléments', statistiques?.totalElements],
      ['Ordinateurs', statistiques?.ordinateurs],
      ['Moniteurs', statistiques?.moniteurs],
      ['Imprimantes', statistiques?.imprimantes],
      ['Téléphones', statistiques?.telephones],
      ['Équipements réseau', statistiques?.equipementsReseau],
      ['Périphériques', statistiques?.peripheriques],
    ];
  }, [statistiques]);

  async function chargerDashboard() {
    setChargement(true);
    setErreur('');

    try {
      const donnees = await recupererStatistiquesDashboard();
      setStatistiques(donnees);
    } catch (erreurChargement) {
      setErreur(erreurChargement.message || 'Impossible de charger le dashboard GLPI.');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerDashboard();
  }, []);

  function gererDeconnexion() {
    supprimerAccesBackoffice();
    navigate('/admin/login');
  }

  return (
    <main className="backoffice-page">
      <div className="page-header">
        <div>
          <h1>Dashboard Backoffice</h1>
          <p>Dashboard basé sur API v1 legacy. API v2 non utilisée pour l’instant.</p>
        </div>
        <div className="button-row">
          <button type="button" onClick={chargerDashboard} disabled={chargement}>
            Actualiser
          </button>
          <button type="button" onClick={gererDeconnexion}>
            Déconnexion
          </button>
        </div>
      </div>

      {chargement ? <p>Chargement du dashboard...</p> : null}
      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      {!chargement && !erreur ? (
        <>
          <section className="metric-section">
            <h2>Tickets</h2>
            <div className="stats-grid">
              {cartesTickets.map(([libelle, valeur]) => (
                <CarteStatistique libelle={libelle} valeur={valeur} key={libelle} />
              ))}
            </div>
          </section>

          <section className="metric-section">
            <h2>Éléments</h2>
            <div className="stats-grid">
              {cartesElements.map(([libelle, valeur]) => (
                <CarteStatistique libelle={libelle} valeur={valeur} key={libelle} />
              ))}
            </div>
          </section>
        </>
      ) : null}

      <Link className="text-link" to="/admin/tickets">
        Voir tous les tickets
      </Link>
    </main>
  );
}
