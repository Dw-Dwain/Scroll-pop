# ScrollPop — Project Tracker

> Single source of truth for all open issues, feature gaps, security findings, performance fixes, and technical debt.
> Sourced from `CTO-AUDIT.md` (June 4, 2026). Update status as items are completed.
> **Priority:** P0 = launch blocker · P1 = high · P2 = medium · P3 = low
> **Status:** ⬜ Todo · 🔄 In progress · ✅ Done · ❌ Won't build

---

## Quick Status

| Category | Total | Done | Remaining |
|---|---|---|---|
| P0 Launch blockers | 5 | 4 | 1 |
| P1 High priority | 18 | 15 | 3 |
| P2 Medium priority | 19 | 17 | 2 |
| P3 Low priority | 12 | 4 | 8 |
| **Total** | **54** | **40** | **14** |

> **A/B testing (Jun 4 2026)** — `feature/ab-testing` (P0-4 + P1-10): real weighted variants.
> New `variants` table (**migration 0010** + RLS + self-heal), variants CRUD + per-variant
> results API, config payload carries variants, snippet does sticky weighted allocation + tags
> `abVariantId` (snippet 9218B). Dashboard A/B panel on Campaign Detail (create/weight/delete/
> results + "Edit design" reuses the builder via `?variant=`). Fake % slider removed.
> **The only remaining P0 is P0-2 (Stripe keys).**

> **Security sprint (Jun 4 2026)** — `feature/security-phase4-5`: closed all CTO-AUDIT
> Phase 4 findings + Phase 5 scenarios. Done: P0-1, P0-5, P1-1, P1-2, P1-3, P1-17, P2-1,
> P2-3, P2-4, P2-19, P3-8. Found already-implemented: P1-5 (Neon pool `max:10`), P2-5
> (Shopify token encryption via `token-crypto.ts`).
>
> **Perf/infra sprint (Jun 4 2026)** — `feature/perf-infra-cluster`: P1-4 (config N+1 →
> batched), P1-6 (cache thundering-herd → single-entry LRU eviction), P2-7 (events
> `tenant_id` index, migration 0008), P2-8 (admin tenant N+1 → JOIN), P2-11 (30s
> statement_timeout). P2-6 closed as a duplicate of P3-8. P2-2 addressed by the existing
> 90-day rotation policy in CONTRIBUTING (the code already gates the IP header on
> INTERNAL_SECRET — no further code fix exists short of rotating the secret).

---

## P0 — Launch Blockers

Nothing ships without these.

| # | Status | Category | Item | Evidence | Notes |
|---|---|---|---|---|---|
| P0-1 | ✅ | Bug | **Stripe webhook rawBody bug** — `JSON.stringify(request.body)` used for signature verification instead of raw bytes. All plan changes (upgrade, downgrade, cancel) silently fail with 400. | `webhooks.ts:227` | Register `@fastify/rawbody`. Use `request.rawBody` in both Stripe and Clerk webhook handlers. Test before setting live Stripe keys. |
| P0-2 | ⬜ | Config | **Stripe billing not activated** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and 4 price IDs (`STRIPE_PRICE_STARTER/GROWTH/SCALE/AGENCY`) not set. No revenue possible. | Render env vars | Fix P0-1 first, then set keys and test end-to-end checkout → webhook → plan update. |
| P0-3 | ✅ | Feature | **No email lead storage** — Popup form submissions fire an `email_capture` event but no lead data is persisted in a retrievable format. No dashboard UI exists to view submissions. This is the core use case for most popup operators. Will cause immediate churn. | `schema.ts` (no leads table) | Create `leads` table (tenantId, campaignId, email, name, metadata, createdAt). API endpoint to list/export. Dashboard UI. |
| P0-4 | ✅ | Bug | **A/B testing passthrough deceives users** — The campaign design editor shows a live percentage slider. The `ab_test` targeting kind in the snippet is `return true` (passthrough). Users who discover this will request refunds. | `packages/snippet/src/main.ts` | Either implement real A/B allocation or remove the slider and label Experiments as "coming soon". |
| P0-5 | ✅ | Bug | **Campaign activate/pause does not bust KV cache** — Two TODO comments in code confirm this is unfinished. Pausing a campaign leaves it live for up to 60 seconds. Activating a campaign may not propagate. | `campaigns.ts:281`, `campaigns.ts:313` | Call `DELETE /api/v1/internal/cache/:publicKey` for the site's public key on every activate/pause/status change. |

