import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        city: true,
        birthday: true,
        phone: true,
        instagram: true,
        snapchat: true,
        tiktok: true,
        linkedin: true,
        globalRole: true,
        notifPush: true,
        notifPushOverlap: true,
        notifPushBirthday: true,
        notifPushPresence: true,
        notifPushPhotos: true,
        notifPushEvents: true,
        notifPushAsResident: true,
        memberships: {
          where: { isActive: true },
          select: {
            groupId: true,
            role: true,
            memberColor: true,
            isResident: true,
            onboardedAt: true,
            group: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { birthday, ...rest } = dto;
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...rest,
        ...(birthday ? { birthday: new Date(birthday) } : {}),
      },
      select: {
        id: true,
        name: true,
        city: true,
        birthday: true,
        phone: true,
        instagram: true,
        snapchat: true,
        tiktok: true,
        linkedin: true,
        image: true,
        notifPush: true,
        notifPushOverlap: true,
        notifPushBirthday: true,
        notifPushPresence: true,
        notifPushPhotos: true,
        notifPushEvents: true,
        notifPushAsResident: true,
      },
    });
  }
}
