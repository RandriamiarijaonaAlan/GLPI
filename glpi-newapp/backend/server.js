const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("newapp.sqlite");

app.use(cors());
app.use(express.json());

db.prepare(`
  CREATE TABLE IF NOT EXISTS kanban_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    nom_fr TEXT NOT NULL,
    nom_mg TEXT NOT NULL,
    couleur TEXT NOT NULL,
    ordre INTEGER NOT NULL,
    statut_glpi INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`).run();

const total = db.prepare("SELECT COUNT(*) AS total FROM kanban_statuses").get();

if (total.total === 0) {
  const insertion = db.prepare(`
    INSERT INTO kanban_statuses
    (code, nom_fr, nom_mg, couleur, ordre, statut_glpi, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  insertion.run("nouveau", "Nouveau", "vaovao", "#cfe8ff", 1, 1);
  insertion.run("in_progress", "In progress", "efa manao", "#ffe2b8", 2, 2);
  insertion.run("termine", "Terminé", "vita", "#d8f3d8", 3, 5);
}

app.get("/api/kanban/config", (req, res) => {
  const lignes = db.prepare(`
    SELECT code, nom_fr, nom_mg, couleur, ordre, statut_glpi
    FROM kanban_statuses
    ORDER BY ordre ASC
  `).all();

  res.json(lignes);
});

app.put("/api/kanban/config", (req, res) => {
  const configuration = req.body.configuration;

  if (!Array.isArray(configuration)) {
    return res.status(400).json({ message: "Configuration invalide" });
  }

  const miseAJour = db.prepare(`
    UPDATE kanban_statuses
    SET nom_mg = ?, couleur = ?, updated_at = datetime('now')
    WHERE code = ?
  `);

  configuration.forEach((colonne) => {
    miseAJour.run(colonne.nomMalgache, colonne.couleur, colonne.code);
  });

  res.json({ message: "Configuration sauvegardée" });
});

app.post("/api/kanban/config/reset", (req, res) => {
  db.prepare("DELETE FROM kanban_statuses").run();

  const insertion = db.prepare(`
    INSERT INTO kanban_statuses
    (code, nom_fr, nom_mg, couleur, ordre, statut_glpi, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  insertion.run("nouveau", "Nouveau", "vaovao", "#cfe8ff", 1, 1);
  insertion.run("in_progress", "In progress", "efa manao", "#ffe2b8", 2, 2);
  insertion.run("termine", "Terminé", "vita", "#d8f3d8", 3, 5);

  res.json({ message: "Configuration réinitialisée" });
});

app.listen(3001, () => {
  console.log("Backend SQLite lancé sur http://localhost:3001");
});