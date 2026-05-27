# ScrollPop V1 Data Model Patch Plan (Safe, Additive)

## Core Rule
- No destructive changes to existing tables/columns used by current build/runtime.
- Add new tables/indexes only; existing query paths remain valid.

## Existing Tables (unchanged)
- `campaigns`
- `designs`
- `triggers`
- `targeting_rules`
- `frequency_rules`
- `events`

## Additive Table 1: `insights`
Purpose: store generated recommendations and operational diagnostics.

```sql
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  campaign_id UUID,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high')),
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  impact_estimate NUMERIC(10,4),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','dismissed','resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX insights_tenant_created_idx ON insights (tenant_id, created_at DESC);
CREATE INDEX insights_campaign_idx ON insights (campaign_id);
```

## Additive Table 2: `experiments`
Purpose: variant testing metadata; does not replace existing campaign/design records.

```sql
CREATE TABLE experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  campaign_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','paused','completed')),
  allocation JSONB NOT NULL DEFAULT '{}',
  guardrails JSONB NOT NULL DEFAULT '{}',
  result JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX experiments_campaign_idx ON experiments (campaign_id, created_at DESC);
```

## Additive Table 3: `journey_actions`
Purpose: audit one-click optimization actions.

```sql
CREATE TABLE journey_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  campaign_id UUID NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user','ai')),
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX journey_actions_campaign_idx ON journey_actions (campaign_id, created_at DESC);
```

## Additive Extension in Existing `designs.config`
No schema migration required. Add optional JSON keys:
- `journeyMeta`
- `rulesBuilderV1`
- `mobileOverrides`
- `suppressionPolicy`

## Events Usage
- Keep existing events table for canonical telemetry.
- New event types stored in `metadata` or allowed via additive validation where needed.

## Backfill Plan
1. Create new tables.
2. No mandatory backfill required.
3. Optional async backfill:
- derive baseline campaign health snapshots
- derive initial insight rows from last 30 days

## Rollback Plan
- Disable flags.
- Keep additive tables (no runtime dependency once flags off).
- Existing serving paths continue untouched.

