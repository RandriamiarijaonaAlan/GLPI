import { useEffect, useState } from "react";
import {
  chargerConfigurationKanban,
  convertirColonneKanbanVersStatutGlpi,
  grouperTicketsParStatutKanban,
} from "../../utils/kanban";
import {
  recupererTicketsKanban,
  creerTicketKanban,
  modifierStatutTicketKanban,
} from "../../api/kanbanApi";

export default function KanbanTickets() {
  const [tickets, setTickets] = useState([]);
  const [configuration, setConfiguration] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [ticketGlisse, setTicketGlisse] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);

  async function chargerDonnees() {
    try {
      setChargement(true);
      setErreur("");

      setConfiguration(chargerConfigurationKanban());

      const donneesTickets = await recupererTicketsKanban();
      setTickets(Array.isArray(donneesTickets) ? donneesTickets : donneesTickets.data || []);
    } catch (e) {
      console.error(e);
      setErreur("Erreur lors du chargement des tickets Kanban.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerDonnees();
  }, []);

  async function ajouterTicketRapide() {
    const titre = prompt("Titre du ticket :");

    if (!titre) return;

    try {
      await creerTicketKanban({
        titre,
        description: "Ticket créé depuis le Kanban",
        priorite: 3,
      });

      await chargerDonnees();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la création du ticket.");
    }
  }

  function demarrerGlissement(ticket) {
    setTicketGlisse(ticket);
  }

  async function deposerTicket(codeColonne) {
    if (!ticketGlisse) return;

    const statutGlpi = convertirColonneKanbanVersStatutGlpi(codeColonne);

    if (codeColonne === "termine") {
      const confirmation = confirm("Confirmer le passage du ticket en Terminé ?");
      if (!confirmation) {
        setTicketGlisse(null);
        return;
      }
    }

    try {
      await modifierStatutTicketKanban(ticketGlisse.id, statutGlpi);
      setTicketGlisse(null);
      await chargerDonnees();
    } catch (e) {
      console.error(e);
      alert("Erreur lors du changement de statut.");
      setTicketGlisse(null);
    }
  }

  const ticketsGroupes = grouperTicketsParStatutKanban(tickets);

  return (
    <div style={styles.page}>
      <div style={styles.entete}>
        <h1>Kanban Tickets</h1>

        <div>
          <button onClick={ajouterTicketRapide} style={styles.bouton}>
            Ajouter 1 ticket
          </button>

          <button onClick={chargerDonnees} style={styles.boutonSecondaire}>
            Actualiser
          </button>
        </div>
      </div>

      {chargement && <p>Chargement des tickets...</p>}
      {erreur && <p style={styles.erreur}>{erreur}</p>}

      <div style={styles.kanban}>
        {configuration
          .sort((a, b) => a.ordre - b.ordre)
          .map((colonne) => {
            const ticketsColonne = ticketsGroupes[colonne.code] || [];

            return (
              <div
                key={colonne.code}
                style={{
                  ...styles.colonne,
                  backgroundColor: colonne.couleur,
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => deposerTicket(colonne.code)}
              >
                <h2>{colonne.nomFrancais}</h2>
                <p>{colonne.nomMalgache}</p>

                <div style={styles.compteur}>
                  {ticketsColonne.length} ticket(s)
                </div>

                {ticketsColonne.map((ticket) => (
                  <div
                    key={ticket.id}
                    draggable
                    onDragStart={() => demarrerGlissement(ticket)}
                    onClick={() => setTicketDetail(ticket)}
                    style={styles.carte}
                  >
                    <strong>{ticket.name || ticket.titre || `Ticket #${ticket.id}`}</strong>
                    <span>ID : {ticket.id}</span>
                    <span>Priorité : {ticket.priority?.name || ticket.priority || "-"}</span>
                    <span>Date : {ticket.date_creation || ticket.date || "-"}</span>
                  </div>
                ))}
              </div>
            );
          })}
      </div>

      {ticketDetail && (
        <div style={styles.modalFond} onClick={() => setTicketDetail(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Détail ticket #{ticketDetail.id}</h2>

            <p><strong>Titre :</strong> {ticketDetail.name || "-"}</p>
            <p><strong>Description :</strong> {ticketDetail.content || "-"}</p>
            <p><strong>Statut :</strong> {ticketDetail.status?.name || ticketDetail.status || "-"}</p>
            <p><strong>Priorité :</strong> {ticketDetail.priority?.name || ticketDetail.priority || "-"}</p>
            <p><strong>Date :</strong> {ticketDetail.date_creation || ticketDetail.date || "-"}</p>

            <button onClick={() => setTicketDetail(null)} style={styles.bouton}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    padding: "24px",
  },
  entete: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  kanban: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "20px",
  },
  colonne: {
    minHeight: "520px",
    padding: "16px",
    borderRadius: "14px",
    border: "1px solid #e5e7eb",
  },
  compteur: {
    marginBottom: "12px",
    fontWeight: "bold",
  },
  carte: {
    background: "#ffffff",
    borderRadius: "10px",
    padding: "12px",
    marginBottom: "12px",
    cursor: "grab",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    boxShadow: "0 3px 10px rgba(0,0,0,0.08)",
  },
  bouton: {
    padding: "10px 14px",
    marginLeft: "8px",
    border: "none",
    borderRadius: "8px",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
  boutonSecondaire: {
    padding: "10px 14px",
    marginLeft: "8px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    background: "#fff",
    cursor: "pointer",
  },
  erreur: {
    color: "red",
  },
  modalFond: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    width: "420px",
    background: "#fff",
    padding: "24px",
    borderRadius: "12px",
  },
};