import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { recupererTickets } from '../../api/ticketsApi';
import { libellesPriorite, libellesStatut, libellesType } from '../../api/dashboardApi';
import { afficherValeurGlpi } from '../../utils/affichage';

function formaterDate(valeur) {
  return valeur ? new Date(valeur).toLocaleString('fr-FR') : '-';
}

function afficherLibelleGlpi(libelles, valeur) {
  return libelles[valeur] || afficherValeurGlpi(valeur);
}

export default function ListeTickets() {
  const navigate = useNavigate();
  const [tickets, definirTickets] = useState([]);
  const [chargement, definirChargement] = useState(true);
  const [erreur, definirErreur] = useState('');

  async function chargerTickets() {
    definirChargement(true);
    definirErreur('');

    try {
      const donnees = await recupererTickets();
      definirTickets(donnees);
    } catch (erreurChargement) {
      definirErreur(erreurChargement.message);
    } finally {
      definirChargement(false);
    }
  }

  useEffect(() => {
    chargerTickets();
  }, []);

  return (
    <main className="backoffice-page">
      <div className="page-header">
        <h1>Tickets</h1>
        <button type="button" onClick={chargerTickets} disabled={chargement}>
          Actualiser
        </button>
      </div>

      {erreur ? <p className="message-erreur">{erreur}</p> : null}
      {chargement ? <p>Chargement des tickets...</p> : null}

      {!chargement && !erreur ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Titre</th>
                <th>Statut</th>
                <th>Type</th>
                <th>Priorité</th>
                <th>Date création</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>{ticket.id}</td>
                  <td>{afficherValeurGlpi(ticket.name)}</td>
                  <td>{afficherLibelleGlpi(libellesStatut, ticket.status)}</td>
                  <td>{afficherLibelleGlpi(libellesType, ticket.type)}</td>
                  <td>{afficherLibelleGlpi(libellesPriorite, ticket.priority)}</td>
                  <td>{formaterDate(ticket.date_creation || ticket.date)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                    >
                      Voir fiche
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!chargement && !erreur && tickets.length === 0 ? <p>Aucun ticket trouvé.</p> : null}
    </main>
  );
}
