import 'express-async-errors';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { config } from './config.js';
import { registerRoutes } from './routes/index.js';
import { attachIo } from './io.js';
import { secureSockets } from './socket.js';
import { prisma } from './prisma.js';
import { requireAuth, AuthRequest } from './middleware/auth.js';

import { rateLimit } from 'express-rate-limit';

export function createServer() {
const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY || 0));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.corsOrigin } });
attachIo(io);

app.use(cors({ origin: config.corsOrigin }));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '200kb' }));
const limiter = (limit: number) => rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many requests. Try again in a few minutes.' } });
app.use('/auth', limiter(30));
app.use('/admin', limiter(120));
app.use('/api/newsletter', limiter(10));
app.use('/api/safety', limiter(60));
// Generous enough for a busy chat, low enough to stop scripted flooding.
app.use('/api', limiter(1500));
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ariyoo-api' });
});
app.get('/ready', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true }); }
  catch { res.status(503).json({ ok: false }); }
});
app.get('/uploads/:filename', requireAuth, async (req: AuthRequest, res) => {
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(req.params.filename)) return res.sendStatus(404);
  const message = await prisma.message.findFirst({ where: {
    imageUrl: `/uploads/${req.params.filename}`,
    session: { OR: [{ seekerId: req.user!.userId }, { solverId: req.user!.userId }] },
  }});
  if (!message) return res.sendStatus(404);
  const upload = await prisma.upload.findUnique({ where: { name: req.params.filename } });
  if (!upload) return res.sendStatus(404);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', upload.contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(Buffer.from(upload.data));
});

registerRoutes(app);

secureSockets(io);
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error.code === 'LIMIT_FILE_SIZE' || error.type === 'entity.too.large' ? 413 : error.code === 'P2002' ? 409 : error instanceof SyntaxError || error.name === 'MulterError' ? 400 : 500;
  res.status(status).json({ message: status === 413 ? 'Request exceeds the allowed size' : status === 409 ? 'Already exists' : status === 400 ? 'Invalid request' : 'Request failed' });
});


return { app, server, io };
}
