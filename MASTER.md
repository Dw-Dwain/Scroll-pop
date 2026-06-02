# ScrollPop — Master Reference Document

> **Audience:** Owner / lead developer. Everything about this product in one place.
> Last updated: June 1, 2026 · v0.1.2-beta

---

## Table of Contents

1. [Product Summary](#1-product-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Tech Stack (Locked)](#4-tech-stack-locked)
5. [Infrastructure & Services](#5-infrastructure--services)
6. [Database Schema](#6-database-schema)
7. [API Routes (Full List)](#7-api-routes-full-list)
8. [Snippet (Client Runtime)](#8-snippet-client-runtime)
9. [Cloudflare Worker (Edge Layer)](#9-cloudflare-worker-edge-layer)
10. [Dashboard (Admin SPA)](#10-dashboard-admin-spa)
11. [WordPress Plugin](#11-wordpress-plugin)
12. [Auth & Multi-Tenancy](#12-auth--multi-tenancy)
13. [Billing & Plan Limits](#13-billing--plan-limits)
14. [Shopify Integration](#14-shopify-integration)
15. [CI/CD Pipeline](#15-cicd-pipeline)
16. [Environment Variables (All)](#16-environment-variables-all)
17. [Domain Architecture](#17-domain-architecture)
18. [Security Rules (Non-Negotiable)](#18-security-rules-non-negotiable)
19. [Data Flow — End to End](#19-data-flow--end-to-end)
20. [Feature Flags](#20-feature-flags)
21. [Performance Budgets & Limits](#21-performance-budgets--limits)
22. [What's Built vs Not Built](#22-whats-built-vs-not-built)
23. [v2 Roadmap](#23-v2-roadmap)
24. [v3 Roadmap](#24-v3-roadmap)
25. [Known Bugs & Tech Debt](#25-known-bugs--tech-debt)
26. [Key Design Decisions (ADRs)](#26-key-design-decisions-adrs)
27. [Operational Runbook](#27-operational-runbook)
28. [Dependency Map](#28-dependency-map)
29. [Production Setup Log](#29-production-setup-log-may-29-2026)
30. [Connection Points & How to Change Them](#30-connection-points--how-to-change-them)

---

## 1. Product Summary

**ScrollPop** is a multi-tenant SaaS popup/overlay platform. Operators build scroll-triggered, affiliate-monetised popup campaigns through an admin dashboard. A lightweight JS snippet (~8 KB gzipped) runs on customer sites and renders popups inside a Shadow DOM without touching browser history.

**Core value proposition:**
- Install once, launch campaigns without developer involvement
- Affiliate-first design: weighted product slot rotation, click tracking, coupon codes
- Google spam-policy compliant by architecture (no history manipulation, no back-button capture)
- Works on WordPress, Shopify, raw HTML, Donorbox, GoFundMe, or any CMS

**Business model:** Monthly SaaS subscriptions billed on popup views (1K free → 2M agency). Stripe Billing + usage metering.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Customer's browser                                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Customer's site HTML                                         │   │
│  │  <script src="cdn.scrollpop.io/v1/{pubkey}/p.js">           │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │  Shadow DOM  (closed mode — isolated from host page)   │ │   │
│  │  │  Popup render + event listeners                        │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│            │ fetch config               │ sendBeacon events          │
└────────────┼───────────────────────────┼────────────────────────────┘
             ▼                           ▼
  ┌──────────────────────┐   ┌───────────────────────────┐
  │  Cloudflare Worker   │   │  Cloudflare Worker         │
  │  /c/{pubkey}         │   │  /e  (event ingest)        │
  │  ─ KV cache hit      │   │  ─ queues to Upstash Redis │
  │  ─ miss → API fetch  │   └───────────────────────────┘
  │  ─ R2 snippet CDN    │             │ flush
  └──────────────────────┘   ┌──────────────────────────┐
             │ miss            │  Render.com API (Fastify) │
             ▼                │  /api/v1/internal/events  │
  ┌──────────────────────┐   └──────────────────────────┘
  │  Render API           │             │ insert
  │  /api/v1/internal/    │   ┌─────────────────────────┐
  │  site-config          │   │  Neon PostgreSQL          │
  └──────────────────────┘   │  TimescaleDB events table │
             │                └─────────────────────────┘
             ▼
  ┌──────────────────────┐
  │  Neon PostgreSQL      │
  │  sites / campaigns /  │
  │  designs / triggers   │
  └──────────────────────┘

  ┌──────────────────────────────────────┐
  │  Dashboard (Cloudflare Pages)         │
  │  React 19 + Refine + shadcn/ui        │
  │  Clerk session → Bearer JWT           │
  │  → Render API /api/v1/*              │
  └──────────────────────────────────────┘
```

---

## 3. Monorepo Structure

```
scrollpop/
├── apps/
│   ├── api/              Fastify 5 backend (Node 22 LTS + TypeScript)
│   │   ├── src/
│   │   │   ├── index.ts           Entry point, plugin registration
│   │   │   ├── db/
│   │   │   │   ├── client.ts      Drizzle + postgres() connection
│   │   │   │   └── schema.ts      All table definitions
│   │   │   ├── plugins/
│   │   │   │   ├── tenant-context.ts   JWT → req.tenantId + req.userId
│   │   │   │   └── error-handler.ts    Global error formatter
│   │   │   └── routes/
│   │   │       ├── sites.ts
│   │   │       ├── campaigns.ts
│   │   │       ├── designs.ts
│   │   │       ├── triggers.ts
│   │   │       ├── targeting.ts
│   │   │       ├── frequency.ts
│   │   │       ├── analytics.ts
│   │   │       ├── billing.ts
│   │   │       ├── webhooks.ts        Clerk + Stripe webhooks
│   │   │       ├── shopify.ts         Shopify OAuth + GDPR webhooks
│   │   │       ├── internal.ts        Called by Cloudflare Worker
│   │   │       ├── me.ts              /me endpoint
│   │   │       ├── tenants.ts
│   │   │       ├── ops.ts             SSE stream for OpsCenter
│   │   │       ├── journeys.ts        (beta)
│   │   │       └── experiments.ts     (beta)
│   │   ├── drizzle/
│   │   │   └── migrations/
│   │   │       ├── 0001_initial.sql
│   │   │       ├── 0002_shopify_wordpress.sql
│   │   │       └── meta/_journal.json
│   │   └── .env.example
│   │
│   ├── dashboard/        React 19 admin SPA
│   │   ├── src/
│   │   │   ├── main.tsx            Root; routing; ClerkProvider; Refine
│   │   │   ├── providers/
│   │   │   │   └── dataProvider.ts  Refine data provider → Render API
│   │   │   ├── components/
│   │   │   │   └── Layout.tsx       Shell nav + footer
│   │   │   ├── hooks/
│   │   │   │   ├── usePlan.ts
│   │   │   │   └── useAnalytics.ts
│   │   │   ├── lib/
│   │   │   │   └── flags.ts         Feature flag checks
│   │   │   └── pages/
│   │   │       ├── Dashboard.tsx
│   │   │       ├── Sites.tsx          (platform picker, Shopify OAuth, WP wizard)
│   │   │       ├── Campaigns.tsx
│   │   │       ├── CampaignWizard.tsx
│   │   │       ├── CampaignDetail.tsx
│   │   │       ├── CampaignDesign.tsx (visual block builder)
│   │   │       ├── Analytics.tsx
│   │   │       ├── Billing.tsx
│   │   │       ├── Settings.tsx
│   │   │       ├── Profile.tsx
│   │   │       ├── OpsCenter.tsx      (ff_realtime_ops_dashboard)
│   │   │       ├── Journeys.tsx       (ff_journeys_ui)
│   │   │       ├── Experiments.tsx    (ff_experiments_ui)
│   │   │       ├── DocsPage.tsx       ← multi-page user guide
│   │   │       ├── LicensePage.tsx    ← OSS licenses (verbatim)
│   │   │       ├── TermsPage.tsx
│   │   │       ├── PrivacyPage.tsx
│   │   │       └── StatusPage.tsx
│   │   └── vite.config.ts
│   │
│   └── worker/           Cloudflare Worker (edge layer)
│       └── src/
│           └── index.ts  Config fetch + KV cache + event queue
│
├── packages/
│   ├── snippet/          Vanilla TS browser snippet
│   │   ├── src/main.ts   Full snippet source (~1200 lines)
│   │   ├── build.mjs     esbuild config (IIFE, tree-shaken)
│   │   └── dist/p.js     Built output (checked in for CDN deploy)
│   │
│   ├── wp-plugin/        WordPress PHP plugin
│   │   └── scrollpop/
│   │       ├── scrollpop.php          Plugin header + activation
│   │       └── includes/
│   │           ├── class-scrollpop.php  Core, snippet injection, REST endpoint
│   │           └── class-admin.php      WP admin settings UI
│   │
│   └── shared/           Shared Zod schemas + TypeScript types
│       └── src/index.ts
│
├── infra/
│   ├── cloudflare/       wrangler.toml + KV namespace IDs
│   ├── fly/              fly.toml (unused — API is on Render)
│   └── supabase/         Supabase migration files (not production DB)
│
├── CLAUDE.md             AI coding rules for this project
├── MASTER.md             ← this file
└── package.json          pnpm workspace root
```

---

## 4. Tech Stack (Locked)

| Layer | Choice | Version | Hosted At |
|---|---|---|---|
| Runtime | Node.js LTS | 22 | Render.com |
| Language | TypeScript | 5.x | — |
| Backend | Fastify | 5.x | Render.com |
| ORM | Drizzle ORM | 0.30.x | — |
| Database | PostgreSQL 16 | TimescaleDB ext | Neon |
| Cache / Queue | Redis | Upstash REST | Upstash |
| Edge | Cloudflare Workers | — | Cloudflare |
| Edge Storage | KV + R2 | — | Cloudflare |
| Auth | Clerk | SaaS | clerk.com |
| Frontend | React 19 + Vite | 19 / 5 | CF Pages |
| Admin scaffold | Refine | 4.x | — |
| UI | shadcn/ui + Tailwind | CSS v4 | — |
| State | Zustand | 4.x | — |
| Data fetching | TanStack Query | 5.x | — |
| Drag-drop | dnd-kit | 6.x | — |
| Billing | Stripe Billing | API 2024-06-20 | stripe.com |
| Monorepo | pnpm workspaces | 9.x | — |
| Build | Turborepo | 2.x | — |
| CI/CD | GitHub Actions | — | GitHub |
| Error tracking | Sentry | SaaS | sentry.io |
| Analytics | PostHog | SaaS | posthog.com |
| Snippet bundler | esbuild | 0.21 | — |

---

## 5. Infrastructure & Services

### Production URLs (Live as of June 2026)
| Service | URL | Host |
|---|---|---|
| **Marketing site** | **https://scrollpop.online** | Cloudflare Pages (`scrollpop-site` project) |
| API | https://scroll-pop.onrender.com | Render.com **Pro ($25/mo)** — always warm |
| Dashboard (app) | https://dashboard.scrollpop.online | Cloudflare Pages (`scrollpop-dashboard` project) |
| Dashboard (CF alias) | https://scrollpop-dashboard.pages.dev | Cloudflare Pages (auto alias) |
| Snippet CDN | **https://cdn.scrollpop.online** | Cloudflare Worker custom domain ✅ live |
| Edge / Config / Events | **https://edge.scrollpop.online** | Cloudflare Worker custom domain ✅ live |
| Neon DB | ep-autumn-frost-aoudjxlw.c-2.ap-southeast-1.aws.neon.tech | Neon (ap-southeast-1) |
| Clerk Auth | https://clerk.scrollpop.online | Clerk (production instance) |
| Clerk Accounts Portal | https://accounts.scrollpop.online | Clerk |

### Marketing site
Source: `site-plan/` directory in the repo.
Content files: `site-plan/src/components/` — one file per page.

| File | Page |
|---|---|
| `HomeView.tsx` | Homepage (hero, features, how-it-works, testimonials, FAQ, CTA) |
| `PricingView.tsx` | Pricing page (5 tiers, monthly/annual toggle) |
| `WordPressShopifyGuide.tsx` | Install guide (WordPress / Shopify / HTML tabs) |
| `TemplatesView.tsx` | Template gallery |
| `ContactView.tsx` | Contact form |
| `Header.tsx` | Navigation + announcement strip |
| `Footer.tsx` | Footer links |

To edit content: change the relevant TSX file on `dev`, push → Cloudflare Pages auto-rebuilds
`scrollpop.online` within ~2 minutes. Preview locally at `http://localhost:3000` via `/run`.

**State (Jun 2 2026):** content reconciled to match prod — fabricated testimonials
removed; WP = snippet (free) / plugin (paid); Shopify = theme.liquid snippet now +
one-click app "coming soon"; pricing tiers shown but paid CTAs are "Coming Soon"
(checkout not live). Logo unified with the app (white circle + black diamond, sans
wordmark) across Header/Footer. Sections use `RevealSection` for a cinematic
scroll-reveal (motion `whileInView`, honors prefers-reduced-motion). Some pending
marketing-claim softening is tracked in §25 (CMP2/CMP3).

### Domain
| Domain | Registrar | DNS | Purpose |
|---|---|---|---|
| scrollpop.online | External registrar | Cloudflare (nameservers delegated) | Current production domain (budget — plan to migrate to scrollpop.app) |
| scrollpop-dashboard.pages.dev | — | Cloudflare (auto) | CF Pages default alias — always works |

> **Domain migration plan:** When budget allows, buy `scrollpop.app` or `scrollpop.io`. See Section 29 for migration steps.

### Accounts / Credentials Checklist
- [x] GitHub repo: https://github.com/Dw-Dwain/Scroll-pop
- [x] Render.com API service (scroll-pop) — env vars fully configured
- [x] Neon project (neondb_owner — password rotated May 29 2026)
- [x] Clerk application — production instance live on scrollpop.online
- [x] Upstash Redis instance
- [x] Cloudflare account (Workers + Pages configured)
- [x] Shopify Partners app (ScrollPop — Client ID: 37618fc8e087622a64ac244a2edd49f1)
- [ ] Cloudflare R2 bucket (snippet CDN) — not yet configured (snippet served from Worker bundle)
- [x] Cloudflare KV namespace `SCROLLPOP_CONFIG` — **bound & live** (id `00a5652f5e9d435bbd1ada64fe089088`, in the deploy account). Edge config cache, 60s TTL.
- [ ] Stripe account (test + live keys) — pending
- [ ] Sentry project — pending
- [ ] PostHog project — pending

### Render Environment Variables (Current)
| Key | Value / Notes |
|---|---|
| `API_BASE_URL` | https://scroll-pop.onrender.com |
| `CLERK_PUBLISHABLE_KEY` | pk_live_... (production) |
| `CLERK_SECRET_KEY` | sk_live_... (production) |
| `DASHBOARD_URL` | https://dashboard.scrollpop.online |
| `DATABASE_URL` | Neon pooled connection (password rotated May 29 2026) |
| `DIRECT_DATABASE_URL` | Neon direct connection (for migrations) |
| `INTERNAL_SECRET` | 64-char hex — generated May 29 2026 |
| `node_env` | production |
| `port` | 3001 |
| `REDIS_TOKEN` | Upstash token |
| `REDIS_URL` | Upstash REST URL |
| `SHOPIFY_API_KEY` | 37618fc8e087622a64ac244a2edd49f1 |
| `SHOPIFY_API_SECRET` | From Shopify Partners — rotatable via Partners dashboard |
| `SHOPIFY_SCOPES` | read_products,write_script_tags |
| `SNIPPET_CDN_URL` | https://scroll-pop.onrender.com (temp — update when R2 live) |
| `STRIPE_SECRET_KEY` | ❌ Not yet set |
| `STRIPE_WEBHOOK_SECRET` | ❌ Not yet set |

### Cloudflare Pages Environment Variables (Current)
| Key | Value |
|---|---|
| `VITE_API_URL` | https://scroll-pop.onrender.com |
| `VITE_CLERK_PUBLISHABLE_KEY` | pk_live_... (must match Render) |

---

## 6. Database Schema

All tables use: UUID primary keys, `created_at / updated_at TIMESTAMPTZ`, soft-deletes via `deleted_at`.  
All tenant-scoped tables have RLS enabled.

### tenants
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| clerk_org_id | text unique | Maps to Clerk organisation |
| name | text | Org display name |
| plan | enum | free/starter/growth/scale/agency |
| monthly_view_limit | int | Denormalised from PLAN_LIMITS |
| stripe_customer_id | text | Stripe customer |
| stripe_subscription_id | text | |
| current_period_end | timestamptz | Billing cycle end |
| deleted_at | timestamptz | Soft delete |

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| clerk_user_id | text unique | |
| email | text | |
| name | text | |

### tenant_members
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| user_id | uuid FK→users | |
| role | enum | owner/admin/editor/viewer |

### sites
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | RLS |
| name | text | |
| domain | text | e.g. mystore.com |
| platform | enum | wordpress/shopify/html/donorbox/gofundme/other |
| public_key | text unique | Snippet embed identifier |
| shopify_shop | text | e.g. store.myshopify.com |
| wp_site_url | text | Custom WP base URL override |
| verified_at | timestamptz | Plugin/snippet confirmed live |
| deleted_at | timestamptz | |

### campaigns
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| site_id | uuid FK | |
| name | text | |
| status | enum | draft/active/paused/archived |
| deleted_at | timestamptz | |

### designs
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| campaign_id | uuid FK unique | 1:1 with campaign |
| config | jsonb | Full DesignConfigSchema object |
| affiliate_slots | jsonb | Array of AffiliateSlot |
| layout_mode | enum | legacy/blocks |

### triggers
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| campaign_id | uuid FK | |
| type | enum | scroll_pct/dwell_time/inactivity/exit_intent_mouse/click |
| params | jsonb | Type-specific params |

### targeting_rules
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| campaign_id | uuid FK | |
| kind | enum | url_exact/url_contains/url_regex/device/returning_visitor |
| operator | enum | include/exclude |
| value | jsonb | Rule-specific value |

### frequency_rules
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| campaign_id | uuid FK unique | |
| frequency | enum | once_per_session/once_per_day/once_per_visitor/always |

### events (TimescaleDB hypertable, partitioned by time)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| site_id | uuid FK | |
| campaign_id | uuid FK | |
| event_type | enum | impression/view/click/dismiss/conversion |
| affiliate_slot_id | uuid nullable | |
| visitor_id | text | Anonymous random UUID |
| session_id | text | |
| device | text | desktop/mobile |
| page_url | text | |
| referrer | text | |
| created_at | timestamptz | Hypertable partition key |

### shopify_installations
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| site_id | uuid FK nullable | |
| shop | text unique | e.g. store.myshopify.com |
| access_token | text | Offline access token |
| scope | text | Granted scopes |
| script_tag_id | text | Shopify Script Tag ID |
| nonce | text | OAuth CSRF nonce |
| installed_at | timestamptz | |
| uninstalled_at | timestamptz | Set on app/uninstalled webhook |

---

## 7. API Routes (Full List)

All routes prefixed `/api/v1/`. Auth: Clerk JWT Bearer token (except public routes).

### Public / Verified-internally
| Method | Path | Description |
|---|---|---|
| GET | /health | Health check |
| GET | /api/v1/shopify/callback | Shopify OAuth redirect (HMAC verified) |
| POST | /api/v1/webhooks/clerk | Clerk webhook (svix verified) |
| POST | /api/v1/webhooks/stripe | Stripe webhook (sig verified) |
| POST | /api/v1/webhooks/shopify/app/uninstalled | Shopify GDPR |
| POST | /api/v1/webhooks/shopify/shop/redact | Shopify GDPR |
| POST | /api/v1/webhooks/shopify/customers/redact | Shopify GDPR |
| POST | /api/v1/webhooks/shopify/customers/data_request | Shopify GDPR |
| GET | /c/:publicKey | Local dev config endpoint (edge-equivalent) |
| POST | /e | Local dev event ingest |
| GET | /v1/:publicKey/p.js | Local dev snippet serving |

### Sites
| Method | Path | Description |
|---|---|---|
| GET | /api/v1/sites | List tenant sites |
| POST | /api/v1/sites | Create site |
| GET | /api/v1/sites/:id | Get site |
| PATCH | /api/v1/sites/:id | Update name / platform |
| DELETE | /api/v1/sites/:id | Soft-delete |
| POST | /api/v1/sites/:id/verify-wordpress | Ping WP REST status endpoint |
| PATCH | /api/v1/sites/:id/wordpress-url | Set custom WP base URL |

### Campaigns
| Method | Path | Description |
|---|---|---|
| GET | /api/v1/campaigns | List (filter by siteId) |
| POST | /api/v1/campaigns | Create |
| GET | /api/v1/campaigns/:id | Get |
| PATCH | /api/v1/campaigns/:id | Update name / status |
| DELETE | /api/v1/campaigns/:id | Archive |

### Designs / Triggers / Targeting / Frequency
| Method | Path | Description |
|---|---|---|
| GET/POST/PATCH/DELETE | /api/v1/designs | Campaign visual config + affiliate slots |
| GET/POST/DELETE | /api/v1/triggers | Campaign trigger rules |
| GET/POST/DELETE | /api/v1/targeting | Campaign targeting rules |
| GET/POST/PATCH/DELETE | /api/v1/frequency | Campaign frequency rule |

### Analytics
| Method | Path | Description |
|---|---|---|
| GET | /api/v1/analytics/overview | Aggregate views/clicks/CTR for tenant |
| GET | /api/v1/analytics/campaigns | Per-campaign breakdown |
| GET | /api/v1/ops/stream | SSE stream (OpsCenter feature) |

### Billing
| Method | Path | Description |
|---|---|---|
| GET | /api/v1/billing/plans | Available plans + current plan |
| POST | /api/v1/billing/checkout | Create Stripe Checkout session |
| POST | /api/v1/billing/portal | Create Stripe billing portal session |

### Shopify
| Method | Path | Description |
|---|---|---|
| POST | /api/v1/shopify/install | Initiate OAuth — returns oauthUrl |
| GET | /api/v1/shopify/callback | OAuth callback (public) |
| GET | /api/v1/shopify/status | Check installation status |
| DELETE | /api/v1/shopify/disconnect | Remove installation + script tag |

### Internal (called by Cloudflare Worker)
| Method | Path | Auth |
|---|---|---|
| GET | /api/v1/internal/site-config/:publicKey | INTERNAL_SECRET header |
| POST | /api/v1/internal/events | INTERNAL_SECRET header |

### Me / Tenant
| Method | Path | Description |
|---|---|---|
| GET | /api/v1/me | Current user + tenant + plan |
| GET/PATCH | /api/v1/tenants/:id | Tenant details |

### Admin (super-admin only — dwain3991@gmail.com)
| Method | Path | Description |
|---|---|---|
| GET | /api/v1/admin/tenants | All tenants with owner email, plan, site/campaign counts |
| PATCH | /api/v1/admin/tenants/:id/plan | Manually change a tenant's plan + view limit |
| GET | /api/v1/admin/stats | Platform-wide totals: tenants, sites, campaigns |

---

## 8. Snippet (Client Runtime)

**Location:** `packages/snippet/src/main.ts`  
**Output:** `packages/snippet/dist/p.js` (IIFE, esbuild-minified)  
**Size target:** ≤10 KB gzipped (currently **10,125 bytes ≈ 9.9 KB ✅** — only ~115 B of headroom; trim before adding features)

### Lifecycle

1. **Inline stub** (≤1.2 KB) injected into the page via `<script>` tag. Creates `window.__sp` queue.
2. Stub appends `<script async src="cdn.scrollpop.io/v1/{pubkey}/p.js">` to `<head>`.
3. Main bundle loads. Uses `requestIdleCallback` (+ `setTimeout` fallback) to defer initialisation.
4. Calls `GET https://edge.scrollpop.io/c/{pubkey}` to fetch `SiteConfigPayload`.
5. Config includes all active campaigns with triggers, targeting rules, frequency, affiliate slots.
6. For each campaign:
   - Evaluates targeting rules (exclude-first, then include)
   - Checks frequency state (sessionStorage / localStorage)
   - Attaches trigger listeners (scroll, dwell, inactivity, exit-intent, click)
7. When a trigger fires: picks a weighted affiliate slot, renders popup in Shadow DOM.
8. Beacons events via `navigator.sendBeacon()` to `POST https://edge.scrollpop.io/e`.
9. Dismiss / close handlers clean up the Shadow DOM.

### Shadow DOM Structure

```
<div id="scrollpop-root">
  #shadow-root (closed)
    <style>  (scoped CSS — never leaks to host)
    <div class="sp-overlay">  (optional)
    <div class="sp-popup sp-{kind}">
      <button class="sp-close">✕</button>
      <img class="sp-img">
      <h2 class="sp-headline">
      <p class="sp-body">
      <a class="sp-cta">
      <div class="sp-coupon">  (if coupon present)
      <span class="sp-powered-by">  (free plan only)
```

### Public API (window.__sp)

```javascript
window.__sp.show(campaignId)   // programmatically open a popup
window.__sp.dismiss()          // close current popup
window.__sp.on(event, fn)      // subscribe to events
```

### Hard Constraints (enforced by CLAUDE.md)
- No `history.pushState / replaceState / onpopstate`
- No `window.onbeforeunload`
- No `eval()`, `document.write()`, `new Function()`
- Shadow DOM only — no global CSS injection
- Bundle ≤10 KB gzipped (CI gate)
- All non-critical work via `requestIdleCallback`
- Events via `navigator.sendBeacon()` → `fetch({keepalive:true})` fallback

### Delivery & behaviour notes
- **Production delivery**: the Worker serves the snippet by importing
  `apps/worker/src/p.txt`. `pnpm --filter snippet build` now **auto-syncs**
  `dist/p.js → apps/worker/src/p.txt` — always commit the updated `p.txt`, or
  source changes never reach prod (this was a silent staleness gap, fixed Jun 2 2026).
- **"Powered by ScrollPop" badge is plan-enforced**: shown only when the tenant
  plan (from the config payload) is `free`; paid plans never show it, free users
  can't remove it — independent of the per-design `showPoweredBy` flag.
- Respects `navigator.doNotTrack`; skips analytics for the operator's own admin
  visits and obvious bots. **Consent gate (GDPR/ePrivacy):** honors explicit denial
  (`window.__sp_consent === false` / Consent Mode `denied`), and — when the tenant
  enables **strict opt-in** (Settings → Visitor Privacy) — records nothing until
  consent is granted. Popups still render in all cases; only tracking is gated. See §25.

---

## 9. Cloudflare Worker (Edge Layer)

**Location:** `apps/worker/src/index.ts`  
**Deployment:** `wrangler deploy` → Cloudflare Workers

### Routes handled
| Route | Description |
|---|---|
| `GET /c/:publicKey` | Config fetch. KV cache hit → return JSON. Miss → fetch API → write KV → return. |
| `POST /e` | Event ingest. Validates minimal shape, pushes to Upstash Redis list `sp_events`. |
| `GET /v1/:publicKey/p.js` | Serve snippet JS from R2 bucket `scrollpop-snippets`. |

### KV Cache
- Key: `sp_config:{publicKey}`
- TTL: 60 seconds (set by Worker on write)
- On campaign publish: API purges KV key via Cloudflare API (`CLOUDFLARE_API_TOKEN`)

### Redis Event Queue
- Upstash Redis list: `sp_events`
- Worker pushes JSON event payloads via `LPUSH`
- Internal API endpoint `/api/v1/internal/events` pops and inserts to DB (called on cron or by Worker on flush threshold)

### Worker is thin by design
No business logic. Only: cache reads/writes, Redis push, static asset serve.

---

## 10. Dashboard (Admin SPA)

**Location:** `apps/dashboard/`  
**Deploy:** Cloudflare Pages (build output: `dist/`)  
**Build command:** `pnpm build` → `vite build`

### Routing
Hash-based for desktop Electron mode, path-based for web. Both handled in `main.tsx`.

### Auth Modes
| Mode | How triggered | Token source |
|---|---|---|
| Web (Clerk) | `VITE_CLERK_PUBLISHABLE_KEY` set | `useAuth().getToken()` → Bearer JWT |
| Desktop (Electron) | `window.electronAPI.isDesktop === true` | `localStorage.desktop_token` = `VITE_INTERNAL_SECRET` |
| Demo (Showcase) | `VITE_DEMO_MODE=true` | Same as Desktop — no real auth |

### Data Provider
`apps/dashboard/src/providers/dataProvider.ts`
- `getApiBase()` → reads `VITE_API_URL` env var for web, or `electronAPI.getLocalApiUrl()` for desktop
- All CRUD via Refine hooks (useList, useCreate, useUpdate, useDelete, useCustomMutation)
- Direct `fetch` calls were replaced with `useCustomMutation` so auth is handled uniformly

### Key Pages & Features

| Page | Route | Status |
|---|---|---|
| Dashboard | /dashboard | ✅ KPI tiles, recent campaigns |
| Sites | /sites | ✅ Platform picker, Shopify OAuth, WP wizard, snippet embed |
| Campaigns | /campaigns | ✅ List, status filter, create |
| Campaign Wizard | /campaigns/new | ✅ 3-step: basics, triggers, targeting |
| Campaign Detail | /campaigns/detail/:id | ✅ Edit design, triggers, targeting |
| Campaign Design (Builder) | /campaigns/:id/design | ✅ Block builder, affiliate slots |
| Analytics | /analytics | ✅ Charts, per-campaign table, CSV export |
| Billing | /billing | ✅ Plan comparison, Stripe checkout |
| Settings | /settings | ✅ Feature flags, theme, profile |
| Profile | /profile | ✅ API key, avatar, preferences |
| OpsCenter | /ops (ff_realtime_ops_dashboard) | ✅ Beta — SSE live events |
| Journeys | /journeys (ff_journeys_ui) | 🟡 Beta — placeholder UI |
| Experiments | /experiments (ff_experiments_ui) | 🟡 Beta — A/B test UI |
| Docs | /docs | ✅ Multi-page user guide |
| Licenses | /licenses | ✅ OSS licenses verbatim |
| Terms | /terms | ✅ |
| Privacy | /privacy | ✅ |
| Status | /status | ✅ |

---

## 11. WordPress Plugin

**Location:** `packages/wp-plugin/scrollpop/`  
**Distribution:** `.zip` download from dashboard Sites page (WP Plugin tab)

### Files
- `scrollpop.php` — Plugin header, activation/deactivation hooks
- `includes/class-scrollpop.php` — Core: snippet injection via `wp_footer`, REST API endpoint
- `includes/class-admin.php` — WP admin settings page: public key entry, connection status

### REST Endpoint
`GET /wp-json/scrollpop/v1/status`  
Returns `{ status, plugin, version, public_key, enabled, site_url, site_name }` — used by ScrollPop dashboard to verify the plugin is installed and the key matches.

### Snippet Injection
On `wp_footer` action: echoes the `<script>` inline stub with the stored public key.

---

## 12. Auth & Multi-Tenancy

### Account tiers

| Account | Email | Access level |
|---|---|---|
| **Super-admin** | `dwain3991@gmail.com` | God mode — admin console, unlimited plan, all tenants visible |
| **Novatise agency** | `*@novatise.com` | Unlimited agency plan (2M views), NO admin console access |
| **Regular user** | any other email | Normal plan-gated access |

`isAdmin` (admin console gate) and `isUnlimited` (plan limits bypass) are **separate flags** in `usePlan.ts`. Novatise users get `isUnlimited = true` but `isAdmin = false`.

### Novatise shared org
All `@novatise.com` emails share a single tenant keyed `org_novatise` (name: "Novatise", plan: agency). On first login without a Clerk org, `tenant-context.ts` routes them to this shared tenant instead of creating individual personal tenants. The org is auto-created if it doesn't exist.

### Clerk Organisation = Tenant
Every Clerk Organisation maps 1:1 to a `tenants` table row. The `clerkOrgId` is the foreign key.  
Personal accounts (no Clerk org) get an auto-provisioned tenant keyed `personal_{clerkUserId}`.  
Exception: `@novatise.com` emails → shared `org_novatise` tenant (see above).

### JWT Flow
1. Browser → Clerk session → `getToken()` returns a short-lived JWT
2. Dashboard sends `Authorization: Bearer {jwt}` to API
3. `tenant-context.ts` preHandler decodes JWT via `@clerk/fastify` `getAuth(request)`
4. Looks up tenant from `auth.orgId` (Clerk org ID), or provisions personal/Novatise tenant
5. Looks up user from `auth.userId`
6. Looks up membership + role
7. Sets `request.tenantId`, `request.userId`, `request.memberRole` on every request

### User deletion sync
When a user is deleted in the Clerk dashboard, the `user.deleted` webhook fires and:
1. Soft-deletes their personal tenant (sets `deleted_at`) — removes them from admin panel
2. Removes all `tenant_members` entries
3. Hard-deletes the user row (no `deleted_at` on users table)

> ⚠️ Requires `user.deleted` enabled in the Clerk webhook subscription settings.

### Admin console security
- `isAdmin` in `usePlan.ts` requires the `/me` API to return the exact `ADMIN_EMAIL`.
  There is **no localStorage fallback** — `isAdmin` is `false` until the API confirms.
  This prevents any cached/injected localStorage value from granting console access.
- `assertSuperAdmin` on the API checks exact email from the DB — cannot be spoofed.
- `@novatise.com` users get `isUnlimited = true` (agency plan limits) but `isAdmin = false`.

### Admin Console — Sync with Clerk
`POST /api/v1/admin/sync` reconciles the DB with live Clerk user list:
- Deletes user rows + personal tenants for Clerk-deleted users
- Soft-deletes orphaned `personal_*` novatise.com tenants (pre-shared-org)
- Called by the "Sync & Refresh" button in the admin panel; staleTime = 0 so data is always fresh

### Dev Bypass (non-production only)
If `NODE_ENV !== 'production'` and no Clerk auth is present, the preHandler creates/reuses a demo tenant (`org_demo_12345`) and sets tenant context automatically. This lets you test locally without a Clerk account.

### Internal Secret Bypass
Any request with `Authorization: Bearer {INTERNAL_SECRET}` bypasses Clerk auth. This is for the Cloudflare Worker and the desktop Electron app. The internal secret endpoint `/api/v1/auth/login` is gated to dev-only.

### RLS
Every tenant-scoped table has a Postgres RLS policy. The API service layer additionally filters by `tenantId` on all queries (defence in depth).

---

## 13. Billing & Plan Limits

### Plans

| Plan | Price/mo | Views/mo | Sites | Powered By Badge |
|---|---|---|---|---|
| free | $0 | 1,000 | 1 | Yes |
| starter | $19 | 25,000 | 3 | No |
| growth | $49 | 150,000 | 10 | No |
| scale | $129 | 500,000 | ∞ | No |
| agency | $299 | 2,000,000 | ∞ | No |

### Stripe Integration
- `POST /api/v1/billing/checkout` → creates Stripe Checkout session
- `POST /api/v1/billing/portal` → creates Stripe Customer Portal session
- Webhooks: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` → updates `tenants.plan` + `tenants.monthly_view_limit`
- Usage metering: views are counted in Redis, synced to Stripe Usage Records periodically (TODO: implement periodic flush — currently views are counted at DB level only)

### View Cap Enforcement
The Worker checks `tenants.monthly_view_count` against `tenants.monthly_view_limit` before returning the config payload. If over limit, returns a "limit exceeded" response and the snippet skips popup rendering.  
**Note: This enforcement logic is not fully implemented yet — see Known Bugs.**

---

## 14. Shopify Integration

### OAuth 2.0 Flow
1. Dashboard → `POST /api/v1/shopify/install` → returns Shopify OAuth permission URL
2. Merchant approves → Shopify redirects to `GET /api/v1/shopify/callback`
3. Callback validates: HMAC signature, timestamp freshness (±5 min), nonce from Redis
4. Exchanges code for offline access token
5. Upserts `shopify_installations` row
6. Injects Script Tag via Shopify Admin API (`POST /admin/api/2024-10/script_tags.json`)
7. Registers 4 mandatory GDPR webhooks
8. Redirects to `{DASHBOARD_URL}/sites?shopify_connected=1&shop={shop}`

### GDPR Mandatory Webhooks
All registered automatically during OAuth. All respond 200 immediately and perform no destructive action on non-GDPR data:
- `app/uninstalled` → sets `uninstalled_at`, clears `access_token`
- `shop/redact` → logs request (data purge is manual — Shopify gives 30 days)
- `customers/redact` → logs request
- `customers/data_request` → logs request (response must be sent within 30 days)

### Script Tag
- Source URL: `https://cdn.scrollpop.io/v1/{site.publicKey}/p.js`
- Injected on `onload` event
- Removed + re-injected on reconnect to clean up duplicates
- `script_tag_id` stored in `shopify_installations` for future deletion on disconnect

---

## 15. CI/CD Pipeline

**Location:** `.github/workflows/ci.yml`  
**Requires:** GitHub PAT with `workflow` scope (push blocked without it — push manually when token is updated)

### Pipeline Steps

push / PR merge to main
  ├── Lint + Typecheck + Unit Tests
  ├── Snippet size check (≤10 KB gzipped)
  ├── No history.*/popstate check
  ├── Deploy API → Render production (RENDER_DEPLOY_HOOK_URL)
  │     ⚠️ Render deploys from dwain-coder/Scroll-pop — sync manually after merge (see CONTRIBUTING §5b)
  ├── Deploy Worker → Cloudflare (wrangler deploy)
  └── Deploy Dashboard → Cloudflare Pages (branch=main → dashboard.scrollpop.online)
```

### Environment Secrets (GitHub Actions — Dw-Dwain/Scroll-pop)
```
RENDER_DEPLOY_HOOK_URL            Render production deploy hook
CLOUDFLARE_API_TOKEN              Worker deploy + KV purge
CLOUDFLARE_ACCOUNT_ID
VITE_API_URL                      Production API URL (baked into dashboard build)
VITE_CLERK_PUBLISHABLE_KEY        Same key for both envs
VITE_POSTHOG_KEY
VITE_STRIPE_PUBLISHABLE_KEY
```

### Two-repo deploy split
| Repo | Owner | CI deploys |
|---|---|---|
| `Dw-Dwain/Scroll-pop` | Dw-Dwain | Cloudflare Worker + Cloudflare Pages dashboard |
| `dwain-coder/Scroll-pop` | dwain-coder | Render API (connected directly to Render) |

After every `main` merge on `Dw-Dwain`, sync `dwain-coder` so Render picks up the new API code:
```bash
git checkout main && git pull
git push "https://ghp_TOKEN@github.com/dwain-coder/Scroll-pop.git" main --force
```
`allow_force_pushes` is enabled on `dwain-coder/Scroll-pop` so no branch-protection dance is needed.

---

## 16. Environment Variables (All)

### apps/api (.env)
```
DATABASE_URL=             Neon pooler connection string
DIRECT_DATABASE_URL=      Neon direct (for migrations)
REDIS_URL=                Upstash Redis REST URL
REDIS_TOKEN=              Upstash token
CLERK_SECRET_KEY=         sk_live_...
CLERK_PUBLISHABLE_KEY=    pk_live_...
CLERK_WEBHOOK_SECRET=     whsec_... (svix)
STRIPE_SECRET_KEY=        sk_live_...
STRIPE_WEBHOOK_SECRET=    whsec_...
STRIPE_PRICE_STARTER=     price_...
STRIPE_PRICE_GROWTH=      price_...
STRIPE_PRICE_SCALE=       price_...
STRIPE_PRICE_AGENCY=      price_...
CLOUDFLARE_ACCOUNT_ID=    For KV purge on publish
CLOUDFLARE_API_TOKEN=     For KV purge on publish
CLOUDFLARE_KV_NAMESPACE_ID=
SHOPIFY_API_KEY=          From Shopify Partners
SHOPIFY_API_SECRET=
SHOPIFY_SCOPES=           read_products,write_script_tags
API_BASE_URL=             https://scroll-pop.onrender.com
DASHBOARD_URL=            https://<your-cf-pages-url>
SNIPPET_CDN_URL=          https://cdn.scrollpop.io
PORT=                     3001
NODE_ENV=                 production
INTERNAL_SECRET=          32+ char random string
SENTRY_DSN=
```

### apps/dashboard (.env)
```
VITE_API_URL=             https://scroll-pop.onrender.com
VITE_CLERK_PUBLISHABLE_KEY=
VITE_POSTHOG_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_INTERNAL_SECRET=     (desktop Electron only)
VITE_DEMO_MODE=           false (production)
```

### apps/worker (wrangler.toml secrets)
```
API_ORIGIN=               https://scroll-pop.onrender.com
REDIS_URL=
REDIS_TOKEN=
SENTRY_DSN=
```

### packages/snippet (build-time, baked in)
```
SNIPPET_CDN_URL=          https://cdn.scrollpop.io
SNIPPET_EDGE_URL=         https://edge.scrollpop.io
```

---

## 17. Domain Architecture

### Current (Live)
| Domain | Purpose | Where configured |
|---|---|---|
| `scrollpop.online` | Root domain — Clerk base domain | Cloudflare DNS |
| `dashboard.scrollpop.online` | Dashboard SPA | Cloudflare Pages custom domain |
| `clerk.scrollpop.online` | Clerk Frontend API | CNAME → frontend-api.clerk.services |
| `accounts.scrollpop.online` | Clerk Account Portal | CNAME → accounts.clerk.services |
| `clkmail.scrollpop.online` | Clerk transactional email | CNAME → mail.ucwr17gizj42.clerk.services |
| `clk._domainkey.scrollpop.online` | Clerk DKIM signing | CNAME → dkim1.ucwr17gizj42.clerk.services |
| `clk2._domainkey.scrollpop.online` | Clerk DKIM signing | CNAME → dkim2.ucwr17gizj42.clerk.services |

### Planned (v2)
| Domain | Purpose | Status |
|---|---|---|
| `scrollpop.app` or `scrollpop.io` | Upgrade from scrollpop.online | Buy when budget allows |
| `api.scrollpop.online` | Custom domain for Render API | Not yet — see runbook |
| `cdn.scrollpop.online` | Snippet CDN via R2 | After R2 bucket setup |
| `edge.scrollpop.online` | Cloudflare Worker | After Worker deploy |
| `scrollpop.online` (root) | Marketing site | v2 — separate CF Pages project |

### Cloudflare DNS Records (scrollpop.online)
| Type | Name | Content | Proxy |
|---|---|---|---|
| CNAME | `dashboard` | `scrollpop-dashboard.pages.dev` | Proxied ☁️ |
| CNAME | `clerk` | `frontend-api.clerk.services` | DNS only ⬜ |
| CNAME | `accounts` | `accounts.clerk.services` | DNS only ⬜ |
| CNAME | `clkmail` | `mail.ucwr17gizj42.clerk.services` | DNS only ⬜ |
| CNAME | `clk._domainkey` | `dkim1.ucwr17gizj42.clerk.services` | DNS only ⬜ |
| CNAME | `clk2._domainkey` | `dkim2.ucwr17gizj42.clerk.services` | DNS only ⬜ |

> ⚠️ Clerk CNAME records MUST be DNS only (grey cloud). Proxying them breaks Clerk verification and email delivery.

---

## 18. Security Rules (Non-Negotiable)

These are hardcoded rules enforced in `CLAUDE.md` and verified in CI:

1. **No browser history manipulation** — `history.pushState`, `history.replaceState`, `onpopstate` are banned in the snippet and any customer-facing code. Google spam policy violation (enforced June 15, 2026).
2. **No `window.onbeforeunload`** in the snippet for navigation interception.
3. **RLS on every tenant-scoped table** — no exceptions. API also filters by `tenantId` in every query.
4. **Shadow DOM only** — `attachShadow({mode:'closed'})`. Never inject global CSS into the host page.
5. **No `eval()`, `document.write()`, `new Function()`** in the snippet.
6. **Snippet ≤10 KB gzipped** — hard CI gate.
7. **No hardcoded secrets** — all via environment variables.
8. **API routes versioned** at `/api/v1/`.
9. **All async functions** must handle errors — no unhandled promise rejections.
10. **Every migration reversible** — `.down.sql` file required.

---

## 19. Data Flow — End to End

### Popup Impression → Analytics

```
1. Visitor loads page
2. Inline stub loads p.js from CDN (async, non-blocking)
3. p.js calls GET edge.scrollpop.io/c/{pubkey}
   → Worker checks KV cache (sp_config:{pubkey})
   → Hit: returns JSON immediately
   → Miss: Worker calls GET scroll-pop.onrender.com/api/v1/internal/site-config/{pubkey}
           → API queries DB: site + active campaigns + designs + triggers + targeting + frequency
           → Returns SiteConfigPayload
           Worker writes to KV (60s TTL), returns to snippet
4. Snippet evaluates targeting rules
5. Snippet registers trigger listeners (scroll, dwell, etc.)
6. Trigger fires → snippet evaluates frequency
7. Snippet picks weighted affiliate slot
8. Snippet renders popup in Shadow DOM
9. Snippet sends "impression" + "view" beacons:
   POST edge.scrollpop.io/e → Worker → LPUSH sp_events Redis
10. Visitor clicks CTA:
    → Opens affiliate click_tracker_url (via window.open or redirect)
    → Snippet sends "click" beacon
11. Visitor closes popup → "dismiss" beacon
12. Periodic flush: API reads from Redis queue → bulk INSERT into events table
```

### Campaign Publish

```
1. Operator clicks Publish in dashboard
2. Dashboard → PATCH /api/v1/campaigns/:id (status: active)
3. API updates DB
4. API calls Cloudflare API: DELETE KV key sp_config:{pubkey}
5. Next snippet request → KV miss → re-fetches from API → new config live
   (Max propagation delay: ~60 seconds for cached visitors)
```

---

## 20. Feature Flags

Stored in `localStorage` (key: `_sp_flags`) and `apps/dashboard/src/lib/flags.ts`.

| Flag | Default | Feature |
|---|---|---|
| `ff_realtime_ops_dashboard` | false | OpsCenter SSE live view |
| `ff_journeys_ui` | false | Journeys (multi-step campaigns) |
| `ff_experiments_ui` | false | A/B experiments UI |

Toggle in Settings → Feature Flags panel. Flags are per-browser, not per-account.

---

## 21. Performance Budgets & Limits

| Metric | Limit | Current | Status |
|---|---|---|---|
| Snippet gzip size | 10 KB | 8.07 KB | ✅ |
| Inline stub size | 1.2 KB minified | ~0.8 KB | ✅ |
| LCP impact | 0 ms | 0 ms (async) | ✅ |
| API rate limit | 200 req/min/tenant | — | configured |
| KV cache TTL | 60 s | 60 s | configured |
| Redis queue depth | monitoring needed | — | TODO |
| Event ingest latency | <5 s to DB | ~2-3 s | ✅ |
| TimescaleDB → ClickHouse migration | at >50M events/month | N/A (pre-launch) | v3 |

---

## 22. What's Built vs Not Built

### ✅ Built & Working

#### Live pipeline (verified end-to-end June 2 2026)
- **Full popup pipeline is live**: snippet → `edge.scrollpop.online/c/:key` (config) →
  render → `POST /e` (events) → Neon → dashboard. Confirmed on a real customer site:
  ads rendering, telemetry flowing, analytics populating.
- **KV edge cache** (`SCROLLPOP_CONFIG`, 60s TTL) bound and live — config served from the
  edge instead of Worker→Render→Neon on every request.
- **Dashboard + Analytics auto-refresh in real time** (polling 15s / 20s, pauses when tab
  hidden) with a "Live" indicator.
- **events partitions auto-created on API boot** (`ensure-partitions.ts`) — the old manual
  monthly chore is gone; `/e` logs loudly if a partition is ever missing.
- **Campaign designer persists the entire left sidebar** (all triggers/targeting + the
  Display Frequency dropdown) via a `uiTriggers` snapshot in `design.config`.
- **In-app notifications** (migration 0006): tenant-scoped `notifications` table +
  `tenants.notification_prefs`. Top-nav bell (unread badge, dropdown, mark-read), gated by
  Settings → Notifications prefs (persisted server-side via `/api/v1/notification-prefs`).
  Schema auto-ensured on boot (`ensure-notifications.ts`).
  **Triggers wired** (all best-effort, fired from the `/e` ingest path, type === Settings
  key so per-type toggles work):
  - `notif_campaign_status` — campaign activate / pause.
  - `notif_usage_80` / `notif_usage_95` — monthly-view-limit thresholds. Sampled
    1-in-20 impressions to bound DB load; de-duped once/month via Redis NX flags
    (`sp_notif:u80|u95:{tenant}:{YYYY-MM}`, 38-day TTL); 95% also sets the 80% flag.
  - `notif_conversion` — cumulative conversion milestones (100 / 1k / 10k / 100k) via an
    atomic Redis counter (`sp_conv:{tenant}`); counts from feature launch, not historically.
  - ⏸ `notif_snippet_error` — **deferred**: needs either snippet-side error beaconing
    (blocked by the ≤10 KB gzip gate — only ~30 bytes of headroom) or a scheduled
    "site registered but no events in N days" job (no cron infra yet). Toggle exists; no
    emitter yet. Same applies to `notif_ab_winner` / `notif_invoice` / `notif_trial` /
    `notif_weekly` (all need a scheduler).
  Email/mobile delivery remains the next phase (needs a provider, e.g. Resend).

#### Infrastructure
- **Render Standard** — API always warm, zero cold starts; analytics event forwarding
  is reliable end-to-end (no more silently dropped events on cold start)
- **`cdn.scrollpop.online`** — Cloudflare Worker custom domain live; serves the snippet
  (`GET /v1/:key/p.js` → 200, bundle 9.6 KB gzipped)
- **`edge.scrollpop.online`** — Cloudflare Worker custom domain live; serves site config
  (`GET /c/:key`) and accepts event ingest (`POST /e`)
- **`dashboard.scrollpop.online`** — Cloudflare Pages, auto-deploys from `Dw-Dwain/Scroll-pop`
- **`scroll-pop.onrender.com`** — Fastify API, auto-deploys from `dwain-coder/Scroll-pop`
- Two-repo deploy split: `dwain-coder` holds Render secrets (API deploy); `Dw-Dwain` holds
  Cloudflare secrets (Worker deploy). CI skips Worker deploy silently on the repo without the token.

#### Auth & Accounts
- **Super-admin isolation**: `dwain3991@gmail.com` is the sole platform super-admin with
  access to the Admin Console. `isAdmin` (console gate) and `isUnlimited` (plan bypass) are
  separate flags — Novatise users get unlimited plan limits without admin console access.
- **Novatise shared org**: all `@novatise.com` emails auto-route to a single shared tenant
  (`org_novatise`, agency plan, 2M views) instead of each getting a separate personal tenant.
- **Admin Console**: super-admin view showing all tenants, plan badges, MRR (excludes
  super-admin's own tenant from revenue calc). "Super Admin" badge correctly shown on
  the admin row (was dead code before — fixed to detect by email not role field).
- **`user.deleted` webhook**: deleting a user in Clerk now soft-deletes their personal
  tenant, removes org memberships, and hard-deletes the user row — propagates immediately
  to the admin panel. Requires `user.deleted` enabled in Clerk webhook settings.
- Auth via Clerk — **personal-account model**: each signed-in user gets an auto-provisioned
  tenant (`personal_<clerkUserId>`) on first request; org-based multi-tenant path preserved
  for later; Novatise shared org is the first use of the org path.
- Email/password sign-up (real Clerk flow: create → email verification code → active session)
  plus Google/GitHub OAuth in both SignIn and SignUp pages
- Profile name saved to Clerk via `user.update()`; password/2FA routed to Clerk's own
  account-security dialog

#### Sites & Campaigns
- Sites CRUD with platform picker
- Shopify OAuth 2.0 + Script Tag injection + GDPR webhooks (code-complete; needs Shopify
  Partner app `redirect_uri` to be registered at `scroll-pop.onrender.com/api/v1/shopify/callback`)
- WordPress plugin download from GitHub release asset (`scrollpop-wp.zip`, forward-slash
  ZIP paths so Linux hosts extract correctly)
- Campaign wizard **3-step flow** (Details → Design → Launch); triggers/frequency/targeting
  configured in the Design editor's Triggers tab and saved on launch
- Campaign auto-activates on launch (was left as `draft` before)
- Campaign editor loads saved design reliably (fixed race condition where 1.5s fallback
  beat Render's response time and default styling was shown)
- Publish saves design AND preserves affiliate slots (was zeroing them on every save)
- After Publish → navigates back to campaigns list
- Template picker loads the full design (all steps: teaser/main/success)
- Full trigger types: scroll %, dwell time, inactivity, exit-intent mouse, click
- Full targeting types: URL exact/contains/regex, device, returning visitor
- Frequency rules (session/day/visitor/always) configurable in Design editor
- Settings → Save org name persists via `PATCH /tenants/:id`
- Settings → Pause all campaigns calls `POST /campaigns/:id/pause` for each active campaign

#### Snippet & Live Rendering
- **WYSIWYG element renderer**: snippet renders `config.steps.main.elements` (heading/text/
  button/input/image/shape/divider/badge/close) using the editor's coordinate system
  (absolute %-positioned, colors, fonts, z-index). Flat-field fallback kept for legacy/gamified.
- Close button: click opens `el.href`/slot URL in new tab; `visibilitychange` auto-dismisses
  and resets frequency caps when user returns so triggers re-fire
- CORS: methods `GET/POST/PUT/PATCH/DELETE/OPTIONS` explicitly set; dashboard origins +
  Pages preview subdomain pattern allowed
- Analytics event pipeline: snippet → edge Worker → API `/e` → DB. Worker has 10s
  timeout. **Root cause of empty analytics identified and fixed**: the events table is
  partitioned by month but only had partitions through `events_2025_11` — every 2026
  insert silently failed with "no partition found". 2026 monthly partitions created in
  Neon console. Events now flow correctly end-to-end.
- Analytics dashboard: range selector (7d/30d/90d) now actually filters data (was
  cosmetic — API always returned 30d). Delta % are real curr-vs-prev calculations, not
  hardcoded strings.
- Sites page: campaign count and monthly views now pulled from DB via COUNT queries
  (were always `00`/`0`). Enrichment wrapped in try/catch so a DB error never crashes
  the site list.
- `sendBeacon` / `fetch({keepalive:true})` for all event beaconing

#### CI/CD & Deploy
- All in-code infra references repointed from placeholder `scrollpop.io` to owned `scrollpop.online`
- **Dashboard deploy wired into CI** (`deploy-dashboard` job).
  `main` push → `dashboard.scrollpop.online`.
  Non-secret VITE vars (`VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`) hardcoded in ci.yml —
  they are publishable values, not secrets.
- Worker deploy gracefully skips on repos without the CF token (two-repo split)
- `dwain-coder/Scroll-pop` `allow_force_pushes` enabled — syncs are a single `git push --force`
- **pnpm v11 build scripts**: `better-sqlite3` in `ignoredBuiltDependencies` (root package.json)
  to silence its blocked postinstall. `posthog-js` removed from npm — it pulled in `core-js` +
  `protobufjs` which pnpm v11 blocks and cannot be silenced without interactive `approve-builds`.
  PostHog to be added via CDN snippet when key is configured.

#### Design & UI
- Multi-page docs, Terms, Privacy, Status, License pages
- Profile password/2FA/sign-in methods route to Clerk's real account-security dialog
- Settings/Profile actions that have no backend show honest "not available" messaging
  instead of fake success toasts

### ❌ Not Built Yet (v2 targets)
- Real-time view limit enforcement in Worker (currently uncapped)
- Stripe billing: UI checkout wired to real Stripe API; needs `STRIPE_PRICE_*` env vars +
  Shopify Partner webhook endpoint configured before going live
- Stripe Usage Records metering (views are not reported to Stripe)
- **Neon partition maintenance**: 2026 partitions created manually in production; need a
  migration/cron to auto-create future monthly partitions before each month starts
- `api.scrollpop.online` custom domain (API still at `scroll-pop.onrender.com`)
- Clerk Organizations / team UI — personal accounts only; org-based path dormant
- `scrollpop.online` marketing site
- Email notifications (view limit warnings, campaign status changes)
- Campaign scheduling (start/end dates)
- Geo targeting (country/region)
- UTM parameter targeting
- Webhook / outbound HTTP on conversion events
- Campaign duplication via UI (backend supports it; no button)
- Bulk campaign operations
- Team invitations UI (Clerk org invitations exist but no dashboard wrapper)
- Shopify App Store submission (App Embed Block needed first)
- Shopify App Embed Block (vs Script Tag)
- Advanced URL-targeting rule builder + campaign scheduler (removed from wizard as step 3;
  defaults to all pages / always-on; deferred to post-launch edit screen)
- Actions step (post-submit redirect, confetti, Mailchimp/Klaviyo, follow-up email) —
  removed from wizard; snippet always shows success view; revisit when integrations are built
- API key management (rotate/create API keys — no backend route exists)
- Analytics reset endpoint (events are immutable append-only)
- Account-wide data export (GDPR)
- Account/org deletion backend
- GoFundMe / Donorbox platform-specific setup guides
- Admin impersonation for support
- Playwright E2E test suite (Vitest unit tests exist)
- Sentry error tracking (DSN set but `Sentry.init()` not called in API or dashboard)
- PostHog analytics (key set but `posthog.init()` not called)
- Affiliate slot click tracking postback (client-side only)
- Conversion event API (external postback from merchant site)
- Teaser + success step WYSIWYG rendering (snippet uses built-in layout for those two steps)

---

## 23. v2 Roadmap

Priority order for the next release cycle:

1. **Real view cap enforcement** — Worker reads tenant plan limits from KV, suppresses config when over limit. Sync limit to KV on plan change.
2. **Stripe Usage Records** — flush monthly view counts to Stripe Usage API so overages are billed correctly.
3. **Campaign scheduling** — `starts_at` / `ends_at` on campaigns. Worker checks timestamps.
4. **`api.scrollpop.online` custom domain** — Cloudflare proxied to Render. HTTPS everywhere.
4a. **Neon partition auto-create** — ✅ done (`apps/api/src/db/ensure-partitions.ts` runs on
    API boot). Kept here for history.
4b. **Affiliate-network links (Amazon Associates / Rakuten)** — Settings → Affiliate Networks UI
    added (saved links, currently localStorage). Pending: persist to the backend and auto-wire
    into campaign affiliate slots (append affiliate tags to product/click-tracker URLs) so they
    flow through to live ads. Org identity + these settings fields need a `tenants`-column
    migration (website, support_email, locale prefs, affiliate links) — see §25 migration note.
5. **Email notifications** — Resend/SendGrid integration. Alert at 80 % view cap, campaign go-live, billing failure.
6. **Geo targeting** — add `geo_country` / `geo_region` to TargetingKind. Worker reads Cloudflare CF-IPCountry header.
7. **UTM targeting** — match on `utm_source`, `utm_campaign`, `utm_medium` from URL params.
8. **Shopify App Embed Block** — replace Script Tag with proper App Embed (no theme code, better performance).
9. **Shopify App Store submission** — after App Embed Block is live.
10. **Team invitations UI** — wrap Clerk organisation invitations in the Settings page.
11. **Campaign duplication UI** — single button on Campaign Detail to clone a campaign.
12. **Sentry + PostHog initialisation** — wire up `Sentry.init()` in both API and Dashboard. Call `posthog.init()` in Dashboard.
13. **E2E test suite** — Playwright tests for: sign-in, create site, create campaign, publish, verify popup renders.
14. **scrollpop.io marketing site** — separate Cloudflare Pages site.

---

## 24. v3 Roadmap

Longer-horizon features:

- **ClickHouse migration** — at >50M events/month, migrate analytics writes from TimescaleDB to ClickHouse for OLAP performance.
- **Real-time social-proof popups** — "X people bought this in the last hour" overlays. Requires a pub/sub mechanism.
- **AI copy generation** — GPT-4o integration in the campaign wizard to suggest headlines based on site URL / product description.
- **SAML SSO** — enterprise orgs. Clerk supports SAML — just needs exposing in the UI.
- **Native iOS / Android SDKs** — in-app popup SDK for mobile apps.
- **Full white-labelling** — custom domain + custom branding for agency plans.
- **Advanced A/B testing** — Bayesian significance testing, multi-arm bandit allocation.
- **Webhook outbound** — fire HTTP callbacks to operator URLs on conversion events.
- **GDPR data export** — one-click download of all visitor event data for a site (required for Shopify App Store approval).
- **Campaign templates library** — pre-built designs for common use cases (exit offer, newsletter signup, affiliate product launch).
- **Multi-variant campaigns without code** — visual A/B from the campaign builder directly.
- **Affiliate network integrations** — native connections to ShareASale, Impact, CJ Affiliate APIs to pull product creatives automatically.

---

## 25. Known Bugs & Tech Debt

### Resolved incident — production migration drift (June 2 2026)
**Symptom:** live snippet config 502'd on every page (`edge/c/:key`), no popups, no
events, empty analytics. **Root cause:** migration `0005` (adds
`frequency_rules.interval_days`) was never applied to the Neon production DB, so the
config route threw `column "interval_days" does not exist` (PG 42703) → 500 → Worker
502. **Fix:** applied the pending migration SQL to prod Neon. **Prevention:** migrations
are now a mandatory documented post-merge step (CONTRIBUTING §6); Render Pre-Deploy
auto-apply is the recommended hardening. **Lesson:** Render does not run migrations on
deploy — prod silently drifts behind code on every new migration until applied by hand.

### Compliance — audit Jun 2 2026 (most items now addressed)
> Engineering review, **not legal advice** — have an attorney review Terms/Privacy/DPA.

**Addressed Jun 2 2026:** snippet now honors a host consent signal
(`window.__sp_consent === false` / Google Consent Mode `analytics_storage:'denied'`)
in addition to DNT — disables analytics + visitor-id, popups still show. **Strict
per-tenant opt-in consent mode now shipped (CMP1 fully resolved):** when a tenant
enables it (Settings → Visitor Privacy), the snippet records **nothing** until consent
is explicitly granted (`window.__sp_consent === true` or Consent Mode
`analytics_storage:'granted'`). Plumbed migration-free via
`tenants.notification_prefs.require_consent` (JSONB) → internal config payload
`requireConsent` → snippet `_requireConsent` flag → `evaluateSkipTracking()`. Marketing claims softened —
competitor comparisons qualified, "Google-compliant" reworded to "avoids the popup tricks
Google penalizes" (CMP2/CMP3). Privacy docs (site LegalView + dashboard PrivacyPage)
reconciled: correct sub-processors (Clerk/Stripe/Cloudflare/Neon/Render/Upstash, Sentry
when enabled), IP→geo "not stored" disclosed, localStorage (not cookie) clarified, DPA
"available on request", domain fixed to scrollpop.online (CMP4). License guard documented
in CONTRIBUTING (`license-checker`); stack is permissive (CMP5). **Still recommended:**
attorney review + a signed DPA template.

| # | Severity | Item |
|---|---|---|
| CMP1 | ✅ Resolved | Visitor consent gate shipped. Default honors DNT + explicit denial; **strict per-tenant opt-in** (Settings → Visitor Privacy) records nothing until `window.__sp_consent === true` / Consent Mode `granted`. Migration-free via `notification_prefs.require_consent`. |
| CMP2 | High | **Comparative marketing claims** about named competitors (Privy/OptinMonster/Poptin "120–250 KB", "banned back-button tricks") must be substantiable (FTC / EU). Soften to qualified language or cite evidence. |
| CMP3 | Med | **"Google-compliant"** is overstated — true re: no history/popstate, but a mobile modal can still be an intrusive interstitial. Qualify the claim. |
| CMP4 | Med | ScrollPop is a **data processor** → publish a sub-processor list (Neon, Cloudflare, Upstash, Clerk, Render) + provide a **DPA**; reconcile the "no PII / no IP stored" copy (IP is processed for geo; email-capture collects PII). |
| CMP5 | Low | Add **`license-checker` in CI** to guard against future copyleft deps. Current stack is permissive (MIT/ISC/Apache/BSD); WP plugin is GPL (correct). Unsplash images + OFL/Apache fonts are commercial-OK. |

**Sentry:** deferred to v2/v3 (cost decision, Jun 2 2026). Mitigations in place: `/e`
logs dropped events loudly, and `ensure-partitions` / `ensure-notifications` self-heal
schema on boot.

### Active Bugs
| # | Severity | Description | Location |
|---|---|---|---|
| B1 | High | View cap not enforced at Worker level — paid users can go over their plan limit silently | `apps/worker/src/index.ts` |
| B2 | High | Stripe usage records not synced — overage billing doesn't work | `apps/api/src/routes/billing.ts` |
| B3 | Medium | `tenants.deleted_at` check missing in some tenant queries | `apps/api/src/plugins/tenant-context.ts` |
| B4 | Medium | No retry logic on Redis event queue flush — events can be lost if DB is down during flush | `apps/api/src/routes/internal.ts` |
| B5 | Low | `devUrl` (tunnel URL) in Sites.tsx is hardcoded to a loca.lt URL | `apps/dashboard/src/pages/Sites.tsx:352` |
| B6 | Low | `Experiments` and `Journeys` pages show placeholder content — routes exist but features not functional | Dashboard |

### Tech Debt
| # | Description | File |
|---|---|---|
| T1 | Sentry SDK imported but `Sentry.init()` never called in production | Both API and Dashboard |
| T2 | PostHog `posthog.init()` never called | `apps/dashboard/src/main.tsx` |
| T3 | `any` types in several Dashboard components (`Sites.tsx`, `CampaignDetail.tsx`) — should be typed to schema types | Dashboard pages |
| T4 | No Playwright E2E tests — only unit tests exist | — |
| T5 | `apps/worker` event flush is a TODO in the Worker; events are currently only flushed by the API's `/e` local endpoint | `apps/worker/src/index.ts` |
| T6 | Marketing site (`scrollpop.io`) does not exist | — |
| T7 | `api.scrollpop.io` custom domain not yet configured | Cloudflare DNS |
| T8 | WordPress plugin `.zip` download URL (`cdn.scrollpop.io/plugins/scrollpop-wp.zip`) returns 404 — file not uploaded to R2 | R2 bucket |
| T9 | No rate limiting on Shopify OAuth callback — could be flooded by crafted HMAC-invalid requests | `apps/api/src/routes/shopify.ts` |
| T10 | `weight` field on affiliate slots is in schema but the Campaign Wizard UI doesn't expose it — defaults to 1 for all slots | Dashboard CampaignWizard |

---

## 26. Key Design Decisions (ADRs)

### ADR-001: Shadow DOM (closed mode) for popup rendering
**Decision:** All popup UI is rendered inside `attachShadow({mode:'closed'})`.  
**Reason:** Prevents popup CSS from leaking into or being overridden by the host page. Also satisfies Google's spam policies — the popup cannot manipulate the DOM in ways that affect the host page's navigation or content.  
**Trade-off:** Slightly harder to customise from host-page CSS; custom font loading requires explicit `@font-face` injection into the shadow root.

### ADR-002: No history manipulation in snippet
**Decision:** The snippet has zero `history.*` and `onpopstate` calls.  
**Reason:** Google's spam policy (June 15, 2026 enforcement) explicitly bans popups that manipulate browser history. Violating this causes penalty/de-indexing.  
**Trade-off:** Cannot implement "back-button triggered" popups, which are a common (but policy-violating) pattern.

### ADR-003: Cloudflare Worker as thin edge layer only
**Decision:** No business logic in the Worker. Config fetch → KV. Events → Redis queue. That's it.  
**Reason:** Worker cold-start latency is minimised with small code. Business logic has no place in a stateless edge function. All joins, RLS, billing checks etc. require DB access which belongs in the API.  
**Trade-off:** KV cache miss adds one extra network hop (Worker → Render API). Acceptable since snippets cache for 60 seconds.

### ADR-004: Drizzle ORM over Prisma
**Decision:** Drizzle ORM with hand-written SQL migrations.  
**Reason:** Drizzle generates no runtime code, is fully type-safe, and doesn't require a separate schema file syncing step. Migrations are plain SQL that can be read, audited, and run directly. Better performance than Prisma for high-concurrency workloads.  
**Trade-off:** More verbose query building syntax than Prisma's fluent API.

### ADR-005: Clerk for auth over Auth.js / Supabase Auth
**Decision:** Clerk with multi-tenant organisations.  
**Reason:** Built-in organisation/team management, RBAC, SSO readiness, and a polished hosted auth UI. Saves months of auth infrastructure work.  
**Trade-off:** Vendor dependency; pricing scales with MAU.

### ADR-006: Neon over Supabase as production DB
**Decision:** Neon PostgreSQL (with TimescaleDB extension) as the production database.  
**Note:** Supabase was initially assumed to be the production database. During deployment, it was discovered the actual connection string pointed to Neon. Supabase credentials were also set up but are not used for production.  
**Reason (Neon):** Better serverless cold-start performance, simpler connection pooling.

### ADR-007: pnpm workspaces + Turborepo over Nx
**Decision:** pnpm + Turborepo for monorepo management.  
**Reason:** Turborepo's task caching is simpler to configure than Nx's plugin ecosystem. pnpm's strict hoisting prevents phantom dependency issues.  
**Trade-off:** Turborepo has fewer built-in generators than Nx.

---

## 27. Operational Runbook

### Deploy API to Production (Render)
```bash
# Automatic on push to main (if CI is configured)
# Manual trigger:
curl -X POST $RENDER_DEPLOY_HOOK_URL
```

### Run a Database Migration
```bash
cd apps/api
# Apply all pending migrations:
npx tsx -e "
import postgres from 'postgres';
import fs from 'fs';
const sql = postgres(process.env.DATABASE_URL);
const migration = fs.readFileSync('drizzle/migrations/000X_name.sql', 'utf8');
await sql.unsafe(migration);
await sql.end();
console.log('done');
"
```

### Purge a Campaign from KV Cache
```bash
# Via Cloudflare API:
curl -X DELETE \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/sp_config:{publicKey}" \
  -H "Authorization: Bearer {CLOUDFLARE_API_TOKEN}"
```

### Check Redis Event Queue Depth
```bash
curl https://{REDIS_URL}/llen/sp_events \
  -H "Authorization: Bearer {REDIS_TOKEN}"
```

### Rotate INTERNAL_SECRET
1. Generate new secret: `openssl rand -base64 32`
2. Update `INTERNAL_SECRET` env var in Render
3. Update in `VITE_INTERNAL_SECRET` in Cloudflare Pages (for desktop mode — if used)
4. Redeploy API
5. Update Worker secret: `wrangler secret put INTERNAL_SECRET`

### Rotate Neon Password ⚠️
1. Neon console → Project → Settings → Roles → neondb_owner → Reset password
2. Update `DATABASE_URL` and `DIRECT_DATABASE_URL` in Render env vars
3. Trigger redeploy

### Shopify App Resubmit (after disconnect)
If the Shopify app is uninstalled and the merchant wants to reconnect:
- Dashboard → Sites → site detail → Shopify OAuth tab → Connect again
- A new `shopify_installations` row is upserted; `uninstalled_at` is cleared

---

## 28. Dependency Map

```
apps/api
  ├── @scrollpop/shared      (Zod schemas + types)
  ├── fastify 5              (HTTP server)
  ├── @clerk/fastify         (JWT auth)
  ├── @fastify/cors
  ├── @fastify/rate-limit
  ├── drizzle-orm + postgres (DB access)
  ├── @upstash/redis         (cache + event queue)
  ├── stripe                 (billing)
  └── svix                   (webhook verification)

apps/dashboard
  ├── @scrollpop/shared
  ├── react 19 + vite
  ├── @clerk/clerk-react     (session + UI)
  ├── @refinedev/core        (data provider + CRUD hooks)
  ├── zustand                (builder state)
  ├── @dnd-kit/*             (drag-drop builder)
  ├── lucide-react           (icons)
  ├── tailwindcss v4
  ├── motion                 (animations)
  └── date-fns               (date formatting)

apps/worker
  ├── @scrollpop/shared
  ├── @cloudflare/workers-types
  └── wrangler               (deploy tooling)

packages/snippet
  ├── (no runtime deps — vanilla TS)
  └── esbuild                (bundler)

packages/shared
  └── zod                    (schema validation + type inference)

packages/wp-plugin
  └── (pure PHP — no npm deps)
```

---

---

## 29. Production Setup Log (May 29, 2026)

A record of every step taken to go from code to live production. Useful if you ever rebuild from scratch or onboard someone.

### Phase 1 — Render (API Host)
1. Created Render web service `scroll-pop` from GitHub repo `Dw-Dwain/Scroll-pop`
2. Set build command: `pnpm --filter api build`
3. Set start command: `node apps/api/dist/index.js`
4. Added all env vars (see Section 5 table above)
5. Neon password rotated after being exposed in chat — `DATABASE_URL` and `DIRECT_DATABASE_URL` updated

### Phase 2 — Shopify App
1. Created app manually on [partners.shopify.com](https://partners.shopify.com) — name: **ScrollPop**
2. Set App URL: `https://scroll-pop.onrender.com/api/v1/shopify/install`
3. Set Redirect URL: `https://scroll-pop.onrender.com/api/v1/shopify/callback`
4. Set scopes: `read_products,write_script_tags`
5. Copied Client ID (`37618fc8e087622a64ac244a2edd49f1`) and Client Secret → added to Render
6. **Do NOT use** `npm init @shopify/app@latest` — that scaffolds a standalone embedded app. ScrollPop uses a simple OAuth flow inside the existing Fastify API.

### Phase 3 — Cloudflare Pages (Dashboard)
1. Went to Cloudflare → Workers & Pages → Create → **Pages** tab
2. Connected GitHub repo `Dw-Dwain/Scroll-pop`
3. Framework preset: **None** (VitePress appeared but is wrong — that's for docs sites)
4. Build command: `pnpm --filter dashboard build`
5. Build output directory: `apps/dashboard/dist`
6. Root directory: `/`
7. Added env var: `VITE_API_URL=https://scroll-pop.onrender.com`
8. Added env var: `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...`
9. Deployed successfully — available at `https://scrollpop-dashboard.pages.dev`

> ⚠️ **CF Pages bakes `VITE_*` vars at build time.** After changing any `VITE_*` env var, you MUST trigger a redeploy (Deployments → `...` → Retry deployment).

### Phase 4 — Domain (scrollpop.online)
1. Purchased `scrollpop.online` for ~$1/yr (budget choice — plan to upgrade to `scrollpop.app`)
2. Added to Cloudflare: dash.cloudflare.com → Add a site → `scrollpop.online` → Free plan
3. Updated registrar nameservers to Cloudflare's two nameservers
4. Waited ~20 mins for propagation → domain showed Active in Cloudflare

### Phase 5 — Clerk Production Instance
1. Clerk dashboard → Scroll Pop app → switched from Development to **Production**
2. Went through 2 setup tasks:
   - **Google OAuth**: Created Google Cloud OAuth credentials. Authorized redirect URI: `https://clerk.scrollpop.online/v1/oauth_callback`. Pasted Client ID + Secret into Clerk.
   - **DNS / Domain**: Changed Clerk domain from `scrollpop-dashboard.pages.dev` (can't add DNS records there — it's a CF subdomain) to `scrollpop.online`
3. Added 5 CNAME records to Cloudflare DNS (all DNS only — see Section 17)
4. Clicked Verify configuration → 2/5 verified immediately; email records needed propagation time
5. Got new production `pk_live_...` key (changes when domain changes) → updated on Render and CF Pages

### Phase 6 — Custom Domain on Cloudflare Pages
1. CF Pages → `scrollpop-dashboard` → Custom domains → `dashboard.scrollpop.online`
2. Cloudflare auto-created the CNAME record (`dashboard` → `scrollpop-dashboard.pages.dev`, Proxied)
3. Dashboard now accessible at `https://dashboard.scrollpop.online`
4. Updated Render `DASHBOARD_URL` → `https://dashboard.scrollpop.online`

### Phase 7 — Worker (Cloudflare)
- Worker project `scrollpop-worker` deployed via GitHub Actions (CI on `Dw-Dwain/Scroll-pop`)
- Custom domains provisioned automatically: `cdn.scrollpop.online` + `edge.scrollpop.online`
- `INTERNAL_SECRET` Cloudflare secret set (must equal `INTERNAL_SECRET` on Render API)
- `API_ORIGIN` set to `https://scroll-pop.onrender.com`
- **KV namespace** not yet bound — config served uncached from origin (code handles missing KV gracefully)

### Phase 8 — Render Pro Upgrade (May 30, 2026)
- Upgraded Render service `scroll-pop` from Free → **Pro ($25/mo)**
- Always-warm: no cold starts, no 10-30s spin-up delay
- Analytics event forwarding now reliable — previously the Worker's `ctx.waitUntil` forward
  timed out silently on a cold Render, dropping events before they reached the DB
- Resolved the edge-config 502 issue that was blocking popup config delivery
- `INTERNAL_SECRET` auth between Worker and API now works end-to-end (verified 200 on
  `edge.scrollpop.online/c/<real-key>`)

### What's Still Pending
- [ ] Stripe setup (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs) + billing UI
- [x] Cloudflare KV namespace `SCROLLPOP_CONFIG` bound in `wrangler.toml` (id `00a5652f…`) — **done, live**
- [ ] Cloudflare R2 bucket → update `SNIPPET_CDN_URL` to serve from R2 instead of Worker bundle
- [ ] Sentry DSN → call `Sentry.init()` in API + Dashboard
- [ ] PostHog → call `posthog.init()` in Dashboard
- [ ] `api.scrollpop.online` custom domain (Cloudflare DNS → Render)
- [ ] Render **Pre-Deploy Command** to auto-apply DB migrations (prevents the June 2 migration-drift outage from recurring — see §25)

---

## Session Log — June 1, 2026

### Account hierarchy & admin isolation
**Problem:** `@novatise.com` emails were treated as super-admins — they could access the Admin Console API routes and the admin panel UI. Multiple `@novatise.com` logins each got their own personal tenant instead of sharing one org.

**Fixed in:**
- `apps/api/src/routes/admin.ts` — `isAdminUser()` now exact-email-only (`dwain3991@gmail.com`). Domain wildcard removed.
- `apps/api/src/plugins/tenant-context.ts` — Added `NOVATISE_ORG_KEY = 'org_novatise'`. Personal-account path now routes `@novatise.com` emails to the shared Novatise tenant (agency plan, 2M views) instead of `personal_{clerkUserId}`.
- `apps/dashboard/src/hooks/usePlan.ts` — Split `isAdmin` (super-admin only) from `isUnlimited` (super-admin + novatise.com). Plan limits, `hasFeature`, `withinLimit`, `meetsMinPlan` all use `isUnlimited`. `isAdmin` now purely gates the Admin Console.
- `apps/dashboard/src/pages/AdminPanel.tsx` — Badge detection fixed: was `u.role === 'admin'` (dead code, role is always `'owner'`), now `u.email === ADMIN_EMAIL`. Shows "Super Admin" + shield icon. MRR/paid counts exclude the super-admin's own tenant.

### user.deleted webhook
**Problem:** Deleting a user in the Clerk dashboard had no effect on the ScrollPop DB — they still appeared in the admin panel.

**Fixed in:** `apps/api/src/routes/webhooks.ts` — Added `user.deleted` case:
1. Soft-deletes `personal_{clerkUserId}` tenant
2. Deletes all `tenant_members` entries
3. Hard-deletes user row (no `deleted_at` on users table)

> ⚠️ Enable `user.deleted` in Clerk Dashboard → Webhooks → your endpoint → subscribed events.

### Dashboard CI deploy (was missing entirely)
**Problem:** The `ci.yml` had no deploy step for the dashboard — only API (Render) and Worker (Cloudflare) were wired. Every push was deploying the backend but leaving the frontend static.

**Fixed in:** `.github/workflows/ci.yml` — Added deploy job:
- `deploy-dashboard` (on `main`) — builds `apps/dashboard`, deploys to Cloudflare Pages `branch=main`

### dwain-coder sync
Synced `dwain-coder/Scroll-pop` `main` with all changes via force push (repos had diverged at merge-commit topology). Enabled `allow_force_pushes` on `dwain-coder/Scroll-pop` at repo level so future syncs don't require toggling branch protection.

---

## 30. Connection Points & How to Change Them

Every place one service talks to another, and exactly how to change it if you swap providers or URLs.

---

### Dashboard → API
**What:** Every API call from the React dashboard goes to `VITE_API_URL`.

**Current value:** `https://scroll-pop.onrender.com`

**To change (e.g. new Render URL, or custom `api.scrollpop.online`):**
1. Cloudflare Pages → Settings → Environment Variables → edit `VITE_API_URL`
2. Trigger redeploy (baked at build time)
3. If also used in GitHub Actions CI: update `VITE_API_URL` secret there too

---

### Dashboard → Clerk Auth
**What:** `VITE_CLERK_PUBLISHABLE_KEY` tells Clerk SDK which instance/domain to use. It encodes the Clerk Frontend API URL inside the key — changing the Clerk domain issues a new key.

**Current value:** `pk_live_...` pointing to `clerk.scrollpop.online`

**To change (e.g. new domain, new Clerk instance):**
1. Clerk dashboard → API Keys → copy new `pk_live_...`
2. Update `VITE_CLERK_PUBLISHABLE_KEY` on Cloudflare Pages
3. Update `CLERK_PUBLISHABLE_KEY` on Render
4. Update `CLERK_SECRET_KEY` on Render with matching `sk_live_...`
5. Trigger CF Pages redeploy

> ⚠️ If you change the Clerk domain, the publishable key changes. Always get a fresh key after a domain change.

---

### API → Database (Neon)
**What:** `DATABASE_URL` (pooled) and `DIRECT_DATABASE_URL` (direct) on Render.

**To rotate password:**
1. Neon console → Settings → Roles → neondb_owner → Reset password
2. Update both `DATABASE_URL` and `DIRECT_DATABASE_URL` on Render with new password
3. Render auto-redeploys

**To move to a different Postgres host:**
1. Export data from Neon (`pg_dump`)
2. Import to new host
3. Update both connection strings on Render
4. Run `pnpm --filter api drizzle-kit migrate` against new host using `DIRECT_DATABASE_URL`

---

### API → Redis (Upstash)
**What:** `REDIS_URL` + `REDIS_TOKEN` on Render. Used for rate limiting and event queue.

**To change:**
1. Get new Upstash REST URL + token
2. Update `REDIS_URL` and `REDIS_TOKEN` on Render
3. Redeploy

---

### API → Clerk (backend JWT verification)
**What:** `CLERK_SECRET_KEY` on Render. Used by `@clerk/fastify` to verify JWTs.

**To rotate:**
1. Clerk dashboard → API Keys → roll secret key
2. Update `CLERK_SECRET_KEY` on Render
3. Redeploy API

---

### API → Stripe
**What:** `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` on Render.

**To set up:**
1. [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API Keys → Secret key
2. Add `STRIPE_SECRET_KEY` to Render
3. Stripe → Developers → Webhooks → Add endpoint: `https://scroll-pop.onrender.com/api/v1/webhooks/stripe`
4. Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Copy signing secret → add as `STRIPE_WEBHOOK_SECRET` on Render
6. Add Stripe Price IDs: `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_SCALE`, `STRIPE_PRICE_AGENCY`

---

### API → Shopify
**What:** `SHOPIFY_API_KEY` + `SHOPIFY_API_SECRET` on Render. Set at app creation time on partners.shopify.com.

**To rotate secret:**
1. partners.shopify.com → Apps → ScrollPop → API credentials → Rotate secret
2. Update `SHOPIFY_API_SECRET` on Render
3. Redeploy (existing store installations remain valid — token is stored in DB, not the secret)

**To change OAuth callback URL:**
1. partners.shopify.com → Apps → ScrollPop → Configuration → update Redirect URL
2. Update `API_BASE_URL` on Render if the Render URL changes

---

### Worker → API (cache miss)
**What:** `API_ORIGIN` secret in Cloudflare Worker (wrangler). Worker fetches from `{API_ORIGIN}/api/v1/internal/site-config/{pubkey}` on KV miss.

**To change:**
```bash
cd apps/worker
wrangler secret put API_ORIGIN
# enter: https://scroll-pop.onrender.com
```

---

### Worker → Redis
**What:** `REDIS_URL` + `REDIS_TOKEN` in Cloudflare Worker. Worker pushes events to Redis.

**To change:**
```bash
wrangler secret put REDIS_URL
wrangler secret put REDIS_TOKEN
```

---

### Snippet → Edge Worker
**What:** Build-time constants `SNIPPET_CDN_URL` and `SNIPPET_EDGE_URL` baked into `packages/snippet/dist/p.js`.

**To change:**
1. Update in `packages/snippet/build.mjs` (or `.env` if env-driven)
2. Rebuild snippet: `pnpm --filter snippet build`
3. Upload new `p.js` to R2 / CDN
4. Purge CDN cache

---

### Changing the Domain (e.g. scrollpop.online → scrollpop.app)
Full migration checklist:
1. Buy new domain (Cloudflare Registrar recommended — no nameserver change needed)
2. Add to Cloudflare if external registrar: Add site → update nameservers
3. **Clerk:** Configure → Developers → Domains → Change domain → type new domain → save
4. **Get new Clerk keys:** API Keys → copy new `pk_live_...` (key changes with domain)
5. **Cloudflare Pages custom domain:** Remove `dashboard.scrollpop.online` → add `dashboard.scrollpop.app`
6. **Cloudflare DNS:** Add 5 Clerk CNAME records under new domain (all DNS only)
7. **Update env vars on Render:**
   - `DASHBOARD_URL` → `https://dashboard.scrollpop.app`
   - `CLERK_PUBLISHABLE_KEY` → new `pk_live_...`
8. **Update env vars on Cloudflare Pages:**
   - `VITE_CLERK_PUBLISHABLE_KEY` → new `pk_live_...`
   - Trigger redeploy
9. **Old domain:** Add redirect rule in Cloudflare: `dashboard.scrollpop.online/*` → `https://dashboard.scrollpop.app/$1` (301)
10. **Verify:** Visit new domain → Clerk sign-in works → API calls succeed

---

### Changing the API Host (e.g. Render → Fly.io)
1. Deploy API to new host, get new URL (e.g. `https://scrollpop.fly.dev`)
2. Set all same env vars on new host
3. Update `VITE_API_URL` on Cloudflare Pages → redeploy
4. Update `API_BASE_URL` on new host
5. Update `DASHBOARD_URL` on new host
6. Update Shopify app Redirect URL on partners.shopify.com
7. Update `API_ORIGIN` Worker secret: `wrangler secret put API_ORIGIN`
8. Update Stripe webhook endpoint URL in Stripe dashboard
9. Keep old Render service running until DNS propagates

---

---

## Session Log — June 1, 2026 (continued)

### pnpm v11 build fix
`posthog-js` pulled in `core-js` and `protobufjs` as transitive dependencies. pnpm v11's
new security model blocks their postinstall scripts and exits with code 1 (`ERR_PNPM_IGNORED_BUILDS`).
Three config attempts failed (`onlyBuiltDependencies`, `ignoredBuiltDependencies`, lockfile block).
Root fix: removed `posthog-js` from npm. PostHog will be re-added via CDN `<script>` tag when
`VITE_POSTHOG_KEY` is actually configured, eliminating the dependency entirely.

### Snippet size fix
Analytics additions (`getScrollDepthPct`, `getTrafficSource`, new beacon calls) pushed the snippet
to 10,250 bytes gzipped — 10 bytes over the 10,240 byte CI gate. Fixed by:
- Removing `getTrafficSource()` from snippet (referrer already sent; API can parse source server-side)
- Removing redundant `popup_submit` beacon (covered by `conversion`)
Result: 10,207 bytes gzipped. ✅

### Admin console security hardening
`isAdmin` in `usePlan.ts` previously fell back to `detectAdminLocal()` which checks
`localStorage.desktop_user`. Any user with `{role: 'admin'}` in localStorage could access
the admin console. Fixed: `isAdmin` now only true when `/me` API confirms `dwain3991@gmail.com`
— no localStorage fallback. `dwain@novatise.com` users confirmed blocked from admin console.



### Admin Clerk sync
`POST /admin/sync` + `DELETE /admin/tenants/:id` added. Refresh button in admin panel
now calls sync first (cleans stale Clerk-deleted users) then refetches. staleTime = 0.

---

*This document is the single source of truth for the ScrollPop platform. Update it whenever architecture changes, new tables are added, or v2 items are completed.*
