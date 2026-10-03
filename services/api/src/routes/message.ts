import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import { config } from '../config';
import { scoreMatch } from '../utils/matching';
import { emitSessionMessage } from '../io';
import path from 'path';
import fs from 'fs';

const upload = multer({ dest: config.uploadDir });

export const messageRouter = Router();

messageRouter.post('/postQuestion', requireAuth, async (req: AuthRequest, res) => {
  const seekerId = req.user!.userId;
  const { message, tag } = req.body as { message: string; tag: { tagName: string }[] };
  if (!message?.trim()) return res.status(400).json({ message: 'Message is required' });
  const tags = tag?.map(t => t.tagName) || [];
  const solvers = await prisma.user.findMany({ where: { isSolver: true }, include: { tags: { include: { tag: true } } } });
  let best = solvers.map(s => ({ solverId: s.id, score: scoreMatch(s.tags.map(t => t.tag.name), tags) }))
                   .sort((a,b) => b.score - a.score)[0];
  const solverId = best?.solverId || solvers[0]?.id || seekerId;
  const session = await prisma.session.create({ data: { seekerId, solverId, title: message.slice(0,80) } });
  const created = await prisma.message.create({ data: { sessionId: session.id, senderId: seekerId, messageText: message } });
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
  const sessionId = Number(req.params.sessionId);
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
  const { messageText, sessionId } = req.body as { messageText: string; sessionId: number };
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
  const imgUrl = `/uploads/${file.filename}${path.extname(file.originalname)}`;
  const finalPath = path.join(config.uploadDir, `${file.filename}${path.extname(file.originalname)}`);
  fs.renameSync(file.path, finalPath);
  const numericSession = Number(sessionId);
  const session = await prisma.session.findUnique({ where: { id: numericSession } });
  if (!session || (session.seekerId !== senderId && session.solverId !== senderId)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const msg = await prisma.message.create({
    data: { senderId, sessionId: numericSession, imageUrl: imgUrl },
  });
  emitSessionMessage(numericSession, msg);
  res.json(msg);
});