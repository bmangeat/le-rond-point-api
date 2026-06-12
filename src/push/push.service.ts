import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // Envoyer une notification à un utilisateur (tous ses appareils)
  // ------------------------------------------------------------------
  async sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    const notification = JSON.stringify({
      ...payload,
      icon: payload.icon ?? '/icons/icon-192.png',
      badge: payload.badge ?? '/icons/badge-96.png',
    });

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            notification,
          );
        } catch (err: any) {
          // Subscription expirée ou invalide → on la supprime
          if (err.statusCode === 410 || err.statusCode === 404) {
            await this.prisma.pushSubscription
              .delete({ where: { id: sub.id } })
              .catch(() => {});
          } else {
            this.logger.warn(`Push failed for user ${userId}: ${err.message}`);
          }
        }
      }),
    );
  }

  // ------------------------------------------------------------------
  // Événement : nouvelle présence créée
  // ------------------------------------------------------------------
  async onNewPresence(presence: {
    id: string;
    userId: string;
    groupId: string;
    startDate: Date;
    endDate: Date;
    user?: { name: string };
  }): Promise<void> {
    const members = await this.prisma.groupMembership.findMany({
      where: { groupId: presence.groupId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            notifPush: true,
            notifPushPresence: true,
            notifPushOverlap: true,
            notifPushAsResident: true,
          },
        },
      },
    });

    const authorName = presence.user?.name ?? 'Quelqu\'un';
    const dateRange = `Du ${fmtDate(presence.startDate)} au ${fmtDate(presence.endDate)}`;

    for (const m of members) {
      if (m.userId === presence.userId) continue;

      const u = m.user;
      if (!u.notifPush) continue;

      // Nouvelle présence
      if (u.notifPushPresence) {
        await this.sendPushToUser(u.id, {
          title: `📅 ${authorName} a ajouté une présence`,
          body: dateRange,
          url: `/${presence.groupId}`,
          tag: `presence-${presence.id}`,
        });
      }

      // Arrivée d'un expatrié → résidents uniquement
      if (u.notifPushAsResident && m.isResident) {
        // TODO: vérifier que l'auteur n'est pas résident dans ce groupe
        await this.sendPushToUser(u.id, {
          title: `🏘️ ${authorName} revient au quartier !`,
          body: `${dateRange}. Mets-le dans ta liste !`,
          url: `/${presence.groupId}`,
          tag: `arrival-${presence.id}`,
        });
      }

      // Chevauchement
      if (u.notifPushOverlap) {
        const overlap = await this.prisma.presence.findFirst({
          where: {
            userId: u.id,
            groupId: presence.groupId,
            startDate: { lte: presence.endDate },
            endDate: { gte: presence.startDate },
          },
        });

        if (overlap) {
          await this.sendPushToUser(u.id, {
            title: `👋 ${authorName} revient au quartier !`,
            body: `${dateRange}. Vous serez là en même temps !`,
            url: `/${presence.groupId}`,
            tag: `overlap-${presence.id}`,
          });
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Événement : nouvelle sortie créée
  // ------------------------------------------------------------------
  async onNewEvent(
    event: { id: string; groupId: string; name: string; type: string; whenAt: Date; placeName: string },
    hostId: string,
  ): Promise<void> {
    const members = await this.prisma.groupMembership.findMany({
      where: { groupId: event.groupId, isActive: true },
      include: {
        user: { select: { id: true, notifPush: true, notifPushEvents: true } },
      },
    });

    const emoji = { BAR: '🍻', RESTO: '🍕', SOIREE: '🏡', SORTIE: '🏕️' }[event.type] ?? '🎉';

    for (const m of members) {
      if (m.userId === hostId) continue;
      const u = m.user;
      if (!u.notifPush || !u.notifPushEvents) continue;

      await this.sendPushToUser(u.id, {
        title: `${emoji} Nouvelle sortie : ${event.name}`,
        body: `${fmtDate(event.whenAt)} à ${event.placeName}`,
        url: `/${event.groupId}/sorties/${event.id}`,
        tag: `event-new-${event.id}`,
      });
    }
  }
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
