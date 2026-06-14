import axios from "axios";

const clientKanban = axios.create({
  baseURL: "http://localhost:3001/api",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

export async function recupererConfigurationKanbanSqlite() {
  const reponse = await clientKanban.get("/kanban/config");

  return reponse.data.map((ligne) => ({
    code: ligne.code,
    nomFrancais: ligne.nom_fr,
    nomMalgache: ligne.nom_mg,
    couleur: ligne.couleur,
    ordre: ligne.ordre,
    statutGlpi: ligne.statut_glpi,
  }));
}

export async function sauvegarderConfigurationKanbanSqlite(configuration) {
  const reponse = await clientKanban.put("/kanban/config", {
    configuration,
  });

  return reponse.data;
}

export async function reinitialiserConfigurationKanbanSqlite() {
  const reponse = await clientKanban.post("/kanban/config/reset");
  return reponse.data;
}

export async function reinitialiserDonneesKanbanSqlite() {
  const reponse = await clientKanban.post("/kanban/data/reset");
  return reponse.data;
}
