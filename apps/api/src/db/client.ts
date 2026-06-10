import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Connection pool (use pooler URL in production with Neon)
const client = postgres(process.env['DATABASE_URL'], {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  // Cap any single statement at 30s so a runaway/locked query can't hold a pooled connection
  // open indefinitely and starve the rest of the API (CTO-AUDIT P2-11). DDL run by drizzle-kit
  // uses a separate DIRECT_DATABASE_URL connection and is unaffected.
  connection: {
    statement_timeout: 30_000,
  },
});

export const db = drizzle(client, { schema });

// Raw postgres-js client — exposed for maintenance DDL that Drizzle's query
// builder can't express (e.g. CREATE TABLE ... PARTITION OF for the events table).
export const sqlClient = client;

export type Database = typeof db;
