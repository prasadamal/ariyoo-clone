import { prisma } from '../prisma.js';

/** Everyone this member has blocked or been blocked by. Blocks apply in both directions. */
export async function blockedIdsFor(userId: number): Promise<Set<number>> {
  const rows = await prisma.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
  return new Set(rows.map(r => (r.blockerId === userId ? r.blockedId : r.blockerId)));
}

export async function isBlockedPair(a: number, b: number | null | undefined): Promise<boolean> {
  if (!b) return false;
  const row = await prisma.block.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { blockerId: true },
  });
  return !!row;
}
