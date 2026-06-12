# Modèle de données

## Schéma Prisma complet

### Group

```prisma
model Group {
  id          String   @id @default(cuid())
  name        String
  creatorId   String   // snapshot de l'id du créateur (pas de FK — survit au départ)
  createdAt   DateTime @default(now())

  memberships GroupMembership[]
  events      Event[]
  invitations Invitation[]
  presences   Presence[]
}
```

Un groupe = un "Rond Point" étanche. Toutes les données opérationnelles (présences, sorties, invitations) sont cloisonnées par `groupId`.

---

### User

```prisma
model User {
  id            String     @id @default(cuid())
  email         String     @unique
  name          String
  image         String?
  emailVerified DateTime?

  // Profil global (partagé entre tous les groupes)
  city      String?
  birthday  DateTime?
  phone     String?
  instagram String?
  snapchat  String?
  tiktok    String?
  linkedin  String?

  // Notifications push (préférences globales, pas par groupe)
  notifPush           Boolean @default(false)
  notifPushOverlap    Boolean @default(true)
  notifPushBirthday   Boolean @default(true)
  notifPushPresence   Boolean @default(true)
  notifPushPhotos     Boolean @default(true)
  notifPushEvents     Boolean @default(true)
  isResident          Boolean @default(false)
  notifPushAsResident Boolean @default(true)

  // Rôle global — uniquement pour le SUPER_ADMIN
  // Le rôle dans chaque groupe est sur GroupMembership
  globalRole GlobalRole @default(USER)

  isActive  Boolean  @default(true) // soft delete global (SUPER_ADMIN uniquement)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  memberships           GroupMembership[]
  pushSubscriptions     PushSubscription[]
  eventsHosted          Event[]                   @relation("EventHost")
  eventRsvps            EventRsvp[]
  eventNeeds            EventNeed[]               @relation("NeedClaim")
  eventExpenses         EventExpense[]            @relation("ExpensePayer")
  expenseParticipations EventExpenseParticipant[]
  eventComments         EventComment[]
  eventPhotos           EventPhoto[]              @relation("PhotoUploader")
  commentReports        CommentReport[]

  // NextAuth
  accounts Account[]
  sessions Session[]
}
```

**Ce qui a bougé par rapport à un modèle mono-groupe :**
- `groupId` supprimé : un utilisateur peut appartenir à plusieurs groupes.
- `memberColor` supprimé : la couleur est per-group sur `GroupMembership`.
- `role` renommé `globalRole` : seul `SUPER_ADMIN` est global. Le rôle ADMIN/MEMBER dans un groupe vit sur `GroupMembership`.
- `onboardedAt` supprimé : l'onboarding est per-group sur `GroupMembership.onboardedAt`.

---

### GroupMembership ← table centrale du multi-tenant

```prisma
model GroupMembership {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  groupId     String
  group       Group     @relation(fields: [groupId], references: [id], onDelete: Cascade)

  role        GroupRole @default(MEMBER)
  memberColor Int       @default(1)  // 1-12, unique au sein du groupe (logique applicative)
  isResident  Boolean   @default(false) // peut différer du User.isResident global

  isActive    Boolean   @default(true) // false = retiré du groupe (soft delete per-group)
  onboardedAt DateTime?               // null = onboarding non complété pour CE groupe
  joinedAt    DateTime  @default(now())

  @@unique([userId, groupId])
  @@index([groupId])
  @@index([userId])
}
```

