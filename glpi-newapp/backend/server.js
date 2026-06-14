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

db.prepare(`
  CREATE TABLE IF NOT EXISTS kanban_ticket_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    cout_fixe REAL NOT NULL DEFAULT 0,
    commentaire TEXT,
    nombre_items INTEGER NOT NULL DEFAULT 1,
    cout_par_item REAL NOT NULL DEFAULT 0,
    items_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`).run();

function assurerColonne(table, colonne, definition) {
  const colonnes = db.prepare(`PRAGMA table_info(${table})`).all();
  const existe = colonnes.some((info) => info.name === colonne);

  if (!existe) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${colonne} ${definition}`).run();
  }
}

assurerColonne("kanban_ticket_costs", "cout_fixe", "REAL NOT NULL DEFAULT 0");
assurerColonne("kanban_ticket_costs", "commentaire", "TEXT");
assurerColonne("kanban_ticket_costs", "nombre_items", "INTEGER NOT NULL DEFAULT 1");
assurerColonne("kanban_ticket_costs", "cout_par_item", "REAL NOT NULL DEFAULT 0");
assurerColonne("kanban_ticket_costs", "items_json", "TEXT");
assurerColonne("kanban_ticket_costs", "created_at", "TEXT NOT NULL DEFAULT ''");
assurerColonne("kanban_ticket_costs", "updated_at", "TEXT NOT NULL DEFAULT ''");

const total = db.prepare("SELECT COUNT(*) AS total FROM kanban_statuses").get();

if (total.total === 0) {
  const insertion = db.prepare(`
    INSERT INTO kanban_statuses
    (code, nom_fr, nom_mg, couleur, ordre, statut_glpi, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  insertion.run("nouveau", "Nouveau", "vaovao", "#cfe8ff", 1, 1);
  insertion.run("in_progress", "In progress", "efa manao", "#ffe2b8", 2, 2);
  insertion.run("termine", "Termine", "vita", "#d8f3d8", 3, 6);
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

  return res.json({ message: "Configuration sauvegardee" });
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
  insertion.run("termine", "Termine", "vita", "#d8f3d8", 3, 6);

  return res.json({ message: "Configuration reinitialisee" });
});

app.get("/api/kanban/costs", (req, res) => {
  const lignes = db.prepare(`
    SELECT id, ticket_id, cout_fixe, commentaire, nombre_items, cout_par_item, items_json, created_at, updated_at
    FROM kanban_ticket_costs
    ORDER BY created_at DESC
  `).all();

  return res.json(lignes);
});

app.post("/api/kanban/costs", (req, res) => {
  const ticketId = Number(req.body.ticket_id);
  const coutFixe = Number(req.body.cout_fixe || 0);
  const commentaire = String(req.body.commentaire || "").trim();
  const nombreItems = Math.max(1, Number(req.body.nombre_items || 1));
  const coutParItem = coutFixe / nombreItems;
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const itemsJson = JSON.stringify(
    items.map((item) => ({
      nom: String(item.nom || "-"),
      itemtype: String(item.itemtype || "-"),
      id: item.items_id || item.id || "",
    })),
  );

  if (!ticketId || Number.isNaN(ticketId)) {
    return res.status(400).json({ message: "ticket_id invalide" });
  }

  if (Number.isNaN(coutFixe) || coutFixe < 0) {
    return res.status(400).json({ message: "cout_fixe invalide" });
  }

  const resultat = db.prepare(`
    INSERT INTO kanban_ticket_costs
    (ticket_id, cout_fixe, commentaire, nombre_items, cout_par_item, items_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(ticketId, coutFixe, commentaire, nombreItems, coutParItem, itemsJson);

  return res.json({
    id: resultat.lastInsertRowid,
    ticket_id: ticketId,
    cout_fixe: coutFixe,
    commentaire,
    nombre_items: nombreItems,
    cout_par_item: coutParItem,
    items_json: itemsJson,
  });
});

app.listen(3001, () => {
  console.log("Backend SQLite lance sur http://localhost:3001");
});
