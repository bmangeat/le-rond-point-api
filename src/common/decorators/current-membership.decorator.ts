import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GroupMembership } from '@prisma/client';

/**
 * Extrait la GroupMembership attachée par GroupAccessGuard.
 * @example
 *   findAll(@CurrentMembership() membership: GroupMembership) { ... }
 */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): GroupMembership => {
    const request = ctx.switchToHttp().getRequest();
    return request.membership;
  },
);
