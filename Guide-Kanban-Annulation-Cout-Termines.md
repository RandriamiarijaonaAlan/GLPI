# Guide - Annulation d'un cout Kanban

Objectif : quand un ticket deja dans la colonne `Termine` est deplace vers `In progress`, afficher une boite de dialogue avec deux choix :

- `Annulation` : le ticket repasse en cours et le dernier cout manuel enregistre pour ce ticket est supprime de SQLite.
- `Reouverture` : le ticket repasse en cours, on saisit un pourcentage comme `10%`, et ce pourcentage est ajoute au dernier cout manuel du ticket.

Ce guide decrit les etapes a realiser dans le code, dans l'ordre.

## 1. Ajouter une route backend pour supprimer le dernier cout

Fichier :

```text
glpi-newapp/backend/server.js
```

Ajouter une route `DELETE` apres les routes `/api/kanban/costs` existantes :

```js
app.delete("/api/kanban/costs/latest/:ticketId", (req, res) => {
  const ticketId = Number(req.params.ticketId);

  if (!ticketId || Number.isNaN(ticketId)) {
    return res.status(400).json({ message: "ticketId invalide" });
  }

  const dernierCout = db.prepare(`
    SELECT id
    FROM kanban_ticket_costs
    WHERE ticket_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 1
  `).get(ticketId);

  if (!dernierCout) {
    return res.json({
      supprime: false,
      message: "Aucun cout a supprimer pour ce ticket",
    });
  }

  db.prepare("DELETE FROM kanban_ticket_costs WHERE id = ?").run(dernierCout.id);

  return res.json({
    supprime: true,
    id: dernierCout.id,
  });
});
```

Cette route supprime uniquement le dernier cout manuel du ticket, pas tous les couts.

Ajouter aussi une route `PATCH` pour le choix `Reouverture`. Cette route garde le dernier cout, mais augmente son `cout_fixe` avec le pourcentage saisi.

