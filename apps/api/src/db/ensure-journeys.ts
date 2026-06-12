import { sqlClient } from './client.js';

/**
 * Ensure the Journeys graph schema (migration 0015) exists. Runs on API boot, idempotently,
 * so a deploy that ships the Journeys engine never fails on a prod DB that hasn't had the
 * tables yet. Mirrors ensureVariantsSchema / ensureLeadsSchema.
 *
 * A Journey is a directed graph of NODES connected by EDGES:
 *   entry     — the trigger that starts the journey (scroll%, dwell, exit-intent, …)
 *   popup     — show a campaign (campaign_id); the visual is the campaign's design/variant
 *   delay     — wait N seconds (or until the next pageview) before advancing
 *   condition — branch on visitor state (returning, device, geo, already-converted, …)
 *   split     — random A/B branch; outgoing edges carry a weight in their config
 *   goal      — terminal node representing an objective (conversion / lead / click)
 *
 * EDGES carry the branch semantics in `branch`: 'always' | 'dismiss' | 'convert' | 'timeout'
 * | 'true' | 'false' | 'split'. A split edge's weight lives in edge.config.weight.
 *
 * RLS is applied HERE (self-contained) rather than via ensure-rls.ts's central TENANT_ID_TABLES
 * list ON PURPOSE: ensureRlsSchema() runs on EVERY boot and BEFORE the table-creating ensure-*
 * scripts, so listing a brand-new table there would make the first post-deploy boot's
 * `ALTER TABLE journeys …` throw → ensureRlsSchema returns false → RLS disabled globally for that
 * boot. Owning journeys RLS here (it runs after the tables are created, in the schema-version-gated
 * block) keeps enforcement continuous. Policy form is identical to ensure-rls.ts.
 */

const TENANT_ROLE = process.env['DB_TENANT_ROLE'] ?? 'scrollpop_tenant';
const pred = (col: string) =>
  `(${col} = nullif(current_setting('app.current_tenant', true), '')::uuid)`;

const JOURNEY_TABLES = ['journeys', 'journey_nodes', 'journey_edges'] as const;

export async function ensureJourneysSchema(
  log: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    // ── Enums (idempotent) ──────────────────────────────────────────────────────
    await sqlClient.unsafe(`
      DO $$ BEGIN
        CREATE TYPE journey_status AS ENUM ('draft', 'active', 'paused', 'archived');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE journey_node_type AS ENUM ('entry', 'popup', 'delay', 'condition', 'split', 'goal');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ── Tables ──────────────────────────────────────────────────────────────────
    await sqlClient.unsafe(`
      CREATE TABLE IF NOT EXISTS journeys (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id    UUID NOT NULL,
        site_id      UUID,
        name         TEXT NOT NULL,
        description  TEXT,
        status       journey_status NOT NULL DEFAULT 'draft',
        -- Journey-level active window (whole flow only arms between these). Evaluated in the
        -- visitor's local time by the snippet, mirroring per-campaign design.schedule.
        starts_at    TIMESTAMPTZ,
        ends_at      TIMESTAMPTZ,
        -- Compiled graph snapshot served to the snippet, written on publish (see compileJourney).
        compiled     JSONB NOT NULL DEFAULT '{}',
        version      INTEGER NOT NULL DEFAULT 1,
        published_at TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at   TIMESTAMPTZ
      );
      -- Self-heal for a journeys table created before the schedule columns existed.
      ALTER TABLE journeys ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
      ALTER TABLE journeys ADD COLUMN IF NOT EXISTS ends_at   TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS journey_nodes (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID NOT NULL,
        journey_id  UUID NOT NULL,
        type        journey_node_type NOT NULL,
        -- For 'popup' nodes: which campaign supplies the design/variant to show.
        campaign_id UUID,
        -- Node-specific settings: entry → { trigger:{type,value}, targeting? };
        -- delay → { seconds } | { untilNextPageview:true }; condition → { rule:{kind,operator,value} };
        -- split → {}; goal → { kind, label }.
        config      JSONB NOT NULL DEFAULT '{}',
        -- Canvas position persisted in the DB (NOT localStorage) so the graph is portable.
        pos_x       INTEGER NOT NULL DEFAULT 0,
        pos_y       INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS journey_edges (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id      UUID NOT NULL,
        journey_id     UUID NOT NULL,
        source_node_id UUID NOT NULL,
        target_node_id UUID NOT NULL,
        -- Branch semantics: which outcome of the source node follows this edge.
        branch         TEXT NOT NULL DEFAULT 'always',
        -- e.g. split weight: { weight: 50 }.
        config         JSONB NOT NULL DEFAULT '{}',
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS journeys_tenant_idx       ON journeys (tenant_id);
      CREATE INDEX IF NOT EXISTS journeys_site_idx         ON journeys (site_id);
      CREATE INDEX IF NOT EXISTS journey_nodes_journey_idx ON journey_nodes (journey_id);
      CREATE INDEX IF NOT EXISTS journey_edges_journey_idx ON journey_edges (journey_id);
      CREATE INDEX IF NOT EXISTS journey_edges_source_idx  ON journey_edges (source_node_id);
    `);

    // ── Row-level security (real tenant predicate, FORCE) ────────────────────────
    // Only attempt the GRANT when the dedicated tenant role exists (it won't in local dev);
    // the policy itself is harmless either way and the system pool (superuser) bypasses it.
    const role = await sqlClient.unsafe(
      `SELECT 1 FROM pg_roles WHERE rolname = '${TENANT_ROLE.replace(/'/g, "''")}'`,
    );
    const roleExists = role.length > 0;

    for (const table of JOURNEY_TABLES) {
      const policy = `${table}_all_tenant_isolation`;
      await sqlClient.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await sqlClient.unsafe(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await sqlClient.unsafe(`DROP POLICY IF EXISTS ${policy} ON ${table}`);
      await sqlClient.unsafe(
        `CREATE POLICY ${policy} ON ${table} USING ${pred('tenant_id')} WITH CHECK ${pred('tenant_id')}`,
      );
      if (roleExists) {
        await sqlClient.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${TENANT_ROLE}`);
      }
    }

    log.info('[schema] journeys schema ensured');
  } catch (err) {
    log.error(err, '[schema] failed to ensure journeys schema (continuing startup)');
  }
}
