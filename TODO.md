# TODO — Évaluation Série 2 · Jour 1

> **Stack détectée**
> - PHP 8.2.10 · MariaDB 10.11.8 · Apache 2.4.57 (Ubuntu)
> - Node v20.20.2 · npm 10.8.2
> - NewAPP : React 19 + Vite 8 (starter vide)
> - CSV disponibles dans `/home/alan/Bureau/GLPI/`

---

## 0. ExistingApp — Installer et configurer GLPI

### 0.1 Télécharger GLPI 11.0.7
- [ ] Télécharger l'archive sur https://github.com/glpi-project/glpi/releases
- [ ] Extraire dans `/var/www/html/glpi/`
  ```bash
  sudo tar -xzf glpi-11.0.7.tgz -C /var/www/html/
  sudo chown -R www-data:www-data /var/www/html/glpi
  sudo chmod -R 755 /var/www/html/glpi
  ```

### 0.2 Configurer Apache pour GLPI
- [ ] Créer le vhost `/etc/apache2/sites-available/glpi.conf` :
  ```apache
  <VirtualHost *:80>
      ServerName glpi.local
      DocumentRoot /var/www/html/glpi/public
      <Directory /var/www/html/glpi/public>
          AllowOverride All
          Require all granted
      </Directory>
      ErrorLog ${APACHE_LOG_DIR}/glpi_error.log
  </VirtualHost>
  ```
- [ ] Activer le vhost et le module rewrite :
  ```bash
  sudo a2ensite glpi.conf
  sudo a2enmod rewrite
  sudo systemctl restart apache2
  ```
- [ ] Ajouter dans `/etc/hosts` : `127.0.0.1 glpi.local`

### 0.3 Créer la base de données MySQL
- [ ] Se connecter à MariaDB :
  ```bash
  sudo mysql -u root
  ```
- [ ] Créer la BDD et l'utilisateur :
  ```sql
  CREATE DATABASE glpi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'glpi'@'localhost' IDENTIFIED BY 'glpi_password';
  GRANT ALL PRIVILEGES ON glpi.* TO 'glpi'@'localhost';
  FLUSH PRIVILEGES;
  ```

### 0.4 Extensions PHP requises
- [ ] Vérifier/installer les extensions :
  ```bash
  sudo apt install php8.2-mysql php8.2-curl php8.2-gd php8.2-mbstring \
    php8.2-xml php8.2-zip php8.2-intl php8.2-ldap php8.2-bz2
  sudo systemctl restart apache2
  ```

### 0.5 Finaliser l'installation GLPI
- [ ] Ouvrir http://glpi.local dans le navigateur
- [ ] Suivre l'assistant d'installation (BDD: `glpi`, user: `glpi`, pass: `glpi_password`)
- [ ] Login par défaut : `glpi / glpi` → changer le mot de passe
- [ ] Supprimer le fichier d'installation :
  ```bash
  sudo rm /var/www/html/glpi/install/install.php
  ```

### 0.6 Activer l'API REST GLPI
- [ ] Dans GLPI : Configuration → Général → API
  - Activer l'API REST : **Oui**
  - Activer la connexion avec identifiants : **Oui**
  - URL de l'API : `http://glpi.local/apirest.php`
- [ ] Créer un token d'API : Configuration → Général → API → Ajouter un client API
  - Nom : `NewAPP`
  - Régénérer le token → noter le `app_token`
- [ ] Tester l'API :
  ```bash
  curl -X GET "http://glpi.local/apirest.php/initSession" \
    -H "Content-Type: application/json" \
    -H "Authorization: user_token VOTRE_TOKEN" \
    -H "App-Token: VOTRE_APP_TOKEN"
  ```

---

## 1. NewAPP — Setup du projet

### 1.1 Structure des dossiers à créer
```
NewAPP/
├── backend/          ← Node/Express + SQLite
│   ├── src/
│   │   ├── db/       ← schema SQLite + seed
│   │   ├── routes/   ← endpoints API
│   │   └── server.js
│   ├── uploads/      ← fichiers CSV/ZIP uploadés
│   ├── images/       ← images extraites du ZIP
│   └── package.json
└── src/              ← React (existant)
    ├── pages/
    │   ├── backoffice/
    │   └── frontoffice/
    ├── components/
    ├── hooks/
    └── api/          ← fonctions fetch vers le backend
```

### 1.2 Installer les dépendances React (frontend)
```bash
cd NewAPP
npm install react-router-dom axios
# UI au choix :
npm install tailwindcss @tailwindcss/vite   # option Tailwind
# OU
npm install @mui/material @emotion/react @emotion/styled  # option MUI
```

### 1.3 Configurer Tailwind (si choisi)
- [ ] Dans `NewAPP/vite.config.js` :
  ```js
  import tailwindcss from '@tailwindcss/vite'
  export default defineConfig({
    plugins: [react(), tailwindcss()],
  })
  ```
