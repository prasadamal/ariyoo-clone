import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { Db } from './prisma';
import { Config } from './config';
import { verifyToken } from './middleware/auth';

/** Called by REST handlers after a message is stored, to push it to the session room. */
export type Publisher = (sessionId: number, message: unknown) => void;

export const room = (sessionId: number) => `session-${sessionId}`;

export interface Realtime {
  io: Server | null;
  publish: Publisher;
}

/**
 * Socket.IO with JWT handshake auth and restricted CORS.
 * - Clients connect with `io(url, { auth: { token } })`.
 * - `join` only succeeds for sessions the user participates in.
 * - Clients cannot broadcast: messages are only emitted by the server after the REST write
 *   (so `senderId` can never be spoofed over the socket).
 */
export function attachRealtime(httpServer: HttpServer, db: Db, config: Config): Realtime {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, methods: ['GET', 'POST'] },
    maxHttpBufferSize: 1e5
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string') return next(new Error('unauthorized'));
    try {
      socket.data.user = verifyToken(token, config.jwtSecret);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', socket => {
    const userId: number = socket.data.user.userId;
    socket.on('join', async (sessionId: unknown, ack?: (r: { ok: boolean }) => void) => {
      const id = Number(sessionId);
      let ok = false;
      if (Number.isInteger(id) && id > 0) {
        const s = await db.session.findUnique({ where: { id } }).catch(() => null);
        if (s && (s.seekerId === userId || s.solverId === userId)) {
          await socket.join(room(id));
          ok = true;
        }
      }
      if (typeof ack === 'function') ack({ ok });
    });
    socket.on('leave', (sessionId: unknown) => {
      socket.leave(room(Number(sessionId)));
    });
  });

  return { io, publish: (sessionId, message) => void io.to(room(sessionId)).emit('message', message) };
}