**`GroupMembership` porte :**
- L'appartenance (userId ↔ groupId).
- Le **rôle dans ce groupe** (`ADMIN` ou `MEMBER`).
- La **couleur membre dans ce groupe** (peut être différente d'un groupe à l'autre).
- Le **statut résident dans ce groupe** (quelqu'un peut être local pour un groupe mais pas pour un autre).
- Le **statut d'onboarding pour ce groupe** (`onboardedAt`).
- Le **soft delete per-group** (`isActive = false` = retiré du groupe sans supprimer le compte).

**Assignation de la couleur membre :** à la création de la membership (création de groupe ou acceptation d'invitation), l'API calcule les couleurs déjà utilisées dans ce groupe et assigne la première disponible parmi 1–12. Si les 12 sont prises, elle assigne la moins utilisée. Logique centralisée dans `assignMemberColor(groupId)`.

---

### Presence

```prisma
model Presence {
  id           String       @id @default(cuid())
  userId       String
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  groupId      String                                // ← obligatoire, présence scoped par groupe
  group        Group        @relation(fields: [groupId], references: [id], onDelete: Cascade)
  startDate    DateTime     // minuit UTC
  endDate      DateTime     // minuit UTC
  note         String?      @db.VarChar(200)
  availability Availability @default(OPEN)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@index([groupId])
  @@index([userId, groupId])
}
```

**`groupId` est désormais porté directement par `Presence`** (auparavant inféré de `user.groupId`). Un utilisateur qui appartient à deux groupes a des présences distinctes pour chaque groupe.

---

### Invitation

```prisma
model Invitation {
  id            String    @id @default(cuid())
  email         String?   // null = lien générique à usage unique
  token         String    @unique @default(cuid())
  expiresAt     DateTime
  usedAt        DateTime?
  invitedUserId String?   @unique
  invitedUser   User?     @relation("InvitedUser", fields: [invitedUserId], references: [id])
  groupId       String                              // obligatoire
  group         Group     @relation(fields: [groupId], references: [id])
  createdAt     DateTime  @default(now())
}
```

Lorsqu'une invitation est acceptée :
- Si l'email correspond à un compte existant → une `GroupMembership` est créée pour cet utilisateur (pas de nouveau compte).
- Si l'email est nouveau → un compte `User` est créé, puis la `GroupMembership`.

---

### Event

```prisma
model Event {
  id              String      @id @default(cuid())
  type            EventType
  name            String
  hostId          String?
  host            User?       @relation("EventHost", fields: [hostId], references: [id], onDelete: SetNull)
  description     String?     @db.VarChar(500)
  whenAt          DateTime
  placeName       String
  placeAddr       String?
  status          EventStatus @default(ACTIVE)
  cancelReason    String?     @db.VarChar(500)
  cancelledAt     DateTime?
  needsEnabled    Boolean     @default(false)
  tricountEnabled Boolean     @default(true)
  hasPlaylist     Boolean     @default(false)
  playlistUrl     String?
  groupId         String
  group           Group       @relation(fields: [groupId], references: [id])
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  rsvps    EventRsvp[]
  needs    EventNeed[]
  expenses EventExpense[]
  comments EventComment[]
  photos   EventPhoto[]

  @@index([whenAt])
  @@index([groupId, status])
}
```

---

### EventRsvp

```prisma
model EventRsvp {
  id      String     @id @default(cuid())
  eventId String
  event   Event      @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId  String
  user    User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  status  RsvpStatus @default(PENDING)

  @@unique([eventId, userId])
  @@index([eventId])
}
```

**RSVP pré-créés :** à la création d'un événement, une ligne `PENDING` est créée pour chaque membre actif du groupe (`GroupMembership.isActive = true`). L'hôte est automatiquement passé à `YES`. Quand un nouveau membre rejoint le groupe, des RSVP `PENDING` sont créés pour tous les événements à venir du groupe.

---

### EventNeed

```prisma
model EventNeed {
  id          String   @id @default(cuid())
  eventId     String
  event       Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  label       String
  claimedById String?
  claimedBy   User?    @relation("NeedClaim", fields: [claimedById], references: [id], onDelete: SetNull)
  createdAt   DateTime @default(now())

  @@index([eventId])
}
```

---

### EventExpense + EventExpenseParticipant

```prisma
model EventExpense {
  id        String   @id @default(cuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  payerId   String
  payer     User     @relation("ExpensePayer", fields: [payerId], references: [id], onDelete: Cascade)
  label     String
  amount    Float
  createdAt DateTime @default(now())

  participants EventExpenseParticipant[]

  @@index([eventId])
}

model EventExpenseParticipant {
  expenseId String
  expense   EventExpense @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  userId    String
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([expenseId, userId])
  @@index([expenseId])
}
```

---

### EventComment + CommentReport

```prisma
model EventComment {
  id        String          @id @default(cuid())
  eventId   String
  event     Event           @relation(fields: [eventId], references: [id], onDelete: Cascade)
  authorId  String
  author    User            @relation(fields: [authorId], references: [id], onDelete: Cascade)
  text      String          @db.VarChar(500)
  createdAt DateTime        @default(now())
  reports   CommentReport[]

  @@index([eventId])
}

model CommentReport {
  id         String       @id @default(cuid())
  commentId  String
  comment    EventComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  reporterId String
  reporter   User         @relation(fields: [reporterId], references: [id], onDelete: Cascade)
  reason     String?      @db.VarChar(280)
  createdAt  DateTime     @default(now())

  @@unique([commentId, reporterId])
  @@index([commentId])
}
```

---

### EventPhoto

```prisma
model EventPhoto {
  id         String   @id @default(cuid())
  eventId    String
  event      Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  uploaderId String
  uploader   User     @relation("PhotoUploader", fields: [uploaderId], references: [id], onDelete: Cascade)
  url        String
  createdAt  DateTime @default(now())

  @@index([eventId])
  @@index([createdAt])
}
```

TTL : 7 jours après `Event.whenAt`. La date limite est affichée dans l'UI.

---

### PushSubscription

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())

  @@index([userId])
}
```

Les subscriptions sont globales (pas per-group). Les préférences de types de notifications (overlap, birthday…) sont aussi globales sur `User`.

---

### AuditLog

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  actorId    String   // snapshot, pas de FK
  actorEmail String
  action     String
  targetType String
  targetId   String
  groupId    String?
  reason     String?  @db.VarChar(500)
  metadata   Json?
  createdAt  DateTime @default(now())

  @@index([createdAt])
  @@index([action])
  @@index([actorId])
  @@index([targetType, targetId])
}
```

