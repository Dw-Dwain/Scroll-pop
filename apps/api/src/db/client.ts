import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { AsyncLocalStorage } from 'node:async_hooks';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL environment variable is required');
}

// ─── C-1 runtime row-level security (corrected design, validated vs PG17+TimescaleDB) ───────────
//
// Validated against a real database (see the rationale below). Two fixes over the reverted attempt:
//   • TENANT pool connects as a dedicated NOBYPASSRLS role (DB_TENANT_URL), NOT the superuser —
//     superusers bypass RLS, so the first attempt enforced nothing.
//   • SYSTEM pool bypasses RLS by ROLE ATTRIBUTE (superuser), with NO `app.bypass_rls` startup
//     param (that param is what pgbouncer rejected). Policies are tenant-predicate ONLY (no GUC
//     bypass clause), so the tenant role can't escape by setting a GUC.
//
// Request wiring uses `AsyncLocalStorage.run(store, done)` from a callback-style onRequest hook
// (see tenant-context.ts): `enterWith` does NOT propagate across Fastify hooks, but run() wrapping
// the request continuation does. The store is mutated with the tenant connection once the tenant is
// resolved; the `db` proxy reads it.
//
// ACTIVE only when BOTH `DB_RLS_ENFORCED=true` AND `DB_TENANT_URL` is set. Everything FAILS OPEN
// (degrades to the system pool + app-layer tenant filtering) — it can never crash boot or a
// request. One-time role setup is in MASTER §RLS.
const DATABASE_URL = process.env['DATABASE_URL'];
const TENANT_URL = process.env['DB_TENANT_URL'];

let _rlsActive = process.env['DB_RLS_ENFORCED'] === 'true' && !!TENANT_URL;
// Surface the fail-open posture: in production with runtime RLS inactive, app-layer tenant_id
// filtering is the SOLE isolation layer (no DB backstop), so a single missed WHERE becomes a
// cross-tenant leak. Warn loudly so the gap is visible in logs — but do NOT change behavior here
// (enabling RLS requires the DB_TENANT_URL NOBYPASSRLS role to be provisioned first; see MASTER §RLS).
if (process.env['NODE_ENV'] === 'production' && !_rlsActive) {
  console.warn('[rls] runtime row-level security is NOT active (set DB_RLS_ENFORCED=true + DB_TENANT_URL after provisioning the tenant role) — tenant isolation currently relies on app-layer filtering only.');
}
export function rlsActive(): boolean { return _rlsActive; }
export function disableRls(reason: string): void {
  if (_rlsActive) console.error(`[rls] disabling runtime enforcement — falling back to app-layer only. Reason: ${reason}`);
  _rlsActive = false;
}

const POOL_OPTS = { max: 10, idle_timeout: 20, connect_timeout: 10, connection: { statement_timeout: 30_000 } };

// System/superuser pool — bypasses RLS by role attribute. No startup options param (pgbouncer-safe).
const systemClient = postgres(DATABASE_URL, POOL_OPTS);
// Tenant pool — dedicated NOBYPASSRLS role, session-mode. Only created when enforcement is active.
const tenantClient = _rlsActive && TENANT_URL ? postgres(TENANT_URL, POOL_OPTS) : null;

const systemDbInstance = drizzle(systemClient, { schema });
export type Database = PostgresJsDatabase<typeof schema>;

// Per-request mutable store. Established (empty) by the onRequest hook via run(); the preHandler
// sets `.db` to the tenant connection once the tenant is known. `db` proxy reads it.
type TenantStore = { db?: Database };
export const tenantScopeStorage = new AsyncLocalStorage<TenantStore>();

/**
 * The handle every route imports. Inside an authenticated request (enforcement active) it resolves
 * to that request's tenant-scoped connection; otherwise the system pool. Routes don't change.
 */
export const db: Database = new Proxy(systemDbInstance, {
  get(target, prop, receiver) {
    const active = (tenantScopeStorage.getStore()?.db ?? target) as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(active, prop, receiver);
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(active) : value;
  },
}) as unknown as Database;

/**
 * Explicit handle to the SYSTEM pool (RLS-bypassing). Use for code that legitimately crosses tenant
 * boundaries even inside an authenticated request — the super-admin console (reads all tenants) and
 * team-invite accept/decline/pending (reads an invite owned by a different tenant). Such code still
 * filters by tenantId/email at the app layer.
 */
export const systemDb = systemDbInstance;

/**
 * Reserve a tenant-pool connection and stamp it with `app.current_tenant`. Returns the tenant-scoped
 * drizzle handle + a `release` fn (the caller stores it and releases in onResponse). FAILS OPEN:
 * returns null on any error (request then uses the system pool; app-layer filtering still applies).
 */
export async function acquireTenantConnection(
  tenantId: string,
): Promise<{ db: Database; release: () => void } | null> {
  if (!_rlsActive || !tenantClient) return null;
  let reserved: Awaited<ReturnType<typeof tenantClient.reserve>> | null = null;
  try {
    reserved = await tenantClient.reserve();
    // A postgres-js ReservedSql is callable but lacks the `.options` (parsers/serializers) drizzle
    // reads off its client; borrow them from the parent pool. Queries still run on the pinned conn.
    (reserved as unknown as { options?: unknown }).options ??= (tenantClient as unknown as { options: unknown }).options;
    const tdb = drizzle(reserved as unknown as postgres.Sql, { schema });
    await tdb.execute(sql`select set_config('app.current_tenant', ${tenantId}, false)`);
    let released = false;
    const rsv = reserved;
    return { db: tdb, release: () => { if (!released) { released = true; rsv.release(); } } };
  } catch (err) {
    if (reserved) try { reserved.release(); } catch { /* ignore */ }
    console.error('[rls] acquireTenantConnection failed — request uses system pool:', err instanceof Error ? err.message : err);
    return null;
  }
}

// Raw postgres-js client (SYSTEM pool) — for maintenance DDL Drizzle can't express + ensure-rls.
export const sqlClient = systemClient;
