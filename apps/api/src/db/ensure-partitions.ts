import { sqlClient } from './client.js';

/**
 * Ensure monthly partitions exist for the `events` table.
 *
 * On Neon (production) the `events` table is NATIVELY range-partitioned by `ts`
 * (one partition per calendar month: events_YYYY_MM). PostgreSQL does NOT
 * auto-create partitions — an INSERT for a month with no matching partition is
 * silently DROPPED (no error), which has historically killed analytics at every
 * month rollover (see CONTRIBUTING.md / MASTER.md §25, v2 roadmap item 4a).
 *
 * This routine runs on API boot and creates the partitions for the current and
 * next calendar month, idempotently. It is a safe no-op anywhere the `events`
 * table is NOT range-partitioned (e.g. local Docker, where it is a TimescaleDB
 * hypertable or a plain table) — we detect partitioning first and bail out.
 */
export async function ensureEventPartitions(
  log: { info: (msg: string) => void; warn: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    // Ensure newer event_type enum values exist before any insert path needs them. ALTER TYPE
    // ADD VALUE is non-transactional, and IF NOT EXISTS makes it a safe idempotent no-op. Without
    // this, a 'trigger_blocked' insert (Journeys block telemetry) would be silently rejected.
    try {
      await sqlClient.unsafe(`ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'trigger_blocked'`);
    } catch (e) {
      log.warn(`[partitions] could not ensure event_type values (continuing): ${String(e)}`);
    }

    // Is `events` a RANGE-partitioned parent table? (relkind 'p' + range strategy 'r')
    const rows = await sqlClient<{ strategy: string }[]>`
      SELECT pt.partstrat AS strategy
      FROM pg_partitioned_table pt
      JOIN pg_class c ON c.oid = pt.partrelid
      WHERE c.relname = 'events'
    `;

    if (rows.length === 0 || rows[0]?.strategy !== 'r') {
      // Not range-partitioned (TimescaleDB hypertable / plain table). Nothing to do.
      log.info('[partitions] events table is not range-partitioned — skipping partition maintenance');
      return;
    }

    // Build partition specs for the current and next calendar month (UTC).
    const now = new Date();
    const specs = [0, 1].map((offset) => {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
      const yyyy = start.getUTCFullYear();
      const mm = String(start.getUTCMonth() + 1).padStart(2, '0');
      return {
        name: `events_${yyyy}_${mm}`,
        from: start.toISOString().slice(0, 10), // YYYY-MM-DD
        to: end.toISOString().slice(0, 10),
      };
    });

    for (const spec of specs) {
      // Identifiers are derived from dates (not user input), so interpolation is safe here.
      await sqlClient.unsafe(
        `CREATE TABLE IF NOT EXISTS ${spec.name} PARTITION OF events FOR VALUES FROM ('${spec.from}') TO ('${spec.to}')`,
      );
      log.info(`[partitions] ensured ${spec.name} (${spec.from} → ${spec.to})`);
    }
  } catch (err) {
    // Never block API startup on partition maintenance — log and continue.
    log.error(err, '[partitions] failed to ensure event partitions (continuing startup)');
  }
}
