# Auth, Accès & Onboarding

## 1. Authentification

### Provider

**Google OAuth uniquement** via NextAuth v5. Pas de mot de passe.

- Sessions **JWT** (obligatoire : le middleware tourne en Edge Runtime où Prisma est interdit).
- Le rôle et `groupId` sont chargés dans le token au **login** (callback `jwt`).
- En développement uniquement : provider `Credentials` "dev-login" sur `/login` → connexion avec un email existant uniquement (admin : `brice.mangeat@gmail.com`). Invisible en prod.

### Page `/login`

- Affiche le logo de l'app.
- Bouton "Se connecter avec Google".
- Si l'email Google ne correspond à aucune invitation valide → message d'erreur clair : _"Ce compte n'est pas encore invité. Demande un lien à [admin]."_
- Après connexion réussie :
  - Redirige vers `/` → qui redirige vers `/groups` (ou `/{lastGroupId}` si un groupe est mémorisé).
  - Si la connexion vient d'une invitation : redirige vers `/{groupId}/onboarding` si c'est un nouveau groupe pour cet utilisateur.

### Page `/invite/[token]`

- Landing publique : message de bienvenue + bouton "Rejoindre le groupe".
- Valide le token (existence, non expiré, non utilisé) avant d'afficher.
- Token invalide → message d'erreur + lien vers `/login`.
- Token valide → redirige vers `/login` (le token est mémorisé en session pour être consommé après connexion Google).
- Après connexion réussie avec un token valide : le compte est lié à l'invitation, `usedAt` est renseigné, le `groupId` est assigné.

### `allowDangerousEmailAccountLinking`

Activé : permet de lier un compte Google à un user déjà seedé/invité par email.

---

## 2. Invitation (admin)

Deux modes d'invitation depuis `/admin` :

### Par email

1. L'admin saisit l'email du futur membre.
2. Un lien unique est généré (token `cuid()`) avec `expiresAt = now + 7 jours`.
3. Email envoyé via Resend (si configuré) contenant le lien `https://[domain]/invite/[token]`.
4. L'invitation apparaît dans "Invitations en attente".

### Lien générique

1. L'admin clique "Générer un lien d'invitation".
2. Un token est créé avec `email = null` (usage unique, tout email accepté).
3. Le lien est affiché dans l'interface avec un bouton "Copier".
4. L'admin partage le lien par le canal de son choix.
5. Le lien est valide une seule fois (premier arrivé) et expire après 7 jours.

### Règles

- Un email ne peut avoir qu'une invitation active à la fois (l'ancienne est remplacée si on en génère une nouvelle pour le même email).
- Une invitation utilisée ne peut pas être réutilisée (`usedAt` non null).
- L'admin peut supprimer une invitation en attente (le lien devient inutilisable immédiatement).

---

## 3. Onboarding (3 étapes)

Déclenché à l'**entrée dans un nouveau groupe** (`GroupMembership.onboardedAt = null`). Un utilisateur qui rejoint un 2ème groupe refait l'onboarding pour ce groupe.

### Étape 1 — Bienvenue dans le groupe

- **Titre :** "Bienvenue dans [nom du groupe], [Prénom] !"
- Champs spécifiques à CE groupe :
  - **Statut résident** (toggle) : "Je suis un local 🏠" — stocké sur `GroupMembership.isResident`.
- Rappel du profil global déjà renseigné (ville, anniversaire) avec lien vers `/profile` pour le modifier.
- Si c'est le tout premier groupe de l'utilisateur, affiche aussi les champs ville + anniversaire (profil global).
- Avatar importé depuis Google affiché en grand.
- Bouton "Continuer".

### Étape 2 — Notifications

- **Titre :** "Reste dans la boucle"
- Affiche les bénéfices (chevauchements de présences, anniversaires, nouvelles sorties).
- Bouton principal : "Activer les notifications" → demande la permission push.
  - Succès → feedback visuel "Activées !" puis passage automatique à l'étape 3.
  - Refusé → message "Bloquées, réactivables depuis les réglages".
  - Non supporté (iOS sans PWA installée) → message d'explication sur l'installation.
- Lien "Plus tard" pour passer à l'étape 3 sans activer.
- **`InstallOnboarding`** : overlay plein écran affiché si l'app n'est pas déjà installée en mode standalone (iOS). Explique comment l'ajouter à l'écran d'accueil avant d'activer les notifs.

### Étape 3 — Première présence

- **Titre :** "Ta première présence"
- Champs :
  - Date d'arrivée (input date, défaut = aujourd'hui)
  - Date de départ (input date, min = date d'arrivée)
  - Disponibilité : `OPEN` "Ouvert — Dispo pour se voir" / `BUSY` "Passage rapide — Peu disponible"
- Case à cocher "Je n'ai pas encore de date prévue" → désactive les champs de date.
- Bouton "C'est parti !" → :
  1. Appelle `POST /api/onboarding` (sauvegarde ville, anniversaire, `isResident`, renseigne `onboardedAt`).
  2. Si date présente : `POST /api/presences`.
  3. Redirige vers `/{groupId}`.

### Progression

3 barres en haut de l'écran, remplies progressivement selon l'étape courante.

---

## 4. Déconnexion

- Bouton "Se déconnecter" dans `/profile`.
- Server Action `signOut` de NextAuth.
- Redirige vers `/login`.

---

## 5. Middleware

- Toutes les routes sauf `/login`, `/invite/*`, `/403`, `/orphelin` requièrent une session active.
- Redirige vers `/login` si non connecté.
- Le middleware ne vérifie que la **connexion** (pas le rôle — contrôle en base dans chaque page).

---

## 6. Accès refusé

- `/403` : page d'erreur statique affichée quand un membre tente d'accéder à un groupe auquel il n'appartient pas.
- `/orphelin` : page affichée quand le compte n'est rattaché à aucun groupe.