---

## P1 — High Priority

Core product gaps vs. Promolayer and high-severity technical issues.

### Security

| # | Status | Category | Item | Evidence | Notes |
|---|---|---|---|---|---|
| P1-1 | ✅ | Security | **Cross-tenant event injection** — The `/e` ingest endpoint resolves `campaignId` without scoping to the requesting tenant. Any authenticated or unauthenticated caller who knows a campaign UUID can inject click/dismiss/conversion events into another tenant's analytics. | `index.ts:474` | Validate that inbound `campaignId` belongs to a site whose public key is in the request context, or require the public key in the event payload and verify it server-side. |
| P1-2 | ✅ | Security | **Stripe checkout open redirect** — `successUrl` and `cancelUrl` accept any valid URL. Attacker can craft a Stripe checkout link that redirects victims to a phishing site after payment. | `billing.ts:63` | Validate `successUrl` and `cancelUrl` against an allowlist of known dashboard origins before passing to Stripe. |
| P1-3 | ✅ | Security | **Distributed bot view quota exhaustion** — A botnet with 100+ IPs (each under the 120 imp/min gate) can exhaust a free tenant's 1,000 monthly views in seconds, disabling their popups for the month. | `index.ts:480` | Validate that the impression's `pageUrl` origin matches the site's registered domain before counting against the quota. Reject impressions from unknown origins. |

### Performance

| # | Status | Category | Item | Evidence | Notes |
|---|---|---|---|---|---|
| P1-4 | ✅ | Performance | **N+1 in production config route** — For each active campaign, 4 separate DB calls are issued (design, triggers, targeting, frequency). A site with 10 campaigns = 40 DB round trips per KV miss. The local dev route already has the correct batched pattern using `inArray`. | `internal.ts:114–163` | Replace per-campaign queries with 4 batched `inArray` queries grouped by `campaignId`, identical to the fix already in `index.ts` local `/c/` route. |
| P1-5 | ✅ | Performance | **No connection pool size limit on Neon client** — Already implemented: `db/client.ts` sets `max: 10, idle_timeout: 20, connect_timeout: 10`. Audit finding was stale. | `db/client.ts` | Done. Monitor connection count in Neon console as customers grow. |
| P1-6 | ✅ | Performance | **`campaignMetaCache` thundering herd** — When cache hits 5,000 entries all are evicted simultaneously. Every concurrent request then hits the DB. | `index.ts:416` | Replace with an LRU with individual entry TTLs. Or move campaign meta lookups to a Redis hash with per-key TTL. |

### Features vs. Promolayer

