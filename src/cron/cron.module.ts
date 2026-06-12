import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PushModule],
  controllers: [CronController],
  providers: [CronService],
})
export class CronModule {}
