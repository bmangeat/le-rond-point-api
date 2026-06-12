# Groupes — `/groups`

## Vue d'ensemble

Hub central de l'application. Chaque utilisateur connecté atterrit ici. Il voit tous ses groupes, peut en créer un nouveau, et navigue vers l'un d'eux pour accéder à son contenu.

---

## Page `/groups`

### Comportement à la connexion

- `/` redirige vers `/groups` pour tout utilisateur connecté (quelle que soit sa situation).
- Pas de page `/orphelin` : un utilisateur sans groupe voit `/groups` avec un état vide et peut créer son premier groupe.

### Header

- Logo + titre "Le Rond Point".
- Avatar de l'utilisateur connecté → lien vers `/profile` (profil global, sans contexte de groupe).

### Liste des groupes

Une card par groupe dont l'utilisateur est membre actif (`GroupMembership.isActive = true`) :
- Nom du groupe.
- Nombre de membres actifs.
- Badge rôle de l'utilisateur dans ce groupe : "Admin" (bleu) ou "Membre" (gris).
- Indication de présences à venir (ex. "3 amis au quartier en juin").
- Tap → navigue vers `/{groupId}`.

Tri : groupes les plus récemment visités en premier (stocké en `localStorage`).

### État vide

Si l'utilisateur n'appartient à aucun groupe :
- Illustration + message d'accroche.
- Bouton "Créer mon premier Rond Point".

### Bouton "Créer un groupe"

Toujours visible en bas de page (ou FAB) → ouvre le formulaire de création.

---

## Création d'un groupe

### Formulaire (bottom sheet ou plein écran)

- **Nom du groupe** (texte, obligatoire, max 50 caractères).
  - Exemple de placeholder : "Le Rond Point de Belleville", "Les Potes de Prépa"…
- Bouton "Créer".

### Comportement à la création

1. `POST /api/groups` `{ name }`.
2. Un `Group` est créé avec `creatorId = userId`.
3. Une `GroupMembership` est créée pour le créateur avec `role = ADMIN`.
4. La couleur 1 lui est assignée (premier membre, pas de conflit).
5. `onboardedAt` est renseigné immédiatement (pas d'onboarding pour le créateur de son propre groupe — il peut configurer ses infos depuis le profil).
6. Redirige vers `/{groupId}` (vue accueil du nouveau groupe).

---

## Rejoindre un groupe (via invitation)

### Flux général

1. L'utilisateur reçoit un lien `/invite/[token]`.
2. Il se connecte avec Google.
3. Si son email correspond à un `User` existant → la `GroupMembership` est créée directement.
4. Si son email est nouveau → un `User` est créé, puis la `GroupMembership`.
5. Dans les deux cas → onboarding spécifique à ce groupe (`/{groupId}/onboarding`).

### Onboarding per-group

L'onboarding est déclenché par `GroupMembership.onboardedAt = null` (et non plus `User.onboardedAt`).

- **Étape 1 — Bienvenue dans le groupe :** présentation du groupe (nom), confirmation du nom affiché (pré-rempli depuis le profil global), option statut résident pour CE groupe.
- **Étape 2 — Notifications :** activation push (si pas encore activée globalement).
- **Étape 3 — Première présence :** ajouter sa première présence dans ce groupe.

Si l'utilisateur rejoint un 2ème groupe et que les notifications push sont déjà activées, l'étape 2 est sautée.

---

## Switcher de groupe

L'utilisateur qui appartient à plusieurs groupes peut switcher depuis n'importe quelle page `/{groupId}/*`.

### Accès

- Tap sur le **nom du groupe** dans le header de la page d'accueil → navigue vers `/groups`.
- Ou depuis le profil : section "Mes groupes" → `/groups`.

### UX

`/groups` sert de switcher. L'utilisateur sélectionne le groupe souhaité dans la liste et y accède. Pas de modal/dropdown inline — la page `/groups` est suffisamment rapide.

Le dernier groupe visité est mémorisé dans `localStorage` sous la clé `lastGroupId`. Lors d'une connexion future, `/` redirige vers `/{lastGroupId}` si le groupe est toujours accessible, sinon vers `/groups`.

---

## Quitter un groupe

Un membre peut **quitter** un groupe de lui-même (si ce n'est pas son seul groupe) :
- Option dans le profil du groupe ou dans `/groups` (menu contextuel sur la card).
- Confirmation : "Quitter [nom du groupe] ? Tes présences passées seront conservées."
- `DELETE /api/groups/{groupId}/members/me` → `GroupMembership.isActive = false`.
- Si c'est son seul groupe → option désactivée (suggestion de créer un nouveau groupe avant de quitter).
- Si c'est le dernier admin du groupe → option désactivée avec message ("Nomme un autre admin avant de partir").

---

## API

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `GET` | `/api/groups` | Connecté | Liste des groupes de l'utilisateur |
| `POST` | `/api/groups` | Connecté | Créer un groupe |
| `GET` | `/api/groups/{groupId}` | Membre | Détail d'un groupe |
| `PATCH` | `/api/groups/{groupId}` | Admin | Renommer le groupe |
| `DELETE` | `/api/groups/{groupId}/members/me` | Membre | Quitter le groupe |
