import crypto from 'node:crypto';

/**
 * Human-typeable invite code alphabet.
 *
 * Deliberately excludes the characters people confuse when reading a code off a
 * screen or a printed QR card: 0/O, 1/I/L, and the digit 8 vs B is kept because the
 * remaining set stays large enough (30 symbols -> ~29.1 bits over 6 characters).
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;

/**
 * Cryptographically secure invite code.
 *
 * Uses `crypto.randomInt` rather than `Math.random()`: an invite code grants access to
 * a group's full financial history, so it must not come from a predictable PRNG.
 */
export const generateInviteCode = (): string => {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return code;
};

/** Opaque, non-guessable share-link secret. 256 bits, URL-safe. */
export const generateInviteToken = (): string => crypto.randomBytes(32).toString('base64url');

/**
 * Normalizes user input before lookup, so "  abc-123 " and "ABC123" both resolve.
 * Hyphens and spaces are stripped because people naturally add them when reading aloud.
 */
export const normalizeInviteCode = (raw: string): string =>
  raw.trim().toUpperCase().replace(/[\s-]/g, '');

export const isPlausibleInviteCode = (raw: string): boolean => {
  const normalized = normalizeInviteCode(raw);
  return (
    normalized.length === CODE_LENGTH &&
    [...normalized].every((character) => ALPHABET.includes(character))
  );
};

export { CODE_LENGTH as INVITE_CODE_LENGTH };
