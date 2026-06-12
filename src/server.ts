import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.config';

/**
 * Entrée serverless (Vercel). Compilé vers dist/server.js par `nest build`,
 * puis chargé par api/index.ts.
 *
 * L'app Nest est initialisée une seule fois et mise en cache entre les
 * invocations (réutilisation du conteneur "warm"). On retourne l'instance
 * Express sous-jacente, qui est un handler (req, res) standard.
 */
let cached: Promise<(req: unknown, res: unknown) => void> | undefined;

export function bootstrapServer(): Promise<(req: unknown, res: unknown) => void> {
  if (!cached) {
    cached = (async () => {
      const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
      configureApp(app);
      await app.init();
      return app.getHttpAdapter().getInstance();
    })();
  }
  return cached;
}
