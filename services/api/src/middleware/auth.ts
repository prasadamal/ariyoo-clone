import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../prisma.js';

export interface AuthRequest extends Request {
  user?: { userId: number; email: string };
}

/** True while the account behind a token still exists and is not suspended. */
export async function isActiveAccount(userId: number): Promise<boolean> {
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { suspendedAt: true } });
  return !!account && !account.suspendedAt;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token' });
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
  // A token outlives the account by up to 7 days, so deleted and suspended members are checked here.
  if (!(await isActiveAccount(payload.userId))) return res.status(401).json({ message: 'Session ended' });
  req.user = { userId: payload.userId, email: payload.email };
  next();
}

export function verifyToken(token: unknown): { userId: number; email: string; exp: number } {
  if (typeof token !== 'string') throw new Error('Invalid token');
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  if (typeof payload === 'string' || !Number.isSafeInteger(payload.userId) || payload.userId <= 0 ||
      typeof payload.email !== 'string' || typeof payload.exp !== 'number') throw new Error('Invalid token');
  return { userId: payload.userId, email: payload.email, exp: payload.exp };
}

export function signToken(user: { id: number; email: string }): string {
  return jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
}