| # | Status | Category | Item | Promolayer | Notes |
|---|---|---|---|---|---|
| P1-7 | ✅ | Feature | **Email lead capture UI** — Built with P0-3: Leads page (`/leads`, nav entry) with list, campaign filter, pagination, CSV export, and per-lead delete (GDPR). Minor follow-ups deferred: free-text email search box. | `apps/dashboard/src/pages/Leads.tsx` | Done. Optional later: email search input. |
| P1-8 | ⬜ | Feature | **Klaviyo integration** — No way to push captured emails to Klaviyo. This is the most-requested integration for Shopify operators. | ✅ native | Webhook on `email_capture` event → POST to Klaviyo List API with operator's API key stored in tenant settings. |
| P1-9 | ⬜ | Feature | **Mailchimp integration** | ✅ native | Same pattern as Klaviyo — operator pastes API key + list ID in Settings → Integrations. |
| P1-10 | ✅ | Feature | **Real A/B testing** — Built: `variants` table, weighted sticky per-visitor allocation in the snippet (fit inline at 9218B — no lazy-load needed), per-variant results, dashboard A/B panel. Deferred niceties: statistical-significance indicator (we show a "Leading" badge at ≥20 impressions, not a formal p-value). | `variants.ts`, `ABPanel.tsx`, snippet `resolveVariant` | Done. Optional later: formal significance test, per-variant affiliate-slot editing in the panel. |
| P1-11 | ✅ | Feature | **Countdown timers** — Present in every popup competitor. Standard FOMO/urgency tool. Absent from all ScrollPop popup types. | ✅ native | Add `countdown` element type to the block builder. Snippet renderer handles `Date.now()` countdown display. |
| P1-12 | ✅ | Feature | **Gamified popups (spin-to-win)** — Lazy-loaded `spin.js` chunk (2.5 KB gzipped); main bundle stays under 10 KB. Canvas wheel renderer with weighted prize slices, coupon display + clipboard copy. Dashboard wizard entry point (Step 1 type picker). | `packages/snippet/src/spin.ts`, `dist/spin.js` | Done. Optional later: per-slice probability display in dashboard, A/B test spin vs standard popup. |
| P1-13 | ✅ | Feature | **Shopify App Embed Block** — Already built: `packages/shopify-app-embed/blocks/scrollpop.liquid` is a complete `head`-target embed with a public-key setting; Shopify CLI installed; dashboard has the install UI (Sites → App Embed Block tab). Code-complete; only needs `npx shopify app deploy` to the Partner app (ops step). | `packages/shopify-app-embed/` | Done (code). Deploy to Partner app when ready; then P1-14 (App Store submission). |
| P1-14 | ⬜ | Feature | **Shopify App Store submission** — 4.9★ Promolayer listing with 61 reviews is an inbound discovery channel ScrollPop has no equivalent of. All Shopify operators find tools via the App Store. | ✅ 4.9★ 61 reviews | Requires App Embed Block (P1-13) first. |
| P1-15 | ✅ | UX | **New user onboarding** — A new user lands on a blank Dashboard with empty KPI tiles and no prompt. No guided onboarding, no empty-state CTAs, no setup checklist. | ✅ implied by 25K sites | Add empty state to Dashboard: "Add your first site →", "Create your first campaign →". Consider a setup checklist widget. |
| P1-16 | ✅ | UX | **Billing upgrade throws 500** — `POST /billing/checkout` requires `STRIPE_PRICE_*` env vars not yet set. Any user clicking upgrade sees a server error. | `billing.ts:54–60` | Blocked by P0-2. Once Stripe is configured this resolves automatically, but add a graceful "Billing not yet available" state for pre-launch. |
| P1-17 | ✅ | Security | **Incomplete ReDoS protection in url_regex** — `isSafeRegex()` catches simple nested quantifier patterns but not alternation-based ReDoS (e.g. `([a-zA-Z]+)*`). A malicious operator can cause snippet to hang in visitor browsers. | `sanitize.ts:93` | Replace with a battle-tested ReDoS-safe validator (`safe-regex2` or equivalent). Add it as a zero-dep vendored check or run the regex with a `performance.now()` wall-clock timeout. |
| P1-18 | ✅ | Debt | **API integration tests** — 19 Vitest tests covering: event-field validation, tenant isolation (IDOR), coupon generation validation, auto-responder config validation, Stripe webhook signature rejection, billing URL allowlist logic, origin-based injection defence. | `apps/api/src/index.test.ts` | Done. All 19 passing. |

---

## P2 — Medium Priority

Real issues, not blocking launch, should be addressed in the first growth sprint.

### Security

