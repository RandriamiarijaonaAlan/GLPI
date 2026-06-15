# Guide - Cout a la fin du Kanban

Objectif : quand un ticket est deplace dans la colonne `Termine`, afficher une boite de dialogue pour saisir un nouveau cout fixe. Ce cout doit etre sauvegarde en SQLite. Une nouvelle page `Couts` doit afficher les anciens couts importes, les nouveaux couts saisis depuis le Kanban, et le cout total. Si plusieurs items sont lies au ticket, le prix doit etre partage entre eux.

Ce fichier est un guide de realisation. Ne pas tout coder d'un coup : suivre les etapes dans l'ordre.

## 1. Ajouter le stockage SQLite

Dans `glpi-newapp/backend/server.js`, creer une nouvelle table pour les couts saisis depuis le Kanban.

Ajouter apres la creation de la table `kanban_statuses` :

```js
db.prepare(`
  CREATE TABLE IF NOT EXISTS kanban_ticket_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    cout_fixe REAL NOT NULL DEFAULT 0,
    commentaire TEXT,
    nombre_items INTEGER NOT NULL DEFAULT 1,
    cout_par_item REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`).run();
```

Ajouter ensuite les routes backend :

```js
app.get("/api/kanban/costs", (req, res) => {
  const lignes = db.prepare(`
    SELECT id, ticket_id, cout_fixe, commentaire, nombre_items, cout_par_item, created_at, updated_at
    FROM kanban_ticket_costs
    ORDER BY created_at DESC
  `).all();

  res.json(lignes);
});

app.post("/api/kanban/costs", (req, res) => {
  const ticketId = Number(req.body.ticket_id);
  const coutFixe = Number(req.body.cout_fixe || 0);
  const commentaire = String(req.body.commentaire || "").trim();
  const nombreItems = Math.max(1, Number(req.body.nombre_items || 1));
  const coutParItem = coutFixe / nombreItems;

  if (!ticketId || Number.isNaN(ticketId)) {
    return res.status(400).json({ message: "ticket_id invalide" });
  }

  if (Number.isNaN(coutFixe) || coutFixe < 0) {
    return res.status(400).json({ message: "cout_fixe invalide" });
  }

  const resultat = db.prepare(`
    INSERT INTO kanban_ticket_costs
    (ticket_id, cout_fixe, commentaire, nombre_items, cout_par_item, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(ticketId, coutFixe, commentaire, nombreItems, coutParItem);

  res.json({
    id: resultat.lastInsertRowid,
    ticket_id: ticketId,
    cout_fixe: coutFixe,
    commentaire,
    nombre_items: nombreItems,
    cout_par_item: coutParItem,
  });
});
```

## 2. Creer l'API FrontOffice pour SQLite

Creer un fichier :

```text
glpi-newapp/src/api/kanbanCostsApi.js
```

Code :

```js
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
  });

  return reponse.data;
}
```

## 3. Modifier le deplacement Kanban vers Termine

Fichier :

```text
glpi-newapp/src/frontoffice/pages/KanbanTicket.jsx
```

Ajouter l'import :

```js
import { creerCoutKanbanSqlite } from "../../api/kanbanCostsApi";
```

Dans `deposerTicket(codeColonne)`, remplacer la confirmation simple vers `termine`.

Avant :

```js
if (codeColonne === "termine") {
  const confirmation = confirm("Confirmer le passage du ticket en Terminé ?");
  if (!confirmation) {
    setTicketGlisse(null);
    return;
  }
}
```

Apres :

```js
let coutFixeTermine = 0;
let commentaireCout = "";