---

### Enums

```prisma
enum GlobalRole {
  SUPER_ADMIN  // accès à tous les groupes, modération globale
  USER         // rôle dans chaque groupe défini par GroupMembership.role
}

enum GroupRole {
  ADMIN   // admin de ce groupe
  MEMBER  // membre de ce groupe
}

enum EventType {
  BAR
  RESTO
  SOIREE
  SORTIE
}

enum EventStatus {
  ACTIVE
  CANCELLED
}

enum RsvpStatus {
  YES
  NO
  PENDING
}

enum Availability {
  OPEN  // Ouvert aux retrouvailles
  BUSY  // Passage rapide, peu dispo
}
```

---

## Conséquences sur les contrôles d'accès

Avec `GroupMembership`, toutes les gardes d'accès changent :

| Avant | Après |
|-------|-------|
| `user.groupId === params.groupId` | `GroupMembership.findUnique({ userId, groupId, isActive: true })` |
| `user.role === "ADMIN"` | `membership.role === "ADMIN"` |
| `user.memberColor` | `membership.memberColor` |
| `user.onboardedAt` | `membership.onboardedAt` |

Un helper `requireGroupAccess(userId, groupId)` retourne la `GroupMembership` active ou lève une erreur 403. Toutes les pages `/{groupId}/*` et toutes les routes `/api/*` l'appellent en premier.

---

## Index

| Table | Index | Raison |
|-------|-------|--------|
| `GroupMembership` | `groupId`, `userId` | Lookup rapide dans les deux sens |
| `Presence` | `groupId`, `(userId, groupId)` | Présences d'un groupe, présences d'un user dans un groupe |
| `Event` | `whenAt`, `(groupId, status)` | Filtrage par date et statut |
| `EventRsvp` | `eventId` | Participants d'un événement |
| `EventNeed` | `eventId` | Besoins d'un événement |
| `EventExpense` | `eventId` | Dépenses |
| `EventExpenseParticipant` | `expenseId` | Participants d'une dépense |
| `EventComment` | `eventId` | Fil de discussion |
| `EventPhoto` | `eventId`, `createdAt` | Galerie + cleanup |
| `CommentReport` | `commentId` | Modération |
| `PushSubscription` | `userId` | Envoi de notifs |
| `AuditLog` | `createdAt`, `action`, `actorId`, `(targetType, targetId)` | Logs |

---

## Contraintes et conventions

- `User` n'a plus de `groupId`, `memberColor`, `role` (group-scoped) ni `onboardedAt`.
- Toute donnée per-group (rôle, couleur, onboarding, résidence) est sur `GroupMembership`.
- `Presence.groupId` est obligatoire et indexé.
- `Invitation.groupId` est obligatoire.
- `GroupRole` (ADMIN/MEMBER) et `GlobalRole` (SUPER_ADMIN/USER) sont deux enums distincts.
- Les RSVP sont pré-créés à `PENDING` pour tous les membres actifs à la création d'un événement.
- Les suppressions de compte sont des soft deletes globaux (`User.isActive`). Les retraits de groupe sont des soft deletes per-group (`GroupMembership.isActive`).
