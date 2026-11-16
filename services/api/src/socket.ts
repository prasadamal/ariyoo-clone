import type { Server } from 'socket.io';
import { verifyToken } from './middleware/auth.js';
import { prisma } from './prisma.js';

export function secureSockets(io: Server) {
  io.use((socket, next) => {
    try {
      socket.data.user = verifyToken(socket.handshake.auth?.token);
      next();
    } catch { next(new Error('Unauthorized')); }
  });
  io.on('connection', socket => {
    // Connections must not outlive the token used at their handshake.
    const timer = setTimeout(() => socket.disconnect(true),
      Math.min(2_147_483_647, Math.max(0, socket.data.user.exp * 1000 - Date.now())));
    timer.unref();
    socket.on('disconnect', () => clearTimeout(timer));
    socket.on('join', async (raw: unknown, ack?: (reply: { ok: boolean }) => void) => {
      const reply = (ok: boolean) => { if (typeof ack === 'function') ack({ ok }); };
      const id = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw;
      if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return reply(false);
      try {
        const user = verifyToken(socket.handshake.auth?.token);
        const session = await prisma.session.findFirst({
          where: { id, OR: [{ seekerId: user.userId }, { solverId: user.userId }] }, select: { id: true },
        });
        if (!session || !socket.connected) return reply(false);
        await socket.join(`session-${id}`);
        reply(true);
      } catch { reply(false); }
    });
  });
}
