import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Configuration commune appliquée à l'app Nest, partagée entre :
 * - le démarrage local long-running (src/main.ts)
 * - l'entrée serverless Vercel (src/server.ts)
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: false,
      transform: true, // auto-cast query params / body to DTO types
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    credentials: true,
  });
}
