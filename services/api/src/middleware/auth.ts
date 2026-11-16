import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AuthRequest extends Request {
  user?: { userId: number; email: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token' });
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  try {
    const payload = verifyToken(token);
    req.user = { userId: payload.userId, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}
export function verifyToken(token: unknown): { userId: number; email: string; exp: number } {
  if (typeof token !== 'string') throw new Error('Invalid token');
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  if (typeof payload === 'string' || !Number.isSafeInteger(payload.userId) || payload.userId <= 0 ||
      typeof payload.email !== 'string' || typeof payload.exp !== 'number') throw new Error('Invalid token');
  return { userId: payload.userId, email: payload.email, exp: payload.exp };
}
