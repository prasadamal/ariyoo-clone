import { Router } from 'express';
import { prisma } from '../prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { z } from 'zod';

const credentials = z.object({ email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), password: z.string().min(1).refine(s => Buffer.byteLength(s, 'utf8') <= 72) });
const registration = credentials.extend({ password: z.string().min(12).refine(s => Buffer.byteLength(s, 'utf8') <= 72), flname: z.string().trim().min(1).max(100), isSeeker: z.boolean().default(true), isSolver: z.boolean().default(false) });

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const parsed = registration.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Use a valid email, name and password (12–72 characters)' });
  const { email, password, flname, isSeeker, isSolver } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ message: 'Email already exists' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash, fullName: flname, isSeeker: !!isSeeker, isSolver: !!isSolver } });
  const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
  return res.json({ userId: user.id, email: user.email, fullName: user.fullName, token });
});

authRouter.post('/login', async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid credentials' });
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
  return res.json({ userId: user.id, email: user.email, fullName: user.fullName, token, isSolver: user.isSolver });
});