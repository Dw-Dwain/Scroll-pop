-- DOWN: see 0015_journeys.down.sql
-- Journeys: node-based multi-step flows (entry → popup → delay → condition → split → goal).
-- A directed graph of journey_nodes connected by journey_edges (which carry branch semantics).
-- Tenant-scoped with real FORCE RLS (current_setting('app.current_tenant')), matching 0014.
--
-- NOTE: the live schema is applied idempotently on boot by apps/api/src/db/ensure-journeys.ts
-- (the drizzle journal is frozen at 0006; ensure-*.ts is the real apply path). This file is the
-- canonical reviewable DDL + the down migration for parity with the rest of migrations/.

CREATE TYPE journey_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TYPE journey_node_type AS ENUM ('entry', 'popup', 'delay', 'condition', 'split', 'goal');

CREATE TABLE IF NOT EXISTS journeys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id      UUID REFERENCES sites(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  status       journey_status NOT NULL DEFAULT 'draft',
  starts_at    TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ,
  compiled     JSONB NOT NULL DEFAULT '{}',
  version      INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS journey_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  journey_id  UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  type        journey_node_type NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  config      JSONB NOT NULL DEFAULT '{}',
  pos_x       INTEGER NOT NULL DEFAULT 0,
  pos_y       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journey_edges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  journey_id     UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES journey_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES journey_nodes(id) ON DELETE CASCADE,
  branch         TEXT NOT NULL DEFAULT 'always',
  config         JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE journeys      ENABLE ROW LEVEL SECURITY;
ALTER TABLE journeys      FORCE  ROW LEVEL SECURITY;
ALTER TABLE journey_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_nodes FORCE  ROW LEVEL SECURITY;
ALTER TABLE journey_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_edges FORCE  ROW LEVEL SECURITY;

CREATE POLICY journeys_all_tenant_isolation ON journeys
  USING (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid);
CREATE POLICY journey_nodes_all_tenant_isolation ON journey_nodes
  USING (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid);
CREATE POLICY journey_edges_all_tenant_isolation ON journey_edges
  USING (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid);

CREATE INDEX IF NOT EXISTS journeys_tenant_idx       ON journeys (tenant_id);
CREATE INDEX IF NOT EXISTS journeys_site_idx         ON journeys (site_id);
CREATE INDEX IF NOT EXISTS journey_nodes_journey_idx ON journey_nodes (journey_id);
CREATE INDEX IF NOT EXISTS journey_edges_journey_idx ON journey_edges (journey_id);
CREATE INDEX IF NOT EXISTS journey_edges_source_idx  ON journey_edges (source_node_id);
