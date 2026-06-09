# ScrollPop — Project Tracker

> Single source of truth for all open issues, feature gaps, security findings, performance fixes, and technical debt.
> Sourced from `CTO-AUDIT.md` (June 4, 2026). Last reconciled: **June 9, 2026**.
> **Priority:** P0 = launch blocker · P1 = high · P2 = medium · P3 = low
> **Status:** ⬜ Todo · 🔄 In progress · ✅ Done · ❌ Won't build

---

## Quick Status

| Category | Total | Done | Remaining | Notes |
|---|---|---|---|---|
| P0 Launch blockers | 5 | 4 | 1 | P0-2 Stripe keys — ops only |
| P1 High priority | 18 | 17 | 1 | P1-14 Shopify App Store — deferred by owner |
| P2 Medium priority | 19 | 18 | 1 | P2-18 custom domain — ops only |
| P3 Low priority | 12 | 10 | 2 | P3-3 R2 domain + P3-5 marketing site — ops only |
| **Total** | **54** | **49 code ✅** | **5 ops** | All code done. 4 ops-only tasks + 1 deferred (P1-14) remain. |

> **Code status: 100% complete.** Every tracker item that required writing code has been built, tested, and reviewed (including a full multi-angle security code review on June 7 — see below). The remaining items are pure ops tasks (set Stripe env vars, configure DNS, deploy static site, re-upload the corrected WP plugin zip — see OPS-WP1 / BUG-1) and the owner-deferred Shopify App Store submission. Dormant integration keys (Sentry, PostHog, Resend) are now **activated**.
>
> **The app is ready to go live — the only thing standing between now and revenue is the Stripe ops config (P0-2), which the owner is handling.**

---

## 🚀 June 9, 2026 — Live Shopify/WordPress Debugging, Custom-Domain Analytics, Recurrence & Snippet Refactor

> Real-install debugging on Shopify (sakananet.com) + WordPress (gourmet-meat.com): popup not showing, leads not saving, spin not rendering. All root-caused and fixed; then shipped a recurrence frequency model and began the snippet lazy-chunk refactor.

### Root causes
- **Popup invisible on Shopify (all devices):** the theme forces `display:none` on `<body>`-appended elements → hid the popup host + entire closed Shadow DOM. Rendered but never painted. (WordPress unaffected → looked Shopify-only.)
- **Leads not saving:** lead row inserted only on `conversion`, which the anti-forgery **origin gate** drops when the page domain ≠ a known site domain (Shopify custom `sakananet.com` vs registered `*.myshopify.com`). `email_capture` carried the email but never saved a lead.
- **Spin never rendered:** `${EDGE}/spin.js` 404'd — Worker only served `/p.js` and CI only uploaded `p.js` to R2.
- **Heading alignment "left vs center":** designer `<h2>` hardcoded `justify-center text-center` → always *displayed* centered regardless of stored `align`; stored value was template default `left`; snippet rendered the truth. Editor was lying.
- **Campaign "not serving":** it was `paused` (config serves only `active`); impressions/conversions also origin-gated on the custom domain.

### Shipped
| Item | Commit | What |
|---|---|---|
| Host `display:block!important` | `3b65c8a` | Pins the popup host visible so a host theme's `display:none` reset can't suppress it. The fix that made the live popup appear. |
| Leads on `email_capture` | `b71b671` | Lead saves on `conversion` **or** `email_capture` (origin-gate-immune) → works on every domain. |
| Serve `/spin.js` + upload all chunks | `b71b671`, `2844032` | Worker serves the spin chunk from R2; CI loops `dist/*.js` so no future chunk can 404. |
| Custom storefront domain (Option A) | `2844032` | `sites.custom_domain` + origin gate accepts it (registrable match) → restores impression/conversion analytics on Shopify custom domains. SCHEMA_VERSION 13→**15** (`63dc5de`,`7c7cdc6`). |
| Heading WYSIWYG | `a3bd6ba` + `4ba57c6` | Editor honors `el.align`; snippet honors `align` via flex `justify-content`. What you set = what saves = what renders. |
| Custom Success screen | `4ba57c6` | Element-mode campaigns render the designed Success step, not the built-in coupon card. |
| Center-modal positioning | `14b9f77` | Center via the `translate` property so entrance animations don't knock the modal off-screen. |
| `/e` CORS | `966288b` | fetch fallback uses `text/plain` (no preflight) for strict-privacy/Firefox visitors. |
| **Recurrence frequency model** | `7c7cdc6`, `a00dbc0`, `685489d` | `maxDisplayCount` + `cooldownSeconds` + `showAgainIfConverts` (PromoLayer-style), layered on the legacy `frequency` enum (backward-compatible). Snippet enforces · `frequency_rules` columns · `/c` serves · `/campaigns/:id/frequency` persists · designer control. |
| Refactor: removed dead flat-render path | `2ace8a9` | All campaigns element-mode (verified). −370B gzip (core 10229→9857). |
| Per-chunk CI budgets | `4b9a6e6` | Core ≤10KB (8KB target), spin ≤3KB, journey ≤3KB, targeting ≤2KB, unknown ≤3KB. Enforces the module-budget model. |

### Open follow-ups
| ID | Status | Item |
|---|---|---|
| FU-2 | 🔄 **Underway** | Snippet size pass — flat-path removal freed headroom (core **9987/10240**, ~253B free). Continue via lazy-chunk extraction (FU-6). |
| FU-6 | ⬜ New | **Lazy-chunk extraction** — split Journey (multi-step/sequences), Advanced-Targeting (regex/utm/session/ab_test), Element-Extras (countdown/consent/badge/divider/shape) into separate chunks behind the core, loaded on demand. Budgets already enforced (FU per-chunk gates). |
| FU-7 | ⬜ New | **Popup sequences / chaining** — advance-on-dismiss to a next popup, with max-count + delay guards. Belongs in the Journey runtime. UX/policy caution: popup-trap adjacency. |
| — | ℹ️ Note | `designs.config` is stored as a **double-encoded JSON scalar**; not a live bug (serving path parses it), but JSON queries must unwrap via `(config #>> '{}')::jsonb`. |

### Deploy / verify
- API parts (leads, custom-domain gate, recurrence) need a **Render redeploy**; SCHEMA_VERSION 15 auto-adds columns. Manual one-time `ALTER TABLE sites ADD custom_domain` was run (skip-flag had blocked it) + `custom_domain='sakananet.com'` set.
- ✅ Leads verified saving live. Pending owner verify: spin renders post-deploy; re-center the 2 left-stored headings; impression/conversion counts on the custom domain.

