import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { AsyncLocalStorage } from 'node:async_hooks';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Runtime row-level-security enforcement (C-1). OFF by default so the app behaves exactly as
// before until you deliberately enable it (and have applied 0014_real_rls.sql). When ON:
//  - tenant tables get FORCE RLS with policies keyed on `current_setting('app.current_tenant')`;
//  - each AUTHENTICATED request runs on a reserved connection from the TENANT pool with that GUC
//    set, so a query that forgets its tenant filter returns ZERO rows instead of leaking — the DB
//    is the backstop;
//  - SYSTEM / unauthenticated paths (webhooks, /e ingest, edge config, DDL, background jobs, and
//    the cross-tenant admin/team-invite flows) run on the SYSTEM pool, which sets
//    `app.bypass_rls = on` at connect time so the bypass clause in each policy lets them through.
//
// Two SEPARATE pools is deliberate: a single pool would leak the system bypass GUC onto reserved
// tenant connections (and vice-versa) because postgres-js doesn't reset session GUCs on release.
const DATABASE_URL = process.env['DATABASE_URL'];
export const rlsEnforced = process.env['DB_RLS_ENFORCED'] === 'true';

// ── System pool: bypasses RLS (startup `-c app.bypass_rls=on`). Used everywhere by default. ──
const systemClient = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  connection: {
    statement_timeout: 30_000,
    ...(rlsEnforced ? { options: '-c app.bypass_rls=on' } : {}),
  },
});

// ── Tenant pool: NO bypass. Connections are reserved per-request and stamped with the request's
//    `app.current_tenant`, so RLS policies constrain every query to that tenant. Only created when
//    enforcement is on. ──
const tenantClient = rlsEnforced
  ? postgres(DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      connection: { statement_timeout: 30_000 },
    })
  : null;

const systemDbInstance = drizzle(systemClient, { schema });
export type Database = PostgresJsDatabase<typeof schema>;

// Per-request store carrying the tenant-scoped drizzle instance.
type TenantStore = { db: Database };
const tenantAls = new AsyncLocalStorage<TenantStore>();

/**
 * The database handle every route imports. Transparent proxy: inside an authenticated request
 * (when RLS is enforced) it resolves to that request's tenant-scoped connection; everywhere else
 * it's the system pool. Routes don't change — `import { db }` keeps working.
 */
export const db: Database = new Proxy(systemDbInstance, {
  get(target, prop, receiver) {
    const active = (tenantAls.getStore()?.db ?? target) as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(active, prop, receiver);
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(active) : value;
  },
}) as unknown as Database;

/**
 * Explicit handle to the SYSTEM pool (RLS-bypassing). Use for code that legitimately crosses tenant
 * boundaries even inside an authenticated request: the super-admin console (reads all tenants) and
 * team-invite accept/decline/pending (reads an invite owned by a *different* tenant than the
 * accepting user's current one). Such code still filters by tenantId/email at the app layer.
 */
export const systemDb = systemDbInstance;

/**
 * Begin a tenant-scoped DB context for the current request (called from a Fastify preHandler).
 * Reserves a TENANT-pool connection, sets `app.current_tenant` on it, and binds it to the async
 * context via `enterWith` so the downstream handler's `db` usage is DB-enforced to this tenant.
 * Returns a `release` fn the caller MUST invoke in onResponse/onError. No-op (noop release) when
 * RLS isn't enforced, so there's zero overhead and zero behaviour change until you opt in.
 */
export async function beginTenantScope(tenantId: string): Promise<() => void> {
  if (!rlsEnforced || !tenantClient) return () => {};
  const reserved = await tenantClient.reserve();
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    reserved.release();
  };
  try {
    const tdb = drizzle(reserved as unknown as postgres.Sql, { schema });
    // Session-scoped set_config is safe: the connection is reserved to THIS request and released
    // when the response finishes. Re-assert bypass=off in case a prior occupant left it set.
    await tdb.execute(
      sql`select set_config('app.bypass_rls', 'off', false), set_config('app.current_tenant', ${tenantId}, false)`,
    );
    tenantAls.enterWith({ db: tdb });
    return release;
  } catch (err) {
    release();
    throw err;
  }
}

// Raw postgres-js client (SYSTEM pool) — exposed for maintenance DDL that Drizzle's query builder
// can't express (CREATE TABLE ... PARTITION OF, RLS policy DDL). Always RLS-bypassing.
export const sqlClient = systemClient;
