import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { recupererDetailTicketKanban } from "../../api/kanbanApi";
import { recupererConfigurationKanbanSqlite } from "../../api/kanbanConfigApi";
import {
  convertirColonneKanbanVersStatutGlpi,
  grouperTicketsParStatutKanban,
  obtenirConfigurationKanbanParDefaut,
} from "../../utils/kanban";
import {
  recupererTicketsKanban,
  modifierStatutTicketKanban,
} from "../../api/kanbanApi";
import { creerCoutKanbanSqlite } from "../../api/kanbanCostsApi";

export default function KanbanTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [configuration, setConfiguration] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [ticketGlisse, setTicketGlisse] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [detailTicket, setDetailTicket] = useState(null);
  const [chargementDetail, setChargementDetail] = useState(false);
  const [dialogueCout, setDialogueCout] = useState(null);
  const [formulaireCout, setFormulaireCout] = useState({
    coutFixe: "",
    commentaire: "Cout ajoute depuis Kanban",
  });
  const [soumissionCout, setSoumissionCout] = useState(false);

async function ouvrirDetailTicket(idTicket) {
  try {
    setChargementDetail(true);

    const detail = await recupererDetailTicketKanban(idTicket);

    setDetailTicket(detail);
  } catch (erreur) {
    console.error(erreur);
    alert("Impossible de charger le détail complet du ticket.");
  } finally {
    setChargementDetail(false);
  }
}



  async function chargerDonnees() {
    try {
      setChargement(true);
      setErreur("");

      try {
        const configurationSqlite = await recupererConfigurationKanbanSqlite();
        setConfiguration(configurationSqlite);
      } catch (erreurConfiguration) {
        console.error(erreurConfiguration);
        setConfiguration(obtenirConfigurationKanbanParDefaut());
      }

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

  function ajouterTicketRapide() {
    navigate("/front/create-ticket");
  }

  function demarrerGlissement(ticket) {
    setTicketGlisse(ticket);
  }

  async function deposerTicket(codeColonne) {
    if (!ticketGlisse) return;

    const statutGlpi = convertirColonneKanbanVersStatutGlpi(codeColonne);

    if (codeColonne === "termine") {
      setDialogueCout({ ticket: ticketGlisse, codeColonne, statutGlpi });
      setFormulaireCout({
        coutFixe: "",
        commentaire: "Cout ajoute depuis Kanban",
      });
      return;
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

  async function validerCoutTermine(evenement) {
    evenement.preventDefault();

    if (!dialogueCout) return;

    const coutFixe = Number(String(formulaireCout.coutFixe).trim().replace(",", "."));

    if (Number.isNaN(coutFixe) || coutFixe < 0) {
      alert("Cout fixe invalide.");
      return;
    }

    setSoumissionCout(true);

    try {
      const detail = await recupererDetailTicketKanban(dialogueCout.ticket.id);
      const nombreItems = Math.max(1, detail.elementsLies?.length || 0);

      await modifierStatutTicketKanban(dialogueCout.ticket.id, dialogueCout.statutGlpi);

      if (coutFixe > 0) {
        await creerCoutKanbanSqlite({
          ticketId: dialogueCout.ticket.id,
          coutFixe,
          commentaire: formulaireCout.commentaire,
          nombreItems,
          items: detail.elementsLies || [],
        });
      }

      setDialogueCout(null);
      setTicketGlisse(null);
      await chargerDonnees();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'enregistrement du cout.");
    } finally {
      setSoumissionCout(false);
    }
  }

  function annulerCoutTermine() {
    if (soumissionCout) return;
    setDialogueCout(null);
    setTicketGlisse(null);
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

      {chargementDetail && <p>Chargement des tickets...</p>}
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
                    onClick={() => ouvrirDetailTicket(ticket.id)}
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

      {detailTicket && (
  <div style={styles.modalFond} onClick={() => setDetailTicket(null)}>
    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
      <h2>Détail complet du ticket #{detailTicket.ticket.id}</h2>

      <p><strong>Titre :</strong> {detailTicket.ticket.name || "-"}</p>
      <p><strong>Description :</strong> {detailTicket.ticket.content || "-"}</p>
      <p><strong>Statut :</strong> {detailTicket.ticket.status?.name || detailTicket.ticket.status || "-"}</p>
      <p><strong>Type :</strong> {detailTicket.ticket.type?.name || detailTicket.ticket.type || "-"}</p>
      <p><strong>Priorité :</strong> {detailTicket.ticket.priority?.name || detailTicket.ticket.priority || "-"}</p>
      <p><strong>Urgence :</strong> {detailTicket.ticket.urgency?.name || detailTicket.ticket.urgency || "-"}</p>
      <p><strong>Date création :</strong> {detailTicket.ticket.date_creation || detailTicket.ticket.date || "-"}</p>
      <p><strong>Date modification :</strong> {detailTicket.ticket.date_mod || "-"}</p>

      <h3>Éléments liés</h3>

      {detailTicket.elementsLies.length === 0 ? (
        <p>Aucun élément lié.</p>
      ) : (
        <ul>
          {detailTicket.elementsLies.map((element, index) => (
            <li key={element.id || index}>
              <strong>{element.nom || "-"}</strong>
              <br />
              <span>{element.itemtype || "-"} #{element.items_id || element.id || "-"}</span>
              <br />
              <span>Statut : {element.statut || "-"}</span>
              <br />
              <span>Localisation : {element.localisation || "-"}</span>
              <br />
              <span>Inventaire : {element.numeroInventaire || "-"}</span>
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => setDetailTicket(null)} style={styles.bouton}>
        Fermer
      </button>
    </div>
  </div>
)}

      {dialogueCout && (
        <div style={styles.modalFond} onClick={annulerCoutTermine}>
          <form style={styles.modal} onSubmit={validerCoutTermine} onClick={(e) => e.stopPropagation()}>
            <h2>Passer le ticket en Termine</h2>
            <p>Ticket #{dialogueCout.ticket.id}</p>

            <label style={styles.champModal}>
              Cout fixe
              <input
                type="number"
                min="0"
                step="0.01"
                value={formulaireCout.coutFixe}
                onChange={(e) =>
                  setFormulaireCout((courant) => ({
                    ...courant,
                    coutFixe: e.target.value,
                  }))
                }
                required
              />
            </label>

            <label style={styles.champModal}>
              Commentaire
              <textarea
                value={formulaireCout.commentaire}
                onChange={(e) =>
                  setFormulaireCout((courant) => ({
                    ...courant,
                    commentaire: e.target.value,
                  }))
                }
              />
            </label>

            <div style={styles.actionsModal}>
              <button type="submit" style={styles.bouton} disabled={soumissionCout}>
                {soumissionCout ? "Enregistrement..." : "Valider"}
              </button>
              <button type="button" style={styles.boutonSecondaire} onClick={annulerCoutTermine} disabled={soumissionCout}>
                Annuler
              </button>
            </div>
          </form>
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
  champModal: {
    display: "grid",
    gap: "8px",
    marginBottom: "14px",
    fontWeight: 700,
  },
  actionsModal: {
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
  },
};
