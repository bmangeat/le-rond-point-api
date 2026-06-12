import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupRole } from '@prisma/client';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // Liste des groupes de l'utilisateur
  // ------------------------------------------------------------------
  async findMyGroups(userId: string) {
    const memberships = await this.prisma.groupMembership.findMany({
      where: { userId, isActive: true },
      include: {
        group: {
          include: {
            _count: { select: { memberships: { where: { isActive: true } } } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      memberCount: m.group._count.memberships,
      myRole: m.role,
      myColor: m.memberColor,
      isResident: m.isResident,
      onboarded: !!m.onboardedAt,
      joinedAt: m.joinedAt,
    }));
  }

  // ------------------------------------------------------------------
  // Détail d'un groupe
  // ------------------------------------------------------------------
  async findOne(groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                city: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!group) throw new NotFoundException('Groupe introuvable');
    return group;
  }

  // ------------------------------------------------------------------
  // Créer un groupe
  // ------------------------------------------------------------------
  async create(userId: string, name: string) {
    const group = await this.prisma.group.create({
      data: {
        name,
        creatorId: userId,
        memberships: {
          create: {
            userId,
            role: GroupRole.ADMIN,
            memberColor: 1,
            onboardedAt: new Date(), // créateur = pas d'onboarding
          },
        },
      },
    });

    return group;
  }

  // ------------------------------------------------------------------
  // Renommer un groupe (admin uniquement — vérifié par GroupAdminGuard)
  // ------------------------------------------------------------------
  async rename(groupId: string, name: string) {
    return this.prisma.group.update({
      where: { id: groupId },
      data: { name },
    });
  }

  // ------------------------------------------------------------------
  // Mettre à jour sa propre membership (isResident)
  // ------------------------------------------------------------------
  async updateMyMembership(userId: string, groupId: string, data: { isResident?: boolean }) {
    return this.prisma.groupMembership.update({
      where: { userId_groupId: { userId, groupId } },
      data,
    });
  }

  // ------------------------------------------------------------------
  // Changer le rôle d'un membre (admin uniquement)
  // ------------------------------------------------------------------
  async updateMemberRole(
    actorId: string,
    groupId: string,
    targetUserId: string,
    role: GroupRole,
  ) {
    if (actorId === targetUserId) {
      throw new ForbiddenException('Tu ne peux pas modifier ton propre rôle');
    }

    const membership = await this.prisma.groupMembership.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });

    if (!membership || !membership.isActive) {
      throw new NotFoundException('Membre introuvable dans ce groupe');
    }

    return this.prisma.groupMembership.update({
      where: { userId_groupId: { userId: targetUserId, groupId } },
      data: { role },
    });
  }

  // ------------------------------------------------------------------
  // Retirer un membre du groupe (soft delete per-group)
  // ------------------------------------------------------------------
  async removeMember(actorId: string, groupId: string, targetUserId: string) {
    if (actorId === targetUserId) {
      throw new ForbiddenException('Utilise DELETE /groups/:groupId/members/me pour quitter');
    }

    const membership = await this.prisma.groupMembership.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });

    if (!membership || !membership.isActive) {
      throw new NotFoundException('Membre introuvable dans ce groupe');
    }

    if (membership.role === GroupRole.ADMIN) {
      throw new ForbiddenException("Tu ne peux pas retirer un admin du groupe");
    }

    return this.prisma.groupMembership.update({
      where: { userId_groupId: { userId: targetUserId, groupId } },
      data: { isActive: false },
    });
  }

  // ------------------------------------------------------------------
  // Quitter un groupe (soft delete per-group, auto)
  // ------------------------------------------------------------------
  async leaveGroup(userId: string, groupId: string) {
    const membership = await this.prisma.groupMembership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });

    if (!membership || !membership.isActive) {
      throw new NotFoundException('Tu n\'appartiens pas à ce groupe');
    }

    // Vérifier que ce n'est pas le dernier admin
    if (membership.role === GroupRole.ADMIN) {
      const adminCount = await this.prisma.groupMembership.count({
        where: { groupId, role: GroupRole.ADMIN, isActive: true },
      });
      if (adminCount <= 1) {
        throw new ConflictException('Nomme un autre admin avant de quitter le groupe');
      }
    }

    return this.prisma.groupMembership.update({
      where: { userId_groupId: { userId, groupId } },
      data: { isActive: false },
    });
  }

  // ------------------------------------------------------------------
  // Assigner une couleur unique au sein du groupe
  // ------------------------------------------------------------------
  async assignMemberColor(groupId: string): Promise<number> {
    const usedColors = await this.prisma.groupMembership.findMany({
      where: { groupId, isActive: true },
      select: { memberColor: true },
    });

    const used = new Set(usedColors.map((m) => m.memberColor));

    for (let i = 1; i <= 12; i++) {
      if (!used.has(i)) return i;
    }

    // Si les 12 sont prises : assigner la plus rare (count)
    const counts = Array.from({ length: 12 }, (_, i) => ({
      color: i + 1,
      count: usedColors.filter((m) => m.memberColor === i + 1).length,
    }));

    return counts.sort((a, b) => a.count - b.count)[0].color;
  }
}
