# Le Rond Point — API

Backend NestJS pour l'application mobile Le Rond Point. API REST multi-tenant pour gérer des groupes d'amis (présences, sorties, notifications push).

## Stack

- **NestJS 10** + **TypeScript**
- **Prisma 5** + **PostgreSQL** (Neon en prod/QA, Docker en dev)
- **JWT** (access 15min + refresh 30j) — auth Google OAuth via idToken mobile
- **Web Push** (VAPID) — notifications push
- **@nestjs/schedule** — cron quotidien (7h UTC)

## Prérequis

- Node.js 18+
- pnpm
- Docker (pour la base de données locale)

## Installation

```bash
pnpm install
cp .env.example .env
# Remplir les variables dans .env
```

### Génération des secrets / variables

```bash
# JWT_SECRET et JWT_REFRESH_SECRET (un secret aléatoire chacun)
openssl rand -base64 32
openssl rand -base64 32

# CRON_SECRET (protège GET /api/cron/daily)
openssl rand -base64 32

# Clés Web Push VAPID — génère la PAIRE (publique + privée) d'un coup.
# publicKey  → NEXT_PUBLIC_VAPID_PUBLIC_KEY
# privateKey → VAPID_PRIVATE_KEY
pnpm exec web-push generate-vapid-keys --json
```

Les autres variables ne se « génèrent » pas avec une commande :

| Variable | D'où elle vient |
|----------|-----------------|
| `DATABASE_URL` / `DIRECT_URL` | tableau de bord de ta base (Neon en prod, Docker en local) |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → OAuth |
| `VAPID_SUBJECT` | un `mailto:ton-email` ou une URL (pas de génération) |
| `BLOB_READ_WRITE_TOKEN` | injecté automatiquement en créant un store **Vercel → Storage → Blob** (laisser vide tant que l'upload de photos n'est pas utilisé) |
| `ALLOWED_ORIGINS` | `*` si client mobile/Bruno uniquement ; sinon les origines web exactes |

