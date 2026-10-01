import { Express } from 'express';
import { Db } from '../prisma';
import { Config } from '../config';
import { Publisher } from '../realtime';
import { authRouter } from './auth';
import { tagsRouter } from './tags';
import { messageRouter } from './message';
import { userRouter } from './user';
import { newsletterRouter } from './newsletter';

export function registerRoutes(app: Express, db: Db, config: Config, publish: Publisher, limits: { auth: any }) {
  app.use('/auth', limits.auth, authRouter(db, config));
  app.use('/api/Tags', tagsRouter(db, config));
  app.use('/api/Message', messageRouter(db, config, publish));
  app.use('/api/user', userRouter(db, config));
  app.use('/api/newsletter', limits.auth, newsletterRouter(db));
}
