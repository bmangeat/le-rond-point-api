import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Vérifie que l'utilisateur connecté est membre actif du groupe
 * dont l'id est dans params.groupId.
 *
 * Attache la membership sur request.membership pour les controllers en aval.
 *
 * Usage : @UseGuards(JwtAuthGuard, GroupAccessGuard)
 */
@Injectable()
export class GroupAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const groupId = request.params.groupId;

    if (!groupId) {
      throw new NotFoundException('groupId manquant dans la route');
    }

    // SUPER_ADMIN : accès à tous les groupes, on fabrique une membership virtuelle
    if (user.globalRole === 'SUPER_ADMIN') {
      const group = await this.prisma.group.findUnique({ where: { id: groupId } });
      if (!group) throw new NotFoundException('Groupe introuvable');
      request.membership = { userId: user.id, groupId, role: 'ADMIN', isResident: false };
      return true;
    }

    const membership = await this.prisma.groupMembership.findUnique({
      where: {
        userId_groupId: { userId: user.id, groupId },
      },
    });

    if (!membership || !membership.isActive) {
      throw new ForbiddenException("Tu n'as pas accès à ce groupe");
    }

    request.membership = membership;
    return true;
  }
}
