# Présences — `/{groupId}/presences`

## Vue d'ensemble

Page listant toutes les présences du groupe (les siennes et celles des autres), chronologiquement, avec filtre par membre.

---

## Header

- Titre "Présences".

## Filtre par membre

Affiché uniquement si le groupe a plus d'un membre ayant des présences.

- Carrousel horizontal de chips scrollable.
- Chip "Tout le monde" (actif par défaut, fond `primary`).
- Une chip par membre ayant au moins une présence (à venir ou passée), avec avatar + prénom.
- Sélection multiple possible (toggle par membre). Filtre cumulatif (OU).
- Réinitialisation via "Tout le monde".

---

## Section "Aujourd'hui"

Présences actives ce jour (startDate ≤ aujourd'hui ≤ endDate, en UTC).

- Indicateur vert animé "AUJOURD'HUI" en en-tête de section.
- Si vide, la section n'est pas affichée.

---

## Groupes par mois

Les présences à venir (hors aujourd'hui) sont groupées par mois de début :
- Séparateur de section avec le mois et l'année (ex. "Juillet 2026").
- Les présences d'un même mois triées par date de début.

---

## PresenceCard

Chaque présence est affichée dans une card :

- **Avatar** + **Nom** de l'utilisateur (tronqué si long).
- **Ville** de résidence (si renseignée, avec icône épingle).
- **Plage de dates** formatée (ex. "14 – 21 juin 2026" ou "14 juin" si même jour).
- **Badge disponibilité** :
  - 🟢 "Ouvert" (fond vert clair, texte vert)
  - 🟡 "Passage rapide" (fond ambre clair, texte ambre)
- **Note** (si présente, affichée en texte muted, max 200 caractères).
- **Actions** (uniquement sur ses propres présences ou admin) :
  - Bouton crayon → ouvre `PresenceForm` en édition.
  - Bouton corbeille → confirmation → `DELETE /api/presences/{id}`.

---

## Anciennes présences

Cachées par défaut.

- Bouton "Voir les anciennes (N)" avec chevron → accordéon.
- Les présences passées sont listées sans séparateur de mois, style légèrement atténué.
- Pas de bouton d'édition (les présences passées restent affichées pour la mémoire collective).

---

## État vide

Si aucune présence à venir (après filtrage) :
- Emoji 📅 + message "Aucune présence à venir."
- Si le filtre est actif : "Aucune présence pour cette sélection."
- Si aucun filtre et groupe vide : bouton "Ajoute la tienne →" → ouvre `PresenceForm`.

---

## FAB

Bouton "+" flottant en bas à droite → ouvre `PresenceForm` en création.

---

## API

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/presences` | Liste les présences du groupe (à venir + passées récentes) |
| `POST` | `/api/presences` | Créer une présence |
| `PATCH` | `/api/presences/{id}` | Modifier une présence (propriétaire ou admin) |
| `DELETE` | `/api/presences/{id}` | Supprimer une présence (propriétaire ou admin) |
| `GET` | `/api/presences/today` | Vérifie si l'utilisateur est présent aujourd'hui |

### Règles métier

- Les dates sont stockées à **minuit UTC** (`YYYY-MM-DDT00:00:00.000Z`).
- Un utilisateur ne peut pas créer deux présences avec exactement les mêmes dates (doublon exact).
- Un membre ne peut modifier/supprimer que ses propres présences. Un admin peut modifier/supprimer n'importe quelle présence de son groupe.
- Le cloisonnement par groupe est vérifié côté API : `user.groupId` est non-nullable, on filtre directement par cette valeur.

### Déclenchement des notifications push

Lors de `POST /api/presences`, le serveur vérifie les **chevauchements** avec les présences existantes du groupe. Pour chaque membre dont la présence chevauche la nouvelle :
- Notif push envoyée si `notifPush = true` ET `notifPushOverlap = true`.
- L'auteur de la nouvelle présence ne reçoit pas de notif.
- La notif indique le nom de la personne qui vient d'arriver + les dates.
