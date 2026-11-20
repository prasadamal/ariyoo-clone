import { Express } from 'express';
import { authRouter } from './auth.js';
import { tagsRouter } from './tags.js';
import { messageRouter } from './message.js';
import { libraryRouter } from './library.js';
import { userRouter } from './user.js';
import { newsletterRouter } from './newsletter.js';
import { safetyRouter } from './safety.js';
import { adminRouter } from './admin.js';

export function registerRoutes(app: Express) {
  app.use('/auth', authRouter);
  app.use('/api/Tags', tagsRouter);
  app.use('/api/Message', messageRouter);
  app.use('/api/library', libraryRouter);
  app.use('/api/user', userRouter);
  app.use('/api/newsletter', newsletterRouter);
  app.use('/api/safety', safetyRouter);
  app.use('/admin', adminRouter);
}