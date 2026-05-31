# Contributing to ScrollPop

> This is a solo-developer project. This document is a personal workflow reference —
> how to make changes safely, ship to production, and roll back if something breaks.

---

## Branch structure

| Branch | Purpose |
|--------|---------|
| `main` | **Production.** Protected — never commit directly. Deploys automatically to Render (API) and Cloudflare (Worker + Pages) on merge. |
| `dev` | **Default working branch.** All day-to-day changes go here. CI runs checks on every push but nothing deploys. |

---

## Day-to-day workflow

### 1. Make sure you're on `dev`

```bash
git branch --show-current   # should print: dev
git pull                    # get latest from origin/dev
```

If you're on `main` by mistake:
```bash
git checkout dev
```

### 2. Code, commit, push to `dev`

```bash
git add apps/dashboard/src/pages/SomePage.tsx
git commit -m "fix: describe what changed and why"
git push                    # goes to origin/dev — CI checks run, nothing deploys
```

Check the CI result at:
**https://github.com/Dw-Dwain/Scroll-pop/actions**

All 5 checks must be green before you ship:
- ✅ Lint
- ✅ Typecheck
- ✅ Unit Tests
- ✅ Snippet Size Check (≤ 10 KB gzipped)
- ✅ No history.* / popstate in snippet

### 3. Ship to production — open a PR

When `dev` is ready to go live:

1. Go to **https://github.com/Dw-Dwain/Scroll-pop/compare/main...dev**
2. Click **Create pull request**
3. Title: short summary of what's in this batch of changes
4. Body: bullet list of what changed (copy from commit messages)
5. CI re-runs on the PR — merge button stays grey until all checks pass
6. Once green → **Merge pull request** → confirm

**What happens after merge:**
- Render auto-deploys the API (dwain-coder/Scroll-pop watches main)
- Cloudflare Pages auto-deploys the dashboard
- GitHub Actions triggers the Worker deploy (from Dw-Dwain/Scroll-pop)

### 4. Sync `dwain-coder` (Render's source repo)

The Render API deploys from `dwain-coder/Scroll-pop`. After merging the PR on `Dw-Dwain`,
sync it:

```bash
git push "https://ghp_<dwain-coder-token>@github.com/dwain-coder/Scroll-pop.git" main
```

> **Note:** Replace `<dwain-coder-token>` with a fresh token from the `dwain-coder` GitHub
> account (Settings → Developer settings → Personal access tokens → `repo` + `workflow` scopes).
> Tokens used in this session should be revoked and regenerated — see Security section below.

### 5. After merging, pull `dev` back up to date

```bash
git checkout dev
git pull origin main        # bring dev in sync with the new main
git push                    # update origin/dev
```

---

## Rollback — if a bad merge reaches `main`

### Option A: Revert the merge commit (safest)

```bash
git checkout main
git pull
git log --oneline -5        # find the merge commit hash, e.g. abc1234
git revert -m 1 abc1234     # -m 1 = keep the main-branch parent
git push origin main        # triggers a new deploy with the revert
```

This adds a new commit that undoes the merge. History is preserved. Render/CF redeploy the reverted state automatically.

### Option B: Reset main to a known-good commit (destructive — use only if revert won't work)

```bash
git checkout main
git pull
git log --oneline -10       # find the last good commit hash, e.g. def5678
git reset --hard def5678
git push --force-with-lease origin main
```

> ⚠️ This rewrites history. Only do this if the revert approach fails or creates a mess.
> Force-push is blocked by branch protection — you'll need to temporarily disable it in
> GitHub → Settings → Branches → main → Edit, then re-enable after.

---

## Commit message format

```
type(scope): short description

Optional longer body explaining why (not what — the diff shows what).
```

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change with no behaviour change |
| `ci` | CI/CD workflow changes |
| `docs` | Documentation only |
| `chore` | Dependency updates, config tweaks |

Examples:
```
feat(snippet): render visual builder elements in Shadow DOM
fix(api): allow PUT/PATCH/DELETE in CORS preflight
refactor(wizard): consolidate triggers into Design step, drop Rules step
ci: skip Worker deploy when Cloudflare token is absent
docs(master): update build status for Render Pro
```

---

## CI gates — what each check does

| Check | What it catches |
|-------|----------------|
| **Lint** | Code style / ESLint rule violations |
| **Typecheck** | TypeScript errors across all packages |
| **Unit Tests** | Vitest unit test failures |
| **Snippet Size ≤ 10 KB gzipped** | Bundle bloat — if the snippet exceeds 10,240 bytes gzipped, the build fails. This is a hard Google spam-policy requirement. |
| **No history.* / popstate** | Banned browser navigation APIs in the snippet source (pushState, replaceState, onpopstate). Also a Google policy requirement — see CLAUDE.md rule #1. |

---

## Two-repo setup (why it exists)

ScrollPop pushes to two GitHub repos:

| Repo | Owner account | Purpose |
|------|--------------|---------|
| `Dw-Dwain/Scroll-pop` | Dw-Dwain | Holds Cloudflare secrets → deploys the **Worker** |
| `dwain-coder/Scroll-pop` | dwain-coder | Holds Render integration → deploys the **API** |

Both hold identical code. Every push goes to both. This split exists because Render is connected
to `dwain-coder` (the account it authenticated with) and the Cloudflare API token is stored
on `Dw-Dwain`. Ideally these would consolidate to one repo — see MASTER.md §29 for context.

**Quick push to both:**
```bash
git push                                                                 # → Dw-Dwain (origin)
git push "https://ghp_TOKEN@github.com/dwain-coder/Scroll-pop.git" dev  # → dwain-coder
```

---

## Security — tokens

Tokens used in Claude sessions should be treated as **single-use**:
1. Generate a token with the minimum scopes needed (`repo` + `workflow` for code pushes)
2. Use it in the session
3. **Revoke it immediately after** at https://github.com/settings/tokens

Tokens that have been exposed in this project (revoke these if not already done):
- `ghp_9BWP...` — Dw-Dwain account, used during setup
- `ghp_kGz...` — Dw-Dwain account, failed attempt
- `ghp_W4ez...` — dwain-coder account, used for pushes

**Never commit tokens to the repo.** The `.gitignore` excludes `.env*` files but not raw
tokens pasted in comments or config — always use environment variables.

---

## Environment variables — where to set them

| Variable | Set it here |
|----------|------------|
| API vars (`DATABASE_URL`, `CLERK_SECRET_KEY`, etc.) | Render → service → Environment |
| Dashboard vars (`VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`) | Cloudflare Pages → Settings → Environment variables → **Production** |
| Worker vars/secrets (`INTERNAL_SECRET`, `REDIS_URL`) | Cloudflare → Workers → scrollpop-worker → Settings → Variables and Secrets |

> ⚠️ `VITE_*` vars are baked in at **build time** on Cloudflare Pages. After changing one,
> you must trigger a manual redeploy: Deployments → `...` → Retry deployment.

---

## Useful commands

```bash
# Check which branch you're on
git branch --show-current

# See what's different between dev and main
git log main..dev --oneline

# Run all checks locally before pushing
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm --filter snippet build   # then check gzip size manually

# Check snippet gzip size
node -e "const fs=require('fs'),z=require('zlib');const b=fs.readFileSync('packages/snippet/dist/p.js');console.log('gzipped:',z.gzipSync(b).length,'/ 10240 bytes')"

# See recent git history
git log --oneline -15

# Undo the last commit (keeps changes staged)
git reset --soft HEAD~1
```
