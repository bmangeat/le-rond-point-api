/**
 * Dev-only : crée (ou réactive) un utilisateur et forge un accessToken JWT
 * valable 15 min, signé avec JWT_SECRET — comme le fait AuthService.
 *
 * Usage : pnpm exec ts-node scripts/dev-token.ts [email] [name]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

async function main() {
  const email = process.argv[2] ?? 'dev@local.test';
  const name = process.argv[3] ?? 'Dev User';

  const prisma = new PrismaClient();
  const user = await prisma.user.upsert({
    where: { email },
    update: { isActive: true },
    create: { email, name, isActive: true },
  });

  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email },
    { expiresIn: '15m' },
  );

  console.log('USER_ID=' + user.id);
  console.log('ACCESS_TOKEN=' + accessToken);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
