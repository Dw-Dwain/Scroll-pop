# ScrollPop — Claude Code Quick Start

## First thing to tell Claude Code
When starting a new Claude Code session, paste this:

> "Read CLAUDE.md and SPEC.md in the root of this project before doing anything.
> These contain the full architecture, locked stack decisions, and non-negotiable rules.
> In particular: NEVER use history.pushState, history.replaceState, or listen for popstate
> events in any file under packages/snippet. This is rule #1 and it is absolute."

---

## Recommended Build Order (MVP)

### Step 1 — Foundation (do this first)
```
"Set up the monorepo: install all dependencies with pnpm, verify Turborepo pipeline works,
set up the Docker Compose Postgres + Redis, run database migrations with Drizzle."
```

### Step 2 — API skeleton
```
"Build out apps/api: wire up Fastify with all route files from SPEC.md,
implement the tenant-context plugin, set up Drizzle client connected to local Postgres,
create the full database schema with migrations."
```

### Step 3 — Core API routes
```
"Implement the Sites routes fully (GET/POST/PATCH/DELETE/verify/snippet).
Then implement Campaigns routes. Add Zod validation on all inputs.
Run unit tests for each route."
```

### Step 4 — Snippet runtime
```
"Build packages/snippet/src/main.ts into a production bundle using esbuild.
Target: core p.js ≤ 13 KB gzipped (13312 B). The CI size check must pass.
Run the no-history-manipulation CI check — it must pass."
```

### Step 5 — Cloudflare Worker
```
"Implement apps/worker/src/index.ts — config endpoint with KV caching
and event ingest endpoint. Test locally with wrangler dev."
```

### Step 6 — Dashboard shell
```
"Scaffold apps/dashboard with Vite + React 19 + TypeScript.
Install Refine, shadcn/ui, TanStack Router, TanStack Query.
Build the sidebar navigation matching the page structure in SPEC.md.
Wire up Clerk authentication."
```

### Step 7 — Dashboard pages
```
"Build the Sites list + detail pages.
Build the Campaign list page.
Build the Campaign wizard (6 steps from SPEC.md).
Build the Design editor (template selector + config form for DesignConfigSchema fields)."
```

### Step 8 — Analytics
```
"Implement the event ingest pipeline: Redis stream consumer in the API
that drains events and bulk-inserts to TimescaleDB every 5 seconds.
Build the analytics routes. Build the Analytics dashboard pages."
```

### Step 9 — Billing
```
"Integrate Stripe: create products + prices for starter/growth plans,
implement Stripe Checkout and Customer Portal routes,
implement the Stripe webhook handler for subscription lifecycle events."
```

### Step 10 — WordPress plugin
```
"Complete the WordPress plugin: implement ScrollPop_Admin class
with a settings page at Settings → ScrollPop.
Test that the plugin injects the correct snippet into wp_head."
```

---

## Common Claude Code Commands

```bash
# Start everything
pnpm dev

# API only
pnpm --filter api dev

# Dashboard only
pnpm --filter dashboard dev

# Worker local dev
pnpm --filter worker dev

# Run migrations
pnpm db:migrate

# Inspect DB
pnpm db:studio

# Run all tests
pnpm test

# Check snippet size (core MUST be ≤ 13 KB gzipped / 13312 B)
gzip -c packages/snippet/dist/p.js | wc -c

# Check for banned APIs in snippet
grep -rE "history\.pushState|history\.replaceState|onpopstate|addEventListener.*popstate" packages/snippet/src/
```

---

## Key Files to Know

| File | Purpose |
|---|---|
| `CLAUDE.md` | Persistent rules — Claude Code reads this every session |
| `SPEC.md` | Full product spec — data models, API routes, UI flows |
| `apps/api/src/db/schema.ts` | All Drizzle table definitions |
| `apps/api/src/index.ts` | Fastify entry point |
| `apps/worker/src/index.ts` | Cloudflare Worker edge logic |
| `packages/snippet/src/main.ts` | Browser snippet (size-critical) |
| `packages/shared/src/index.ts` | Shared Zod schemas + types |
| `packages/wp-plugin/scrollpop/` | WordPress plugin |
| `.github/workflows/ci.yml` | CI pipeline (size check + history-manipulation check) |

---

## When You're Stuck

1. **Snippet over 13 KB?** Look for unused code, large string templates. Move CSS to a separate
   injection; use terser for aggressive minification.

2. **RLS policy blocking a query?** Make sure the Fastify plugin is setting the correct
   `tenant_id` in the RLS context: `SET LOCAL app.tenant_id = '...'`

3. **Shopify (v2)?** Build the Theme App Extension with an `app_embed_block` that outputs the
   snippet in Liquid. Do NOT use ScriptTag (deprecated for OS 2.0).

4. **Worker KV cache stale after a campaign update?** POST to
   `DELETE /api/v1/internal/cache/:publicKey` which calls `env.SCROLLPOP_CONFIG.delete(key)`.

5. **TimescaleDB hypertable not working?** Make sure TimescaleDB extension is enabled:
   `CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`
   Then call `SELECT create_hypertable('events', 'ts');` after creating the table.
