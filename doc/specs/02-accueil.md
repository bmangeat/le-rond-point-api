# Page d'accueil — `/{groupId}`

La page d'accueil est le hub central. Elle agrège toutes les informations clés du groupe sur une seule vue scrollable.

---

## Structure de la page

### Header

- Logo de l'app (icône 44px, coins arrondis) + titre "Le Rond Point".
- Avatar de l'utilisateur connecté en haut à droite → lien vers `/{groupId}/profile`.

### Bannière push (`PushPrompt`)

Affichée si les notifications push ne sont pas encore activées. Invite l'utilisateur à les activer. Disparaît une fois activées.

---

## Section 1 — Je suis au quartier aujourd'hui (`TodayPresenceToggle`)

**Logique :**
- Vérifie si l'utilisateur a une présence couvrant la journée actuelle (`GET /api/presences/today`).
- **Si présent aujourd'hui :**
  - Affiche un badge vert "🟢 Je suis au quartier aujourd'hui".
  - Si la présence est d'un seul jour (créée via le toggle, startDate = endDate = aujourd'hui) : bouton "Annuler ma présence" → `DELETE /api/presences/{id}`.
  - Si la présence fait partie d'une plage plus longue : affiche seulement le badge (pas d'annulation directe).
- **Si non présent :**
  - Bouton "📍 Je suis au quartier aujourd'hui" → crée une présence `startDate = endDate = aujourd'hui`, disponibilité `OPEN` (`POST /api/presences`).
- Mise à jour optimiste, `router.refresh()` après action.

---

## Section 2 — Calendrier mensuel

### Navigation

- Flèches gauche/droite pour naviguer mois par mois.
- Mois et année affichés au centre.
- En-têtes des jours : L M M J V S D.

### Cellules du calendrier

Chaque cellule représente un jour du mois.

**Mise en forme conditionnelle :**

| Condition | Rendu |
|-----------|-------|
| Aujourd'hui (sans présence perso) | Contour primary |
| Jour avec présence de l'utilisateur connecté | Fond `primary-light`, texte primary, bordure primary |
| Jour passé | Opacité 50% |

**Badges de présence :**
- Badge numérique en haut à droite de la cellule : nombre total de personnes présentes ce jour (toutes présences confondues, y compris l'utilisateur lui-même).
- Fond `primary`, texte blanc.
- Affiché uniquement si ≥ 1 présence.

**Pastilles d'événement :**
- Jusqu'à 3 petits ronds colorés en bas de la cellule, un par événement ce jour.
- Couleur = couleur accent du type de sortie.

**Interaction :**
- Tap sur n'importe quel jour → ouvre le **DayDetailSheet** (bottom sheet).

### `DayDetailSheet`

Bottom sheet glissant depuis le bas avec :
- **Titre :** date formatée (ex. "Mercredi 14 juin").
- **Section présences :** liste de chaque présence ce jour (avatar, prénom, dates exactes de la période, note, badge disponibilité OPEN/BUSY).
  - Si c'est sa propre présence → bouton d'édition.
- **Section sorties :** liste des sorties ce jour (glyph type, nom, heure, lieu).
  - Tap → navigue vers `/{groupId}/sorties/{id}`.
- **Bouton "Ajouter une présence"** en bas de sheet → ferme le sheet et ouvre `PresenceForm` pré-rempli avec la date.
- Backdrop pour fermer.

---

## Section 3 — Timeline "Qui est là en [mois]"

**Une ligne par membre** ayant au moins une présence dans le mois affiché.

- Les **résidents** (isResident = true) sont exclus de la timeline (ils ont leur propre section).
- Tri : l'utilisateur connecté en premier, puis par date de début de première présence.

### Ligne de timeline

```
[Avatar + Prénom] [Barre horizontale avec segment(s)]
```

- La barre représente les 31 jours du mois.
- **Un segment** par présence dans le mois (un membre peut avoir plusieurs présences dans le même mois → plusieurs segments sur la même barre).
- Fond de barre : `surface-raised`.
- **Segment OPEN** : fond plein avec la couleur membre.
- **Segment BUSY** : motif rayures diagonales alternant couleur membre et couleur à 55% d'opacité.
- **Date toujours visible :** si le segment est assez large (> ~22% de la barre), la plage de dates est affichée en blanc à l'intérieur (ex. "14–21"). Sinon, la date est affichée en pastille au-dessus du segment (en couleur membre).
- Tap sur un segment : si c'est sa propre présence → ouvre `PresenceForm` en édition. Sinon → ouvre le `DayDetailSheet` au premier jour de la présence.

**Message vide :** "Personne au quartier ce mois-ci."

---

## Section 3bis — Les locaux (résidents)

Affichée uniquement si au moins un membre a `isResident = true`.

- Card cliquable → navigue vers `/{groupId}/membres?filter=residents`.
- Affiche les avatars des résidents (max 5, style "pile" avec overlap).
- Texte : "🏠 Les locaux" + "[N] pote(s) sont sur place toute l'année".

---

## Section 4 — Prochaines sorties

Affichée uniquement s'il y a des sorties à venir.

**Carousel horizontal** scrollable (dépassement visible de chaque côté), une card par sortie :
- Glyph type (emoji + fond coloré, 36px).
- Nom de la sortie (tronqué).
- Date courte (ex. "Sam 15 juin").
- **Chip de statut RSVP** de l'utilisateur connecté :
  - ✓ Tu viens (vert)
  - Sans toi (rouge)
  - À répondre (orange)
  - Annulée (gris, si `cancelledAt` non null)
- Tap → navigue vers `/{groupId}/sorties/{id}`.

---

## Section 5 — Tes prochaines présences

Affichée uniquement si l'utilisateur a des présences à venir.

**Une card par présence de l'utilisateur :**
- Plage de dates formatée (ex. "14–21 juin").
- Badge disponibilité (OPEN / BUSY).
- **Encart de chevauchement :**
  - Si des membres sont présents en même temps → liste de leurs avatars (max 4, style pile) + texte :
    - 1 personne : "[Prénom] sera là aussi"
    - Plusieurs : "[N] amis seront là en même temps"
  - Si personne → "Personne d'autre pour l'instant — ça peut changer !"
- Tap sur la card → ouvre `PresenceForm` en édition.

---

## Formulaire de présence (`PresenceForm`)

Bottom sheet plein écran ou demi-écran (selon la hauteur de l'écran).

**Champs :**
- Date d'arrivée (input date, obligatoire)
- Date de départ (input date, obligatoire, min = date d'arrivée)
- Disponibilité (boutons radio) :
  - 🟢 "Ouvert aux retrouvailles" (`OPEN`)
  - 🟡 "Passage rapide, peu dispo" (`BUSY`)
- Note (textarea, optionnel, max 200 caractères, compteur de caractères)

**Comportements :**
- En création : `POST /api/presences`
- En édition : `PATCH /api/presences/{id}` + bouton "Supprimer" (avec confirmation) → `DELETE /api/presences/{id}`
- Validation : dates cohérentes (fin ≥ début).
- Après succès : `router.refresh()`.

---

## Données chargées côté serveur

La page RSC charge en parallèle :
- Toutes les présences du groupe (à venir, du 1er jour du mois courant jusqu'à 3 mois dans le futur)
- Mes présences à venir avec leurs chevauchements
- Les prochaines sorties (à partir d'aujourd'hui)
- Les résidents du groupe
- Si l'utilisateur est présent aujourd'hui + si c'est une présence d'un seul jour