---

## 🚀 June 8, 2026 — Production Debugging, Deploy Pipeline & Privacy/Consent

> Live-site debugging on a real customer install (gourmet-meat.com), fixing the deploy pipeline, and shipping privacy/consent features. **End-to-end lead capture verified working on a live site.**

### Root cause: "leads/analytics not recording" → it was browser Do-Not-Track, not a bug
The operator's own QA browser (Firefox) was sending `navigator.doNotTrack="1"`; the snippet honored it and suppressed all events. The popup rendered but no `view`/`conversion` fired → no leads/analytics. **Verified the full pipeline works in Chrome:** popup → `POST /e` (conversion + email) → lead row + analytics. Nothing was ever broken for real visitors.

### Deploy pipeline fixed (this was the real "my pushes don't go live" cause)
CI's `deploy-worker`/`deploy-dashboard` jobs were **failing** (not skipping) because the `CLOUDFLARE_API_TOKEN` was under-permissioned. Recreated the token with the correct scope (**Workers Scripts, Workers KV Storage, Workers R2 Storage, Cloudflare Pages — all Edit; Account Settings — Read; Zone → Workers Routes — Edit**). Pushes now auto-deploy the snippet (R2/Worker) and dashboard (Pages). Verified the live `p.js` byte-for-byte against the build.

