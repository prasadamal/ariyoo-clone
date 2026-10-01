import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Db } from '../prisma';
import { Config } from '../config';
import { signToken, makeRequireAuth, me } from '../middleware/auth';
import { HttpError, validate, wrap } from '../lib/http';
import { loginBody, registerBody } from '../lib/schemas';

// Pre-computed hash so login takes similar time whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export function authRouter(db: Db, config: Config) {
  const r = Router();
  const requireAuth = makeRequireAuth(config.jwtSecret);

  r.post(
    '/register',
    validate({ body: registerBody }),
    wrap(async (req, res) => {
      const { email, password, flname, isSeeker, isSolver } = req.body;
      if (await db.user.findUnique({ where: { email } })) throw new HttpError(409, 'Email already exists');
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await db.user.create({ data: { email, passwordHash, fullName: flname, isSeeker, isSolver } });
      const token = signToken({ userId: user.id, email: user.email }, config.jwtSecret, config.jwtExpiresIn);
      res.status(201).json({ userId: user.id, email: user.email, fullName: user.fullName, isSeeker: user.isSeeker, isSolver: user.isSolver, token });
    })
  );

  r.post(
    '/login',
    validate({ body: loginBody }),
    wrap(async (req, res) => {
      const { email, password } = req.body;
      const user = await db.user.findUnique({ where: { email } });
      const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !ok) throw new HttpError(401, 'Invalid credentials');
      const token = signToken({ userId: user.id, email: user.email }, config.jwtSecret, config.jwtExpiresIn);
      res.json({ userId: user.id, email: user.email, fullName: user.fullName, isSeeker: user.isSeeker, isSolver: user.isSolver, token });
    })
  );

  r.get(
    '/me',
    requireAuth,
    wrap(async (req, res) => {
      const user = await db.user.findUnique({ where: { id: me(req) } });
      if (!user) throw new HttpError(401, 'User no longer exists');
      res.json({ userId: user.id, email: user.email, fullName: user.fullName, userName: user.userName, isSeeker: user.isSeeker, isSolver: user.isSolver });
    })
  );

  return r;
}
