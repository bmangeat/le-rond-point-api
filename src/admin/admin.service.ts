import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // Invitations
  // ------------------------------------------------------------------
  async inviteByEmail(actorId: string, groupId: string, email: string) {
    const isMember = await this.prisma.groupMembership.findFirst({
      where: { groupId, isActive: true, user: { email } },
    });
    if (isMember) throw new ConflictException('Cet email est déjà membre du groupe');

    // Annuler l'invitation précédente pour cet email dans ce groupe
    await this.prisma.invitation.updateMany({
      where: { groupId, email, usedAt: null },
      data: { expiresAt: new Date() },
    });

    const invitation = await this.prisma.invitation.create({
      data: {
        email,
        groupId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // TODO: envoyer l'email via Resend quand branché
    return invitation;
  }

  async generateInviteLink(groupId: string) {
    const invitation = await this.prisma.invitation.create({
      data: {
        email: null, // lien générique
        groupId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';
    return {
      invitation,
      url: `${baseUrl}/invite/${invitation.token}`,
    };
  }

  async listPendingInvitations(groupId: string) {
    return this.prisma.invitation.findMany({
      where: {
        groupId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteInvitation(groupId: string, invitationId: string) {
    const inv = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!inv || inv.groupId !== groupId) throw new NotFoundException('Invitation introuvable');
    await this.prisma.invitation.delete({ where: { id: invitationId } });
  }

  // ------------------------------------------------------------------
  // Commentaires signalés
  // ------------------------------------------------------------------
  async getReportedComments(groupId: string) {
    return this.prisma.eventComment.findMany({
      where: {
        event: { groupId },
        reports: { some: {} },
      },
      include: {
        author: { select: { id: true, name: true } },
        event: { select: { id: true, name: true } },
        reports: {
          include: { reporter: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async deleteReportedComment(commentId: string, actorId: string, actorEmail: string, groupId: string) {
    await this.prisma.eventComment.delete({ where: { id: commentId } });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorEmail,
        action: 'COMMENT_DELETED',
        targetType: 'EventComment',
        targetId: commentId,
        groupId,
      },
    });
  }

  async dismissReports(commentId: string) {
    await this.prisma.commentReport.deleteMany({ where: { commentId } });
  }
}
