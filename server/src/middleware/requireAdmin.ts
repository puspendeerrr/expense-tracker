import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES, forbidden } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Platform administrator gate.
 *
 * The role lives on the user row and is never client-supplied, so this is a simple
 * check against the already-resolved session. Every rejection is logged because an
 * attempt to reach the admin surface without the role is worth noticing.
 */
export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    logger.warn('admin.access_denied', {
      userId: req.user?.id ?? 'anonymous',
      path: req.path,
    });
    next(forbidden(ERROR_CODES.FORBIDDEN, 'Administrator access is required.'));
    return;
  }
  next();
};
