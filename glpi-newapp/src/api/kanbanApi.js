import { recupererTickets, creerTicket } from "./ticketsApi";
import clientGlpiLegacy from "./glpiLegacyClient";



/**
 * Récupère le détail complet d'un ticket Kanban.
 */
export async function recupererDetailTicketKanban(idTicket) {
  const reponseTicket = await clientGlpiLegacy.get(
    `/Ticket/${idTicket}?expand_dropdowns=true`
  );

  let elementsLies = [];

  try {
    const reponseRelations = await clientGlpiLegacy.get(
      `/Item_Ticket?range=0-999&expand_dropdowns=true`
    );

    const relations = Array.isArray(reponseRelations.data)
      ? reponseRelations.data
      : [];

    elementsLies = relations.filter((relation) => {
      const idTicketRelation =
        relation.tickets_id?.id ||
        relation.tickets_id ||
        relation["tickets_id"];

      return Number(idTicketRelation) === Number(idTicket);
    });
  } catch (erreur) {
    console.warn("Impossible de récupérer les éléments liés :", erreur);
  }

  return {
    ticket: reponseTicket.data,
    elementsLies,
  };
}






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