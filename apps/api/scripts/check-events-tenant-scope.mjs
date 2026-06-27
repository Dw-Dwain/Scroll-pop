#!/usr/bin/env node
/**
 * H-1c — CI guard: every read of the `events` table in the API must be tenant-scoped.
 *
 * WHY THIS EXISTS
 * The `events` table is a COMPRESSED TimescaleDB hypertable, and Postgres/TimescaleDB does not
 * support Row-Level Security on compressed hypertables (see db/ensure-rls.ts). So unlike every
 * other tenant table, `events` can NEVER get an RLS backstop — the service-layer
 * `WHERE tenant_id = …` predicate is the ONLY thing isolating one tenant's analytics from
 * another's. A single forgotten predicate on a `.from(events)` read is a silent cross-tenant data
 * leak with nothing behind it. This script fails the build if any `.from(events)` read isn't
 * tenant-scoped.
 *
 * HOW IT CHECKS (heuristic, but zero false positives on the current tree)
 * For each `.from(events)` occurrence it inspects the query chain (up to the terminating `;`) and
 * PASSES when any of:
 *   1. the chain references `events.tenantId` directly (the common inline `eq(events.tenantId, …)`
 *      / `and(eq(events.tenantId, …), …)` form), OR
 *   2. the chain calls `.where(<ident>)` with a precomputed predicate variable whose assignment
 *      somewhere in the same file references `events.tenantId`, OR
 *   3. the `.from(events)` line carries an explicit escape hatch comment:
 *        // events-tenant-scope-exempt: <reason>
 *      (use ONLY for a genuinely cross-tenant system/maintenance query, with a written reason).
 *
 * Inserts/updates/deletes are not matched — those carry an explicit tenantId in `.values()` /
 * `.where()` and aren't the cross-tenant *read* risk this guard targets.
 *
 * Run from the repo root: `node apps/api/scripts/check-events-tenant-scope.mjs`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'src');

/** Recursively collect non-test .ts files under a directory. */
function collect(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collect(full));
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

const FROM_EVENTS = /\.from\(\s*events\s*\)/g;
const IDENT = /\b([A-Za-z_$][\w$]*)\b/g;

const failures = [];

for (const file of collect(SRC)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  let m;
  FROM_EVENTS.lastIndex = 0;
  while ((m = FROM_EVENTS.exec(text)) !== null) {
    const idx = m.index;
    const lineNo = text.slice(0, idx).split('\n').length;
    const lineText = lines[lineNo - 1] ?? '';

    // Escape hatch (rule 3).
    if (/events-tenant-scope-exempt/.test(lineText)) continue;

    // Query chain = from the match up to the terminating semicolon (cap to avoid runaway).
    const semi = text.indexOf(';', idx);
    const chain = text.slice(idx, semi === -1 ? idx + 800 : semi);

    // Rule 1: direct reference (inline eq(events.tenantId, …) / and(eq(events.tenantId,…), …)).
    if (/events\.tenantId/.test(chain)) continue;

    // Rule 2: the chain passes a precomputed predicate variable — either `.where(scope)` or nested
    // like `.where(and(scope, …))`. Resolve EVERY identifier referenced in the chain and pass if any
    // of them is assigned a predicate that references events.tenantId somewhere in this file. The
    // assignment regex itself requires `events.tenantId` in the RHS, so unrelated identifiers (db,
    // sql, …) never match — only a genuine tenant-scoped predicate variable does.
    IDENT.lastIndex = 0;
    const idents = new Set();
    let im;
    while ((im = IDENT.exec(chain)) !== null) idents.add(im[1]);
    let scoped = false;
    for (const ident of idents) {
      const assignRe = new RegExp(`(?:const|let|var)\\s+${ident}\\s*=([\\s\\S]*?);`, 'g');
      let am;
      while ((am = assignRe.exec(text)) !== null) {
        if (/events\.tenantId/.test(am[1])) { scoped = true; break; }
      }
      if (scoped) break;
    }
    if (scoped) continue;

    failures.push(`${file}:${lineNo}  →  ${lineText.trim()}`);
  }
}

if (failures.length > 0) {
  console.error('❌ Un-tenant-scoped read(s) of the `events` table found.');
  console.error('   `events` is a compressed hypertable — it has NO RLS backstop, so every read');
  console.error('   MUST filter by events.tenantId (or carry an `events-tenant-scope-exempt` note).');
  console.error('');
  for (const f of failures) console.error('   ' + f);
  console.error('');
  process.exit(1);
}

console.log('✅ All `.from(events)` reads are tenant-scoped.');
