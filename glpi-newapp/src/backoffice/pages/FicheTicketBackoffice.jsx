import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { libellesPriorite, libellesStatut, libellesType } from '../../api/dashboardApi';
import { recupererElementsTicket, recupererTicketParId } from '../../api/ticketsApi';
import { afficherValeurGlpi } from '../../utils/affichage';

function formaterDate(valeur) {
  return valeur ? new Date(valeur).toLocaleString('fr-FR') : '-';
}

function afficherLibelleGlpi(libelles, valeur) {
  return libelles[valeur] || afficherValeurGlpi(valeur);
}

export default function DetailTicket() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, definirTicket] = useState(null);
  const [elements, definirElements] = useState([]);
  const [chargement, definirChargement] = useState(true);
  const [erreur, definirErreur] = useState('');

  useEffect(() => {
    async function chargerTicket() {
      definirChargement(true);
      definirErreur('');

      try {
        const [donnees, elementsLies] = await Promise.all([
          recupererTicketParId(id),
          recupererElementsTicket(id),
        ]);
        definirTicket(donnees);
        definirElements(elementsLies);
      } catch (erreurChargement) {
        definirErreur(erreurChargement.message);
      } finally {
        definirChargement(false);
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
              <dd>{afficherValeurGlpi(ticket.name)}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{afficherValeurGlpi(ticket.content)}</dd>
            </div>
            <div>
              <dt>Statut</dt>
              <dd>{afficherLibelleGlpi(libellesStatut, ticket.status)}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{afficherLibelleGlpi(libellesType, ticket.type)}</dd>
            </div>
            <div>
              <dt>Priorité</dt>
              <dd>{afficherLibelleGlpi(libellesPriorite, ticket.priority)}</dd>
            </div>
            <div>
              <dt>Date création</dt>
              <dd>{formaterDate(ticket.date_creation || ticket.date)}</dd>
            </div>
            <div>
              <dt>Date modification</dt>
              <dd>{formaterDate(ticket.date_mod)}</dd>
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
                  <strong>{afficherValeurGlpi(element.itemtype) || 'Élément'}</strong>
                  <span>ID {afficherValeurGlpi(element.items_id || element.id)}</span>
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
