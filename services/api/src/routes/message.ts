import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import { pickSolver } from '../utils/matching.js';
import { emitSessionMessage } from '../io.js';
import { blockedIdsFor, isBlockedPair } from '../lib/safety.js';
import { containsBlockedContent } from '../lib/contentFilter.js';
import { notifyUsers } from '../lib/push.js';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const sessionIdSchema = z.coerce.number().int().positive().max(2147483647);
const questionSchema = z.object({ message: z.string().trim().min(1).max(10000), tag: z.array(z.object({ tagName: z.string().trim().min(1).max(80) })).max(20).optional() });
const messageSchema = z.object({ messageText: z.string().trim().min(1).max(10000), sessionId: sessionIdSchema });
const BLOCKED_TEXT = { message: 'This message breaks the community rules and was not sent.', code: 'CONTENT_BLOCKED' };
const CLOSED = { message: 'This conversation is closed.', code: 'CHAT_CLOSED' };
const resolveSchema = z.object({ helpful: z.boolean().optional() }).strict();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 3 } });

export const messageRouter = Router();

type SessionRow = { id: number; seekerId: number; solverId: number | null; title: string; active: boolean; updatedAt: Date };

function isMember(session: { seekerId: number; solverId: number | null } | null, userId: number): session is SessionRow {
  return !!session && (session.seekerId === userId || session.solverId === userId);
}

async function listSessions(userId: number, role: 'seeker' | 'solver') {
  const blocked = await blockedIdsFor(userId);
  const sessions = await prisma.session.findMany({
    where: role === 'seeker' ? { seekerId: userId } : { solverId: userId },
    orderBy: { updatedAt: 'desc' },
    include: { seeker: { select: { fullName: true } }, solver: { select: { fullName: true } } },
  });
  return sessions
    .filter(s => !blocked.has(role === 'seeker' ? s.solverId ?? -1 : s.seekerId))
    .map(s => ({
      sessionId: s.id,
      title: s.title,
      active: s.active,
      role,
      // True while no expert has picked the question up yet.
      waiting: s.solverId === null,
      peerName: role === 'seeker' ? s.solver?.fullName ?? null : s.seeker.fullName,
      resolved: s.resolvedAt !== null,
      helpful: s.helpful,
      updatedAt: s.updatedAt,
    }));
}

/** An expert's public record: questions they saw through to the end, and how many askers said it helped. */
export async function expertStats(userId: number) {
  const [answered, helpful] = await Promise.all([
    prisma.session.count({ where: { solverId: userId, resolvedAt: { not: null } } }),
    prisma.session.count({ where: { solverId: userId, helpful: true } }),
  ]);
  return { answered, helpful };
}

messageRouter.post('/postQuestion', requireAuth, async (req: AuthRequest, res) => {
  const seekerId = req.user!.userId;
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid question or tags' });
  const { message, tag } = parsed.data;
  if (containsBlockedContent(message)) return res.status(422).json(BLOCKED_TEXT);
  const tags = tag?.map(t => t.tagName) || [];

  const blocked = await blockedIdsFor(seekerId);
  const solvers = await prisma.user.findMany({
    where: { isSolver: true, suspendedAt: null, id: { not: seekerId } },
    select: { id: true, tags: { select: { tag: { select: { name: true } } } }, _count: { select: { solverSessions: { where: { active: true } } } } },
  });
  const solverId = pickSolver(
    solvers.map(s => ({ id: s.id, tags: s.tags.map(t => t.tag.name), activeSessions: s._count.solverSessions })),
    tags,
    blocked,
  );

  const { session, created } = await prisma.$transaction(async tx => {
    const session = await tx.session.create({ data: { seekerId, solverId, title: message.slice(0, 80) } });
    const created = await tx.message.create({ data: { sessionId: session.id, senderId: seekerId, messageText: message } });
    return { session, created };
  });
  emitSessionMessage(session.id, created);
  // No direct match: every expert can see it in the open queue, so tell them all.
  void notifyUsers(solverId ? [solverId] : solvers.filter(s => !blocked.has(s.id)).map(s => s.id), 'question', session.id);
  res.json({ sessionId: session.id, matched: solverId !== null });
});

