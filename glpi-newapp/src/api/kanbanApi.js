import { recupererTickets, creerTicket } from "./ticketsApi";
import clientGlpiLegacy from "./glpiLegacyClient";

/**
 * Récupère les tickets pour le Kanban.
 */
export async function recupererTicketsKanban() {
  return await recupererTickets();
}

/**
 * Crée un ticket depuis le Kanban.
 */
export async function creerTicketKanban(donneesTicket) {
  return await creerTicket({
    title: donneesTicket.titre,
    description: donneesTicket.description || "Ticket créé depuis Kanban NewAPP",
    type: 1,
    urgency: 3,
    priority: donneesTicket.priorite || 3,
  });
}

/**
 * Modifie le statut GLPI d'un ticket.
 */
export async function modifierStatutTicketKanban(idTicket, statutGlpi) {
  const reponse = await clientGlpiLegacy.put(`/Ticket/${idTicket}`, {
    input: {
      id: idTicket,
      status: statutGlpi,
    },
  });

  return reponse.data;
}