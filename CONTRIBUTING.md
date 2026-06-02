# Contributing to ScrollPop

> This is a solo-developer project. This document is a personal workflow reference —
> how to make changes safely, ship to production, and roll back if something breaks.

---

## Branch structure

| Branch | Purpose |
|--------|---------|
| `main` | **Production.** Protected — never commit directly. Create feature branches and PR to main. Deploys automatically on merge. |

---

## Environments

| Environment | Dashboard | API | Database |
|-------------|-----------|-----|----------|
| **Production** | dashboard.scrollpop.online | scroll-pop.onrender.com | Neon `main` branch |

---

## Day-to-day workflow

### 1. Create a feature branch

```bash
git checkout main
git pull
git checkout -b feature/my-new-feature
```

### 2. Code, commit, push

```bash
git add apps/dashboard/src/pages/SomePage.tsx
git commit -m "feat: describe what changed and why"
git push -u origin HEAD     # → push your branch
```

Check CI at: **https://github.com/Dw-Dwain/Scroll-pop/actions**

All 4 required checks must be green:
- ✅ Lint
- ✅ Typecheck
- ✅ Unit Tests
- ✅ No history.* / popstate in snippet

### 3. Test Locally

Ensure all functionality is tested locally (`pnpm dev`) before opening a PR.

### 4. Ship to production — open a PR

When testing is complete:

1. Open a Pull Request against `main`.
2. CI runs — all 4 checks must be green
3. Once green → **Merge pull request**

**What deploys after merge:**
- `dashboard.scrollpop.online` — Cloudflare Pages (`scrollpop-dashboard` project)
- `scrollpop.online` — Cloudflare Pages (`scrollpop-site` project, marketing site)
- Worker (snippet + edge) — GitHub Actions from `Dw-Dwain/Scroll-pop`
- **Render API does NOT auto-deploy** — you must manually sync `dwain-coder` (step 5)

### 5. Sync dwain-coder (Render's source repo)

**⚠️ Critical** — Render deploys from `dwain-coder/Scroll-pop`, not `Dw-Dwain`. After every
PR merge on `Dw-Dwain`, you must push main to `dwain-coder` so the API gets the new code:

```bash
git checkout main
git pull origin main
pnpm run deploy
```

`allow_force_pushes` is enabled on `dwain-coder/Scroll-pop` at the repo level, so
`--force` works without touching branch protection settings.

If repos diverge significantly: ask Claude Code to handle the sync.

### 6. Apply database migrations to production ⚠️ MANDATORY when a PR adds one

**Render does NOT run migrations on deploy.** If a merged PR adds a migration
under `apps/api/drizzle/migrations/` and you don't apply it to the Neon
production DB, the new API code queries columns/enums that don't exist and
**every affected request 500s** (the snippet's config endpoint returns 502 → no
popups, no events, empty analytics). This exact outage happened on June 2 2026
(`column "interval_days" does not exist`, migration `0005` never applied to prod).

After merging a migration, run its SQL in the **Neon SQL Editor → production
branch**. Notes:
- Our migrations use `IF NOT EXISTS` / `ADD VALUE IF NOT EXISTS`, so re-running
  is safe/idempotent.
- **Postgres gotcha:** you cannot *use* a new enum value in the same transaction
  it's added. Run all `ALTER TYPE ... ADD VALUE` statements **first** (one
  execution), then the `ALTER TABLE` / `CREATE INDEX` statements in a **second**
  execution.
- Verify: `SELECT column_name FROM information_schema.columns WHERE table_name = '<table>';`

**Recommended hardening:** set a Render **Pre-Deploy Command** that applies
pending migrations automatically, so prod can never drift behind the code again.

---

## Rollback — if a bad merge reaches `main`

### Option A: Revert the merge commit (safest)

```bash
git checkout main
git pull
git log --oneline -5        # find merge commit hash, e.g. abc1234
git revert -m 1 abc1234     # -m 1 = keep the main-branch parent
git push origin main        # triggers a new deploy with the revert
```

