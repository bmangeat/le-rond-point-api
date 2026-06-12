import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';
import { ProfileModule } from './profile/profile.module';
import { PresencesModule } from './presences/presences.module';
import { EventsModule } from './events/events.module';
import { AdminModule } from './admin/admin.module';
import { PushModule } from './push/push.module';
import { CronModule } from './cron/cron.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    GroupsModule,
    ProfileModule,
    PresencesModule,
    EventsModule,
    AdminModule,
    PushModule,
    CronModule,
  ],
})
export class AppModule {}
