# Jour 2 - Guide de realisation NewAPP

Objectif : realiser une page FrontOffice de tickets au format Kanban et une page Backoffice pour configurer les couleurs et les noms malgaches des statuts.

Ce document sert de guide. Il faut suivre les etapes dans l'ordre et valider chaque partie avant de passer a la suivante.

## 1. Preparation

### 1.1. Comprendre le besoin

La nouvelle fonctionnalite doit permettre :

- d'afficher les tickets dans un tableau Kanban ;
- de creer un ticket depuis le tableau ;
- de deplacer un ticket entre les colonnes ;
- de voir les details d'un ticket ;
- de configurer les couleurs et les noms des statuts depuis le Backoffice ;
- de stocker la configuration dans SQLite.

### 1.2. Statuts utilises

Le Kanban utilise uniquement trois colonnes :

- Nouveau
- In progress
- Termine

Les noms malgaches attendus par defaut sont :

- Nouveau : vaovao
- In progress : efa manao
- Termine : vita

### 1.3. Donnees a prevoir

Pour chaque statut Kanban, il faut stocker :

- un identifiant technique ;
- le nom affiche en francais ;
- le nom affiche en malgache ;
- la couleur de fond de la colonne ;
- le statut GLPI correspondant si necessaire.

Exemple de structure logique :

```text
id: nouveau
nom_fr: Nouveau
nom_mg: vaovao
couleur: #cfe8ff
```

## 2. Backoffice - Configuration Kanban

Cette partie doit etre faite avant le FrontOffice, car le FrontOffice doit utiliser les valeurs configurees.

### 2.1. Creer le stockage SQLite

Creer une table SQLite pour stocker la configuration des colonnes Kanban.

Champs recommandes :

- `id`
- `code`
- `nom_fr`
- `nom_mg`
- `couleur`
- `ordre`
- `created_at`
- `updated_at`

Exemple de table :

