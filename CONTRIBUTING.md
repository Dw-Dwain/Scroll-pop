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

### 4. Ship to production — open a PR

When staging looks good:

1. Go to **https://github.com/Dw-Dwain/Scroll-pop/compare/main...dev**
2. Click **Create pull request**
3. CI re-runs — all 4 checks must be green
4. Once green → **Merge pull request**

**What deploys after merge:**
- Render auto-redeploys production API (`scroll-pop.onrender.com`)
- Cloudflare Pages redeploys `dashboard.scrollpop.online`
- GitHub Actions deploys Worker (snippet + edge) from `Dw-Dwain/Scroll-pop`

### 5. After merging — sync dev back up

```bash
git checkout dev
git pull origin main        # bring dev in sync with new main
git push                    # update origin/dev + triggers fresh staging build
```

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
