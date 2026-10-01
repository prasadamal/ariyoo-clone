import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Db } from '../prisma';
import { Config } from '../config';
import { makeRequireAuth, me } from '../middleware/auth';
import { HttpError, validate, wrap } from '../lib/http';
import { updatePasswordBody, updateUserBody } from '../lib/schemas';

export function userRouter(db: Db, config: Config) {
  const r = Router();
  const requireAuth = makeRequireAuth(config.jwtSecret);

  // Updates the *authenticated* user. A body `id` is accepted for client compatibility but must match the token.
  r.put('/', requireAuth, validate({ body: updateUserBody }), wrap(async (req, res) => {
    const { id, fullName, userName, isSolver } = req.body;
    if (id !== undefined && id !== me(req)) throw new HttpError(403, 'Forbidden');
    const user = await db.user.update({ where: { id: me(req) }, data: { fullName, userName, isSolver } });
    // Never return passwordHash.
    res.json({ userId: user.id, email: user.email, fullName: user.fullName, userName: user.userName, isSeeker: user.isSeeker, isSolver: user.isSolver });
  }));

  r.put('/updatepassword', requireAuth, validate({ body: updatePasswordBody }), wrap(async (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;
    if (userId !== undefined && userId !== me(req)) throw new HttpError(403, 'Forbidden');
    const user = await db.user.findUnique({ where: { id: me(req) } });
    if (!user || !(await bcrypt.compare(oldPassword, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
    res.json({ message: 'Password updated' });
  }));

  return r;
}
