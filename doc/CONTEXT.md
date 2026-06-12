# Le Rond Point API — Contexte projet (pour Claude)

Ce fichier est destiné à Claude pour reprendre le contexte du projet rapidement lors d'une nouvelle session.

---

## Qu'est-ce que ce projet ?

Backend NestJS de **Le Rond Point**, une app mobile pour un groupe d'amis d'un quartier d'enfance dispersés dans le monde. Les fonctionnalités principales : publier des **présences** au quartier, organiser des **sorties**, recevoir des **notifications push** sur les moments où les amis sont là en même temps.

Ce backend est construit **from scratch** à partir de specs fonctionnelles rédigées dans le projet Next.js parallèle (`Le Rond Point/docs/specs/`). Il remplace l'ancien projet Next.js (full-stack) par une architecture backend séparé + app mobile (à venir).

---

## Relation avec les autres projets

| Dossier | Rôle |
|---------|------|
| `Le Rond Point/` | Ancien projet Next.js (référence + specs fonctionnelles dans `docs/specs/`) |
| `le-rond-point-api/` | **Ce projet** — backend NestJS |
| App mobile | À construire (React Native / Expo — pas encore démarré) |

Les specs fonctionnelles complètes et à jour sont dans `Le Rond Point/docs/specs/`. En cas de doute sur un comportement attendu, s'y référer en priorité.

---

## Stack et choix techniques

- **NestJS 10** + TypeScript — framework backend principal
- **Prisma 5** + PostgreSQL (Neon en prod, Docker en dev) — ORM et migrations
- **JWT** — access token (15min) + refresh token (30j). Pas de session côté serveur.
- **Google OAuth** — via idToken envoyé par le SDK mobile (pas de redirect web)
- **Web Push (VAPID)** — `web-push` pour les notifications push
- **@nestjs/schedule** — cron quotidien à 7h UTC
- **pnpm** — package manager

---

## Architecture multi-tenant (point central)

Un utilisateur peut appartenir à **plusieurs groupes**. C'est la décision architecturale la plus importante.

La table `GroupMembership` est la pièce centrale :
- Elle lie un `User` à un `Group`
- Elle porte toutes les données **per-group** : `role`, `memberColor`, `isResident`, `onboardedAt`, `isActive`
- `User` ne contient plus `groupId`, `memberColor`, `role` ni `onboardedAt`
- `Presence.groupId` est **obligatoire** — les présences sont scopées par groupe

```
User (profil global : nom, ville, anniversaire, réseaux, préfs push)
 └── GroupMembership (role, color, isResident, onboarding — per group)
      └── Group
           ├── Presence   (groupId non-nullable)
           ├── Event      → Rsvp, Need, Expense, Comment, Photo
           └── Invitation
```

