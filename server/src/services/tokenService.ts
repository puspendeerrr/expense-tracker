import crypto from 'node:crypto';

/** 32 bytes of CSPRNG entropy, URL-safe. Used for session and reset tokens. */
export const generateOpaqueToken = (): string => crypto.randomBytes(32).toString('base64url');

/**
 * Tokens are high-entropy already, so a fast digest is the right primitive here --
 * bcrypt would only add latency without adding brute-force resistance.
 */
export const hashOpaqueToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');