> ⚠️ Génère la paire VAPID **une seule fois** par environnement : la régénérer invalide
> tous les abonnements push existants. Ne jamais committer ces valeurs (elles vont dans
> `.env` local et dans les variables d'env Vercel).

## Base de données locale

```bash
# Démarrer Postgres via Docker
docker compose up -d

# Appliquer les migrations
pnpm run migrate:deploy

# (Optionnel) Générer des données de test
pnpm run db:seed
```

## Démarrage

```bash
# Dev (watch mode)
pnpm run start:dev

# Production
pnpm run build && pnpm run start
```

L'API tourne sur `http://localhost:3001/api`.

## Déploiement Vercel

L'API tourne en **serverless** sur Vercel via une fonction unique ([api/index.ts](api/index.ts))
qui charge le serveur Nest compilé ([src/server.ts](src/server.ts) → `dist/server.js`) et le
met en cache entre les invocations. Tout est configuré dans [vercel.json](vercel.json) :

- **Build** : `nest build` (les migrations ne tournent **pas** au build — voir CD ci-dessous).
- **Routage** : toutes les requêtes sont redirigées vers la fonction (`rewrites`).
- **Cron** : Vercel Cron appelle `GET /api/cron/daily` tous les jours à 7h UTC
  (le décorateur `@Cron` in-process ne se déclenche pas en serverless).
- **Auto-deploy désactivé sur `main`** (`git.deploymentEnabled`) : le déploiement prod est
  piloté par GitHub Actions pour garantir l'ordre migrations → mise en ligne.

### Migrations & déploiement (CD GitHub Actions)

Les migrations doivent être appliquées **avant** que le nouveau code passe en ligne (sinon le
code attend un schéma que la base n'a pas encore). Comme Vercel déploierait immédiatement au
push, l'auto-deploy sur `main` est coupé et [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
orchestre la séquence à chaque push sur `main` :

1. `prisma migrate deploy` (applique les migrations en attente — sur base vide, joue l'init) ;
2. déploiement Vercel en production (`vercel pull/build/deploy --prod`).

**Secrets GitHub à configurer** (Settings → Secrets and variables → Actions) :

| Secret | Valeur |
|--------|--------|
| `DATABASE_URL` | Neon pooled (prod) |
| `DIRECT_URL` | Neon directe (prod) — utilisée par les migrations |
| `VERCEL_TOKEN` | jeton perso Vercel (Account Settings → Tokens) |
| `VERCEL_ORG_ID` | depuis `.vercel/project.json` après un `vercel link`, ou Settings Vercel |
| `VERCEL_PROJECT_ID` | idem |

> Alternative manuelle : tu peux toujours appliquer les migrations à la main avec
> `DIRECT_URL=... pnpm run migrate:deploy` avant de déployer.

### Mise en place

1. **Base de données** : provisionner une base Postgres (Neon recommandé — pooling
   serverless). Récupérer l'URL *pooled* et l'URL *directe*.
2. **Importer le repo** sur Vercel (Framework preset : **Other** — `vercel.json` gère le reste).
3. **Variables d'environnement** (Project Settings → Environment Variables) :

   | Variable | Note |
   |----------|------|
   | `DATABASE_URL` | Neon **pooled** (`...&pgbouncer=true`) — utilisé par l'app |
   | `DIRECT_URL` | Neon **directe** — utilisé par `migrate deploy` au build |
   | `JWT_SECRET` / `JWT_REFRESH_SECRET` | secrets forts |
   | `GOOGLE_CLIENT_ID` | OAuth Google |
   | `VAPID_SUBJECT` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push |
   | `BLOB_READ_WRITE_TOKEN` | Vercel Blob (photos) |
   | `RESEND_API_KEY` / `RESEND_FROM` | emails (optionnel) |
   | `APP_URL` / `ALLOWED_ORIGINS` | URL appli + CORS |
   | `CRON_SECRET` | protège `/api/cron/daily` (Vercel l'envoie en `Bearer`) |

4. **Déployer**. Le build applique les migrations puis compile.

> ⚠️ Le `buildCommand` lance `prisma migrate deploy` **à chaque build, y compris en
> preview** — ce qui migre la base ciblée par les env vars de cet environnement. Utiliser
> une base distincte pour les déploiements preview, ou retirer `migrate deploy` du build et
> le lancer manuellement / en production uniquement.

> ℹ️ Cron quotidien et `maxDuration: 60` : vérifier les limites de ton plan Vercel
> (le plan Hobby limite les crons à une exécution par jour).

## Scripts

| Commande | Description |
|----------|-------------|
| `pnpm run start:dev` | Serveur dev avec hot reload |
| `pnpm run build` | Compile TypeScript → `dist/` |
| `pnpm run migrate:dev` | Crée et applique une migration (dev) |
| `pnpm run migrate:deploy` | Applique les migrations en attente (prod/CI) |
| `pnpm run db:generate` | Régénère le client Prisma |
| `pnpm run db:studio` | Ouvre Prisma Studio |

## Structure

```
src/
├── auth/           # Google OAuth + JWT (access + refresh)
├── common/
│   ├── guards/     # GroupAccessGuard, GroupAdminGuard
│   └── decorators/ # @CurrentUser, @CurrentMembership
├── prisma/         # PrismaService (global)
├── groups/         # CRUD groupes + gestion des membres
├── profile/        # Profil global utilisateur
├── presences/      # Présences au quartier (scoped par groupe)
├── events/         # Sorties (RSVP, besoins, Tricount, commentaires, photos)
├── admin/          # Invitations, modération, audit log
├── push/           # Subscriptions Web Push
└── cron/           # Tâches quotidiennes (anniversaires, rappels, cleanup photos)
```

## Architecture multi-tenant

Chaque utilisateur peut appartenir à plusieurs groupes. Toutes les données sensibles sont cloisonnées par groupe via la table `GroupMembership`.

```
User (profil global)
 └── GroupMembership (rôle, couleur, résidence, onboarding — per group)
      └── Group
           ├── Presence   (groupId obligatoire)
           ├── Event
           └── Invitation
```

### Gardes d'accès

Chaque route de groupe passe par deux gardes chaînés :

1. **`JwtAuthGuard`** — vérifie le Bearer token JWT
2. **`GroupAccessGuard`** — vérifie que l'utilisateur est membre actif du groupe (lit `GroupMembership`), attache `request.membership`
3. **`GroupAdminGuard`** _(optionnel)_ — vérifie que `membership.role === ADMIN`

```typescript
@UseGuards(JwtAuthGuard, GroupAccessGuard, GroupAdminGuard)
```

## Authentification (mobile)

Le flow est pensé pour un client mobile qui utilise le SDK Google Sign-In :

```
Mobile → Google SDK → idToken
Mobile → POST /api/auth/google { idToken }
API    → vérifie avec google-auth-library
API    → { accessToken (15min), refreshToken (30j) }
```

Le `refreshToken` est renouvelé via `POST /api/auth/refresh`.

## Routes principales

### Auth
| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/auth/register` | Inscription email / mot de passe → tokens |
| `POST` | `/api/auth/login` | Connexion email / mot de passe → tokens |
| `POST` | `/api/auth/google` | Sign-in avec idToken Google |
| `POST` | `/api/auth/refresh` | Renouveler l'accessToken |

Exemple pour tester sans Google :

```bash
# Inscription
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"me@test.dev","password":"motdepasse123","name":"Moi"}'

# Connexion (renvoie accessToken + refreshToken)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"me@test.dev","password":"motdepasse123"}'

# Appel authentifié
curl http://localhost:3001/api/profile -H "Authorization: Bearer <accessToken>"
```

### Profil (global)
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/profile` | Profil + memberships |
| `PATCH` | `/api/profile` | Mettre à jour le profil |

### Groupes
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/groups` | Mes groupes |
| `POST` | `/api/groups` | Créer un groupe |
| `GET` | `/api/groups/:groupId` | Détail d'un groupe |
| `PATCH` | `/api/groups/:groupId` | Renommer (admin) |
| `PATCH` | `/api/groups/:groupId/members/me` | Modifier ma membership |
| `DELETE` | `/api/groups/:groupId/members/me` | Quitter le groupe |
| `PATCH` | `/api/groups/:groupId/members/:userId` | Changer le rôle (admin) |
| `DELETE` | `/api/groups/:groupId/members/:userId` | Retirer un membre (admin) |

### Présences
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/groups/:groupId/presences` | Liste des présences |
| `GET` | `/api/groups/:groupId/presences/today` | Présence active aujourd'hui |
| `POST` | `/api/groups/:groupId/presences` | Créer une présence |
| `PATCH` | `/api/groups/:groupId/presences/:id` | Modifier |
| `DELETE` | `/api/groups/:groupId/presences/:id` | Supprimer |

### Sorties
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/groups/:groupId/events` | Liste des sorties |
| `POST` | `/api/groups/:groupId/events` | Créer une sortie |
| `GET` | `/api/groups/:groupId/events/:id` | Détail |
| `PATCH` | `/api/groups/:groupId/events/:id` | Modifier (hôte/admin) |
| `DELETE` | `/api/groups/:groupId/events/:id` | Annuler (hôte/admin) |
| `PATCH` | `/api/groups/:groupId/events/:id/rsvp` | Mettre à jour son RSVP |
| `GET` | `/api/groups/:groupId/events/:id/balances` | Soldes Tricount |
| `POST` | `/api/groups/:groupId/events/:id/needs` | Ajouter un besoin |
| `POST` | `/api/groups/:groupId/events/:id/expenses` | Ajouter une dépense |
| `POST` | `/api/groups/:groupId/events/:id/comments` | Commenter |

### Admin
| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/groups/:groupId/admin/invite` | Inviter par email |
| `POST` | `/api/groups/:groupId/admin/invite/link` | Lien générique |
| `GET` | `/api/groups/:groupId/admin/invitations` | Invitations en attente |
| `DELETE` | `/api/groups/:groupId/admin/invitations/:id` | Supprimer une invitation |
| `GET` | `/api/groups/:groupId/admin/reports` | Commentaires signalés |
| `POST` | `/api/groups/:groupId/admin/reports` | Modérer un commentaire |

### Push
| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/push/subscribe` | S'abonner aux notifications |
| `DELETE` | `/api/push/subscribe` | Se désabonner |

## Notifications push

8 types de notifications déclenchées automatiquement :

| # | Déclencheur | Type |
|---|-------------|------|
| 1 | Nouvelle présence | Chevauchement de présences (temps réel) |
| 2 | Cron 7h UTC | Rappel co-présence du jour |
| 3 | Cron 7h UTC | Anniversaire du jour |
| 4 | Nouvelle présence | Nouvelle présence (tous les membres) |
| 5 | Cron 7h UTC | Photos de sortie expirant J+1 |
| 6 | Cron 7h UTC | Rappel sortie du jour |
| 7 | Nouvelle sortie | Nouvelle sortie créée |
| 8 | Nouvelle présence | Arrivée d'un expatrié (résidents uniquement) |

## Cron quotidien

`CronService` tourne chaque jour à 7h00 UTC avec 5 tâches ordonnées :
1. `runBirthdayNotifications()`
2. `runPresenceReminders()`
3. `runPhotoExpiryWarnings()`
4. `runEventPhotoCleanup()` — supprime les photos > 7j après la sortie
5. `runEventDayReminders()`

## Tests avec Bruno

La collection Bruno est dans `bruno/`. Ouvrir avec **File → Open Collection**.

Workflow de démarrage :
1. Sélectionner l'environnement **Local**
2. `auth/01-google-signin` → copier `accessToken` + `refreshToken` dans les variables
3. `groups/02-create-group` → copier `groupId`
4. Toutes les autres requêtes utilisent ces variables automatiquement

## Variables d'environnement

Voir `.env.example` pour la liste complète. Variables obligatoires :

```
DATABASE_URL        # Connexion Postgres (poolée)
DIRECT_URL          # Connexion Postgres directe (migrations)
JWT_SECRET          # Secret token access
JWT_REFRESH_SECRET  # Secret token refresh
GOOGLE_CLIENT_ID    # Google Cloud Console
VAPID_SUBJECT       # mailto:...
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```