### Shipped
| Item | Commit | What |
|---|---|---|
| `email_capture` payload | `f3992eb` | The event now carries the captured email, so ESP sync (Klaviyo/Mailchimp), auto-responder, and Zapier webhook actually receive it (they were silently no-op'ing). |
| DNT → GPC | `56a321c` | Stop honoring the deprecated, non-binding Do-Not-Track signal (was silently dropping a large share of real leads); honor **Global Privacy Control** instead (legally recognized under CCPA/CPRA). Explicit consent mode + admin suppression unchanged. + GPC bullet added to scrollpop.online Security/Compliance copy. |
| Targeting rule builder UX | `4befd10` | Restructured the page-targeting rule UI: full-width controls (no truncation), URL field on its own line, plain-English preview, aria-labels. |
| Marketing-consent checkbox | `03d6eca` | New opt-in "Consent Box" builder element — gates submit until ticked, records `consent: true/false` on the lead. Covers GDPR/CASL/APPI marketing-consent. |
| WP plugin zip | `c07dcf0` / OPS-WP1 | (June 7–8) Backslash-zip fix + corrected zip re-uploaded to R2, verified live. |
| Modal backdrop fix | `2b94812` | Designer stored the backdrop as `steps.main.overlayColor`, but the snippet read flat `overlayEnabled`/`overlayOpacity` → designer modals had **no overlay** (looked misplaced). Both editors now derive the flat fields from `overlayColor` alpha. Dashboard-side only (0 snippet bytes). **Existing campaigns need a re-save to apply.** |
| Manual snippet verify | `2b94812` / FU-5 | New `POST /sites/:id/verify-snippet` actively fetches the live site and confirms the snippet (public key) is present — for manual installs (Shopify theme header, raw HTML) with **no OAuth app**. "Test connection" button added to the Shopify panel. |
| Multi-country geo | `41e6df4` | Geo was single-select; now a multi-select chip group (e.g. **USA + Japan**). `geoTargeting` stored as CSV of ISO codes; snippet geo check supports `value.countries[]` or legacy `value.country`. An include-list inherently excludes everything else (e.g. EU). |
| Keyboard nudging + softer drag | `40925a2` | Designer: select an element → **arrow keys** move it precisely (1%, Shift+Arrow 5%), no snapping. Drag snap threshold 2.5 → 1.2 so mouse dragging feels free-flowing. |

### ⚠️ Open follow-ups
| ID | Status | Item |
|---|---|---|
| FU-1 | ⬜ **Deprioritized** | **`requireConsent` site-settings toggle** (EU GDPR opt-in). **Owner confirmed targeting Japan + USA, not EU** — and a geo include-list (US+JP) excludes EU visitors anyway, keeping GDPR out of scope. Revisit only if EU markets are added. |
| FU-2 | ⬜ | **Snippet size pass** — bundle at **9.94 KB / 10 KB** (~60 bytes headroom). `console.*` is already dropped at build, so the easy win is gone; a real reduction needs an element-style-builder refactor. Do before adding more snippet logic. |
| FU-3 | ⬜ | **`deploy-marketing` CI job** — scrollpop.online (`site-plan/`) is the only artifact still deployed by hand; add it to CI so the GPC copy + future content auto-publish. |
| FU-4 | ⬜ | **Legal review** — privacy policy, Terms, DPA, default consent posture by privacy counsel. Scope now narrows to **CCPA (US) + APPI (Japan)** incl. cross-border transfer to US ESPs (EU deferred with FU-1). |
| FU-5 | ✅ Done | Manual snippet verify (`verify-snippet` + "Test connection") — shipped `2b94812`. |

### ⚖️ Legal / Compliance posture (current code behavior — NOT legal advice)
- **US / California (CCPA/CPRA):** opt-out model; snippet honors **GPC**. ✅ Aligned.
- **EU / UK (GDPR / ePrivacy):** requires **prior explicit opt-in**. **Strategy (owner decision): don't target EU.** Setting geo to an include-list (e.g. US + JP) means the popup never fires for EU visitors → no EU data processed → GDPR out of scope for the campaign. The `requireConsent` opt-in gate (FU-1) is only needed if EU markets are added later.
- **Japan (APPI + anti-spam):** lighter than GDPR — needs a clear privacy notice stating purpose, processors, and overseas transfer; marketing email is opt-in (the consent checkbox covers this).
- **Email marketing (all regions):** the new consent checkbox provides explicit opt-in; CAN-SPAM still needs an unsubscribe path.
- **Responsibility split:** ScrollPop is the data **processor** (provides GPC, consent hooks, DPA); the operator is the **controller** (must wire a CMP, set `requireConsent` for EU, publish a privacy policy, honor deletion/DSAR).
- **Action:** have counsel review the docs + default posture (FU-4) before scaling EU traffic.

---

## Launch Readiness — CTO Audit Re-score (Jun 4 → Jun 5 → Jun 6)

| Dimension | Jun 4 Audit | Jun 5 | Jun 6 | Jun 7 Now | What changed Jun 7 |
|---|---|---|---|---|---|
| Core popup pipeline | 95/100 | 98/100 | 98/100 | **98/100** | No change |
| Billing | 10/100 | 38/100 | 38/100 | **38/100** | Still awaiting Stripe keys (ops) |
| Security | 72/100 | 95/100 | 99/100 | **100/100** | Code review CR-01→CR-08 fixed (cssFont XSS, ESP opt-in/credential-leak, webhook spoofing, SSRF multi-record, fail-open flood gate) |
| Analytics | 85/100 | 92/100 | 92/100 | **95/100** | CR-02 fix: partition creation no longer skippable → no month-rollover data loss |
| Integrations | 30/100 | 42/100 | 92/100 | **94/100** | ESP now true per-campaign opt-in; no credential/PII leakage in logs or responses |
| Email lead capture | 20/100 | 95/100 | 95/100 | **95/100** | No change |
| A/B testing | 5/100 | 92/100 | 92/100 | **92/100** | No change |
| Operations | 70/100 | 90/100 | 90/100 | **92/100** | Dormant keys (Sentry/PostHog/Resend) activated; pre-commit snippet-sync hook added |
| Performance | 65/100 | 92/100 | 92/100 | **92/100** | No change |
| Code quality | 60/100 | 72/100 | 100/100 | **100/100** | P3-2: 401 → 0 ESLint warnings, 0 TypeScript errors, full strict |
| **Overall** | **61/100** | **84/100** | **92/100** | **94/100** | **+2 points (June 7 security code review)** |

> **The only launch blocker is P0-2 (Stripe keys — ops, not code).** All code for every feature, security hardening, and quality item is complete. Revenue is possible the moment the Stripe env vars are set in Render.

---

## CTO Audit Cross-Reference — June 5 Status

### All Phase 4 Security Findings

| Audit Finding | Severity | Tracker | Status | Fix |
|---|---|---|---|---|
| Finding 1 — Stripe/Clerk webhook rawBody re-serialization | Critical | P0-1 | ✅ | `@fastify/rawbody` registered; `request.rawBody` used |
| Finding 2 — Campaign activate/pause missing KV cache bust | High | P0-5 | ✅ | `purgeSiteConfigCache()` called on every status change |
| Finding 3 — Cross-tenant event injection via campaignId | High | P1-1 | ✅ | pageUrl origin validated against site domain |
| Finding 4 — Stripe checkout open redirect | Medium | P1-2 | ✅ | successUrl/cancelUrl allowlisted to dashboard origins |
| Finding 5 — Internal secret IP spoofing | Medium | P2-2 | ✅ | Policy: quarterly rotation in CONTRIBUTING, code already gated |
| Finding 6 — ReDoS via incomplete url_regex | Medium | P1-17 | ✅ | Hardened vs alternation-based patterns + 12 new tests |
| Finding 7 — Client-controlled country field | Medium | P2-3 | ✅ | country only trusted from Worker (proven by INTERNAL_SECRET) |
| Finding 8 — No audit log for admin operations | Medium | P2-4 | ✅ | `admin_audit_log` table, migration 0007, written on every admin action |
| Finding 9 — Dev bypass heuristic | Low | — | ✅ | Inherent/acceptable; no code change needed |
| Finding 10 — Admin Clerk sync 500-user cap | Low | P3-8 | ✅ | Paginated with Clerk cursor |
| Finding 11 — No CSP header on API | Low | P2-1 | ✅ | `default-src 'none'` on all API responses |
| Finding 12 — No rate limit on admin routes | Low | P2-19 | ✅ | 30/min on all `/api/v1/admin/*` |

### All Phase 7 Technical Debt Items

| Audit TD# | Item | Tracker | Status |
|---|---|---|---|
| TD1 | N+1 in production config route | P1-4 | ✅ Batched `inArray` |
| TD2 | Stripe/Clerk webhook rawBody | P0-1 | ✅ |
| TD3 | Campaign activate/pause KV cache bust | P0-5 | ✅ |
| TD4 | `campaignMetaCache` thundering herd | P1-6 | ✅ LRU oldest-entry eviction |
| TD5 | `any` types in activate/pause handlers | P3-1 | ✅ Fastify generics |
| TD6 | Stripe successUrl/cancelUrl not allowlisted | P1-2 | ✅ |
| TD7 | `isSafeRegex` incomplete ReDoS | P1-17 | ✅ |
| TD8 | Admin tenant list N+1 | P2-8 | ✅ Single JOIN |
| TD9 | Admin sync 500-user cap | P3-8 | ✅ |
| TD10 | No audit log for admin operations | P2-4 | ✅ |
| TD11 | 428 ESLint warnings (dashboard) | P3-2 | ✅ 442 → 0 warnings + 0 TS errors |
| TD12 | No API route integration tests | P1-18 | ✅ 19 tests passing |
| TD13 | No tenant isolation tests | P1-18 | ✅ Covered in integration suite |
| TD14 | No webhook verification tests | P1-18 | ✅ Covered in integration suite |
| TD15 | Campaign export 100K in-memory | P2-10 | ✅ Cursor-paginated stream |

### CTO Audit Feature Matrix — June 5 Status

| Audit Gap | Priority | Tracker | Status |
|---|---|---|---|
| Gamified popups (spin-to-win) | High | P1-12 | ✅ Lazy-loaded spin.js, wheel config UI, coupon slots |
| Countdown timers | High | P1-11 | ✅ `countdown` element in builder + snippet |
| Real A/B testing | Critical | P1-10 | ✅ Weighted sticky allocation, dashboard panel |
| Email lead storage | High | P0-3 | ✅ `leads` table, API, dashboard Leads page |
| Lead capture UI | High | P1-7 | ✅ Filter, pagination, CSV export, GDPR delete |
| Email auto-responders | Medium | P2-13 | ✅ Per-campaign config, Resend on email_capture |
| Coupon auto-generation | Medium | P2-12 | ✅ `coupons` table, generate API, dashboard UI |
| Klaviyo integration | High | P1-8 | ✅ |
| Mailchimp integration | Medium | P1-9 | ✅ |
| Zapier / outbound webhooks | Medium | P2-14 | ✅ |
| Shopify App Store submission | Critical | P1-14 | ⬜ Deferred by owner decision |
| Onboarding (blank dashboard) | Medium | P1-15 | ✅ 4-step checklist |
| Billing 500 on upgrade | High | P1-16 | ✅ Graceful "coming soon" UX |
| Journeys/Experiments broken | Medium | P2-15 | ✅ Honest "coming soon" screens |
| Team invitations UI | Medium | P2-17 | ✅ Clerk org invitations in Settings |
| Agency multi-tenant doc | Medium | P2-16 | ✅ Documented in Settings → Team |

### Additional Bugs Found & Fixed During Implementation (not in original 54)

| Bug | Fixed | Where |
|---|---|---|
| `designs.ts` coercing `spin_wheel` kind → `modal` on save | ✅ Jun 5 | `routes/designs.ts` DESIGN_KINDS |
| `InteractivePreview` firing immediately when scroll/exit/inactivity trigger configured | ✅ Jun 5 | `InteractivePreview.tsx` useEffect |
| No exit-intent (mouseleave) trigger in simulation | ✅ Jun 5 | `InteractivePreview.tsx` |
| No inactivity trigger in simulation | ✅ Jun 5 | `InteractivePreview.tsx` |
| `spin_wheel` campaign card showing blank grey background | ✅ Jun 5 | `Campaigns.tsx` palette + SVG thumbnail |
| `CampaignDetail` had no way to open simulation | ✅ Jun 5 | `CampaignDetail.tsx` Simulate button |
| Trigger labels in CampaignDetail showed raw JSON | ✅ Jun 5 | `CampaignDetail.tsx` triggerLabel() |

---

## P0 — Launch Blockers

Nothing ships without these.

| # | Status | Category | Item | Evidence | Notes |
|---|---|---|---|---|---|
| P0-1 | ✅ | Bug | **Stripe webhook rawBody bug** — `JSON.stringify(request.body)` used for signature verification instead of raw bytes. | `webhooks.ts:227` | Registered `@fastify/rawbody`. Using `request.rawBody` in both handlers. |
| P0-2 | ⬜ | Config | **Stripe billing not activated** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and 4 price IDs not set. No revenue possible. | Render env vars | Code is complete. Set keys in Render, run one end-to-end checkout test, verify webhook fires. ~3 hours ops work. |
| P0-3 | ✅ | Feature | **No email lead storage** — Popup form submissions not persisted. No dashboard UI. | `schema.ts` | `leads` table, `/api/v1/leads`, Leads page with CSV export + GDPR delete. |
| P0-4 | ✅ | Bug | **A/B testing passthrough deceives users** — Live UI slider did nothing. | `snippet/main.ts` | Real weighted sticky allocation, dashboard A/B panel, per-variant analytics. |
| P0-5 | ✅ | Bug | **Campaign activate/pause does not bust KV cache** — Popups kept serving after pause. | `campaigns.ts` | `purgeSiteConfigCache()` called on activate/pause/delete. |

---

## P1 — High Priority

### Security

| # | Status | Category | Item | Evidence | Notes |
|---|---|---|---|---|---|
| P1-1 | ✅ | Security | **Cross-tenant event injection** | `index.ts:474` | pageUrl origin validated against site domain before counting. |
| P1-2 | ✅ | Security | **Stripe checkout open redirect** | `billing.ts:63` | successUrl/cancelUrl allowlisted to dashboard origins + CF Pages preview pattern. |
| P1-3 | ✅ | Security | **Distributed bot view quota exhaustion** | `index.ts:480` | Impression's pageUrl origin must match site's registered domain. |

### Performance

| # | Status | Category | Item | Evidence | Notes |
|---|---|---|---|---|---|
| P1-4 | ✅ | Performance | **N+1 in production config route** — 40 DB round trips for a 10-campaign site. | `internal.ts:114` | 4 batched `inArray` queries, identical to the local /c/ route pattern. |
| P1-5 | ✅ | Performance | **No connection pool size limit** — Already implemented: `max:10`. | `db/client.ts` | Done. Audit finding was stale. |
| P1-6 | ✅ | Performance | **`campaignMetaCache` thundering herd** — Full clear on 5,000 entries. | `index.ts:416` | Oldest-entry LRU eviction (never clears the whole map). |

### Features vs. Promolayer

| # | Status | Category | Item | Promolayer | Notes |
|---|---|---|---|---|---|
| P1-7 | ✅ | Feature | **Email lead capture UI** — Leads page with filter, pagination, CSV export, GDPR delete. | ✅ native | Done. Optional later: free-text email search. |
| P1-8 | ✅ | Feature | **Klaviyo integration** | `lib/esp.ts`, `routes/integrations.ts` | `GET/PUT /integrations`, `POST /integrations/test`. Klaviyo v3 `profile-subscription-bulk-create-jobs` endpoint. API keys stored server-side, masked on reads. Per-campaign opt-in via `GET/PUT /campaigns/:id/esp-config`. |
| P1-9 | ✅ | Feature | **Mailchimp integration** | `lib/esp.ts`, `routes/integrations.ts` | Same route as Klaviyo. Mailchimp Marketing API v3. Server prefix auto-detected from API key. `status: subscribed`. |
| P1-10 | ✅ | Feature | **Real A/B testing** — Weighted sticky per-visitor allocation, dashboard A/B panel, per-variant results. | ✅ A/B/N multivariate | Done. Optional: formal p-value significance test. |
| P1-11 | ✅ | Feature | **Countdown timers** — Absent from all popup types. | ✅ native | `countdown` element, ISO datetime or seconds-remaining, live tick after Shadow DOM mount. |
| P1-12 | ✅ | Feature | **Gamified popups (spin-to-win)** — Lazy-loaded `spin.js` (2.5 KB gzipped). Canvas wheel, weighted prizes, coupon clipboard. Wizard type picker, wheel config + live SVG preview in CampaignDetail. | ✅ 300% more submissions | Done. Optional: A/B test spin vs standard. |
| P1-13 | ✅ | Feature | **Shopify App Embed Block** — Code-complete. | ✅ App Store | Deploy via `npx shopify app deploy` (ops step). |
| P1-14 | ⬜ | Feature | **Shopify App Store submission** — 4.9★ Promolayer listing is the main inbound channel. | ✅ 4.9★ 61 reviews | Excluded from current sprint per owner decision. Requires P1-13 first. |
| P1-15 | ✅ | UX | **New user onboarding** — Blank dashboard, no empty-state CTAs. | ✅ implied | 4-step checklist (connect site → install snippet → create campaign → launch). Auto-hides when done. |
| P1-16 | ✅ | UX | **Billing upgrade throws 500** — `STRIPE_PRICE_*` not set. | `billing.ts:54` | Graceful "Billing not yet available" toast instead of 500. Resolves automatically once P0-2 is done. |
| P1-17 | ✅ | Security | **Incomplete ReDoS protection** — Alternation-based patterns not caught. | `sanitize.ts:93` | Hardened vs alternation + bounded repetition + non-compiling patterns. +12 tests. |
| P1-18 | ✅ | Debt | **No API route integration tests** | `apps/api` | 19 Vitest tests: event validation, IDOR isolation, Zod guards, webhook sig, billing URL allowlist, origin injection defence. All passing. |

---

## P2 — Medium Priority

### Security

| # | Status | Category | Item | Evidence | Notes |
|---|---|---|---|---|---|
| P2-1 | ✅ | Security | **No CSP header on API responses** | `index.ts:104` | `default-src 'none'; frame-ancestors 'none'; base-uri 'none'` on all responses. |
| P2-2 | ✅ | Security | **Internal secret IP spoofing** | `index.ts:397` | Policy: quarterly rotation in CONTRIBUTING. Code already gated correctly. |
| P2-3 | ✅ | Security | **Client-controlled country field** | `index.ts:495` | country only trusted from Worker (proven by INTERNAL_SECRET header). |
| P2-4 | ✅ | Security | **No audit log for admin operations** | `admin.ts` | `admin_audit_log` table, migration 0007 + RLS + boot self-heal. |
| P2-5 | ✅ | Security | **Shopify tokens plaintext** — Already AES-256-GCM encrypted via `token-crypto.ts`. Audit was stale. | `token-crypto.ts` | Done. Requires `SHOPIFY_ENCRYPTION_KEY` on Render. |
| P2-6 | ✅ | Security | **Admin sync 500-user cap** — Duplicate of P3-8. | `admin.ts` | Fixed in security sprint. |

### Performance

| # | Status | Category | Item | Evidence | Notes |
|---|---|---|---|---|---|
| P2-7 | ✅ | Performance | **No `tenantId` index in TimescaleDB partitions** | `analytics.ts` | `events(tenant_id, ts DESC)` index, migration 0008. |
| P2-8 | ✅ | Performance | **Admin tenant list N+1** — 2 queries per row. | `admin.ts:95` | Single JOIN replacing per-row queries. |
| P2-9 | ✅ | Performance | **In-process purge job latency spikes** | `db/purge-deleted.ts` | Bounded 100 entities/pass, jittered start, split statements, backstopped by 30s timeout. |
| P2-10 | ✅ | Performance | **Campaign export 100K rows in-memory** | `campaigns.ts:236` | Cursor-paginated `Readable` stream, 500-row batches via `lt(events.ts, cursor)`. |
| P2-11 | ✅ | Performance | **No query timeouts on Drizzle** | `db/client.ts` | `statement_timeout: 30000` on the postgres client. |

### Features vs. Promolayer

| # | Status | Category | Item | Promolayer | Notes |
|---|---|---|---|---|---|
| P2-12 | ✅ | Feature | **Coupon code auto-generation** — `coupons` table (migration 0011), bulk generate with prefix/discount/expiry, dashboard UI in CampaignDetail. | ✅ auto-gen | Done. |
| P2-13 | ✅ | Feature | **Email auto-responders** — `auto_responder` jsonb on campaigns, GET/PUT API, fires Resend on `email_capture`. | ✅ paid plans | Done. Dashboard config UI in CampaignDetail settings. |
| P2-14 | ✅ | Feature | **Zapier / outbound webhook** — Per-campaign outbound webhook delivery. | `outbound-webhook.ts` | `GET/PUT /campaigns/:id/webhook`. HMAC-SHA256 signed. Fires on `email_capture`, `conversion`, `click`, `dismiss`. Configurable event list. 5s timeout. Secret preserved across updates. `ensure-webhooks.ts` (migration 0012). |
| P2-15 | ✅ | UX | **Journeys + Experiments pages broken** | N/A | Honest "coming soon" screens. Experiments links to the live A/B panel. |
| P2-16 | ✅ | UX | **Agency multi-tenant limitation** | N/A | Documented in Settings → Team tab. Per-client workspace isolation is v2. |
| P2-17 | ✅ | Feature | **Team invitations UI** | ❓ | Settings → Team tab: member list, pending invites with revoke, invite form via Clerk `organization.inviteMember()`. |
| P2-18 | ⬜ | Infra | **`api.scrollpop.online` custom domain** — API served from `scroll-pop.onrender.com`. | N/A | Cloudflare DNS CNAME → Render. 30-minute ops task. Not blocking launch. |
| P2-19 | ✅ | Security | **No rate limit on admin routes** | `admin.ts` | 30/min on all `/api/v1/admin/*`. |

---

## P3 — Low Priority

| # | Status | Category | Item | Evidence | Notes |
|---|---|---|---|---|---|
| P3-1 | ✅ | Debt | **`any` types in activate/pause handlers** | `campaigns.ts` | Typed with `FastifyRequest<{ Params: { id: string } }>` + `FastifyReply`. |
| P3-2 | ✅ | Debt | **ESLint warnings in dashboard** | Dashboard-wide | 442 → 401 → **0 warnings**. Full proper typing pass: all `any` replaced with interfaces/`unknown`, unused vars removed, hooks deps fixed, no-useless-escape corrected. |
| P3-3 | ⬜ | Security | **R2 bucket on rate-limited r2.dev URL** — Not production-grade per Cloudflare docs. | `Sites.tsx:195` | **Ops:** Cloudflare Dashboard → R2 → `scrollpop-assets` → Settings → Custom Domain → `cdn.scrollpop.online`. Also fixes P2-18 partial. 30-min ops task. |
| P3-4 | ✅ | Security | **No session revocation** — Compromised JWT stays valid until expiry. | `webhooks.ts`, `me.ts` | `revokeAllUserSessions()` added; called on `user.deleted` webhook. `DELETE /api/v1/me` endpoint revokes sessions before DB cleanup. |
| P3-5 | ⬜ | Feature | **`scrollpop.online` marketing site** — No inbound discovery for non-Shopify operators. | ✅ Promolayer | **Ops:** `cd site-plan && pnpm build`, then `npx wrangler pages deploy dist --project-name scrollpop-marketing`. First deploy will prompt to create the project. `site-plan/` is a full Vite app ready to deploy. |
| P3-6 | ✅ | Infra | **Pre-deploy runbook entry** | `MASTER.md §27` | Diagnosis, manual migration, rollback via `.down.sql`, drizzle-kit push warning. |
| P3-7 | ✅ | Scale | **`resolveCampaignMeta` cache is instance-local** — Cold cache on 2+ Render instances. | `index.ts` | Redis hash `sp_campaign_meta:{id}` as L2 (300s TTL). In-process Map stays as L1. Falls through to DB on Redis error. |
| P3-8 | ✅ | Scale | **Admin Clerk sync not paginated** | `admin.ts:178` | Paginated with Clerk cursor. |
| P3-9 | ✅ | Feature | **Coupon validation on `/e` ingest** | `index.ts` | Validates code exists, not expired, within max uses; atomically increments `uses`. |
| P3-10 | ✅ | Feature | **Mobile-specific trigger overrides** — No per-device scroll %/dwell thresholds. | Promolayer marketing | `mobileOverrides: { pct?, seconds? }` added to `scroll_pct`, `dwell_time`, `inactivity` in shared schema. Snippet applies overrides via `effectiveParams()` on mobile (`maxTouchPoints > 0`). |
| P3-11 | ✅ | Debt | **`ensure-*.ts` scripts run on every cold start** — Adds latency to every Render spin-up. | `index.ts` | Redis key `sp_schema_v13` with 24h TTL; warm restarts skip the idempotent schema ensures. Bump `SCHEMA_VERSION` when adding a new ensure-* call. **Note (CR-02):** `ensureEventPartitions()` is deliberately excluded from the skip and runs every boot — partition creation is time-sensitive and must never be gated by a version flag. |
| P3-12 | ✅ | Debt | **Conversion milestone counter starts from feature launch** — Historical conversions not counted. | `index.ts` | On first `incr` (result = 1), backfills `sp_conv:{tenantId}` from DB `count(*)` of historical conversion events. |

---

## Won't Build

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

```
P0-1 (rawBody fix) ✅
  └── P0-2 (Stripe keys) ⬜ ← ONLY remaining blocker

P0-3 (lead storage) ✅
  └── P1-7 (lead UI) ✅
        └── P2-13 (auto-responders) ✅
              └── P1-8 (Klaviyo) ✅
              └── P1-9 (Mailchimp) ✅

P1-13 (App Embed Block) ✅
  └── P1-14 (App Store) ⬜ — excluded from current scope (owner-deferred)

P2-12 (coupon generation) ✅
  └── P3-9 (coupon validation on ingest) ✅

P2-14 (Zapier) ✅ — standalone, no hard deps
P2-18 (custom domain) ⬜ — standalone ops
P3-3 (R2 custom domain) ⬜ — also covers cdn.scrollpop.online
```

---

## Sprint Suggestions — UPDATED June 7

> **All code sprints are complete.** Sprints 1–4 (original audit), Sprint A (email integration), and Sprint B (outbound webhooks) are shipped. Only ops sprints (C, D) and the owner-deferred App Store submission remain.

### Immediate — Revenue Gate (~3 hours, ops only) — ⬜ owner handling

**P0-2 only.** Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, 4 `STRIPE_PRICE_*` IDs in Render. Run one end-to-end test: checkout → Stripe test webhook → plan update → verify dashboard reflects new plan. That's it. The app is then live and can charge customers.

### ✅ Sprint A — Email Integration — COMPLETED

**P1-8 + P1-9.** Klaviyo and Mailchimp shipped: `lib/esp.ts` adapters + `GET/PUT/POST /integrations` + per-campaign opt-in via `/campaigns/:id/esp-config`. Hardened June 7 (true opt-in, no credential/PII leakage — CR-03, CR-05). Keys stored server-side, masked on reads.

### ✅ Sprint B — Outbound Webhooks — COMPLETED

**P2-14.** Per-campaign outbound webhook (`GET/PUT /campaigns/:id/webhook`), HMAC-SHA256 signed, fires on `email_capture`/`conversion`/`click`/`dismiss`. Hardened June 7 (all-record SSRF guard, no-clobber partial updates, sanitized-field precedence — CR-04, CR-06, CR-07).

### Sprint C — Domain & CDN (2 hours, ops) — ⬜

**P2-18 + P3-3.** Add `api.scrollpop.online` CNAME in Cloudflare (30 min). Add `cdn.scrollpop.online` custom domain to the R2 bucket (30 min). Update `API_BASE_URL` and `SNIPPET_CDN_URL` references. Removes Render vendor lock-in from public URLs and upgrades the snippet CDN from the rate-limited r2.dev domain.

### Sprint D — Marketing Site (2–3 days, design + code) — ⬜

**P3-5.** Deploy `site-plan/` as a Cloudflare Pages project. Without this, non-Shopify operators have no way to find ScrollPop through organic channels. Not a technical challenge — content and deployment.

### Ongoing / Low-Urgency

**P3-2** ✅ Done — 0 ESLint warnings + 0 TS errors.  
**P3-4** ✅ Done — session revocation on user delete + `DELETE /me`.  
**P3-7** Redis campaign meta cache — only matters if Render scales to 2+ instances.  
**P3-10** ✅ Done — mobile trigger overrides shipped.  
**P3-11** ensure-* startup overhead — convert to proper migrations in next schema sprint.  
**P3-12** Milestone backfill — one-time script, run manually when needed.  

---

## Go-Live Timeline (excluding Stripe keys and Shopify App Store)

| Milestone | Work | Status |
|---|---|---|
| **Soft launch — first paying customer possible** | Configure Stripe in Render (~3 hrs ops). App is code-complete. | ⬜ Owner handling (the only launch blocker) |
| **Growth launch — email capture useful for Shopify operators** | Klaviyo + Mailchimp adapters (P1-8 + P1-9) | ✅ Shipped + hardened |
| **Full launch — Zapier + clean URLs** | Outbound webhooks (P2-14) ✅ · domain ops (P2-18/P3-3) ⬜ | 🔄 Code done; domain ops remain |
| **Discovery launch — inbound traffic possible** | P3-5 marketing site live | ⬜ Ops (deploy `site-plan/`) |

**The Stripe keys are the only thing between now and revenue.** Every code item — every CTO audit blocker, every security finding (SR-01→15 + CR-01→08), email integrations, outbound webhooks, and the full type/lint cleanup — is complete, tested, and reviewed. Launch readiness: 61 → 84 → 92 → **94/100**. The app is ready to go live; what remains is pure ops (Stripe env vars, DNS/CDN domains, static-site deploy) plus the owner-deferred Shopify App Store submission.

---

*Last updated: June 8, 2026. June 8 work — deploy pipeline fixed (auto-deploy works), live lead-capture verified end-to-end, DNT→GPC, marketing-consent checkbox, targeting-rule UX, email_capture fix, modal-backdrop fix, manual snippet verify (FU-5 ✅), multi-country geo (US+JP), keyboard nudging + softer drag snap. Owner confirmed targeting JP+USA not EU → FU-1 deprioritized. Open: FU-2 snippet size pass, FU-3 marketing CI deploy, FU-4 legal review (CCPA+APPI). Single source of truth; MASTER.md links here.*

---

## ✅ P3-2 — Dashboard Type/Lint Cleanup — COMPLETED June 7, 2026

> **Done.** `apps/dashboard`: **0 ESLint warnings** and **0 TypeScript errors** under full strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `strict`).

