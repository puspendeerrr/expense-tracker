import type { NextFunction, Request, Response } from 'express';
import { getEffectivePermissions } from '../services/permissionService.js';
import { ERROR_CODES, forbidden } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { PermissionKey } from '../auth/permissions.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Resolved once per request by `loadPermissions`, then read by the gates. */
      permissions?: Set<string>;
    }
  }
}

/**
 * Resolves the caller's effective permissions onto the request.
 *
 * Runs once, after the session is loaded, so a route that checks several capabilities
 * does not re-query. Anonymous requests get an empty set rather than an error: the
 * authentication gate is a separate concern and produces a clearer 401.
 */
export const loadPermissions = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.user) {
    req.permissions = new Set<string>();
    next();
    return;
  }

  try {
    const { permissions } = await getEffectivePermissions(req.user.id);
    req.permissions = new Set(permissions);
    next();
  } catch (error: unknown) {
    next(error);
  }
};

/** True when the request holds the capability. Safe to call without `loadPermissions`. */
export const hasPermission = (req: Request, permission: PermissionKey): boolean =>
  req.user?.role === 'admin' || req.permissions?.has(permission) === true;

/**
 * Gate for a single capability.
 *
 * Denials are logged with the key and the caller, because a request for something the
 * account cannot do is either a UI bug or someone probing, and both are worth seeing.
 */
export const requirePermission =
  (permission: PermissionKey) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (hasPermission(req, permission)) {
      next();
      return;
    }

    logger.warn('permission.denied', {
      userId: req.user?.id ?? 'anonymous',
      permission,
      path: req.path,
    });

    next(
      forbidden(
        ERROR_CODES.FORBIDDEN,
        'Your account does not have permission to do that.',
      ),
    );
  };
