import bcrypt from 'bcryptjs';

/** Matches the reference project's bcrypt approach, with a higher work factor. */
const SALT_ROUNDS = 12;

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, SALT_ROUNDS);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

/**
 * Constant-ish-cost dummy comparison used on the login path when no user exists,
 * so response timing does not reveal whether an account is present.
 */
const DUMMY_HASH = bcrypt.hashSync('splitwise-timing-equalizer', SALT_ROUNDS);

export const burnPasswordComparison = async (): Promise<void> => {
  await bcrypt.compare('splitwise-timing-equalizer', DUMMY_HASH);
};
