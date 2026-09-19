import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { activeDatabaseUrl } from '../config/env.js';
import * as schema from './schema.js';

export const pool = new pg.Pool({
  connectionString: activeDatabaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