Enums :
- `GlobalRole`: `SUPER_ADMIN` | `USER` (sur User — uniquement pour l'accès global)
- `GroupRole`: `ADMIN` | `MEMBER` (sur GroupMembership — rôle dans un groupe)

---

## Gardes d'accès — pattern à respecter

Toute route de groupe utilise systématiquement ces gardes dans cet ordre :

```typescript
@UseGuards(JwtAuthGuard, GroupAccessGuard)           // membre
@UseGuards(JwtAuthGuard, GroupAccessGuard, GroupAdminGuard)  // admin
```

- `JwtAuthGuard` → vérifie le Bearer token, attache `request.user`
- `GroupAccessGuard` → vérifie `GroupMembership.isActive`, attache `request.membership`
  - Exception : `SUPER_ADMIN` passe toujours, avec une membership virtuelle `role: ADMIN`
- `GroupAdminGuard` → vérifie `request.membership.role === 'ADMIN'`

Décorateurs disponibles :
- `@CurrentUser()` → `AuthenticatedUser` (id, email, name, globalRole)
- `@CurrentMembership()` → `GroupMembership` (role, memberColor, isResident...)

**Ne jamais autoriser une action admin en se basant uniquement sur le token JWT.** Toujours passer par le guard qui lit la base.

---

## Routes — convention

Toutes les routes de groupe sont préfixées `/api/groups/:groupId/...` :

```
/api/auth/*                     — public
/api/profile                    — utilisateur connecté, global
/api/groups                     — liste/création
/api/groups/:groupId/*          — toutes les données du groupe
/api/groups/:groupId/presences
/api/groups/:groupId/events
/api/groups/:groupId/admin/*    — admin seulement
/api/push/*                     — global (pas de groupId)
```

Les routes d'admin du groupe sont sous `/api/groups/:groupId/admin/` (pas `/api/admin/`).

---

## Comportements clés à ne pas oublier

**Présences :**
- Les dates sont toujours stockées en **minuit UTC** (`toMidnightUTC(YYYY-MM-DD)`)
- À la création d'une présence → déclencher `PushService.onNewPresence()` (chevauchements + nouvelle présence + arrivée expatrié)

**Sorties :**
- À la création → créer un `EventRsvp PENDING` pour **tous les membres actifs du groupe**
- L'hôte est automatiquement passé à `YES`
- Quand un nouveau membre rejoint → créer des RSVP PENDING pour tous les events à venir
- Annulation = soft (`EventStatus.CANCELLED`), jamais de suppression
- Photos TTL = 7j après `Event.whenAt` (pas après upload)

**Couleur membre :**
- Assignée automatiquement à la création de la `GroupMembership`
- Unique au sein du groupe (1–12), logique dans `GroupsService.assignMemberColor(groupId)`
- Si les 12 sont prises → assigner la moins fréquente

**Invitations :**
- `email = null` → lien générique à usage unique
- À l'acceptation : si l'email correspond à un `User` existant → créer une `GroupMembership` (pas de nouveau compte)
- `Invitation.groupId` est obligatoire

**Onboarding :**
- Déclenché par `GroupMembership.onboardedAt = null`
- Per-group : rejoindre un 2ème groupe redéclenche l'onboarding
- À la création de son propre groupe → `onboardedAt` renseigné immédiatement (pas d'onboarding)

---

## Notifications push — résumé

`PushService.sendPushToUser(userId, payload)` envoie à tous les appareils de l'utilisateur. Les subscriptions expirées (410/404) sont supprimées automatiquement.

Déclencheurs temps réel (dans les services) :
- `onNewPresence()` — depuis `PresencesService.create()`
- `onNewEvent()` — depuis `EventsService.create()`

Déclencheurs cron (dans `CronService`, 7h UTC) :
1. `runBirthdayNotifications()` — scoper par groupe via `GroupMembership`
2. `runPresenceReminders()` — regrouper les présences par `Presence.groupId`
3. `runPhotoExpiryWarnings()` — events dont `whenAt` est dans [now-7j, now-6j)
4. `runEventPhotoCleanup()` — supprimer photos + blobs > 7j (TODO: Vercel Blob)
5. `runEventDayReminders()` — events today, participants YES

`isResident` est **per-group** (`GroupMembership.isResident`), pas global. La notif "arrivée expatrié" filtre sur `GroupMembership.isResident = true` dans le groupe concerné.

---

## Ce qui reste à faire / TODOs connus

- **Photos** : le controller `events` n'a pas encore les routes `POST/DELETE /:id/photos` — nécessite l'intégration Vercel Blob (ou S3)
- **Cron cleanup photos** : `runEventPhotoCleanup()` supprime les rows Prisma mais pas encore les blobs Vercel
- **Resend** : `AdminService.inviteByEmail()` contient un TODO pour l'envoi d'email — pas branché
- **RSVP nouveaux membres** : quand un membre rejoint un groupe, créer les RSVP PENDING pour les events à venir n'est pas encore implémenté dans `GroupsService`
- **App mobile** : pas encore démarrée (React Native / Expo probable)
- **Seed** : pas encore de `prisma/seed.ts`

---

## Conventions de code

- Les modules NestJS suivent le pattern `module + controller + service + dto/` par feature
- Les DTOs utilisent `class-validator` (decorateurs) + `ValidationPipe` global avec `whitelist: true`
- Toujours `select:` les champs Prisma dans les réponses (ne jamais retourner un objet complet avec des champs sensibles)
- Les erreurs métier utilisent les exceptions NestJS standard (`NotFoundException`, `ForbiddenException`, `ConflictException`, etc.)
- Pas de `try/catch` dans les services — laisser NestJS gérer les erreurs non capturées

---

## Environnements

| Env | Base | Notes |
|-----|------|-------|
| dev | Postgres Docker local | `docker compose up -d` |
| prod | Neon PostgreSQL | Variables dans Vercel / déploiement manuel |

`DATABASE_URL` = connexion poolée (app runtime). `DIRECT_URL` = connexion directe (migrations Prisma). Les deux doivent être définis.

Prisma CLI lit `.env` (pas `.env.local`).

---

## Tests Bruno

Collection dans `bruno/`. Workflow :
1. `auth/01-google-signin` → copier `accessToken` + `refreshToken` dans les variables d'env Local
2. `groups/02-create-group` → copier `groupId`
3. Toutes les requêtes utilisent `{{accessToken}}` et `{{groupId}}` via l'environnement

Les variables `presenceId`, `eventId`, `needId`, `expenseId`, `commentId`, `invitationId`, `userId` sont à remplir au fur et à mesure des tests.
