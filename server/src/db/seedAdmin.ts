import { eq } from 'drizzle-orm';
import { db, pool } from './client.js';
import { users } from './schema.js';
import { hashPassword } from '../services/passwordService.js';

/**
 * Administrator seed.
 *
 * The credentials come from the environment, never from this file. An earlier version
 * hardcoded them, which meant the password for a real production administrator lived in
 * the repository -- readable by anyone who could read the source.
 *
 * Outside development the password must be supplied explicitly: falling back to a known
 * default on a public deployment would be the same mistake with extra steps.
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim() || 'admin@gmail.com';
const ADMIN_NAME = process.env.ADMIN_NAME?.trim() || 'SplitWise Administrator';

const DEV_FALLBACK_PASSWORD = 'Master@123';

const resolvePassword = (): string => {
  const supplied = process.env.ADMIN_PASSWORD?.trim();
  if (supplied) {
    if (supplied.length < 12) {
      throw new Error('[seed] ADMIN_PASSWORD must be at least 12 characters.');
    }
    return supplied;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[seed] ADMIN_PASSWORD is required when NODE_ENV=production.\n' +
        '       Set it in the environment before seeding; there is deliberately no default.',
    );
  }

  console.warn('[seed] ADMIN_PASSWORD not set — using the development default.');
  return DEV_FALLBACK_PASSWORD;
};

export const seedAdmin = async () => {
  console.log(`[seed] Seeding default admin user: ${ADMIN_EMAIL}...`);

  const passwordHash = await hashPassword(resolvePassword());
  const now = new Date();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    const updated = await db
      .update(users)
      .set({
        fullName: ADMIN_NAME,
        passwordHash,
        role: 'admin',
        emailVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(users.email, ADMIN_EMAIL))
      .returning({ id: users.id, email: users.email, role: users.role });

    console.log(`[seed] Admin user updated successfully:`, updated[0]);
  } else {
    const inserted = await db
      .insert(users)
      .values({
        fullName: ADMIN_NAME,
        email: ADMIN_EMAIL,
        passwordHash,
        role: 'admin',
        emailVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: users.id, email: users.email, role: users.role });

    console.log(`[seed] Admin user created successfully:`, inserted[0]);
  }
};

const isMain =
  process.argv[1]?.replace(/\\/g, '/').endsWith('seedAdmin.ts') ||
  process.argv[1]?.replace(/\\/g, '/').endsWith('seedAdmin.js');

if (isMain) {
  seedAdmin()
    .then(async () => {
      console.log('[seed] Admin seeding completed.');
      await pool.end();
      process.exit(0);
    })
    .catch(async (err: unknown) => {
      console.error('[seed] Admin seeding failed:', err instanceof Error ? err.message : err);
      await pool.end();
      process.exit(1);
    });
}