| # | Status | Category | Item | Evidence | Notes |
|---|---|---|---|---|---|
| P2-1 | ✅ | Security | **No CSP header on API responses** | `index.ts:104` | Add `Content-Security-Policy: default-src 'none'` — API serves only JSON, so this is safe and adds defence in depth. |
| P2-2 | ✅ | Security | **Internal secret IP spoofing** — Addressed by policy: the code already only trusts `X-CF-Connecting-IP` when `INTERNAL_SECRET` matches, and CONTRIBUTING documents a 90-day rotation schedule. No further code fix exists short of rotating the shared secret. | `index.ts:397` | Done (policy). Rotate `INTERNAL_SECRET` quarterly per CONTRIBUTING. |
| P2-3 | ✅ | Security | **Client-controlled country field in event payload** — Direct POST to `/e` (not via Worker) accepts any `country` value, skewing geo analytics. | `index.ts:495` | Only trust the `country` field when the request arrives from the Worker (proven by INTERNAL_SECRET). Otherwise set `country: null` and rely on the Worker's `CF-IPCountry` enrichment. |
| P2-4 | ✅ | Security | **No audit log for admin operations** — Plan changes, tenant deletions, and sync operations leave no persistent record. | `admin.ts` | Write an `admin_audit_log` table row on every admin action: `who`, `action`, `target_tenant_id`, `before`, `after`, `ts`. |
| P2-5 | ✅ | Security | **Shopify access tokens stored in plaintext** — Already implemented: `shopify.ts` encrypts via `encryptToken()` on store and `decryptToken()` on use (AES-256-GCM, `token-crypto.ts`). Audit finding was stale. Requires `SHOPIFY_ENCRYPTION_KEY` set in Render. | `schema.ts:183`, `token-crypto.ts` | Done. Ensure `SHOPIFY_ENCRYPTION_KEY` is set in production. |
| P2-6 | ✅ | Security | **Admin sync limited to 500 Clerk users** — Duplicate of P3-8; fixed in the security sprint (admin Clerk sync now paginates). | `admin.ts` | Done (= P3-8). |

### Performance

| # | Status | Category | Item | Evidence | Notes |
|---|---|---|---|---|---|
| P2-7 | ✅ | Performance | **No `tenantId` index within TimescaleDB partitions** — Analytics queries do full-chunk scans within each partition. Will degrade with tenant count. | `analytics.ts` | `CREATE INDEX CONCURRENTLY ON events(tenant_id, ts DESC)` on the Neon production DB. |
| P2-8 | ✅ | Performance | **Admin tenant list N+1** — Two additional DB queries per tenant row to fetch owner email. | `admin.ts:95` | Rewrite with a single JOIN: `SELECT t.*, u.email, u.name FROM tenants t JOIN tenant_members tm ON ... JOIN users u ON ...`. |
| P2-9 | ✅ | Performance | **In-process purge-deleted.ts causes latency spikes** — Hardened in-process (chosen for safety: no extra service = no extra secret surface; destructive logic stays in one reviewed code path). Now bounded to 100 entities/statement, campaign+site deletes split, jittered start, backstopped by the 30s statement_timeout. Backlogs drain over hourly passes. | `db/purge-deleted.ts` | Done (in-process hardened). Revisit a dedicated cron only if event volume makes hourly bounded passes insufficient. |
| P2-10 | ✅ | Performance | **Campaign export streaming** — Replaced in-memory 100K fetch with cursor-paginated `Readable` stream (500-row batches, `lt(events.ts, cursor)`). DB connection never holds the full result set. | `campaigns.ts` | Done. |
| P2-11 | ✅ | Performance | **No query timeouts on Drizzle queries** — A slow analytics query can hold a connection indefinitely. | `db/client.ts` | Set `statement_timeout` on the postgres client: `postgres(url, { connection: { statement_timeout: 30000 } })`. |

### Features vs. Promolayer

