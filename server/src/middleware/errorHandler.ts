import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, ERROR_CODES } from '../utils/errors.js';
import { isProduction } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    ok: false,
    error: { code: ERROR_CODES.NOT_FOUND, message: `No route for ${req.method} ${req.path}` },
  });
};

type BodyParserError = Error & { type?: string; status?: number };

/**
 * Terminal error middleware. Every response leaves through here, so the error shape
 * `{ ok:false, error:{ code, message, fields?, details? } }` is guaranteed.
 */
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    if (err.details?.retryAfterSeconds) {
      res.setHeader('Retry-After', String(err.details.retryAfterSeconds));
    }
    res.status(err.status).json({
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  /**
   * Safety net for a Zod schema parsed outside the validation middleware. Without this
   * such a failure escapes as a 500, which is both wrong and leaks internals.
   */
  if (err instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Please check the submitted values.',
        fields: err.issues.map((issue) => ({
          field: issue.path.join('.') || 'form',
          message: issue.message,
        })),
      },
    });
    return;
  }

  const parserError = err as BodyParserError;

  if (parserError?.type === 'entity.too.large') {
    res.status(413).json({
      ok: false,
      error: { code: ERROR_CODES.PAYLOAD_TOO_LARGE, message: 'Request body is too large.' },
    });
    return;
  }

  if (parserError?.type === 'entity.parse.failed') {
    res.status(400).json({
      ok: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Request body is not valid JSON.' },
    });
    return;
  }

  logger.error('request.unhandled', {
    method: req.method,
    path: req.path,
    reason: parserError instanceof Error ? parserError.message : 'unknown error',
  });

  // Never surface stack traces or driver messages to a client in production.
  res.status(500).json({
    ok: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'Something went wrong on our end. Please try again.',
      ...(isProduction
        ? {}
        : { details: { reason: parserError instanceof Error ? parserError.message : 'unknown' } }),
    },
  });
};
