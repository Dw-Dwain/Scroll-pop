import type { FastifyBaseLogger } from 'fastify';
import { sqlClient } from './client.js';

/**
 * Apply real, enforcing row-level-security policies (C-1). Idempotent — safe to run on every boot.
 * Only runs when DB_RLS_ENFORCED=true (the caller gates it), because FORCE RLS without the
 * per-request `app.current_tenant` GUC wiring would filter every row and take the app down.
 *
 * Each policy permits a row when EITHER:
 *   - the connection is a system/bypass connection (`app.bypass_rls = 'on'`, set at connect time on
 *     the system pool), OR
 *   - the row's tenant matches the request's `app.current_tenant` GUC (set per request on the
 *     tenant pool).
 *
 * `current_setting(name, true)` returns NULL when unset (missing_ok), so an unscoped connection
 * with neither GUC matches nothing — fail closed.
 */

// Tables with a `tenant_id` column → predicate on tenant_id.
const TENANT_ID_TABLES = [
  'sites', 'campaigns', 'designs', 'triggers', 'targeting_rules', 'frequency_rules',
  'events', 'leads', 'variants', 'clients', 'coupons', 'team_invites',
  'notifications', 'shopify_installations', 'tenant_members',
];

const PREDICATE = (col: string) =>
  `(coalesce(current_setting('app.bypass_rls', true), '') = 'on' ` +
  `OR ${col} = nullif(current_setting('app.current_tenant', true), '')::uuid)`;

export async function ensureRlsSchema(log: FastifyBaseLogger): Promise<void> {
  const sql = sqlClient;
  try {
    for (const table of TENANT_ID_TABLES) {
      const policy = `${table}_all_tenant_isolation`;
      await sql.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await sql.unsafe(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await sql.unsafe(`DROP POLICY IF EXISTS ${policy} ON ${table}`);
      await sql.unsafe(
        `CREATE POLICY ${policy} ON ${table} USING ${PREDICATE('tenant_id')} WITH CHECK ${PREDICATE('tenant_id')}`,
      );
    }

    // `tenants` keys on its own id, not tenant_id.
    await sql.unsafe(`ALTER TABLE tenants ENABLE ROW LEVEL SECURITY`);
    await sql.unsafe(`ALTER TABLE tenants FORCE ROW LEVEL SECURITY`);
    await sql.unsafe(`DROP POLICY IF EXISTS tenants_self_isolation ON tenants`);
    await sql.unsafe(
      `CREATE POLICY tenants_self_isolation ON tenants USING ${PREDICATE('id')} WITH CHECK ${PREDICATE('id')}`,
    );

    // `users` and `admin_audit_log` are intentionally NOT force-scoped: users is a global identity
    // table looked up by clerk id during the pre-tenant bootstrap, and admin_audit_log is
    // super-admin-only (accessed via the system/bypass pool). Leaving RLS off them keeps those
    // flows working; they carry no per-tenant business data a tenant could enumerate.

    log.info('[schema] RLS policies applied (FORCE enabled) — DB_RLS_ENFORCED=true');
  } catch (err) {
    // A failure here means the DB would be left half-forced. Surface loudly and rethrow so boot
    // fails visibly rather than silently serving with broken isolation.
    log.error({ err }, '[schema] FAILED to apply RLS policies — refusing to continue');
    throw err;
  }
}
