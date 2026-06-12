# Le Rond Point — Vue d'ensemble

## Concept

Application web mobile-first (PWA) pour un groupe d'amis d'un quartier d'enfance dispersés dans le monde. Chacun publie ses **fenêtres de présence** au quartier, organise des **sorties**, et reste informé de la vie du groupe.

Le groupe est **fermé** : inscription sur invitation uniquement. L'app est conçue pour 20-30 personnes max.

---

## Architecture multi-tenant

L'application est multi-tenant : chaque groupe ("Rond Point") est une instance étanche.

- Un **Group** regroupe des utilisateurs, des événements, et des invitations.
- Toutes les pages applicatives sont sous `/{groupId}/...`
- Les **API restent plates** (`/api/*`) et filtrent par le `groupId` du user en session/base (jamais dans l'URL).
- Un utilisateur sans groupe est "orphelin" → redirigé vers `/orphelin`.

### Routing

```
/                               → Redirecteur (→ /groups, avec mémoire du dernier groupe visité)
/login                          → Connexion (publique)
/invite/[token]                 → Landing invitation (publique)
/403                            → Accès refusé
/groups                         → Hub : liste des groupes + création (switcher)
/profile                        → Profil global (nom, photo, réseaux sociaux, notifs)
/{groupId}/                     → Accueil du groupe (calendrier + présences + sorties)
/{groupId}/presences            → Liste des présences du groupe
/{groupId}/sorties              → Liste des sorties
/{groupId}/sorties/nouveau      → Créer une sortie
/{groupId}/sorties/[id]         → Détail d'une sortie
/{groupId}/sorties/[id]/edit    → Modifier une sortie
/{groupId}/admin                → Administration du groupe (admin seulement)
/{groupId}/membres              → Annuaire des membres du groupe
/{groupId}/membres/[id]         → Profil public d'un membre
/{groupId}/onboarding           → Onboarding à l'entrée dans CE groupe
```

**Notes :**
- `/orphelin` supprimé : un utilisateur sans groupe atterrit sur `/groups` (état vide + CTA création).
- `/profile` est global (pas sous `/{groupId}`) : le profil est partagé entre tous les groupes.
- Le profil group-specific (couleur, rôle, statut résident) est géré dans `/{groupId}/admin` et dans l'onboarding.

---

## Rôles

| Rôle | Périmètre | Droits |
|------|-----------|--------|
| `SUPER_ADMIN` | Global (tous groupes) | Accès à tous les groupes, modération globale |
| `ADMIN` | Local (son groupe) | Inviter/retirer des membres, modérer les commentaires, modifier/annuler toutes les sorties |
| `MEMBER` | Local (son groupe) | Gérer ses présences, créer des sorties, voir tout le groupe |

Le rôle est vérifié **en base** côté serveur pour les pages/API sensibles. Le token JWT ne doit pas être utilisé seul pour autoriser des actions admin.

---

## Design System

**Ambiance :** Frais, moderne, friendly. Rounded & card-based. Feel mobile natif.  
**Police :** Inter  
**Background :** `#F8FAFF` (légèrement bleuté)

### Couleurs principales

| Token | Valeur | Usage |
|-------|--------|-------|
| `primary` | `#3B7BF8` | Actions, liens, sélection active |
| `primary-light` | `#EFF6FF` | Fonds jours "mine", badges |
| `available` | `#10B981` | Disponibilité OPEN, présence active |
| `busy` | `#F59E0B` | Disponibilité BUSY |
| `destructive` | `#EF4444` | Erreurs, suppression, annulation |
| `surface` | `#FFFFFF` | Cards, sheets |
| `surface-raised` | `#F1F6FF` | Fonds secondaires dans les cards |
| `foreground` | `#1E293B` | Texte principal |
| `muted-foreground` | `#64748B` | Texte secondaire |
| `border` | `#E2E8F0` | Bordures |

### 12 couleurs membres

Assignées automatiquement à l'inscription (1–12), persistées en base.

```
1: #3B7BF8   2: #10B981   3: #8B5CF6   4: #F43F5E   5: #F59E0B   6: #06B6D4
7: #F97316   8: #14B8A6   9: #EC4899  10: #6366F1  11: #84CC16  12: #0EA5E9
```

### Types de sorties (accent dynamique)

| Type | Emoji | Couleur accent | Tint (fond) |
|------|-------|----------------|-------------|
| `BAR` | 🍻 | `#F59E0B` (ambre) | `#FEF3C720` |
| `RESTO` | 🍕 | `#EF4444` (rouge) | `#FEE2E220` |
| `SOIREE` | 🏡 | `#8B5CF6` (violet) | `#EDE9FE20` |
| `SORTIE` | 🏕️ | `#10B981` (vert) | `#D1FAE520` |

### Border radius

`sm=8px` · `md=12px` · `lg=16px` · `xl=20px` · `2xl=24px` · `full=9999px`

---

## Navigation

**Bottom Tab Bar** (fixée en bas, dans le contexte d'un groupe) :
1. **Accueil** (icône maison) → `/{groupId}`
2. **Présences** (icône calendrier) → `/{groupId}/presences`
3. **Sorties** (icône étoile/event) → `/{groupId}/sorties`
4. **Profil** (icône user) → `/profile` (profil global)

Le header de la page d'accueil affiche le nom du groupe actif. Tap sur ce nom → `/groups` (switcher).

**FAB "+"** flottant visible sur l'accueil, les présences et les sorties → ouvre le formulaire contextuel.

---

## PWA

- Manifest déclaré via `app/manifest.ts`
- Service Worker (`public/sw.js`) pour les notifications push
- Icônes iOS/Android (`public/icons/`)
- Splash screens iOS (`public/splash/`)
- `InstallOnboarding` : prompt d'installation affiché lors du premier onboarding (requis sur iOS pour activer les notifs push)
