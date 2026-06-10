# ScrollPop — Master Reference Document

> **Audience:** Owner / lead developer. Everything about this product in one place.
> Last updated: June 10, 2026 · v0.1.7-beta · Tracker: **54/54 code complete** · Launch readiness: **94/100**
> Status detail lives in **`PROJECT-TRACKER.md`** (single source of truth) — this file links there rather than duplicating it.
> 4 ops-only tasks remain (Stripe keys, 2× DNS/CDN, marketing deploy) + P1-14 deferred by owner decision.
> **P3-2 complete**: dashboard at 0 ESLint warnings + 0 TypeScript errors (full strict). Dormant keys (Sentry/PostHog/Resend) activated.
> **June 7 security code review (CR-01→08) complete** — 8 findings fixed, no backdoors found.
> **June 8:** deploy pipeline fixed (pushes now auto-deploy), end-to-end lead capture verified live, DNT→GPC, marketing-consent checkbox, modal-backdrop fix, manual snippet verify, **multi-country geo (US+JP)**, keyboard element nudging.
> **June 9:** live Shopify/WordPress debugging — fixed **host `display:none`** (theme hid the popup), **leads on `email_capture`** (origin gate dropped conversions on custom domains), **`/spin.js` 404** (not on R2), **custom-domain analytics** (`sites.custom_domain`), **heading WYSIWYG** (editor lied about alignment), center-modal positioning, custom Success screen, `/e` CORS. Plus **recurrence frequency model** (max displays + cooldown + show-after-convert) and snippet **refactor** (removed dead flat-render path −370B; **per-chunk CI budgets**).
> **June 9 (cont.):** **Agency SaaS layer** shipped — **client workspaces** (CRUD API + top-nav switcher + per-client site filtering/assignment) and **coupled-login team invites** (owner invites by verified email → employee accepts → shares the agency's data; Novatise `@novatise.com` domain auto-join untouched), all **agency-plan + owner gated**. Plus **`/e` undercount fix** (honour `sendBeacon()`'s `false` return → keepalive `fetch` fallback for Firefox-ETP/strict-privacy visitors), **ScrollPop Creatives thumbnail picker** in the designer, **Simulate preview** top-aligned + height-capped, **deleted-campaign funnel exclusion**, and **`trigger_fired`** funnel tracking. Open: continue lazy-chunk extraction (Journey/Targeting), popup sequences, legal review (CCPA+APPI).
> **June 10:** Repo cleanup (commit `558ce1f`) — **NQ-1** dead UI-kit pages deleted (CalendarPage, FormsPage, ImageGallery, MessagesPage, SupportChat, TablesPage), **NQ-5** legacy duplicate source trees removed (`scrollpop-campaign-designer/`, root `src/`, root `index.html`/`tsconfig.json`/`vite.config.ts`), **AG-6 partial** client-scoping extended to Campaigns/Leads/Analytics API routes + `dataProvider.ts` auto-appends `clientId`, **NQ-7** ClientSwitcher light-mode contrast fixed. Japanese sales templates committed. Open: wire `clientId` into Analytics/Dashboard `useCustom` calls.
> **June 10 (cont.):** **Render → Fly.io migration started** (API + Postgres, replacing Render + Neon; Cloudflare Workers/Pages untouched). Step 1 (config, zero-risk): root `Dockerfile` (pnpm workspace build → `node apps/api/dist/index.js` on port 8080) + `.dockerignore` + `fly.toml` (shared-cpu-1x/512MB, `ord` region, `/health` check, `release_command` runs `drizzle-kit migrate`) added.
> **June 10 (cont. 2):** **`scrollpop-db` recreated on Fly** from a custom `flyio/postgres-flex:17.2` image rebuilt with **TimescaleDB 2.27.2** (`infra/db/Dockerfile-timescaledb`-derived, pushed to `registry.fly.io/scrollpop-db:timescaledb`); machine updated, healthy 3/3, `timescaledb` extension created in `scrollpop_api` DB. **`scrollpop-api` deployed to Fly** — `drizzle-kit migrate` ran clean (21 migrations), `events` hypertable confirmed, `/health` returns `{"ok":true}`. Worker `API_ORIGIN` and dashboard CI `VITE_API_URL` repointed to `https://scrollpop-api.fly.dev`; `shopify.app.toml` + Shopify fallback URL updated (Shopify Partners dashboard still needs matching update). Corrected long-standing doc error: stack docs said "Supabase" but prod DB has **always been Neon** — `CLAUDE.md`/`SPEC.md`/docs now say Fly Postgres (current) and `infra/supabase/` renamed to `infra/db/`. **Data migrated:** `pg_dump`/`pg_restore` from Neon (`withered-hill-10483240`) → `scrollpop-db` complete — 6 tenants, 10 sites, 21 campaigns/designs, 4 users, 5 tenant_members, 4 variants, 2 leads, and all 2,708 `events` rows (loaded into the new hypertable via CSV `\copy`, since Neon used native monthly partitions vs. the new TimescaleDB chunks). Row counts verified against source; `clients`/`coupons`/`team_invites`/`shopify_installations` confirmed empty on both. **Outstanding:** Render + Neon decommission + DNS cutover (custom domains/Stripe webhook/Shopify Partners app URL still need pointing at `scrollpop-api.fly.dev`).
> **June 10 (cont. 3):** **Repo consolidation — `dwain-coder/Scroll-pop` retired.** It existed solely so Render's auto-deploy had a source repo (manual `git push --force` sync after every merge). Now that CI's `deploy-api` job deploys straight to Fly via `flyctl`, that split serves no purpose. `Dw-Dwain/Scroll-pop` is the single repo for all CI deploys (API → Fly, Worker → Cloudflare, Dashboard → Cloudflare Pages). Updated: root `package.json` `deploy` script (no longer pushes to `dwain-coder`), `packages/shopify-app-embed/package.json` `--source-control-url`, `CONTRIBUTING.md` (removed dwain-coder sync step + two-repo section, Fly-ified secrets/migration instructions), `SPEC.md` deployment section, `apps/dashboard/public/_headers` CSP `connect-src` (→ `scrollpop-api.fly.dev`), and MASTER §15 CI/CD pipeline + §16 env var examples. `dwain-coder/Scroll-pop` left in place as a backup/mirror — owner will delete or keep at their discretion.
> **June 10 (cont. 4):** **Render + Neon decommissioned (deleted) — migration complete.** Verified the live stack is 100% on Fly before/after deletion: `scrollpop-api` `/health` `200`, edge `/c/<key>` returns real data from `scrollpop-db`, old `scroll-pop.onrender.com` now `404`. `DATABASE_URL` confirmed already pointing at `scrollpop-db.flycast` (not Neon). Fixed a stale **`API_BASE_URL` Fly secret** (was still `scroll-pop.onrender.com` → now `https://scrollpop-api.fly.dev`; redeployed so both machines converged on the new value — a rolling `secrets set` had left one machine behind). **Clerk webhook repointed** to `…fly.dev/api/v1/webhooks/clerk` and tested (delivery **Succeeded**, signing secret unchanged). Snippet image-preload fix + core budget bump to 10300B committed/pushed (`15b2c2b`, `69d1935`). **Still open (external dashboards, no code/key changes):** Stripe webhook URL → `…fly.dev/api/v1/webhooks/stripe` **and** set `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/4 price IDs as Fly secrets (confirmed missing); Shopify Partners App URL + redirect URIs → `scrollpop-api.fly.dev`. Optional: `api.scrollpop.online`/`cdn.scrollpop.online` custom domains, marketing-site deploy.
> **June 11:** **Adversarial security re-review + full Top-20 remediation (commit `72d606f`).** Fresh penetration-style audit (auth, multi-tenant, API, infra, snippet, privacy). Verdict: app-layer tenant filtering already consistent on every route; no SQLi/XSS/mass-assignment/IDOR; webhooks timing-safe. Fixed all 20 priorities — API builds clean, **82 vitest pass** (incl. new `src/security-fixes.test.ts`). **C-1 (the headline): runtime row-level security as a DB-level tenant backstop** — two Postgres pools (system pool `app.bypass_rls=on`, tenant pool with per-request `app.current_tenant` GUC via AsyncLocalStorage), `db` is now a transparent proxy, `ensure-rls.ts` + migration `0014_real_rls` apply **FORCE RLS + tenant-predicate policies**. A query that forgets its tenant filter now returns **zero rows instead of leaking**. Cross-tenant flows (admin console, team invites, fire-and-forget notifications) use the system/bypass pool; `users`/`admin_audit_log` intentionally un-RLS'd. **Gated by `DB_RLS_ENFORCED`; activated on Fly via `fly secrets set DB_RLS_ENFORCED=true -a scrollpop-api`.** Other fixes: **H-1** admin check fails CLOSED on Clerk error (5-min verified-cache, no DB-email fallback); **H-2** Clerk webhook stores the verified PRIMARY email; **H-3** site-verification fetches use a shared SSRF guard (`lib/url-guard.ts`) + `redirect:error` + no reflected key; **M-1/M-2** ESP keys + outbound-webhook secrets encrypted at rest (AES-256-GCM); **M-3** token-crypto refuses plaintext in prod (now requires `SHOPIFY_ENCRYPTION_KEY`, **set on Fly ✅**); **M-4** dev `/c`+`/v1` routes 404 in prod; **M-5** dropped `*`+credentials on `/e`; **L-1** dashboard CSP now enforcing; **L-2** ops `campaignId` UUID-validated; **L-3** `/e` revenue honored only from the Worker; **L-4** no emails in admin logs. Still ops-only: set Stripe secrets on Fly; rotate any pre-June-11 ESP/webhook secrets (re-save in dashboard re-encrypts).
> **June 10 (cont. 5):** **"Popups not rendering" investigated — infra healthy, root causes were targeting/frequency gates + one real bug.** Verified every hop live post-migration (Fly `/health` 200, Worker→API secret OK, KV serving, R2 chunks all 200) and rendered the gourmet Rakuten popup + a spin-to-win wheel end-to-end through the production chain. Hiding factors: **geo rules** (sakananet + gourmet C1 are JP-only; owner browses from IN), **frequency caps** (`once_per_visitor`/`once_per_session` suppress re-display after first view — retest in incognito), and **`url_exact` bug (fixed, `438a651`)**: stored scheme-less URLs ("www.site.com/") never matched `location.href` — now compared normalized (no scheme/#fragment/trailing slash). Deployed + verified live on CDN. Notes: prod snippet strips all `console.*` (silence ≠ failure); gourmet C2 design still references placeholder `creatives/REPLACE-ME.png` (404s every load — swap/delete the `cr-img` element in the builder); **spin-to-win works** but no active campaign uses `kind='spin_wheel'`. New local repro harness in `.preview-test/` (launch.json "Snippet repro", port 4555, stubs config + serves dist chunks). Fly health-check blip during deploy was the rolling restart — passing.

---

## 📅 June 10, 2026 — Repo Cleanup + AG-6 Partial + NQ-7

**Commit `558ce1f` — 60 files changed, 251 insertions / 16,590 deletions. Pushed to both remotes.**

### What shipped

| Item | Commit | What |
|---|---|---|
| **NQ-1** Dead UI-kit pages | `558ce1f` | Deleted 6 unrouted, hardcoded-data pages from `apps/dashboard/src/pages/`: `CalendarPage.tsx`, `FormsPage.tsx`, `ImageGallery.tsx`, `MessagesPage.tsx`, `SupportChat.tsx`, `TablesPage.tsx`. |
| **NQ-5** Legacy duplicate source trees | `558ce1f` | Deleted `scrollpop-campaign-designer/` (old standalone Vite app, 18 files), root `src/` (10 files), and root-level `index.html`, `tsconfig.json`, `vite.config.ts`. These were stale Figma-make exports never referenced by the monorepo build. |
| **AG-6 (partial)** Client-scoping API | `558ce1f` | `routes/campaigns.ts` — `GET /campaigns?clientId=` filters by `site.client_id` subquery. `routes/leads.ts` — `?clientId` on list + export (`clientLeadFilter` helper). `routes/analytics.ts` — `clientEventFilter` helper applied to overview / campaigns / daily / breakdown / revenue / funnel (events→campaign→site→client chain). |
| **AG-6 (partial)** dataProvider | `558ce1f` | `providers/dataProvider.ts` — `getList` auto-appends `clientId` (from `localStorage.sp_active_client`) for `campaigns` + `leads` resources. |
| **NQ-7** ClientSwitcher contrast | `558ce1f` | `components/ClientSwitcher.tsx` — fixed light-mode "+" New client row contrast (was `--accent-400`, unreadable; corrected). |
| Japanese sales templates | `558ce1f` | Added `Scrollpop japanese sales templates/` image assets (Amazon JP Black Friday / Prime Day / Spring Sale, Mercari, Rakuten, Yahoo Shopping / PayPay Mall). |

### AG-6 remaining
- Wire `clientId` into the **Analytics** and **Dashboard** pages' `useCustom` analytics calls (they bypass `getList`).
- Typecheck + lint + owner verify: client switcher → campaigns / leads / analytics filter correctly.

### Deploy notes
- No schema changes in this commit — no Render redeploy required.
- Snippet pre-commit hook rebuilt `apps/worker/src/p.txt` automatically and staged it.
- All commits pushed to **origin** (`Dw-Dwain/Scroll-pop`) + **dwain-coder** (`dwain-coder/Scroll-pop`).

---

## 📅 June 9, 2026 (cont.) — Agency SaaS Layer + Analytics/Designer Polish

**Built the agency multi-tenant layer (client workspaces + coupled-login team invites), fixed the analytics undercount at its real root cause, and shipped the Creatives picker + Simulate-preview polish.**

### Agency SaaS layer (new feature — beyond the original 54-item audit)
Model: an **agency-plan** tenant is a workspace that holds multiple **client** sub-accounts; the operator switches the active client from the top nav and the workspace re-scopes. **Coupled logins:** the agency owner invites employees by verified email; on accept they join the *same* tenant and share all its data. **Novatise** stays a super-admin agency — its `@novatise.com` domain auto-join is untouched; Jon (owner) can additionally invite outside people, and Jon + the owner see the same data.

| Step | Commit | What |
|---|---|---|
| 1 — Schema foundation | `e6bffe8` | `clients` table (tenant-scoped, RLS) + `sites.client_id`; SCHEMA_VERSION →16. |
| 2 — Clients CRUD API | `9b851bc` | `routes/clients.ts` GET (with per-client site counts) / POST / PATCH / DELETE (soft-delete + unassign sites); agency-plan + owner/admin gated. `sites` PATCH accepts `clientId`; `GET /sites?clientId=` filter. |
| 3 — Client switcher | `538c4cb` | `useClients`/`useActiveClient` hooks; `ClientSwitcher` in the top nav (agency-only) with select / All-clients / inline create / delete; Sites page filters by active client, shows client chips, assigns via Edit dialog, auto-assigns new sites to the active client. |
| 4 — Team invites (backend) | `6a8e01d` | `team_invites` table + migration (SCHEMA_VERSION →17); `routes/team.ts` (members + invites list, invite, revoke, remove-member, `GET /team/pending`, accept, decline). **Accept verifies the invite email == the accepting user's verified Clerk primary email (fails closed).** `tenant-context` routes accepted agency members to the shared tenant (coupled login). |
| 4–5 — Team UI + gating | `5c10f33` | `pages/Team.tsx` (owner invites by email, lists members/pending, revoke/remove; non-agency sees an upgrade gate); `PendingInvites` banner (any user with pending invites accepts → joins + reload, or declines); **Team** nav item shown only on the agency plan. |

### Other fixes shipped
| Item | Commit | What |
|---|---|---|
| **`/e` analytics undercount** | `ef919d2` | Real root cause: `navigator.sendBeacon()` **returns `false`** when Firefox-ETP / strict-privacy refuses to queue a third-party beacon — the old code ignored it and never fell back, silently losing the event. Now: honour the `false` return → keepalive `fetch` (`credentials:'omit'`, `text/plain` so no preflight). Snippet rebuilt; **gzip 10179/10240**. (Supersedes the earlier `966288b` `text/plain` fetch-fallback fix.) |
| **ScrollPop Creatives picker** | `de8be27` (+ list endpoint `72b137e`) | Thumbnail grid in the designer (under *Image Source URL* for image elements) that fetches `GET /creatives` from the edge worker (R2, CORS `*`); clicking a tile writes `cdn.scrollpop.online/creatives/<name>` into the element. Hidden if the library is empty/unreachable (manual URL still works). |
| **Simulate preview** | `de8be27` | Modal popups now **top-aligned** (were vertically centered → looked like "50% scroll"); backdrop scrolls; popup card **capped to the frame** (`maxHeight` + internal scroll) so tall designs don't clip/overflow. |
| Deleted-campaign funnel exclusion | `43a06e4` | Aggregate funnel excludes soft-deleted campaigns (campaignId drill-down exempt). |
| `trigger_fired` funnel tracking | `30f4188` | Snippet beacons `trigger_fired` once-per-load before the frequency check so the funnel's first stage tracks. |
| Compact full-width Sites | `a72715d` | Narrow clickable site list + thin add banner + modal-only "new site" config. |

### Deploy notes
- API changes (clients + team routes, SCHEMA_VERSION →17) need a **Render redeploy**; the `ensure-clients` + `ensure-team-invites` DDL is idempotent and runs on first boot of the new version (gated by Redis flag `sp_schema_v17`). Deploying the latest commit is sufficient — no cache clear needed.
- Snippet (`/e` fix) + worker (`/creatives`) deploy via CI → R2.
- All commits pushed to **origin** + **dwain-coder**.

### Open follow-ups (new)
- Client-scoping currently re-scopes **Sites** by active client; extend the same `clientId` key to **Campaigns / Analytics / Leads** filtering for a fuller per-client workspace.
- Owner verify post-deploy: invite an outside employee → accept flow → confirm shared data; create a client + assign sites → switcher filters correctly.

---

## 📅 June 9, 2026 — Session Summary

**Live debugging on Shopify (sakananet.com) + WordPress (gourmet-meat.com): popup not showing, leads not saving, spin not rendering. Root-caused all, then shipped a recurrence model + began the snippet refactor.**

### Root causes found
- **Popup invisible on Shopify (every device):** the theme applies a global reset that forces `display:none` on `<body>`-appended elements, so the snippet's popup host (and its entire closed Shadow DOM) was hidden. It *rendered* (impression/view fired) but never painted. WordPress had no such rule → looked "Shopify-only."
- **Leads not saving (both platforms):** the lead row was inserted **only on `conversion`**, and `conversion` is dropped by the anti-forgery **origin gate** when the page domain isn't a known site domain (Shopify served on custom `sakananet.com` vs registered `*.myshopify.com`). `email_capture` (not gated) carried the same email but never triggered a lead.
- **Spin wheel never appeared:** the snippet lazy-loads `${EDGE}/spin.js`, but the Worker only served `/p.js` and CI only uploaded `p.js` to R2 → `/spin.js` was a guaranteed 404.
- **Heading "left vs center" mismatch:** the designer's heading `<h2>` had hardcoded `justify-center text-center`, so it *always displayed centered* regardless of the saved `align`. Operators saw centered; the stored value was the template default `left`; the snippet faithfully rendered `left`. Editor was lying, not the snippet.
- **"Campaign not serving" / IMPRESSIONS 0:** campaign was `paused` (config only serves `active`); impressions/conversions also dropped by the origin gate on the custom domain.
- **gourmet 404:** stale/wrong embed `public_key` after the site was recreated.

### Shipped (commits)
- **Host `display:block!important`** (`3b65c8a`) — pins the popup host visible so a host theme's `display:none` reset can't suppress it. *The fix that made the live popup appear.*
- **Leads on `email_capture`** (`b71b671`) — lead saves on conversion **or** email_capture (origin-gate-immune) → works on every domain.
- **Serve `/spin.js`** (`b71b671`) — Worker serves the chunk from R2; CI uploads it. **CI now uploads every `dist/*.js`** (`2844032`) so no future chunk can 404.
- **Custom storefront domain (Option A)** (`2844032`) — `sites.custom_domain` + origin gate accepts it (registrable match) → restores impression/conversion analytics on Shopify custom domains. SCHEMA_VERSION 13→14→**15** (`63dc5de`, `7c7cdc6`); column also added manually in Neon (skip-flag had blocked the first redeploy).
- **Heading WYSIWYG** (`a3bd6ba` editor + `4ba57c6` snippet) — editor honors `el.align`; live snippet honors `align` via flex `justify-content`. What you set = what saves = what renders.
- **Custom Success screen** (`4ba57c6`) — element-mode campaigns render the designed Success step instead of the built-in coupon card.
- **Center-modal positioning** (`14b9f77`) — center via the `translate` CSS property so entrance animations (bounce/zoom) don't knock the modal off-screen.
- **`/e` CORS** (`966288b`) — fetch fallback uses `text/plain` (no preflight) for strict-privacy/Firefox visitors.
- **Recurrence frequency model** (`7c7cdc6` snippet+schema+API · `a00dbc0` persistence · `685489d` dashboard) — `maxDisplayCount` + `cooldownSeconds` + `showAgainIfConverts` (PromoLayer-style), layered on the legacy `frequency` enum (backward-compatible). Full stack: snippet enforces · `frequency_rules` columns · `/c` serves · `/campaigns/:id/frequency` persists · designer control under Display Frequency.
- **Refactor — removed dead flat-render path** (`2ace8a9`) — every campaign is element-mode (verified 10/6/10/8 elements; spin delegated). −370B gzip (core 10229→9857, then 9987 after recurrence).
- **Per-chunk CI budgets** (`4b9a6e6`) — core ≤10KB (8KB target), spin ≤3KB, journey ≤3KB, targeting ≤2KB, unknown ≤3KB default. Enforces the module-budget model.

### Deploy notes
- API changes (leads, custom-domain gate, recurrence) require a **Render redeploy**; SCHEMA_VERSION 15 auto-adds columns on boot. Worker/snippet deploy via CI → R2.
- Manual one-time: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS custom_domain TEXT;` + `UPDATE sites SET custom_domain='sakananet.com' WHERE public_key='68f53e…'`.
- Verified live: leads now save. Pending owner verify: spin renders post-deploy; re-center the 2 left-stored headings in the now-truthful editor; impression/conversion counts on the custom domain.

### Open follow-ups
- **Refactor continues:** extract Journey / Advanced-Targeting / Element-Extras lazy chunks (budgets in place). FU-2 size pass effectively underway (383B headroom freed).
- **Popup sequences / chaining** (discussed) — advance-on-dismiss, max-2 + delay guard; belongs in the Journey runtime. UX/policy caution noted (popup-trap adjacency).
- **FU-3** marketing CI deploy · **FU-4** legal review (CCPA+APPI).
- `designs.config` is stored as a **double-encoded JSON scalar** (string) — noted; not a live bug (serving path parses it) but the flat-mode/JSON queries must unwrap via `(config #>> '{}')::jsonb`.

---

## 📅 June 8, 2026 — Session Summary

**Production debugging + deploy pipeline + privacy/consent. Lead capture verified working end-to-end on a live site.**

### What happened
- **"Leads/analytics not recording" was NOT a bug** — the operator QA'd in Firefox with Do-Not-Track on; the snippet honored DNT and suppressed all events. Confirmed end-to-end works in Chrome (popup → `/e` conversion+email → lead row + analytics). Real visitors were never affected.
- **Fixed the deploy pipeline** — CI deploy jobs were *failing* (under-permissioned Cloudflare API token), so git pushes never published the snippet/dashboard. Recreated the token with Workers Scripts + KV + R2 + Pages (Edit) + Account Settings (Read) + Zone Workers Routes (Edit). **Pushes now auto-deploy.** Verified live `p.js` by hash.
- **WP plugin** (carryover from Jun 7): backslash-zip fix re-uploaded to R2, verified live.

### Shipped
- **`email_capture` payload fix** (`f3992eb`) — ESP/auto-responder/Zapier now receive the captured email (were silently no-op'ing).
- **DNT → GPC** (`56a321c`) — dropped deprecated Do-Not-Track (was silently dropping real leads), honor Global Privacy Control (CCPA/CPRA). + scrollpop.online GPC compliance copy.
- **Targeting rule builder UX** (`4befd10`) — readable, accessible page-rule editor.
- **Marketing-consent checkbox** (`03d6eca`) — opt-in "Consent Box" builder element; gates submit, records consent on the lead (GDPR/CASL/APPI).
- **Modal-backdrop fix** (`2b94812`) — designer modals had no overlay (overlayColor vs overlayEnabled mismatch); derived dashboard-side. Existing campaigns need a re-save.
- **Manual snippet verify** (`2b94812`, FU-5 ✅) — `verify-snippet` endpoint + "Test connection" button for manual installs (no Shopify app).
- **Multi-country geo** (`41e6df4`) — target multiple markets (e.g. US + JP) via a multi-select chip group; include-list excludes EU automatically.
- **Keyboard nudging + softer drag** (`40925a2`) — arrow-key element movement in the designer; snap threshold 2.5→1.2 for free-flow dragging.

### Geo / compliance direction (owner decision)
Targeting **Japan + USA, not EU.** A geo include-list (US+JP) excludes EU visitors, so no EU data is processed → GDPR out of scope for the campaign. EU consent work (FU-1) deprioritized; legal review (FU-4) narrows to CCPA + APPI.

### Open follow-ups
- **FU-1** `requireConsent` EU toggle — **deprioritized** (not targeting EU).
- **FU-2** snippet size pass — bundle at ~9.94 KB / 10 KB; `console.*` already dropped at build, so needs a refactor. Do before more snippet logic.
- **FU-3** `deploy-marketing` CI job (scrollpop.online still deployed by hand).
- **FU-4** **legal review** — privacy/Terms/DPA, scope **CCPA (US) + APPI (Japan)** incl. cross-border transfer to US ESPs.

---

## 📅 June 7, 2026 — Session Summary

**P3-2 finished, full security code review, all docs reconciled. App is launch-ready pending Stripe ops.**

### ✅ Completed

- **P3-2 — fully done.** `apps/dashboard`: **0 ESLint warnings + 0 TypeScript errors** under full strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). The 6 complex designer/wizard files that were deferred June 6 are fixed with proper typed interfaces (framer-motion `Variants`, `DraftBuilderElement`, `LiveBlock`/`WheelSlice`) — no blanket `any`. `DraftBuilderElement` exported from `types/campaign.ts`. Commits `497224c`, `f38ffbd`.
- **Security code review (CR-01 → CR-08)** — full multi-angle review of the whole platform; no backdoors/auth bypasses found. 8 findings fixed in `3062745`:
  - CR-01 🔴 `cssFont` allowed `"` → style-attribute breakout (XSS). Removed from allowlist + regression test.
  - CR-02 🟠 `ensureEventPartitions()` was behind the 24h schema-skip flag → month-rollover analytics loss. Now runs every boot.
  - CR-03 🟠 ESP dispatch was opt-*out* → cross-campaign lead leak. Flipped to opt-*in* (`=== true`).
  - CR-04 🟠 Raw client `meta` overrode sanitized fields in outbound webhook payloads. Spread order fixed.
  - CR-05 🟠 ESP adapters returned/logged provider raw body (could echo API key/PII). Status-only now.
  - CR-06 🟡 Outbound-webhook PUT clobbered `url`/`events` on partial update. Merge onto prev.
  - CR-07 🟡 SSRF guard checked only first DNS record. Now checks all addresses + IPv6/mapped-IPv4 (strengthens SR-01).
  - CR-08 🟡 Per-IP flood gate failed fully open when Redis down. Added in-memory fallback gate.
- **Tooling** — `.githooks/pre-commit` auto-rebuilds + re-stages `apps/worker/src/p.txt` whenever snippet source changes (CI `snippet-size-check` can no longer be tripped by a stale bundle); `.gitattributes` enforces LF on hooks. Enabled via `core.hooksPath` on `pnpm install`.
- **Dormant keys activated** — Sentry, PostHog, Resend env vars now set (Render + CF Pages).
- **Repo hygiene** — moved loose secret files (Google OAuth client secret, Neon password) out of the OneDrive-synced folder; gitignored the generated `lint-report.json`. Verified neither was ever committed.
- **Docs** — PROJECT-TRACKER.md fully reconciled (TD11 ✅, dependency map, sprints, timeline, June 7 CR section); MASTER.md refreshed; both point at the tracker as the single source of truth.

### Verification
`pnpm -r typecheck` clean · `pnpm -r lint` clean · snippet **26/26** · API **71/71** · bundle **9.68 KB** (< 10 KB gate). All pushed to `origin` + `dwain-coder`.

### ⏳ Still ops-only (owner handling)
- **P0-2** Stripe keys in Render (only revenue gate) · **P2-18** `api.scrollpop.online` CNAME · **P3-3** `cdn.scrollpop.online` R2 domain · **P3-5** deploy `site-plan/` · **P1-14** Shopify App Store (deferred).

---

## 📅 June 6, 2026 — Session 3 Summary

**All 54 tracker items code-complete.** 15 security findings fixed. ESLint 401 → 0 warnings (TypeScript errors in 6 designer files surfaced and were deferred; fully resolved June 7 under P3-2). Docs reconciled.

### ✅ Completed (49 → 54 code tasks)

- **SR-01 → SR-15** — Full security remediation sprint, all 15 findings fixed same session:
  - SR-01 SSRF outbound webhook (private-IP blocklist + `redirect:'error'`, DNS-rebind safe)
  - SR-02 `/integrations/test` always returning `ok:true` — adapters now return `EspSyncResult`
  - SR-03 `DELETE /me` sole-owner orphan guard (409 if last org owner)
  - SR-04 dirty-delete window — Clerk delete first, DB cleanup only after confirmation
  - SR-05 Mailchimp `serverPrefix` injection (regex validates `^[a-z]{2}\d{1,2}$`)
  - SR-06 coupon redemption TOCTOU → atomic `UPDATE … WHERE uses < maxUses RETURNING`
  - SR-07 auto-responder HTML XSS → `sanitize-html` allowlist before `sendEmail()`
  - SR-08 Mailchimp 400 silently swallowed → only genuine "Member Exists" is non-fatal
  - SR-09 rate limit on `/integrations/test` → 5/min keyed per `tenantId`
  - SR-10 Shopify/other origin gate bypass → enforced for all platforms
  - SR-11 frequency cap key mismatch in snippet (`_sp_fr_X` → `_sp_X`)
  - SR-12 Redis partial-hash cast `undefined` → `"undefined"` string
  - SR-13 `PUT /integrations` silent 200 no-op → 404 when tenant missing
  - SR-14 webhook `user.created` sets `email:''` for phone/OAuth accounts
  - SR-15 duplicated `revokeAllUserSessions` → extracted to `lib/auth.ts`, shared
  - New tests: SR-01/05/10/11 tests added; ESP adapter contract tests updated
- **P3-2** (partial) — ESLint reached 0 warnings, but the `any`→typed conversion in 6 complex designer files introduced TypeScript errors; those files were reverted to avoid shipping broken code. **Fully completed June 7** (0 warnings + 0 TS errors).
- **P1-8/P1-9/P2-14** — Confirmed code-complete (were done June 5 but tracker Quick Status hadn't reflected it)
- All docs reconciled: PROJECT-TRACKER.md, MASTER.md, SECURITY-REMEDIATION.md synced to same ground truth

### ⏳ Still ops-only (5 items — no code needed)
- **P0-2** — Stripe keys in Render (still the only revenue gate)
- **P2-18** — `api.scrollpop.online` CNAME in Cloudflare DNS (30 min)
- **P3-3** — `cdn.scrollpop.online` custom domain on R2 bucket (30 min)
- **P3-5** — Deploy `site-plan/` marketing site to CF Pages
- **P1-14** — Shopify App Store submission (excluded by owner decision)

### 🔐 Security posture (post-remediation)
All 12 CTO Phase 4 findings ✅ + all 15 SR findings ✅. API typechecks clean. 71/71 tests pass.

---

## 📅 June 5, 2026 — Session 2 Summary

**46 of 54 tracker items completed (was 40).** All 8 P3 items addressed.

### ✅ Completed (40 → 46)

- **P3-4** — Session revocation: `revokeAllUserSessions()` helper added to `webhooks.ts`. Called on `user.deleted` webhook before DB cleanup. New `DELETE /api/v1/me` endpoint revokes sessions then deletes the user (calls Clerk's `deleteUser` too to fire the webhook for full cleanup). Stolen JWTs can no longer be replayed after account deletion.
- **P3-7** — Redis campaign meta cache: `resolveCampaignMeta()` now uses Redis hash `sp_campaign_meta:{id}` (300s TTL) as L2 before hitting the DB. In-process Map stays L1. Falls through to DB on Redis error. Solves cold-cache DB hammering when Render scales to 2+ instances.
- **P3-10** — Mobile trigger overrides: `mobileOverrides: { pct?, seconds? }` added to `scroll_pct`, `dwell_time`, and `inactivity` in `packages/shared/src/index.ts`. Snippet applies overrides via `effectiveParams()` when `navigator.maxTouchPoints > 0`. No API change needed — `params` is already stored as JSONB.
- **P3-11** — ensure-*.ts boot flag: Redis key `sp_schema_v11` (24h TTL) set after first successful run. Warm restarts skip all 6 ensure-* calls. Bump `SCHEMA_VERSION` in `index.ts` when adding a new ensure-*.
- **P3-12** — Milestone backfill: `checkConversionMilestone()` now seeds `sp_conv:{tenantId}` from DB `count(*)` on first increment, so milestones reflect historical totals rather than counting from feature launch.
- **P3-2** (partial) — ESLint: 442 → 401 warnings. Fixed `dataProvider.ts` (18 any → proper Refine param types via `Parameters<DataProvider[method]>[0]`), `main.tsx` (dead imports, `import.meta as any`), `types/campaign.ts` (`any[]` → `DraftBuilderElement`), API `triggers.ts` (`any[]` → Drizzle inferred type). Remaining ~400 in UI components.

### ⏳ Still ops-only (2 items)
- **P3-3** — R2 custom domain: Cloudflare Dashboard → R2 → `scrollpop-assets` → Settings → Custom Domain → `cdn.scrollpop.online`. 30-min task.
- **P3-5** — Marketing site: `cd site-plan && pnpm build` then `npx wrangler pages deploy dist --project-name scrollpop-marketing`.

---

## 📅 June 5, 2026 — Session 1 Summary

**37 of 54 tracker items completed (was 30).** 7 features shipped in one session.

### ✅ Completed today (30 → 37)

**P1-12 — Gamified popups (spin-to-win):**
- `packages/snippet/src/spin.ts` — canvas-based spin wheel, weighted prize allocation, coupon clipboard copy, Shadow DOM rendering. Built as a separate lazy-loaded IIFE (`dist/spin.js`, 2.5 KB gzipped).
- `build.mjs` updated to build both `p.js` (9.8 KB gzipped, within gate) and `spin.js`.
- Main snippet lazy-fetches `spin.js` only when a `spin_wheel` campaign is served.
- Dashboard: CampaignWizard Step 1 gets a Popup Type picker (Standard vs Spin to Win) with slice label editor. Spin campaigns skip the visual editor (step 2) and build design config from slice labels.
- `design_kind` enum extended with `spin_wheel` (via `ensureCouponsSchema` / migration 0011).

**P1-18 — API integration tests (19 tests, all passing):**
- `apps/api/src/index.test.ts` — replaces placeholder with real Vitest tests.
- Coverage: event-field validation (type allowlist, UUID guard, numeric clamping, URL sanitisation), tenant isolation (IDOR on campaign GET/DELETE), Zod input validation (campaigns, coupons, auto-responder), Stripe webhook signature rejection, billing URL allowlist logic, cross-tenant origin injection defence.

**P2-10 — Campaign export streaming:**
- Replaced `limit(100000)` in-memory CSV with cursor-paginated `node:stream.Readable` (500-row batches using `lt(events.ts, cursor)`). DB connection never holds full result set.

**P2-12 — Coupon auto-generation:**
- `coupons` table (migration 0011 + RLS + boot self-heal in `ensure-coupons.ts`).
- `POST /api/v1/coupons/generate` — bulk generate with prefix/discount/expiry, `onConflictDoNothing` for uniqueness. `GET /coupons`, `DELETE /coupons/:id`.
- `discount_redeemed` event ingest validates the code (exists, not expired, under max uses) and atomically increments the usage counter — see P3-9 (✅ done).

**P2-13 — Email auto-responders:**
- `auto_responder` JSONB column added to `campaigns` table (migration 0011).
- `GET/PUT /api/v1/campaigns/:id/auto-responder` API routes.
- Ingest path hooks `email_capture` events: reads campaign config, if `enabled: true` fires Resend email to the captured address. Best-effort — never blocks ingest.

**P2-16 — Agency multi-tenant limitation documented:**
- Settings → Team tab: agency note clearly explains single-workspace limitation and v2 plan.

**P2-17 — Team invitations UI:**
- New **Team** tab in Settings using `useOrganization` from `@clerk/clerk-react`.
- Lists current members with roles; shows pending invitations with per-invite revoke button; invite form (email + role) via `organization.inviteMember()`. Admin/owner-only for invite/revoke actions.

### ⏳ Remaining (17 items)
P0-2 (Stripe keys), P1-8 (Klaviyo), P1-9 (Mailchimp), P1-14 (Shopify App Store), P2-14 (Zapier), P2-18 (custom domain), and 11 P3 items.

---

## 📅 June 4, 2026 — End of Day Summary

**30 of 54 tracker items completed today.** This was the largest single-day sprint on the project.
`main` is at `3773424`. Both repos (`Dw-Dwain` + `dwain-coder`) are in sync.
Migrations 0007–0010 all auto-apply via Render preDeploy + boot self-heal — no manual SQL needed.

### ✅ Completed today (30 total — 0 → 30)

**Observability & Email (activated)**
- **Sentry** — two projects live: API (`SENTRY_DSN` on Render) + Dashboard (`VITE_SENTRY_DSN` on CF Pages + CI). Dependency-free fetch-based client.
- **PostHog** — live via CDN (`VITE_POSTHOG_KEY`). No npm dep (sidesteps pnpm v11 lockfile issue).
- **Resend** — `scrollpop.online` domain verified in Resend, DNS auto-configured via Cloudflare. `RESEND_API_KEY` + `RESEND_FROM` set on Render. Transactional emails fire on: campaign activate/pause, 80%/95% view-cap, conversion milestones.

**Infrastructure**
- **WP plugin zip** — `scrollpop-wp.zip` uploaded to Cloudflare R2 (`scrollpop-assets`). Dashboard download link updated.
- **R2 snippet CDN** — `scrollpop-assets` bucket live. `p.js` uploaded; Worker serves from R2 with bundled fallback. `SNIPPET_CDN_URL` updated to `https://cdn.scrollpop.online`. CI auto-uploads on every snippet build via esbuild `onEnd` hook.
- **Render Pre-Deploy Command** — `pnpm --filter @scrollpop/api exec drizzle-kit migrate` set. Migrations now auto-apply on every deploy.
- **GitHub PATs rotated**.
- **`ADMIN_EMAIL`** — added to Render env vars (was missing, causing 403 on admin console).
- **CI snippet gate fixed** — `build.mjs` now collapses+syncs `p.txt` via esbuild `onEnd` on every build (watch + one-shot), preventing un-collapsed p.txt from being committed.

**Security (CTO-AUDIT Phase 4 + Phase 5 — all findings closed)**
| Finding | Fix |
|---|---|
| P0-1 | Webhook raw-body signature fix — Stripe + Clerk now verify against raw request bytes, not re-serialized JSON |
| P0-5 | Campaign activate/pause/delete busts KV edge cache immediately |
| P1-1/P1-3 | Cross-tenant event injection blocked; pageUrl origin validated against site domain (html/wordpress only, fails open) |
| P1-2 | Stripe checkout redirect URLs allowlisted to dashboard origins |
| P1-17 | `isSafeRegex` hardened vs alternation-based ReDoS + huge bounded reps + non-compiling patterns (+12 tests) |
| P2-1 | Strict `default-src 'none'` CSP on all API responses |
| P2-3 | Visitor country only trusted from Worker (proven by INTERNAL_SECRET) |
| P2-4 | `admin_audit_log` table (**migration 0007** + RLS + boot self-heal) |
| P2-19 | 30/min rate limit on admin console routes |
| P3-8 | Admin Clerk sync now paginates (was capped at 500) |
| P1-5, P2-5 | Found already implemented (Neon pool `max:10`, Shopify token AES-256-GCM encryption) |
Also: super-admin check hardened with fallback + diagnostic logging (admin 403 fix).

**Performance & Database**
- **P1-4** — Production config route: 4N DB queries per campaign → 4 total (batched `inArray`)
- **P1-6** — `campaignMetaCache` full-eviction thundering herd → oldest-entry LRU eviction
- **P2-7** — `events(tenant_id, ts DESC)` index (**migration 0008**) — analytics queries no longer do full chunk scans
- **P2-8** — Admin tenant list owner email: 2 queries per row → single JOIN
- **P2-11** — 30s `statement_timeout` on Neon pooled client
- **P2-9** — In-process purge job bounded (100 entities/pass), jittered start, split statements

**Features built**
- **P0-3 + P1-7** — Email lead capture: `leads` table (**migration 0009** + RLS + self-heal), server-side extraction from conversion-event `meta.email` (deduped per campaign), `/api/v1/leads` API (list/export/delete), dashboard **Leads** page (nav, campaign filter, pagination, CSV export, GDPR delete)
- **P0-4 + P1-10** — Real A/B testing: `variants` table (**migration 0010** + RLS + self-heal), variants CRUD + per-variant results API, config payload carries variants, snippet weighted **sticky-per-visitor** allocation (9218B — fit inline), dashboard **A/B panel** on Campaign Detail (create/weight/delete/results, edit via `?variant=`). Deceptive % slider removed.
- **P1-11** — Countdown timers: `countdown` element type fully implemented in snippet + builder. ISO datetime target or plain seconds. Live-ticking via `setInterval` after Shadow DOM mount.
- **P1-13** — Shopify App Embed Block confirmed already built (`packages/shopify-app-embed/`). Deploy via `npx shopify app deploy`.
- **P1-15** — Setup checklist on Dashboard: 4-step onboarding (connect site → install snippet → create campaign → launch). Auto-hides when complete.
- **P1-16** — Billing upgrade: graceful "coming soon" toast instead of raw 500 when Stripe not configured.
- **P2-15** — Journeys + Experiments pages: replaced broken placeholder UIs (dead API calls) with honest "coming soon" screens. Experiments now points users to the live A/B variant panel.
- **Template overhaul** — affiliate link wiring (Amazon/Rakuten CTAs now fall through to `slot.click_tracker_url`), `urgency` type fixed, 4 new hand-crafted templates (Dark Glass Affiliate, Luxury Brand Takeover, SaaS Minimal Lead Capture, Dark Exit Urgency), 3 new layout variants (product-card, testimonial, bold-type).

### ⏳ Remaining blockers (before charging customers)
- **P0-2 — Stripe** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, 4 price IDs. Only remaining P0.

### 📋 Open tracker items (24 remaining — see `PROJECT-TRACKER.md` for full list)
Notable P1s: P1-8 Klaviyo, P1-9 Mailchimp, P1-12 Gamified popups, P1-14 Shopify App Store, P1-18 API integration tests
Notable P2s: P2-10 CSV streaming, P2-12 Coupon auto-gen, P2-13 Email auto-responders, P2-14 Zapier, P2-16–P2-18 team/domain/agency

---

### 🔄 Session Log (chronological)

- **May 29 2026** — Production go-live: Render, Neon, Clerk, Upstash, Cloudflare Workers/Pages, Shopify app, domain `scrollpop.online`.
- **Jun 1 2026** — Account hierarchy (super-admin isolation, Novatise shared org), `user.deleted` webhook, dashboard CI deploy wired, `dwain-coder` sync enabled.
- **Jun 2 2026** — Production migration-drift outage fixed; KV edge cache live; analytics pipeline confirmed end-to-end; geo + UTM targeting; CORS; ESLint; security hardening; compliance audit (CMP1–5); DPA template drafted; Shopify rate-limit; snippet size fixed.
- **Jun 3 2026** — Campaign scheduling, deleted-data 24h-purge lifecycle, Playwright E2E suite, gamified popup types removed (~1.8 KB reclaimed), B5 resolved, dev/showcase content audit.
- **Jun 4 2026** — **Major sprint day. 0 → 30/54 items.** See "June 4 EOD Summary" above for full detail. Final `main` commit: `3773424`. All migrations 0007–0010 live. Snippet: 9546B gzipped.

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
│   ├── fly/              fly.toml (legacy location; the active config is fly.toml at repo root)
│   └── db/              Drizzle/SQL migration files (renamed from supabase/)
│
├── CLAUDE.md             AI coding rules for this project
├── MASTER.md             ← this file
└── package.json          pnpm workspace root
```

---

## 4. Tech Stack (Locked)

| Layer | Choice | Version | Hosted At |
|---|---|---|---|
| Runtime | Node.js LTS | 22 | Fly.io |
| Language | TypeScript | 5.x | — |
| Backend | Fastify | 5.x | Fly.io (`scrollpop-api`) |
| ORM | Drizzle ORM | 0.30.x | — |
| Database | PostgreSQL 17 | TimescaleDB ext | Fly.io (`scrollpop-db`) |
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
| API | https://scrollpop-api.fly.dev | Fly.io (`scrollpop-api`, shared-cpu-1x/512MB, `ord`) — Render decommissioned ✅ |
| Dashboard (app) | https://dashboard.scrollpop.online | Cloudflare Pages (`scrollpop-dashboard` project) |
| Dashboard (CF alias) | https://scrollpop-dashboard.pages.dev | Cloudflare Pages (auto alias) |
| Snippet CDN | **https://cdn.scrollpop.online** | Cloudflare Worker custom domain ✅ live |
| Edge / Config / Events | **https://edge.scrollpop.online** | Cloudflare Worker custom domain ✅ live |
| Postgres DB | scrollpop-db.flycast (internal) | Fly.io Postgres `scrollpop-db` (TimescaleDB 2.27.2, `ord`) — Neon decommissioned ✅ |
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
- [x] Cloudflare R2 bucket `scrollpop-assets` — **live** (Jun 4 2026). WP plugin zip hosted. Public r2.dev URL active. Snippet CDN (`cdn.scrollpop.online` custom domain + `p.js` upload) still TODO.
- [x] Cloudflare KV namespace `SCROLLPOP_CONFIG` — **bound & live** (id `00a5652f5e9d435bbd1ada64fe089088`, in the deploy account). Edge config cache, 60s TTL.
- [ ] Stripe account (test + live keys) — pending
- [x] Sentry — **live** (Jun 4 2026). Two projects: `scrollpop-api` (Node) + `scrollpop-dashboard` (React). `SENTRY_DSN` on Render, `VITE_SENTRY_DSN` on CF Pages + ci.yml.
- [x] PostHog — **live** (Jun 4 2026). `VITE_POSTHOG_KEY` on CF Pages + GitHub secrets. CDN-loaded, no npm dep.

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
| `SNIPPET_CDN_URL` | https://cdn.scrollpop.online ✅ updated Jun 4 2026 |
| `SENTRY_DSN` | ✅ Set (Jun 4 2026) |
| `RESEND_API_KEY` | ✅ Set (Jun 4 2026) |
| `RESEND_FROM` | `ScrollPop <notifications@scrollpop.online>` ✅ Set (Jun 4 2026) |
| `STRIPE_SECRET_KEY` | ❌ Not yet set |
| `STRIPE_WEBHOOK_SECRET` | ❌ Not yet set |

### Cloudflare Pages Environment Variables (Current)
| Key | Value |
|---|---|
| `VITE_API_URL` | https://scroll-pop.onrender.com |
| `VITE_CLERK_PUBLISHABLE_KEY` | pk_live_... (must match Render) |
| `VITE_SENTRY_DSN` | ✅ Set (Jun 4 2026) |
| `VITE_POSTHOG_KEY` | ✅ Set (Jun 4 2026) |

---

## 6. Database Schema

All tables use: UUID primary keys, `created_at / updated_at TIMESTAMPTZ`, soft-deletes via `deleted_at`.  
All tenant-scoped tables have RLS enabled, with **runtime tenant-predicate enforcement (FORCE RLS)** shipped June 11 — activated by `DB_RLS_ENFORCED=true` on Fly. See §RLS.

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
Path-based for web, handled in `main.tsx`. (The desktop Electron app was removed Jun 2026 —
ScrollPop is a sole hosted web app now.)

### Auth — single mode (Clerk)
There is exactly one runtime: the live Clerk-authenticated web app. Demo mode and the Electron
desktop app were both removed (Jun 2026), so there is no seeded-data showcase build and no
local-auth bypass anymore.

| Mode | How triggered | Token source |
|---|---|---|
| Web (Clerk) | always | `useAuth().getToken()` → Bearer JWT |

> Local development requires a real Clerk publishable key (`VITE_CLERK_PUBLISHABLE_KEY`, a
> `pk_test_…` key is fine) — there is no longer a keyless demo fallback. The backend still has its
> `NODE_ENV !== 'production'` dev tenant bypass for API calls against a local database.

### Data Provider
`apps/dashboard/src/providers/dataProvider.ts`
- `getApiBase()` → reads `VITE_API_URL` env var (the hosted API origin)
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

### Internal Secret (server-to-server only)
`INTERNAL_SECRET` is used **only** for server-to-server calls: the Cloudflare Worker authenticates
its config-cache-miss requests to `/api/v1/internal/*` and its event-IP-forwarding with the
`X-Internal-Secret` header (validated by `assertInternalSecret`). There is **no** `Authorization:
Bearer {INTERNAL_SECRET}` tenant-context bypass and **no** `/api/v1/auth/login` endpoint anymore —
both were removed with the desktop app (Jun 2026) to eliminate the tenant-impersonation surface.
All user-facing auth is Clerk JWT only.

### RLS
Two layers of tenant isolation (defence in depth):
1. **App layer (always on):** every API query filters by `request.tenantId` (derived server-side from the Clerk JWT). Verified consistent across all routes in the June 11 audit.
2. **DB layer (runtime-enforced, `DB_RLS_ENFORCED=true`, June 11):** tenant tables have `FORCE ROW LEVEL SECURITY` with policies keyed on `current_setting('app.current_tenant')`. Authenticated requests run on a reserved tenant-pool connection stamped with that GUC; system/unauthenticated paths (webhooks, `/e`, edge config, DDL, admin console, team invites) run on the system pool which sets `app.bypass_rls=on` at connect time. A query missing its tenant filter returns zero rows rather than leaking. Policy DDL lives in `apps/api/src/db/ensure-rls.ts` (idempotent boot self-heal) + migration `0014_real_rls`. Mechanism in `apps/api/src/db/client.ts` (two pools + `db` proxy + `beginTenantScope`). `users` and `admin_audit_log` are intentionally not RLS-scoped (global identity table; super-admin-only). To roll back: set `DB_RLS_ENFORCED=false` and run `0014_real_rls.down.sql`.

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
  ├── Deploy API → Fly.io production (flyctl deploy -a scrollpop-api)
  ├── Deploy Worker → Cloudflare (wrangler deploy)
  └── Deploy Dashboard → Cloudflare Pages (branch=main → dashboard.scrollpop.online)
```

### Environment Secrets (GitHub Actions — Dw-Dwain/Scroll-pop, single repo)
```
FLY_API_TOKEN                     Fly.io deploy token (flyctl deploy)
CLOUDFLARE_API_TOKEN              Worker + Pages deploy + KV purge + R2 upload
CLOUDFLARE_ACCOUNT_ID
VITE_API_URL                      Production API URL (baked into dashboard build)
VITE_CLERK_PUBLISHABLE_KEY        Same key for both envs
VITE_POSTHOG_KEY
VITE_STRIPE_PUBLISHABLE_KEY
```

### Single-repo deploy
All CI deploys (API → Fly, Worker → Cloudflare, Dashboard → Cloudflare Pages) run from
`Dw-Dwain/Scroll-pop` on push to `main`. The former `dwain-coder/Scroll-pop` mirror (used
only because Render's auto-deploy was wired to it) is retired — no longer synced.

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
API_BASE_URL=             https://scrollpop-api.fly.dev
DASHBOARD_URL=            https://<your-cf-pages-url>
SNIPPET_CDN_URL=          https://cdn.scrollpop.io
PORT=                     3001
NODE_ENV=                 production
INTERNAL_SECRET=          32+ char random string
SHOPIFY_ENCRYPTION_KEY=   32-byte base64 — REQUIRED in prod (encrypts Shopify tokens, ESP keys, webhook secrets at rest). Set on Fly ✅
DB_RLS_ENFORCED=          true — runtime row-level-security backstop (June 11). Set via `fly secrets set DB_RLS_ENFORCED=true -a scrollpop-api`
SENTRY_DSN=
```

### apps/dashboard (.env)
```
VITE_API_URL=             https://scrollpop-api.fly.dev
VITE_CLERK_PUBLISHABLE_KEY=  (required — no keyless demo mode)
VITE_POSTHOG_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
```
> Note: never set a `VITE_INTERNAL_SECRET` or `VITE_DEMO_MODE` for the dashboard — `VITE_*` vars
> are baked into the public browser bundle, and demo mode no longer exists. The internal secret is
> a server-only value.

### apps/worker (wrangler.toml secrets)
```
API_ORIGIN=               https://scrollpop-api.fly.dev
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

### ❌ Not Built Yet

#### Billing & Limits
- **Stripe billing** — needs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, 4 price IDs; checkout UI is wired but inactive
- **Stripe Usage Records** — monthly view counts not reported to Stripe; overage billing doesn't work
- **Real-time view cap enforcement** fully wired but requires `REDIS_URL`/`REDIS_TOKEN` set as Worker secrets — without them the edge check no-ops

#### Infrastructure
- **`api.scrollpop.online` custom domain** — API still at `scroll-pop.onrender.com`
- ✅ **R2 snippet CDN** — `scrollpop-assets` bucket live; `p.js` uploaded; Worker serves from R2 with bundled fallback; CI auto-uploads on every snippet build; `SNIPPET_CDN_URL` on Render updated to `https://cdn.scrollpop.online` — Jun 4 2026
- **Render Pre-Deploy Command** — set to `pnpm --filter @scrollpop/api exec drizzle-kit migrate` to auto-apply migrations on deploy

#### Shopify
- **Shopify App Embed Block** — replace Script Tag with proper App Embed (no theme code edits, better performance)
- **Shopify App Store submission** — requires App Embed Block first

#### Campaigns & Features
- ⏸ **A/B percentage gate stubbed** — `ab_test` targeting is a passthrough (`return true`) in the snippet; real allocation is a v2 build (supersedes the simple % slider anyway)
- **Affiliate slot click tracking postback** — client-side only; no server-side postback
- **Conversion event API** — no external postback endpoint for merchant sites
- **Teaser + success step WYSIWYG** — snippet uses built-in layout for those two steps; only the main step is fully WYSIWYG
- **Affiliate-network links backend** — Settings UI exists (localStorage); needs backend persistence + auto-wire into affiliate slot URLs
- **Actions step** — post-submit redirect, confetti, Mailchimp/Klaviyo, follow-up email; removed from wizard, revisit when integrations built
- **Webhook outbound** — fire HTTP callbacks to operator URLs on conversion events

#### Account & Admin
- **Team invitations UI** — Clerk org invitations exist but no dashboard wrapper
- **Bulk campaign operations**
- **API key management** — no backend route to rotate/create keys
- **Account/org deletion backend**
- **Admin impersonation** — no support tool to act as a tenant

#### Analytics & Compliance
- **Account-wide data export (GDPR)**
- **Analytics reset endpoint** — events are immutable append-only by design
- **GoFundMe / Donorbox** platform-specific setup guides

#### Marketing
- **`scrollpop.online` marketing site** — separate Cloudflare Pages site; not yet built

---

## 23. v2 Roadmap

Items remaining (completed ones moved to §22 done list above):

1. **Stripe** — activate billing: `STRIPE_SECRET_KEY` + webhook secret + 4 price IDs. Checkout UI already wired.
2. **Stripe Usage Records** — flush monthly view counts to Stripe Usage API so overages are billed.
3. **`api.scrollpop.online` custom domain** — Cloudflare proxied to Render. Cleaner URL, HTTPS everywhere.
4. **Affiliate-network links backend** — persist Settings → Affiliate Networks to DB (`tenants` columns migration); auto-wire affiliate tags into slot URLs so they flow through to live ads.
5. **Shopify App Embed Block** — replace Script Tag with proper App Embed (no theme code edits, better performance).
6. **Shopify App Store submission** — after App Embed Block is live.
7. **Team invitations UI** — wrap Clerk organisation invitations in the Settings page.
8. **`scrollpop.online` marketing site** — separate Cloudflare Pages project.
9. **A/B testing (real)** — proper variant allocation + Bayesian significance; supersedes the stubbed % gate in the snippet.

---

## 24. v3 Roadmap

Longer-horizon features (none started):

- **ClickHouse migration** — at >50M events/month, migrate analytics writes from TimescaleDB to ClickHouse for OLAP performance.
- **Real-time social-proof popups** — "X people bought this in the last hour" overlays. Requires a pub/sub mechanism.
- **AI copy generation** — GPT-4o integration in the campaign wizard to suggest headlines based on site URL / product description.
- **SAML SSO** — enterprise orgs. Clerk supports SAML — just needs exposing in the UI.
- **Native iOS / Android SDKs** — in-app popup SDK for mobile apps.
- **Full white-labelling** — custom domain + custom branding for agency plans.
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
attorney review of all legal docs.

**DPA template drafted (Jun 2 2026):** `legal/DPA-TEMPLATE.md` — a standard SaaS
processor DPA (roles, sub-processors, SCCs, breach notice, TOMs, annexes) for sending
to customers who request one ("available on request" is already stated on the site +
dashboard privacy pages). **Engineering draft — needs attorney review before use;**
all `[BRACKETED]` fields must be filled.
✅ **Security-page accuracy reconciled (Jun 2 2026):** `LegalView.tsx` corrected —
"EU data stays in EU regions (Frankfurt)" → accurate "hosted in Asia-Pacific
(Singapore); transfers covered by SCCs"; "Neon/Supabase" → "Neon" (Supabase not used
in prod); "deployed on Fly.io" → "deployed on Render" (Fly unused). Now consistent
with the actual stack + the sub-processor list + the DPA template.

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

### Deleted-data lifecycle (Jun 3 2026)
Deleted campaigns/sites used to keep showing their events in analytics/dashboard forever
(events are append-only; queries weren't filtered). Now: **24h download window → purge.**
- On delete (soft-delete as before), the campaign's analytics events stay **downloadable
  for 24h** via `GET /api/v1/campaigns/:id/export` (CSV; works for soft-deleted campaigns).
  Dashboard: Campaigns → ⋯ → "Download data"; the delete confirm explains the window.
- `apps/api/src/db/purge-deleted.ts` runs in-process (hourly, ~30s after boot — no external
  cron) and **hard-deletes events** for campaigns/sites soft-deleted >24h ago, so they drop
  out of analytics. Config rows stay soft-deleted (recoverable). This is the deliberate,
  user-approved exception to the no-hard-delete rule — scoped to analytics events only.
- Authed file downloads use `authedFetch()` from the data provider (works in Clerk/demo/
  desktop modes without `useAuth`).

### Active Bugs
| # | Severity | Description | Location |
|---|---|---|---|
| B1 | ✅ Resolved (Jun 3 2026) | View cap now enforced at the **edge on every config request**. The API config payload carries internal `tenantId` + `monthlyViewLimit`; the Worker reads the live `sp_views:{tenant}:{month}` counter from Upstash REST and empties `campaigns` when over limit, then **strips** those internal fields before responding. Closes the up-to-60s overage window of the old cache-miss-only check (which remains as defence-in-depth). **Fails OPEN** if the Worker can't reach Redis. ⚠️ Requires `REDIS_URL`/`REDIS_TOKEN` set as Worker secrets (see `wrangler.toml`) — without them the edge check no-ops and only the API cache-miss check applies. | `apps/worker/src/index.ts` |
| B2 | High | Stripe usage records not synced — overage billing doesn't work | `apps/api/src/routes/billing.ts` |
| B3 | ✅ Resolved (Jun 4 2026) — personal + Novatise tenant lookups now filter `isNull(deletedAt)` and **revive on conflict** (a soft-deleted tenant is restored on the owner's next sign-in instead of dangling or 500-ing on the unique `clerkOrgId` constraint). | `apps/api/src/plugins/tenant-context.ts` |
| B4 | ✅ Resolved (Jun 4 2026) — the live event path is Worker `/e` → API `/e` (not the Redis queue). Added a 1-retry + backoff to the Worker's `forwardEventsToApi` (each attempt 10s timeout; 4xx = no retry); a transient origin blip no longer silently loses a batch. | `apps/worker/src/index.ts` |
| B5 | ✅ Resolved (Jun 3 2026) — `devUrl` in Sites.tsx now defaults to empty (operator pastes their own tunnel URL) instead of a hardcoded personal loca.lt URL | `apps/dashboard/src/pages/Sites.tsx` |

### Dev/showcase content audit (Jun 3 2026)
Swept the dashboard for dev/demo content that could surface on the live app. Resolved:
Profile now shows the real Clerk identity (not the "Dev Admin" persona); Layout nav email
fallback removed; **demo mode can no longer auto-engage in a production build** (§10);
**UI-kit showcase pages** (`/calendar /gallery /chat /messages /forms /tables`, hardcoded
sample data) removed from the production (Clerk) router — they were URL-reachable though
not in the nav; kept in demo mode only. Remaining cosmetic (not data leaks): template-card
seed view/conversion numbers, and the "Test webhook" button's placeholder HMAC signature.
| B6 | Low | `Experiments` and `Journeys` pages show placeholder content — routes exist but features not functional | Dashboard |

### Tech Debt
| # | Description | File |
|---|---|---|
| T1 | ✅ Resolved (Jun 4 2026) — Sentry wired **dependency-free** (no `@sentry/node`, avoids lockfile/CI drift): API reports via a `fetch`-based envelope client (`apps/api/src/lib/sentry.ts`, hooked into the error handler + `uncaughtException`/`unhandledRejection`); dashboard loads the Sentry CDN loader. Both DORMANT until `SENTRY_DSN` / `VITE_SENTRY_DSN` are set. | API + Dashboard |
| T2 | ✅ Resolved (Jun 4 2026) — PostHog loaded from CDN (`array.js` via the `_i` queue) in `apps/dashboard/src/lib/observability.ts`, gated on `VITE_POSTHOG_KEY` (+ optional `VITE_POSTHOG_HOST`). No npm dep (sidesteps the pnpm v11 block that removed `posthog-js`). | `apps/dashboard/src/lib/observability.ts` |
| T3 | `any` types in several Dashboard components (`Sites.tsx`, `CampaignDetail.tsx`) — should be typed to schema types. Now surfaced as ESLint warnings (`no-explicit-any`) — clean up incrementally | Dashboard pages |
| T-ESLint | ✅ Resolved (Jun 2 2026) — ESLint flat config added to dashboard (`apps/dashboard/eslint.config.js`). Real bugs (rules-of-hooks, no-debugger, no-dupe-keys) are errors; pre-existing style/`any`/legacy patterns are warnings so CI stays green (currently 0 errors / 428 warnings). `lint` script wired into CI. | `apps/dashboard` |
| T4 | ✅ Resolved (Jun 3 2026) — Playwright E2E suite added (`e2e/`, 15 tests: dashboard demo + marketing site + snippet runtime). Non-gating CI job. | `e2e/` |
| T5 | `apps/worker` event flush is a TODO in the Worker; events are currently only flushed by the API's `/e` local endpoint | `apps/worker/src/index.ts` |
| T6 | Marketing site (`scrollpop.io`) does not exist | — |
| T7 | `api.scrollpop.io` custom domain not yet configured | Cloudflare DNS |
| T8 | ✅ Resolved (Jun 4 2026) — `scrollpop-wp.zip` built and uploaded to Cloudflare R2 bucket `scrollpop-assets` (public r2.dev URL). `pluginDownloadUrl` in `Sites.tsx` updated to `https://pub-0a090ba944ba46269b65a6cfbb0ed1f0.r2.dev/scrollpop-wp.zip`. Next: connect `cdn.scrollpop.online` custom domain to the bucket when R2 CDN is fully set up. | `apps/dashboard/src/pages/Sites.tsx` |
| T9 | ✅ Resolved (Jun 2 2026) — Shopify OAuth callback rate limited to 20/min per IP via per-route `@fastify/rate-limit` config | `apps/api/src/routes/shopify.ts` |
| T10 | `weight` field on affiliate slots is in schema but no UI exposes it. Part of the in-progress **Affiliate ad templates (#9)** work — see §23. | Dashboard |

### Affiliate ad templates (#9) — in progress (Jun 3 2026)
**Foundation shipped:** `AffiliateSlotSchema` (shared) + snippet `AffiliateSlot` now have
optional `price` and `short_description` (JSONB — no migration). **Remaining sub-tasks**
(deferred to a fresh session): product-card popup template in the gallery; a reusable
"product card" builder block bound to slot fields; snippet rendering of the card
(image/name/price/short-desc/CTA); and a multi-slot **weight editor** UI (slots are
currently created one-at-a-time by the wizard with `weight:100`).
⏸ **Affiliate-network auto-pull (deferred v2/v3):** auto-populating product image/name/
price from Amazon PA-API / Rakuten product APIs is a separate integration — each needs the
operator's own approved API credentials + per-network approval + rate-limit handling. The
stored affiliate "keys" today are link-tagging IDs, NOT product-API access. Auto-pull would
fill the same `price`/`short_description`/`image_url` fields the foundation adds. The lighter
page-scrape path (`detectSmartProduct`) already exists for host-page product schema.

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

### Pre-Deploy Command Failed (Migration Failure)

Render runs `pnpm --filter @scrollpop/api exec drizzle-kit migrate` before every deploy.
If it fails, the deploy is aborted and the API stays on the previous version — **no data is
lost and no bad code reaches production.**

**Diagnosis steps:**
1. Open the Render deploy log and find the migration error message.
2. Connect to the prod DB directly (`psql $DIRECT_DATABASE_URL`) and check which migrations
   have been applied: `SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC;`
3. If the failing migration is idempotent (uses `IF NOT EXISTS`, `DO $$ … EXCEPTION … END $$`)
   run it manually via `psql $DIRECT_DATABASE_URL -f apps/api/drizzle/migrations/000X_name.sql`.
4. Re-trigger the deploy from the Render dashboard.

**Rollback procedure** (if a bad migration already ran):
1. Run the corresponding `.down.sql` file: `psql $DIRECT_DATABASE_URL -f apps/api/drizzle/migrations/000X_name.down.sql`
2. Revert the code commit that introduced the migration.
3. Re-deploy.

> **Never** run `drizzle-kit push` against the production database — it is not idempotent and
> may drop columns. Always use the numbered migration files.

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
3. Redeploy API
4. Update Worker secret: `wrangler secret put INTERNAL_SECRET`

Both must match — the Worker sends it as `X-Internal-Secret` and the API validates it. It is a
server-only secret; it is never shipped to any browser bundle.

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
- [ ] **Stripe** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, 4 price IDs → billing UI goes live
- [x] **R2 snippet CDN** — `p.js` in `scrollpop-assets`, Worker serves from R2, `SNIPPET_CDN_URL` = `https://cdn.scrollpop.online` — Jun 4 2026
- [ ] **`api.scrollpop.online`** custom domain (Cloudflare DNS → Render)
- [ ] **Render Pre-Deploy Command** — auto-apply DB migrations (prevents migration-drift outage from recurring — see §25)

### What's Done (from the original pending list)
- [x] Cloudflare KV namespace `SCROLLPOP_CONFIG` bound — live, 60s TTL
- [x] Sentry — both projects live (`SENTRY_DSN` + `VITE_SENTRY_DSN`) — Jun 4 2026
- [x] PostHog — live (`VITE_POSTHOG_KEY`) — Jun 4 2026
- [x] Resend — domain verified, `RESEND_API_KEY` + `RESEND_FROM` set — Jun 4 2026
- [x] R2 bucket `scrollpop-assets` created — WP plugin zip hosted, dashboard URL updated — Jun 4 2026

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
`isAdmin` in `usePlan.ts` previously fell back to `detectAdminLocal()` which checked
`localStorage.desktop_user` — any user with `{role: 'admin'}` in localStorage could reach the
admin console UI. Fixed in stages: first `isAdmin` was made to require the `/me` API confirming
the admin email; then (Jun 2026, with the desktop app removal) `detectAdminLocal()` was reduced
to `return false` — there is no client-side admin path at all now. The server additionally
requires a **verified** Clerk primary email matching `ADMIN_EMAIL` for any `/admin/*` route.



### Admin Clerk sync
`POST /admin/sync` + `DELETE /admin/tenants/:id` added. Refresh button in admin panel
now calls sync first (cleans stale Clerk-deleted users) then refetches. staleTime = 0.

---

## Session Log — June 3–4, 2026

Theme: pre-launch hardening — observability, transactional email, and bug fixes, all shipped
**dependency-free** (no new npm packages, so the pnpm lockfile / `--frozen-lockfile` CI stay
intact) and **dormant until keys are set** (nothing breaks before configuration).

### Observability & email (env-gated, dormant)
- **Sentry — API** (`apps/api/src/lib/sentry.ts`, new): a `fetch`-based Sentry *envelope* client
  (no `@sentry/node`). Parses `SENTRY_DSN`; reports from the global error handler (500-class only —
  4xx/validation excluded) and from `uncaughtException` / `unhandledRejection`. No-op without DSN.
- **Sentry — dashboard** (`apps/dashboard/src/lib/observability.ts`, new): loads the Sentry CDN
  loader, deriving the loader URL's public key from `VITE_SENTRY_DSN`; sets `window.sentryOnLoad`
  to `init` with `tracesSampleRate:0` (free error-only tier). No-op without DSN.
- **PostHog — dashboard** (same file): loads `array.js` from the region asset host via the official
  `_i` queue, gated on `VITE_POSTHOG_KEY` (+ optional `VITE_POSTHOG_HOST`, default US). No npm dep
  (sidesteps the pnpm v11 block that forced `posthog-js` out earlier).
- `initObservability()` is called once in `main.tsx` before render.
- **CSP** (`apps/dashboard/public/_headers`): added `js.sentry-cdn.com` (script-src) and
  `*.sentry.io` (connect-src) to the report-only policy so promotion to enforcing won't break it.
  PostHog (`*.posthog.com`) was already allowlisted.
- **Resend email** (`apps/api/src/lib/email.ts`, new): `fetch`-based Resend client (no `resend`
  npm dep). `emitNotification` now fans out to email alongside in-app — resolves the tenant
  **owner's** email, honors the per-type pref + a new `notif_channels_email` channel toggle, and
  is DORMANT until `RESEND_API_KEY` + `RESEND_FROM` (a Resend-verified sender) are set. Covers the
  existing emitters: campaign status, 80%/95% view-cap, conversion milestones.

### Bug fixes
- **B3** (`tenant-context.ts`): the personal + Novatise tenant lookups now filter
  `isNull(deletedAt)` and **revive on conflict** (`onConflictDoUpdate` clearing `deletedAt`), so a
  soft-deleted tenant is restored on the owner's next sign-in instead of dangling or 500-ing on the
  unique `clerkOrgId` constraint. (The org-path already filtered `deletedAt`.)
- **B4** (`apps/worker/src/index.ts`): clarified that the live event path is Worker `/e` → API
  `/e` (the Redis `sp_events` queue in older docs is not the live path), so the real loss point was
  `forwardEventsToApi`. Added **1 retry + 500 ms backoff** (each attempt keeps its 10 s timeout;
  a 4xx is permanent → no retry). A transient origin blip (e.g. a redeploy) no longer silently
  drops an event batch.

### Features
- **Campaign duplication**: `POST /api/v1/campaigns/:id/duplicate` (tenant-scoped) clones the
  campaign + design + triggers + targeting + frequency as a new **draft** (events/analytics not
  copied). Dashboard: Campaigns card → ⋯ → **Duplicate** (Refine `useCreate`, refetches on success).
- **WordPress plugin `.zip`**: build artifact produced at `packages/wp-plugin/dist/scrollpop-wp.zip`
  (folder `scrollpop/` at the zip root → extracts to `wp-content/plugins/scrollpop`). **Still needs
  uploading** to the GitHub release asset / R2 path the dashboard links to (T8).

### Marketing / compliance
- **CMP2/CMP3**: softened the last absolute "Google-compliant" claim (footer → "triggers that avoid
  the popup tricks Google penalizes"). The compare table + FAQ were already qualified in a prior pass.

### Deferred (consciously, not forgotten)
- **Affiliate multi-slot weight editor (#9)**: needs a slot-management UI that doesn't exist yet
  (the wizard creates a single slot at `weight:100`). It's the larger #9 build (product-card
  template + builder block + snippet render under the 10 KB gzip gate + weight UI), not a quick add.
  Schema foundation (`weight` / `price` / `short_description`) is already in `AffiliateSlotSchema`.

### Verification & deploy
- Local gates green: `lint` (0 errors / 427 warnings baseline), `typecheck` (all packages),
  `test` (all suites). No snippet changes → size/no-history gates unaffected.
- Merged to `main` and synced **both** repos (`Dw-Dwain` → CF Worker + Pages; `dwain-coder` →
  Render API) at commit `3808519`.

### Manual follow-ups (owner)
- Paste keys to activate: `SENTRY_DSN` (Render) + `VITE_SENTRY_DSN` (CF Pages/CI); `VITE_POSTHOG_KEY`
  (+ `VITE_POSTHOG_HOST` if EU); `RESEND_API_KEY` + `RESEND_FROM` (Render, after verifying the
  `scrollpop.online` sender domain in Resend). `VITE_*` vars bake at build → redeploy after setting.
  **Detailed step-by-step in the section below.**
- Upload `scrollpop-wp.zip` to the release/R2 path (T8).
- **Rotate the GitHub PATs** embedded in the git remote URLs (single-use per CONTRIBUTING):
  https://github.com/settings/tokens

---

## Observability & Email — Activation Reference ✅ Live since June 4, 2026

> **Status:** All three services are fully active. Keys set in Render + CF Pages.
> This section is kept as a reference for future key rotation or new environment setup.
> Do these steps, then redeploy. All three are on free tiers — **no new spend.**

### 1. Sentry (TWO projects — one for the backend, one for the dashboard)

Sentry separates errors by project, so create one of each platform.

**A. Backend (Node) project → `SENTRY_DSN` on Render**
1. Sentry → **Create Project** → platform **Node.js** → name e.g. `scrollpop-api`.
2. **Settings → Client Keys (DSN)** → copy the **DSN**
   (looks like `https://<publicKey>@o<org>.ingest.sentry.io/<projectId>`).
3. Render → service `scroll-pop` → **Environment** → add:
   - `SENTRY_DSN=<the DSN>`
4. Save → Render redeploys. On boot the API logs `[sentry] error reporting enabled`.
   - Implementation: dependency-free `fetch` envelope client (`apps/api/src/lib/sentry.ts`),
     reports 500-class request errors + `uncaughtException` / `unhandledRejection`.

**B. Dashboard (React) project → `VITE_SENTRY_DSN`**
1. Sentry → **Create Project** → platform **React** (or Browser JavaScript) → name e.g. `scrollpop-dashboard`.
2. Copy that project's **DSN** (different from the API's).
3. Set `VITE_SENTRY_DSN=<dsn>` wherever the other `VITE_*` vars live:
   - **Cloudflare Pages** → `scrollpop-dashboard` → Settings → Environment variables (Production), AND
   - the **`deploy-dashboard` job** in `.github/workflows/ci.yml` if that builds prod
     (it's a publishable value — safe to hardcode there alongside `VITE_API_URL`).
4. **Redeploy** the dashboard (Deployments → Retry) — `VITE_*` vars are baked at build time.
   - Implementation: loads the Sentry CDN loader, deriving the loader key from the DSN
     (`apps/dashboard/src/lib/observability.ts`), `tracesSampleRate:0` (free error-only tier).

### 2. PostHog (dashboard product analytics)

1. PostHog → **Project Settings** → copy the **Project API Key** (`phc_…`) and note your region
   (US vs EU).
2. Set the `VITE_*` vars alongside the others (Cloudflare Pages + `ci.yml` as above):
   - `VITE_POSTHOG_KEY=<phc_…>`
   - `VITE_POSTHOG_HOST=https://eu.i.posthog.com` **only if** your project is EU
     (default is US, `https://us.i.posthog.com` — can be omitted).
3. **Redeploy** the dashboard (VITE vars bake at build time).
   - Implementation: loads `array.js` from the region asset host via the official `_i` queue
     (`apps/dashboard/src/lib/observability.ts`) — no npm dependency.

### 3. Resend (transactional email for notifications)

1. Resend → **Domains → Add domain** → `scrollpop.online`.
2. Add the **DKIM / SPF (and any Return-Path) records** Resend shows you into **Cloudflare DNS**
   for `scrollpop.online` → wait until Resend marks the domain **Verified**.
   - ⚠️ These are DNS-only records; do not proxy them.
3. Resend → **API Keys → Create** → copy the key.
4. Render → service `scroll-pop` → **Environment** → add:
   - `RESEND_API_KEY=<key>`
   - `RESEND_FROM=ScrollPop <notifications@scrollpop.online>`
     (the sender address MUST be on the verified domain).
5. Save → Render redeploys. Email then flows automatically for the wired emitters
   (campaign status, 80%/95% view-cap, conversion milestones).
   - Operators can toggle email per-account in **Settings → Notifications**
     (the `notif_channels_email` preference); per-type toggles also apply.
   - Implementation: dependency-free `fetch` client (`apps/api/src/lib/email.ts`); `emitNotification`
     resolves the tenant **owner's** email and sends best-effort alongside the in-app notification.

### Verify after setup
- Sentry (API): trigger any 500 and confirm an issue appears in the Node project.
- Sentry (dashboard): throw a test error in the console and confirm it lands in the React project.
- PostHog: load the dashboard → confirm a pageview event appears in PostHog Live Events.
- Resend: trigger a campaign activate/pause → confirm the owner receives an email and it shows in
  Resend → Emails.

---

*This document is the single source of truth for the ScrollPop platform. Update it whenever architecture changes, new tables are added, or v2 items are completed.*
