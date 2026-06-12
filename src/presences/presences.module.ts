import { Module } from '@nestjs/common';
import { PresencesController } from './presences.controller';
import { PresencesService } from './presences.service';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PushModule],
  controllers: [PresencesController],
  providers: [PresencesService],
  exports: [PresencesService],
})
export class PresencesModule {}
