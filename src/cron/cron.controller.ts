import {
  Controller,
  Get,
  Headers,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { CronService } from './cron.service';

/**
 * Déclencheur HTTP des tâches quotidiennes — appelé par Vercel Cron.
 *
 * En serverless le décorateur @Cron de CronService ne se déclenche jamais
 * (pas de process permanent). Vercel Cron appelle GET /api/cron/daily selon
 * le planning défini dans vercel.json, en envoyant `Authorization: Bearer
 * <CRON_SECRET>` si la variable CRON_SECRET est configurée.
 */
@Controller('cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(private readonly cronService: CronService) {}

  @Get('daily')
  async daily(@Headers('authorization') authorization?: string) {
    const secret = process.env.CRON_SECRET;
    if (secret && authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException();
    }

    this.logger.log('Cron HTTP trigger: daily tasks');
    await this.cronService.runDailyTasks();
    return { ok: true, ranAt: new Date().toISOString() };
  }
}
