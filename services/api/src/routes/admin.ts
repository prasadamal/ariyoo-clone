import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { deleteAccount } from './user.js';

/**
 * Moderator endpoints (reports queue, suspend, delete). Send the key as `x-admin-key`.
 * The stores expect reports to be acted on within 24 hours; see MODERATION.md.
 */
export const adminRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!config.adminApiKey) return res.status(503).json({ message: 'Admin API is not configured' });
  const given = Buffer.from(String(req.headers['x-admin-key'] || ''));
  const expected = Buffer.from(config.adminApiKey);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return res.status(401).json({ message: 'Unauthorized' });
  next();
}
adminRouter.use(requireAdmin);

const idSchema = z.coerce.number().int().positive().max(2147483647);

adminRouter.get('/reports', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'open';
  const reports = await prisma.report.findMany({ where: { status }, orderBy: { createdAt: 'asc' }, take: 100 });
  const ids = [...new Set(reports.flatMap(r => [r.reporterId, r.reportedId]))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, email: true, suspendedAt: true } });
  const byId = new Map(users.map(u => [u.id, u]));
  const out = [];
  for (const r of reports) {
    // The reported person's side of the reported conversation, newest last, so the report can be judged.
    const messages = r.sessionId
      ? await prisma.message.findMany({ where: { sessionId: r.sessionId, senderId: r.reportedId }, orderBy: { createdAt: 'desc' }, take: 20, select: { messageText: true, imageUrl: true, createdAt: true } })
      : [];
    out.push({ ...r, reporter: byId.get(r.reporterId) ?? null, reported: byId.get(r.reportedId) ?? null, messages: messages.reverse() });
  }
  res.json(out);
});

adminRouter.post('/reports/:id', async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const body = z.object({ status: z.enum(['open', 'resolved', 'dismissed']) }).safeParse(req.body);
  if (!id.success || !body.success) return res.status(400).json({ message: 'Invalid request' });
  const updated = await prisma.report.updateMany({ where: { id: id.data }, data: { status: body.data.status } });
  if (!updated.count) return res.status(404).json({ message: 'Report not found' });
  res.json({ ok: true });
});

adminRouter.post('/users/:id/suspend', async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const body = z.object({ suspended: z.boolean() }).safeParse(req.body);
  if (!id.success || !body.success) return res.status(400).json({ message: 'Invalid request' });
  const updated = await prisma.user.updateMany({ where: { id: id.data }, data: { suspendedAt: body.data.suspended ? new Date() : null } });
  if (!updated.count) return res.status(404).json({ message: 'User not found' });
  if (body.data.suspended) await prisma.pushToken.deleteMany({ where: { userId: id.data } });
  res.json({ ok: true, suspended: body.data.suspended });
});

// For deletion requests that arrive by email (the web deletion page promises this route exists).
adminRouter.delete('/users/:id', async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: 'Invalid request' });
  const user = await prisma.user.findUnique({ where: { id: id.data }, select: { id: true } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ ok: true, ...(await deleteAccount(user.id)) });
});

adminRouter.get('/users', async (req, res) => {
  const email = z.string().trim().email().safeParse(req.query.email);
  if (!email.success) return res.status(400).json({ message: 'Pass ?email=' });
  const user = await prisma.user.findUnique({ where: { email: email.data.toLowerCase() }, select: { id: true, email: true, fullName: true, isSolver: true, suspendedAt: true, createdAt: true } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});