- [ ] Dans `NewAPP/src/index.css` ajouter : `@import "tailwindcss";`

### 1.4 Configurer le proxy Vite (évite les erreurs CORS)
- [ ] Dans `NewAPP/vite.config.js` :
  ```js
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
  ```

### 1.5 Initialiser le backend Node/Express
```bash
cd NewAPP/backend
npm init -y
npm install express better-sqlite3 multer csv-parse unzipper cors dotenv
npm install -D nodemon
```
- [ ] Dans `backend/package.json`, ajouter :
  ```json
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js"
  },
  "type": "commonjs"
  ```

### 1.6 Variables d'environnement
- [ ] Créer `NewAPP/backend/.env` :
  ```env
  PORT=3001
  DB_PATH=./src/db/newapp.sqlite
  UPLOAD_DIR=./uploads
  IMAGES_DIR=./images
  BACKOFFICE_CODE=ADM-2026
  GLPI_API_URL=http://glpi.local/apirest.php
  GLPI_APP_TOKEN=VOTRE_APP_TOKEN
  GLPI_USER_TOKEN=VOTRE_USER_TOKEN
  ```
- [ ] Créer `NewAPP/.env` (frontend) :
  ```env
  VITE_API_URL=http://localhost:3001/api
  ```

---

## 2. SQLite — Schéma de base de données

- [ ] Créer `NewAPP/backend/src/db/schema.sql` :
  ```sql
  CREATE TABLE IF NOT EXISTS elements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT,
    location TEXT,
    manufacturer TEXT,
    item_type TEXT,
    model TEXT,
    inventory_number TEXT UNIQUE,
    user_assigned TEXT,
    image_path TEXT
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_ticket INTEGER,
    date TEXT,
    heure TEXT,
    type TEXT,
    titre TEXT,
    description TEXT,
    status TEXT DEFAULT 'New',
    priority TEXT DEFAULT 'Medium'
  );

  CREATE TABLE IF NOT EXISTS ticket_elements (
    ticket_id INTEGER,
    element_name TEXT,
    FOREIGN KEY(ticket_id) REFERENCES tickets(id)
  );

  CREATE TABLE IF NOT EXISTS ticket_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    num_ticket INTEGER,
    duration_second INTEGER DEFAULT 0,
    time_cost REAL DEFAULT 0,
    fixed_cost REAL DEFAULT 0
  );
  ```

> **Correspondance CSV → tables :**
> - `Feuille 1` (Name, Status, Location, Manufacturer, Item_Type, Model, Inventory_Number, User) → table `elements`
> - `Feuille 2` (Ref_Ticket, Date, Heure, Type, Titre, Description, Status, Priority, Items) → tables `tickets` + `ticket_elements`
> - `Feuille 3` (Num_Ticket, Duration_second, Time_Cost, Fixed_Cost) → table `ticket_costs`

---

## 3. Backend — Endpoints API à créer

### 3.1 Auth backoffice
- [ ] `POST /api/auth/login` — vérifie le code unique, retourne un JWT ou cookie de session
- [ ] `GET  /api/auth/verify` — vérifie si la session est valide

### 3.2 Import
- [ ] `POST /api/import/csv` — upload + parse CSV, insert dans SQLite
  - Utiliser `multer` pour l'upload (`uploads/`)
  - Utiliser `csv-parse` pour le parsing
  - Détecter automatiquement le type de fichier (colonnes)
- [ ] `POST /api/import/zip` — upload ZIP, extraire images dans `images/`
  - Utiliser `unzipper` pour extraire
  - Lier chaque image à un élément via le nom de fichier
- [ ] `POST /api/reset` — vider toutes les tables SQLite + supprimer images

### 3.3 Éléments
- [ ] `GET  /api/elements` — liste avec filtres query params (`?type=&location=&search=`)
- [ ] `GET  /api/elements/:id` — détail

### 3.4 Tickets
- [ ] `GET  /api/tickets` — liste avec filtre (`?type=&status=`)
- [ ] `GET  /api/tickets/:id` — détail + éléments associés + coûts
- [ ] `POST /api/tickets` — créer un ticket + associations

### 3.5 Stats (dashboard)
- [ ] `GET  /api/stats` — retourne :
  ```json
  {
    "elements": { "total": 9, "by_type": { "Computer": 7, "Monitor": 2 } },
    "tickets":  { "total": 1, "by_type": { "Incident": 1 }, "by_status": { "New": 1 } }
  }
  ```

---

## 4. Frontend React — Pages à créer

