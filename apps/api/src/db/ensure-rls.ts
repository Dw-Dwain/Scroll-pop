import type { FastifyBaseLogger } from 'fastify';
import { sqlClient } from './client.js';

/**
 * Apply enforcing row-level security (C-1), idempotently, as the superuser/system role.
 *
 * Policies are TENANT-PREDICATE ONLY (no GUC bypass clause) so the NOBYPASSRLS tenant role can't
 * escape by setting a GUC. System paths bypass via the superuser role attribute, not a policy
 * clause. The dedicated tenant role (DB_TENANT_ROLE, default `scrollpop_tenant`) is granted DML on
 * every tenant table so it can read/write its own rows under RLS.
 *
 * Returns true on success, false on any failure (caller then disables enforcement and the app runs
 * app-layer-only — never crashes). The tenant ROLE itself must be created out-of-band with a
 * password (see MASTER §RLS); this only grants to it + installs policies.
 */

const TENANT_ID_TABLES = [
  'sites', 'campaigns', 'designs', 'triggers', 'targeting_rules', 'frequency_rules',
  'events', 'leads', 'variants', 'clients', 'coupons', 'team_invites',
  'notifications', 'shopify_installations', 'tenant_members',
];

const TENANT_ROLE = process.env['DB_TENANT_ROLE'] ?? 'scrollpop_tenant';

const pred = (col: string) => `(${col} = nullif(current_setting('app.current_tenant', true), '')::uuid)`;

export async function ensureRlsSchema(log: FastifyBaseLogger): Promise<boolean> {
  const sql = sqlClient;
  try {
    // Confirm the dedicated tenant role exists before doing anything else.
    const role = await sql.unsafe(
      `SELECT 1 FROM pg_roles WHERE rolname = '${TENANT_ROLE.replace(/'/g, "''")}'`,
    );
    if (role.length === 0) {
      log.error(`[rls] role "${TENANT_ROLE}" does not exist — create it first (see MASTER §RLS). Skipping RLS.`);
      return false;
    }

    await sql.unsafe(`GRANT USAGE ON SCHEMA public TO ${TENANT_ROLE}`);

    for (const table of TENANT_ID_TABLES) {
      const policy = `${table}_all_tenant_isolation`;
      await sql.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${TENANT_ROLE}`);
      await sql.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await sql.unsafe(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await sql.unsafe(`DROP POLICY IF EXISTS ${policy} ON ${table}`);
      await sql.unsafe(`CREATE POLICY ${policy} ON ${table} USING ${pred('tenant_id')} WITH CHECK ${pred('tenant_id')}`);
    }

    // tenants keys on its own id.
    await sql.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON tenants TO ${TENANT_ROLE}`);
    await sql.unsafe(`ALTER TABLE tenants ENABLE ROW LEVEL SECURITY`);
    await sql.unsafe(`ALTER TABLE tenants FORCE ROW LEVEL SECURITY`);
    await sql.unsafe(`DROP POLICY IF EXISTS tenants_self_isolation ON tenants`);
    await sql.unsafe(`CREATE POLICY tenants_self_isolation ON tenants USING ${pred('id')} WITH CHECK ${pred('id')}`);

    // `users` and `admin_audit_log` are intentionally NOT force-scoped (global identity table /
    // super-admin-only, both accessed via the system pool).

    log.info(`[rls] policies applied (FORCE) + DML granted to "${TENANT_ROLE}" — enforcement active`);
    return true;
  } catch (err) {
    log.error({ err }, '[rls] FAILED to apply RLS policies — disabling enforcement, continuing app-layer-only');
    return false;
  }
}
