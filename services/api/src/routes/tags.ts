import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { containsBlockedContent } from '../lib/contentFilter.js';

export const tagsRouter = Router();

// Every write acts on the signed-in member. A `userId` in the body is ignored: it used to be
// trusted, which let any member edit anyone else's topics.
const name = z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N}][\p{L}\p{M}\p{N} &+.'-]*$/u);
const tagList = z.array(z.object({ tagId: z.number().int().nonnegative().optional(), tagName: name.optional() }).passthrough()).min(1).max(20);
const MAX_TOPICS = 30;
const id = z.coerce.number().int().positive().max(2147483647);

tagsRouter.get('/getAll', async (_req, res) => {
  const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } });
  res.json(tags.map(t => ({ id: t.id, tagName: t.name, description: 'tag' })));
});

tagsRouter.get('/place', async (_req, res) => {
  const places = await prisma.place.findMany({ orderBy: { name: 'asc' } });
  res.json(places.map(p => ({ id: p.id, placeName: p.name })));
});

tagsRouter.get('/getUserTags/:userId', requireAuth, async (req, res) => {
  const userId = id.safeParse(req.params.userId);
  if (!userId.success) return res.json([]);
  const uts = await prisma.userTag.findMany({ where: { userId: userId.data }, include: { tag: true } });
  res.json(uts.map(u => ({ tagId: u.tagId, userId: userId.data, tagName: u.tag.name })));
});

tagsRouter.get('/getUserPlaces/:userId', requireAuth, async (req, res) => {
  const userId = id.safeParse(req.params.userId);
  if (!userId.success) return res.json([]);
  const ups = await prisma.userPlace.findMany({ where: { userId: userId.data }, include: { place: true } });
  res.json(ups.map(u => ({ id: u.id, placeId: u.placeId, userId: userId.data, placeName: u.place.name })));
});

tagsRouter.get('/getUserPlaceTags/:userId', requireAuth, async (req, res) => {
  const userId = id.safeParse(req.params.userId);
  if (!userId.success) return res.json([]);
  const pts = await prisma.userPlaceTag.findMany({ where: { userId: userId.data }, include: { placeTag: true } });
  res.json(pts.map(p => ({ id: p.id, placeTagId: p.placeTagId, userId: userId.data, tagName: p.placeTag.name })));
});

tagsRouter.post('/addUserTags', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const parsed = tagList.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Topics are 2–40 letters or numbers' });
  if (parsed.data.some(t => containsBlockedContent(t.tagName))) return res.status(422).json({ message: 'That topic is not allowed', code: 'CONTENT_BLOCKED' });
  const current = await prisma.userTag.count({ where: { userId } });
  if (current + parsed.data.length > MAX_TOPICS) return res.status(400).json({ message: `You can have up to ${MAX_TOPICS} topics` });
  const added = [];
  for (const t of parsed.data) {
    let tag = t.tagId ? await prisma.tag.findUnique({ where: { id: t.tagId } }) : null;
    if (!tag && t.tagName) {
      const tagName = t.tagName.toLowerCase();
      tag = await prisma.tag.upsert({ where: { name: tagName }, update: {}, create: { name: tagName } });
    }
    if (!tag) continue;
    await prisma.userTag.upsert({ where: { userId_tagId: { userId, tagId: tag.id } }, update: {}, create: { userId, tagId: tag.id } });
    added.push({ tagId: tag.id, userId, tagName: tag.name });
  }
  res.json({ message: 'ok', tags: added });
});

tagsRouter.post('/addUserPlace', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const placeName = name.safeParse(req.body?.placeName);
  if (!placeName.success || containsBlockedContent(placeName.data)) return res.status(400).json({ message: 'Invalid place' });
  const place = await prisma.place.upsert({ where: { name: placeName.data }, update: {}, create: { name: placeName.data } });
  await prisma.userPlace.upsert({ where: { userId_placeId: { userId, placeId: place.id } }, update: {}, create: { userId, placeId: place.id } });
  res.json({ placeId: place.id, userId, placeName: place.name, name: place.name });
});

tagsRouter.post('/addUserPlaceTag', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const tagName = name.safeParse(req.body?.tagName);
  if (!tagName.success || containsBlockedContent(tagName.data)) return res.status(400).json({ message: 'Invalid tag' });
  const pt = await prisma.placeTag.upsert({ where: { name: tagName.data }, update: {}, create: { name: tagName.data } });
  await prisma.userPlaceTag.upsert({ where: { userId_placeTagId: { userId, placeTagId: pt.id } }, update: {}, create: { userId, placeTagId: pt.id } });
  res.json({ placeTagId: pt.id, userId, tagName: pt.name, name: pt.name });
});

tagsRouter.delete('/deleteUserPlace/:id', requireAuth, async (req: AuthRequest, res) => {
  const rowId = id.safeParse(req.params.id);
  if (rowId.success) await prisma.userPlace.deleteMany({ where: { id: rowId.data, userId: req.user!.userId } });
  res.json({ message: 'ok' });
});

tagsRouter.delete('/deleteUserPlaceTag/:id', requireAuth, async (req: AuthRequest, res) => {
  const rowId = id.safeParse(req.params.id);
  if (rowId.success) await prisma.userPlaceTag.deleteMany({ where: { id: rowId.data, userId: req.user!.userId } });
  res.json({ message: 'ok' });
});

tagsRouter.delete('/deleteUserTag/:userId/:tagId', requireAuth, async (req: AuthRequest, res) => {
  const tagId = id.safeParse(req.params.tagId);
  if (tagId.success) await prisma.userTag.deleteMany({ where: { userId: req.user!.userId, tagId: tagId.data } });
  res.json({ message: 'ok' });
});
