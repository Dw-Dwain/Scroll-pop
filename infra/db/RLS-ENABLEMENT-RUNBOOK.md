# DB-level RLS Enablement on Fly — Operator Runbook (C-1)

> Status: code is built, validated, and **fail-safe**, but **not yet enabled in prod**. These are the
> exact, one-time steps an operator with Fly access must run. Claude can't execute them from here
> (no Fly credentials / live DB). Everything below is idempotent and reversible.
>
> The runtime model (already in `apps/api/src/db/client.ts`, `db/ensure-rls.ts`,
> `plugins/tenant-context.ts`): a **system pool** (superuser, bypasses RLS by role attribute) for
> cross-tenant code; a **tenant pool** that connects as a dedicated `NOBYPASSRLS` role on a
> **session-mode** connection and stamps `app.current_tenant` per request via `AsyncLocalStorage`.
> Policies are **tenant-predicate-only** (no GUC escape). Any setup/connection error degrades to
> app-layer-only filtering — it can never crash boot or a request.

## Pre-req: confirm the connection is session-mode (NOT the pooler)

RLS uses a per-connection GUC (`app.current_tenant`), so the tenant pool **must** use a session-mode
connection (real Postgres port **5432**), never a transaction-pooled pgbouncer port (6432). The first
C-1 attempt crash-looped precisely because pgbouncer rejected the startup param; the rebuilt model
sets the GUC with `set_config(..., false)` per reserved connection instead.

```bash
# Check what DATABASE_URL points at (should be the .flycast host on :5432, the direct port).
fly secrets list -a scrollpop-api          # names only; values are write-only
# If you need to inspect/confirm, connect directly:
fly postgres connect -a scrollpop-db       # psql as the superuser into scrollpop_api DB
```

`DATABASE_URL` (system pool) already targets `scrollpop-db.flycast:5432` (per MASTER June 10). The
new `DB_TENANT_URL` must use the **same host and port 5432**, only a different role.

## Step 1 — Create the dedicated tenant role (one-time, out-of-band)

Connect as superuser (`fly postgres connect -a scrollpop-db`) and run:

```sql
-- Strong password; store it in a secret manager. NOBYPASSRLS is the whole point — this role
-- MUST be subject to RLS (a superuser/ BYPASSRLS role would silently enforce nothing).
CREATE ROLE scrollpop_tenant LOGIN PASSWORD '<STRONG_RANDOM_PASSWORD>' NOBYPASSRLS;
-- (Re-runnable: if it already exists, ALTER ROLE scrollpop_tenant WITH PASSWORD '...';)
```

DML grants + policies are applied automatically by `ensureRlsSchema()` on the next boot — you do
**not** grant tables by hand. (If you want to verify the role first:
`SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname='scrollpop_tenant';` → `rolbypassrls` must
be `f`.)

## Step 2 — Set the Fly secrets

```bash
# Session-mode, same host as DATABASE_URL, port 5432, the new role. URL-encode the password.
fly secrets set -a scrollpop-api \
  DB_TENANT_URL='postgres://scrollpop_tenant:<ENCODED_PW>@scrollpop-db.flycast:5432/scrollpop_api?sslmode=disable' \
  DB_RLS_ENFORCED=true
# (Optional) DB_TENANT_ROLE defaults to scrollpop_tenant; set only if you used a different name.
```

Setting secrets triggers a rolling redeploy. Watch the logs:

```bash
fly logs -a scrollpop-api | grep -i rls
# Success:  [rls] policies applied (FORCE) + DML granted to "scrollpop_tenant" — enforcement active
# Fallback: [rls] ... — disabling enforcement, continuing app-layer-only   (boot still succeeds)
```

## Step 3 — Verify real tenant isolation on live request paths

With two tenants' Bearer tokens (A and B), confirm each only sees its own data. Hit the paths that
matter (each filters by `request.tenantId` at the app layer AND, now, at the DB layer):

```bash
API=https://scrollpop-api.fly.dev/api/v1
for path in me sites campaigns leads "analytics/overview" team notifications; do
  echo "== $path =="
  curl -s -H "Authorization: Bearer $TOKEN_A" "$API/$path" | head -c 300; echo
done
# Then repeat with $TOKEN_B and confirm the row sets are disjoint (no B rows under A, vice-versa).
```

Targeted DB-level proof (run as the tenant role, NOT the superuser):

```sql
-- As scrollpop_tenant, with the GUC unset, every FORCE-RLS table returns 0 rows:
SET ROLE scrollpop_tenant;
SELECT set_config('app.current_tenant', '', false);
SELECT count(*) FROM campaigns;            -- expect 0 (no tenant in scope)
SELECT set_config('app.current_tenant', '<TENANT_A_UUID>', false);
SELECT count(*) FROM campaigns;            -- expect only tenant A's campaigns
-- GUC-escape attempt must NOT widen the set (policies are predicate-only):
SELECT count(*) FROM campaigns WHERE tenant_id <> '<TENANT_A_UUID>';  -- expect 0
RESET ROLE;
```

### The `events` hypertable

`events` is a **compressed TimescaleDB hypertable**; Postgres/TimescaleDB rejects RLS on it
(`0A000`). It is intentionally **grant-only** (`GRANT_ONLY_TABLES=['events']`) and stays on
app-layer tenant filtering — every analytics/ops read filters by `request.tenantId`, ingest writes
via the system pool. This is by design (commit `a042e1e`), not a gap. Verify analytics still returns
only the caller's data (the `analytics/overview` curl above covers it).

## Rollback (safe, instant)

```bash
fly secrets unset -a scrollpop-api DB_RLS_ENFORCED
# Redeploys; tenant pool is never created; app runs app-layer-only (still tenant-isolated).
```

The installed policies/grants are harmless to leave in place (the superuser system pool bypasses
them by role attribute). To fully remove them, drop each `<table>_all_tenant_isolation` policy and
`ALTER TABLE <table> NO FORCE ROW LEVEL SECURITY`.

---

## Related data fix — `REPLACE-ME.png` placeholder leak (work item #5)

There is **no `REPLACE-ME.png` reference anywhere in source** (verified: grep of `apps/` +
`packages/` is clean). The 404-on-every-load leak called out in MASTER (June 10) lives in **stored
design config** for the gourmet C2 campaign — i.e. data, not code. Fix it in the DB once:

```sql
-- Find any design whose JSON config still references the placeholder:
SELECT d.id, c.name
FROM designs d JOIN campaigns c ON c.id = d.campaign_id
WHERE (d.config #>> '{}') ILIKE '%REPLACE-ME.png%' OR (d.config #>> '{}') ILIKE '%replace-me.png%';

-- Then either remove the offending image element in the dashboard builder (preferred — it re-saves
-- clean config), or null the src in place. Inspect the row first; do not blind-overwrite config.
```

(Per MASTER, `designs.config` may be a double-encoded JSON scalar — the `#>> '{}'` unwraps it.)
