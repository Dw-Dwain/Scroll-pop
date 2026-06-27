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
| `INTERNAL_SECRET` | api | — | **Now required in production** — the API refuses to boot without it. Must match the Worker secret. |
| `LEAD_RETENTION_DAYS` | api | `395` (~13 mo) | Lead-PII retention window for the purge sweep. Set `0` to disable the age-based sweep (cascade-on-purge still runs). |
| `ANTIFARM_REQUIRE_VERIFIED_EMAIL` | api | `0` (off) | When `1`, the preHandler refuses to provision a **new** personal tenant unless the Clerk primary email is verified. See M-2 step below before enabling. |

> The worker per-IP rate limits reuse the **existing** `REDIS_URL` / `REDIS_TOKEN` worker secrets — no new worker config. They **fail open** if Redis is unreachable, so a Redis blip never drops legitimate traffic.

---

## Owner / infra actions still required

### H-1 — Activate Postgres RLS in production  ⚠️ do not skip the role step
The enforcing-RLS code is complete and ships disabled; it activates only when **both** env vars are
set. Enabling enforcement **without first creating the role** will break every query, so order
matters:

1. On `scrollpop-db-nrt2`, create the dedicated **NOBYPASSRLS** tenant role with a password
   (see `infra/db/RLS-ENABLEMENT-RUNBOOK.md` for the canonical SQL; role name defaults to
   `scrollpop_tenant`, override with `DB_TENANT_ROLE`).
2. Set the API secrets:
   - `DB_TENANT_URL` — a session-mode connection string that authenticates **as that tenant role**.
   - `DB_RLS_ENFORCED=true`
3. Deploy. On boot, `ensureRlsSchema()` installs `FORCE` policies + grants and logs
   `[rls] … enforcement active`. If the role is missing it logs and stays app-layer-only (safe).
4. Soak, then confirm cross-tenant reads are denied at the DB layer.

> `events` is a compressed hypertable and **cannot** take RLS — that is exactly why the new
> `events-tenant-scope` CI guard (H-1c) exists. App-layer filtering remains its only isolation, now
> enforced in CI.

### M-2 — Set `CLERK_AUTHORIZED_PARTIES`
Already supported by the code (unset = no `azp` restriction). Set it per environment to the
front-end origin(s), e.g.:
```
CLERK_AUTHORIZED_PARTIES=https://dashboard.scrollpop.online
```
(Add preview origins comma-separated if needed.)

### M-6 — Enable the anti-farming gate (after a login smoke test)
The gate is wired but **default-off** so it can't break sign-in. Before enabling:
1. Confirm your Clerk instance verifies email **before** issuing a session for email/password
   sign-ups (social logins are already pre-verified).
2. Set `ANTIFARM_REQUIRE_VERIFIED_EMAIL=1` on the API.
3. Smoke-test a fresh sign-up end-to-end. If a legitimate new user is 403'd with
   `EMAIL_NOT_VERIFIED`, set it back to `0` and revisit the Clerk verification flow.

The Clerk `user.created` webhook remains the authoritative provisioning path; the preHandler is the
gated fallback.
```
