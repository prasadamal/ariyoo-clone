import { Router } from 'express';
import { prisma } from '../prisma.js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { signToken } from '../middleware/auth.js';
import { containsBlockedContent } from '../lib/contentFilter.js';

export const passwordRule = z.string().min(12).refine(s => Buffer.byteLength(s, 'utf8') <= 72);
const credentials = z.object({ email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), password: z.string().min(1).refine(s => Buffer.byteLength(s, 'utf8') <= 72) });
const registration = credentials.extend({
  password: passwordRule,
  flname: z.string().trim().min(1).max(100),
  isSeeker: z.boolean().default(true),
  isSolver: z.boolean().default(false),
  // The stores require agreement to terms that forbid abusive content before anyone can post.
  acceptedTerms: z.literal(true),
});

type UserRow = { id: number; email: string; fullName: string; userName: string | null; isSolver: boolean; isSeeker: boolean };

/** The one shape every client gets for "who am I". */
export function publicSelf(user: UserRow) {
  return { userId: user.id, email: user.email, fullName: user.fullName, userName: user.userName, isSolver: user.isSolver, isSeeker: user.isSeeker };
}

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  if (req.body && req.body.acceptedTerms !== true) {
    return res.status(400).json({ message: 'Please accept the Terms of Use and Privacy Policy to create an account', code: 'TERMS_REQUIRED' });
  }
  const parsed = registration.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Use a valid email, name and password (12–72 characters)' });
  const { email, password, flname, isSeeker, isSolver } = parsed.data;
  if (containsBlockedContent(flname)) return res.status(422).json({ message: 'That name is not allowed', code: 'CONTENT_BLOCKED' });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ message: 'Email already exists' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash, fullName: flname, isSeeker, isSolver, termsAcceptedAt: new Date() } });
  return res.json({ ...publicSelf(user), token: signToken(user) });
});

authRouter.post('/login', async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid credentials' });
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  if (user.suspendedAt) return res.status(403).json({ message: 'This account has been suspended. Contact support.', code: 'ACCOUNT_SUSPENDED' });
  return res.json({ ...publicSelf(user), token: signToken(user) });
});
