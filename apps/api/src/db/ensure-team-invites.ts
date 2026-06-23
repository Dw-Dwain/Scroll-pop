import { sqlClient } from './client.js';

/**
 * Ensure the agency "team_invites" schema exists (coupled-login layer).
 *
 * An agency owner invites an employee by verified email; on accept the employee gets a
 * tenant_members row on the agency tenant and shares its data. RLS is enabled with a
 * permissive policy to match the rest of the schema (the API enforces tenant + owner
 * scoping at the service layer — defence in depth). Additive + idempotent — safe on every boot.
 */
export async function ensureTeamInvitesSchema(
  log: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    await sqlClient.unsafe(`
      CREATE TABLE IF NOT EXISTS team_invites (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID NOT NULL,
        email               TEXT NOT NULL,
        role                member_role NOT NULL DEFAULT 'editor',
        status              TEXT NOT NULL DEFAULT 'pending',
        invited_by_user_id  UUID,
        accepted_user_id    UUID,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ,
        accepted_at         TIMESTAMPTZ,
        expires_at          TIMESTAMPTZ
      );
      -- Additive for tables that predate the column (CREATE TABLE IF NOT EXISTS skips existing).
      ALTER TABLE team_invites ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
      ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        CREATE POLICY team_invites_all_tenant_isolation ON team_invites USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      -- One live invite per (tenant, email). Re-inviting reuses the row (upsert in the route).
      CREATE UNIQUE INDEX IF NOT EXISTS team_invites_tenant_email_uniq ON team_invites (tenant_id, email);
      -- Fast lookup of a signed-in user's pending invites by their email.
      CREATE INDEX IF NOT EXISTS team_invites_email_status_idx ON team_invites (email, status);
    `);
    log.info('[schema] team_invites schema ensured (agency coupled-login layer)');
  } catch (err) {
    log.error(err, '[schema] failed to ensure team_invites schema (continuing startup)');
  }
}
