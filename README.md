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
| `POST` | `/api/auth/google` | Sign-in avec idToken Google |
| `POST` | `/api/auth/refresh` | Renouveler l'accessToken |

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
