import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { passwordResetAuthorizations, type PasswordResetAuthorization } from '../db/schema.js';
import { env } from '../config/env.js';
import { ERROR_CODES, badRequest } from '../utils/errors.js';
import { generateOpaqueToken, hashOpaqueToken } from './tokenService.js';

export type IssuedResetAuthorization = { token: string; expiresAt: Date };

/**
 * Minted only after a PASSWORD_RESET OTP has verified server-side. Possession of this
 * token is the sole thing that authorizes /password/reset -- the client cannot reach
 * that endpoint by navigating to /reset-password on its own.
 */
export const issueResetAuthorization = async (userId: string): Promise<IssuedResetAuthorization> => {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.RESET_TOKEN_TTL_SECONDS * 1000);

  await db.transaction(async (tx) => {
    // One live authorization per user: requesting a new one retires the old.
    await tx
      .update(passwordResetAuthorizations)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(passwordResetAuthorizations.userId, userId),
          isNull(passwordResetAuthorizations.consumedAt),
        ),
      );

    await tx.insert(passwordResetAuthorizations).values({
      userId,
      tokenHash: hashOpaqueToken(token),
      expiresAt,
    });
  });

  return { token, expiresAt };
};

/**
 * Atomically consumes a reset authorization.
 *
 * The single conditional UPDATE is what makes the token one-time-use: a replayed token
 * matches no row on the second attempt, even under concurrent requests.
 */
export const consumeResetAuthorization = async (
  token: string,
): Promise<PasswordResetAuthorization> => {
  const tokenHash = hashOpaqueToken(token);

  const consumed = await db
    .update(passwordResetAuthorizations)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(passwordResetAuthorizations.tokenHash, tokenHash),
        isNull(passwordResetAuthorizations.consumedAt),
        gt(passwordResetAuthorizations.expiresAt, new Date()),
      ),
    )
    .returning();

  const row = consumed[0];
  if (row) return row;

  // Distinguish "expired" from "never valid / already used" without leaking anything
  // else: an attacker guessing tokens learns nothing they did not already supply.
  const existing = await db
    .select()
    .from(passwordResetAuthorizations)
    .where(eq(passwordResetAuthorizations.tokenHash, tokenHash))
    .limit(1);

  const found = existing[0];
  if (found && !found.consumedAt && found.expiresAt <= new Date()) {
    throw badRequest(
      ERROR_CODES.RESET_TOKEN_EXPIRED,
      'This reset session has expired. Start again.',
    );
  }

  throw badRequest(
    ERROR_CODES.RESET_TOKEN_INVALID,
    'This reset session is no longer valid. Start again.',
  );
};

export const revokeResetAuthorizations = async (userId: string): Promise<void> => {
  await db
    .update(passwordResetAuthorizations)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(passwordResetAuthorizations.userId, userId),
        isNull(passwordResetAuthorizations.consumedAt),
      ),
    );
};
