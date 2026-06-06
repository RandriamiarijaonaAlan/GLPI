import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { libellesPriorite, libellesStatut, libellesType } from '../../api/dashboardApi';
import { recupererElementsTicket, recupererTicketParId } from '../../api/ticketsApi';

function formatDate(value) {
  return value ? new Date(value).toLocaleString('fr-FR') : '-';
}

export default function DetailTicket() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [elements, setElements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    async function chargerTicket() {
      setChargement(true);
      setErreur('');

      try {
        const [donnees, elementsLies] = await Promise.all([
          recupererTicketParId(id),
          recupererElementsTicket(id),
        ]);
        setTicket(donnees);
        setElements(elementsLies);
      } catch (erreurChargement) {
        setErreur(erreurChargement.message);
      } finally {
        setChargement(false);
      }
    }

    chargerTicket();
  }, [id]);

  return (
    <main className="backoffice-page">
      <div className="page-header">
        <h1>Ticket #{id}</h1>
        <button type="button" onClick={() => navigate('/admin/tickets')}>
          Retour
        </button>
      </div>

      {chargement ? <p>Chargement du ticket...</p> : null}
      {erreur ? <p className="message-erreur">{erreur}</p> : null}

      {ticket ? (
        <section className="detail-panel">
          <dl>
            <div>
              <dt>ID ticket</dt>
              <dd>{ticket.id}</dd>
            </div>
            <div>
              <dt>Titre</dt>
              <dd>{ticket.name || '-'}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{ticket.content || '-'}</dd>
            </div>
            <div>
              <dt>Statut</dt>
              <dd>{libellesStatut[ticket.status] || ticket.status || '-'}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{libellesType[ticket.type] || ticket.type || '-'}</dd>
            </div>
            <div>
              <dt>Priorité</dt>
              <dd>{libellesPriorite[ticket.priority] || ticket.priority || '-'}</dd>
            </div>
            <div>
              <dt>Date création</dt>
              <dd>{formatDate(ticket.date_creation || ticket.date)}</dd>
            </div>
            <div>
              <dt>Date modification</dt>
              <dd>{formatDate(ticket.date_mod)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {ticket ? (
        <section className="detail-panel">
          <h2>Éléments liés</h2>
          {elements.length > 0 ? (
            <ul className="liste-elements">
              {elements.map((element) => (
                <li key={element.id || `${element.itemtype}-${element.items_id}`}>
                  <strong>{element.itemtype || 'Élément'}</strong>
                  <span>ID {element.items_id || element.id}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Aucun élément lié.</p>
          )}
        </section>
      ) : null}
    </main>
  );
}