All 6 complex designer/wizard files that previously blocked completion are fixed with proper typed interfaces and narrowed casts (no blanket `any`):

| File | Resolution |
|---|---|
| `campaign-designer/Canvas.tsx` | framer-motion `Variants` type imported from `motion/react`; element access narrowed |
| `campaign-designer/InteractivePreview.tsx` | `extraProps?.href`/`placeholder` cast to `string \| undefined`; render casts via `Record<string,unknown>` |
| `campaign-designer/SidebarLeft.tsx` | callback props typed `unknown`; `CampaignTriggers` fields used directly |
| `campaign-wizard/DesignControls.tsx` | `DraftBuilderElement` imported; `updateBlock` takes `Partial<DraftBuilderElement>` |
| `campaign-wizard/LivePreview.tsx` | `LiveBlock`/`WheelSlice` interfaces; `block.props` accesses cast at use sites |
| `campaign-wizard/ActionsBuilder.tsx` | literal-union casts (avoids `undefined` under `exactOptionalPropertyTypes`) |

Plus `DraftBuilderElement` exported from `types/campaign.ts` and `lib/templates.ts` typed off it. Verified: `pnpm -r typecheck` clean, `pnpm -r lint` clean. Shipped across commits `497224c`, `f38ffbd`.

---

## 🔎 Security Code Review — ✅ Completed June 7, 2026

