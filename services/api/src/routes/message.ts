import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import { config } from '../config.js';
import { scoreMatch } from '../utils/matching.js';
import { emitSessionMessage } from '../io.js';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { z } from 'zod';
const sessionIdSchema = z.coerce.number().int().positive().max(2147483647);
const questionSchema = z.object({ message: z.string().trim().min(1).max(10000), tag: z.array(z.object({ tagName: z.string().trim().min(1).max(80) })).max(20).optional() });
const messageSchema = z.object({ messageText: z.string().trim().min(1).max(10000), sessionId: sessionIdSchema });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 3 } });

export const messageRouter = Router();

messageRouter.post('/postQuestion', requireAuth, async (req: AuthRequest, res) => {
  const seekerId = req.user!.userId;
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid question or tags' });
  const { message, tag } = parsed.data;
  if (!message?.trim()) return res.status(400).json({ message: 'Message is required' });
  const tags = tag?.map(t => t.tagName) || [];
  const solvers = await prisma.user.findMany({ where: { isSolver: true }, include: { tags: { include: { tag: true } } } });
  let best = solvers.map(s => ({ solverId: s.id, score: scoreMatch(s.tags.map(t => t.tag.name), tags) }))
                   .sort((a,b) => b.score - a.score)[0];
  const solverId = best?.solverId || solvers[0]?.id || seekerId;
  const { session, created } = await prisma.$transaction(async tx => {
    const session = await tx.session.create({ data: { seekerId, solverId, title: message.slice(0,80) } });
    const created = await tx.message.create({ data: { sessionId: session.id, senderId: seekerId, messageText: message } });
    return { session, created };
  });
  emitSessionMessage(session.id, created);
  res.json({ sessionId: session.id });
});

messageRouter.get('/getallsessionsseeker/:seekerId', requireAuth, async (req: AuthRequest, res) => {
  const seekerId = Number(req.params.seekerId);
  if (seekerId !== req.user!.userId) return res.status(403).json({ message: 'Forbidden' });
  const sessions = await prisma.session.findMany({ where: { seekerId }, orderBy: { updatedAt: 'desc' } });
  res.json(sessions.map(s => ({ sessionId: s.id, title: s.title, active: s.active })));
});

messageRouter.get('/getallsessionssolver/:solverId', requireAuth, async (req: AuthRequest, res) => {
  const solverId = Number(req.params.solverId);
  if (solverId !== req.user!.userId) return res.status(403).json({ message: 'Forbidden' });
  const sessions = await prisma.session.findMany({ where: { solverId }, orderBy: { updatedAt: 'desc' } });
  res.json(sessions.map(s => ({ sessionId: s.id, title: s.title, active: s.active })));
});

messageRouter.get('/getMessagesBySessionId/:sessionId', requireAuth, async (req: AuthRequest, res) => {
  const parsed = sessionIdSchema.safeParse(req.params.sessionId);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid session' });
  const sessionId = parsed.data;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  const userId = req.user!.userId;
  if (!session || (session.seekerId !== userId && session.solverId !== userId)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const msgs = await prisma.message.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
  res.json(msgs);
});

messageRouter.post('/postMessage', requireAuth, async (req: AuthRequest, res) => {
  const senderId = req.user!.userId;
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid message' });
  const { messageText, sessionId } = parsed.data;
  if (!messageText?.trim() || !sessionId) return res.status(400).json({ message: 'Invalid message' });
  const session = await prisma.session.findUnique({ where: { id: Number(sessionId) } });
  if (!session || (session.seekerId !== senderId && session.solverId !== senderId)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const msg = await prisma.message.create({ data: { senderId, messageText, sessionId: session.id } });
  await prisma.session.update({ where: { id: session.id }, data: { updatedAt: new Date() } });
  emitSessionMessage(session.id, msg);
  res.json(msg);
});

messageRouter.post('/uploadImage', requireAuth, upload.single('image'), async (req: AuthRequest, res) => {
  const senderId = req.user!.userId;
  const { sessionId } = req.body;
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'No file' });
  const numericSession = Number(sessionId);
  if (!Number.isSafeInteger(numericSession) || numericSession <= 0) return res.status(400).json({ message: 'Invalid session' });
  const session = await prisma.session.findUnique({ where: { id: numericSession } });
  if (!session || (session.seekerId !== senderId && session.solverId !== senderId)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  // Detect bytes rather than trusting MIME headers or user-supplied extensions. No SVG/HTML.
  const b = file.buffer;
  const ext = b.length >= 3 && b.subarray(0, 3).equals(Buffer.from([255,216,255])) ? 'jpg'
    : b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
    : b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null;
  if (!ext) return res.status(415).json({ message: 'Use a JPEG, PNG or WebP image' });
  const filename = `${randomUUID()}.${ext}`;
  const finalPath = path.join(config.uploadDir, filename);
  const imgUrl = `/uploads/${filename}`;
  await fs.promises.writeFile(finalPath, b, { flag: 'wx' });
  let msg;
  try {
    msg = await prisma.$transaction(async tx => {
      const created = await tx.message.create({ data: { senderId, sessionId: numericSession, imageUrl: imgUrl } });
      await tx.session.update({ where: { id: numericSession }, data: { updatedAt: new Date() } });
      return created;
    });
  } catch (error) {
    await fs.promises.unlink(finalPath).catch(() => {});
    throw error;
  }
  emitSessionMessage(numericSession, msg);
  res.json(msg);
});