### 4.1 Routing (`src/main.jsx`)
- [ ] Configurer `react-router-dom` :
  ```jsx
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/backoffice" element={<ProtectedRoute><BackofficeLayout /></ProtectedRoute>}>
      <Route index element={<Dashboard />} />
      <Route path="import" element={<Import />} />
      <Route path="reset" element={<Reset />} />
      <Route path="tickets" element={<TicketsList />} />
      <Route path="tickets/:id" element={<TicketDetail />} />
    </Route>
    <Route path="/" element={<FrontofficeLayout />}>
      <Route index element={<ElementsList />} />
      <Route path="tickets/new" element={<CreateTicket />} />
    </Route>
  </Routes>
  ```

### 4.2 Page Login (`/login`)
- [ ] Champ code pré-rempli avec la valeur par défaut (`ADM-2026`)
- [ ] POST vers `/api/auth/login`
- [ ] Stocker le token dans `localStorage` ou cookie
- [ ] Rediriger vers `/backoffice` si succès

### 4.3 Composant `ProtectedRoute`
- [ ] Vérifier token via `GET /api/auth/verify`
- [ ] Rediriger vers `/login` si non authentifié

### 4.4 Page Dashboard (`/backoffice`)
- [ ] Fetch `GET /api/stats`
- [ ] Afficher total éléments + breakdown par type (tableau ou bar chart)
- [ ] Afficher total tickets + breakdown par type et statut
- [ ] Optionnel : graphique avec `recharts` (`npm install recharts`)

### 4.5 Page Import (`/backoffice/import`)
- [ ] 4 zones de drop/upload (3 CSV + 1 ZIP)
- [ ] Identifier clairement chaque fichier attendu
- [ ] Upload via `FormData` → `POST /api/import/csv` ou `/api/import/zip`
- [ ] Afficher résultat : nb lignes insérées / erreurs

### 4.6 Page Reset (`/backoffice/reset`)
- [ ] Bouton "Réinitialiser toutes les données"
- [ ] Modale de confirmation avant action
- [ ] `POST /api/reset` → feedback succès/erreur

### 4.7 Page Tickets backoffice (`/backoffice/tickets`)
- [ ] Tableau : Ref, Date, Type, Titre, Statut, Priorité
- [ ] Clic → fiche détail (`/backoffice/tickets/:id`)
- [ ] Fiche : tous les champs + éléments associés + coûts

### 4.8 Page Liste éléments (`/`)
- [ ] Fetch `GET /api/elements` avec params de filtre
- [ ] Champs de recherche : texte libre (nom), select Type, select Lieu, select Statut
- [ ] Affichage en grille ou tableau avec image si disponible

### 4.9 Page Créer ticket (`/tickets/new`)
- [ ] Formulaire : Titre, Description, Type (Incident/Demande), Priorité
- [ ] Sélection multiple d'éléments (checkbox ou multi-select)
  - Charger la liste via `GET /api/elements`
- [ ] `POST /api/tickets` → confirmation + redirect

---

## 5. ExistingApp — Synchronisation GLPI ↔ NewAPP

- [ ] Choisir la stratégie de synchro :
  - **Option A (recommandée)** : NewAPP lit la BDD MySQL de GLPI directement via le backend Node (`npm install mysql2`)
  - **Option B** : NewAPP appelle l'API REST GLPI pour lire/écrire les données
- [ ] Vérifier que les éléments importés (CSV Feuille 1) sont visibles dans GLPI → Assets → Ordinateurs
- [ ] Vérifier que les tickets importés (CSV Feuille 2) sont visibles dans GLPI → Assistance → Tickets
- [ ] Tester : modifier un ticket dans GLPI → vérifier que le changement apparaît dans NewAPP

---

## 6. Checklist finale

- [ ] GLPI accessible sur http://glpi.local
- [ ] Backend Node tourne sur http://localhost:3001
- [ ] NewAPP React tourne sur http://localhost:5173
- [ ] Code backoffice pré-rempli et fonctionnel
- [ ] Import des 3 CSV réussi (9 éléments + tickets + coûts)
- [ ] Import du ZIP images réussi
- [ ] Dashboard affiche les stats correctes
- [ ] Recherche multi-critères fonctionne
- [ ] Création de ticket avec association d'éléments fonctionne
- [ ] Données GLPI et NewAPP sont cohérentes
- [ ] README avec instructions de lancement

---

## Ordre de réalisation suggéré

| Priorité | Tâche |
|----------|-------|
| 1 | Installer GLPI (§0) |
| 2 | Init backend Node + schéma SQLite (§1.5 + §2) |
| 3 | Endpoints import CSV/ZIP + reset (§3.2) |
| 4 | Auth backoffice + ProtectedRoute (§3.1 + §4.2-4.3) |
| 5 | Page import + reset (§4.5-4.6) |
| 6 | Endpoints stats + éléments + tickets (§3.3-3.5) |
| 7 | Dashboard (§4.4) |
| 8 | Page tickets backoffice (§4.7) |
| 9 | Frontoffice liste éléments (§4.8) |
| 10 | Frontoffice créer ticket (§4.9) |
| 11 | Synchronisation GLPI ↔ NewAPP (§5) |
