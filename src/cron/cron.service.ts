import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private prisma: PrismaService,
    private pushService: PushService,
  ) {}

  // ------------------------------------------------------------------
  // Cron quotidien — 7h00 UTC
  // ------------------------------------------------------------------
  @Cron('0 7 * * *')
  async runDailyTasks() {
    this.logger.log('Running daily cron tasks...');

    const results = await Promise.allSettled([
      this.runBirthdayNotifications(),
      this.runPresenceReminders(),
      this.runPhotoExpiryWarnings(),
      this.runEventPhotoCleanup(),
      this.runEventDayReminders(),
    ]);

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        this.logger.error(`Task ${i} failed: ${r.reason}`);
      }
    });
  }

  // ------------------------------------------------------------------
  // 1. Anniversaires du jour
  // ------------------------------------------------------------------
  async runBirthdayNotifications() {
    const today = new Date();
    const month = today.getUTCMonth() + 1;
    const day = today.getUTCDate();

    // Trouver les users dont c'est l'anniversaire aujourd'hui
    const celebrants = await this.prisma.user.findMany({
      where: {
        birthday: { not: null },
        isActive: true,
      },
      include: {
        memberships: {
          where: { isActive: true },
          select: { groupId: true },
        },
      },
    });

    const birthdayCelebrants = celebrants.filter((u) => {
      if (!u.birthday) return false;
      return u.birthday.getUTCMonth() + 1 === month && u.birthday.getUTCDate() === day;
    });

    let sent = 0;

    for (const celebrant of birthdayCelebrants) {
      for (const { groupId } of celebrant.memberships) {
        // Notifier tous les membres actifs du groupe
        const members = await this.prisma.groupMembership.findMany({
          where: { groupId, isActive: true },
          include: {
            user: { select: { id: true, notifPush: true, notifPushBirthday: true } },
          },
        });

        for (const m of members) {
          if (!m.user.notifPush || !m.user.notifPushBirthday) continue;

          const isCelebrant = m.userId === celebrant.id;
          await this.pushService.sendPushToUser(m.userId, {
            title: isCelebrant ? 'Joyeux anniversaire ! 🎂🎉' : 'Anniversaire 🎂',
            body: isCelebrant
              ? 'Toute la bande te souhaite une belle journée !'
              : `Aujourd'hui, c'est l'anniversaire de ${celebrant.name} !`,
            url: `/${groupId}/membres/${celebrant.id}`,
            tag: `birthday-${celebrant.id}-${groupId}`,
          });
          sent++;
        }
      }
    }

    return { celebrants: birthdayCelebrants.length, sent };
  }

  // ------------------------------------------------------------------
  // 2. Rappels co-présence
  // ------------------------------------------------------------------
  async runPresenceReminders() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const presences = await this.prisma.presence.findMany({
      where: {
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: {
        user: { select: { id: true, name: true, notifPush: true, notifPushOverlap: true } },
      },
    });

    // Regrouper par groupId
    const byGroup = presences.reduce<Record<string, typeof presences>>((acc, p) => {
      if (!acc[p.groupId]) acc[p.groupId] = [];
      acc[p.groupId].push(p);
      return acc;
    }, {});

    let sent = 0;

    for (const [groupId, groupPresences] of Object.entries(byGroup)) {
      if (groupPresences.length < 2) continue;

      for (const presence of groupPresences) {
        if (!presence.user.notifPush || !presence.user.notifPushOverlap) continue;

        const others = groupPresences.filter(
          (p) => p.userId !== presence.userId && p.startDate.getTime() === today.getTime(),
        );

        if (others.length === 0) continue;

        const names = others.map((p) => p.user.name);
        const body =
          names.length === 1
            ? `${names[0]} est au quartier aujourd'hui, comme toi. Un petit « t'es oùùù ? » s'impose 👀`
            : `${names.join(', ')} sont au quartier en même temps que toi. Faites-vous signe ! 📲`;

        await this.pushService.sendPushToUser(presence.userId, {
          title: 'Le quartier s\'anime ! 🍻',
          body,
          url: `/${groupId}`,
          tag: `reminder-${today.toISOString().slice(0, 10)}`,
        });
        sent++;
      }
    }

    return { present: presences.length, sent };
  }

  // ------------------------------------------------------------------
  // 3. Avertissement expiration photos (J-1)
  // ------------------------------------------------------------------
  async runPhotoExpiryWarnings() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

    const events = await this.prisma.event.findMany({
      where: {
        whenAt: { gte: sevenDaysAgo, lt: sixDaysAgo },
        photos: { some: {} },
      },
      include: {
        photos: { select: { id: true } },
        rsvps: {
          where: { status: 'YES' },
          include: {
            user: { select: { id: true, notifPush: true, notifPushPhotos: true } },
          },
        },
      },
    });

    let sent = 0;

    for (const event of events) {
      for (const rsvp of event.rsvps) {
        if (!rsvp.user.notifPush || !rsvp.user.notifPushPhotos) continue;

        await this.pushService.sendPushToUser(rsvp.userId, {
          title: '📸 Sauve les souvenirs !',
          body: `Les ${event.photos.length} photo(s) de « ${event.name} » s'autodétruisent demain 💨`,
          url: `/${event.groupId}/sorties/${event.id}`,
          tag: `photo-expiry-${event.id}`,
        });
        sent++;
      }
    }

    return { events: events.length, sent };
  }

  // ------------------------------------------------------------------
  // 4. Suppression des photos > 7j après la sortie
  // ------------------------------------------------------------------
  async runEventPhotoCleanup() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.eventPhoto.deleteMany({
      where: { event: { whenAt: { lt: cutoff } } },
    });

    // TODO: supprimer les blobs Vercel correspondants

    return { deleted: result.count };
  }

  // ------------------------------------------------------------------
  // 5. Rappels sortie du jour
  // ------------------------------------------------------------------
  async runEventDayReminders() {
    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const events = await this.prisma.event.findMany({
      where: {
        status: 'ACTIVE',
        whenAt: { gte: startOfDay, lt: endOfDay },
      },
      include: {
        rsvps: {
          where: { status: 'YES' },
          include: {
            user: { select: { id: true, notifPush: true, notifPushEvents: true } },
          },
        },
      },
    });

    let sent = 0;

    for (const event of events) {
      const time = event.whenAt.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      });

      for (const rsvp of event.rsvps) {
        if (!rsvp.user.notifPush || !rsvp.user.notifPushEvents) continue;

        await this.pushService.sendPushToUser(rsvp.userId, {
          title: '🎉 C\'est aujourd\'hui !',
          body: `« ${event.name} » à ${time} — ${event.placeName}. À tout à l'heure !`,
          url: `/${event.groupId}/sorties/${event.id}`,
          tag: `event-day-${event.id}`,
        });
        sent++;
      }
    }

    return { events: events.length, sent };
  }
}
