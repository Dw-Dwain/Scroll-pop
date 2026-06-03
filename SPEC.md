# ScrollPop — Product Specification v1.0 (MVP)

> **Status as of June 2026:** MVP is live at `dashboard.scrollpop.online`.
> Checkboxes below reflect actual build state.

## Overview
ScrollPop is a multi-tenant SaaS platform for building Google-compliant popup campaigns.
It replaces back-button hijacking (banned by Google June 15, 2026) with scroll-depth,
dwell-time, and exit-intent triggers. Primary use case: affiliate marketers and content
publishers displaying product ads that users can choose to engage with.

---

## Phase 1: MVP Scope

### What ships in MVP
- [x] Tenant onboarding (Clerk auth, personal-account model — no org creation required)
- [x] Site registration + public_key issuance + install verification (WP bypass in dev)
- [x] Campaign CRUD (create / read / update / archive) — 3-step wizard (Details → Design → Launch)
- [x] Design editor — full visual canvas builder (drag-and-drop, 38+ templates across 14 categories)
- [x] Triggers: scroll_pct, dwell_time, inactivity, exit_intent_mouse (NO back-button, ever)
- [x] Targeting: URL match (exact / contains / regex), device (mobile/desktop/all)
- [x] Affiliate slots: up to 3 products per campaign (image + CTA URL + click tracker URL)
- [x] Frequency capping: once_per_session, once_per_day, once_per_visitor, always
- [x] JS snippet runtime — WYSIWYG element renderer (positions/colors/fonts match editor exactly)
- [x] Close button: 2-step flow (1st click opens ad in new tab, 2nd click dismisses + resets cap)
- [x] WordPress plugin (thin PHP, injects snippet via wp_head, downloadable from GitHub releases)
- [x] Shopify App Embed Block (theme extension, Theme Customizer → App Embeds)
- [x] Raw HTML / Shopify theme.liquid install instructions in dashboard
- [x] Analytics: impressions, views, clicks, CTR, dismissals (Analytics 7d/30d/90d; Dashboard 7d/30d)
    - Dashboard + Analytics **auto-refresh in real time** (polling: 15s / 20s)
    - **Note**: events table is month-partitioned; partitions are now **auto-created on API
      boot** (`ensure-partitions.ts`) — no manual monthly step required
- [x] Stripe billing UI: Upgrade/Downgrade calls real Stripe Checkout; **needs live keys +
      `STRIPE_PRICE_*` env vars before it can charge** (not yet live)
- [~] Edge enforcement: the API config endpoint checks the monthly view limit and returns an
      empty config when exceeded; Redis usage metering + Stripe usage-record sync are still
      partial (Worker-level hard cap is a v2 item — see MASTER §25 B1)
- [x] Admin dashboard — super-admin panel (email-gated: `dwain3991@gmail.com` only)
- [x] Cloudflare Worker: snippet CDN + config endpoint + event ingest endpoint (custom domains live)

### What does NOT ship in MVP (v2 targets)
- A/B testing
- Geo targeting, UTM targeting, referrer targeting
- Email integrations (Mailchimp, Klaviyo)
- Outbound webhook on conversion events
- Shopify App Store listing
- Scale/Agency tier Stripe price IDs (need configuring)
- Compliance Center dashboard
- Teaser + success step WYSIWYG (snippet uses built-in layout for those two steps, though they can now be optionally disabled)
- Automatic DB migration apply on deploy (migrations are applied to prod manually — see CONTRIBUTING §6; Render Pre-Deploy Command is the recommended hardening)

---

## Data Models

### tenants
```sql
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id    TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'free'
                  CHECK (plan IN ('free','starter','growth','scale','agency')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  monthly_view_limit  INTEGER NOT NULL DEFAULT 1000,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
-- RLS: users can only see their own tenant (enforced via Clerk JWT tenant_id claim)
```

### users
```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id   TEXT UNIQUE NOT NULL,
  email           TEXT NOT NULL,
  name            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### tenant_members
```sql
CREATE TABLE tenant_members (
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'editor'
              CHECK (role IN ('owner','admin','editor','viewer')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id)
);
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
```

### sites
```sql
CREATE TABLE sites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  domain        TEXT NOT NULL,
  public_key    TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  platform      TEXT NOT NULL DEFAULT 'html'
                CHECK (platform IN ('wordpress','shopify','html','donorbox','gofundme','other')),
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (tenant_id, domain)
);
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
```

### campaigns
```sql
CREATE TABLE campaigns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft','active','paused','archived')),
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
```

### designs
```sql
-- config JSONB structure defined in packages/shared/src/schemas/design.ts
CREATE TABLE designs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'modal'
                CHECK (kind IN ('modal','slide_in','banner','bar','fullscreen')),
  config        JSONB NOT NULL DEFAULT '{}',
  affiliate_slots JSONB NOT NULL DEFAULT '[]',
  -- affiliate_slots: [{id, product_name, product_url, image_url,
  --                    click_tracker_url, cta_text, weight}]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE designs ENABLE ROW LEVEL SECURITY;
