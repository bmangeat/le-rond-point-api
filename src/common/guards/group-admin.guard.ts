import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * À utiliser APRÈS GroupAccessGuard (qui attache request.membership).
 * Vérifie que le membre est ADMIN dans ce groupe.
 *
 * Usage : @UseGuards(JwtAuthGuard, GroupAccessGuard, GroupAdminGuard)
 */
@Injectable()
export class GroupAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const membership = request.membership;

    if (!membership) {
      throw new ForbiddenException('GroupAccessGuard doit précéder GroupAdminGuard');
    }

    if (membership.role !== 'ADMIN') {
      throw new ForbiddenException('Réservé aux admins du groupe');
    }

    return true;
  }
}
