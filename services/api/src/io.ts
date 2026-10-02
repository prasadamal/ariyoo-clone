import type { Server } from 'socket.io';

let io: Server | null = null;

export function attachIo(server: Server) {
  io = server;
}

export function emitSessionMessage(sessionId: number | string, payload: unknown) {
  io?.to(`session-${sessionId}`).emit('message', payload);
}
