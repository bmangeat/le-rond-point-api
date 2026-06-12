import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { EventStatus, RsvpStatus } from '@prisma/client';
import {
  CreateEventDto,
  UpdateEventDto,
  CancelEventDto,
  CreateNeedDto,
  CreateExpenseDto,
  CreateCommentDto,
  ReportCommentDto,
} from './dto/events.dto';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private pushService: PushService,
  ) {}

  // ------------------------------------------------------------------
  // Liste des sorties du groupe
  // ------------------------------------------------------------------
  async findAll(groupId: string) {
    return this.prisma.event.findMany({
      where: { groupId, status: EventStatus.ACTIVE },
      include: {
        host: { select: { id: true, name: true, image: true } },
        _count: { select: { rsvps: true, photos: true, comments: true } },
      },
      orderBy: { whenAt: 'asc' },
    });
  }

  // ------------------------------------------------------------------
  // Détail d'une sortie
  // ------------------------------------------------------------------
  async findOne(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        host: { select: { id: true, name: true, image: true } },
        rsvps: {
          include: { user: { select: { id: true, name: true, image: true } } },
        },
        needs: {
          include: { claimedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        expenses: {
          include: {
            payer: { select: { id: true, name: true } },
            participants: { include: { user: { select: { id: true, name: true } } } },
          },
        },
        comments: {
          include: { author: { select: { id: true, name: true, image: true } } },
          orderBy: { createdAt: 'asc' },
        },
        photos: {
          include: { uploader: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!event) throw new NotFoundException('Sortie introuvable');
    return event;
  }

  // ------------------------------------------------------------------
  // Créer une sortie
  // ------------------------------------------------------------------
  async create(userId: string, groupId: string, dto: CreateEventDto) {
    // Récupérer tous les membres actifs pour pré-créer les RSVP
    const members = await this.prisma.groupMembership.findMany({
      where: { groupId, isActive: true },
      select: { userId: true },
    });

    const event = await this.prisma.event.create({
      data: {
        ...dto,
        whenAt: new Date(dto.whenAt),
        groupId,
        hostId: userId,
        rsvps: {
          createMany: {
            data: members.map((m) => ({
              userId: m.userId,
              status: m.userId === userId ? RsvpStatus.YES : RsvpStatus.PENDING,
            })),
          },
        },
      },
    });

    // Notifier les membres
    this.pushService.onNewEvent(event, userId).catch(console.error);

    return event;
  }

  // ------------------------------------------------------------------
  // Modifier une sortie (hôte ou admin)
  // ------------------------------------------------------------------
  async update(userId: string, eventId: string, dto: UpdateEventDto, isAdmin: boolean) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException();
    if (event.hostId !== userId && !isAdmin) throw new ForbiddenException();

    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...dto,
        ...(dto.whenAt ? { whenAt: new Date(dto.whenAt) } : {}),
      },
    });
  }

  // ------------------------------------------------------------------
  // Annuler une sortie (hôte ou admin)
  // ------------------------------------------------------------------
  async cancel(userId: string, eventId: string, dto: CancelEventDto, isAdmin: boolean) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException();
    if (event.hostId !== userId && !isAdmin) throw new ForbiddenException();

    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        status: EventStatus.CANCELLED,
        cancelReason: dto.reason,
        cancelledAt: new Date(),
      },
    });
  }

  // ------------------------------------------------------------------
  // RSVP
  // ------------------------------------------------------------------
  async updateRsvp(userId: string, eventId: string, status: RsvpStatus) {
    return this.prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { status },
      create: { eventId, userId, status },
    });
  }

  // ------------------------------------------------------------------
  // Balances Tricount (calcul côté serveur)
  // ------------------------------------------------------------------
  async getBalances(eventId: string) {
    const expenses = await this.prisma.eventExpense.findMany({
      where: { eventId },
      include: {
        payer: { select: { id: true, name: true } },
        participants: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    // Calcul des soldes (qui doit quoi à qui)
    const balances: Record<string, number> = {};

    for (const expense of expenses) {
      const share = expense.amount / expense.participants.length;

      for (const p of expense.participants) {
        balances[p.userId] = (balances[p.userId] ?? 0) - share;
      }
      balances[expense.payerId] = (balances[expense.payerId] ?? 0) + expense.amount;
    }

    // Simplification des dettes
    const debts: { from: string; to: string; amount: number }[] = [];
    const entries = Object.entries(balances).filter(([, v]) => Math.abs(v) > 0.01);
    const creditors = entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const debtors = entries.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);

    let i = 0, j = 0;
    while (i < creditors.length && j < debtors.length) {
      const [credId, credAmt] = creditors[i];
      const [debId, debAmt] = debtors[j];
      const amount = Math.min(credAmt, -debAmt);
      debts.push({ from: debId, to: credId, amount: Math.round(amount * 100) / 100 });
      creditors[i][1] -= amount;
      debtors[j][1] += amount;
      if (Math.abs(creditors[i][1]) < 0.01) i++;
      if (Math.abs(debtors[j][1]) < 0.01) j++;
    }

    return { expenses, debts };
  }

  // ------------------------------------------------------------------
  // Besoins
  // ------------------------------------------------------------------
  async createNeed(userId: string, eventId: string, dto: CreateNeedDto) {
    return this.prisma.eventNeed.create({ data: { eventId, label: dto.label } });
  }

  async deleteNeed(userId: string, eventId: string, needId: string) {
    await this.prisma.eventNeed.delete({ where: { id: needId } });
  }

  async claimNeed(userId: string, needId: string) {
    return this.prisma.eventNeed.update({
      where: { id: needId },
      data: { claimedById: userId },
    });
  }

  async unclaimNeed(userId: string, needId: string) {
    const need = await this.prisma.eventNeed.findUnique({ where: { id: needId } });
    if (need?.claimedById !== userId) throw new ForbiddenException();
    return this.prisma.eventNeed.update({
      where: { id: needId },
      data: { claimedById: null },
    });
  }

  // ------------------------------------------------------------------
  // Dépenses
  // ------------------------------------------------------------------
  async createExpense(userId: string, eventId: string, dto: CreateExpenseDto) {
    return this.prisma.eventExpense.create({
      data: {
        eventId,
        payerId: userId,
        label: dto.label,
        amount: dto.amount,
        participants: {
          createMany: {
            data: dto.participantIds.map((id) => ({ userId: id })),
          },
        },
      },
      include: { participants: true },
    });
  }

  async deleteExpense(userId: string, expenseId: string, isAdmin: boolean) {
    const expense = await this.prisma.eventExpense.findUnique({ where: { id: expenseId } });
    if (!expense) throw new NotFoundException();
    if (expense.payerId !== userId && !isAdmin) throw new ForbiddenException();
    await this.prisma.eventExpense.delete({ where: { id: expenseId } });
  }

  // ------------------------------------------------------------------
  // Commentaires
  // ------------------------------------------------------------------
  async createComment(userId: string, eventId: string, dto: CreateCommentDto) {
    return this.prisma.eventComment.create({
      data: { eventId, authorId: userId, text: dto.text },
      include: { author: { select: { id: true, name: true, image: true } } },
    });
  }

  async deleteComment(userId: string, commentId: string, isAdmin: boolean) {
    const comment = await this.prisma.eventComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException();
    if (comment.authorId !== userId && !isAdmin) throw new ForbiddenException();
    await this.prisma.eventComment.delete({ where: { id: commentId } });
  }

  async reportComment(userId: string, commentId: string, dto: ReportCommentDto) {
    return this.prisma.commentReport.upsert({
      where: { commentId_reporterId: { commentId, reporterId: userId } },
      update: { reason: dto.reason },
      create: { commentId, reporterId: userId, reason: dto.reason },
    });
  }
}