// Questions nobody has picked up yet. Any expert may take one.
messageRouter.get('/openQuestions', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { isSolver: true } });
  if (!me?.isSolver) return res.json([]);
  const blocked = await blockedIdsFor(userId);
  const sessions = await prisma.session.findMany({
    where: { solverId: null, active: true, seekerId: { notIn: [userId, ...blocked] } },
    orderBy: { createdAt: 'desc' }, take: 50,
    include: { seeker: { select: { fullName: true } } },
  });
  res.json(sessions.map(s => ({ sessionId: s.id, title: s.title, askedBy: s.seeker.fullName, createdAt: s.createdAt })));
});

messageRouter.post('/claim/:sessionId', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const parsed = sessionIdSchema.safeParse(req.params.sessionId);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid session' });
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { isSolver: true } });
  if (!me?.isSolver) return res.status(403).json({ message: 'Turn on expert mode to answer questions' });
  const session = await prisma.session.findUnique({ where: { id: parsed.data } });
  if (!session || session.seekerId === userId || (await isBlockedPair(userId, session.seekerId))) {
    return res.status(404).json({ message: 'Question not found' });
  }
  // Conditional update: when two experts tap at once, exactly one gets the question.
  const claimed = await prisma.session.updateMany({ where: { id: session.id, solverId: null, active: true }, data: { solverId: userId } });
  if (!claimed.count) return res.status(409).json({ message: 'Another expert already picked this up', code: 'ALREADY_CLAIMED' });
  void notifyUsers([session.seekerId], 'claimed', session.id);
  res.json({ sessionId: session.id });
});

messageRouter.get('/getallsessionsseeker/:seekerId', requireAuth, async (req: AuthRequest, res) => {
  if (Number(req.params.seekerId) !== req.user!.userId) return res.status(403).json({ message: 'Forbidden' });
  res.json(await listSessions(req.user!.userId, 'seeker'));
});

messageRouter.get('/getallsessionssolver/:solverId', requireAuth, async (req: AuthRequest, res) => {
  if (Number(req.params.solverId) !== req.user!.userId) return res.status(403).json({ message: 'Forbidden' });
  res.json(await listSessions(req.user!.userId, 'solver'));
});

messageRouter.get('/session/:sessionId', requireAuth, async (req: AuthRequest, res) => {
  const parsed = sessionIdSchema.safeParse(req.params.sessionId);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid session' });
  const userId = req.user!.userId;
  const session = await prisma.session.findUnique({
    where: { id: parsed.data },
    include: { seeker: { select: { id: true, fullName: true } }, solver: { select: { id: true, fullName: true } } },
  });
  if (!isMember(session, userId)) return res.status(403).json({ message: 'Forbidden' });
  const peer = session.seekerId === userId ? session.solver : session.seeker;
  const role = session.seekerId === userId ? 'seeker' : 'solver';
  res.json({
    sessionId: session.id, title: session.title, active: session.active,
    role,
    waiting: session.solverId === null,
    resolved: session.resolvedAt !== null,
    helpful: session.helpful,
    peer: peer ? { userId: peer.id, fullName: peer.fullName } : null,
    // Askers see the expert's record; experts are not shown a score for askers.
    peerStats: role === 'seeker' && peer ? await expertStats(peer.id) : null,
    blocked: await isBlockedPair(userId, peer?.id),
  });
});

