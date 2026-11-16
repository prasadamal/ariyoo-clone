import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) throw new Error('Set DEMO_PASSWORD to at least 12 characters');
  const tags = ['travel', 'food', 'beaches', 'mountains', 'shopping', 'local', 'kerala', 'goa', 'mumbai', 'agra'];
  for (const name of tags) await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });

  const places = ['Kerala', 'Goa', 'Mumbai', 'Delhi', 'Agra'];
  for (const name of places) await prisma.place.upsert({ where: { name }, update: {}, create: { name } });

  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const solver = await prisma.user.upsert({
    where: { email: 'solver@example.com' },
    update: {},
    create: { email: 'solver@example.com', passwordHash, fullName: 'Demo Solver', isSolver: true, isSeeker: true }
  });

  await prisma.user.upsert({
    where: { email: 'seeker@example.com' },
    update: {},
    create: { email: 'seeker@example.com', passwordHash, fullName: 'Demo Seeker', isSolver: false, isSeeker: true }
  });

  const travel = await prisma.tag.findUnique({ where: { name: 'travel' } });
  if (travel) await prisma.userTag.upsert({ where: { userId_tagId: { userId: solver.id, tagId: travel.id } }, update: {}, create: { userId: solver.id, tagId: travel.id } });

  console.log('Seeded data.');
}

main().finally(() => prisma.$disconnect());