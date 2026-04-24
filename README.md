# MeetPrep Assistant

Application desktop Electron pour preparer des rendez-vous client, prendre des notes en direct et generer un compte-rendu PDF.

## 1. Objectif

L application sert a :

- creer un rendez-vous client
- modifier ou supprimer un rendez-vous
- afficher les rendez-vous du jour
- ouvrir un rendez-vous dans une zone de preparation dediee
- suivre une checklist de preparation
- saisir un contexte, un objectif et des notes live
- generer un vrai PDF dans le dossier `Downloads`


## 2. Seed de demonstration

Au premier lancement, si aucun `localStorage` n existe encore, l application cree automatiquement un rendez-vous de demonstration pour faciliter les tests.

Le seed contient :

- client : `Mohamed Saadi`
- entreprise : `SNCF`
- date : la date du jour
- heure : `10:30`
- contexte : un texte de demonstration
- notes : un texte de demonstration 
- checklist : 3 points pre-remplis

Ce seed est defini dans [src/renderer.ts].

Important :

- le seed n apparait qu au premier lancement si aucun etat n est deja sauvegarde
- si vous voulez rejouer le seed, il faut vider le `localStorage` de l application ou repartir d un profil Electron propre

## 3. Mise en route

### Prerequis

- Node.js
- npm

### Installation

```bash
npm install
```

### Lancement

```bash
npm start
```

### Verification du code

```bash
npm run lint
```

## 4. Structure du projet

### Fichiers principaux

- [src/main.ts](/Users/leamyriamachaibou/MeetPrep/src/main.ts)
  Process principal Electron. Cree la fenetre desktop, gere le cycle de vie de l application et genere le PDF natif.

- [src/preload.ts](/Users/leamyriamachaibou/MeetPrep/src/preload.ts)
  Pont securise entre le renderer et Electron. Expose une API minimale au `window`.

- [src/renderer.ts](/Users/leamyriamachaibou/MeetPrep/src/renderer.ts)
  Partie interface. Gere l etat, le rendu HTML, les evenements utilisateur, la persistance locale et la logique metier des rendez-vous.

- [src/index.css](/Users/leamyriamachaibou/MeetPrep/src/index.css)
  Styles globaux.

- [index.html](/Users/leamyriamachaibou/MeetPrep/index.html)
  Point d entree HTML charge par Electron.

## 5. Comment fonctionne l'app Electron dans ce projet

### 5.1 Le process `main`

Le fichier [src/main.ts]correspond au coeur natif Electron.

Il s occupe de :

- creer la fenetre avec `BrowserWindow`
- charger l interface Vite ou les fichiers buildes
- ecouter les appels IPC venant du renderer
- generer le PDF avec `webContents.printToPDF()`
- ecrire le fichier PDF dans `Downloads`

### 5.2 Le `preload`

Le fichier [src/preload.ts] expose une API limitee :

- `window.meetPrep.exportPdf(...)`

Le renderer n appelle donc pas Electron directement. Il passe par cette couche intermediaire, ce qui est plus propre et plus securise.

### 5.3 Le `renderer`

Le fichier [src/renderer.ts] agit comme un frontend classique :

- il maintient un etat global
- il genere l interface HTML
- il ecoute les clics et les saisies
- il sauvegarde les donnees localement
- il demande au `main` de faire les actions desktop

## 6. Persistance des donnees

L application n utilise pas encore une vraie base relationnelle.

Les donnees sont stockees localement dans `localStorage` avec la cle :

```ts
const storageKey = 'meetprep-appointments';
```

Concretement, cela veut dire :

- pas de serveur
- pas de synchronisation distante
- persistance locale sur la machine
- etat retrouve apres fermeture / reouverture de l application

## 7. Entites metier

Meme s il n y a pas encore de base SQL, le projet repose sur un vrai modele de donnees.

### 7.1 `AppState`

Etat global de l application.

```ts
type AppState = {
  appointments: Appointment[];
  draft: AppointmentDraft;
  editingAppointmentId: string | null;
  preparedAppointmentId: string | null;
};
```

Role :

- `appointments` : liste de tous les rendez-vous
- `draft` : brouillon du formulaire de gauche
- `editingAppointmentId` : rendez-vous actuellement edite dans le formulaire
- `preparedAppointmentId` : rendez-vous actuellement ouvert dans la zone de preparation

### 7.2 `Appointment`

Entite principale de l application.

```ts
type Appointment = {
  id: string;
  title: string;
  date: string;
  time: string;
  fields: FormFields;
  preparationChecklist: PreparationItem[];
};
```

### 7.3 `FormFields`

Bloc de contenu textuel rattache a un rendez-vous.

