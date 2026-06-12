# Spécifications fonctionnelles — Le Rond Point

> Générées à partir de l'analyse complète du code source, enrichies des décisions de design pour une reconstruction propre.

## Index

| Fichier | Contenu |
|---------|---------|
| [00-overview.md](./00-overview.md) | Vue d'ensemble, stack, architecture multi-tenant, routing, design system, navigation |
| [01-auth.md](./01-auth.md) | Authentification Google, invitation, onboarding 3 étapes, middleware, rôles |
| [02-accueil.md](./02-accueil.md) | Page d'accueil : toggle présence du jour, calendrier mensuel, timeline, locaux, sorties, tes présences |
| [03-presences.md](./03-presences.md) | Liste des présences, filtres, PresenceCard, formulaire, API |
| [04-sorties.md](./04-sorties.md) | Liste, création, détail (3 onglets : Qui vient / Logistique / Le fil), édition, annulation, photos, commentaires |
| [05-profil.md](./05-profil.md) | Profil personnel, réseaux sociaux, notifications push, statut résident |
| [06-admin.md](./06-admin.md) | Modération commentaires, invitations, gestion des membres, rôles, audit log |
| [07-membres.md](./07-membres.md) | Annuaire des membres, filtres, profil public |
| [08-notifications.md](./08-notifications.md) | Tous les types de notifications push (temps réel + cron quotidien), architecture Web Push |
| [09-modele-de-donnees.md](./09-modele-de-donnees.md) | Schéma Prisma complet, index, contraintes et conventions |
| [10-groupes.md](./10-groupes.md) | Page `/groups` (hub + création), rejoindre un groupe, switcher, quitter |

---

## Décisions de design (par rapport au code original)

Ces choix sont actés dans les specs et doivent être respectés à la reconstruction.

### Schéma

| # | Décision | Raison |
|---|----------|--------|
| 1 | `logisticsKind` supprimé de `Event` | Champ legacy sans usage, remplacé par `needsEnabled` + `tricountEnabled` |
| 2 | `notifEmail` supprimé de `User` | Feature email non implémentée ; sera ajoutée plus tard si besoin, avec sa propre migration |
| 3 | `EventRsvp.status` → enum `RsvpStatus { YES NO PENDING }` | Intégrité en base, pas de String libre |
| 4 | `Event.cancelledAt DateTime?` → enum `EventStatus { ACTIVE CANCELLED }` | Source de vérité claire ; `cancelledAt` conservé comme timestamp d'audit seulement |
| 5 | `EventExpense.forUserIds String[]` → table `EventExpenseParticipant` | Normalisation, intégrité référentielle, `onDelete: Cascade` propre |
| 6 | `User.groupId` supprimé → table `GroupMembership` | Un utilisateur peut appartenir à plusieurs groupes ; toutes les données per-group (rôle, couleur, onboarding, résidence) sont sur `GroupMembership` |
| 7 | `Invitation.groupId` non-nullable | Toute invitation cible un groupe précis |
| 8 | `Event.hostId` : `onDelete: SetNull` (au lieu de Cascade) | L'événement survit au départ de son organisateur |
| 9 | Couleur membre unique par groupe | Logique applicative dans `assignMemberColor(groupId)` à la création de la membership |

### Architecture API

| # | Décision | Raison |
|---|----------|--------|
| 10 | Routes dédiées par action (plus de dispatcher `action` dans le body) | Périmètres clairs, droits distincts, erreurs HTTP expressives |
| 11 | `GET /api/events/{id}/balances` côté serveur | Calcul Tricount centralisé, évite la re-computation à chaque render client |

### Multi-tenant

| # | Décision | Raison |
|---|----------|--------|
| 14 | `GlobalRole` (SUPER_ADMIN / USER) vs `GroupRole` (ADMIN / MEMBER) | Séparation claire entre accès global et rôle dans un groupe ; le rôle local vit sur `GroupMembership` |
| 15 | `Presence.groupId` obligatoire et indexé | Un utilisateur multi-groupe a des présences distinctes par groupe ; les lookups cron/API filtrent directement par groupId |
| 16 | Onboarding per-group via `GroupMembership.onboardedAt` | Un utilisateur rejoignant un 2ème groupe fait l'onboarding pour ce nouveau groupe sans refaire le profil global |
| 17 | `/groups` hub central, `/orphelin` supprimé | Un utilisateur sans groupe voit `/groups` (état vide + CTA création) ; plus de route dédiée orphelin |
| 18 | `isResident` per-group sur `GroupMembership` | Le statut résident peut différer d'un groupe à l'autre (local pour un Rond Point, expatrié pour un autre) |

### Comportements

| # | Décision | Raison |
|---|----------|--------|
| 12 | RSVP pré-créés à `PENDING` pour tous les membres à la création d'un événement | Compteurs fiables, pas de jointure membres nécessaire, liste complète dès le départ |
| 13 | TTL photos = 7j après `Event.whenAt` (pas après upload) | Toutes les photos d'une même sortie expirent ensemble. La date limite est affichée explicitement sur chaque photo |

---

## Périmètre couvert

- ✅ Multi-tenant (groupes étanches)
- ✅ Auth Google OAuth + bypass dev
- ✅ Onboarding 3 étapes (profil, notifications, première présence)
- ✅ Calendrier mensuel avec timeline
- ✅ Gestion des présences (CRUD, chevauchements)
- ✅ Sorties (4 types, RSVP, besoins, Tricount, playlist, photos, commentaires)
- ✅ Notifications push (8 types déclencheurs)
- ✅ Cron quotidien (anniversaires, rappels, expiration photos, rappels sorties)
- ✅ Administration (invitations, rôles, modération, audit log)
- ✅ Annuaire membres avec statuts dynamiques
- ✅ PWA (manifest, service worker, splash screens)
- ✅ Statut résident

## Hors périmètre

- ❌ Chat / messagerie directe
- ❌ Emails transactionnels (Resend non branché — à traiter comme feature future)
- ❌ Suggestions d'activités
- ❌ Intégration Google Calendar (export .ics dispo, import écarté)
- ❌ Carte du quartier
