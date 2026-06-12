# Annuaire des membres — `/{groupId}/membres`

## Vue d'ensemble

Annuaire de tous les membres actifs du groupe, avec recherche, filtres et tri.

---

## Accès

- Lien depuis `/{groupId}/profile` (section "Le quartier").
- Lien depuis le strip "Les locaux" sur l'accueil (avec `?filter=residents` pour pré-filtrer).

---

## Header

- Bouton retour ←.
- Titre "Le quartier" + sous-titre "[N] membre(s)".

---

## Barre de recherche

- Input avec icône loupe.
- Recherche insensible à la casse et aux accents sur le **nom** et la **ville**.
- Résultats filtrés en temps réel.

---

## Filtres et tri

Chips horizontaux scrollables :

| Chip | Condition d'affichage | Comportement |
|------|-----------------------|--------------|
| "🏠 Locaux (N)" | Si ≥ 1 résident | Toggle → afficher seulement les résidents |
| "• Au quartier (N)" | Si ≥ 1 présent aujourd'hui | Toggle → afficher seulement ceux présents aujourd'hui |
| "A → Z" | Toujours | Tri par nom (défaut) |
| "Par ville" | Toujours | Tri alphabétique par ville (sans ville = en dernier) |

---

## Liste des membres

**Card par membre :**
- Avatar + nom.
- Icône 🏠 si résident (`isResident = true`).
- Badge statut (mutuellement exclusifs, priorité à "ici") :
  - "● ici" (fond vert) si `hereNow = true`.
  - "bientôt là" (texte vert clair) si `aroundSoon = true` (présence à venir dans les 30 prochains jours).
- Ville (si renseignée, avec icône épingle).
- Flèche → navigue vers `/{groupId}/membres/{id}`.

**Tri :**
- Par défaut : alphabétique sur le nom.
- Par ville : alphabétique sur la ville, puis nom. Les sans-ville sont mis en fin de liste.

---

## Page membre — `/{groupId}/membres/[id]`

Vue publique en lecture seule d'un profil membre.

### Header

- Bouton retour ←.
- Avatar centré (grand).
- Nom complet.
- Badge rôle (Membre / Admin).
- Badge couleur membre.

### Informations

- Ville (si renseignée).
- Anniversaire : affiché en "JJ/MM/AAAA" (ou seulement JJ/MM si on veut masquer l'année — à décider).
- Téléphone (si renseigné).

### Réseaux sociaux

- Un lien par réseau renseigné, avec icône et couleur.
- Instagram / Snapchat / TikTok : préfixe "@" + pseudo + lien vers le profil.
- LinkedIn : lien direct.

### Prochaines présences

- Liste des présences à venir de ce membre dans le groupe.
- Plage de dates + badge disponibilité + note.

---

## Données chargées

La page RSC charge :
- Liste des membres actifs avec `hereNow` et `aroundSoon` calculés dynamiquement.
  - `hereNow` : a une présence où `startDate ≤ aujourd'hui ≤ endDate`.
  - `aroundSoon` : a une présence future dans les 30 prochains jours.
- `isResident` pour le filtrage.