messageRouter.post('/resolve/:sessionId', requireAuth, async (req: AuthRequest, res) => {
  const id = sessionIdSchema.safeParse(req.params.sessionId);
  const body = resolveSchema.safeParse(req.body ?? {});
  if (!id.success || !body.success) return res.status(400).json({ message: 'Invalid request' });
  const userId = req.user!.userId;
  const session = await prisma.session.findUnique({ where: { id: id.data } });
  // Only the person who asked can close their question; anyone else learns nothing about it.
  if (!session || session.seekerId !== userId) return res.status(404).json({ message: 'Question not found' });
  // Withdrawn before any expert picked it up: there is nobody to thank.
  const helpful = session.solverId === null ? null : body.data.helpful ?? null;
  // Conditional update: a double tap or a second device closes it exactly once.
  const done = await prisma.session.updateMany({ where: { id: session.id, resolvedAt: null }, data: { active: false, resolvedAt: new Date(), helpful } });
  if (!done.count) return res.status(409).json({ message: 'This question is already closed', code: 'ALREADY_RESOLVED' });
  if (helpful && !(await isBlockedPair(userId, session.solverId))) void notifyUsers([session.solverId], 'thanked', session.id);
  res.json({ sessionId: session.id, resolved: true, helpful });
});

messageRouter.get('/getMessagesBySessionId/:sessionId', requireAuth, async (req: AuthRequest, res) => {
  const parsed = sessionIdSchema.safeParse(req.params.sessionId);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid session' });
  const sessionId = parsed.data;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!isMember(session, req.user!.userId)) return res.status(403).json({ message: 'Forbidden' });
  const msgs = await prisma.message.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
  res.json(msgs);
});

/** The other participant, or a refusal when either side has blocked the other. */
async function peerOrClosed(session: SessionRow, senderId: number): Promise<{ closed: boolean; peerId: number | null }> {
  const peerId = session.seekerId === senderId ? session.solverId : session.seekerId;
  return { closed: !session.active || (await isBlockedPair(senderId, peerId)), peerId };
}

messageRouter.post('/postMessage', requireAuth, async (req: AuthRequest, res) => {
  const senderId = req.user!.userId;
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid message' });
  const { messageText, sessionId } = parsed.data;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!isMember(session, senderId)) return res.status(403).json({ message: 'Forbidden' });
  const { closed, peerId } = await peerOrClosed(session, senderId);
  if (closed) return res.status(403).json(CLOSED);
  if (containsBlockedContent(messageText)) return res.status(422).json(BLOCKED_TEXT);
  const msg = await prisma.message.create({ data: { senderId, messageText, sessionId: session.id } });
  await prisma.session.update({ where: { id: session.id }, data: { updatedAt: new Date() } });
  emitSessionMessage(session.id, msg);
  void notifyUsers([peerId], 'reply', session.id);
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
  if (!isMember(session, senderId)) return res.status(403).json({ message: 'Forbidden' });
  const { closed, peerId } = await peerOrClosed(session, senderId);
  if (closed) return res.status(403).json(CLOSED);
  // Detect bytes rather than trusting MIME headers or user-supplied extensions. No SVG/HTML.
  const b = file.buffer;
  const ext = b.length >= 3 && b.subarray(0, 3).equals(Buffer.from([255,216,255])) ? 'jpg'
    : b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
    : b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null;
  if (!ext) return res.status(415).json({ message: 'Use a JPEG, PNG or WebP image' });
  const filename = `${randomUUID()}.${ext}`;
  const imgUrl = `/uploads/${filename}`;
  // Photo and message are one transaction: no orphaned photo, no message without its photo.
  const msg = await prisma.$transaction(async tx => {
    await tx.upload.create({ data: { name: filename, contentType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`, data: b } });
    const created = await tx.message.create({ data: { senderId, sessionId: numericSession, imageUrl: imgUrl } });
    await tx.session.update({ where: { id: numericSession }, data: { updatedAt: new Date() } });
    return created;
  });
  emitSessionMessage(numericSession, msg);
  void notifyUsers([peerId], 'reply', numericSession);
  res.json(msg);
});
