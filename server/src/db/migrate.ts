import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';

/** Applies every pending migration in ./drizzle, then exits. */
const run = async () => {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[db] migrations applied');
  await pool.end();
};

run().catch((error: unknown) => {
  console.error('[db] migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
