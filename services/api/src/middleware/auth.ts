import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  userId: number;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function signToken(user: AuthUser, secret: string, expiresIn: string): string {
  return jwt.sign({ userId: user.userId, email: user.email }, secret, { algorithm: 'HS256', expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string, secret: string): AuthUser {
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  if (typeof payload.userId !== 'number' || typeof payload.email !== 'string') throw new Error('Malformed token');
  return { userId: payload.userId, email: payload.email };
}

export function makeRequireAuth(secret: string) {
  return function requireAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    const match = header && /^Bearer\s+(.+)$/i.exec(header);
    if (!match) return res.status(401).json({ message: 'Authentication required' });
    try {
      req.user = verifyToken(match[1], secret);
      return next();
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
}

/** The authenticated user id. Only call from handlers behind requireAuth. */
export function me(req: Request): number {
  if (!req.user) throw new Error('requireAuth missing on route');
  return req.user.userId;
}
