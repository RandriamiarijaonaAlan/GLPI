# Pattern Métier — Même fonction pour l'import et l'interface

## Principe

Une seule **fonction métier** est la source de vérité.
Elle ne sait pas d'où viennent les données : formulaire React ou fichier CSV.
L'interface et l'import l'appellent tous les deux avec les mêmes paramètres.

```
Formulaire manuel ──┐
                    ├──► fonction métier ──► API GLPI / SQLite
Import CSV      ────┘
```

---

## 1. TICKETS

### Fonction métier
**`src/api/ticketsApi.js`**

```js
export async function creerTicket(donneesTicket) {
  // construit le payload GLPI (titre, contenu, type, statut…)
  // essaie API v2, bascule sur v1 si échec
  // retourne { id, ...réponseGLPI }
}
```

| Paramètre     | Défaut | Description                           |
|---------------|--------|---------------------------------------|
| `titre`       | —      | Nom du ticket (obligatoire)           |
| `description` | `''`   | Corps du ticket                       |
| `type`        | `1`    | 1 = Incident, 2 = Demande             |
| `urgence`     | `3`    | 1 (très basse) → 6 (majeure)          |
| `priorite`    | `3`    | 1 (très basse) → 6 (majeure)          |
| `status`      | `1`    | 1=Nouveau … 6=Clos                    |
| `refTicket`   | `''`   | Référence CSV écrite dans le contenu  |

### Appel depuis l'interface
**`src/frontoffice/pages/CreationTicket.jsx`**

```js
import { creerTicket } from '../../api/ticketsApi';

const ticketCree = await creerTicket({
  titre:       formulaire.titre,
  description: formulaire.description,
  type:        Number(formulaire.type),
  urgence:     Number(formulaire.urgence),
  priorite:    Number(formulaire.priorite),
});
```

### Appel depuis l'import CSV
**`src/api/importApi.js`** → `importerTicketsCsv()`

```js
import { creerTicket } from './ticketsApi';

const ticketCree = await creerTicket({
  titre,
  description,
  type:      convertirTypeTicket(valeurColonneCsv(ligne, 'type')),
  urgence:   convertirPrioriteTicket(valeurColonneCsv(ligne, 'priority')),
  priorite:  convertirPrioriteTicket(valeurColonneCsv(ligne, 'priority')),
  status:    convertirStatutTicket(valeurColonneCsv(ligne, 'status')),
  refTicket,
});
const idTicket = ticketCree.id;
```

> L'import applique ensuite la date CSV via `mettreAJourDateTicket()` et crée les liens `Item_Ticket` — étapes propres à l'import, hors fonction métier.

---

## 2. COÛTS DE TICKET

### Fonction métier
**`src/api/ticketsApi.js`**

```js
export async function creerCoutTicket(idTicket, donneesCout) {
  // construit le payload TicketCost GLPI
  // retourne la réponse GLPI
}
```

| Paramètre          | Description                        |
|--------------------|------------------------------------|
| `idTicket`         | ID du ticket GLPI                  |
| `donneesCout.nom`  | Nom du coût (optionnel)            |
| `donneesCout.dureeSecondes` | Durée en secondes         |
| `donneesCout.coutTemps`     | Coût horaire                |
| `donneesCout.coutFixe`      | Coût fixe                   |

### Appel depuis l'interface
**`src/frontoffice/pages/CreationTicket.jsx`**

```js
import { creerCoutTicket } from '../../api/ticketsApi';

await creerCoutTicket(idTicket, {
  dureeSecondes: formulaire.dureeSecondes,
  coutTemps:     formulaire.coutTemps,
  coutFixe:      formulaire.coutFixe,
  // nom non passé → libellé par défaut "Coût saisi depuis NewAPP"
});
```

### Appel depuis l'import CSV
**`src/api/importApi.js`** → `importerCoutsCsv()`

```js
import { creerCoutTicket } from './ticketsApi';

await creerCoutTicket(ticket.id, {
  nom:           `NEWAPP_IMPORT_JUIN_2026 - Ref ${numTicket}`,
  dureeSecondes: convertirNombreCsv(valeurColonneCsv(ligne, 'duration_second'), 0),
  coutTemps:     convertirNombreCsv(valeurColonneCsv(ligne, 'time_cost'), 0),
  coutFixe:      convertirNombreCsv(valeurColonneCsv(ligne, 'fixed_cost'), 0),
});
```

---

## 3. ÉLÉMENTS DU PARC (ASSETS)

### Fonction métier
**`src/api/assetsApi.js`**

```js
export async function creerElement(itemtype, corpsElement) {
  // essaie API v1 → v2 → v1 minimal (fallback)
  // retourne { id, ...réponseGLPI }
}
```

