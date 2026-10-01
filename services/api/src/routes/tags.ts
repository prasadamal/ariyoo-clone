import { Router } from 'express';
import { Db } from '../prisma';
import { Config } from '../config';
import { makeRequireAuth, me } from '../middleware/auth';
import { HttpError, idParam, validate, wrap } from '../lib/http';
import { addUserPlaceBody, addUserPlaceTagBody, addUserTagsBody } from '../lib/schemas';

/** Reject any attempt to act on behalf of another user. A missing userId means "me". */
function assertSelf(req: Parameters<typeof me>[0], userId: number | undefined) {
  if (userId !== undefined && userId !== me(req)) throw new HttpError(403, 'Forbidden');
}

export function tagsRouter(db: Db, config: Config) {
  const r = Router();
  const requireAuth = makeRequireAuth(config.jwtSecret);

  // Public catalogues
  r.get('/getAll', wrap(async (_req, res) => {
    const tags = await db.tag.findMany({ orderBy: { name: 'asc' } });
    res.json(tags.map(t => ({ id: t.id, tagName: t.name, description: 'tag' })));
  }));

  r.get('/place', wrap(async (_req, res) => {
    const places = await db.place.findMany({ orderBy: { name: 'asc' } });
    res.json(places.map(p => ({ id: p.id, placeName: p.name })));
  }));

  // Per-user data: only the owner can read or modify it.
  r.get('/getUserTags/:userId', requireAuth, validate({ params: idParam('userId') }), wrap(async (req, res) => {
    const userId = Number(req.params.userId);
    assertSelf(req, userId);
    const uts = await db.userTag.findMany({ where: { userId }, include: { tag: true } });
    res.json(uts.map(u => ({ tagId: u.tagId, userId, tagName: u.tag.name })));
  }));

  r.get('/getUserPlaces/:userId', requireAuth, validate({ params: idParam('userId') }), wrap(async (req, res) => {
    const userId = Number(req.params.userId);
    assertSelf(req, userId);
    const ups = await db.userPlace.findMany({ where: { userId }, include: { place: true } });
    // `id` is the UserPlace row id, which is what deleteUserPlace expects.
    res.json(ups.map(u => ({ id: u.id, placeId: u.placeId, userId, placeName: u.place.name })));
  }));

  r.get('/getUserPlaceTags/:userId', requireAuth, validate({ params: idParam('userId') }), wrap(async (req, res) => {
    const userId = Number(req.params.userId);
    assertSelf(req, userId);
    const pts = await db.userPlaceTag.findMany({ where: { userId }, include: { placeTag: true } });
    res.json(pts.map(p => ({ id: p.id, placeTagId: p.placeTagId, userId, tagName: p.placeTag.name })));
  }));

  r.post('/addUserTags', requireAuth, validate({ body: addUserTagsBody }), wrap(async (req, res) => {
    const userId = me(req);
    for (const t of req.body as { tagId?: number; tagName?: string; userId?: number }[]) {
      assertSelf(req, t.userId);
      let tagId = t.tagId || undefined;
      if (tagId) {
        if (!(await db.tag.findUnique({ where: { id: tagId } }))) throw new HttpError(404, `Tag ${tagId} not found`);
      } else if (t.tagName) {
        tagId = (await db.tag.upsert({ where: { name: t.tagName.toLowerCase() }, update: {}, create: { name: t.tagName.toLowerCase() } })).id;
      } else throw new HttpError(400, 'tagId or tagName required');
      await db.userTag.upsert({ where: { userId_tagId: { userId, tagId } }, update: {}, create: { userId, tagId } });
    }
    res.json({ message: 'ok' });
  }));

  r.post('/addUserPlace', requireAuth, validate({ body: addUserPlaceBody }), wrap(async (req, res) => {
    const userId = me(req);
    assertSelf(req, req.body.userId);
    const place = await db.place.upsert({ where: { name: req.body.placeName }, update: {}, create: { name: req.body.placeName } });
    const up = await db.userPlace.upsert({ where: { userId_placeId: { userId, placeId: place.id } }, update: {}, create: { userId, placeId: place.id } });
    res.json({ id: up.id, placeId: place.id, userId, placeName: place.name, name: place.name });
  }));

  r.post('/addUserPlaceTag', requireAuth, validate({ body: addUserPlaceTagBody }), wrap(async (req, res) => {
    const userId = me(req);
    assertSelf(req, req.body.userId);
    const pt = await db.placeTag.upsert({ where: { name: req.body.tagName }, update: {}, create: { name: req.body.tagName } });
    const upt = await db.userPlaceTag.upsert({ where: { userId_placeTagId: { userId, placeTagId: pt.id } }, update: {}, create: { userId, placeTagId: pt.id } });
    res.json({ id: upt.id, placeTagId: pt.id, userId, tagName: pt.name, name: pt.name });
  }));

  // Deletes are scoped by userId so one user can never delete another's rows (deleteMany => idempotent).
  r.delete('/deleteUserPlace/:id', requireAuth, validate({ params: idParam('id') }), wrap(async (req, res) => {
    await db.userPlace.deleteMany({ where: { id: Number(req.params.id), userId: me(req) } });
    res.json({ message: 'ok' });
  }));

  r.delete('/deleteUserPlaceTag/:id', requireAuth, validate({ params: idParam('id') }), wrap(async (req, res) => {
    await db.userPlaceTag.deleteMany({ where: { id: Number(req.params.id), userId: me(req) } });
    res.json({ message: 'ok' });
  }));

  r.delete('/deleteUserTag/:userId/:tagId', requireAuth, validate({ params: idParam('userId').merge(idParam('tagId')) }), wrap(async (req, res) => {
    assertSelf(req, Number(req.params.userId));
    await db.userTag.deleteMany({ where: { userId: me(req), tagId: Number(req.params.tagId) } });
    res.json({ message: 'ok' });
  }));

  return r;
}