History is preserved. Render/CF redeploy automatically.

### Option B: Reset to a known-good commit (destructive)

```bash
git checkout main
git pull
git log --oneline -10       # find last good commit hash, e.g. def5678
git reset --hard def5678
git push --force-with-lease origin main
```

> ⚠️ Rewrites history. Force-push is blocked by branch protection — temporarily
> disable it in GitHub → Settings → Branches → main → Edit, then re-enable after.

---

## Two-repo setup

| Repo | Owner | Deploys |
|------|-------|---------|
| `Dw-Dwain/Scroll-pop` | Dw-Dwain | Cloudflare **Worker** (has CF secrets) |
| `dwain-coder/Scroll-pop` | dwain-coder | Render **API** (connected to Render) |

Both repos have identical code. Every push goes to both:

```bash
pnpm run deploy   # Pushes to Dw-Dwain (origin) AND dwain-coder (Render)
```

---

## Marketing site (scrollpop.online)

Source lives in `site-plan/` — a standalone Vite + React + Tailwind app.
Deploys automatically to `scrollpop.online` via the `scrollpop-site` Cloudflare Pages project
whenever `main` is updated. No separate deploy step needed.

### Edit content

All content is in `site-plan/src/components/`:

| File | Page |
|---|---|
| `HomeView.tsx` | Homepage — hero, features, how-it-works, testimonials, FAQ, CTA |
| `PricingView.tsx` | Pricing — 5 tiers, monthly/annual toggle, feature comparison |
| `WordPressShopifyGuide.tsx` | Install guide — WordPress / Shopify / HTML tabs |
| `TemplatesView.tsx` | Template gallery |
| `ContactView.tsx` | Contact form |
| `Header.tsx` | Nav bar + announcement strip |
| `Footer.tsx` | Footer columns + copyright |

### Preview locally

```bash
# Start the marketing site dev server (live reload)
# Via /run → "ScrollPop Marketing Site" → http://localhost:3000
# Or directly:
pnpm --filter react-example dev
```

### Deploy a content change

```bash
git checkout -b feature/update-hero
# edit site-plan/src/components/HomeView.tsx (or any file)
git add site-plan/
git commit -m "content: update hero headline"
git push
# → CI runs → on merge to main → scrollpop.online updates in ~2 min
```

### Neon partition maintenance — now automatic ✅

The `events` table is month-partitioned. The API **auto-creates the current +
next month's partition on every boot** (`apps/api/src/db/ensure-partitions.ts`),
so the old "run this before the 1st of each month or analytics dies" chore is no
longer required. If you ever need to backfill manually:
```sql
CREATE TABLE IF NOT EXISTS events_YYYY_MM PARTITION OF events
  FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-(MM+1)-01');
```

---

## Shopify App Embed Block

The App Embed Block (`packages/shopify-app-embed/`) is a Shopify theme extension
that lets merchants enable ScrollPop from the Theme Customizer without editing code.

### One-time setup (already done)

```bash
npm install -g @shopify/cli
```

### Deploy the extension to your Partner app

After making changes to `packages/shopify-app-embed/blocks/scrollpop.liquid`:

```bash
cd C:\Users\dwain\OneDrive\Documents\scrollpop-scaffold\scrollpop
npx shopify app deploy
```

This pushes the extension to the `37618fc8e087622a64ac244a2edd49f1` Partner app.
Merchants who have the app installed will see the updated ScrollPop embed block
in their Theme Customizer → App Embeds.

### Merchant install steps (in the dashboard)

Sites → select a Shopify site → **App Embed Block** tab — shows a guided 4-step
install flow with a one-click public key copy button.

---

## Neon DB — monthly partition maintenance (automated)

The `events` table is partitioned by calendar month (`events_YYYY_MM`). PostgreSQL
**does not auto-create partitions** — historically, inserts for a month with no
partition silently dropped the row, which killed analytics for all of 2026 until
partitions were created by hand.

