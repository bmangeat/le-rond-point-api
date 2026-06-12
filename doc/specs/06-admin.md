# Administration — `/{groupId}/admin`

Accessible uniquement aux rôles ADMIN et SUPER_ADMIN.

---

## Section 1 — Paramètres du groupe

### Renommer le groupe

- Champ texte pré-rempli avec le nom actuel (max 50 caractères).
- Bouton "Enregistrer".
- `PATCH /api/groups/{groupId}` `{ name }`.
- Mise à jour optimiste du nom dans le header et la liste `/groups`.

---

## Section 2 — Commentaires signalés (modération)

Affichée uniquement s'il y a des commentaires en attente de modération.

**En-tête :** "🚩 Commentaires signalés (N)" en rouge.

**Pour chaque commentaire signalé :**
- Auteur (nom) + lien vers la sortie concernée.
- Badge "[N] signalement(s)".
- Texte du commentaire dans une card.
- Liste des signalements : "↳ Signalé par [Prénom] : « [raison] »".
- 2 boutons d'action :
  - **Supprimer** (rouge) → confirmation → `POST /api/admin/reports` `{ commentId, op: "delete" }` → supprime le commentaire + ses signalements.
  - **Ignorer** (gris) → confirmation → `POST /api/admin/reports` `{ commentId, op: "dismiss" }` → supprime seulement les signalements (commentaire conservé).
- Mise à jour optimiste : le commentaire disparaît immédiatement de la liste.

---

## Section 3 — Inviter un membre

### Par email

- Champ email + bouton "Inviter".
- `POST /api/admin/invite` `{ email }`.
- Résultat : email envoyé (via Resend si configuré) + invitation ajoutée dans "En attente".
- Message de succès : "Invitation envoyée à [email] !"
- Erreur si email déjà membre ou déjà invité.

### Lien générique à usage unique

- Bouton "🔗 Générer un lien d'invitation".
- `POST /api/admin/invite/link`.
- Affiche le lien dans un input readonly + bouton "Copier" → `navigator.clipboard.writeText`.
  - Feedback visuel "Copié" pendant 2 secondes.
- Description : "Lien à usage unique, valable 7 jours. Partage-le à qui tu veux."
- L'invitation créée s'ajoute dans la liste "En attente" avec `email = null` (affiché : "Lien d'invitation").

---

## Section 4 — Invitations en attente

Liste des invitations non utilisées et non expirées.

**Pour chaque invitation :**
- Icône mail (email nominatif) ou icône lien (générique).
- Email ou "Lien d'invitation".
- Date d'expiration : "Expire le [date FR]".
- Bouton 🗑️ suppression → confirmation → `DELETE /api/admin/invite/{id}` → disparaît de la liste (optimiste).

---

## Section 5 — Membres

Liste de tous les membres actifs du groupe.

**Pour chaque membre :**
- Avatar + nom + badge "Admin" si applicable.
- Email + ville.
- Flèche → ouvre la **fiche membre** (bottom sheet).

### Fiche membre (bottom sheet)

- Avatar, nom, email, ville.
- Badge couleur membre dans ce groupe (cercle + numéro de couleur).
- Lien "Voir le profil complet" → `/{groupId}/membres/{id}`.
- **Section Rôle :**
  - Si c'est soi-même : "Tu ne peux pas modifier ton propre rôle."
  - Sinon : 2 boutons radio "Membre" / "Admin".
  - Clic → `PATCH /api/admin/members/{id}` `{ role }` → met à jour `GroupMembership.role`.
  - Mise à jour optimiste + `router.refresh()`.
- **Bouton "Retirer du groupe"** (rouge) :
  - Affiché si ce n'est pas soi-même ET que le membre n'est pas Admin (protection).
  - Confirmation : "Retirer [Prénom] du groupe ? Ses présences passées seront conservées."
  - `DELETE /api/admin/members/{id}` → `GroupMembership.isActive = false` (soft-delete per-group — le compte global est intact).
  - Ferme le bottom sheet + `router.refresh()`.

---

## API

| Méthode | Route | Description |
|---------|-------|-------------|
| `PATCH` | `/api/groups/{groupId}` | Renommer le groupe |
| `POST` | `/api/admin/invite` | Envoyer une invitation par email |
| `POST` | `/api/admin/invite/link` | Générer un lien générique |
| `DELETE` | `/api/admin/invite/{id}` | Supprimer une invitation |
| `PATCH` | `/api/admin/members/{id}` | Modifier le rôle d'un membre |
| `DELETE` | `/api/admin/members/{id}` | Retirer un membre (soft delete) |
| `POST` | `/api/admin/reports` | Supprimer ou ignorer un commentaire signalé |

---

## Règles de sécurité

- Toutes les routes `/api/admin/*` vérifient que l'utilisateur a `GroupMembership.role = ADMIN` (ou `User.globalRole = SUPER_ADMIN`) pour le groupe cible **en base** (jamais depuis le token JWT seul).
- Un admin ne peut pas modifier son propre rôle dans ce groupe.
- Un admin ne peut pas retirer un autre admin (protection contre la suppression accidentelle d'accès).
- Les retraits de groupe sont des **soft deletes per-group** : `GroupMembership.isActive = false`. Le compte global (`User`) et les données (présences, commentaires) sont conservés. L'utilisateur reste visible dans l'historique mais n'apparaît plus dans les listes de membres actifs.

---

## Audit Log

Toutes les actions admin importantes sont tracées dans la table `AuditLog` :
- Acteur : id + email snapshot.
- Action : ex. `COMMENT_DELETED`, `USER_DEACTIVATED`, `ROLE_CHANGED`, `INVITATION_GENERATED`.
- Entité cible : type + id.
- Groupe concerné.
- Raison optionnelle.
- Metadata JSON (snapshot de l'état au moment de l'action).