if (codeColonne === "termine") {
  const confirmation = confirm("Confirmer le passage du ticket en Terminé ?");
  if (!confirmation) {
    setTicketGlisse(null);
    return;
  }

  const valeurCout = prompt("Nouveau cout fixe a ajouter pour ce ticket :");
  if (valeurCout === null) {
    setTicketGlisse(null);
    return;
  }

  coutFixeTermine = Number(String(valeurCout).trim().replace(",", "."));

  if (Number.isNaN(coutFixeTermine) || coutFixeTermine < 0) {
    alert("Cout fixe invalide.");
    setTicketGlisse(null);
    return;
  }

  commentaireCout = prompt("Commentaire du cout :", "Cout ajoute depuis Kanban") || "";
}
```

Puis, apres :

```js
await modifierStatutTicketKanban(ticketGlisse.id, statutGlpi);
```

Ajouter :

```js
if (codeColonne === "termine" && coutFixeTermine > 0) {
  const detail = await recupererDetailTicketKanban(ticketGlisse.id);
  const nombreItems = Math.max(1, detail.elementsLies?.length || 0);

  await creerCoutKanbanSqlite({
    ticketId: ticketGlisse.id,
    coutFixe: coutFixeTermine,
    commentaire: commentaireCout,
    nombreItems,
  });
}
```

## 4. Remplacer prompt par une vraie boite de dialogue

La version ci-dessus marche vite, mais la version propre est une modale React.

Etats a ajouter dans `KanbanTicket.jsx` :

```js
const [dialogueCout, setDialogueCout] = useState(null);
const [formulaireCout, setFormulaireCout] = useState({
  coutFixe: "",
  commentaire: "Cout ajoute depuis Kanban",
});
```

Principe :

- au drop vers `termine`, ne pas appeler directement `modifierStatutTicketKanban` ;
- stocker le ticket et la colonne cible dans `dialogueCout` ;
- afficher une modale ;
- au submit de la modale :
  - changer le statut ;
  - recuperer les elements lies ;
  - calculer `nombreItems` ;
  - sauvegarder le cout en SQLite ;
  - fermer la modale ;
  - recharger le Kanban.

Pseudo-code :

```js
function ouvrirDialogueCoutTermine(ticket, codeColonne, statutGlpi) {
  setDialogueCout({ ticket, codeColonne, statutGlpi });
  setFormulaireCout({
    coutFixe: "",
    commentaire: "Cout ajoute depuis Kanban",
  });
}
```

Dans `deposerTicket` :

```js
if (codeColonne === "termine") {
  ouvrirDialogueCoutTermine(ticketGlisse, codeColonne, statutGlpi);
  return;
}
```

Fonction de validation :

```js
async function validerCoutTermine(evenement) {
  evenement.preventDefault();

  const coutFixe = Number(String(formulaireCout.coutFixe).trim().replace(",", "."));

  if (Number.isNaN(coutFixe) || coutFixe < 0) {
    alert("Cout fixe invalide.");
    return;
  }

  const { ticket, statutGlpi } = dialogueCout;

  await modifierStatutTicketKanban(ticket.id, statutGlpi);

  if (coutFixe > 0) {
    const detail = await recupererDetailTicketKanban(ticket.id);
    const nombreItems = Math.max(1, detail.elementsLies?.length || 0);

    await creerCoutKanbanSqlite({
      ticketId: ticket.id,
      coutFixe,
      commentaire: formulaireCout.commentaire,
      nombreItems,
    });
  }

  setDialogueCout(null);
  setTicketGlisse(null);
  await chargerDonnees();
}
```

## 5. Creer une nouvelle page Couts

Creer :

```text
glpi-newapp/src/backoffice/pages/CoutsTickets.jsx
```

Code de base :

```js
import { useEffect, useMemo, useState } from "react";
import { recupererCoutsKanbanSqlite } from "../../api/kanbanCostsApi";
import clientGlpiLegacy from "../../api/glpiLegacyClient";

function normaliserListe(donnees) {
  if (Array.isArray(donnees)) return donnees;
  if (Array.isArray(donnees?.data)) return donnees.data;
  if (Array.isArray(donnees?.items)) return donnees.items;
  if (Array.isArray(donnees?.member)) return donnees.member;
  return [];
}

function convertirNombre(valeur) {
  const nombre = Number(String(valeur ?? "0").replace(",", "."));
  return Number.isNaN(nombre) ? 0 : nombre;
}

async function recupererAnciensCoutsImportes() {
  const reponse = await clientGlpiLegacy.get("/TicketCost?range=0-9999&expand_dropdowns=true");
  return normaliserListe(reponse.data).filter((cout) =>
    String(cout.name || "").includes("NEWAPP_IMPORT_JUIN_2026")
  );
}