**This is now handled automatically.** On every boot the API runs
`ensureEventPartitions()` (`apps/api/src/db/ensure-partitions.ts`), which creates
the current + next month partitions idempotently (safe no-op where `events` isn't
range-partitioned). Because the API is always-warm (Render Standard) and also
restarts on each deploy, the upcoming month's partition is provisioned well ahead
of the rollover. The `/e` ingest route additionally logs loudly if an insert is
ever dropped for a missing partition, so it can never fail silently again.

Manual backfill (only if you ever need a specific month immediately):
```sql
CREATE TABLE IF NOT EXISTS events_2026_07 PARTITION OF events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

---

## CI gates — what each check does

| Check | What it catches |
|-------|----------------|
| **Lint** | Code style violations |
| **Typecheck** | TypeScript errors across all packages |
| **Unit Tests** | Vitest unit test failures |
| **No history.* / popstate** | Banned browser navigation APIs in snippet (CLAUDE.md rule #1) |
| **Snippet Size Check** | Hard CI gate ensuring snippet stays ≤ 10 KB gzipped |

---

## Commit message format

```
type(scope): short description

Optional longer body explaining why (not what — the diff shows what).
```

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change, no behaviour change |
| `ci` | CI/CD changes |
| `docs` | Documentation only |
| `chore` | Config, deps, tooling |

---

## Environment variables — where to set them

| Variable | Set it here |
|----------|------------|
| API vars (`DATABASE_URL`, `CLERK_SECRET_KEY`, etc.) | Render → service → Environment |
| Dashboard vars (`VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`) | Cloudflare Pages → Settings → Environment variables |
| Worker secrets (`INTERNAL_SECRET`, `REDIS_URL`) | Cloudflare → Workers → scrollpop-worker → Settings |
| Shopify extension | `npx shopify app deploy` (Shopify CLI) |

> ⚠️ `VITE_*` vars are baked at **build time**. After changing one, trigger a
> manual redeploy: Deployments → `...` → Retry deployment.

**Clerk publishable key (both envs):** `pk_live_Y2xlcmsuc2Nyb2xscG9wLm9ubGluZSQ`

---

## Security — tokens

Tokens used in Claude sessions are **single-use** — revoke immediately after use:
**https://github.com/settings/tokens**

Never commit tokens. The `.gitignore` excludes `.env*` but not raw tokens in
comments — always use environment variables.

---

## Useful commands

```bash
# Confirm your current branch
git branch --show-current

# See what's going into the next PR
git log main..HEAD --oneline

# Run all checks locally
pnpm run lint && pnpm run typecheck && pnpm run test

# Build snippet + check gzip size
# NOTE: the build now ALSO syncs the bundle to apps/worker/src/p.txt (the file the
# Cloudflare Worker actually serves at /v1/:key/p.js). Always commit the updated
# apps/worker/src/p.txt after a snippet change — the Worker won't serve source
# changes otherwise. (This was previously a silent staleness gap.)
# The build also runs a post-minify CSS-whitespace collapse (build.mjs) — esbuild
# does not minify the contents of the embedded <style> template literals, so we strip
# their leading-whitespace newlines to reclaim bundle bytes. Safe: minified JS has no
# newlines outside template literals.
pnpm --filter snippet build

# ⚠️ Measure size the SAME WAY CI does — the gzip CLI, NOT node's zlib.
# node's zlib.gzipSync over-reports vs `gzip -c` by ~90 bytes and will make you
# think you're over the gate when CI passes. CI uses: gzip -c <bundle> | wc -c
gzip -c packages/snippet/dist/p.js | wc -c   # must be ≤ 10240

# Recent history
git log --oneline -15

# Undo last commit (keep changes staged)
git reset --soft HEAD~1

# Deploy Shopify App Embed Block
npx shopify app deploy

# License compliance — flag any copyleft (GPL/AGPL/LGPL/SSPL) deps before shipping
# (the WP plugin is GPL by design; that's separate, not an npm dep)
npx license-checker --production --summary
npx license-checker --production --failOn 'GPL;AGPL;LGPL;SSPL'
```