| # | Status | Category | Item | Promolayer | Notes |
|---|---|---|---|---|---|
| P2-12 | ✅ | Feature | **Coupon code auto-generation** — `coupons` table (migration 0011 + RLS + boot self-heal), `POST /coupons/generate` bulk-generates codes with configurable prefix/discount/expiry, `GET /coupons` list, `DELETE /coupons/:id`. `discount_redeemed` ingest increments use counter (P3-9 partial). | `routes/coupons.ts`, `db/ensure-coupons.ts` | Done. Dashboard Coupons UI deferred to CampaignDetail. |
| P2-13 | ✅ | Feature | **Email auto-responders** — `auto_responder` jsonb column on campaigns (migration 0011), `GET/PUT /campaigns/:id/auto-responder` API. Ingest path fires Resend email on `email_capture` when enabled. Best-effort — never blocks ingest. | `routes/auto-responder.ts` | Done. Dashboard config UI deferred to CampaignDetail settings panel. |
| P2-14 | ⬜ | Feature | **Zapier integration** — No outbound webhook on events. | ✅ native | Add a webhook configuration to campaign settings. On qualifying events (`email_capture`, `conversion`), POST to the operator's webhook URL. This also covers the general "Webhook outbound" v2 roadmap item. |
| P2-15 | ✅ | UX | **Journeys and Experiments pages appear broken** — Both show placeholder content with no "coming soon" framing. They are URL-reachable and make the product look unfinished. | N/A | Add explicit "Coming soon" empty states with expected availability. Or gate behind feature flags so they don't appear in nav until ready. |
| P2-16 | ✅ | UX | **Agency multi-tenant: limitation documented** — Settings → Team tab displays a clear note that all members share one workspace and per-client segregation (separate orgs) is a planned Agency v2 feature. | `Settings.tsx` — Team tab | Done (short-term doc). Long-term: Clerk Orgs per client. |
| P2-17 | ✅ | Feature | **Team invitations UI** — Settings → Team tab (new): lists org members with roles, shows pending invitations with revoke button, invite form (email + role picker) via Clerk `organization.inviteMember()`. Agency limitation note included. | `Settings.tsx` — TeamTab component | Done. |
| P2-18 | ⬜ | Infra | **`api.scrollpop.online` custom domain** — API still served from `scroll-pop.onrender.com`. All internal references use the Render URL. | N/A | Add Cloudflare DNS CNAME → Render. Update `API_BASE_URL`, `SNIPPET_EDGE_URL` references. Cleaner and removes Render vendor lock-in from URLs. |
| P2-19 | ✅ | Security | **No rate limit on admin routes** | `admin.ts` | Add a dedicated lower rate limit (e.g. 20 req/min) on all `/api/v1/admin/*` routes. |

---

## P3 — Low Priority

Real issues but low urgency. Address during maintenance windows.

| # | Status | Category | Item | Evidence | Notes |
|---|---|---|---|---|---|
| P3-1 | ✅ | Debt | **`any` types in campaign activate/pause handlers** — Both handlers now typed as `FastifyRequest<{ Params: { id: string } }>` and `FastifyReply`. | `campaigns.ts` | Done. |
| P3-2 | ⬜ | Debt | **428 ESLint warnings in dashboard** | Dashboard-wide | Resolve incrementally: prioritize `no-explicit-any` and `rules-of-hooks` first. |
| P3-3 | ⬜ | Security | **R2 bucket on rate-limited r2.dev URL** — The snippet CDN and WP plugin download use the `pub-*.r2.dev` URL. Rate-limited and not recommended for production by Cloudflare. | `Sites.tsx:195` | Connect `cdn.scrollpop.online` as a custom domain on the `scrollpop-assets` R2 bucket. Update both URLs. |
| P3-4 | ⬜ | Security | **No session revocation mechanism** — Relies entirely on Clerk JWT TTL. A compromised token remains valid until it expires. | `tenant-context.ts` | For high-value operations (plan change, delete tenant), add a `last_sign_out_at` check or call Clerk's session revocation API. |
| P3-5 | ⬜ | Feature | **`scrollpop.online` marketing site** — No separate marketing site exists. Operators cannot find ScrollPop without a direct link. | ✅ Promolayer has full site | Separate Cloudflare Pages project. Exists as `site-plan/` in repo — needs deploying and content. |
| P3-6 | ✅ | Infra | **Pre-deploy runbook entry added** — MASTER.md §27 now has "Pre-Deploy Command Failed" section: diagnosis steps, manual migration procedure, rollback via `.down.sql`, warning against `drizzle-kit push` on prod. | `MASTER.md §27` | Done. |
| P3-7 | ⬜ | Scale | **`resolveCampaignMeta` cache is instance-local** — On 2+ Render instances, each has a cold cache. DB queries spike per instance on cold start. | `index.ts:408` | Move campaign meta cache to a Redis hash: `HGETALL sp_campaign_meta:{campaignId}` with 5-minute TTL. |
| P3-8 | ✅ | Scale | **Admin Clerk sync not paginated** — At >500 Clerk users, stale users past the limit won't be cleaned up. | `admin.ts:178` | Paginate with Clerk's cursor until response is empty. |
| P3-9 | ✅ | Feature | **Coupon validation on `/e` ingest** — `discount_redeemed` event looks up the code against the `coupons` table, rejects unknown/expired/exhausted codes, and atomically increments the `uses` counter. Best-effort, never blocks ingest. | `index.ts` | Done. |
| P3-10 | ⬜ | Feature | **Mobile-specific trigger overrides** — Promolayer calls out explicit mobile trigger customization. ScrollPop handles device targeting but has no per-device trigger param overrides. | Promolayer marketing | Allow different scroll % or dwell time thresholds for mobile vs desktop in the trigger config. |
| P3-11 | ⬜ | Debt | **`ensure-notifications.ts` and `ensure-partitions.ts` run a DB call on every cold start** — Adds latency to every new Render instance spin-up. | `index.ts:560,563` | Move to a startup probe that only runs the check once per deploy (cache a flag in Redis). Or convert to a proper migration. |
| P3-12 | ⬜ | Debt | **Conversion milestone Redis counter starts at zero from feature launch** — Historical conversions are not counted. Users who have existing conversions see a misleadingly low milestone count. | `index.ts:351` | On first `incr` (result = 1), backfill the counter from the DB `count(*)` of historical `conversion` events for that tenant, then continue incrementing. |

