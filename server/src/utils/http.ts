import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Every successful response shares this envelope. */
export const sendOk = <T>(res: Response, data: T, status = 200): void => {
  res.status(status).json({ ok: true, data });
};

/** Wraps an async handler so rejected promises reach the error middleware. */
export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    handler(req, res, next).catch(next);
  };
