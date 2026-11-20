import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { blockedIdsFor } from '../lib/safety.js';
import { cleanQuery, SAVED_LIMIT, SEARCH_LIMIT, snippetAround } from '../lib/library.js';

/**
 * A member's own answer library. Everything here comes from conversations they took part in, and
 * nothing is shared: other members never see what someone searched for or saved.
 */
export const libraryRouter = Router();

const messageIdSchema = z.coerce.number().int().positive().max(2147483647);

type SessionPeople = { id: number; title: string; seekerId: number; solverId: number | null; seeker: { fullName: string }; solver: { fullName: string } | null };

const memberOf = (userId: number) => ({ OR: [{ seekerId: userId }, { solverId: userId }] });
const peerOf = (s: SessionPeople, userId: number) => (s.seekerId === userId ? s.solverId : s.seekerId);
const peerName = (s: SessionPeople, userId: number) => (s.seekerId === userId ? s.solver?.fullName ?? null : s.seeker.fullName);
const PEOPLE = { id: true, title: true, seekerId: true, solverId: true, seeker: { select: { fullName: true } }, solver: { select: { fullName: true } } } as const;

/** Search question titles and message text across the member's own conversations, newest first. */
libraryRouter.get('/search', requireAuth, async (req: AuthRequest, res) => {
  const q = cleanQuery(req.query.q);
  if (!q) return res.status(400).json({ message: 'Type at least 2 letters to search', code: 'QUERY_TOO_SHORT' });
  const userId = req.user!.userId;
  const [blocked, messages, titles, saved] = await Promise.all([
    blockedIdsFor(userId),
    prisma.message.findMany({
      where: { messageText: { contains: q, mode: 'insensitive' }, session: memberOf(userId) },
      orderBy: { createdAt: 'desc' },
      take: SEARCH_LIMIT,
      select: { id: true, senderId: true, messageText: true, createdAt: true, session: { select: PEOPLE } },
    }),
    prisma.session.findMany({
      where: { ...memberOf(userId), title: { contains: q, mode: 'insensitive' } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { ...PEOPLE, updatedAt: true },
    }),
    prisma.savedMessage.findMany({ where: { userId }, select: { messageId: true } }),
  ]);
  const savedIds = new Set(saved.map(s => s.messageId));
  const visible = (s: SessionPeople) => !blocked.has(peerOf(s, userId) ?? -1);
  const questions = titles.filter(visible);
  const listedQuestion = new Set(questions.map(s => s.id));
  // A question's title is the start of its opening message; when the question is already listed,
  // that opening message would only repeat it.
  const repeatsQuestion = (m: (typeof messages)[number]) =>
    listedQuestion.has(m.session.id) && m.senderId === m.session.seekerId && (m.messageText ?? '').slice(0, 80) === m.session.title;
  res.json({
    query: q,
    questions: questions.map(s => ({
      sessionId: s.id,
      title: s.title,
      peerName: peerName(s, userId),
      role: s.seekerId === userId ? 'seeker' : 'solver',
      updatedAt: s.updatedAt,
    })),
    messages: messages.filter(m => visible(m.session) && !repeatsQuestion(m)).map(m => ({
      messageId: m.id,
      sessionId: m.session.id,
      title: m.session.title,
      peerName: peerName(m.session, userId),
      fromMe: m.senderId === userId,
      snippet: snippetAround(m.messageText ?? '', q),
      createdAt: m.createdAt,
      saved: savedIds.has(m.id),
    })),
  });
});

/** Saved answers, most recently saved first. */
libraryRouter.get('/saved', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const [blocked, rows] = await Promise.all([
    blockedIdsFor(userId),
    prisma.savedMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: SAVED_LIMIT,
      select: { createdAt: true, message: { select: { id: true, senderId: true, messageText: true, createdAt: true, session: { select: PEOPLE } } } },
    }),
  ]);
  res.json({
    saved: rows
      // A conversation the member has since left (account changes) or a blocked person stays hidden.
      .filter(r => [r.message.session.seekerId, r.message.session.solverId].includes(userId) && !blocked.has(peerOf(r.message.session, userId) ?? -1))
      .map(r => ({
        messageId: r.message.id,
        sessionId: r.message.session.id,
        title: r.message.session.title,
        peerName: peerName(r.message.session, userId),
        fromMe: r.message.senderId === userId,
        text: r.message.messageText ?? '',
        sentAt: r.message.createdAt,
        savedAt: r.createdAt,
      })),
  });
});

/** Save a message from one of your own conversations. Saving twice keeps one copy. */
libraryRouter.put('/saved/:messageId', requireAuth, async (req: AuthRequest, res) => {
  const id = messageIdSchema.safeParse(req.params.messageId);
  if (!id.success) return res.status(400).json({ message: 'Invalid message' });
  const userId = req.user!.userId;
  const message = await prisma.message.findFirst({
    where: { id: id.data, session: memberOf(userId) },
    select: { id: true, messageText: true },
  });
  // Someone else's conversation looks exactly like a missing message.
  if (!message) return res.status(404).json({ message: 'Message not found' });
  if (!message.messageText) return res.status(400).json({ message: 'Only text messages can be saved', code: 'NOT_TEXT' });
  const existing = await prisma.savedMessage.findUnique({ where: { userId_messageId: { userId, messageId: id.data } } });
  if (!existing) {
    if ((await prisma.savedMessage.count({ where: { userId } })) >= SAVED_LIMIT) {
      return res.status(409).json({ message: `You can keep up to ${SAVED_LIMIT} saved answers. Remove some to save more.`, code: 'SAVED_FULL' });
    }
    await prisma.savedMessage.upsert({
      where: { userId_messageId: { userId, messageId: id.data } },
      create: { userId, messageId: id.data },
      update: {},
    });
  }
  res.json({ messageId: id.data, saved: true });
});

/** Remove a saved answer. Removing one that is not saved succeeds. */
libraryRouter.delete('/saved/:messageId', requireAuth, async (req: AuthRequest, res) => {
  const id = messageIdSchema.safeParse(req.params.messageId);
  if (!id.success) return res.status(400).json({ message: 'Invalid message' });
  await prisma.savedMessage.deleteMany({ where: { userId: req.user!.userId, messageId: id.data } });
  res.json({ messageId: id.data, saved: false });
});