```

### triggers
```sql
-- IMPORTANT: back_button_capture is NOT a valid trigger type. Ever.
CREATE TABLE triggers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type          TEXT NOT NULL
                CHECK (type IN ('scroll_pct','dwell_time','inactivity',
                                'exit_intent_mouse','click')),
                -- scroll_pct: fires when user scrolls past N% of page
                -- dwell_time: fires after N seconds on page
                -- inactivity: fires after N seconds of no interaction
                -- exit_intent_mouse: fires when cursor moves toward top of viewport
                -- click: fires when element matching CSS selector is clicked
  params        JSONB NOT NULL DEFAULT '{}',
                -- scroll_pct: { pct: 50 }
                -- dwell_time: { seconds: 30 }
                -- inactivity: { seconds: 60 }
                -- exit_intent_mouse: { sensitivity: 20 } (pixels from top)
                -- click: { selector: "#my-button" }
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE triggers ENABLE ROW LEVEL SECURITY;
```

### targeting_rules
```sql
CREATE TABLE targeting_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL
                CHECK (kind IN ('url_exact','url_contains','url_regex',
                                'device','returning_visitor')),
  operator      TEXT NOT NULL DEFAULT 'include' CHECK (operator IN ('include','exclude')),
  value         JSONB NOT NULL DEFAULT '{}',
                -- url_exact: { url: "https://example.com/page" }
                -- url_contains: { pattern: "/blog/" }
                -- url_regex: { pattern: "^/products/.*" }
                -- device: { device: "mobile"|"desktop"|"tablet"|"all" }
                -- returning_visitor: { is_returning: true }
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE targeting_rules ENABLE ROW LEVEL SECURITY;
```

### frequency_rules
```sql
CREATE TABLE frequency_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  frequency     TEXT NOT NULL DEFAULT 'once_per_session'
                CHECK (frequency IN ('once_per_session','once_per_day',
                                     'once_per_visitor','always')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE frequency_rules ENABLE ROW LEVEL SECURITY;
```

### events (TimescaleDB hypertable)
```sql
CREATE TABLE events (
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id       UUID NOT NULL,
  site_id         UUID NOT NULL,
  campaign_id     UUID NOT NULL,
  event_type      TEXT NOT NULL
                  CHECK (event_type IN ('impression','view','click','dismiss','conversion')),
  affiliate_slot_id TEXT,
  visitor_id      TEXT,   -- first-party hashed ID (no PII)
  session_id      TEXT,
  country         TEXT,   -- from Cloudflare cf.country
  device          TEXT,   -- mobile|desktop|tablet
  page_url        TEXT,
  referrer        TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'
);
-- Convert to hypertable partitioned by ts (7-day chunks)
SELECT create_hypertable('events', 'ts', chunk_time_interval => INTERVAL '7 days');
-- Retention policy: keep 13 months
SELECT add_retention_policy('events', INTERVAL '13 months');
-- Compression after 7 days
SELECT add_compression_policy('events', INTERVAL '7 days');
```

---

## API Routes (apps/api)

All routes prefixed `/api/v1/`. Auth via Clerk JWT Bearer token except where noted.

### Auth / Tenant bootstrap
```
POST   /api/v1/webhooks/clerk          # Clerk webhook: sync org/user to DB (no auth)
POST   /api/v1/webhooks/stripe         # Stripe webhook: sync subscription (no auth)
GET    /api/v1/me                      # Current user + tenant context
```

### Sites
```
GET    /api/v1/sites                   # List sites for tenant
POST   /api/v1/sites                   # Create site
GET    /api/v1/sites/:id               # Get site detail
PATCH  /api/v1/sites/:id               # Update site
DELETE /api/v1/sites/:id               # Soft delete
POST   /api/v1/sites/:id/verify        # Trigger domain verification check
GET    /api/v1/sites/:id/snippet       # Return the install snippet HTML for this site
```

### Campaigns
```
GET    /api/v1/campaigns               # List campaigns (filter by site_id, status)
POST   /api/v1/campaigns               # Create campaign
GET    /api/v1/campaigns/:id           # Get campaign (includes design, triggers, targeting)
PATCH  /api/v1/campaigns/:id           # Update campaign metadata
DELETE /api/v1/campaigns/:id           # Soft delete
POST   /api/v1/campaigns/:id/activate  # Set status → active, publish to KV
POST   /api/v1/campaigns/:id/pause     # Set status → paused, update KV
```

### Designs
```
GET    /api/v1/campaigns/:id/design    # Get design for campaign
PUT    /api/v1/campaigns/:id/design    # Upsert design (creates if none, updates if exists)
```

### Triggers
```
GET    /api/v1/campaigns/:id/triggers  # List triggers
POST   /api/v1/campaigns/:id/triggers  # Create trigger
PATCH  /api/v1/triggers/:id            # Update trigger
DELETE /api/v1/triggers/:id            # Delete trigger
```

### Targeting Rules
```
GET    /api/v1/campaigns/:id/targeting # List targeting rules
POST   /api/v1/campaigns/:id/targeting # Create rule
PATCH  /api/v1/targeting/:id           # Update rule
DELETE /api/v1/targeting/:id           # Delete rule
```

### Analytics
```
GET    /api/v1/analytics/overview      # Tenant-level: total impressions, clicks, CTR (30d)
GET    /api/v1/analytics/campaigns/:id # Campaign-level: daily breakdown, per-slot CTR
GET    /api/v1/analytics/sites/:id     # Site-level: campaigns ranked by CTR
```

### Billing
```
GET    /api/v1/billing/plans           # Available plans + current plan
POST   /api/v1/billing/checkout        # Create Stripe Checkout session
POST   /api/v1/billing/portal          # Create Stripe Customer Portal session
GET    /api/v1/billing/usage           # Current month view count vs. limit
```

### Edge (public, no auth — served by Cloudflare Worker)
```
GET    /c/:public_key                  # Config endpoint: returns active campaign config for site
POST   /e                              # Event ingest: accepts batch of events, forwards to Redis
GET    /v1/:public_key/p.js            # Snippet bundle (served from R2, versioned)
```

---

## Cloudflare Worker (apps/worker)

Two Worker scripts:

### 1. `config-worker.ts`
- Route: `GET /c/:public_key`
- Checks KV for `config:{public_key}` (TTL 60s)
- On cache miss: fetches from origin API (`GET /api/v1/internal/config/:public_key`)
- Stores in KV with 60s TTL
- Returns JSON config payload
- Config payload structure:
```typescript
interface SiteConfig {
  siteId: string;
  campaigns: Array<{
    id: string;
    design: DesignConfig;
    triggers: TriggerConfig[];
    targeting: TargetingRule[];
    frequency: FrequencyRule;
    affiliateSlots: AffiliateSlot[];
  }>;
  version: string; // cache-busting hash
}
```

### 2. `ingest-worker.ts`
- Route: `POST /e`
- Accepts `Content-Type: application/json` body: `{ events: EventPayload[] }`
- Max 50 events per request
- Enriches with Cloudflare request metadata: `cf.country`, `cf.colo`
- Pushes to Upstash Redis stream `events:{tenant_id}`
- Returns `{ received: N }`
- The API has a background job that drains the Redis stream and bulk-inserts to TimescaleDB

### 3. Static Assets
- Snippet bundle (`p.js`) is stored in R2 bucket `scrollpop-snippets`
- Served via Worker with aggressive cache headers (`Cache-Control: public, max-age=31536000, immutable`)
- Bundle filename includes content hash for cache busting

---

## JS Snippet (packages/snippet)

### Architecture
Two files produced by the build:

**`stub.js`** (~1.1 KB minified, inlined in customer's HTML):
```html
<script>
(function(w,d,s){
  var p=w.__sp=w.__sp||{q:[],identify:function(v){p.q.push(['identify',v])},loaded:false};
  if(p.loaded)return; p.loaded=true;
  var el=d.createElement(s); el.async=true; el.defer=true;
  el.src='https://cdn.scrollpop.io/v1/'+KEY+'/p.js';
  d.head.appendChild(el);
})(window,document,'script');
</script>
```

**`p.js`** (main bundle, ~8-10 KB gzipped, loaded async):
1. Fetches `https://edge.scrollpop.io/c/{PUBLIC_KEY}` for site config
2. Evaluates targeting rules against current page
3. Selects eligible campaigns
4. Registers trigger listeners (scroll, dwell, inactivity — NEVER popstate/history)
5. On trigger fire: checks frequency cap (first-party cookie `_sp_{campaign_id}`)
6. Renders popup via Shadow DOM
7. Beacons events via `navigator.sendBeacon`

### Trigger implementations
```typescript
// scroll_pct — SAFE
window.addEventListener('scroll', () => {
  const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
  if (pct >= config.params.pct) fire();
}, { passive: true });

// dwell_time — SAFE
const timer = setTimeout(fire, config.params.seconds * 1000);

// inactivity — SAFE
let inactivityTimer = setTimeout(fire, config.params.seconds * 1000);
['mousemove','keydown','scroll','click','touchstart'].forEach(evt =>
  document.addEventListener(evt, () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(fire, config.params.seconds * 1000);
  }, { passive: true })
);

// exit_intent_mouse — SAFE (cursor leaves viewport top, NOT popstate)
document.addEventListener('mousemove', (e) => {
  if (e.clientY <= config.params.sensitivity) fire();
});

// WHAT WE NEVER DO:
// window.addEventListener('popstate', ...) ← BANNED
// history.pushState(...)                   ← BANNED
// history.replaceState(...)                ← BANNED (in snippet context)
// window.onbeforeunload = ...              ← BANNED for navigation interception
```

### Shadow DOM rendering
```typescript
const host = document.createElement('div');
host.id = '__sp_host';
document.body.appendChild(host);
const shadow = host.attachShadow({ mode: 'closed' });
// All popup HTML/CSS injected into shadow — zero CSS bleed to/from host page
```

### Event beaconing
```typescript
const beacon = (events: EventPayload[]) => {
  const url = 'https://edge.scrollpop.io/e';
  const body = JSON.stringify({ events });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
  } else {
    fetch(url, { method: 'POST', body, keepalive: true,
                  headers: { 'Content-Type': 'application/json' } });
  }
};
```

---

## Admin Dashboard (apps/dashboard)

### Page structure
```
/                          → redirect to /dashboard
/sign-in                   → Clerk SignIn component
/sign-up                   → Clerk SignUp component
/dashboard                 → Overview: impressions, clicks, CTR (30d), top campaigns
/sites                     → Site list
/sites/new                 → Add site wizard (domain → platform select → install instructions)
/sites/:id                 → Site detail + campaign list for this site
/campaigns                 → All campaigns across all sites
/campaigns/new             → Campaign wizard: Site → Goal → Template → Design → Trigger → Targeting → Review
/campaigns/:id             → Campaign detail
/campaigns/:id/design      → Design editor (template selector + config form)
/campaigns/:id/triggers    → Trigger configuration
/campaigns/:id/targeting   → Targeting rules
/campaigns/:id/analytics   → Campaign analytics (impressions, CTR, per-slot breakdown)
/analytics                 → Portfolio analytics (all sites, all campaigns)
/billing                   → Current plan, usage meter, Stripe portal link
/settings                  → Team members, API keys
```

### Campaign wizard steps
1. **Site** — which site is this for?
2. **Template** — pick from 8 starter templates (modal, slide-in, banner)
3. **Design** — edit copy, colors, CTA text, upload/paste affiliate product(s)
4. **Trigger** — choose trigger type + configure params
5. **Targeting** — URL patterns, device targeting, frequency cap
6. **Review** — preview + activate

### Design config schema (stored in designs.config JSONB)
```typescript
interface DesignConfig {
  kind: 'modal' | 'slide_in' | 'banner' | 'bar' | 'fullscreen';
  // Layout
  position: 'center' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom';
  size: 'sm' | 'md' | 'lg';
  // Appearance
  backgroundColor: string;      // hex
  textColor: string;             // hex
  accentColor: string;           // hex
  borderRadius: number;          // px
  overlayEnabled: boolean;
  overlayOpacity: number;        // 0–1
  // Content
  headline: string;
  subheadline?: string;
  bodyText?: string;
  // CTA
  ctaText: string;
  ctaStyle: 'button' | 'text_link';
  // Dismiss
  showCloseButton: boolean;
  closeButtonPosition: 'top-right' | 'top-left';
  showDismissText: boolean;
  dismissText?: string;
  // Animation
  animation: 'fade' | 'slide_up' | 'slide_down' | 'zoom' | 'none';
  // Branding
  showPoweredBy: boolean;        // false when plan >= starter
}

interface AffiliateSlot {
  id: string;
  product_name: string;
  product_url: string;
  image_url: string;
  click_tracker_url: string;    // affiliate network tracking URL
  cta_text: string;
  weight: number;               // 0–100 for rotation weighting
}
```

---

## WordPress Plugin (packages/wp-plugin)

### Files
```
scrollpop-wp/
├── scrollpop.php              # Main plugin file (headers + bootstrap)
├── includes/
│   ├── class-scrollpop.php    # Core plugin class
│   ├── class-admin.php        # Settings page registration
│   └── class-snippet.php      # wp_head injection
├── admin/
│   ├── settings-page.php      # Settings UI template
│   └── css/admin.css
├── readme.txt                 # wordpress.org readme format
└── uninstall.php              # Clean up options on uninstall
```

### Functionality
- Settings page at `Settings → ScrollPop`
- Single field: "Site Public Key" (from ScrollPop dashboard)
- Injects stub snippet into `wp_head` (priority 1 — loads early)
- Optional: `wp_footer` injection for WooCommerce cart event hooks
- No tracking of any PII — just the public_key
- GPL-2.0-or-later licensed

---

## Build System

### pnpm workspace setup
```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Turborepo pipeline
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "typecheck": {}
  }
}
```

### CI gates (GitHub Actions)
1. `lint` — all packages (currently a no-op placeholder; typecheck is the real gate)
2. `typecheck` — TypeScript strict mode, all packages
3. `test` — Vitest unit tests
4. `snippet-size-check` — fail if `packages/snippet/dist/p.js` gzipped > 10240 bytes
5. `no-history-manipulation` — AST check: fail if snippet source contains
   `history.pushState`, `history.replaceState`, `onpopstate`, `popstate`

> Playwright E2E is now wired (Jun 3 2026): with no staging environment, the suite runs
> against LOCAL servers only — the dashboard in demo mode, the marketing site, and a snippet
> fixture (built bundle + mocked edge endpoints). It never touches production. Non-gating CI
> job. See `e2e/`.

---

## Deployment

### API (Render.com)
The API runs on **Render** (`scroll-pop.onrender.com`, Standard plan — always warm),
**not** Fly.io. `infra/fly/fly.toml` exists but is unused legacy.
- Source repo: `dwain-coder/Scroll-pop` (Render auto-deploys on push to `main`).
- Build: `pnpm --filter api build` · Start: `node apps/api/dist/index.js`
- Render does **not** run DB migrations — apply them to Neon manually (see CONTRIBUTING §6).

### Worker (Cloudflare)
- Deploy via `wrangler deploy` in CI (from `Dw-Dwain/Scroll-pop`) on merge to main
- KV namespace: `SCROLLPOP_CONFIG` (site config cache, 60s TTL) — **bound and live**
- R2 bucket: `scrollpop-snippets` — not yet configured (snippet currently served from the Worker bundle)
- Custom domains: `edge.scrollpop.online` + `cdn.scrollpop.online`

### Dashboard (Cloudflare Pages)
- Build command: `pnpm --filter dashboard build`
- Output: `apps/dashboard/dist`
- Deploy via Cloudflare Pages GitHub integration

---

## Getting Started (local dev)

```bash
# Prerequisites: Node 22, pnpm 9, Docker (for local Postgres)

git clone https://github.com/yourname/scrollpop
cd scrollpop
pnpm install

# Start local Postgres + Redis via Docker
docker compose up -d

# Run Supabase migrations
pnpm --filter api db:migrate

# Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/dashboard/.env.example apps/dashboard/.env

# Start all services
pnpm dev
# → API on http://localhost:3001
# → Dashboard on http://localhost:5173
# → Worker local dev via wrangler (http://localhost:8787)
# → Snippet watch build
```

---

## MVP Success Criteria
- [ ] A user can sign up, add a site, create a campaign, get a snippet, and install it
- [ ] The snippet fires a scroll-triggered popup on a test page
- [ ] Impression and click events appear in the dashboard analytics within 60 seconds
- [ ] The snippet bundle gzipped size is ≤ 10 KB (enforced by CI)
- [ ] No `history.*` or `popstate` usage anywhere in `packages/snippet` (enforced by CI)
- [ ] Cross-tenant data isolation: API returns 0 rows when queried with a different tenant's JWT
- [ ] Stripe billing: user can upgrade from Free to Starter, view count limit updates
- [ ] WordPress plugin installs and injects snippet correctly on a vanilla WP 6.5 site
