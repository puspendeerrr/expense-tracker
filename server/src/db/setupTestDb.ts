/**
 * Creates and migrates the dedicated test database.
 *
 * Run before the suite (the `test` script does this automatically). Connects to the
 * maintenance `postgres` database to issue CREATE DATABASE, then applies every
 * migration to the fresh database.
 */
import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const testUrl = process.env.TEST_DATABASE_URL;
const devUrl = process.env.DATABASE_URL;

if (!testUrl) {
  console.error('[db:test] TEST_DATABASE_URL is not set. See .env.example.');
  process.exit(1);
}

if (testUrl === devUrl) {
  console.error('[db:test] TEST_DATABASE_URL must not equal DATABASE_URL.');
  process.exit(1);
}

const run = async (): Promise<void> => {
  const parsed = new URL(testUrl);
  const databaseName = parsed.pathname.replace(/^\//, '');

  if (!databaseName) {
    throw new Error('TEST_DATABASE_URL has no database name');
  }

  // Connect to the maintenance database to create the target if it is missing.
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();

  const existing = await admin.query('select 1 from pg_database where datname = $1', [
    databaseName,
  ]);

  if (existing.rowCount === 0) {
    // Identifier cannot be parameterised; quote it instead.
    await admin.query(`create database "${databaseName.replace(/"/g, '""')}"`);
    console.log(`[db:test] created database ${databaseName}`);
  }

  await admin.end();

  const pool = new pg.Pool({ connectionString: testUrl });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: './drizzle' });
  await pool.end();

  console.log(`[db:test] ${databaseName} is migrated and ready`);
};

run().catch((error: unknown) => {
  console.error('[db:test] setup failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
