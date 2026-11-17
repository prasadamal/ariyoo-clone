import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const idSchema = z.coerce.number().int().positive().max(2147483647);
const blockSchema = z.object({ userId: idSchema });
export const REPORT_REASONS = ['spam', 'harassment', 'hate', 'sexual', 'scam', 'unsafe_advice', 'other'] as const;
const reportSchema = z.object({
  userId: idSchema,
  sessionId: idSchema.optional(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
  block: z.boolean().default(true),
});

export const safetyRouter = Router();

/** Members may only act on people they have actually talked to; this also stops id guessing. */
async function sharesSession(a: number, b: number): Promise<boolean> {
  const row = await prisma.session.findFirst({
    where: { OR: [{ seekerId: a, solverId: b }, { seekerId: b, solverId: a }] }, select: { id: true },
  });
  return !!row;
}

async function block(blockerId: number, blockedId: number) {
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } }, update: {}, create: { blockerId, blockedId },
  });
}

safetyRouter.post('/block', requireAuth, async (req: AuthRequest, res) => {
  const parsed = blockSchema.safeParse(req.body);
  const me = req.user!.userId;
  if (!parsed.success || parsed.data.userId === me || !(await sharesSession(me, parsed.data.userId))) {
    return res.status(404).json({ message: 'User not found' });
  }
  await block(me, parsed.data.userId);
  res.json({ ok: true, blocked: true });
});

safetyRouter.delete('/block/:userId', requireAuth, async (req: AuthRequest, res) => {
  const parsed = idSchema.safeParse(req.params.userId);
  if (!parsed.success) return res.status(404).json({ message: 'User not found' });
  await prisma.block.deleteMany({ where: { blockerId: req.user!.userId, blockedId: parsed.data } });
  res.json({ ok: true, blocked: false });
});

safetyRouter.get('/blocks', requireAuth, async (req: AuthRequest, res) => {
  const rows = await prisma.block.findMany({ where: { blockerId: req.user!.userId }, orderBy: { createdAt: 'desc' } });
  const users = await prisma.user.findMany({ where: { id: { in: rows.map(r => r.blockedId) } }, select: { id: true, fullName: true } });
  const names = new Map(users.map(u => [u.id, u.fullName]));
  res.json(rows.map(r => ({ userId: r.blockedId, fullName: names.get(r.blockedId) ?? 'Deleted member', blockedAt: r.createdAt })));
});

safetyRouter.post('/report', requireAuth, async (req: AuthRequest, res) => {
  const parsed = reportSchema.safeParse(req.body);
  const me = req.user!.userId;
  if (!parsed.success) return res.status(400).json({ message: 'Choose a reason for the report' });
  const { userId, sessionId, reason, details } = parsed.data;
  if (userId === me || !(await sharesSession(me, userId))) return res.status(404).json({ message: 'User not found' });
  const report = await prisma.report.create({ data: { reporterId: me, reportedId: userId, sessionId, reason, details: details || null } });
  // Someone who reports a person almost never wants to hear from them again.
  if (parsed.data.block) await block(me, userId);
  res.status(201).json({ ok: true, reportId: report.id, blocked: parsed.data.block });
});
