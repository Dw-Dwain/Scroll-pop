# ScrollPop — CTO Due Diligence Report

> **Scope:** Competitive analysis vs. Promolayer + full security, architecture, scalability, and operational audit.
> **Date:** June 4, 2026
> **Basis:** Live Promolayer web sources (fetched June 4 2026) + full ScrollPop codebase.
> **Roles:** Senior SaaS Architect · Principal Security Engineer · Senior Product Designer · Performance Engineer · Ethical Hacker / Red Team Auditor
> **Evidence key:** ✅ Verified in code/source · ⚠️ Likely based on architecture · ❓ Assumed/unverifiable

---

## Table of Contents

1. [Phase 1 — Competitor Feature Matrix](#phase-1--competitor-feature-matrix)
2. [Phase 2 — UI/UX Review](#phase-2--uiux-review)
3. [Phase 3 — Performance Review](#phase-3--performance-review)
4. [Phase 4 — Security Audit](#phase-4--security-audit)
5. [Phase 5 — Adversarial Thinking](#phase-5--adversarial-thinking)
6. [Phase 6 — Scale Readiness](#phase-6--scale-readiness)
7. [Phase 7 — Codebase Health](#phase-7--codebase-health)
8. [Phase 8 — Executive Report](#phase-8--executive-report)

---

## Phase 1 — Competitor Feature Matrix

### Pricing Comparison

| Tier | Promolayer | ScrollPop | Advantage |
|---|---|---|---|
| Free | 1,000 views | 1,000 views | Tie |
| Entry paid | $25 / 15,000 views | $19 / 25,000 views | **ScrollPop +67% views, −$6/mo** |
| Mid | $70 / 100,000 views | $49 / 150,000 views | **ScrollPop +50% views, −$21/mo** |
| Growth | $150 / 300,000 views | $129 / 500,000 views | **ScrollPop +67% views, −$21/mo** |
| Scale | $320 / 1,000,000 views | $299 / 2,000,000 views | **ScrollPop +100% views, −$21/mo** |

**Verified finding:** ScrollPop delivers approximately 2× the views per dollar at every paid tier. This is a structural pricing advantage.

---

### Core Feature Matrix

| Feature | Promolayer | ScrollPop | Gap | Priority |
|---|---|---|---|---|
| Modal / fullscreen / slide-in / bar | ✅ | ✅ | Tie | — |
| Gamified popups (spin-to-win) | ✅ claims 300% more submissions | ❌ removed Jun 3 2026 | Promolayer wins | High |
| Countdown timers | ✅ native | ❌ not built | Promolayer wins | High |
| Exit intent | ✅ | ✅ | Tie | — |
| Scroll triggers | ✅ | ✅ | Tie | — |
| Dwell time triggers | ✅ | ✅ | Tie | — |
| Inactivity triggers | ✅ | ✅ | Tie | — |
| Click triggers | ✅ | ✅ | Tie | — |
| Back button triggers | ✅ | ❌ banned by policy | Promolayer wins (but risky post Jun 15 2026) | N/A |
| Mobile-specific triggers | ✅ explicit | ⚠️ via device targeting | Minor gap | Medium |
| Geo targeting | ✅ | ✅ | Tie | — |
| UTM targeting | ❓ unconfirmed | ✅ verified | **ScrollPop wins** | — |
| URL targeting (exact/contains/regex) | ✅ | ✅ | Tie | — |
| Device targeting | ✅ | ✅ | Tie | — |
| Returning visitor | ✅ | ✅ | Tie | — |
| Campaign scheduling | ✅ | ✅ | Tie | — |
| A/B testing | ✅ full A/B/N multivariate + control groups | ⏸ stubbed (passthrough `return true`) | **Promolayer wins** | Critical |
| Affiliate slots / weighted rotation | ❌ not mentioned | ✅ unique feature | **ScrollPop wins** | — |
| Coupon codes | ✅ auto-generation | ⚠️ field in schema, no auto-gen | Promolayer wins | Medium |
| Email capture forms | ✅ + auto-responders | ⚠️ event captured, no lead storage | **Promolayer wins** | High |
| Lead / contact database | ✅ | ❌ events table only | Promolayer wins | High |
| Email auto-responders | ✅ paid plans | ❌ | Promolayer wins | Medium |
| AI copy generation | ✅ | ❌ | Promolayer wins | Low |
| Social / QR code features | ✅ | ❌ | Promolayer wins | Low |
| Revenue attribution analytics | ❓ not mentioned | ✅ full funnel + revenue_cents | **ScrollPop wins** | — |
| Analytics depth | Basic CTR | ✅ funnel + revenue + intelligence engine | **ScrollPop wins** | — |
| Shopify integration | ✅ App Store 4.9★ 61 reviews + Klaviyo/Mailchimp/Zapier | ✅ Script Tag (no App Store yet) | **Promolayer wins** | Critical |
| WordPress | ✅ plugin | ✅ plugin | Tie | — |
| Wix | ✅ native app | ❌ | Promolayer wins | Low |
| Klaviyo / Mailchimp | ✅ native | ❌ | Promolayer wins | High |
| Zapier | ✅ | ❌ | Promolayer wins | Medium |
| Shadow DOM isolation | ❓ not mentioned | ✅ verified (closed mode) | **ScrollPop wins** | — |
| Multi-tenant / agency architecture | ❓ not evident | ✅ full RLS isolation | **ScrollPop wins** | — |
| History manipulation | ✅ back button capture | ❌ by policy | ScrollPop safer post Jun 15 | — |
| Social proof | 25K+ sites, 300+ reviews | Pre-launch | Promolayer wins | High |

---

### Phase 1 Summary

**ScrollPop wins:** Pricing (2× views/dollar), affiliate monetization (unique), revenue attribution, UTM targeting, Shadow DOM isolation, multi-tenancy architecture, Google spam policy compliance by design.

**Promolayer wins:** Gamified popups, countdown timers, email lead capture + storage + auto-responders, full A/B/N testing, Shopify App Store listing (inbound discovery), Klaviyo/Mailchimp/Zapier, social proof (25K sites, 300+ reviews), AI copy generation.

**Critical gaps to close before targeting Promolayer's customers:** email lead storage, real A/B testing, gamified popups (lazy-loaded), Shopify App Store submission, Klaviyo integration.

---

## Phase 2 — UI/UX Review

*Based on full codebase analysis of dashboard pages, component structure, and MASTER.md. Cannot provide live screenshots without browser access.*

### Information Architecture

**Dashboard nav (verified: Layout.tsx, main.tsx):**
Dashboard → Sites → Campaigns → Analytics → Billing → Settings → Profile

Flat and clear. No core discoverability issues. However, there is no guided onboarding — a new user arrives at a blank Dashboard with empty KPI tiles and no prompt to create their first site.

---

### Critical UX Problems

**1. No lead capture visibility.**
When a visitor submits a popup form, there is no UI to view those submissions. The events table stores `email_capture` events but no lead data. An operator using ScrollPop for email list building has zero visibility into who submitted. Promolayer shows a contact database. This will cause churn from the most common popup use case.

**2. A/B testing UI exists but doesn't function.**
The Experiments page is a placeholder. The `ab_test` targeting kind is a passthrough (`return true`) in the snippet. The campaign design editor shows a percentage slider that does nothing. Operators who discover this will feel misled.

**3. Campaign wizard state is lossy.**
Targeting rules and triggers configured in the wizard are stored in `design.config.uiTriggers` as a snapshot, not in the normalized `triggers`/`targeting_rules` tables until the user clicks Launch. Navigation away mid-wizard loses state.

---

### Moderate UX Problems

**4. Billing upgrade throws 500.**
Clicking upgrade calls `POST /billing/checkout` which requires `STRIPE_PRICE_*` env vars that are not yet set. Any user clicking upgrade sees a server error. This is the #1 revenue blocker.

**5. Feature flags are browser-local.**
Flags stored in `localStorage` mean agency users managing multiple browsers get inconsistent feature states with no server-side persistence.

**6. Journeys and Experiments pages appear broken.**
Both show placeholder content with no "coming soon" framing. They are URL-reachable. Users who find them think the product is broken.

---

### User Journey Analysis

| User type | Status | Critical gap |
|---|---|---|
| New customer | Functional end-to-end | No onboarding tour, blank empty states |
| Returning customer | Solid | — |
| Agency user (Novatise) | All emails share ONE tenant | Cannot segregate data per client — architectural limitation |
| Enterprise user | Not ready | No team invitations, no SAML, no audit log, no white-label |

---

## Phase 3 — Performance Review

### Snippet Performance

| Metric | ScrollPop | Promolayer claim | Assessment |
|---|---|---|---|
| Bundle size gzipped | **8.07 KB** ✅ | Claims "1/3 competitors", "smaller than one image" | ScrollPop competitive; Promolayer claim unverified |
| Deferred loading | ✅ `requestIdleCallback` + `setTimeout` fallback | ✅ claimed | Tie |
| LCP impact | ✅ zero (async) | ✅ claimed | Tie |
| Event beaconing | ✅ `sendBeacon` + `fetch({keepalive})` | ❓ | ScrollPop verified |
| Shadow DOM | ✅ closed mode | ❓ | ScrollPop wins |
| History API | ❌ none by design | ✅ back button capture | ScrollPop safer |

**Budget risk:** Snippet is 8.07 KB with ~1,850 bytes of headroom to the 10 KB CI gate. Real A/B testing must be lazy-loaded or the gate breaks.

---

### API Performance — Verified Issues

**1. N+1 in production config route** — `internal.ts:114–163` ✅ Confirmed.
For each active campaign, the code issues `Promise.all([design, triggers, targeting, frequency])` — 4 DB calls per campaign. A site with 10 active campaigns = 40 DB round trips per KV cache miss. The local `/c/` dev route correctly batches these with `inArray`. The production path does not.

**2. campaignMetaCache thundering herd** — `index.ts:416` ✅ Confirmed.
```typescript
if (campaignMetaCache.size > 5000) campaignMetaCache.clear();
```
When this fires, all 5,000 entries are evicted simultaneously. Every concurrent request then hits the DB. Should be an LRU with individual entry TTLs.

**3. Admin tenant list N+1** — `admin.ts:95–108` ✅ Confirmed.
For each tenant row, two additional DB queries fetch the owner email. At 100 tenants = 200 extra queries per admin page load.

**4. No `tenantId` index within TimescaleDB partitions.**
Analytics queries filter by `tenantId` and `ts` range. TimescaleDB partitions by time (efficient), but `tenantId` within a partition has no index. At scale with many tenants, these become full-chunk scans.

**5. No connection pool size management.**
The `postgres()` client uses default settings. Under concurrent Render requests, connections to Neon's pooler can exceed the plan limit, causing 500s.

---

### Performance Scorecard

| Category | ScrollPop | Promolayer | Risk | Recommendation |
|---|---|---|---|---|
| Snippet size | 8.07 KB ✅ | Claimed ~1/3 competitors | Low | Guard A/B feature weight |
| Config fetch | ❌ 4N DB calls on KV miss | Unknown | High | Batch like local /c/ route |
| Edge caching | ✅ 60s KV | ✅ claimed CDN | Low | Good |
| Rate limiting | ✅ 200/min/IP global, 500/min/IP on /e | Unknown | Medium | Add per-tenant limits |
| Analytics queries | ⚠️ No tenant indexes in partitions | Unknown | Medium | Add partial indexes |
| Admin panel | ❌ N+1 per tenant | N/A | Low | JOIN or subquery |
| Cache invalidation | ✅ on publish; ❌ missing on activate/pause | Unknown | Medium | Fix TODO in campaigns.ts |

---

## Phase 4 — Security Audit

> **🛡️ Remediation update (Jun 4 2026 — `feature/security-phase4-5`):** All Phase 4 findings
> and Phase 5 scenarios have been addressed. Findings 1, 2, 3, 4, 6, 7, 8, 9, 11, 12 fixed in
> code; Findings 5 (internal-secret IP spoof) is inherent/operational (rotation schedule in
> CONTRIBUTING); Finding 10 (sync pagination) fixed. During the sprint, two findings were found
> already-implemented and stale in this audit: Shopify token encryption (Scenario 7 — via
> `token-crypto.ts`) and the Neon connection pool (`max:10`). Live status: `PROJECT-TRACKER.md`.

### Authentication & Authorization

**Finding 1 — HIGH: Stripe webhook uses re-serialized body for signature verification**
*Evidence: `webhooks.ts:227`*
```typescript
event = stripe.webhooks.constructEvent(
  JSON.stringify(request.body),  // re-serialized, not raw bytes
  request.headers['stripe-signature'] as string,
  webhookSecret
);
```
Stripe signature verification requires the exact raw request bytes. `JSON.stringify(request.body)` re-serializes a parsed object and may differ in whitespace or Unicode escaping from the original. `@fastify/rawbody` is not registered in `index.ts`, so `rawBody: true` on the route config may not preserve the raw body. **Impact:** All Stripe webhooks (subscription created/updated/deleted) may always fail with 400, meaning plan changes never apply. Affects Clerk webhook too. **Must be tested before Stripe go-live.** Fix: register `@fastify/rawbody`, use `request.rawBody`.

**Finding 2 — HIGH: Campaign activate/pause does not bust KV cache**
*Evidence: `campaigns.ts:281`, `campaigns.ts:313` — TODO comments present in code*
```typescript
// TODO: Publish config to Cloudflare KV (Step 5)
```
When a campaign is paused, the KV cache is not invalidated. Visitors continue seeing the popup for up to 60 seconds. For a paid customer expecting instant pause (e.g., for a compliance issue), this is a trust problem. Fix: call the internal `/cache/:publicKey` DELETE endpoint on activate/pause.

**Finding 3 — HIGH: Cross-tenant event injection via campaignId**
*Evidence: `index.ts:474–499`*
The `/e` ingest endpoint resolves `campaignId` via `resolveCampaignMeta()` without scoping to the tenant of the request. An attacker who knows another tenant's campaign UUID can inject `click`, `dismiss`, and `conversion` events into that tenant's analytics. The impression flood gate (per-IP) limits impression injection but not other event types.
Fix: store a mapping of publicKey → allowedCampaignIds in the Worker and validate on ingest.

**Finding 4 — MEDIUM: Stripe checkout accepts arbitrary successUrl/cancelUrl**
*Evidence: `billing.ts:63`*
```typescript
const CheckoutBody = z.object({
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});
```
Any valid URL is accepted. An authenticated malicious user could construct a Stripe Checkout session with `successUrl: 'https://phishing.example.com'` and share the Stripe checkout URL with a victim. After payment, the victim is redirected to the attacker's site.
Fix: validate `successUrl` and `cancelUrl` against an allowlist of dashboard origins.

**Finding 5 — MEDIUM: Internal secret enables IP spoofing for rate limit bypass**
*Evidence: `index.ts:397–404`*
```typescript
const fromWorker = req.headers['x-internal-secret'] === process.env['INTERNAL_SECRET'];
if (fromWorker) {
  const fwd = req.headers['x-cf-connecting-ip'];
  if (typeof fwd === 'string' && fwd) return fwd;
}
```
If `INTERNAL_SECRET` is ever exposed (Render env leak, git history, insider), an attacker can forge any client IP to bypass per-IP rate limits on the `/e` endpoint.

**Finding 6 — MEDIUM: ReDoS protection in url_regex is incomplete**
*Evidence: `sanitize.ts:93–97`*
The `isSafeRegex()` function catches only simple nested-quantifier patterns. Patterns like `([a-zA-Z]+)*` or alternation-based ReDoS are not caught. A malicious operator could create a targeting rule with a catastrophically backtracking regex, causing the snippet to hang in every visitor's browser on the customer's site.
Fix: use a dedicated safe-regex library or run regex evaluation with a `performance.now()` timeout.

**Finding 7 — MEDIUM: Client-controlled country field in event payload**
*Evidence: `index.ts:495`*
The `country` field in inbound events is accepted from the client payload without validation. When events arrive directly at the API `/e` (not via Worker), the client can forge any country code, skewing geo analytics.

**Finding 8 — MEDIUM: No audit log for admin operations**
Plan changes, tenant deletions, and sync operations via `/admin/*` routes are logged to Fastify's logger but not persisted. There is no audit trail for "who changed tenant X's plan from free to agency on date Y."

**Finding 9 — LOW: Dev bypass protection relies on DATABASE_URL heuristic**
*Evidence: `tenant-context.ts:98–105`*
The dev auth bypass refuses to activate if `DATABASE_URL` contains a remote host. This is a good guard, but it relies on the URL containing `localhost` or `127.0.0.1`. An unusual remote URL format could theoretically bypass it. Low risk in practice.

**Finding 10 — LOW: Admin Clerk sync limited to 500 users without pagination**
*Evidence: `admin.ts:178`*
```typescript
const clerkResponse = await clerkClient.users.getUserList({ limit: 500 });
```
At >500 users, stale/deleted users past the limit will not be cleaned up by the sync. Fix: paginate using Clerk's cursor API.

**Finding 11 — LOW: No Content-Security-Policy header on API**
*Evidence: `index.ts:104–113`*
The API sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `HSTS`, but no `Content-Security-Policy`. Since the API serves only JSON (no HTML), this is low risk but an incomplete header set.

**Finding 12 — LOW: No rate limit on admin routes**
Admin routes (`/api/v1/admin/*`) pass through the global 200 req/min rate limit but have no dedicated lower limit. A brute-force against the admin email verification would be capped at 200/min/IP.

---

### What Is Well-Protected ✅

| Attack | Mitigation | Verified |
|---|---|---|
| Stored XSS via affiliate image URL | `safeHref()` blocks non-http(s) | ✅ sanitize.ts:25 |
| CSS injection via font-family | `cssFont()` strips all injection chars, 60-char limit | ✅ sanitize.ts:65 |
| CSRF on API | JWT Bearer token auth — CSRF-resistant by design | ✅ |
| Webhook replay | Svix timestamp (5 min window), Stripe idempotency | ✅ |
| Shopify OAuth CSRF | HMAC verification + Redis nonce | ✅ |
| IDOR on campaigns/sites | Every query scoped by `eq(tenantId, request.tenantId)` | ✅ |
| Unverified Novatise email escalation | `isVerifiedPrimaryEmail()` checks Clerk verification status + primary | ✅ |
| Tenant isolation | RLS on every tenant-scoped table + service-layer filter | ✅ |
| dev bypass on remote DB | Refused if DATABASE_URL is not localhost | ✅ |
| Admin console spoofing | Email verified server-side via Clerk; no localStorage fallback | ✅ |

---

## Phase 5 — Adversarial Thinking

### Attack Scenarios

| # | Scenario | Attack Path | Impact | Likelihood | Difficulty | Severity |
|---|---|---|---|---|---|---|
| 1 | **Quota exhaustion via distributed bot** | Sign up free. Discover rival's public key (visible in their snippet embed). Run botnet with 100+ IPs, each sending impression events at 120/min. Victim's 1,000 monthly free views exhausted in seconds. Popups stop showing for the month. | Business harm to victim, popups disabled | Medium | Medium | **High** |
| 2 | **Cross-tenant analytics poisoning** | Attacker knows a campaign UUID (guessable only if the victim publishes it). Sends `click`/`conversion` events to `/e` with that campaignId. Inflates victim's analytics. Impression gate doesn't protect non-impression events. | Analytics corruption | Low | Medium | **Medium** |
| 3 | **Open redirect via billing checkout** | Authenticated user crafts checkout session with `successUrl: https://evil.com`. Shares Stripe checkout link with victim. Victim pays, lands on phishing site. | Phishing / reputational | Low | Low | **Medium** |
| 4 | **Stripe plan bypass via webhook failure** | If webhook signature fails (rawBody issue), subscription webhooks return 400. Tenant pays but stays on free plan, or cancels but keeps paid plan. | Revenue loss / plan escalation | High (if bug confirmed) | N/A | **High** |
| 5 | **ReDoS via malicious regex targeting rule** | Operator creates `url_regex` rule with catastrophically backtracking pattern. Every visitor to the customer's site triggers the pattern in-browser. Page hangs. | Client-side DoS on customer sites | Low | Medium | **Medium** |
| 6 | **Forged country code in analytics** | Direct POST to API `/e` (not via Worker) with arbitrary `country` field. Skews geo analytics for any tenant whose campaign ID is known. | Analytics quality | Medium | Low | **Low** |
| 7 | **Shopify access token exfiltration** | Attacker gains Neon read access (DB breach). `shopify_installations.access_token` is stored in plaintext. | Store takeover | Very Low | Very Hard | **Medium** |
| 8 | **Admin impersonation (theoretical)** | Attacker sets `ADMIN_EMAIL` env var to their own email (requires Render account access). Gains super-admin. | Full platform access | Very Low | Requires Render access | **Critical if possible** |
| 9 | **Free tier abuse via trial account cycling** | Create free account → install snippet → 1,000 views served → delete account → create new account → repeat. New account gets fresh 1,000 free views. | Revenue erosion | Medium | Low | **Low** |
| 10 | **Conversion milestone notification spam** | Redis `sp_conv:{tenant}` counter is incremented by any `conversion` event. Attacker floods `/e` with conversion events against a known campaign. Every 100/1k/10k crossing fires a notification email to the tenant owner. | Spam / Resend cost | Low | Low | **Low** |

---

## Phase 6 — Scale Readiness

### At 100 Customers — ✅ Ready

Single Render Pro instance, Neon, Upstash free tiers all handle this comfortably. No changes needed.

### At 1,000 Customers — ⚠️ Watchable

- Config N+1 becomes noticeable. 1,000 tenants × 10 campaigns average × 4 DB calls per KV miss = 40,000 DB calls in a miss wave.
- `campaignMetaCache` is instance-local. If Render scales to 2 instances, each has a cold cache.
- Neon pooler default limits (~20 connections) may be hit under concurrent bursts.

**Actions:** Fix the N+1. Set `max` on `postgres()` client. Monitor Neon connection count.

### At 10,000 Customers — ❌ Will break without changes

| Failure point | Evidence | Action |
|---|---|---|
| Neon connection exhaustion | No pool size config in `db/client.ts` | Set `max: 10` on postgres() client, upgrade Neon plan |
| Analytics query timeouts | No `tenantId` index in TimescaleDB partitions | `CREATE INDEX ON events(tenant_id, ts DESC)` |
| Admin panel unusable | N+1 for every tenant row | Rewrite with JOIN |
| `campaignMetaCache` full eviction | Clears all 5,000 entries at once | Replace with Redis-backed LRU |
| Purge job causing latency spikes | In-process hourly async loop | Externalize to dedicated cron worker |
| Upstash Redis rate limits | One key per (campaign, IP) per minute | Plan upgrade or key consolidation |

### At 100,000 Customers — ❌ Architectural changes required

| Failure point | Action |
|---|---|
| Single Neon instance | Read replicas for analytics queries |
| TimescaleDB OLAP performance | Migrate to ClickHouse (>50M events/month, already in v3 plan) |
| Single Render service | Horizontal scaling with stateless design (remove in-process caches) |
| Upstash Redis latency | Regional Upstash deployment |
| Per-tenant event table scans | Tenant-sharded analytics or column store |
| In-process caches | Centralize in Redis with LRU and per-key TTL |

### Expected Breaking Points (ordered by likelihood)

1. **Neon connections exhausted** — first bottleneck, ~500 concurrent users
2. **API config N+1 latency cascade** — degraded UX, ~500 active sites
3. **Analytics query timeouts** — ~2,000 tenants
4. **Redis Upstash rate limits** — ~10,000 tenants
5. **Render single instance CPU saturation** — first traffic spike
6. **TimescaleDB storage cost growth** — ~50M events/month
7. **campaignMetaCache inconsistency** — 2+ Render instances
8. **Admin panel never loads** — ~500 tenants
9. **KV namespace operation rate** — 100,000 active sites
10. **Purge job memory pressure** — ~10,000 tenants

---

## Phase 7 — Codebase Health

### Structure Assessment

```
✅ Clean monorepo with clear package boundaries
✅ pnpm workspaces + Turborepo
✅ Shared types/schemas in @scrollpop/shared
✅ Zod validation at all API boundaries
✅ Drizzle ORM with fully typed queries
✅ No hardcoded secrets (all via env vars)
✅ RLS on every tenant-scoped table
✅ Shadow DOM — no global CSS injection possible
⚠️ Business logic leaking into index.ts (config route, /e ingest,
   notification logic all in bootstrap() — 595 lines)
⚠️ apps/api/src/index.ts needs decomposition
⚠️ any types in campaign activate/pause handlers
```

### Technical Debt Register

| # | Item | Severity | File |
|---|---|---|---|
| TD1 | N+1 in production config route (4N DB calls per campaign) | High | `internal.ts:114` |
| TD2 | Stripe/Clerk webhook raw body re-serialization | High | `webhooks.ts:227` |
| TD3 | Campaign activate/pause missing KV cache bust | High | `campaigns.ts:281,313` |
| TD4 | `campaignMetaCache` full-eviction thundering herd | Medium | `index.ts:416` |
| TD5 | `any` types in campaign activate/pause handlers | Medium | `campaigns.ts:256,288` |
| TD6 | Stripe `successUrl`/`cancelUrl` not allowlisted | Medium | `billing.ts:63` |
| TD7 | `isSafeRegex` incomplete (misses alternation-based ReDoS) | Medium | `sanitize.ts:93` |
| TD8 | Admin tenant list N+1 | Low | `admin.ts:95` |
| TD9 | Admin sync limited to 500 users, no pagination | Low | `admin.ts:178` |
| TD10 | No audit log for admin operations | Medium | `admin.ts` |
| TD11 | 428 ESLint warnings (style/any patterns) | Low | Dashboard-wide |
| TD12 | No API route integration tests | High | `apps/api` |
| TD13 | No tenant isolation test (IDOR scenarios) | High | `e2e/` |
| TD14 | No test for webhook signature verification paths | High | `apps/api` |
| TD15 | Campaign export: 100K rows in-memory, no streaming | Low | `campaigns.ts:236` |

### Test Coverage

| Type | Status |
|---|---|
| Unit tests (sanitize.ts) | ✅ sanitize.test.ts — good |
| E2E Playwright suite | ✅ 15 tests, non-gating CI |
| API route integration tests | ❌ None |
| Tenant isolation tests | ❌ None |
| Webhook verification tests | ❌ None |
| Load / stress tests | ❌ None |

### Scores

| Dimension | Score | Notes |
|---|---|---|
| **Maintainability** | 7/10 | Clean architecture, strict types, Zod validation. Docked for large index.ts, missing API tests. |
| **Security posture** | 6.5/10 | No critical auth holes. Webhook body issue and cross-tenant event injection are real gaps. |
| **Scalability readiness** | 5/10 | Good foundation but N+1, no indexes, no horizontal scale config. |
| **Test coverage** | 4/10 | Sanitizer and E2E covered. Zero API integration or isolation tests. |
| **Overall risk** | 6/10 | Operational and scale risks outweigh security risks at this stage. |

---

## Phase 8 — Executive Report

### 1. Biggest Competitive Advantages of ScrollPop

1. **Price-to-views ratio** — 2× the views per dollar at every tier. Structural and defensible without needing feature parity.
2. **Affiliate monetization** — Weighted affiliate slot rotation with click tracking. Unique; Promolayer has no equivalent.
3. **Revenue attribution analytics** — Full funnel (impression → email capture → checkout → purchase) with `revenue_cents`. Promolayer shows basic CTR only.
4. **Shadow DOM isolation** — Verifiably safer for customer sites. No CSS leakage, no global JS conflicts, no host-page DOM manipulation.
5. **Google spam policy compliance by architecture** — No `history.pushState`, no `onpopstate`. As Google's June 15, 2026 enforcement deadline passes, operators using back-button-capture competitors face penalty risk.
6. **Advanced targeting depth** — UTM, geo, returning visitor, session page views, URL regex — more sophisticated than typical competitors at this price point.
7. **Multi-tenant architecture** — Full RLS isolation, ready for genuine agency workloads.

---

### 2. Biggest Competitive Advantages of Promolayer

1. **Shopify App Store listing** — 4.9★, 61 reviews. Inbound discovery channel ScrollPop has no equivalent of. Shopify operators find Promolayer; they will not find ScrollPop.
2. **Email lead capture + storage + auto-responders** — Core use case for most popup operators. ScrollPop has no lead database.
3. **Gamified popups** — Claims 300% more submissions vs standard. Removed from ScrollPop.
4. **Native integrations** — Klaviyo, Mailchimp, Zapier. Without these, captured emails go nowhere useful.
5. **Proven social proof** — 25,000+ sites, 300+ five-star reviews. A trust signal pre-launch ScrollPop cannot match.
6. **Full A/B/N multivariate testing** — Control groups, real allocation. ScrollPop's is a passthrough.
7. **Countdown timers** — Present in every competitor. Absence is conspicuous during demos.

---

### 3. Features ScrollPop Must Build (revenue-impact order)

1. **Stripe billing activation** — No revenue without this. Keys pending; rawBody bug must be verified first.
2. **Email lead capture storage** — Without a lead database, email capture popups are useless. Core churn driver.
3. **Klaviyo / Mailchimp webhook** — Without integration, captured emails go nowhere operators care about.
4. **Real A/B testing** — Current UI deceives users. Passthrough must be replaced before it becomes a churn/refund reason.
5. **Shopify App Embed Block + App Store submission** — The only inbound discovery channel that matters for Shopify operators.
6. **Countdown timers** — Absent in every ScrollPop popup type. Present in every competitor.
7. **Gamified popups (lazy-loaded)** — Spin-to-win converts at 3× per Promolayer's data. Must be lazy-loaded to stay under the 10 KB snippet gate.

---

### 4. Features ScrollPop Should NOT Build

1. **SAML SSO** — No enterprise customers yet. V3 at earliest.
2. **Native iOS/Android SDKs** — No signal of demand.
3. **Full ClickHouse migration** — Only at >50M events/month.
4. **Back-button capture** — Google spam policy violation post June 15, 2026.
5. **Real-time social proof** — Requires pub/sub infrastructure; complexity not justified now.
6. **AI copy generation** — Nice-to-have but not a conversion driver at this stage.

---

### 5. Top 20 Security Risks

| # | Risk | Severity | Evidence |
|---|---|---|---|
| S1 | Stripe/Clerk webhook raw body re-serialization breaks signature verification | **Critical** | `webhooks.ts:227` |
| S2 | Campaign activate/pause does not bust KV cache | **High** | `campaigns.ts:281,313` |
| S3 | Cross-tenant event injection (campaignId not scoped to requesting tenant) | **High** | `index.ts:474` |
| S4 | Stripe checkout successUrl/cancelUrl open redirect | **Medium** | `billing.ts:63` |
| S5 | Internal secret exposure enables IP spoofing for rate limit bypass | **Medium** | `index.ts:397` |
| S6 | ReDoS via incomplete url_regex sanitizer | **Medium** | `sanitize.ts:93` |
| S7 | Distributed bot view quota exhaustion (free-tier sabotage) | **Medium** | `index.ts:480` |
| S8 | Client-controlled `country` field in event payload | **Medium** | `index.ts:495` |
| S9 | No audit log for admin operations (plan changes, deletions) | **Medium** | `admin.ts` |
| S10 | INTERNAL_SECRET rotation requires coordinating two separate platforms | **Medium** | Operational |
| S11 | No CSP header on API responses | **Low** | `index.ts:104` |
| S12 | No rate limit on admin routes | **Low** | `admin.ts` |
| S13 | Admin sync limited to 500 Clerk users — no pagination | **Low** | `admin.ts:178` |
| S14 | `any` types in campaign handlers bypass TypeScript guards | **Low** | `campaigns.ts:256` |
| S15 | Shopify access tokens stored in plaintext in DB | **Low** | `schema.ts:183` |
| S16 | R2 bucket uses rate-limited r2.dev URL in production | **Low** | `Sites.tsx:195` |
| S17 | No session revocation (JWT-only, relies on Clerk TTL) | **Low** | `tenant-context.ts` |
| S18 | Campaign export 100K row limit holds DB connection | **Low** | `campaigns.ts:236` |
| S19 | Conversion milestone Redis counter accepts forged events | **Low** | `index.ts:351` |
| S20 | Free tier account cycling (new account = fresh 1K views) | **Low** | Business logic |

---

### 6. Top 20 Performance Risks

| # | Risk | Severity |
|---|---|---|
| P1 | N+1 in production config route (4 DB calls per active campaign per KV miss) | **High** |
| P2 | No `tenantId` index within TimescaleDB partitions | **High** |
| P3 | No connection pool size limit on Neon client | **High** |
| P4 | Single Render instance with no horizontal scale config | **High** |
| P5 | `campaignMetaCache` full eviction — thundering herd | **Medium** |
| P6 | Admin tenant list N+1 (2 queries per tenant row) | **Medium** |
| P7 | In-process purge-deleted job causes latency spikes on API pod | **Medium** |
| P8 | Analytics `intelligence` endpoint fires 5 parallel queries | **Medium** |
| P9 | Campaign export: 100K rows loaded in-memory, no streaming | **Medium** |
| P10 | SSE OpsCenter stream holds DB connection per connected client | **Medium** |
| P11 | No query timeouts on Drizzle queries | **Medium** |
| P12 | Snippet at 8.07 KB with only 1.85 KB headroom | **Medium** |
| P13 | Redis Upstash REST adds ~50 ms to every impression counter | **Low** |
| P14 | KV cache TTL is 60 s — stale config window on activate/pause | **Low** |
| P15 | `ensureEventPartitions` runs a DB call on every cold start | **Low** |
| P16 | Analytics daily endpoint scans 60 days in one query | **Low** |
| P17 | Analytics `breakdown` fires 4 parallel queries per request | **Low** |
| P18 | Worker `waitUntil` event forwarding budget limited to 2 retries | **Low** |
| P19 | `resolveCampaignMeta` cache is instance-local — misses on 2+ instances | **Medium** |
| P20 | No CDN for API responses — all traffic through Render | **Medium** |

---

### 7. Top 20 Scalability Risks

| # | Risk | Expected breaking point |
|---|---|---|
| SC1 | Neon connection pool exhaustion | ~500 concurrent users |
| SC2 | Config N+1 latency under load | ~500 active sites |
| SC3 | Single Render instance — no auto-scaling | ~1,000 req/sec spike |
| SC4 | Analytics query performance degradation | ~5,000 tenants |
| SC5 | TimescaleDB → ClickHouse migration needed | 50M events/month |
| SC6 | `campaignMetaCache` inconsistency on multi-instance deploy | 2+ Render instances |
| SC7 | In-process `purge-deleted.ts` job not externalized | ~2,000 tenants |
| SC8 | Upstash Redis concurrent connection limits | ~5,000 req/sec |
| SC9 | KV namespace — all tenants share one namespace, no sharding | ~100,000 tenants |
| SC10 | Admin sync fetches all users in one Clerk call | ~500 users |
| SC11 | Event ingest is synchronous per-event DB insert | ~10,000 events/sec |
| SC12 | No queue/batch for analytics writes | ~10,000 events/sec |
| SC13 | Impression gate keys accumulate (one per campaign/IP/minute) | ~1M active visitors |
| SC14 | Analytics 90-day queries hold chunk locks on TimescaleDB | ~10,000 tenants |
| SC15 | `campaignMetaCache` bounded at 5,000 global entries | ~5,000 active campaigns |
| SC16 | No read replicas for analytics queries | ~10,000 tenants |
| SC17 | Neon TimescaleDB partition must be pre-seeded monthly | Operational (first month missed = outage) |
| SC18 | Notification emissions on every qualifying event | ~50,000 tenants |
| SC19 | 100K event export holds DB connection for full duration | ~1,000 concurrent exports |
| SC20 | In-process conversion milestone counter (`redis.incr`) on every conversion | ~10M conversions/month |

---

### 8. Launch Readiness Score: 61/100

| Dimension | Score | Blocker |
|---|---|---|
| Core popup pipeline | 95/100 | Verified end-to-end ✅ |
| Billing | 10/100 | Stripe not configured; rawBody webhook bug unverified |
| Security | 72/100 | No critical auth holes; several medium findings |
| Analytics | 85/100 | Solid; no lead database |
| Integrations | 30/100 | No Klaviyo/Mailchimp; Shopify App Store pending |
| Email lead capture | 20/100 | No lead storage backend |
| A/B testing | 5/100 | UI exists; feature is a passthrough |
| Operations | 70/100 | Sentry/PostHog/Resend live; migrations hardened |
| Performance | 65/100 | N+1 issues; no load testing |

---

### 9. Enterprise Readiness Score: 18/100

Not ready. Missing: SAML SSO, audit logs, team invitations UI, SLA documentation, GDPR data export, white-label, admin impersonation for support, multi-region infrastructure, DPA (engineering draft exists, attorney review needed), dedicated tenant infrastructure.

---

### 10. CTO Summary

ScrollPop has a technically sound core. The popup delivery pipeline is live and verified end-to-end. The multi-tenant architecture is well-designed with proper RLS and Zod validation at every boundary. The sanitizer layer is thorough and unit-tested. The pricing model is structurally superior to Promolayer at every tier.

However, three go-to-market gaps could prevent revenue from ever starting:

**First:** Stripe billing is not configured. Before setting keys, the webhook raw body issue must be verified — if `@fastify/rawbody` is not registered, all subscription webhooks return 400 and no plan changes will ever apply. Test this first.

**Second:** There is no email lead storage. Popup tools exist primarily to capture leads. Operators who discover ScrollPop has no lead database will churn immediately regardless of price.

**Third:** A/B testing shows a live UI slider that does nothing. This must be fixed or removed before it causes a refund dispute.

On the technical side, the N+1 in the production config route (`internal.ts`) is the most important code change before growth — it degrades proportionally with campaign count and is the exact pattern already fixed in the local dev route. Fix is a one-hour change.

---

### "What Would Break First If ScrollPop Acquired 10,000 Paying Customers Tomorrow?"

Ranked most to least likely:

| Rank | Failure | Why |
|---|---|---|
| 1 | **Stripe billing never applies** | Webhook rawBody bug likely causes all subscription events to return 400. Every upgrade stays on free. Every cancellation keeps paid plan. |
| 2 | **Neon connection pool exhausted** | 10,000 tenants × concurrent dashboard sessions → Neon pooler limit hit → 500s across all API routes. |
| 3 | **Analytics queries time out** | No `tenantId` index in TimescaleDB partitions. Dashboard analytics start returning 30-second timeouts for large tenants. |
| 4 | **Config N+1 cascade** | 10,000 sites × active campaigns × 4 DB calls per KV miss → Neon saturated during any traffic spike. |
| 5 | **Redis Upstash rate limits** | 10,000 tenants × impression gates + view counters + notification flags → Upstash free/hobby plan limits hit. |
| 6 | **Render single instance CPU saturation** | No horizontal scaling. First traffic spike exhausts the single instance. All popups stop serving. |
| 7 | **Email notification flood** | 10,000 tenants × usage threshold crossings → Resend rate limits hit; API latency spikes per notification emit. |
| 8 | **TimescaleDB partition boundary** | Events table inserts fail at month rollover if `ensureEventPartitions` hasn't run yet. Analytics silently dies for the new month. |
| 9 | **Admin panel becomes unusable** | 10,000 tenant rows × N+1 owner email lookups = admin console never finishes loading. |
| 10 | **KV cache operation rate** | 10,000 active sites × 60s TTL × traffic volume → high Cloudflare KV write rate; may hit Workers free tier limits. |

---

*This document reflects the state of the ScrollPop codebase and Promolayer's public-facing product as of June 4, 2026. Update after each significant architectural change or competitive review.*