---

## Won't Build

Deliberately excluded. Do not add to any sprint.

| Item | Reason |
|---|---|
| Back-button capture | Google spam policy violation from Jun 15, 2026. Would cause de-indexing of customer sites. |
| SAML SSO | No enterprise customers. V3 at earliest. |
| Native iOS/Android SDKs | No demand signal. |
| ClickHouse migration | Only justified at >50M events/month. |
| Real-time social proof popups | Requires pub/sub infra. Complexity not justified now. |
| AI copy generation | Nice-to-have. Not a conversion driver at this stage. |
| Wix native app | Low ROI. Wix has tiny market share vs Shopify/WordPress. |
| Full white-labelling | V3. No enterprise customers. |

---

## Dependency Map

Some items must be completed in order.

```
P0-1 (rawBody bug fix)
  └── P0-2 (Stripe keys set)
        └── P1-16 (billing upgrade UX fixed automatically)

P0-3 (lead storage backend)
  └── P1-7 (lead capture UI)
        └── P2-13 (email auto-responders)

P1-13 (App Embed Block)
  └── P1-14 (Shopify App Store submission)

P1-10 (real A/B testing logic)
  └── P0-4 (A/B slider no longer deceives users — resolved)

P1-8 / P1-9 (Klaviyo / Mailchimp)
  └── P0-3 (lead storage — must exist first)

P2-12 (coupon auto-generation)
  └── P3-9 (coupon validation on ingest)
```

---

## Sprint Suggestions

Based on severity and dependency order.

### Sprint 1 — Revenue Gate (do this first)
P0-1, P0-2, P0-5, P1-4, P1-5

Fix the rawBody bug, configure Stripe, bust KV on activate/pause, fix the worst performance issue. Goal: billing works end-to-end.

### Sprint 2 — Core Product Parity
P0-3, P0-4, P1-7, P1-8, P1-9, P1-11

Lead storage + UI, Klaviyo, Mailchimp, countdown timers. Goal: email capture actually does something useful.

### Sprint 3 — Shopify Growth
P1-13, P1-14, P1-6, P1-17, P1-15

App Embed Block, App Store submission, thundering herd fix, ReDoS fix, onboarding. Goal: inbound discovery from Shopify App Store.

### Sprint 4 — Security & Stability Hardening
P1-1, P1-2, P1-3, P2-1 through P2-6, P2-7, P2-8, P2-9

Cross-tenant injection, open redirect, quota abuse, CSP, audit log, analytics indexes, admin N+1, purge job externalization.

### Sprint 5 — Feature Completeness
P1-10, P1-12, P2-12, P2-13, P2-14, P2-17

Real A/B testing, gamified popups, coupons, auto-responders, Zapier/webhook outbound, team invitations.

### Ongoing / Maintenance
P2-15 through P2-19, all P3 items — address during low-intensity periods between sprints.

---

*Last updated: June 4, 2026. Source: `CTO-AUDIT.md`. Update item status as work is completed.*
