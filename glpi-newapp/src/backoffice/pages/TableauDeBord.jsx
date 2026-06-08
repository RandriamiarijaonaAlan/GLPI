import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  categoriesElements,
  libellesElements,
  recupererStatistiquesDashboard,
} from '../../api/dashboardApi';

function formaterDuree(secondes) {
  if (!secondes) return '0h 00m';
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formaterMonnaie(valeur) {
  return Number(valeur ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function KpiCard({ libelle, valeur, couleur = 'bleu', grand = false }) {
  return (
    <article className={`kpi-card kpi-card--${couleur}${grand ? ' kpi-card--grand' : ''}`}>
      <span className="kpi-card__libelle">{libelle}</span>
      <strong className="kpi-card__valeur">{valeur ?? 0}</strong>
    </article>
  );
}

function StatLigne({ libelle, valeur, couleur }) {
  return (
    <div className={`stat-ligne${couleur ? ` stat-ligne--${couleur}` : ''}`}>
      <span className="stat-ligne__point" />
      <span className="stat-ligne__libelle">{libelle}</span>
      <strong className="stat-ligne__valeur">{valeur ?? 0}</strong>
    </div>
  );
}

function BadgePriorite({ libelle, valeur, couleur }) {
  return (
    <div className={`badge-priorite badge-priorite--${couleur}`}>
      <strong>{valeur ?? 0}</strong>
      <span>{libelle}</span>
    </div>
  );
}

const COULEURS_PRIORITE = ['gris', 'vert', 'bleu', 'orange', 'rouge', 'violet'];
const CLES_PRIORITE = ['prioriteTresBasse', 'prioriteBasse', 'prioriteMoyenne', 'prioriteHaute', 'prioriteTresHaute', 'prioriteMajeure'];
const LIBELLES_PRIORITE = ['Très basse', 'Basse', 'Moyenne', 'Haute', 'Très haute', 'Majeure'];

export default function TableauDeBord() {
  const [stats, setStats] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  async function chargerDashboard() {
    setChargement(true);
    setErreur('');
    try {
      setStats(await recupererStatistiquesDashboard());
    } catch (e) {
      setErreur(e.message || 'Impossible de charger le dashboard.');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => { chargerDashboard(); }, []);

  const coutTotal = (stats?.couts?.coutTemps ?? 0) + (stats?.couts?.coutFixe ?? 0);

  return (
    <main className="backoffice-page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="button-row">
          <button type="button" onClick={chargerDashboard} disabled={chargement}>
            {chargement ? 'Chargement…' : 'Actualiser'}
          </button>
        </div>
      </div>

      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      {!chargement && !erreur && stats ? (
        <>
          {/* ── KPI principaux ── */}
          <div className="dashboard-kpi-row">
            <KpiCard libelle="Total tickets" valeur={stats.totalTickets} couleur="bleu" grand />
            <KpiCard libelle="Éléments du parc" valeur={stats.totalElements} couleur="vert" grand />
            <KpiCard
              libelle="Coût total (€)"
              valeur={formaterMonnaie(coutTotal)}
              couleur="violet"
              grand
            />
          </div>

          {/* ── Tickets ── */}
          <div className="dashboard-deux-colonnes">
            <section className="detail-panel">
              <h2>Statut des tickets</h2>
              <div className="stat-lignes">
                <StatLigne libelle="Nouveaux" valeur={stats.ticketsNouveaux} couleur="bleu" />
                <StatLigne libelle="En cours attribués" valeur={stats.ticketsEnCoursAttribues} couleur="orange" />
                <StatLigne libelle="En cours planifiés" valeur={stats.ticketsEnCoursPlanifies} couleur="orange" />
                <StatLigne libelle="En attente" valeur={stats.ticketsEnAttente} couleur="jaune" />
                <StatLigne libelle="Résolus" valeur={stats.ticketsResolus} couleur="vert" />
                <StatLigne libelle="Clos" valeur={stats.ticketsClos} couleur="gris" />
              </div>
            </section>

            <section className="detail-panel">
              <h2>Type</h2>
              <div className="stat-lignes" style={{ marginBottom: 20 }}>
                <StatLigne libelle="Incidents" valeur={stats.incidents} couleur="rouge" />
                <StatLigne libelle="Demandes" valeur={stats.demandes} couleur="violet" />
              </div>
              <h2>Priorité</h2>
              <div className="badges-priorite">
                {CLES_PRIORITE.map((cle, i) => (
                  <BadgePriorite
                    key={cle}
                    libelle={LIBELLES_PRIORITE[i]}
                    valeur={stats[cle]}
                    couleur={COULEURS_PRIORITE[i]}
                  />
                ))}
              </div>
            </section>
          </div>

          {/* ── Coûts tickets ── */}
          <section className="detail-panel">
            <h2>Coûts tickets ({stats.couts?.nombreCouts ?? 0} entrées)</h2>
            <div className="dashboard-kpi-row dashboard-kpi-row--petit" style={{ marginTop: 14 }}>
              <KpiCard
                libelle="Durée totale"
                valeur={formaterDuree(stats.couts?.dureeSecondes)}
                couleur="bleu"
              />
              <KpiCard
                libelle="Coût temps (€)"
                valeur={formaterMonnaie(stats.couts?.coutTemps)}
                couleur="orange"
              />
              <KpiCard
                libelle="Coût fixe (€)"
                valeur={formaterMonnaie(stats.couts?.coutFixe)}
                couleur="violet"
              />
              <KpiCard
                libelle="Coût total (€)"
                valeur={formaterMonnaie(coutTotal)}
                couleur="vert"
              />
            </div>
          </section>

          {/* ── Éléments du parc ── */}
          <section className="detail-panel">
            <h2>Éléments du parc — <strong style={{ color: '#2f6fed' }}>{stats.totalElements}</strong> total</h2>
            <div style={{ display: 'grid', gap: 20, marginTop: 16 }}>
              {categoriesElements.map(({ libelle, types }) => {
                const total = types.reduce((s, t) => s + (stats.elements?.[t] ?? 0), 0);
                if (total === 0) return null;
                return (
                  <div key={libelle}>
                    <p className="categorie-elements-titre">{libelle} <span>({total})</span></p>
                    <div className="stats-grid">
                      {types.map((itemtype) => {
                        const n = stats.elements?.[itemtype] ?? 0;
                        if (n === 0) return null;
                        return (
                          <article key={itemtype} className="stat-card">
                            <strong>{n}</strong>
                            <span>{libellesElements[itemtype] || itemtype}</span>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      <Link className="text-link" to="/admin/tickets">Voir tous les tickets →</Link>
    </main>
  );
}
