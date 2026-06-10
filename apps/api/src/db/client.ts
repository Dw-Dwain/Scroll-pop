import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Connection pool. Single pool, RLS-bypassing by virtue of connecting as the table owner.
const client = postgres(process.env['DATABASE_URL'], {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  // Cap any single statement at 30s so a runaway/locked query can't hold a pooled connection
  // open indefinitely and starve the rest of the API. DDL run by drizzle-kit uses a separate
  // DIRECT_DATABASE_URL connection and is unaffected.
  connection: {
    statement_timeout: 30_000,
  },
});

export type Database = PostgresJsDatabase<typeof schema>;
export const db: Database = drizzle(client, { schema });

// Raw postgres-js client — exposed for maintenance DDL that Drizzle's query builder can't express
// (e.g. CREATE TABLE ... PARTITION OF for the events table).
export const sqlClient = client;

// ─── C-1 runtime row-level-security — DEFERRED ─────────────────────────────────
// A first cut shipped a two-pool + per-request `app.current_tenant` GUC design (June 11). It
// crash-looped on Fly's pooled connection: pgbouncer (in front of postgres-flex) rejects the
// `options` startup parameter used to set the bypass GUC and does not preserve session GUCs in
// transaction-pooling mode, so `ensureRlsSchema` couldn't get a usable connection and boot threw.
//
// Doing this correctly needs a SESSION-MODE / direct connection (DIRECT_DATABASE_URL, not the
// pgbouncer pooler) for the tenant pool, plus a BYPASSRLS/NOBYPASSRLS DB-role pair on scrollpop-db
// — infra that must be provisioned and tested before re-enabling. Until then these are inert
// no-ops so `DB_RLS_ENFORCED` can never crash the app, and `ensureRlsSchema` is never invoked.
// Tenant isolation remains enforced at the application layer (every query filters by request
// tenantId — verified consistent in the June 11 audit). Migration 0014_real_rls + ensure-rls.ts
// are retained as the artifact for the proper re-attempt. See MASTER §RLS.
export const rlsEnforced = false;

/** Always the system pool (alias of `db`). Cross-tenant flows (admin, team invites,
 *  notifications) import this so they read the right place once RLS is re-attempted. */
export const systemDb = db;

/** Inert until C-1 is re-attempted on a session-mode connection. Returns a noop release. */
export async function beginTenantScope(_tenantId: string): Promise<() => void> {
  return () => {};
}
