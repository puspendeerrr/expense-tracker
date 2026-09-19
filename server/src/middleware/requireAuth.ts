import type { NextFunction, Request, Response } from 'express';
import type { User } from '../db/schema.js';
import { ERROR_CODES, unauthorized } from '../utils/errors.js';
import { SESSION_COOKIE, clearSessionCookie, resolveSession } from '../services/sessionService.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

const readToken = (req: Request): string | undefined => {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

/**
 * Attaches the session/user when a valid cookie is present, and otherwise does nothing.
 * `/api/auth/me` uses this so an anonymous visitor gets a clean 401 instead of an error.
 */
export const loadSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = readToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const resolved = await resolveSession(token);
    if (resolved && resolved.user.status === 'disabled') {
      // A disabled account is locked out immediately, not at next sign-in. Their live
      // sessions are revoked when they are disabled; this covers the race where a
      // request is already in flight, and any session created before that sweep.
      clearSessionCookie(res);
    } else if (resolved) {
      req.user = resolved.user;
      req.sessionId = resolved.sessionId;
    } else {
      // Stale or revoked cookie: clear it so the browser stops replaying it and the
      // SPA settles on "anonymous" instead of retrying forever.
      clearSessionCookie(res);
    }
  } catch (error: unknown) {
    next(error);
    return;
  }

  next();
};

/** The single gate for protected routes. */
export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(unauthorized(ERROR_CODES.UNAUTHENTICATED, 'You need to sign in to continue.'));
    return;
  }
  next();
};
