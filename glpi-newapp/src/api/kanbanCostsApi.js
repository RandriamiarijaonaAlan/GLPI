import axios from "axios";

const clientKanbanCosts = axios.create({
  baseURL: "http://localhost:3001/api",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

export async function recupererCoutsKanbanSqlite() {
  const reponse = await clientKanbanCosts.get("/kanban/costs");
  return Array.isArray(reponse.data) ? reponse.data : [];
}

export async function creerCoutKanbanSqlite(donnees) {
  const reponse = await clientKanbanCosts.post("/kanban/costs", {
    ticket_id: donnees.ticketId,
    cout_fixe: donnees.coutFixe,
    commentaire: donnees.commentaire || "",
    nombre_items: donnees.nombreItems || 1,
    items: donnees.items || [],
  });

  return reponse.data;
}

export async function supprimerDernierCoutKanbanSqlite(ticketId) {
  const reponse = await clientKanbanCosts.delete(`/kanban/costs/latest/${ticketId}`);
  return reponse.data;
}

export async function reouvrirDernierCoutKanbanSqlite(ticketId, pourcentage) {
  const reponse = await clientKanbanCosts.patch(`/kanban/costs/latest/${ticketId}/reopen`, {
    pourcentage,
  });

  return reponse.data;
}
