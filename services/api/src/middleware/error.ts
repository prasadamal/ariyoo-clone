import { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ message: 'Not found' });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;
  if (err instanceof HttpError) return void res.status(err.status).json({ message: err.message });
  if (err instanceof ZodError) {
    return void res.status(400).json({
      message: 'Validation failed',
      errors: err.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
    });
  }
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return void res.status(status).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return void res.status(409).json({ message: 'Already exists' });
    if (err.code === 'P2025' || err.code === 'P2003') return void res.status(404).json({ message: 'Not found' });
  }
  if (err?.type === 'entity.parse.failed') return void res.status(400).json({ message: 'Malformed JSON body' });
  if (err?.type === 'entity.too.large') return void res.status(413).json({ message: 'Request body too large' });

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ message: 'Internal server error' });
};
