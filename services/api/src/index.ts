import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { Server } from 'socket.io';
import fs from 'fs';
import { config } from './config';
import { registerRoutes } from './routes';
import { attachIo } from './io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
attachIo(io);

fs.mkdirSync(config.uploadDir, { recursive: true });

app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '5mb' }));
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ariyoo-api' });
});
app.use('/uploads', express.static(path.join(process.cwd(), config.uploadDir)));

registerRoutes(app);

io.on('connection', socket => {
  socket.on('join', (sessionId: string) => {
    socket.join(`session-${sessionId}`);
  });
});

server.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});