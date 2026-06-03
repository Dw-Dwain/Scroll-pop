# ScrollPop Infrastructure Risk Report

> **Date:** June 2026  
> **Scope:** Deployment pipeline, secrets management, database, edge infrastructure, CI/CD

---

## Architecture Overview

```
[Browser] → [Cloudflare Worker: edge.scrollpop.online]
               ├── KV cache (60s TTL, config payloads)
               ├── R2 (snippet bundle — not yet live)
               └── → [Render API: scroll-pop.onrender.com]
                        └── [Neon Postgres: main branch]
                        └── [Upstash Redis]

[Dashboard] → [Cloudflare Pages: dashboard.scrollpop.online]
               └── → [Render API]

Two GitHub repos:
  Dw-Dwain/Scroll-pop   → CF Worker auto-deploys via GitHub Actions
  dwain-coder/Scroll-pop → Render API auto-deploys on push to main
```

---

## Risk Findings

### INFRA-1 — Single Production Branch, No Staging Environment

**Severity: High**

There is no staging environment. All testing happens against a local dev server with demo-mode authentication. CI runs lint, typecheck, and unit tests, but the E2E suite runs against local mocked servers (`e2e/`), never against production infrastructure.

**Consequence:** A bug in an API route, a migration, or the Worker that only manifests against real Clerk JWTs, real Neon Postgres, or real Upstash Redis will reach production users immediately on merge.

**Risk factors:**
- Render auto-deploys on push to `dwain-coder/Scroll-pop` — no manual gate
- Database migrations run via `preDeployCommand` — a bad migration aborts the deploy (good) but doesn't roll back data already written
- No blue/green or canary deployment; traffic switches instantly

**Mitigation options (pick one):**
- Create a Neon branch for staging (`neon branch create --name staging`) + a second Render service pointing at it. Cost: ~$0 extra on Neon, ~$7/mo for a Render Starter instance.
- Alternatively, gate Render deploys behind a required manual approval step in GitHub Actions (free, just adds a `environment: production` protection rule with required reviewers).

### INFRA-2 — `dwain-coder/Scroll-pop` Has Force-Push Enabled on `main`

**Severity: High**

From `CONTRIBUTING.md`:
> `allow_force_pushes` is enabled on `dwain-coder/Scroll-pop` at the repo level, so `--force` works without touching branch protection settings.

This means the Render deployment repo's history can be rewritten at any time. A compromised `dwain-coder` GitHub account would allow an attacker to push arbitrary code to production without a PR review, CI check, or audit trail.

**Recommendations:**
1. Disable force-push on `dwain-coder/Scroll-pop:main`; use `git push --force-with-lease` only when genuinely needed and document why
2. Enable Render's deploy confirmation for production (Render dashboard → Settings → Deploy → Require confirmation)
3. Enable GitHub Actions on `dwain-coder/Scroll-pop` to require CI checks before Render accepts the deploy

### INFRA-3 — Two GitHub Accounts Managing One Production System

**Severity: Medium**

Deployments are split across two accounts (`Dw-Dwain` for CF Worker, `dwain-coder` for Render). Each account is a single point of failure for half of production. If either account's credentials are compromised or the account is suspended:
- `Dw-Dwain` compromised → attacker can push malicious Worker code to CDN
- `dwain-coder` compromised → attacker can push malicious API code to Render

**Recommendations:**
1. Enable GitHub 2FA (hardware key preferred) on both accounts
2. Enable GitHub's "Required 2FA for push" on both repos
3. Consider consolidating to one account or using a GitHub Organization (free tier) with deploy keys

### INFRA-4 — Render API Has No Request Authentication at the HTTP Layer

**Severity: Medium**

`scroll-pop.onrender.com` is publicly accessible on the internet. Authentication is enforced at the application layer (Clerk JWTs + `INTERNAL_SECRET`), but there is no network-level restriction (IP allowlist, mTLS, VPN) preventing someone from directly hitting the Render URL.

**Attack surface:** 
- Attempting to enumerate endpoints
- Brute-forcing the `INTERNAL_SECRET` header (mitigated by rate limiting, but the endpoint is still reachable)
- Direct access to the `/e` ingest endpoint from arbitrary IPs (rate limited at 500/min per IP)

**Recommendations:**
1. Add Render's "Private Service" network setting if available on the plan (restricts to Render's internal network)
2. Alternatively, use Cloudflare as a proxy in front of Render and allowlist only Cloudflare IP ranges in Render's environment
3. At minimum, ensure the Render URL is not advertised anywhere and all production traffic routes through Cloudflare's custom domain

### INFRA-5 — Database Migrations Have No Explicit Rollback Path

**Severity: Medium**

From `CONTRIBUTING.md`:
> Our migrations use `IF NOT EXISTS` / `ADD VALUE IF NOT EXISTS`, so re-running is safe/idempotent.

However, idempotent forward migrations are not the same as reversible migrations. The `CLAUDE.md` rule states "every database migration must be reversible (include a `down` migration)," but the actual migration files use Drizzle's auto-generated format which does not enforce down-migration presence.

If migration `0007` adds a column and deploys bad API code, rolling back the API binary is possible, but the new column remains in the database. If the previous API version fails on an unexpected column, recovery requires a manual `ALTER TABLE ... DROP COLUMN` in production.

