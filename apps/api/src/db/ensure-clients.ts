import { sqlClient } from './client.js';

/**
 * Ensure the agency "clients" schema exists (multi-client / sub-account layer).
 *
 * A `client` is a workspace replica under an agency tenant — sites (and therefore their
 * campaigns/leads/analytics) are grouped by `client_id`. Agency operators switch the active
 * client in the dashboard; everything filters to it. RLS is enabled with a permissive policy
 * to match the rest of the schema (the API enforces tenant + client scoping at the service
 * layer — defence in depth). Additive + idempotent — safe on every boot.
 */
export async function ensureClientsSchema(
  log: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    await sqlClient.unsafe(`
      CREATE TABLE IF NOT EXISTS clients (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID NOT NULL,
        name        TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ,
        deleted_at  TIMESTAMPTZ
      );
      ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        CREATE POLICY clients_all_tenant_isolation ON clients USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      CREATE INDEX IF NOT EXISTS clients_tenant_idx ON clients (tenant_id, created_at DESC);
      -- A site optionally belongs to a client (NULL = agency-level / unassigned).
      ALTER TABLE sites ADD COLUMN IF NOT EXISTS client_id UUID;
      CREATE INDEX IF NOT EXISTS sites_client_idx ON sites (client_id);
    `);
    log.info('[schema] clients schema ensured (agency multi-client layer)');
  } catch (err) {
    log.error(err, '[schema] failed to ensure clients schema (continuing startup)');
  }
}
