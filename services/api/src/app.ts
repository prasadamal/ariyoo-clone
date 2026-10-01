import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { Db } from './prisma';
import { Config } from './config';
import { Publisher } from './realtime';
import { registerRoutes } from './routes';
import { errorHandler, notFound } from './middleware/error';

export interface AppDeps {
  db: Db;
  config: Config;
  publish?: Publisher;
}

export function createApp({ db, config, publish = () => {} }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // uploads are loaded cross-origin by web/mobile
  app.use(
    cors({
      origin: (origin, cb) => {
        // No Origin header = native app / curl / server-to-server: allowed (they are not browser-CORS bound).
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      maxAge: 600
    })
  );

  const limiter = (max: number) =>
    rateLimit({ windowMs: config.rateLimit.windowMs, max, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests, please try again later' } });

  // Health is registered before the rate limiter so orchestrator probes are never throttled.
  app.get('/health', async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'up', uptime: Math.round(process.uptime()) });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });
  app.get('/health/live', (_req, res) => void res.json({ status: 'ok' }));

  app.use(limiter(config.rateLimit.max));
  app.use(express.json({ limit: '100kb' }));
  app.use(
    '/uploads',
    express.static(path.resolve(config.uploadDir), {
      index: false,
      dotfiles: 'deny',
      setHeaders: res => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
      }
    })
  );

  registerRoutes(app, db, config, publish, { auth: limiter(config.rateLimit.authMax) });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