```ts
type FormFields = {
  client: string;
  company: string;
  goal: string;
  notes: string;
};
```

### 7.4 `PreparationItem`

Element de checklist rattache a un rendez-vous.

```ts
type PreparationItem = {
  id: string;
  label: string;
  checked: boolean;
};
```

### 7.5 `AppointmentDraft`

Brouillon du formulaire de creation / modification a gauche.

```ts
type AppointmentDraft = {
  title: string;
  date: string;
  time: string;
  client: string;
  company: string;
};
```

## 8. Relations entre les entites

Si on traduit le projet en logique de base de donnees :

- un `AppState` contient plusieurs `Appointment`
- un `Appointment` contient un bloc `FormFields`
- un `Appointment` contient plusieurs `PreparationItem`
- un `AppointmentDraft` n est pas une entite metier persistante independante en base relationnelle
  c est un brouillon d interface

Vue relationnelle simplifiee :

```txt
AppState
  -> Appointment (1..n)
      -> FormFields (1..1)
      -> PreparationItem (1..n)
```

## 9. Cycle de vie fonctionnel

### 9.1 Ajouter un rendez-vous

1. L utilisateur remplit le formulaire de gauche.
2. Le contenu alimente `state.draft`.
3. Le submit transforme ce brouillon en `Appointment`.
4. Le rendez-vous est ajoute a `state.appointments`.
5. L etat est sauvegarde dans `localStorage`.
6. Le formulaire est reinitialise.

### 9.2 Modifier un rendez-vous

1. L utilisateur clique sur `Modifier`.
2. Le rendez-vous est charge dans le `draft`.
3. L utilisateur enregistre.
4. Les champs du rendez-vous sont mis a jour.

### 9.3 Preparer un rendez-vous

1. La section de droite affiche les `RDV du jour`.
2. L utilisateur clique sur `Preparer le RDV`.
3. L identifiant du rendez-vous est stocke dans `preparedAppointmentId`.
4. Le panneau de preparation affiche :
   - la checklist
   - le contexte / objectif
   - les notes live
5. Chaque modification est sauvegardee.

### 9.4 Exporter le PDF

1. Le renderer construit un HTML de compte-rendu.
2. Le renderer appelle `window.meetPrep.exportPdf(...)`.
3. Le `preload` transmet la requete au `main` via IPC.
4. Le `main` genere un vrai PDF avec Electron.
5. Le PDF est ecrit dans `Downloads`.

Le PDF contient :

- le titre du rendez-vous
- la date / heure du rendez-vous
- la date de generation du document
- le client
- l entreprise
- la checklist de preparation
- le contexte / objectif
- les notes live

## 10. Comportement de l interface

L interface est separee en deux zones :

### Colonne de gauche

- formulaire d ajout / edition
- liste des rendez-vous

Cette colonne ne modifie pas automatiquement la zone de preparation.

### Colonne de droite

- liste des rendez-vous du jour
- bouton `Preparer le RDV`
- panneau de preparation du rendez-vous selectionne

Cette separation permet de :

- creer plusieurs rendez-vous sans ecraser celui en cours de preparation
- preparer un seul rendez-vous a la fois
- garder une logique claire pour la demonstration

## 11. Pourquoi ce projet est utile pour apprendre Electron

Ce projet montre des notions tres concretes :

- creation d une fenetre desktop avec Electron
- separation `main / preload / renderer`
- persistance locale simple
- communication IPC
- rendu d interface sans framework
- gestion d etat manuelle
- export PDF natif

Pour une lecture pedagogique, je recommande l ordre suivant :

1. [src/main.ts](/Users/leamyriamachaibou/MeetPrep/src/main.ts)
2. [src/preload.ts](/Users/leamyriamachaibou/MeetPrep/src/preload.ts)
3. [src/renderer.ts](/Users/leamyriamachaibou/MeetPrep/src/renderer.ts)

## 12. Limites actuelles

Le projet reste volontairement simple :

- stockage dans `localStorage` et non dans SQLite
- tout le renderer est dans un seul fichier TypeScript
- pas de tests automatises
- pas de synchronisation multi-utilisateur

## 13. Evolutions possibles

- migrer le stockage vers SQLite
- separer le code du renderer en modules
- ajouter une recherche / des filtres
- ajouter un statut de rendez-vous
- ajouter la selection d un dossier d export PDF
- ajouter des tests unitaires et end-to-end

## 14. Notes de demonstration

Pour la soutenance ou la correction :

- lancer `npm start`
- verifier que le seed apparait au premier lancement
- ouvrir le rendez-vous du jour via `Preparer le RDV`
- modifier la checklist, le contexte ou les notes
- cliquer sur `Generer le PDF du RDV`
- verifier le PDF dans `Downloads`
