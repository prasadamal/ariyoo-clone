import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const tags = ['travel', 'food', 'beaches', 'mountains', 'shopping', 'local', 'kerala', 'goa', 'mumbai', 'agra'];
  for (const name of tags) await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });

  const places = ['Kerala', 'Goa', 'Mumbai', 'Delhi', 'Agra'];
  for (const name of places) await prisma.place.upsert({ where: { name }, update: {}, create: { name } });

  // Demo account for LOCAL DEVELOPMENT ONLY. Never seed this into production.
  if (process.env.NODE_ENV === 'production') {
    console.log('Seeded catalogue data only (demo user skipped in production).');
    return;
  }
  const passwordHash = await bcrypt.hash('password', 10);
  const solver = await prisma.user.upsert({
    where: { email: 'solver@example.com' },
    update: {},
    create: { email: 'solver@example.com', passwordHash, fullName: 'Demo Solver', isSolver: true, isSeeker: true }
  });
  const travel = await prisma.tag.findUnique({ where: { name: 'travel' } });
  if (travel) await prisma.userTag.upsert({ where: { userId_tagId: { userId: solver.id, tagId: travel.id } }, update: {}, create: { userId: solver.id, tagId: travel.id } });
  console.log('Seeded data (demo user: solver@example.com / password).');
}

main().finally(() => prisma.$disconnect());
