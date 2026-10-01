import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodTypeAny, z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Express 4 does not catch rejected promises; wrap every async handler. */
export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Validate and replace req.body / req.params / req.query with parsed values. */
export function validate<B extends ZodTypeAny = z.ZodAny, P extends ZodTypeAny = z.ZodAny>(schemas: {
  body?: B;
  params?: P;
  query?: ZodTypeAny;
}): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const idParam = (name: string) => z.object({ [name]: z.coerce.number().int().positive() });
