# Profil — `/profile`

## Vue d'ensemble

Page de gestion du profil personnel, **globale** (non rattachée à un groupe). Accessible depuis le bottom tab bar ou l'avatar dans le header de `/groups`. Sections en accordéon (cards repliables), barre "Enregistrer" apparaissant si des modifications non sauvegardées sont en attente.

---

## Header

- Avatar centré (grand, 80px) avec badge caméra → input file (caché) pour changer la photo.
  - Upload vers Vercel Blob via `POST /api/profile/photo` (handleUploadUrl).
  - Après upload : `PATCH /api/profile` `{ image: url }` + `router.refresh()`.
- Prénom et nom complet.
- Email (non modifiable).
- Badge rôle **dans le groupe actif** (Membre / Admin / Super Admin) en bleu — lu depuis `GroupMembership.role` du groupe en contexte (`localStorage.lastGroupId`). Si pas de groupe actif (utilisateur sur `/profile` sans contexte de groupe), le badge rôle n'est pas affiché.
- Badge **couleur membre dans le groupe actif** (cercle coloré + "Ta couleur") — lu depuis `GroupMembership.memberColor`.

---

## Section 1 — Mes informations (accordéon, ouvert par défaut)

**Résumé replié :** "[Ville] · [Anniversaire]" ou "À compléter".

**Champs :**

| Champ | Type | Obligatoire | Détails |
|-------|------|-------------|---------|
| Prénom | texte | Non (pré-rempli depuis Google) | Modifiable |
| Ville de résidence | texte | Non | Affiché sur le profil public |
| Anniversaire | date | Non | Affiché sur le profil public (jour/mois uniquement dans certains contextes) |
| Téléphone | tel | Non | Affiché sur le profil public |

**Statut résident** (affiché uniquement si un groupe actif est en contexte) :
- Toggle card "🏠 Statut résident dans [nom du groupe actif]".
- Description : "Tu habites au quartier ou à moins de 15 minutes ? Active ce statut pour ne louper aucun passage de pote et être invité d'office aux sorties."
- Active/désactive `GroupMembership.isResident` pour le groupe actif.
- `PATCH /api/groups/{groupId}/members/me` `{ isResident }`.
- Si activé, une option de notification supplémentaire apparaît dans la section Notifications.

---

## Section 2 — Réseaux sociaux (accordéon)

**Résumé replié :** liste des réseaux renseignés (ex. "Instagram, Snapchat") ou "Aucun pour le moment".

**Champs (tous optionnels) :**

| Réseau | Préfixe | Icône | Couleur |
|--------|---------|-------|---------|
| Instagram | @ | Instagram | #E1306C |
| Snapchat | @ | Ghost | #d4a300 |
| TikTok | @ | Music2 | #111827 |
| LinkedIn | *(aucun)* | Linkedin | #0A66C2 |

Chaque champ affiche le préfixe `@` dans le champ (sauf LinkedIn), l'utilisateur saisit seulement le pseudo.

---

## Section 3 — Notifications (accordéon)

**Résumé replié :** "Push activées · N type(s)" ou "Désactivées".

**Note :** il n'y a pas de toggle "Email" dans cette section. Les notifications email (Resend) ne sont pas implémentées. Le champ `notifEmail` n'existe pas dans le modèle — si la feature email est ajoutée plus tard, elle sera introduite avec sa propre section.

### Toggle principal : Notifications push

- Toggle "Notifications push" (vert quand actif).
- Si non supporté (non PWA installée) : message explicatif + toggle désactivé.
- Activation : appelle `subscribeToPush()` (demande permission navigateur + enregistrement en base via `POST /api/push/subscribe`).
  - Succès → toggle vert.
  - Refus → message "Bloquées, réactivables dans les réglages du navigateur."
  - Non supporté sur iOS sans PWA → message d'explication.
- Désactivation : `unsubscribeFromPush()` (désinscription + suppression en base).

### Types de notifications (sous le toggle principal)

Désactivés (grisés) si les notifications push ne sont pas activées.

| Clé | Titre | Description |
|-----|-------|-------------|
| `notifPushOverlap` | Chevauchements de présences | Quelqu'un sera là en même temps que toi |
| `notifPushBirthday` | Anniversaires | Le jour de l'anniv d'un membre |
| `notifPushPresence` | Nouvelles présences | Quand quelqu'un ajoute une présence |
| `notifPushPhotos` | Photos de sortie qui expirent | 1 jour avant la suppression auto des photos |
| `notifPushEvents` | Sorties | Nouvelles sorties et rappel le jour J |

**Si `isResident = true` :** option supplémentaire :
- `notifPushAsResident` : "🏠 Arrivée d'un pote au quartier" — "Quand un expatrié annonce un passage (réservé aux résidents)".

---

## Section 4 — Mes groupes

- Lien card vers `/groups` (icône groupe) : "Mes Ronds Points".
- Liste des groupes de l'utilisateur (noms + badge rôle).
- Bouton "Gérer" → `/groups`.

---

## Section 5 — Le quartier (lien, contextuel)

Affiché uniquement si un groupe actif est en contexte.
- Lien card vers `/{groupId}/membres` : "Les membres de [nom du groupe]".

---

## Section 6 — Administration (lien, admin uniquement)

Affiché si rôle ADMIN ou SUPER_ADMIN dans le groupe actif (lu depuis `GroupMembership.role`).
- Lien vers `/{groupId}/admin`.
- Si des commentaires signalés sont en attente : badge rouge avec le nombre.

---

## Déconnexion

Bouton "Se déconnecter" (rouge, texte) en bas de page → Server Action `signOut`.

---

## Barre "Enregistrer"

Apparaît sticky en bas (au-dessus du bottom bar) quand les données diffèrent de la sauvegarde initiale.
- Bouton "✓ Enregistrer les modifications" → `PATCH /api/profile` avec le draft complet.
- Animation `slide-up` à l'apparition.
- Disparaît après sauvegarde réussie.

---

## API

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/profile` | Données du profil global + memberships (chargées côté serveur en RSC) |
| `PATCH` | `/api/profile` | Sauvegarder les modifications du profil global |
| `POST` | `/api/profile/photo` | Handle upload photo (Vercel Blob) |
| `PATCH` | `/api/groups/{groupId}/members/me` | Modifier les données per-group (isResident) |
| `POST` | `/api/push/subscribe` | S'abonner aux notifications push |