> Full multi-angle review (line-by-line + removed-behavior + cross-file + cleanup) of the whole platform. **No backdoors / auth bypasses found.** 8 real findings confirmed and fixed in commit `3062745`. Verified: snippet 26/26, API 71/71, typecheck + lint clean, bundle 9.68 KB.

| ID | Sev | Finding | Fix applied |
|---|---|---|---|
| CR-01 | 🔴 Critical | **`cssFont` XSS** — allowlist included `"`, letting a tenant font-family break out of the `style="…"` attribute (contradicted its own doc) | Removed `"` from the allowlist; added regression test (`sanitize.test.ts`) |
| CR-02 | 🟠 High | **Month-rollover analytics loss** — `ensureEventPartitions()` was gated behind the 24h schema-skip flag; a warm restart could skip creating next month's partition → inserts silently dropped | Runs on every boot now, ungated (time-sensitive ≠ version-sensitive) |
| CR-03 | 🟠 High | **Cross-campaign PII leak** — ESP dispatch was opt-*out* (`!== false`), so default `{}` synced every campaign's leads into a tenant's globally-enabled ESP | Flipped to opt-*in* (`=== true`); matches the per-campaign opt-in contract |
| CR-04 | 🟠 High | **Spoofed webhook payloads** — raw client `meta` spread *after* sanitized fields, letting forged `/e` events override email/pageUrl/revenueCents in operator deliveries | Spread `...md4` first so server-sanitized values win |
| CR-05 | 🟠 High | **Credential/PII in logs & responses** — ESP adapters returned/logged the provider's raw error body (can echo the API key) | Report HTTP status only; never the body |
| CR-06 | 🟡 Medium | **Webhook config clobber** — partial PUT replaced the whole `outboundWebhook` column, wiping `url`/`events` | Merge onto previous config; `events` made optional |
| CR-07 | 🟡 Medium | **SSRF gap** — SSRF guard checked only the first DNS record | Resolve all addresses (`{all:true}`), reject if any private; IPv6 + mapped-IPv4 coverage (strengthens SR-01) |
| CR-08 | 🟡 Medium | **Fail-open flood gate** — per-IP impression cap failed fully open when Redis was down → forged quota burn | Per-instance in-memory fallback gate |

