import { Router } from 'express';
import bcrypt from 'bcryptjs';
import path from 'path';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { containsBlockedContent } from '../lib/contentFilter.js';
import { EXPO_TOKEN } from '../lib/push.js';
import { passwordRule, publicSelf } from './auth.js';
import { expertStats } from './message.js';

const profileSchema = z.object({
  fullName: z.string().trim().min(1).max(100).optional(),
  userName: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_.]+$/).nullable().optional().or(z.literal('').transform(() => null)),
  isSolver: z.boolean().optional(),
});
const passwordSchema = z.object({ oldPassword: z.string().min(1).max(200), newPassword: passwordRule });
const deleteSchema = z.object({ password: z.string().min(1).max(200) });
const pushSchema = z.object({ token: z.string().regex(EXPO_TOKEN), platform: z.enum(['ios', 'android']).optional() });

export const userRouter = Router();

userRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(publicSelf(user));
});

/** Your own activity: questions asked, and your record as an expert. */
userRouter.get('/stats', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const [asked, record] = await Promise.all([prisma.session.count({ where: { seekerId: userId } }), expertStats(userId)]);
  res.json({ asked, ...record });
});

userRouter.put('/', requireAuth, async (req: AuthRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Usernames are 3–30 letters, numbers, dots or underscores' });
  const { fullName, userName, isSolver } = parsed.data;
  if (containsBlockedContent(fullName) || containsBlockedContent(userName)) {
    return res.status(422).json({ message: 'That name is not allowed', code: 'CONTENT_BLOCKED' });
  }
  const user = await prisma.user.update({ where: { id: req.user!.userId }, data: { fullName, userName, isSolver } });
  res.json(publicSelf(user));
});

userRouter.put('/updatepassword', requireAuth, async (req: AuthRequest, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Password must be 12–72 characters' });
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const ok = await bcrypt.compare(parsed.data.oldPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Current password is incorrect' });
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.json({ message: 'Password updated' });
});

userRouter.post('/pushToken', requireAuth, async (req: AuthRequest, res) => {
  const parsed = pushSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid push token' });
  const { token, platform } = parsed.data;
  // A phone belongs to whoever signed in last: the token moves to this account.
  await prisma.pushToken.upsert({ where: { token }, update: { userId: req.user!.userId, platform }, create: { token, userId: req.user!.userId, platform } });
  res.json({ ok: true });
});

userRouter.delete('/pushToken', requireAuth, async (req: AuthRequest, res) => {
  const parsed = pushSchema.pick({ token: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid push token' });
  await prisma.pushToken.deleteMany({ where: { token: parsed.data.token, userId: req.user!.userId } });
  res.json({ ok: true });
});

/**
 * Permanently deletes the account and everything tied to it (store requirement: deletion must
 * be available in the app and must remove the data, not just deactivate the account).
 * Conversations the member took part in are removed for both sides, including photos.
 */
export async function deleteAccount(userId: number): Promise<{ sessions: number; files: number }> {
  const sessions = await prisma.session.findMany({ where: { OR: [{ seekerId: userId }, { solverId: userId }] }, select: { id: true } });
  const sessionIds = sessions.map(s => s.id);
  const images = sessionIds.length
    ? await prisma.message.findMany({ where: { sessionId: { in: sessionIds }, imageUrl: { not: null } }, select: { imageUrl: true } })
    : [];
  const names = images.map(({ imageUrl }) => path.basename(imageUrl || '')).filter(name => /^[a-f0-9-]+\.(jpg|png|webp)$/.test(name));
  const [, , , , , , , removed] = await prisma.$transaction([
    // What this member saved goes with them; other members' saved copies go with the conversations below.
    prisma.savedMessage.deleteMany({ where: { userId } }),
    prisma.message.deleteMany({ where: { sessionId: { in: sessionIds } } }),
    prisma.session.deleteMany({ where: { id: { in: sessionIds } } }),
    prisma.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } }),
    // Reports this member filed go with them; reports about them stay for the moderator, by id only.
    prisma.report.deleteMany({ where: { reporterId: userId } }),
    prisma.user.delete({ where: { id: userId } }),
    prisma.pushToken.deleteMany({ where: { userId } }),
    // The photos go with the conversations, for the other participant too.
    prisma.upload.deleteMany({ where: { name: { in: names } } }),
  ]);
  const files = removed.count;
  return { sessions: sessionIds.length, files };
}

userRouter.delete('/', requireAuth, async (req: AuthRequest, res) => {
  const parsed = deleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter your password to delete your account' });
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ message: 'Password is incorrect' });
  }
  await deleteAccount(user.id);
  res.json({ ok: true, deleted: true });
});