```js
app.patch("/api/kanban/costs/latest/:ticketId/reopen", (req, res) => {
  const ticketId = Number(req.params.ticketId);
  const pourcentage = Number(String(req.body.pourcentage || 0).replace("%", "").replace(",", "."));

  if (!ticketId || Number.isNaN(ticketId)) {
    return res.status(400).json({ message: "ticketId invalide" });
  }

  if (Number.isNaN(pourcentage) || pourcentage < 0) {
    return res.status(400).json({ message: "pourcentage invalide" });
  }

  const dernierCout = db.prepare(`
    SELECT id, cout_fixe, nombre_items
    FROM kanban_ticket_costs
    WHERE ticket_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 1
  `).get(ticketId);

  if (!dernierCout) {
    return res.status(404).json({ message: "Aucun cout a mettre a jour pour ce ticket" });
  }

  const ancienCout = Number(dernierCout.cout_fixe || 0);
  const nouveauCout = ancienCout + (ancienCout * pourcentage) / 100;
  const nombreItems = Math.max(1, Number(dernierCout.nombre_items || 1));
  const coutParItem = nouveauCout / nombreItems;

  db.prepare(`
    UPDATE kanban_ticket_costs
    SET cout_fixe = ?,
        cout_par_item = ?,
        commentaire = COALESCE(commentaire, '') || ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    nouveauCout,
    coutParItem,
    ` | Reouverture +${pourcentage}%`,
    dernierCout.id,
  );

  return res.json({
    id: dernierCout.id,
    ancien_cout: ancienCout,
    nouveau_cout: nouveauCout,
    pourcentage,
    cout_par_item: coutParItem,
  });
});
```

## 2. Ajouter la fonction API frontend

Fichier :

```text
glpi-newapp/src/api/kanbanCostsApi.js
```

Ajouter cette fonction :

```js
export async function supprimerDernierCoutKanbanSqlite(ticketId) {
  const reponse = await clientKanbanCosts.delete(`/kanban/costs/latest/${ticketId}`);
  return reponse.data;
}
```

Ajouter aussi la fonction pour le choix `Reouverture` :

```js
export async function reouvrirDernierCoutKanbanSqlite(ticketId, pourcentage) {
  const reponse = await clientKanbanCosts.patch(`/kanban/costs/latest/${ticketId}/reopen`, {
    pourcentage,
  });

  return reponse.data;
}
```

## 3. Importer la fonction dans le Kanban

Fichier :

```text
glpi-newapp/src/frontoffice/pages/KanbanTicket.jsx
```

Modifier l'import existant :

```js
import {
  creerCoutKanbanSqlite,
  supprimerDernierCoutKanbanSqlite,
  reouvrirDernierCoutKanbanSqlite,
} from "../../api/kanbanCostsApi";
```

## 4. Detecter le deplacement de Termine vers In progress

Dans `KanbanTicket.jsx`, la fonction importante est :

```js
async function deposerTicket(codeColonne) {
```

Il faut verifier :

- le ticket glisse existe ;
- la colonne cible est `in_progress` ;
- le ticket vient de `Termine`.

Ajouter une fonction utilitaire pour lire le statut GLPI du ticket :

```js
function lireStatutTicket(ticket) {
  if (typeof ticket.status === "object") {
    return Number(ticket.status.id || ticket.status.value);
  }

  return Number(ticket.status);
}
```

Dans GLPI, le statut termine/clos est generalement `6`. Si dans votre projet `Termine` utilise `5`, utiliser la valeur venant de la configuration Kanban.

## 5. Ouvrir une boite de dialogue d'annulation

Ajouter un state :

```js
const [dialogueAnnulationCout, setDialogueAnnulationCout] = useState(null);
const [soumissionAnnulationCout, setSoumissionAnnulationCout] = useState(false);
const [modeAnnulationCout, setModeAnnulationCout] = useState("annulation");
const [pourcentageReouverture, setPourcentageReouverture] = useState("");
```

Dans `deposerTicket`, avant le changement de statut normal :

```js
const statutActuel = lireStatutTicket(ticketGlisse);

if (codeColonne === "in_progress" && statutActuel === 6) {
  setDialogueAnnulationCout({
    ticket: ticketGlisse,
    statutGlpi,
  });
  setModeAnnulationCout("annulation");
  setPourcentageReouverture("");
  return;
}
```

Si votre statut `Termine` vaut `5`, remplacer `6` par `5`.

## 6. Valider l'annulation ou la reouverture

Ajouter cette fonction dans `KanbanTicket.jsx` :

```js
async function validerAnnulationCout() {
  if (!dialogueAnnulationCout) return;

  const pourcentage = Number(String(pourcentageReouverture).replace("%", "").replace(",", "."));

  if (modeAnnulationCout === "reouverture" && (Number.isNaN(pourcentage) || pourcentage < 0)) {
    alert("Pourcentage invalide.");
    return;
  }

  setSoumissionAnnulationCout(true);

  try {
    await modifierStatutTicketKanban(
      dialogueAnnulationCout.ticket.id,
      dialogueAnnulationCout.statutGlpi,
    );

    if (modeAnnulationCout === "annulation") {
      await supprimerDernierCoutKanbanSqlite(dialogueAnnulationCout.ticket.id);
    } else {
      await reouvrirDernierCoutKanbanSqlite(dialogueAnnulationCout.ticket.id, pourcentage);
    }

    setDialogueAnnulationCout(null);
    setTicketGlisse(null);
    await chargerDonnees();
  } catch (e) {
    console.error(e);
    alert("Erreur lors de l'annulation du cout.");
  } finally {
    setSoumissionAnnulationCout(false);
  }
}
```

Ajouter aussi la fonction d'annulation simple :

```js
function fermerDialogueAnnulationCout() {
  if (soumissionAnnulationCout) return;
  setDialogueAnnulationCout(null);
  setTicketGlisse(null);
  setModeAnnulationCout("annulation");
  setPourcentageReouverture("");
}
```

## 7. Ajouter la boite de dialogue dans le JSX

Ajouter dans le `return`, a cote des autres modales :

```jsx
{dialogueAnnulationCout && (
  <div style={styles.modalFond} onClick={fermerDialogueAnnulationCout}>
    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
      <h2>Annulation ou reouverture</h2>
      <p>
        Le ticket #{dialogueAnnulationCout.ticket.id} va repasser en In progress.
      </p>

      <label>
        <input
          type="radio"
          name="mode-annulation-cout"
          value="annulation"
          checked={modeAnnulationCout === "annulation"}
          onChange={() => setModeAnnulationCout("annulation")}
        />
        Annulation : supprimer le dernier cout manuel.
      </label>

      <label>
        <input
          type="radio"
          name="mode-annulation-cout"
          value="reouverture"
          checked={modeAnnulationCout === "reouverture"}
          onChange={() => setModeAnnulationCout("reouverture")}
        />
        Reouverture : ajouter un pourcentage au dernier cout.
      </label>

      {modeAnnulationCout === "reouverture" && (
        <label style={styles.champModal}>
          Pourcentage de reouverture
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Ex : 10"
            value={pourcentageReouverture}
            onChange={(e) => setPourcentageReouverture(e.target.value)}
            required
          />
        </label>
      )}

      <div style={styles.actionsModal}>
        <button
          type="button"
          style={styles.bouton}
          onClick={validerAnnulationCout}
          disabled={soumissionAnnulationCout}
        >
          {soumissionAnnulationCout ? "Traitement..." : "Confirmer"}
        </button>
        <button
          type="button"
          style={styles.boutonSecondaire}
          onClick={fermerDialogueAnnulationCout}
          disabled={soumissionAnnulationCout}
        >
          Fermer
        </button>
      </div>
    </div>
  </div>
)}
```

## 8. Adapter le cas du statut Termine

Pour eviter de coder `6` en dur, on peut recuperer le statut GLPI de la colonne `termine` depuis la configuration :

```js
function obtenirStatutGlpiColonne(codeColonne) {
  const colonne = configuration.find((item) => item.code === codeColonne);
  return Number(colonne?.statutGlpi || colonne?.statut_glpi || 0);
}
```

Puis dans `deposerTicket` :

```js
const statutTermine = obtenirStatutGlpiColonne("termine");
const statutActuel = lireStatutTicket(ticketGlisse);

if (codeColonne === "in_progress" && statutActuel === statutTermine) {
  setDialogueAnnulationCout({
    ticket: ticketGlisse,
    statutGlpi,
  });
  return;
}
```

C'est plus propre si la configuration Kanban change entre `5` et `6`.

## 9. Exemple de calcul pour reouverture

Si le dernier cout manuel du ticket est :

```text
cout_fixe = 150
pourcentage = 10
```

Alors le nouveau cout devient :

```text
150 + (150 * 10 / 100) = 165
```

Si le ticket a 2 assets lies :

```text
cout_par_item = 165 / 2 = 82.50
```

## 10. Tests a faire

### Test 1 - Annulation simple

1. Ouvrir `/front/kanban`.
2. Prendre un ticket deja dans `Termine`.
3. Le glisser vers `In progress`.
4. Verifier que la boite de dialogue `Annulation` apparait.
5. Cliquer sur `Confirmer`.
6. Verifier que le ticket passe dans `In progress`.
7. Verifier que le dernier cout du ticket disparait dans `/admin/couts`.

### Test 2 - Fermeture sans confirmation

1. Glisser un ticket de `Termine` vers `In progress`.
2. Fermer la boite de dialogue.
3. Verifier que le ticket reste dans `Termine`.
4. Verifier qu'aucun cout n'est supprime.

### Test 3 - Ticket sans cout

1. Mettre un ticket sans cout dans `Termine`.
2. Le glisser vers `In progress`.
3. Confirmer l'annulation.
4. Le ticket doit repasser en `In progress`.
5. La suppression du cout doit simplement repondre qu'il n'y avait rien a supprimer.

### Test 4 - Reouverture avec pourcentage

1. Prendre un ticket `Termine` avec un cout manuel.
2. Le glisser vers `In progress`.
3. Choisir `Reouverture`.
4. Saisir `10`.
5. Confirmer.
6. Verifier que le ticket repasse en `In progress`.
7. Verifier que le dernier cout du ticket a augmente de 10%.
8. Verifier que `/admin/couts` affiche le nouveau total.

## 11. Definition de fini

La demande est terminee quand :

- un ticket `Termine` peut etre remis dans `In progress` ;
- une boite de dialogue `Annulation ou reouverture` apparait avant l'action ;
- si l'utilisateur confirme, le ticket change de statut ;
- en mode `Annulation`, le dernier cout manuel du ticket est supprime dans SQLite ;
- en mode `Reouverture`, le dernier cout manuel du ticket est augmente avec le pourcentage saisi ;
- si l'utilisateur annule, rien ne change ;
- la page `/admin/couts` affiche le total mis a jour.