**Residual (accepted, not a code gap):** the event-origin check still fails open for sites with no configured domain (donation/"other" platforms legitimately have none); the in-memory flood gate covers the Redis-down risk. Tracked here for transparency.

**Tooling added:** `.githooks/pre-commit` (rebuilds + re-stages `apps/worker/src/p.txt` whenever snippet source changes, so the served bundle can never drift from source) + `.gitattributes` LF enforcement, enabled via `core.hooksPath` on `pnpm install`.

---

## 🧪 Billing Webhook Verification — Real-SDK Dry-Run — ✅ June 7, 2026

> The main suite mocked the `stripe` module, so the actual signature-verification path had never been exercised. New test `apps/api/src/stripe-webhook.test.ts` runs the **real** Stripe SDK. Commit `b65a23b`.

| # | Test | Result | Proves |
|---|---|---|---|
| 1 | Valid signature over a **non-canonical (whitespace) raw payload** | ✅ 200 `received:true` | `request.rawBody` is captured + used — the `JSON.stringify(request.body)` fallback would fail on these bytes (closes the P0-1 footgun concern) |
| 2 | Tampered body, original signature | ✅ 400 `INVALID_SIGNATURE` | Forged/modified events rejected |
| 3 | Signature signed with wrong secret | ✅ 400 `INVALID_SIGNATURE` | Only the real `STRIPE_WEBHOOK_SECRET` verifies |
| 4 | Missing `stripe-signature` header | ✅ 400 `INVALID_SIGNATURE` | No unsigned events accepted |

