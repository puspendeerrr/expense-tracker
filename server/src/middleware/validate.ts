import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { AppError, ERROR_CODES, type FieldError } from '../utils/errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by `validateBody`. Handlers read this, never `req.body`. */
      validated?: unknown;
      /** Populated by `validateQuery`. */
      validatedQuery?: unknown;
    }
  }
}

/**
 * Single validation entry point for every route. Parsing (not just checking) means
 * handlers receive trimmed, normalized, correctly typed data and can never reach an
 * unvalidated field.
 */
export const validateBody =
  <T extends ZodTypeAny>(schema: T): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fields: FieldError[] = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'form',
        message: issue.message,
      }));
      next(
        new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Please check the highlighted fields.', {
          fields,
        }),
      );
      return;
    }

    req.validated = result.data;
    next();
  };

/** Typed accessor so handlers avoid casting at every call site. */
export const validated = <T extends ZodTypeAny>(req: Request, _schema: T): z.infer<T> =>
  req.validated as z.infer<T>;

/**
 * Query-string validation.
 *
 * Without this a schema failure in a handler surfaces as a raw ZodError and therefore a
 * 500, rather than the 400 + VALIDATION_ERROR envelope every other failure uses.
 */
export const validateQuery =
  <T extends ZodTypeAny>(schema: T): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const fields: FieldError[] = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'query',
        message: issue.message,
      }));
      next(
        new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Please check the request filters.', {
          fields,
        }),
      );
      return;
    }

    // Express 5 exposes `req.query` as a getter, so the parsed result is stashed
    // separately rather than assigned back over it.
    req.validatedQuery = result.data;
    next();
  };

/** Typed accessor for the parsed query. */
export const validatedQuery = <T extends ZodTypeAny>(req: Request, _schema: T): z.infer<T> =>
  req.validatedQuery as z.infer<T>;
