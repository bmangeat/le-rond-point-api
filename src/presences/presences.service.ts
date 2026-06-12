import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { CreatePresenceDto, UpdatePresenceDto } from './dto/presences.dto';

// Convertit "YYYY-MM-DD" en minuit UTC
function toMidnightUTC(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

@Injectable()
export class PresencesService {
  constructor(
    private prisma: PrismaService,
    private pushService: PushService,
  ) {}

  // ------------------------------------------------------------------
  // Liste des présences du groupe
  // ------------------------------------------------------------------
  async findAll(groupId: string, userId?: string) {
    return this.prisma.presence.findMany({
      where: {
        groupId,
        ...(userId ? { userId } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  // ------------------------------------------------------------------
  // Présence du jour (toggle accueil)
  // ------------------------------------------------------------------
  async getTodayPresence(userId: string, groupId: string) {
    const today = toMidnightUTC(new Date().toISOString().slice(0, 10));

    return this.prisma.presence.findFirst({
      where: {
        userId,
        groupId,
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });
  }

  // ------------------------------------------------------------------
  // Créer une présence
  // ------------------------------------------------------------------
  async create(userId: string, groupId: string, dto: CreatePresenceDto) {
    const startDate = toMidnightUTC(dto.startDate);
    const endDate = toMidnightUTC(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('La date de fin doit être après la date de début');
    }

    const presence = await this.prisma.presence.create({
      data: {
        userId,
        groupId,
        startDate,
        endDate,
        availability: dto.availability,
        note: dto.note,
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    // Déclencher les notifications push (chevauchements + nouvelle présence)
    this.pushService.onNewPresence(presence).catch(console.error);

    return presence;
  }

  // ------------------------------------------------------------------
  // Modifier une présence (propriétaire uniquement)
  // ------------------------------------------------------------------
  async update(userId: string, presenceId: string, dto: UpdatePresenceDto) {
    const existing = await this.prisma.presence.findUnique({ where: { id: presenceId } });

    if (!existing) throw new NotFoundException('Présence introuvable');
    if (existing.userId !== userId) throw new ForbiddenException();

    const startDate = dto.startDate ? toMidnightUTC(dto.startDate) : existing.startDate;
    const endDate = dto.endDate ? toMidnightUTC(dto.endDate) : existing.endDate;

    if (endDate < startDate) {
      throw new BadRequestException('La date de fin doit être après la date de début');
    }

    return this.prisma.presence.update({
      where: { id: presenceId },
      data: { startDate, endDate, availability: dto.availability, note: dto.note },
    });
  }

  // ------------------------------------------------------------------
  // Supprimer une présence (propriétaire uniquement)
  // ------------------------------------------------------------------
  async remove(userId: string, presenceId: string) {
    const existing = await this.prisma.presence.findUnique({ where: { id: presenceId } });

    if (!existing) throw new NotFoundException('Présence introuvable');
    if (existing.userId !== userId) throw new ForbiddenException();

    await this.prisma.presence.delete({ where: { id: presenceId } });
  }
}
