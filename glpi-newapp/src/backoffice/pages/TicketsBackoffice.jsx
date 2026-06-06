import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { recupererTickets } from '../../api/ticketsApi';
import { libellesPriorite, libellesStatut, libellesType } from '../../api/dashboardApi';

function formatDate(value) {
  return value ? new Date(value).toLocaleString('fr-FR') : '-';
}

export default function ListeTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  async function chargerTickets() {
    setChargement(true);
    setErreur('');

    try {
      const donnees = await recupererTickets();
      setTickets(donnees);
    } catch (erreurChargement) {
      setErreur(erreurChargement.message);
    } finally {
      setChargement(false);
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
                  <td>{ticket.name || '-'}</td>
                  <td>{libellesStatut[ticket.status] || ticket.status || '-'}</td>
                  <td>{libellesType[ticket.type] || ticket.type || '-'}</td>
                  <td>{libellesPriorite[ticket.priority] || ticket.priority || '-'}</td>
                  <td>{formatDate(ticket.date_creation || ticket.date)}</td>
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
