import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PushModule],
  providers: [CronService],
})
export class CronModule {}
