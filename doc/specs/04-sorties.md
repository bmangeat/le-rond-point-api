# Sorties — `/{groupId}/sorties`

## Vue d'ensemble

Les sorties sont des événements ponctuels organisés par un membre du groupe (l'hôte). Chaque sortie a un type, une date, un lieu, et une liste de participants avec RSVP.

---

## Liste des sorties — `/{groupId}/sorties`

### Header

- Titre "Sorties".
- Sous-titre : "[N] sortie(s) à venir · [M] en attente de ta réponse".

### Cards de sorties

Chaque sortie est affichée dans une card cliquable :
- **Glyph type** (emoji dans un fond coloré arrondi, 50×50).
- **Nom** de la sortie (barré + muted si annulée).
- **Chip de statut RSVP** :
  - "Tu viens" (vert)
  - "Sans toi" (rouge)
  - "À répondre" (orange)
  - "Annulée" (gris, si `status = CANCELLED`) — remplace le chip RSVP.
- **Date courte** (ex. "Sam 15 juin · 20:00") avec icône horloge colorée.
- **Ligne basse :** icône épingle + nom du lieu, avatars des participants YES (max 4, style pile) + compteur "[N] présent(s)".
- Sortie annulée : card à 60% d'opacité, glyph en noir et blanc.

### FAB

Bouton "+" flottant → navigue vers `/{groupId}/sorties/nouveau`.

### État vide

Emoji 🎉 + "Aucune sortie prévue" + "Lance la première avec le bouton +".

---

## Création d'une sortie — `/{groupId}/sorties/nouveau`

Plein écran avec header (bouton ✕ + titre "Nouvelle sortie").

### Étape 1 — Type ("C'est quoi le plan ?")

Carrousel horizontal de 4 tuiles :

| Tuile | Emoji | Label court | Couleur accent |
|-------|-------|-------------|----------------|
| BAR | 🍻 | "Bar" | #F59E0B |
| RESTO | 🍕 | "Resto" | #EF4444 |
| SOIREE | 🏡 | "Soirée" | #8B5CF6 |
| SORTIE | 🏕️ | "Sortie" | #10B981 |

- Tuile sélectionnée : bordure colorée, fond teinté, légèrement surélevée.
- La sélection du type adapte automatiquement les **options de logistique** :
  - BAR / RESTO : Tricount activé par défaut, liste désactivée.
  - SOIREE / SORTIE : Liste activée par défaut, Tricount désactivé.

### Étape 2 — Nom et description

- Input texte "Nom de la sortie" (obligatoire), placeholder : "Barbecue chez Max, Anniv de Julie…"
- Textarea optionnelle "Une note pour le groupe ?" (max 500 caractères).

### Étape 3 — Quand ?

- 3 boutons raccourcis : "Ce soir" (20h), "Demain soir" (20h), "Ce week-end" (samedi 14h).
- Input `datetime-local` pour saisie libre.
- Aperçu formaté sous l'input si une date est sélectionnée (ex. "Samedi 15 juin à 20:00").

### Étape 4 — Où ?

- Champ de recherche avec icône loupe.
- Suggestions filtrées selon la saisie.
- Option "Utiliser [texte saisi]" si aucune suggestion ne correspond.
- Une fois un lieu sélectionné : affichage en card avec nom + adresse + bouton "Changer".

### Étape 5 — Logistique

Affiché uniquement si un type est sélectionné.

#### Liste de choses à apporter (SOIREE / SORTIE uniquement)

- Toggle card "🎒 Liste de choses à apporter" (activé par défaut pour SOIREE/SORTIE).
- Si activé : liste des items ajoutés avec bouton ✕, input + bouton "Ajouter", suggestions rapides.

#### Tricount (suivi des dépenses)

- Toggle card "💰 Tricount" (activé par défaut pour BAR/RESTO).

#### Playlist (SOIREE / SORTIE)

- Champ URL playlist optionnel.

### Bouton de création

- Actif uniquement si type + nom + date + lieu sont renseignés.
- Appelle `POST /api/events` → redirige vers `/{groupId}/sorties/{id}`.
- **À la création, une ligne `EventRsvp` avec `status = PENDING` est créée pour chaque membre actif du groupe. L'hôte est automatiquement passé à `YES`.**

---

## Détail d'une sortie — `/{groupId}/sorties/[id]`

Plein écran avec scroll vertical.

### Topbar

- Bouton retour (←).
- "Organisé par [prénom de l'hôte]" ou "Organisé par toi" (ou "Organisateur inconnu" si `hostId = null`).
- Bouton crayon (si hôte ou admin) → `/{groupId}/sorties/{id}/edit`.

### Bannière d'annulation

Affichée si `status = CANCELLED` :
- Fond rouge clair, icône 🚫, texte "Sortie annulée".
- Raison d'annulation si renseignée.

### En-tête de la sortie

- **Glyph** type (62×62, radius 18).
- **Nom** de la sortie (titre h1).
- **Date et heure** formatées avec icône horloge colorée.
- **Description** (si présente, fond `surface-raised`).
- **Lieu** : card cliquable → lien Google Maps.
- **Bouton "Ajouter à mon agenda"** → `GET /api/events/{id}/ics`.

### Onglets (3)

- **"Qui vient"** (toujours présent)
- **"[Logistique / Dépenses / Besoins]"** (affiché uniquement si `needsEnabled` ou `tricountEnabled`)
- **"Le fil"** (toujours présent)

---

### Onglet "Qui vient"

#### Compteur 3 colonnes

Présents / Absents / En attente avec chiffre coloré. Les chiffres sont calculés directement depuis les lignes `EventRsvp` (pré-créées à la création de l'événement).

#### Zone RSVP personnelle

- Si `PENDING` : 2 boutons "👍 Je viens" / "👎 Sans moi".
- Si répondu : banner avec emoji + statut + bouton "Changer" (reset à PENDING).

#### Listes par statut

3 groupes : Présents (vert), En attente (orange), Absents (rouge).
- Chaque groupe : dot coloré + label + compteur.
- Liste de membres : avatar, nom ("Toi" pour soi-même), badge "HÔTE" si applicable, ville.

---

### Onglet "Logistique"

#### Panel Besoins (si `needsEnabled`)

- Liste des items à apporter.
- Chaque item : label + toggle pour se positionner (prendre ou libérer).
- Item pris par quelqu'un d'autre : nom + avatar, bouton désactivé.
- Bouton "+ Ajouter un besoin" → input inline.

#### Panel Tricount (si `tricountEnabled`)

- **Tableau des soldes :** calculé côté serveur via `GET /api/events/{id}/balances`. Renvoie pour chaque participant la liste simplifiée des transactions (minimum de virements). Le serveur calcule, le client affiche.
  - Positif = doit recevoir (vert), négatif = doit payer (rouge).
- **Liste des dépenses :** payeur, libellé, montant, participants.
- **Formulaire d'ajout :** payeur (select), libellé, montant, participants (checkboxes, tous cochés par défaut) → `POST /api/events/{id}/expenses`.

---

### Onglet "Le fil"

#### Playlist

- Si `hasPlaylist = true` et `playlistUrl` renseigné : lien cliquable.
- Bouton "Ajouter / Modifier la playlist" → `PATCH /api/events/{id}/playlist`.
- Tout membre peut définir ou modifier la playlist.

#### Photos

- Galerie de photos (max 5 par sortie).
- Chaque photo affiche : vignette, prénom de l'uploader, et **date d'expiration** ("Disponible jusqu'au [date]" = `Event.whenAt + 7j`).
- Bouton ✕ sur ses propres photos (admin peut supprimer toutes) → `DELETE /api/events/{id}/photos/{photoId}`.
- Bouton "📸 Ajouter une photo" → upload Vercel Blob → `POST /api/events/{id}/photos`.
  - Limite : 5 photos par sortie. Si atteinte, bouton désactivé.
- Bouton "⬇️ Télécharger tout" → `GET /api/events/{id}/photos/zip`.
- **TTL automatique :** photos supprimées 7 jours après `Event.whenAt` (pas après la date d'upload). La date limite est affichée explicitement sur chaque photo. Notif push J-1.

#### Commentaires

- Fil chronologique (le plus récent en bas).
- Chaque commentaire : avatar, nom, texte, date relative.
- Bouton 🗑️ sur ses propres commentaires (admin : tous) → `DELETE /api/events/{id}/comments/{commentId}`.
- Bouton 🚩 signalement → `POST /api/events/{id}/comments/{commentId}/report` → toast.
- Zone de saisie fixée en bas → `POST /api/events/{id}/comments`.
- Anti-profanité côté serveur.
- Mise à jour optimiste pour toutes les actions.

---

## Modification d'une sortie — `/{groupId}/sorties/[id]/edit`

Même formulaire que la création, pré-rempli.

**Champs modifiables :** type, nom, description, date/heure, lieu, `needsEnabled`, `tricountEnabled`, URL playlist.

### Annuler la sortie

- Bouton "Annuler la sortie" → textarea motif optionnelle (max 500 caractères) → confirmation.
- `PATCH /api/events/{id}` `{ status: "CANCELLED", cancelReason: "...", cancelledAt: now }`.
- La sortie passe à `status = CANCELLED`. Elle reste visible avec badge "Annulée".

### Réactiver

- Affiché si annulée → `PATCH /api/events/{id}` `{ status: "ACTIVE", cancelledAt: null, cancelReason: null }`.

### Supprimer définitivement (admin uniquement)

- Confirmation modale avec avertissement.
- `DELETE /api/events/{id}`.
- Supprime en cascade : RSVP, besoins, dépenses (+ participants), commentaires, photos (Blob + DB).
- Redirige vers `/{groupId}/sorties`.

---

## API

| Méthode | Route | Auth requise | Description |
|---------|-------|-------------|-------------|
| `GET` | `/api/events` | Membre | Liste des sorties à venir du groupe |
| `POST` | `/api/events` | Membre | Créer une sortie (+ RSVP PENDING pour tous) |
| `GET` | `/api/events/{id}` | Membre | Détail complet |
| `PATCH` | `/api/events/{id}` | Hôte ou Admin | Modifier (infos + status) |
| `DELETE` | `/api/events/{id}` | Admin | Supprimer définitivement |
| `POST` | `/api/events/{id}/rsvp` | Membre | Mettre à jour son RSVP |
| `GET` | `/api/events/{id}/balances` | Membre | Calcul des soldes Tricount (côté serveur) |
| `POST` | `/api/events/{id}/needs` | Membre | Ajouter un besoin |
| `PATCH` | `/api/events/{id}/needs/{needId}` | Membre | Prendre / libérer un besoin |
| `POST` | `/api/events/{id}/expenses` | Membre | Ajouter une dépense |
| `DELETE` | `/api/events/{id}/expenses/{expenseId}` | Payeur ou Admin | Supprimer une dépense |
| `POST` | `/api/events/{id}/comments` | Membre | Poster un commentaire |
| `DELETE` | `/api/events/{id}/comments/{commentId}` | Auteur ou Admin | Supprimer un commentaire |
| `POST` | `/api/events/{id}/comments/{commentId}/report` | Membre | Signaler un commentaire |
| `PATCH` | `/api/events/{id}/playlist` | Membre | Définir / modifier l'URL de playlist |
| `POST` | `/api/events/{id}/photos` | Membre | Enregistrer une photo (après upload Blob) |
| `DELETE` | `/api/events/{id}/photos/{photoId}` | Uploader ou Admin | Supprimer une photo |
| `GET` | `/api/events/{id}/photos/zip` | Membre | Archive ZIP des photos |
| `GET` | `/api/events/{id}/ics` | Membre | Télécharger fichier ICS |

**Note sur la granularité des routes :** chaque action a sa propre route HTTP avec la méthode appropriée (POST/PATCH/DELETE). Il n'y a pas d'endpoint "fourre-tout" avec un champ `action` dans le body — chaque route a un périmètre clair, des droits distincts, et des erreurs HTTP expressives.

### Notifications push déclenchées

- **Création :** notif envoyée à tous les membres du groupe (`notifPushEvents = true`), sauf l'hôte.
- **Rappel jour J :** cron 7h UTC → participants YES (voir `08-notifications.md`).