```sql
CREATE TABLE kanban_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  nom_fr TEXT NOT NULL,
  nom_mg TEXT NOT NULL,
  couleur TEXT NOT NULL,
  ordre INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 2.2. Inserer les valeurs par defaut

Au demarrage ou pendant une migration, inserer les trois statuts si la table est vide.

Valeurs par defaut :

| code | nom_fr | nom_mg | couleur | ordre |
| --- | --- | --- | --- | --- |
| nouveau | Nouveau | vaovao | #cfe8ff | 1 |
| in_progress | In progress | efa manao | #ffe2b8 | 2 |
| termine | Termine | vita | #d8f3d8 | 3 |

### 2.3. Creer les fonctions Backoffice

Prevoir les actions suivantes :

- recuperer la configuration Kanban ;
- modifier la couleur d'une colonne ;
- modifier le nom malgache d'un statut ;
- enregistrer les changements ;
- reinitialiser les valeurs par defaut si besoin.

### 2.4. Creer la page Backoffice

La page Backoffice doit afficher les trois statuts.

Pour chaque statut, afficher :

- le nom francais ;
- un champ couleur ;
- un champ texte pour le nom malgache ;
- un bouton ou une action d'enregistrement.

La page doit aussi afficher :

- un message de succes apres sauvegarde ;
- un message d'erreur si la sauvegarde echoue ;
- un bouton de reinitialisation si necessaire.

### 2.5. Verification Backoffice

Verifier que :

- les trois statuts apparaissent ;
- les couleurs sont modifiables ;
- les noms malgaches sont modifiables ;
- les donnees restent enregistrees apres rechargement de la page ;
- les donnees sont bien stockees dans SQLite.

## 3. FrontOffice - Page Kanban

### 3.1. Creer la route FrontOffice

Ajouter une nouvelle page FrontOffice pour le tableau Kanban.

Route conseillee :

```text
/front/tickets
```

La page d'accueil FrontOffice peut rediriger vers cette page ou proposer un lien vers elle.

### 3.2. Recuperer les donnees

Au chargement de la page, recuperer :

- les tickets ;
- la configuration Kanban depuis SQLite ;
- les couleurs des colonnes ;
- les noms malgaches des statuts.

### 3.3. Afficher le tableau Kanban

Afficher trois colonnes :

- Nouveau
- In progress
- Termine

Chaque colonne doit afficher :

- sa couleur de fond configuree ;
- son nom francais ;
- son nom malgache ;
- le nombre total de tickets dans la colonne ;
- la liste des tickets correspondants.

### 3.4. Afficher les tickets

Chaque ticket doit etre affiche sous forme de carte.

Informations minimales a afficher :

- titre du ticket ;
- identifiant du ticket ;
- priorite si disponible ;
- date de creation si disponible.

La carte doit etre cliquable pour afficher les details.

### 3.5. Ajouter le bouton de creation

Ajouter un bouton :

```text
Ajouter 1 ticket
```

Au clic :

- creer un nouveau ticket ;
- l'ajouter dans la colonne Nouveau ;
- rafraichir le total de la colonne ;
- afficher un message de succes ou d'erreur.

### 3.6. Ajouter le drag and drop

Permettre de glisser un ticket d'une colonne vers une autre.

Regles :

- le ticket peut aller dans n'importe quelle colonne ;
- il n'y a pas d'ordre obligatoire ;
- seuls les trois statuts Kanban sont autorises ;
- apres deplacement, le statut du ticket doit etre mis a jour ;
- les compteurs de colonnes doivent etre recalcules.

### 3.7. Gerer les informations supplementaires

Certains changements de statut peuvent demander des informations supplementaires.

Dans ce cas :

- ouvrir une boite de dialogue ;
- demander les informations necessaires ;
- valider le changement seulement apres saisie ;
- annuler le changement si l'utilisateur ferme ou annule la boite de dialogue.

Exemple :

```text
Passage vers Termine :
- demander une note de resolution
- demander une confirmation
```

### 3.8. Afficher les details du ticket

Au clic sur un ticket, ouvrir une fiche detail.

Informations a afficher :

- identifiant ;
- titre ;
- description ;
- statut ;
- priorite ;
- type ;
- date de creation ;
- date de modification ;
- informations supplementaires si elles existent.

La fiche doit pouvoir etre fermee pour revenir au Kanban.

## 4. Tests fonctionnels

### 4.1. Tests Backoffice

Verifier :

- ouverture de la page de configuration ;
- affichage des trois statuts ;
- modification d'une couleur ;
- modification d'un nom malgache ;
- sauvegarde ;
- rechargement de la page ;
- conservation des valeurs modifiees.

### 4.2. Tests FrontOffice

Verifier :

- ouverture de la page Kanban ;
- affichage des trois colonnes ;
- affichage des tickets ;
- affichage du nombre de tickets par colonne ;
- creation d'un ticket avec le bouton "Ajouter 1 ticket" ;
- deplacement d'un ticket entre les colonnes ;
- ouverture de la boite de dialogue si necessaire ;
- affichage des details au clic sur un ticket.

### 4.3. Tests de coherence

Verifier :

- un ticket ne disparait pas apres changement de statut ;
- les compteurs sont toujours corrects ;
- les couleurs configurees en Backoffice sont visibles en FrontOffice ;
- les noms malgaches configures en Backoffice sont visibles en FrontOffice ;
- seules les trois colonnes prevues sont utilisees.

## 5. Ordre de realisation recommande

1. Creer la table SQLite.
2. Inserer les trois statuts par defaut.
3. Creer les fonctions de lecture et sauvegarde de configuration.
4. Creer la page Backoffice de configuration.
5. Tester la sauvegarde Backoffice.
6. Creer la page FrontOffice Kanban.
7. Recuperer les tickets et les afficher dans les colonnes.
8. Ajouter les compteurs par colonne.
9. Ajouter le bouton "Ajouter 1 ticket".
10. Ajouter le drag and drop.
11. Ajouter la boite de dialogue pour les informations supplementaires.
12. Ajouter la fiche detail ticket.
13. Faire les tests fonctionnels complets.
14. Corriger les erreurs trouvees.
15. Valider la realisation finale.

## 6. Definition de fini

La fonctionnalite est terminee quand :

- le Backoffice permet de configurer les trois colonnes ;
- les valeurs sont stockees dans SQLite ;
- le FrontOffice affiche le Kanban avec les bonnes couleurs ;
- les noms malgaches sont affiches ;
- un ticket peut etre cree ;
- un ticket peut etre deplace entre les colonnes ;
- une boite de dialogue apparait quand des informations supplementaires sont necessaires ;
- les details d'un ticket sont visibles au clic ;
- les compteurs par colonne sont corrects ;
- les tests fonctionnels sont valides.