**Recommendations:**
1. Enforce the CLAUDE.md rule: each migration file must include a `-- DOWN` comment with the reversal SQL
2. Test rollback of the last N migrations as part of the staging environment check
3. Document the exact SQL needed to revert each migration in `apps/api/drizzle/migrations/`

### INFRA-6 — Secrets Spread Across Four Systems With No Rotation Policy

**Severity: Medium**

Production secrets live in:
- Render → Environment (API secrets)
- Cloudflare Pages → Settings (dashboard `VITE_*` vars)
- Cloudflare Workers → Secrets (Worker secrets)
- GitHub Actions → Secrets (deploy tokens)

None of these have documented rotation schedules, and there is no automated secret rotation or expiration. If any of these secrets were logged, leaked in an error response, or captured from a compromised laptop, there is no process to detect this or know when rotation last occurred.

**Recommendations:**
1. Document a rotation checklist in `CONTRIBUTING.md` (e.g., "rotate secrets every 90 days")
2. Add `INTERNAL_SECRET` and `STRIPE_SECRET_KEY` to a password manager with a 90-day rotation reminder
3. Enable Render's secret change audit log (if available on your plan)
4. Enable GitHub's secret scanning (free for public repos, included in GitHub Advanced Security for private)

### INFRA-7 — Cloudflare KV Cache Key Has No Environment Prefix

**Severity: Low**

**File:** [`apps/worker/src/index.ts:80`](apps/worker/src/index.ts)

```typescript
const kvKey = `config:${publicKey}`;
```

If the same KV namespace were ever shared between dev and production workers (e.g., during a wrangler misconfiguration), a dev write could corrupt a production cache entry. Currently the KV namespace is production-only, but the key format provides no protection against accidental namespace sharing.

**Fix:** Add environment prefix to all KV keys: `config:prod:${publicKey}`.

### INFRA-8 — Render `preDeployCommand` Runs Against Production DB Without Dry-Run

**Severity: Low**

```yaml
preDeployCommand: pnpm --filter @scrollpop/api exec drizzle-kit migrate
```

Drizzle-kit migrate runs `IF NOT EXISTS` DDL directly against the production Neon database as part of every deploy. The benefit is zero-touch migration application; the risk is that a migration with a `DROP TABLE` or `ALTER TABLE ... DROP COLUMN` statement would execute automatically.

**Assessment:** The current migration files use only additive changes (`IF NOT EXISTS`). This risk is low today but will increase if the migration style changes.

**Recommendation:** Enable Drizzle's `verbose: true` and add a pre-migrate dry-run job that prints the pending SQL to CI logs without executing it, so a human can verify before merge.

### INFRA-9 — No Centralized Error Tracking in Worker

**Severity: Low**

The API has Sentry configured (`SENTRY_DSN` env var), but the Cloudflare Worker's `wrangler.toml` references `SENTRY_DSN` as a secret but there is no actual Sentry SDK integration in the Worker source (`apps/worker/src/index.ts`). Worker errors are `console.error()`-only, which surface in Cloudflare's Workers log but not in Sentry's alerting.

**Consequence:** A Worker panic (unhandled exception) that silently serves 500s will not trigger a PagerDuty/email alert.

**Fix:** Add `@sentry/cloudflare` SDK to the Worker and initialize it with the `SENTRY_DSN` secret.

---

## Deployment Safety Checklist

This is a reference checklist for every production deploy:

```
PRE-DEPLOY
[ ] All CI gates green (lint, typecheck, tests, snippet-size, no-history)
[ ] New migrations reviewed for reversibility
[ ] New env vars added to Render/CF Pages/CF Workers (not just .env.example)
[ ] INTERNAL_SECRET matches between Worker and API

DEPLOY
[ ] Merge PR to main (triggers CF Worker deploy + CF Pages deploy)
[ ] Run: git checkout main && git pull && pnpm run deploy (syncs dwain-coder)
[ ] Monitor Render deploy logs for preDeployCommand (migration) success
[ ] Monitor Cloudflare Workers logs for 5xx spike

POST-DEPLOY
[ ] Check /health on scroll-pop.onrender.com returns 200
[ ] Verify one active campaign loads from edge.scrollpop.online/c/:key
[ ] Check analytics dashboard for event ingest activity (5-10 min after deploy)

ROLLBACK (if needed)
Option A: git revert -m 1 <merge-commit> && push to main
Option B: Render → Manual Deploy → select previous deployment
Option C (Worker only): Cloudflare dashboard → Workers → Deployments → Roll back
```

---

## Summary Risk Matrix

| ID | Risk | Severity | Effort to Fix | Status |
|----|------|----------|---------------|--------|
| INFRA-1 | No staging environment | High | Medium | Open |
| INFRA-2 | Force-push enabled on deploy repo | High | Low | Open |
| INFRA-3 | Two GitHub accounts, no 2FA enforced | Medium | Low | Open |
| INFRA-4 | Render API publicly reachable | Medium | Medium | Accepted |
| INFRA-5 | No down-migrations enforced | Medium | Low | Open |
| INFRA-6 | No secret rotation policy | Medium | Low | Open |
| INFRA-7 | KV cache key no env prefix | Low | Trivial | Open |
| INFRA-8 | Migrations run without dry-run step | Low | Low | Open |
| INFRA-9 | No Sentry in Worker | Low | Low | Open |