export default function CoutsTickets() {
  const [anciensCouts, setAnciensCouts] = useState([]);
  const [nouveauxCouts, setNouveauxCouts] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  async function chargerCouts() {
    setChargement(true);
    setErreur("");

    try {
      const [anciens, nouveaux] = await Promise.all([
        recupererAnciensCoutsImportes(),
        recupererCoutsKanbanSqlite(),
      ]);

      setAnciensCouts(anciens);
      setNouveauxCouts(nouveaux);
    } catch (e) {
      setErreur(e.message || "Impossible de charger les couts.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerCouts();
  }, []);

  const totaux = useMemo(() => {
    const totalAncien = anciensCouts.reduce((total, cout) => {
      const fixe = convertirNombre(cout.cost_fixed);
      const temps = convertirNombre(cout.cost_time);
      const duree = convertirNombre(cout.actiontime);
      return total + fixe + (duree / 3600) * temps;
    }, 0);

    const totalNouveau = nouveauxCouts.reduce(
      (total, cout) => total + convertirNombre(cout.cout_fixe),
      0
    );

    return {
      totalAncien,
      totalNouveau,
      totalGeneral: totalAncien + totalNouveau,
    };
  }, [anciensCouts, nouveauxCouts]);

  return (
    <main className="backoffice-page">
      <div className="page-header">
        <div>
          <h1>Couts tickets</h1>
          <p>Anciens couts importes et nouveaux couts saisis depuis le Kanban.</p>
        </div>
        <button type="button" onClick={chargerCouts} disabled={chargement}>
          Actualiser
        </button>
      </div>

      {erreur ? <p className="message-erreur">{erreur}</p> : null}
      {chargement ? <p>Chargement des couts...</p> : null}

      {!chargement ? (
        <>
          <section className="stats-grid">
            <article className="stat-card">
              <span>Ancien cout import</span>
              <strong>{totaux.totalAncien.toFixed(2)}</strong>
            </article>
            <article className="stat-card">
              <span>Nouveau cout Kanban</span>
              <strong>{totaux.totalNouveau.toFixed(2)}</strong>
            </article>
            <article className="stat-card">
              <span>Cout total</span>
              <strong>{totaux.totalGeneral.toFixed(2)}</strong>
            </article>
          </section>

          <section className="detail-panel">
            <h2>Nouveaux couts Kanban</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Cout fixe</th>
                    <th>Items</th>
                    <th>Cout par item</th>
                    <th>Commentaire</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {nouveauxCouts.map((cout) => (
                    <tr key={cout.id}>
                      <td>#{cout.ticket_id}</td>
                      <td>{convertirNombre(cout.cout_fixe).toFixed(2)}</td>
                      <td>{cout.nombre_items}</td>
                      <td>{convertirNombre(cout.cout_par_item).toFixed(2)}</td>
                      <td>{cout.commentaire || "-"}</td>
                      <td>{cout.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="detail-panel">
            <h2>Anciens couts importes</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Ticket</th>
                    <th>Duree</th>
                    <th>Cout temps</th>
                    <th>Cout fixe</th>
                  </tr>
                </thead>
                <tbody>
                  {anciensCouts.map((cout) => (
                    <tr key={cout.id}>
                      <td>{cout.id}</td>
                      <td>{cout.tickets_id?.id || cout.tickets_id || "-"}</td>
                      <td>{convertirNombre(cout.actiontime).toFixed(2)}</td>
                      <td>{convertirNombre(cout.cost_time).toFixed(2)}</td>
                      <td>{convertirNombre(cout.cost_fixed).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
```

## 6. Ajouter la route de la page Couts

Dans :

```text
glpi-newapp/src/App.jsx
```

Ajouter l'import :

```js
import CoutsTickets from "./backoffice/pages/CoutsTickets";
```

Dans les routes Backoffice, ajouter :

```js
{
  path: "couts",
  element: <CoutsTickets />,
},
```

## 7. Ajouter le lien dans la sidebar Backoffice

Dans :

```text
glpi-newapp/src/backoffice/composants/SidebarBackoffice.jsx
```

Ajouter dans `liensBackoffice` :

```js
["Couts", "/admin/couts"],
```

## 8. Regle de partage du prix

Quand un ticket termine contient plusieurs items lies :

```text
cout_par_item = cout_fixe / nombre_items
```

Exemple :

```text
Ticket #10
Cout fixe saisi : 300
Items lies : 3
Cout par item : 100
```

Si aucun item n'est lie :

```text
nombre_items = 1
cout_par_item = cout_fixe
```

## 9. Tests a faire

### Test 1 - Deplacement simple

1. Ouvrir `/front/kanban`.
2. Deplacer un ticket vers `Termine`.
3. Saisir un cout fixe.
4. Verifier que le ticket change bien de colonne.
5. Verifier que le cout est cree en SQLite.

### Test 2 - Ticket avec plusieurs items

1. Prendre un ticket avec plusieurs elements lies.
2. Le passer vers `Termine`.
3. Saisir un cout fixe de `300`.
4. Aller dans la page `Couts`.
5. Verifier :
   - `nombre_items = nombre d'elements lies`
   - `cout_par_item = 300 / nombre_items`

### Test 3 - Page Couts

Verifier que la page affiche :

- les anciens couts importes ;
- les nouveaux couts Kanban ;
- le total ancien ;
- le total nouveau ;
- le total general.

### Test 4 - Annulation

1. Deplacer un ticket vers `Termine`.
2. Fermer ou annuler la boite de dialogue.
3. Verifier qu'aucun cout n'est cree.

## 10. Definition de fini

La demande est terminee quand :

- le drop vers `Termine` ouvre une boite de dialogue ;
- le cout fixe est obligatoire ou valide ;
- le cout est sauvegarde en SQLite ;
- le cout par item est calcule ;
- la page `Couts` existe ;
- la page affiche ancien cout, nouveau cout et total ;
- les tests ci-dessus passent.
