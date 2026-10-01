import { Router } from 'express';
import { Db } from '../prisma';
import { validate, wrap } from '../lib/http';
import { newsletterBody } from '../lib/schemas';

export function newsletterRouter(db: Db) {
  const r = Router();
  // Idempotent and always answers "ok" so the endpoint cannot be used to enumerate subscribers.
  r.post('/', validate({ body: newsletterBody }), wrap(async (req, res) => {
    await db.newsletter.upsert({ where: { email: req.body.email }, update: {}, create: { email: req.body.email } });
    res.json({ message: 'ok' });
  }));
  return r;
}
