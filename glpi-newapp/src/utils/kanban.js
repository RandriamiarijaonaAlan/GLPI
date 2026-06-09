const CLE_CONFIGURATION_KANBAN = "configuration_kanban_newapp";

/**
 * Retourne la configuration Kanban par défaut.
 */
export function obtenirConfigurationKanbanParDefaut() {
  return [
    {
      code: "nouveau",
      nomFrancais: "Nouveau",
      nomMalgache: "vaovao",
      couleur: "#cfe8ff",
      ordre: 1,
      statutGlpi: 1,
    },
    {
      code: "in_progress",
      nomFrancais: "In progress",
      nomMalgache: "efa manao",
      couleur: "#ffe2b8",
      ordre: 2,
      statutGlpi: 2,
    },
    {
      code: "termine",
      nomFrancais: "Terminé",
      nomMalgache: "vita",
      couleur: "#d8f3d8",
      ordre: 3,
      statutGlpi: 5,
    },
  ];
}

/**
 * Charge la configuration Kanban depuis localStorage.
 */
export function chargerConfigurationKanban() {
  try {
    const configurationStockee = localStorage.getItem(CLE_CONFIGURATION_KANBAN);

    if (!configurationStockee) {
      const configurationDefaut = obtenirConfigurationKanbanParDefaut();
      sauvegarderConfigurationKanban(configurationDefaut);
      return configurationDefaut;
    }

    return JSON.parse(configurationStockee);
  } catch (erreur) {
    console.error("Erreur chargement configuration Kanban :", erreur);
    return obtenirConfigurationKanbanParDefaut();
  }
}

/**
 * Sauvegarde la configuration Kanban.
 */
export function sauvegarderConfigurationKanban(configuration) {
  localStorage.setItem(CLE_CONFIGURATION_KANBAN, JSON.stringify(configuration));
}

/**
 * Réinitialise la configuration Kanban.
 */
export function reinitialiserConfigurationKanban() {
  const configurationDefaut = obtenirConfigurationKanbanParDefaut();
  sauvegarderConfigurationKanban(configurationDefaut);
  return configurationDefaut;
}
export function convertirStatutGlpiVersColonneKanban(statutGlpi) {
  const statut = Number(statutGlpi?.id || statutGlpi);

  if (statut === 1) return "nouveau";
  if (statut === 2 || statut === 3 || statut === 4) return "in_progress";
  if (statut === 5 || statut === 6) return "termine";

  return "nouveau";
}

export function convertirColonneKanbanVersStatutGlpi(codeColonne) {
  if (codeColonne === "nouveau") return 1;
  if (codeColonne === "in_progress") return 2;
  if (codeColonne === "termine") return 5;

  return 1;
}

export function grouperTicketsParStatutKanban(tickets) {
  const groupes = {
    nouveau: [],
    in_progress: [],
    termine: [],
  };

  tickets.forEach((ticket) => {
    const colonne = convertirStatutGlpiVersColonneKanban(ticket.status);
    groupes[colonne].push(ticket);
  });

  return groupes;
}