| Paramètre            | Description                                          |
|----------------------|------------------------------------------------------|
| `itemtype`           | `'Computer'`, `'Monitor'`, `'Printer'`…             |
| `corpsElement.name`  | Nom de l'élément (obligatoire)                       |
| `corpsElement.*`     | `states_id`, `locations_id`, `manufacturers_id`…    |

> Pas encore de formulaire UI pour créer des éléments — la fonction est prête pour le jour où il sera créé.

### Appel depuis l'import CSV
**`src/api/importApi.js`** → `importerElementsCsv()`

```js
import { creerElement } from './assetsApi';

ajouterLog(`Création asset ${itemType}`);
const elementCree = await creerElement(itemType, {
  name:             nom,
  entities_id:      0,
  comment:          commentaireImport,
  otherserial:      numeroInventaire,
  states_id:        etatGlpi,
  locations_id:     localisationGlpi,
  manufacturers_id: fabricantGlpi,
  [champModele]:    modeleGlpi,
  users_id:         utilisateurGlpi,
});
const idCree = elementCree.id;
```

> L'import résout ou crée les référentiels (état, localisation, fabricant, modèle, utilisateur) avant d'appeler `creerElement()`.

---

## 4. MOUVEMENTS KANBAN

### Fonctions métier
**`src/api/kanbanCostsApi.js`**

```js
export async function creerCoutKanbanSqlite(donnees)           // close
export async function reouvrirDernierCoutKanbanSqlite(ticketId, pourcentage) // open
export async function supprimerDernierCoutKanbanSqlite(ticketId)             // cancel
```

### Appel depuis l'interface
**`src/frontoffice/pages/KanbanTicket.jsx`**

```js
import {
  creerCoutKanbanSqlite,
  reouvrirDernierCoutKanbanSqlite,
  supprimerDernierCoutKanbanSqlite,
} from '../../api/kanbanCostsApi';

// Ticket glissé vers "Terminé" → close
await creerCoutKanbanSqlite({
  ticketId: dialogueCout.ticket.id,
  coutFixe,
  commentaire: formulaireCout.commentaire,
  nombreItems,
  items: detail.elementsLies || [],
});

// Ticket glissé vers "In progress" → open (réouverture)
await reouvrirDernierCoutKanbanSqlite(ticket.id, pourcentage);

// Ticket glissé vers "In progress" → cancel (annulation)
await supprimerDernierCoutKanbanSqlite(ticket.id);
```

### Appel depuis l'import CSV
**`src/api/importMouvementsApi.js`** → `importerMouvementsCsv()`

```js
import {
  creerCoutKanbanSqlite,
  reouvrirDernierCoutKanbanSqlite,
  supprimerDernierCoutKanbanSqlite,
} from './kanbanCostsApi';

// action = 'close'
await creerCoutKanbanSqlite({
  ticketId: ticketGlpiId,
  coutFixe,
  commentaire: 'Import close',
  nombreItems: 1,
  items: [],
});

// action = 'open'
await reouvrirDernierCoutKanbanSqlite(ticketGlpiId, pourcentage);

// action = 'cancel'
await supprimerDernierCoutKanbanSqlite(ticketGlpiId);
```

---

## Récapitulatif des chemins

| Type | Fonction métier | Fichier métier | Interface | Import |
|------|----------------|----------------|-----------|--------|
| Ticket | `creerTicket()` | `src/api/ticketsApi.js` | `src/frontoffice/pages/CreationTicket.jsx` | `src/api/importApi.js` |
| Coût | `creerCoutTicket()` | `src/api/ticketsApi.js` | `src/frontoffice/pages/CreationTicket.jsx` | `src/api/importApi.js` |
| Asset | `creerElement()` | `src/api/assetsApi.js` | *(pas de formulaire UI)* | `src/api/importApi.js` |
| Mvt close | `creerCoutKanbanSqlite()` | `src/api/kanbanCostsApi.js` | `src/frontoffice/pages/KanbanTicket.jsx` | `src/api/importMouvementsApi.js` |
| Mvt open | `reouvrirDernierCoutKanbanSqlite()` | `src/api/kanbanCostsApi.js` | `src/frontoffice/pages/KanbanTicket.jsx` | `src/api/importMouvementsApi.js` |
| Mvt cancel | `supprimerDernierCoutKanbanSqlite()` | `src/api/kanbanCostsApi.js` | `src/frontoffice/pages/KanbanTicket.jsx` | `src/api/importMouvementsApi.js` |

---

## Ajouter un nouveau champ

**Sur un ticket :** modifier `creerCorpsTicket()` dans `src/api/ticketsApi.js` — l'interface et l'import en bénéficient automatiquement.

**Sur un élément :** passer le champ dans `corpsElement` lors de l'appel à `creerElement()` dans `importerElementsCsv()`.

**Un seul endroit à modifier pour la logique GLPI.**
