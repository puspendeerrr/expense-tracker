import type { Request, Response } from 'express';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sessions, users, type User } from '../db/schema.js';
import { env, isProduction } from '../config/env.js';
import { generateOpaqueToken, hashOpaqueToken } from './tokenService.js';

export const SESSION_COOKIE = 'sw_session';

/**
 * Session cookie attributes.
 *
 * SameSite is configurable because it depends entirely on how the app is deployed.
 * Served from one origin, `lax` is the better default: it keeps the cookie on top-level
 * navigations while blocking cross-site form posts. Split across two sites -- a Vercel
 * frontend calling a Render API -- `lax` means the browser never sends the cookie at
 * all and every request looks signed-out, so `none` is required.
 *
 * `SameSite=None` is only honoured alongside `Secure`, so that combination is forced
 * rather than left to trip someone up in production.
 */
const cookieOptions = () => {
  const sameSite = env.COOKIE_SAMESITE ?? (isProduction ? 'none' : 'lax');

  return {
    httpOnly: true,
    sameSite,
    secure: isProduction || sameSite === 'none',
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
};

export type IssuedSession = { id: string; expiresAt: Date };

/**
 * Mints a session and sets the cookie. The raw token exists only in this function and
 * in the response header; the database only ever sees its SHA-256 hash.
 */
export const createSession = async (
  res: Response,
  userId: string,
  req: Request,
): Promise<IssuedSession> => {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_SECONDS * 1000);

  const inserted = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash: hashOpaqueToken(token),
      userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
      ipAddress: req.ip ?? null,
      expiresAt,
    })
    .returning({ id: sessions.id });

  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions(),
    maxAge: env.SESSION_TTL_SECONDS * 1000,
  });

  return { id: inserted[0]!.id, expiresAt };
};

export type ResolvedSession = { sessionId: string; user: User };

/** Resolves a raw cookie token to a live session + user, or undefined. */
export const resolveSession = async (token: string): Promise<ResolvedSession | undefined> => {
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashOpaqueToken(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return undefined;

  // Best-effort activity stamp; never block the request on it.
  void db
    .update(sessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(sessions.id, row.session.id))
    .catch(() => undefined);

  return { sessionId: row.session.id, user: row.user };
};

export const revokeSession = async (sessionId: string): Promise<void> => {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
};

/**
 * Revokes every session for a user, optionally sparing one.
 *
 * This is why sessions are server-side rather than stateless JWTs: a password reset
 * has to be able to kick out whoever else is holding a session.
 */
export const revokeAllSessionsForUser = async (
  userId: string,
  exceptSessionId?: string,
): Promise<void> => {
  const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
  if (exceptSessionId) conditions.push(ne(sessions.id, exceptSessionId));
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(...conditions));
};

export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
};
