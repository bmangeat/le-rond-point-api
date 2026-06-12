import { Controller, Post, Delete, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

class SubscribeDto {
  @IsString() @IsNotEmpty() endpoint: string;
  @IsString() @IsNotEmpty() p256dh: string;
  @IsString() @IsNotEmpty() auth: string;
}

class UnsubscribeDto {
  @IsString() @IsNotEmpty() endpoint: string;
}

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private prisma: PrismaService) {}

  // POST /api/push/subscribe
  @Post('subscribe')
  async subscribe(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubscribeDto) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: { p256dh: dto.p256dh, auth: dto.auth },
      create: { userId: user.id, endpoint: dto.endpoint, p256dh: dto.p256dh, auth: dto.auth },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { notifPush: true },
    });

    return { ok: true };
  }

  // DELETE /api/push/subscribe
  @Delete('subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UnsubscribeDto) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId: user.id, endpoint: dto.endpoint },
    });

    // Désactiver notifPush si plus aucune subscription
    const remaining = await this.prisma.pushSubscription.count({ where: { userId: user.id } });
    if (remaining === 0) {
      await this.prisma.user.update({ where: { id: user.id }, data: { notifPush: false } });
    }
  }
}
