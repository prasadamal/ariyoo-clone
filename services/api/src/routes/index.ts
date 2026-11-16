import { Express } from 'express';
import { authRouter } from './auth.js';
import { tagsRouter } from './tags.js';
import { messageRouter } from './message.js';
import { userRouter } from './user.js';
import { newsletterRouter } from './newsletter.js';

export function registerRoutes(app: Express) {
  app.use('/auth', authRouter);
  app.use('/api/Tags', tagsRouter);
  app.use('/api/Message', messageRouter);
  app.use('/api/user', userRouter);
  app.use('/api/newsletter', newsletterRouter);
}