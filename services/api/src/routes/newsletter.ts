import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';

export const newsletterRouter = Router();
const email = z.string().trim().email().max(254).transform(s => s.toLowerCase());

newsletterRouter.post('/', async (req, res) => {
  const parsed = email.safeParse(req.body?.email);
  if (!parsed.success) return res.status(400).json({ message: 'email required' });
  await prisma.newsletter.create({ data: { email: parsed.data } }).catch(() => {});
  res.json({ message: 'ok' });
});
