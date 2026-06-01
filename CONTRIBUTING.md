# Contributing to ScrollPop

> This is a solo-developer project. This document is a personal workflow reference —
> how to make changes safely, ship to production, and roll back if something breaks.

---

## Branch structure

| Branch | Purpose |
|--------|---------|
| `main` | **Production.** Protected — never commit directly. Deploys automatically to Render (API), Cloudflare (Worker + Pages) and `scrollpop-staging` CF Pages on merge. |
| `dev` | **Default working branch.** All day-to-day changes go here. Deploys automatically to staging on every push. |

---

## Environments

| Environment | Dashboard | API | Database |
|-------------|-----------|-----|----------|
| **Production** | dashboard.scrollpop.online | scroll-pop.onrender.com | Neon `main` branch |
| **Staging** | staging.scrollpop.online | scroll-pop-staging.onrender.com | Neon `dev` branch |

---

## Day-to-day workflow

### 1. Make sure you're on `dev`

```bash
git branch --show-current   # should print: dev
git pull                    # get latest from origin/dev
```

### 2. Code, commit, push to `dev`

```bash
git add apps/dashboard/src/pages/SomePage.tsx
git commit -m "fix: describe what changed and why"
git push                    # → CI checks run, staging auto-deploys
```

Check CI at: **https://github.com/Dw-Dwain/Scroll-pop/actions**

All 4 required checks must be green:
- ✅ Lint
- ✅ Typecheck
- ✅ Unit Tests
- ✅ No history.* / popstate in snippet

### 3. Test on staging

Open **https://staging.scrollpop.online** — fully authenticated, hits staging API,
isolated Neon dev database. Safe to create/delete anything.

> ℹ️ WordPress verification is **bypassed** on staging (`NODE_ENV=development`).
> Clicking "Verify" auto-succeeds without needing the WP plugin installed.

> 🔒 **Staging is locked to `dwain3991@gmail.com` only.** Anyone else who signs in is
> auto-signed-out and shown a "Staging — Restricted Access" screen. This is enforced
> at runtime by a hostname check (`window.location.hostname === 'staging.scrollpop.online'`)
> — no env var or build config needed. It cannot be bypassed by Cloudflare Pages
> auto-deploy overwriting a CI build.

### 4. Ship to production — open a PR

When staging looks good:

1. Go to **https://github.com/Dw-Dwain/Scroll-pop/compare/main...dev**
2. Click **Create pull request**
3. CI re-runs — all 4 checks must be green
4. Once green → **Merge pull request**

**What deploys after merge:**
- `dashboard.scrollpop.online` — Cloudflare Pages (`scrollpop-dashboard` project)
- `scrollpop.online` — Cloudflare Pages (`scrollpop-site` project, marketing site)
- Worker (snippet + edge) — GitHub Actions from `Dw-Dwain/Scroll-pop`
- **Render API does NOT auto-deploy** — you must manually sync `dwain-coder` (step 5b)

### 5. After merging — sync dev + dwain-coder

```bash
# Sync dev with the new main
git checkout dev
git pull origin main        # bring dev in sync with new main
git push                    # update origin/dev + triggers fresh staging build
```

### 5b. Sync dwain-coder (Render's source repo)

**⚠️ Critical** — Render deploys from `dwain-coder/Scroll-pop`, not `Dw-Dwain`. After every
PR merge on `Dw-Dwain`, you must push main to `dwain-coder` so the API gets the new code:

```bash
git checkout main
git pull origin main
git push "https://ghp_TOKEN@github.com/dwain-coder/Scroll-pop.git" main
```

`allow_force_pushes` is enabled on `dwain-coder/Scroll-pop` at the repo level, so
`--force` works without touching branch protection settings.

If repos diverge significantly: ask Claude Code to handle the sync.

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
git push                                                                  # → Dw-Dwain (origin)
git push "https://ghp_TOKEN@github.com/dwain-coder/Scroll-pop.git" dev   # → dwain-coder
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
git checkout dev
# edit site-plan/src/components/HomeView.tsx (or any file)
git add site-plan/
git commit -m "content: update hero headline"
git push
# → CI runs → on merge to main → scrollpop.online updates in ~2 min
```

### Neon partition reminder ⚠️

Before the 1st of each month, run this in the Neon SQL Editor (production branch):
```sql
CREATE TABLE IF NOT EXISTS events_YYYY_MM PARTITION OF events
  FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-next-01');
```
(replace YYYY/MM with the upcoming month — e.g. July 2026 = `events_2026_07`)

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

## Neon DB — monthly partition maintenance

The `events` table is partitioned by calendar month (`events_YYYY_MM`). PostgreSQL
**does not auto-create partitions** — inserts for a month with no partition silently fail
(no error thrown, but the row is dropped). This killed analytics for all of 2026 until
partitions were created manually.

**Before each new month**, run this in the Neon SQL Editor (production AND dev branches):

```sql
-- Replace YYYY and MM with the next month
CREATE TABLE IF NOT EXISTS events_YYYY_MM PARTITION OF events
  FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-next-month-01');
```

Example for July 2026:
```sql
CREATE TABLE IF NOT EXISTS events_2026_07 PARTITION OF events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

A cron job / migration to auto-create future partitions is on the v2 roadmap.

---

## CI gates — what each check does

| Check | What it catches |
|-------|----------------|
| **Lint** | Code style violations |
| **Typecheck** | TypeScript errors across all packages |
| **Unit Tests** | Vitest unit test failures |
| **No history.* / popstate** | Banned browser navigation APIs in snippet (CLAUDE.md rule #1) |

> The **Snippet Size Check (≤ 10 KB gzipped)** runs in CI but is not a required
> merge gate due to a character-encoding issue with the `≤` symbol in GitHub's
> branch protection matcher. It still blocks Worker deploys if it fails.

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
# Confirm you're on dev
git branch --show-current

# See what's going into the next PR
git log main..dev --oneline

# Run all checks locally
pnpm run lint && pnpm run typecheck && pnpm run test

# Build snippet + check gzip size
pnpm --filter snippet build
node -e "const fs=require('fs'),z=require('zlib');const b=fs.readFileSync('packages/snippet/dist/p.js');console.log('gzipped:',z.gzipSync(b).length,'/ 10240 bytes')"

# Recent history
git log --oneline -15

# Undo last commit (keep changes staged)
git reset --soft HEAD~1

# Deploy Shopify App Embed Block
npx shopify app deploy
```
