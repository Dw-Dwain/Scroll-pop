-- DOWN: DROP INDEX IF EXISTS events_tenant_ts_idx;
-- Analytics queries filter by tenant_id within a time range. The events table is partitioned
-- by ts (month), but without a tenant_id index each query does a full chunk scan. This composite
-- index makes per-tenant analytics scale with tenant count. On a partitioned parent this creates
-- a partitioned index that cascades to every partition. See CTO-AUDIT P2-7.
-- (Non-CONCURRENT so it runs inside drizzle-kit's migration transaction; acceptable at current
-- data volume. If the table grows large, recreate CONCURRENTLY out-of-band.)

CREATE INDEX IF NOT EXISTS events_tenant_ts_idx ON events (tenant_id, ts DESC);
