import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Db } from '../prisma';
import { Config } from '../config';
import { makeRequireAuth, me } from '../middleware/auth';
import { HttpError, idParam, validate, wrap } from '../lib/http';
import { postMessageBody, postQuestionBody, uploadImageBody } from '../lib/schemas';
import { scoreMatch } from '../utils/matching';
import { Publisher } from '../realtime';

const IMAGE_TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  'image/jpeg': { ext: '.jpg', magic: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: '.png', magic: b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/gif': { ext: '.gif', magic: b => b.subarray(0, 4).toString('ascii') === 'GIF8' },
  'image/webp': { ext: '.webp', magic: b => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' }
};

export async function getSessionForUser(db: Db, sessionId: number, userId: number) {
  const session = await db.session.findUnique({ where: { id: sessionId } });
  // 404 (not 403) for non-participants so session ids cannot be probed.
  if (!session || (session.seekerId !== userId && session.solverId !== userId)) throw new HttpError(404, 'Session not found');
  return session;
}

export function messageRouter(db: Db, config: Config, publish: Publisher) {
  const r = Router();
  const requireAuth = makeRequireAuth(config.jwtSecret);

  fs.mkdirSync(config.uploadDir, { recursive: true });
  const upload = multer({
    storage: multer.diskStorage({
      destination: config.uploadDir,
      // Server-generated name; never trust the client-supplied filename or extension.
      filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + (IMAGE_TYPES[file.mimetype]?.ext ?? '.bin'))
    }),
    limits: { fileSize: config.maxUploadBytes, files: 1 },
    fileFilter: (_req, file, cb) => (IMAGE_TYPES[file.mimetype] ? cb(null, true) : cb(new HttpError(415, 'Only JPEG, PNG, GIF or WebP images are allowed')))
  });

  r.post('/postQuestion', requireAuth, validate({ body: postQuestionBody }), wrap(async (req, res) => {
    const seekerId = me(req);
    const { message, tag } = req.body as { message: string; tag: { tagName: string }[] };
    const tags = tag.map(t => t.tagName);
    const solvers = await db.user.findMany({ where: { isSolver: true, id: { not: seekerId } }, include: { tags: { include: { tag: true } } } });
    const ranked = solvers
      .map(s => ({ solverId: s.id, score: scoreMatch(s.tags.map(t => t.tag.name), tags) }))
      .sort((a, b) => b.score - a.score || a.solverId - b.solverId);
    // If no other expert exists the session is assigned to the asker so the question is not lost.
    const solverId = ranked[0]?.solverId ?? seekerId;
    const session = await db.session.create({ data: { seekerId, solverId, title: message.slice(0, 80) } });
    const msg = await db.message.create({ data: { sessionId: session.id, senderId: seekerId, messageText: message } });
    publish(session.id, msg);
    res.status(201).json({ sessionId: session.id });
  }));

  const listSessions = (field: 'seekerId' | 'solverId') =>
    wrap(async (req, res) => {
      const userId = Number(req.params.userId);
      if (userId !== me(req)) throw new HttpError(403, 'Forbidden');
      const sessions = await db.session.findMany({ where: { [field]: userId }, orderBy: { updatedAt: 'desc' }, take: 200 });
      res.json(sessions.map(s => ({ sessionId: s.id, seekerId: s.seekerId, solverId: s.solverId, title: s.title, active: s.active, createdAt: s.createdAt })));
    });
  r.get('/getallsessionsseeker/:userId', requireAuth, validate({ params: idParam('userId') }), listSessions('seekerId'));
  r.get('/getallsessionssolver/:userId', requireAuth, validate({ params: idParam('userId') }), listSessions('solverId'));

  r.get('/getMessagesBySessionId/:sessionId', requireAuth, validate({ params: idParam('sessionId') }), wrap(async (req, res) => {
    const sessionId = Number(req.params.sessionId);
    await getSessionForUser(db, sessionId, me(req));
    res.json(await db.message.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' }, take: 1000 }));
  }));

  r.post('/postMessage', requireAuth, validate({ body: postMessageBody }), wrap(async (req, res) => {
    const { messageText, sessionId } = req.body;
    const session = await getSessionForUser(db, sessionId, me(req));
    if (!session.active) throw new HttpError(409, 'Session is closed');
    // senderId always comes from the token, never from the body.
    const msg = await db.message.create({ data: { senderId: me(req), messageText, sessionId } });
    await db.session.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
    publish(sessionId, msg);
    res.status(201).json(msg);
  }));

  r.post('/uploadImage', requireAuth, upload.single('image'), wrap(async (req, res) => {
    const file = req.file;
    const cleanup = () => file && fs.promises.unlink(file.path).catch(() => {});
    try {
      if (!file) throw new HttpError(400, 'No file');
      const { sessionId } = uploadImageBody.parse(req.body);
      const session = await getSessionForUser(db, sessionId, me(req));
      if (!session.active) throw new HttpError(409, 'Session is closed');
      // Verify actual content matches the declared image type.
      const head = Buffer.alloc(16);
      const fd = await fs.promises.open(file.path, 'r');
      await fd.read(head, 0, 16, 0);
      await fd.close();
      if (!IMAGE_TYPES[file.mimetype].magic(head)) throw new HttpError(415, 'File content is not a valid image');
      const msg = await db.message.create({ data: { senderId: me(req), sessionId, imageUrl: `/uploads/${path.basename(file.path)}` } });
      await db.session.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
      publish(sessionId, msg);
      res.status(201).json(msg);
    } catch (err) {
      await cleanup();
      throw err;
    }
  }));

  return r;
}