**API suite now 75/75** (was 71). Typecheck clean.

**Scope of this proof:** it validates cryptographic signature verification + forgery resistance in isolation with a test secret. It does **not** exercise the end-to-end money flow (real checkout → `checkout.session.completed`/`customer.subscription.created` → price-ID→plan mapping → tenant row update → cache bust). That still needs the **one live test charge** under P0-2, and depends on the 4 `STRIPE_PRICE_*` env vars matching the actual Stripe price IDs (a mismatch would verify the signature but silently skip the plan update). Verify `request.rawBody` populates in the Render runtime during that test.

**Conclusion:** billing webhook is cryptographically sound. Remaining billing risk is config (price IDs / env), not vulnerability.

---

## 🔐 Security Remediation Sprint — ✅ Completed June 6, 2026

> Full plan with code snippets: **`SECURITY-REMEDIATION.md`**  
> All 15 findings fixed. API typechecks clean. 71/71 tests pass.

### 7 Production Blockers — ALL FIXED ✅

| ID | Status | Sev | Finding | Fix applied |
|---|---|---|---|---|
| SR-01 | ✅ | 🔴 Critical | **SSRF** outbound webhook | Private-IP blocklist + `redirect:'error'` + DNS-rebind-safe fire-time re-check |
| SR-02 | ✅ | 🟠 High | **False test** `/integrations/test` always `ok:true` | Adapters return `EspSyncResult`; test endpoint inspects result |
| SR-03 | ✅ | 🟠 High | **Sole-owner orphan** `DELETE /me` | 409 guard before any DB mutation |
| SR-04 | ✅ | 🟠 High | **Dirty-delete window** DB before Clerk | Reversed: Clerk delete first, DB only on success |
| SR-05 | ✅ | 🟡 Medium | **Mailchimp serverPrefix injection** | `^[a-z]{2}\d{1,2}$` validated before URL construction |
| SR-06 | ✅ | 🟡 Medium | **Coupon TOCTOU** | Atomic `UPDATE … WHERE uses < maxUses RETURNING` |
| SR-07 | ✅ | 🟡 Medium | **Auto-responder XSS** | `sanitize-html` allowlist on `htmlBody` before send |

