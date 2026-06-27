# Security Remediation — 2026-06-27

Implements the High/Medium findings from the full security assessment. This document records
**what shipped in code** and the **owner/infra actions still required** to fully activate two
findings that can only be completed outside the repo.

## Shipped in code (this branch)

| ID | Finding | Where |
|----|---------|-------|
| H-1b | `leads` RLS policy is now a real tenant predicate, never `USING(true)` | `apps/api/src/db/ensure-leads.ts` |
| H-1c | CI guard fails the build if any `.from(events)` read isn't tenant-scoped | `apps/api/scripts/check-events-tenant-scope.mjs`, `.github/workflows/ci.yml` (`events-tenant-scope` job, gates all deploys) |
| H-2 | `email_capture` marketing side-effects (auto-responder, ESP, webhook) gated on origin + consent + a **per-campaign daily send cap**; per-IP minute gate unchanged | `apps/api/src/index.ts` |
| H-3 | Global per-IP impression cap (origin) + per-IP rate limit on `/e` (worker) | `apps/api/src/index.ts`, `apps/worker/src/index.ts` |
| H-3b | Per-IP rate limit + negative-cache for unknown keys on `/c/:publicKey` (worker) | `apps/worker/src/index.ts` |
| H-4 | Lead-PII retention sweep + cascade-delete of leads when a campaign/site is purged | `apps/api/src/db/purge-deleted.ts` |
| H-4b | `DELETE /api/v1/leads?email=` — DSAR bulk erasure by email (tenant-scoped) | `apps/api/src/routes/leads.ts` |
| H-5 | Dockerfile drops to a non-root `app` user | `Dockerfile` |
| M-1 | Server-side consent enforcement: marketing dispatch honors an explicit consent decline | `apps/api/src/index.ts` |
| M-4 | `ci.yml` workflow token scoped to `contents: read` | `.github/workflows/ci.yml` |
| M-5 | Missing `INTERNAL_SECRET` is now **fatal at boot in production** (was a warning) | `apps/api/src/index.ts` |
| M-6 | Anti-farming gate: new-tenant provisioning can require a verified email (env-flagged, default OFF) | `apps/api/src/plugins/tenant-context.ts` |
| M-3 | All GitHub Actions pinned to commit SHAs (incl. the former `setup-flyctl@master`) | `.github/workflows/*.yml` |

### New / changed environment variables

| Variable | App | Default | Effect |
|----------|-----|---------|--------|
| `INTERNAL_SECRET` | api | — | **Now required in production** — the API refuses to boot without it. Must match the Worker secret. ✅ Confirmed already set on both API and Worker (2026-06-27). |
| `LEAD_RETENTION_DAYS` | api | `395` (~13 mo) | Lead-PII retention window for the purge sweep. Set `0` to disable the age-based sweep (cascade-on-purge still runs). |
| `ANTIFARM_REQUIRE_VERIFIED_EMAIL` | api | `0` (off) | When `1`, the preHandler refuses to provision a **new** personal tenant unless the Clerk primary email is verified. See M-6 step below before enabling. |

> The worker per-IP rate limits reuse the **existing** `REDIS_URL` / `REDIS_TOKEN` worker secrets — no new worker config. They **fail open** if Redis is unreachable, so a Redis blip never drops legitimate traffic.

---

## Owner / infra actions — status

### H-1 — Postgres RLS in production  ✅ VERIFIED ACTIVE (2026-06-27)
RLS is **already live and correct in production** — no action required. Verified on
`scrollpop-db-nrt2`:
- `campaigns`, `leads`, `sites`, `tenants` all have `relrowsecurity = t` **and**
  `relforcerowsecurity = t` (RLS enabled + FORCEd).
- The dedicated `scrollpop_tenant` role exists (NOBYPASSRLS, can log in).
- `DB_RLS_ENFORCED` and `DB_TENANT_URL` are both deployed.
- The system pool connects as `scrollpop_api`, which is a Postgres **superuser** (`rolsuper = t`),
  so it bypasses RLS by role attribute for the legitimately cross-tenant paths (ingest lead insert,
  super-admin console, invite accept/decline) — as the design intends. Tenant-scoped requests run on
  the `scrollpop_tenant` pool with the `app.current_tenant` GUC set per request.

> Do **not** downgrade `scrollpop_api` from superuser casually — the boot-time `ensure-*` routines
> run DDL (`ALTER TABLE` / `CREATE POLICY` / `GRANT`) through that connection.
>
> `events` is a compressed hypertable and **cannot** take RLS — that is exactly why the new
> `events-tenant-scope` CI guard (H-1c) exists. App-layer filtering remains its only isolation, now
> enforced in CI.

### M-2 — `CLERK_AUTHORIZED_PARTIES`  ✅ SET (2026-06-27)
Now set on the API to `https://dashboard.scrollpop.online`; the `azp` check is active. Code treats
unset as "no restriction", so this only ever tightens. If you sign in from another origin (e.g. a
Cloudflare Pages preview `*.scrollpop-dashboard.pages.dev`), add it comma-separated or those logins
will be rejected — do a login smoke test after the rollout.

### M-6 — Enable the anti-farming gate (OPTIONAL, after a login smoke test)
The only remaining *optional* toggle. The gate is wired but **default-off** so it can't break
sign-in. Before enabling:
1. Confirm your Clerk instance verifies email **before** issuing a session for email/password
   sign-ups (social logins are already pre-verified).
2. Set `ANTIFARM_REQUIRE_VERIFIED_EMAIL=1` on the API.
3. Smoke-test a fresh sign-up end-to-end. If a legitimate new user is 403'd with
   `EMAIL_NOT_VERIFIED`, set it back to `0` and revisit the Clerk verification flow.

The Clerk `user.created` webhook remains the authoritative provisioning path; the preHandler is the
gated fallback.
```
