# ScrollPop — Claude Code Context

## What This Is
A multi-tenant SaaS popup/overlay platform. Operators build scroll-triggered, affiliate-monetized
popup campaigns through an admin dashboard. A lightweight JS snippet (~10 KB gzipped) runs on
customer sites (WordPress, Shopify, raw HTML, donation platforms) and renders popups inside a
Shadow DOM without touching browser history.

## Monorepo Structure
```
scrollpop/
├── apps/
│   ├── api/          # Fastify backend (Node 22 LTS + TypeScript)
│   ├── dashboard/    # React 19 admin SPA (Vite + Refine + shadcn/ui)
│   └── worker/       # Cloudflare Worker (config API + event ingest)
├── packages/
│   ├── snippet/      # Vanilla TS browser snippet (~10 KB gzipped)
│   ├── wp-plugin/    # WordPress PHP plugin (thin, injects snippet)
│   └── shared/       # Shared TypeScript types + validation schemas (Zod)
├── docs/             # Public docs site
└── infra/
    ├── cloudflare/   # Wrangler config, KV namespaces, R2 buckets
    ├── fly/          # fly.toml for API deployment
    └── db/           # Migration files, RLS policies, seed data
```

## Tech Stack — LOCKED, DO NOT DEVIATE

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js 22 LTS | Use native ESM throughout |
| Language | TypeScript 5.x | Strict mode everywhere. No `any`. |
| Backend framework | Fastify 5 | Use `@fastify/jwt`, `@fastify/cors`, `@fastify/rate-limit` |
| ORM | Drizzle ORM | Postgres dialect. Migrations via `drizzle-kit` |
| Database | PostgreSQL 17 (Fly.io managed Postgres, postgres-flex) | RLS on every tenant-scoped table |
| Analytics DB | TimescaleDB (same Fly Postgres instance, hypertable) | Migrate to ClickHouse at >50M events/month |
| Cache / Queue | Redis via Upstash | Rate limiting + event ingest buffer |
| Edge delivery | Cloudflare Workers + R2 + KV | Snippet bundle on R2, config cached in KV |
| Auth | Clerk | Multi-tenant orgs. JWT passed to API as Bearer token |
| Frontend | React 19 + Vite + TypeScript | |
| Admin scaffold | Refine (data provider wired to API) | |
| UI components | shadcn/ui + Tailwind CSS v4 | |
| State (builder) | Zustand | |
| Data fetching | TanStack Query v5 | |
| Routing | TanStack Router | |
| Drag-and-drop | dnd-kit | For the popup design builder |
| Billing | Stripe Billing + usage metering | |
| Monorepo | pnpm workspaces | pnpm only — never npm or yarn |
| Build | Turborepo | |
| Linting | ESLint flat config + Prettier | |
| Testing | Vitest (unit) + Playwright (e2e) | |
| CI/CD | GitHub Actions | Deploy API → Fly.io, Worker → Cloudflare, Dashboard → Cloudflare Pages |
| Error tracking | Sentry | |
| Product analytics | PostHog | |

## ABSOLUTE RULES — NEVER VIOLATE

### Security & Compliance
1. **NEVER** use `history.pushState`, `history.replaceState`, or add listeners to `window.onpopstate`
   in the snippet or any customer-facing code. This is a Google spam policy violation (enforced
   June 15, 2026). This rule is non-negotiable and must be enforced in CI via an AST lint rule.
2. **NEVER** use `window.onbeforeunload` for navigation interception in the snippet.
3. Every Postgres table with a `tenant_id` column **MUST** have an RLS policy. No exceptions.
   All queries through the API must include `tenant_id` filtering at the service layer even if RLS
   is present (defence in depth).
4. Snippet must render in **Shadow DOM** (`attachShadow({mode:'closed'})`) — never inject global
   CSS into the host page.
5. No `eval()`, no `document.write()`, no dynamic `Function()` constructor in the snippet.
5a. **Every tenant-controlled value rendered by the snippet MUST pass through a sanitizer from
   `packages/snippet/src/sanitize.ts` before reaching the DOM.** No exceptions. Text/attribute
   values → `escapeHtml`; hrefs/src → `safeHref`; colors → `safeCssColor`; CSS url() → `safeCssUrl`;
   numeric CSS → `cssNum`/`safeCssInt`; font-family → `cssFont`; lengths → `cssLen`; alignment →
   `cssAlign`; weight → `cssWeight`; regex targeting → `isSafeRegex`. NEVER interpolate a config
   value raw into an HTML string, `style="…"` attribute, or `<style>` block. Design element fields
   (`fontFamily`, `x/y/w/h`, `padding`, etc.) are NOT in the Zod schema, so the render-time
   sanitizer is the only thing standing between a malicious design and stored XSS on a customer
   site. The sanitizers have unit tests (`sanitize.test.ts`) — keep them green.
5b. **The `/e` event-ingest endpoint MUST validate every client-supplied field** (event type
   against the enum, IDs as UUIDs, URLs as http(s), numerics clamped) and apply the per-(campaign,
   IP) impression flood gate. Events are unauthenticated — never trust their contents or counts.

### Performance
6. Snippet bundle **MUST** stay under 10 KB gzipped. This is a hard CI gate — builds fail if
   exceeded. Inline stub must stay under 1.2 KB minified.
7. Snippet must use `requestIdleCallback` (with `setTimeout` fallback) for non-critical work.
8. Never block LCP. The snippet must defer all work until after the page is interactive.
9. Use `navigator.sendBeacon()` for event beaconing; fall back to `fetch({keepalive:true})`.

### Code Quality
10. All API endpoints must be typed end-to-end using Zod for request/response validation.
    Export inferred types from `packages/shared` and import them in both API and dashboard.