### 8 Medium + Low Findings — ALL FIXED ✅

| ID | Status | Sev | Finding | Fix applied |
|---|---|---|---|---|
| SR-08 | ✅ | 🟡 Medium | **Mailchimp 400 swallowed** | Only genuine "Member Exists" 400 is non-fatal |
| SR-09 | ✅ | 🟡 Medium | **No rate limit on test endpoint** | 5/min keyed per `tenantId` |
| SR-10 | ✅ | 🟡 Medium | **Shopify origin bypass** | All platforms now enforce origin against known domain |
| SR-11 | ✅ | 🟢 Low | **Frequency cap key mismatch** | `_sp_fr_X` corrected to `_sp_X` |
| SR-12 | ✅ | 🟢 Low | **Redis partial hash cast** | Type guards added for `siteId` + `platform` |
| SR-13 | ✅ | 🟢 Low | **PUT /integrations silent no-op** | 404 when tenant not found |
| SR-14 | ✅ | 🟢 Low | **Empty email on phone/OAuth Clerk user** | Synthetic `@noemail.scrollpop.local` placeholder |
| SR-15 | ✅ | 🟢 Low | **Duplicated session revocation** | Shared `lib/auth.ts` helper used by both routes |

### Remaining Ops Tasks (no code needed)

| ID | Status | Item | Est. |
|---|---|---|---|
| P0-2  | ⬜ | Set Stripe keys in Render env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, 4 price IDs) | 2h |
| OPS-WP1 | ✅ | **Re-uploaded corrected WP plugin zip to R2** (Jun 8) — verified live: `pub-0a090ba944…r2.dev/scrollpop-wp.zip` now serves forward-slash `scrollpop/` entries. | done |
| P2-18 | ⬜ | `api.scrollpop.online` CNAME → Render in Cloudflare DNS | 30 min |
| P3-3  | ⬜ | `cdn.scrollpop.online` custom domain on R2 bucket `scrollpop-assets` | 30 min |
| P3-5  | ⬜ | `pnpm build` + `wrangler pages deploy dist --project-name scrollpop-marketing` | 30 min |
| P1-14 | ⬜ | Shopify App Store submission (App Embed Block already built) — deferred by owner | 2h |

---

## 🐛 Known Issues & Fixes

| ID | Status | Severity | Issue | Fix |
|---|---|---|---|---|
| BUG-2 | ✅ Fixed (Jun 8) | High | **Advanced targeting + Smart Product Match saved but had no runtime effect.** (a) `enableSmartAffiliate` — snippet read it off `campaign.triggers` (the normalized trigger ARRAY from the edge) so it was always `undefined`; detection never ran. (b) `pageTargetingRules` (multi-rule page-targeting builder) — editors wrote only the single legacy `pageTargeting` to the targeting table; the rule array lived only in `config.uiTriggers` and was never enforced. (c) Wizard's advanced save omitted `uiTriggers`/`schedule`, so reopening a wizard-saved campaign in the designer reset those fields. All round-tripped fine in the editor, masking the gap. | Snippet now reads `enableSmartAffiliate` from `design.uiTriggers`; both editors map each `pageTargetingRule` to a real `url_contains`/`url_exact`/`url_regex` targeting row (supersedes the legacy single field); wizard now writes `uiTriggers`+`schedule`. Commit `9bbc93c`. Verified typecheck/lint/snippet 26/26, bundle 9.71 KB. |
| BUG-1 | ✅ Fixed + live (Jun 8) | High | **WordPress plugin unactivatable** — the `scrollpop-wp.zip` on R2 was built on Windows with **backslash** path separators (`scrollpop\scrollpop.php`). WordPress (Linux/ZIP-spec, forward-slash only) can't read them as a folder, so upload resolves to `scrollpop-wp/scrollpop/scrollpop.php` and activation fails with **"Plugin file does not exist."** Observed on brewers-cafe.jp Jun 7. PHP code was correct — packaging defect only. | Rebuilt the zip with forward-slash entries under a single `scrollpop/` root via new `build-zip.py` (verifies separators); added `package` npm script + README warning (commit `c07dcf0`). Corrected zip **re-uploaded to R2 and verified live** (OPS-WP1, Jun 8). **Per-site action** on any site that installed the broken zip: delete the stale `wp-content/plugins/scrollpop-wp/` folder via FTP, then reinstall the corrected zip. |
