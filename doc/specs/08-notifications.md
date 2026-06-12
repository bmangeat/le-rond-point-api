# Notifications push & Cron

## Architecture

Les notifications push utilisent le protocole **Web Push** avec des clés VAPID.

**Périmètre :** uniquement les notifications push. Il n'y a pas d'emails transactionnels (Resend n'est pas branché). Si les emails sont ajoutés plus tard, ils seront traités comme une feature distincte avec son propre modèle de préférences.

- Le Service Worker (`public/sw.js`) reçoit les messages push et affiche les notifications.
- Les subscriptions sont stockées en base dans `PushSubscription` (endpoint, p256dh, auth).
- Un utilisateur peut avoir plusieurs subscriptions (plusieurs appareils).
- L'envoi se fait via `lib/push.ts` → `sendPushToUser(userId, payload)`.

---

## Activation côté utilisateur

1. L'utilisateur clique sur "Activer les notifications" dans le profil ou l'onboarding.
2. Le navigateur demande la permission (`Notification.requestPermission()`).
3. Si accordée : `pushManager.subscribe()` avec la VAPID public key → `POST /api/push/subscribe` avec les données de subscription.
4. Mise à jour de `user.notifPush = true` en base.

**Cas d'erreur :**
- Permission refusée → message "Bloquées, réactiver dans les réglages."
- iOS sans PWA installée → message d'explication pour installer d'abord.

**Désactivation :**
- L'utilisateur désactive depuis le profil.
- `unsubscribeFromPush()` → supprime les subscriptions en base + `user.notifPush = false`.

---

## Types de notifications

### 1. Chevauchement de présences (temps réel)

**Déclencheur :** `POST /api/presences` (création d'une nouvelle présence).

**Logique :**
- La présence porte son propre `groupId` (non-nullable, pas d'ambiguïté).
- Chercher toutes les présences du même groupe qui chevauchent la nouvelle (`Presence.groupId = newPresence.groupId`).
- Pour chaque membre dont la présence chevauche :
  - Si `notifPush = true` ET `notifPushOverlap = true`.
  - ET ce n'est pas l'auteur de la nouvelle présence.
- Envoi : `sendPushToUser`.

**Contenu :**
- Titre : "👋 [Prénom] revient au quartier !"
- Corps : "Du [date début] au [date fin]. Vous serez là en même temps !"
- URL : `/{groupId}`.
- Tag : `overlap-{presenceId}`.

---

### 2. Rappel de co-présence (cron quotidien)

**Déclencheur :** cron 7h UTC, `runPresenceReminders()`.

**Logique :**
- Trouver toutes les présences actives aujourd'hui (startDate ≤ aujourd'hui ≤ endDate), groupées par `Presence.groupId`.
- Pour chaque groupe avec ≥ 2 personnes présentes :
  - Pour chaque personne présente :
    - Les autres personnes présentes dans ce groupe sont "co-présentes".
    - Si la personne est arrivée aujourd'hui (startDate = aujourd'hui) → signale les autres.
    - Si d'autres sont arrivés aujourd'hui → signale ces personnes à la personne présente depuis avant.
    - Envoi si `notifPush = true` ET `notifPushOverlap = true`.

**Contenu :**
- Titre : "Le quartier s'anime ! 🍻"
- Corps (1 personne) : "[Prénom] est au quartier aujourd'hui, comme toi. Un petit « t'es oùùù ? » s'impose 👀"
- Corps (plusieurs) : "[Prénom1], [Prénom2] et [Prénom3] sont au quartier en même temps que toi aujourd'hui. Faites-vous signe avant de vous louper bêtement ! 📲"
- URL : `/{groupId}`.
- Tag : `reminder-{date}`.

---

### 3. Anniversaires (cron quotidien)

**Déclencheur :** cron 7h UTC, `runBirthdayNotifications()`.

**Logique :**
- Trouver tous les users dont `birthday` est aujourd'hui (même mois, même jour, UTC).
- Pour chaque anniversaire : trouver tous les groupes auxquels cet utilisateur appartient activement (`GroupMembership.isActive = true`).
- Pour chaque groupe : notifier tous les membres actifs du groupe avec `notifPush = true` ET `notifPushBirthday = true`.
- Un membre appartenant à plusieurs groupes avec le fêtard recevra une notification par groupe (dédoublonnage par tag `birthday-{userId}-{groupId}`).

**Contenu :**
- Pour l'anniversaire lui-même : "Joyeux anniversaire ! 🎂🎉" / "Toute la bande te souhaite une belle journée !"
- Pour les autres : "Anniversaire 🎂" / "Aujourd'hui, c'est l'anniversaire de [Prénom] !"
- URL : `/{groupId}/membres/{celebrantId}`.
- Tag : `birthday-{userId}`.

---

### 4. Nouvelle présence (temps réel)

**Déclencheur :** `POST /api/presences`.

**Logique :**
- Trouver tous les membres actifs du groupe (`GroupMembership.groupId = presence.groupId`, `isActive = true`).
- Notifier ceux avec `notifPush = true` ET `notifPushPresence = true`.
- Sauf l'auteur de la présence.

**Contenu :**
- Titre : "📅 [Prénom] a ajouté une présence"
- Corps : "Du [date début] au [date fin]."
- URL : `/{groupId}`.

---

### 5. Avertissement expiration photos (cron quotidien)

**Déclencheur :** cron 7h UTC, `runPhotoExpiryWarnings()`.

**Logique :**
- Trouver les sorties dont `whenAt` est dans la fenêtre [now - 7j, now - 6j) ET qui ont des photos.
  - Ces photos seront supprimées demain par `runEventPhotoCleanup()`.
- Pour chaque participant "YES" ayant `notifPush = true` ET `notifPushPhotos = true`.

**Contenu :**
- Titre : "📸 Sauve les souvenirs !"
- Corps : "Les [N] photo(s) de « [nom sortie] » s'autodétruisent demain. Télécharge-les avant qu'elles partent en fumée 💨"
- URL : `/{groupId}/sorties/{eventId}`.
- Tag : `photo-expiry-{eventId}`.

---

### 6. Rappel sortie du jour (cron quotidien)

**Déclencheur :** cron 7h UTC, `runEventDayReminders()`.

**Logique :**
- Trouver les sorties dont `whenAt` est aujourd'hui.
- Pour chaque participant "YES" avec `notifPush = true` ET `notifPushEvents = true`.

**Contenu :**
- Titre : "🎉 C'est aujourd'hui !"
- Corps : "« [nom sortie] » à [heure] — [lieu]. À tout à l'heure !"
- URL : `/{groupId}/sorties/{eventId}`.
- Tag : `event-day-{eventId}`.

---

### 7. Nouvelle sortie (temps réel)

**Déclencheur :** `POST /api/events`.

**Logique :**
- Trouver tous les membres actifs du groupe (`GroupMembership.groupId = event.groupId`, `isActive = true`).
- Notifier ceux avec `notifPush = true` ET `notifPushEvents = true`.
- Sauf l'hôte (créateur).

**Contenu :**
- Titre : "[emoji type] Nouvelle sortie : [nom]"
- Corps : "[Jour et date] à [lieu]"
- URL : `/{groupId}/sorties/{eventId}`.

---

### 8. Arrivée d'un expatrié (réservé aux résidents)

**Déclencheur :** `POST /api/presences` (même que chevauchement).

**Logique :**
- Trouver les membres actifs du groupe dont `GroupMembership.isResident = true` (résident dans CE groupe).
- Parmi eux, notifier ceux avec `notifPush = true` ET `notifPushAsResident = true`.
- Notifier uniquement quand l'auteur de la présence n'est pas résident dans ce groupe (`GroupMembership.isResident = false`).

**Contenu :**
- Titre : "🏘️ [Prénom] revient au quartier !"
- Corps : "Du [date début] au [date fin]. Mets-le dans ta liste !"
- URL : `/{groupId}`.

---

## Cron quotidien — `/api/cron/daily`

**Planification :** 7h00 UTC chaque jour (Vercel Cron, plan Hobby = 1 cron/jour max).

**Sécurisation :** header `Authorization: Bearer {CRON_SECRET}`.

**Tâches exécutées dans l'ordre :**
1. `runBirthdayNotifications()` — anniversaires du jour.
2. `runPresenceReminders()` — rappels de co-présence.
3. `runPhotoExpiryWarnings()` — alerte photos J-1.
4. `runEventPhotoCleanup()` — suppression effective des photos > 7j après la sortie.
5. `runEventDayReminders()` — rappels de sortie du jour.

**Réponse JSON :**
```json
{
  "birthdays": { "celebrants": 1, "sent": 5 },
  "presenceReminders": { "present": 3, "sent": 4 },
  "photoWarnings": { "events": 1, "sent": 3 },
  "photoCleanup": { "deleted": 12 },
  "eventReminders": { "events": 2, "sent": 6 }
}
```

---

## Structure d'une notification push

```typescript
interface PushPayload {
  title: string;
  body: string;
  url: string;    // URL de destination (relative au domaine)
  tag?: string;   // Pour dédoublonner les notifs (une par tag sur l'appareil)
  icon?: string;  // Icône (défaut : /icons/icon-192.png)
  badge?: string; // Badge (défaut : /icons/badge-96.png)
}
```

Le Service Worker intercepte le `push` event et affiche la notification avec `self.registration.showNotification()`. Un clic sur la notification navigue vers `url`.
