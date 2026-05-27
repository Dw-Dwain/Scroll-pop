# ScrollPop — Session Handoff

## What This App Is
Multi-tenant SaaS popup/overlay platform. Operators build scroll-triggered popup campaigns
through an admin dashboard. A lightweight JS snippet (~10 KB gzipped) runs on customer sites
(WordPress, Shopify, raw HTML) and renders popups in a Shadow DOM.

**Monorepo:** `apps/dashboard` (React 19 + Vite), `apps/api` (Fastify 5 + Postgres),
`apps/desktop` (Electron), `packages/snippet` (vanilla TS browser snippet).

**Dev stack:** pnpm workspaces + Turborepo. Dashboard at `localhost:5173`, API at `localhost:3001`.
API proxied via Vite (`/api` → `localhost:3001`). No `.env` in dashboard = auto demo mode (no Clerk).

**Design system:** "Vercel meets Linear" zinc dark. CSS custom properties only (`var(--bg-surface)` etc.).
No Tailwind dark: classes, no glassmorphism, no backdrop-filter, no gradient blobs.

---

## What Was Done This Session

### LivePreview.tsx (`apps/dashboard/src/components/campaign-wizard/LivePreview.tsx`)
Full rewrite. Desktop and mobile toggle now works:
- Desktop: full-width viewport with fake page skeleton at 15% opacity, popup positioned absolutely
- Mobile: 320×560 phone frame scaled to `0.6` via CSS transform, zinc border, notch
- `PopupPreview` sub-component handles all popup kinds: modal, bar, fullscreen, slide_in, floating_bubble

### TemplateSelector.tsx (`apps/dashboard/src/components/campaign-wizard/TemplateSelector.tsx`)
- Added `previewTemplate` state + `templateToFormData()` helper
- Preview button now opens a full modal overlay with `LivePreview` (desktop/mobile toggle inside)
- Modal has close button (X), template name/category header, "Use This Template" CTA

### CampaignWizard.tsx (`apps/dashboard/src/pages/CampaignWizard.tsx`)
Full rebuild from Tailwind glassmorphism to CSS variables:
- Step dots: filled=complete, outlined+glow=current, dim=future
- Steps 1–2: centered, maxWidth 640
- Steps 3–5: 2-col grid with sticky LivePreview on right
- Sticky bottom nav bar

### Settings.tsx (`apps/dashboard/src/pages/Settings.tsx`)
**API Keys tab:** Loads real site `publicKey`s from `useList({ resource: 'sites' })`.
Displays per-site keys with copy buttons. No more random stubs.

**Integrations tab:** Complete rebuild for plugin developers:
- Site selector at top — all code snippets auto-populate with the correct public key
- **WordPress:** `functions.php` PHP snippet (with `esc_js`) + Insert Headers & Footers variant
- **Shopify:** `layout/theme.liquid` edit + full App Embed Block (`sections/scrollpop-embed.liquid` with schema)
- **HTML/Generic:** plain `<script>` snippet for any platform
- All code blocks have copy buttons
- "Connected Services" grid (Stripe, Clerk, Cloudflare, etc.) at bottom

### Other pages rebuilt earlier (all use CSS variables, no Tailwind dark:)
`Layout.tsx`, `Dashboard.tsx`, `Analytics.tsx`, `Sites.tsx`, `Billing.tsx`,
`SignIn.tsx`, `SignUp.tsx`, `OpsCenter.tsx`, `Journeys.tsx`, `Experiments.tsx`,
`Campaigns.tsx`, `AdminPanel.tsx`, `CampaignDetail.tsx`, `CampaignDesign.tsx`, `Profile.tsx`

---

## Session 2 — What Was Done

### LivePreview.tsx (full rewrite)
- Desktop view: proper MacBook laptop frame — screen lid (zinc border), browser chrome (traffic lights + URL bar + tab stubs), fake page skeleton behind popup
- Mobile view: unchanged (320×560 phone frame, scale 0.6)
- `FakePageSkeleton` component: nav bar + hero + text lines + card row (shared desktop/mobile)
- `gamified_overlay` kind: renders a real SVG 8-segment spin wheel with prizes + SPIN TO WIN button
- Countdown timer support: if `formData.countdownEnabled` is truthy, shows HH:MM:SS blocks in both gamified and standard popup

### TemplateSelector.tsx (rewrite — card flip replaces modal)
- Clicking "Preview" on a card triggers a 3D CSS flip (`rotateY(180deg)`) + scale(1.35) — bigger than card, not fullscreen
- Back face: compact preview viewport (`CompactPreview`) showing the popup overlaid on a fake page, plus "Use Template" CTA
- `CompactPreview` handles all kinds including gamified (mini spin wheel via `GamifiedCompact`)
- Click-away area (`position: fixed, inset: 0, z-index: 40`) dismisses the flip
- Other cards dim to 35% opacity while one is flipped
- Removed modal JSX entirely

### analytics.ts (API — `/analytics/daily`)
- New endpoint: `GET /api/v1/analytics/daily`
- Returns 60-day per-day breakdown: `{ day, impressions, views, clicks, conversions }`
- Used for real sparklines, real delta %, real area chart

### Dashboard.tsx
- Calls `/analytics/daily`, splits into `curr30` and `prev30`
- Real delta %: `pctDelta(curr, prev)` — shows `—` when no prior data, not hardcoded +12.4%
- Real sparklines: last 14 days of actual data per metric
- `EventsAreaChart`: uses real daily array, real date labels (x-axis every 7 days), "No data yet" empty state
- `KpiCard`: handles `'—'` delta without showing trend arrows

## Pages Not Yet Restyled (low priority, not in main nav)
`ImageGallery`, `CalendarPage`, `TablesPage`, `FormsPage`, `MessagesPage`,
`StatisticsPage`, `SupportChat`, `UIElements`

## Deeper Rebuilds Pending
`DesignControls.tsx` — some old Tailwind classes remain but compiles fine
`RulesBuilder.tsx`, `Scheduler.tsx` — functional, not yet restyled

---

## Dev Environment
```
# Start API (needs Docker running with scrollpop_db + scrollpop_redis)
cd apps/api && pnpm dev

# Start dashboard
cd apps/dashboard && pnpm dev

# Or from root
pnpm --filter api dev
pnpm --filter dashboard dev
```

**Docker:** `docker start scrollpop_db scrollpop_redis`
**API port conflict:** `taskkill //PID <pid> //F` if port 3001 is taken

## Git Workflow
Dev version: `C:\Users\dwain\Downloads\scrollpop-scaffold\New folder\scrollpop-dev`
Live version: `C:\Users\dwain\OneDrive\Documents\scrollpop-scaffold` (do NOT push until user approves)
