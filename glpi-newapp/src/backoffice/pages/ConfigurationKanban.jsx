import { useEffect, useState } from "react";
import {
  recupererConfigurationKanbanSqlite,
  sauvegarderConfigurationKanbanSqlite,
  reinitialiserConfigurationKanbanSqlite,
} from "../../api/kanbanConfigApi";

export default function ConfigurationKanban() {
  const [configuration, setConfiguration] = useState([]);
  const [messageSucces, setMessageSucces] = useState("");
  const [messageErreur, setMessageErreur] = useState("");

 useEffect(() => {
  async function chargerConfiguration() {
    const donnees = await recupererConfigurationKanbanSqlite();
    setConfiguration(donnees);
  }

  chargerConfiguration();
}, []);

  function modifierNomMalgache(code, nouveauNom) {
    setConfiguration((ancienneConfiguration) =>
      ancienneConfiguration.map((colonne) =>
        colonne.code === code
          ? { ...colonne, nomMalgache: nouveauNom }
          : colonne
      )
    );
  }

  function modifierCouleur(code, nouvelleCouleur) {
    setConfiguration((ancienneConfiguration) =>
      ancienneConfiguration.map((colonne) =>
        colonne.code === code
          ? { ...colonne, couleur: nouvelleCouleur }
          : colonne
      )
    );
  }

  async function enregistrerConfiguration() {
  try {
    await sauvegarderConfigurationKanbanSqlite(configuration);
    setMessageSucces("Configuration Kanban enregistrée dans SQLite.");
    setMessageErreur("");
  } catch (erreur) {
    setMessageErreur("Erreur lors de l’enregistrement SQLite.");
    setMessageSucces("");
  }
}

  async function remettreConfigurationParDefaut() {
  const confirmation = confirm("Réinitialiser la configuration Kanban ?");

  if (!confirmation) return;

  await reinitialiserConfigurationKanbanSqlite();

  const donnees = await recupererConfigurationKanbanSqlite();
  setConfiguration(donnees);

  setMessageSucces("Configuration Kanban réinitialisée.");
}

  return (
    <div style={{ padding: "24px" }}>
      <h1>Configuration Kanban</h1>

      <p>
        Cette page permet de personnaliser les couleurs des colonnes Kanban et
        les noms malgaches des statuts.
      </p>

      {messageSucces && (
        <div style={styles.messageSucces}>{messageSucces}</div>
      )}

      {messageErreur && (
        <div style={styles.messageErreur}>{messageErreur}</div>
      )}

      <div style={styles.grille}>
        {configuration
          .sort((a, b) => a.ordre - b.ordre)
          .map((colonne) => (
            <div key={colonne.code} style={styles.carte}>
              <div
                style={{
                  ...styles.apercu,
                  backgroundColor: colonne.couleur,
                }}
              >
                <strong>{colonne.nomFrancais}</strong>
                <span>{colonne.nomMalgache}</span>
              </div>

              <label style={styles.label}>Nom français</label>
              <input
                type="text"
                value={colonne.nomFrancais}
                disabled
                style={styles.champ}
              />

              <label style={styles.label}>Nom malgache</label>
              <input
                type="text"
                value={colonne.nomMalgache}
                onChange={(evenement) =>
                  modifierNomMalgache(colonne.code, evenement.target.value)
                }
                style={styles.champ}
              />

              <label style={styles.label}>Couleur</label>
              <input
                type="color"
                value={colonne.couleur}
                onChange={(evenement) =>
                  modifierCouleur(colonne.code, evenement.target.value)
                }
                style={styles.champCouleur}
              />

              <small>Statut GLPI : {colonne.statutGlpi}</small>
            </div>
          ))}
      </div>

      <div style={styles.actions}>
        <button onClick={enregistrerConfiguration} style={styles.boutonPrincipal}>
          Enregistrer
        </button>

        <button onClick={remettreConfigurationParDefaut} style={styles.boutonSecondaire}>
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

const styles = {
  grille: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "20px",
    marginTop: "24px",
  },
  carte: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
  },
  apercu: {
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  label: {
    display: "block",
    marginTop: "12px",
    marginBottom: "6px",
    fontWeight: "600",
  },
  champ: {
    width: "100%",
    padding: "10px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
  },
  champCouleur: {
    width: "100%",
    height: "42px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
  },
  actions: {
    marginTop: "24px",
    display: "flex",
    gap: "12px",
  },
  boutonPrincipal: {
    padding: "10px 18px",
    border: "none",
    borderRadius: "8px",
    background: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
  },
  boutonSecondaire: {
    padding: "10px 18px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    background: "#ffffff",
    cursor: "pointer",
  },
  messageSucces: {
    marginTop: "16px",
    padding: "12px",
    borderRadius: "8px",
    background: "#dcfce7",
    color: "#166534",
  },
  messageErreur: {
    marginTop: "16px",
    padding: "12px",
    borderRadius: "8px",
    background: "#fee2e2",
    color: "#991b1b",
  },
};