11. No hardcoded secrets anywhere. All secrets via environment variables. Use `.env.example` files.
12. Every database migration must be reversible (include a `down` migration).
13. API routes must be versioned: `/api/v1/...`
14. All async functions must have proper error handling — no unhandled promise rejections.

### Architecture
15. The Cloudflare Worker is a **thin edge layer only** — config reads from KV, event forwarding
    to Redis, static asset serving. No business logic in the Worker.
16. Business logic lives in `apps/api` only.
17. The snippet (`packages/snippet`) is a **pure browser runtime** — no Node.js APIs, no build-time
    server calls. It communicates only with the Cloudflare Worker edge endpoints.
18. `packages/shared` contains only types and Zod schemas — no runtime dependencies beyond Zod.

## Build Artifacts — Snippet Bundle Sync
The Cloudflare Worker serves a **pre-built copy** of the snippet at `apps/worker/src/p.txt`.
It is generated by `pnpm --filter snippet build` (which builds `dist/p.js` AND syncs `p.txt`).
- **Whenever you edit `packages/snippet/src/**`, you MUST rebuild and commit `apps/worker/src/p.txt`
  in the same commit.** CI (`snippet-size-check`) rebuilds the snippet and fails if the committed
  `p.txt` differs from a fresh build.
- A versioned pre-commit hook (`.githooks/pre-commit`, enabled via `core.hooksPath` by the root
  `prepare` script on `pnpm install`) does this automatically. If you commit with `--no-verify`
  or in an environment where the hook didn't activate, run the rebuild manually.
- `p.txt` is a generated artifact — never edit it by hand.

## Environment Variables

### apps/api
```
DATABASE_URL=              # Fly Postgres connection string (pooler)
DIRECT_DATABASE_URL=       # Direct connection for migrations
REDIS_URL=                 # Upstash Redis REST URL
REDIS_TOKEN=               # Upstash Redis token
CLERK_SECRET_KEY=          # Clerk backend secret
CLERK_PUBLISHABLE_KEY=     # Clerk frontend key
STRIPE_SECRET_KEY=         # Stripe secret key
STRIPE_WEBHOOK_SECRET=     # Stripe webhook signing secret
CLOUDFLARE_ACCOUNT_ID=     # For cache purging
CLOUDFLARE_API_TOKEN=      # For KV writes on campaign publish
SENTRY_DSN=
PORT=3001
NODE_ENV=development|production
```

### apps/dashboard
```
VITE_API_URL=              # e.g. https://api.scrollpop.io or http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=
VITE_POSTHOG_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
```

### apps/worker (Cloudflare Workers via wrangler.toml secrets)
```
API_ORIGIN=                # Origin API URL for config cache misses
REDIS_URL=                 # Upstash Redis for event queue
REDIS_TOKEN=
SENTRY_DSN=
```

### packages/snippet (build-time, baked into bundle)
```
SNIPPET_CDN_URL=           # https://cdn.scrollpop.io
SNIPPET_EDGE_URL=          # https://edge.scrollpop.io
```

## Database Conventions
- All primary keys: `uuid` generated with `gen_random_uuid()` — never serial integers.
- All tables have `created_at TIMESTAMPTZ DEFAULT NOW()` and `updated_at TIMESTAMPTZ`.
- Soft deletes via `deleted_at TIMESTAMPTZ NULL` — never hard delete tenant data.
- Enum types defined in Postgres as `CREATE TYPE ... AS ENUM`.
- RLS policy naming: `{table}_{action}_tenant_isolation` e.g. `campaigns_all_tenant_isolation`.

## API Conventions
- All responses wrapped: `{ data: T, meta?: PaginationMeta }` for success,
  `{ error: { code: string, message: string, details?: unknown } }` for errors.
- Pagination: cursor-based using `after` (UUID) + `limit` (default 20, max 100).
- HTTP status codes: 200 (ok), 201 (created), 204 (deleted), 400 (validation), 401 (auth),
  403 (forbidden), 404 (not found), 409 (conflict), 429 (rate limited), 500 (server error).
- Tenant context injected by a Fastify `preHandler` hook that decodes the Clerk JWT and sets
  `req.tenantId` and `req.userId` on every authenticated request.

## Pricing Tiers (reference for billing logic)
| Tier | Price | Monthly popup views |
|---|---|---|
| free | $0 | 1,000 |
| starter | $19 | 25,000 |
| growth | $49 | 150,000 |
| scale | $129 | 500,000 |
| agency | $299 | 2,000,000 |

## Key Domain Terms
- **Tenant** — a company/user account with a billing plan. Maps to a Clerk Organization.
- **Site** — a domain registered under a tenant. Has a `public_key` (used in the snippet embed).
- **Campaign** — a collection of popup variants with targeting and trigger rules.
- **Design** — the visual configuration of a popup (layout, copy, colors, affiliate slots).
- **Trigger** — what causes the popup to fire (scroll%, dwell-time, exit-intent-mouse, click, inactivity).
- **Targeting Rule** — conditions that must be met (URL match, geo, device, referrer, UTM, returning visitor).
- **Affiliate Slot** — a product creative (image + CTA URL + click-tracker URL) displayed inside the popup.
- **Variant** — one version of a campaign for A/B testing. Has a weight (0–100).
- **Event** — a beaconed interaction: impression | view | click | dismiss | conversion.

## What NOT to Build (yet)
- Back-button capture / `popstate` interception (banned, see rule #1)
- Real-time social-proof popups (v3 feature)
- SAML SSO (v3 feature — use Clerk's org-level auth for now)
- Native iOS/Android SDKs (v3)
- ClickHouse migration (only when events exceed 50M/month)
- Shopify App Store submission (v2 — build App Embed Block first, submit later)
- AI copy generation (v3)
