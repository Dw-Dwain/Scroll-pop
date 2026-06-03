# ScrollPop — Product Design Specification
**Version 2.0 | For Google Stitch / AI-assisted build**

---

## 0. Design Philosophy

ScrollPop is a precision tool for operators who care about conversion metrics. The design should feel like **Vercel meets Linear** — dark, dense, intentional. Not a candy-colored SaaS website, not a purple-gradient AI product. Every surface earns its weight.

**Three words:** Calm. Sharp. Data-first.

**Anti-patterns to avoid:**
- Gradient blobs as decoration
- Pill-shaped everything
- Oversized hero copy
- Animations that delay information
- Emoji as design elements
- Cards with too much padding and too little content

---

## 1. Color System

### Base Palette

```css
/* Backgrounds — layered depth */
--bg-root:    #09090b;   /* zinc-950 — page root */
--bg-base:    #111113;   /* slightly lighter than root */
--bg-surface: #18181b;   /* zinc-900 — card/panel surface */
--bg-raised:  #27272a;   /* zinc-800 — elevated elements */
--bg-overlay: #3f3f46;   /* zinc-700 — hover states, dividers */

/* Borders */
--border-subtle:  #27272a;  /* default border */
--border-default: #3f3f46;  /* focus/active border */
--border-strong:  #71717a;  /* high-contrast border */

/* Text */
--text-primary:   #fafafa;  /* zinc-50 */
--text-secondary: #a1a1aa;  /* zinc-400 */
--text-muted:     #71717a;  /* zinc-500 */
--text-disabled:  #52525b;  /* zinc-600 */

/* Accent — Indigo (primary action) */
--accent-100: #e0e7ff;
--accent-300: #a5b4fc;
--accent-500: #6366f1;  /* primary */
--accent-600: #4f46e5;  /* hover */
--accent-700: #4338ca;  /* active/pressed */
--accent-glow: rgba(99, 102, 241, 0.2);

/* Status colors */
--status-success: #22c55e;   /* green-500 */
--status-warning: #f59e0b;   /* amber-500 */
--status-error:   #ef4444;   /* red-500 */
--status-info:    #3b82f6;   /* blue-500 */

/* Data visualization */
--data-1: #6366f1;   /* indigo — primary metric */
--data-2: #22d3ee;   /* cyan — secondary metric */
--data-3: #f59e0b;   /* amber — conversions */
--data-4: #a78bfa;   /* violet — experiments */
--data-5: #34d399;   /* emerald — revenue */
```

### Usage Rules
- Root background is **always** `--bg-root`. Never use pure `#000`.
- Cards sit on `--bg-surface`. Modals/drawers sit on `--bg-raised`.
- Only one accent color per screen — `--accent-500`. Secondary metrics use `--data-2`.
- Status colors appear only in badges, toasts, and inline feedback. Never as decoration.
- No gradients on UI chrome. Gradients are reserved for charts and the loading bar.

---

## 2. Typography

### Font Stack

```css
--font-sans: 'Inter', 'Geist', system-ui, -apple-system, sans-serif;
--font-mono: 'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace;
```

**Inter** at weight 400/500/600. No bold headlines. Tightness comes from scale and contrast, not weight.

### Type Scale

| Token | Size | Line-height | Weight | Use |
|---|---|---|---|---|
| `--text-xs` | 11px | 16px | 400 | Labels, timestamps, badges |
| `--text-sm` | 13px | 20px | 400 | Body, table rows, descriptions |
| `--text-base` | 15px | 24px | 400 | Primary body copy |
| `--text-md` | 17px | 26px | 500 | Section headers, card titles |
| `--text-lg` | 20px | 28px | 500 | Page titles |
| `--text-xl` | 24px | 32px | 500 | Dashboard metric numbers |
| `--text-2xl` | 32px | 40px | 500 | Large KPI values |
| `--text-mono-sm` | 12px | 18px | 400 | Code, IDs, technical strings |
| `--text-mono-md` | 13px | 20px | 400 | Inline code, snippet keys |

### Typography Rules
- Page title max: `--text-lg` (20px). This is a tool, not a marketing page.
- All numerical metrics (impression count, CTR, revenue): `--font-mono` + `--text-xl` or `--text-2xl`.
- API keys, public keys, IDs always `--font-mono --text-mono-md` on `--bg-raised` background.
- Letter-spacing: `-0.01em` on all headings. `0` everywhere else.
- No uppercase for section labels. Use `--text-muted` weight + size contrast instead.

---

## 3. Spacing & Grid

### Spacing Scale (4px base)

```
2px  — hairline gaps
4px  — tight inline gaps
8px  — component internal padding
12px — compact list items
16px — standard component padding
20px — card padding (default)
24px — section gaps
32px — major section breaks
40px — page-level sections
48px — large content blocks
64px — hero-tier spacing (rare)
```

### Layout Grid

**App shell (desktop):**
- Left sidebar: `220px` fixed
- Main content: `calc(100vw - 220px)`, max-width `1280px`
- Page padding: `24px` horizontal, `24px` top

**Content column widths:**
- Narrow (forms, settings): `560px` max
- Standard (lists, campaigns): `860px` max
- Wide (analytics, dashboards): `1200px` max
- Full-width (builder): no max-width

**Grid breakpoints:**
- Mobile: `< 768px` — sidebar collapses to bottom nav bar
- Tablet: `768px–1024px` — sidebar collapses to icon-only rail (48px)
- Desktop: `> 1024px` — full sidebar

---

## 4. Surface & Elevation System

```
Layer 0 — Root bg (#09090b) — page backdrop
Layer 1 — Base (#111113) — page content areas, sidebar
Layer 2 — Surface (#18181b) — cards, panels
Layer 3 — Raised (#27272a) — hover states, code blocks, input backgrounds
Layer 4 — Overlay (#3f3f46) — tooltips, dropdowns, context menus
Layer 5 — Modal (bg-surface + backdrop blur 24px) — modals, drawers, sheets
```

**Border usage:**
- Layer 2 cards: `1px solid #27272a`
- Layer 3 raised elements: `1px solid #3f3f46`
- Focus rings: `2px solid #6366f1` with `2px offset`
- No `box-shadow` for depth — use border + background layering instead.

---

## 5. Motion & Animation System

### Timing Functions

```css
--ease-out:   cubic-bezier(0.16, 1, 0.3, 1);  /* snappy exit — most UI */
--ease-in:    cubic-bezier(0.4, 0, 1, 1);      /* fade-out, dismiss */
--ease-both:  cubic-bezier(0.65, 0, 0.35, 1);  /* expand/collapse */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* spring — restricted to checkboxes, toggles */
```

### Duration Scale

```
50ms  — micro: button press state
100ms — fast: hover color transitions
150ms — default: most state changes
200ms — normal: dropdowns, tooltips
300ms — medium: panels, drawers slide-in
400ms — slow: page transitions, modals
600ms — deliberate: onboarding, first-load sequences
```

### Page Transition

Every route change uses this sequence:

1. **Exit (150ms)**: current page fades to `opacity: 0`, translates `y: -4px`
2. **Enter (300ms, 80ms delay)**: new page fades from `opacity: 0`, translates from `y: 8px` to `y: 0`, uses `--ease-out`
3. Implementation: wrap `<main>` in a keyed `AnimatePresence` (Framer Motion) or CSS `@starting-style`

```css
/* CSS-only fallback */
@keyframes page-enter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.page { animation: page-enter 300ms var(--ease-out) 80ms both; }
```

### Loading Bar

A 2px top progress bar (not a spinner) appears on every navigation and async fetch:
- Position: fixed top, `z-index: 9999`, full width
- Color: `--accent-500` → gradient to `--data-2` (cyan)
- Behavior: starts at 0%, eases to 60% while loading, snaps to 100% on complete, fades out 300ms
- Library: `nprogress` or custom implementation

### Skeleton Loading

All list/data content uses skeleton screens instead of spinners:

```
Skeleton base: #27272a
Skeleton shimmer: linear-gradient(90deg, #27272a 25%, #3f3f46 50%, #27272a 75%)
Animation: 1.5s ease-in-out infinite
```

Skeletons must match the exact shape of the final content:
- Campaign card skeleton: matches card height/columns
- Metric card skeleton: matches number + label layout
- Table skeleton: matches column widths

### Micro-interactions

- **Button press**: `transform: scale(0.97)` on `active`, 50ms
- **Card hover**: `background` lightens by one layer step, `border-color` to `--border-default`, 100ms
- **Toggle on**: slide 16px + background to `--accent-500`, `--ease-spring` 200ms
- **Checkbox check**: scale from 0 → 1 with `--ease-spring` 150ms
- **Dropdown open**: `transform: scaleY(0.95)` → `1`, `opacity: 0` → `1`, 150ms `--ease-out`, origin top
- **Toast appear**: slides in from right 24px, fades in 250ms `--ease-out`. Dismiss: fades + compresses height 200ms
- **Number counter**: animate numeric values with a roll-up effect on first render (400ms, count up from 0)

---

## 6. Background System

### Root Background

The page root is a textured dark surface, **not** a plain flat color:

```css
body {
  background-color: var(--bg-root);
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.08) 0%, transparent 60%),
    url("data:image/svg+xml,...");  /* noise SVG texture at 3% opacity */
}
```

The radial gradient creates a subtle indigo glow at the very top of the viewport — like ambient light from the header. It's invisible on first look but gives depth.

**Noise texture:** Generate a 200×200 SVG noise filter at 3–4% opacity. This prevents the dark background from looking "flat LCD." Apply globally to `body`.

### Sidebar Background

```css
.sidebar {
  background: linear-gradient(180deg, #111113 0%, #0f0f10 100%);
  border-right: 1px solid var(--border-subtle);
}
```

No glassmorphism on the sidebar. It should feel solid and anchored.

### Modal Backdrop

```css
.modal-backdrop {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
}
```

### Panel/Drawer Backdrop

```css
.drawer-backdrop {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}
```

### App-Load Background Animation

On initial page load (before JS hydrates), a CSS-only animation:
```css
@keyframes bg-pulse {
  0%, 100% { opacity: 0.06; }
  50%       { opacity: 0.12; }
}
.bg-glow-top {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background: radial-gradient(ellipse 60% 30% at 50% 0%, #6366f1 0%, transparent 70%);
  animation: bg-pulse 4s ease-in-out infinite;
}
```

This pulses the indigo glow at the top once on load, then becomes static. Remove the animation class after 4s via JS.

---

## 7. Full-Screen Loading Sequence

### Initial App Load

When the app first loads (before auth resolves):

1. **Splash screen** — full viewport, `--bg-root` background
2. Center: ScrollPop wordmark (text only, 18px, `--font-mono`, `--text-primary`) — no logo animation
3. Below wordmark: a 160px wide indigo loading bar that fills left-to-right over 800ms
4. Bar uses `--accent-500` with a 20px trailing blur glow
5. Once auth resolves: entire splash fades out `opacity: 0` over 300ms, then `display: none`

```
[                                    ]  ← splash: bg-root full screen
          scrollpop                     ← wordmark, centered
     [████████░░░░░░░░░░░░░]           ← 160px bar, filling
```

### Auth Check State

If Clerk is slow, show the splash for max 3 seconds then proceed to app with skeleton layout.

---

## 8. App Shell Design

### Sidebar Navigation

**Width:** `220px` desktop | Icon-only `48px` tablet | Hidden mobile

**Structure:**
```
┌─────────────────────────────────┐
│  scrollpop                  ⌄  │  ← wordmark + org switcher dropdown
├─────────────────────────────────┤
│  ○ Dashboard                    │
│  ○ Campaigns                    │
│  ○ Analytics                    │
│  ○ Sites                        │
│─────────────────────────────────│
│  ○ Journeys          [beta]      │  ← ff_journeys_ui flag
│  ○ Experiments       [beta]      │  ← ff_experiments_v1 flag
│─────────────────────────────────│
│  ○ Ops Center                   │  ← ff_realtime_ops_dashboard flag
├─────────────────────────────────┤
│  [bottom, pinned]               │
│  ○ Billing                      │
│  ○ Settings                     │
│  ─                              │
│  [avatar] Dwain          ⋯     │
├─────────────────────────────────┤
│  Plan: Growth  ■■■□□ 68%        │  ← usage bar, muted
└─────────────────────────────────┘
```

**Nav item styling:**
```
Inactive: text-muted, no background
Hover:    text-primary, bg: --bg-raised (#27272a), transition 100ms
Active:   text-primary, bg: --bg-overlay, left 2px accent border
```

Left accent border on active item: `2px solid --accent-500`, `border-radius: 0 2px 2px 0`

**Beta badge:** `[beta]` — 10px text, `--accent-500` color, no background. Right-aligned.

**Org switcher:** Click wordmark to open dropdown. Shows org name, plan badge, "Switch org" if multiple, "New org" at bottom. Chevron rotates 180° on open.

**Usage bar:** 6px tall progress bar in indigo at very bottom of sidebar. Shows `X% of monthly views used`. Turns amber at 80%, red at 95%.

### Top Header Bar

No persistent top bar on desktop — sidebar is the primary navigation.

On **mobile** only: a 56px fixed top bar with hamburger (left), wordmark (center), avatar (right).

### Main Content Area

```css
.main-content {
  margin-left: 220px;
  padding: 24px;
  min-height: 100vh;
  background: var(--bg-root);
}
```

**Page header (per page):** Not a persistent header bar, but a consistent inline pattern at the top of every page:

```
┌──────────────────────────────────────────────────────┐
│  Page Title                    [Secondary] [Primary]  │
│  Subtitle / description text                          │
└──────────────────────────────────────────────────────┘
```

- Title: `--text-lg` (20px), `--text-primary`
- Subtitle: `--text-sm` (13px), `--text-muted`
- Buttons: right-aligned. Primary action always rightmost.
- Divider: `1px solid --border-subtle` below header, `mb-6`

---

## 9. Page Designs

### 9.1 Dashboard (/)

**Layout:** 2-row section — KPI strip (top), then a 2-col chart area.

**KPI Strip (4 cards):**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Impressions  │ │    Views     │ │   Clicks     │ │ Conversions  │
│  248,391      │ │   184,200    │ │   9,210      │ │   1,847      │
│  ↑ 12.4%     │ │   ↑ 8.1%    │ │   ↑ 3.2%    │ │   ↑ 22.1%   │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

Each KPI card:
- `--bg-surface` background
- `1px solid --border-subtle` border
- `border-radius: 8px`
- `padding: 20px`
- Metric number: `--text-2xl`, `--font-mono`, `--text-primary`
- Label: `--text-xs`, `--text-muted`, uppercase false
- Delta: `--text-xs`, green/red with ↑↓ arrow. Always shows last 30d.
- **Animation:** On page enter, numbers count up from 0 over 600ms

**Chart Area (2 columns, 3:1 ratio):**

Left (wide): Events over time — area chart, 30-day default
- 3 series: Impressions (faint indigo fill), Views (cyan stroke), Clicks (amber stroke)
- No gridlines. Subtle X-axis only.
- Time range picker: `[7d] [30d] [90d]` — small pill group, top-right of chart
- Chart library: Recharts or Tremor

Right (narrow): Top campaigns leaderboard
- Simple ranked list: rank number, campaign name, impression count, CTR%
- Clickable rows → campaign detail
- Max 5 rows, "View all" link at bottom

**Below charts (2 columns, 1:1):**
- Left: Recent events feed (impression, click, dismiss with timestamps) — monospaced micro text
- Right: Active campaigns status (name, status badge, site domain)

**Empty state (no campaigns yet):**
- Centered in main area
- `--text-secondary` text: "No campaigns yet."
- One primary button: "Create your first campaign"
- No illustration/artwork

---

### 9.2 Campaigns (/campaigns)

**Layout:** List page with filters strip above a data table.

**Header:** "Campaigns" title + "New Campaign" button (primary, right)

**Filter strip (below header):**
```
[All] [Active] [Paused] [Draft]    ○ Site: All ▾    ○ Type: All ▾    [Search...]
```
- Status filters: segmented button group (3-state)
- Site and Type: compact `<select>` dropdowns, `--bg-raised` style
- Search: 200px input, right-aligned

**Campaign table:**

| | Name | Site | Type | Status | Impressions | CTR | Last Updated |
|--|--|--|--|--|--|--|--|
| ☐ | Welcome Modal | example.com | Modal | ● Live | 12,400 | 3.2% | 2h ago |

- Row height: 48px
- Checkbox column: 40px wide, appears on hover per row
- Status badge: `● Live` (green dot + text), `◎ Paused` (gray), `○ Draft` (muted border badge)
- Impressions + CTR: `--font-mono --text-sm`
- Last Updated: `--text-muted --text-xs`
- Row hover: `--bg-raised` background, 100ms
- Row click: navigates to campaign detail
- Bulk action bar: slides up from bottom when rows are checked (30px, blurs content behind)

**Bulk actions (sticky bottom bar):**
```
2 selected    [Pause]  [Duplicate]  [Delete]    ✕
```
Background: `--bg-raised`, `border-top: 1px solid --border-default`, `backdrop-filter: blur(8px)`

**Empty state:**
- Centered card, 400px wide
- "No campaigns match your filters" — clear filters link
- Or, if no campaigns at all: "Create Campaign" CTA

---

### 9.3 Campaign Wizard (/campaigns/new)

**Layout:** Full-screen wizard. Sidebar hidden. Custom minimal chrome.

**Chrome:**
```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to Campaigns                           [1 2 3 4 5] ●●●○○ │
└──────────────────────────────────────────────────────────────────┘
```

- Back link: top-left, `--text-muted`, arrow icon
- Step indicators: 5 numbered dots. Filled = complete, outlined = future, pulsing = current
- Step counter: `Step 2 of 5` — `--text-xs --text-muted`

**Wizard layout (2-column on steps 3+):**
```
┌──────────────────────────┬───────────────────────────────┐
│  Left: Controls          │  Right: Live Preview          │
│  (scrollable)            │  (sticky, 360px wide)         │
│                          │                               │
│                          │  ┌─────────────────────────┐  │
│                          │  │   Preview                │  │
│                          │  │   (popup renders here)   │  │
│                          │  └─────────────────────────┘  │
└──────────────────────────┴───────────────────────────────┘
```

Steps 1 (Metadata) and 2 (Template) use a centered single-column layout (640px max-width).

**Step navigation (bottom):**
```
                    [← Previous]          [Continue →]
```
Buttons pinned to bottom of left column. "Continue" is always primary. Last step says "Launch Campaign."

**Step 1 — Campaign Details:**
- Form fields: Campaign Name, Site (select), Campaign Type (segmented: Modal / Slide-in / Bar / Bubble / Gamified / Takeover)
- Inline validation on blur
- "Continue" button stays disabled until required fields filled

**Step 2 — Template Selector:**
- Full-width 3-column grid of template cards
- Category filter pills: All / Lead Capture / Sales / Webinar / Gamified / Ecommerce / Surveys / Holiday
- Each template card (240px × 180px):
  - Thumbnail image (top 70%, `--bg-raised` with mock popup rendered in it)
  - Template name + type badge (bottom 30%, `--bg-surface`)
  - Hover: overlay with `[Preview] [Use Template]` buttons
  - Selected state: `2px solid --accent-500` border
- Search bar at top

**Step 3 — Design:**
See Section 10 (Design Editor).

**Step 4 — Targeting & Triggers:**
- Left panel: two sub-sections — "Trigger" and "Targeting Rules"
- Trigger: icon-button grid (Scroll %, Dwell Time, Inactivity, Exit Intent, Click)
  - Selected trigger expands configuration inline
  - Scroll % → range slider
  - Dwell Time, Inactivity → number input (seconds)
- Targeting Rules: RulesBuilder component
  - "AND all rules" / "OR any rule" toggle
  - Rule rows: `[Rule type ▾] [Operator ▾] [Value input] [✕]`
  - "+ Add Rule" link at bottom
- Frequency: four option cards (Once per session / Once per day / Once per visitor / Always)
  - Icon + label, single-select

**Step 5 — Scheduling & Launch:**
- Schedule toggle: "Always active" vs "Custom schedule"
  - Custom schedule: day-of-week checkboxes + time range + timezone select
- Launch options: "Publish Now" (primary) or "Save as Draft" (secondary)
- Summary panel shows: campaign name, site, trigger summary, template name, estimated reach

---

### 10. Campaign Design Editor

**Layout:** Full-screen, sidebar hidden. Three-panel layout.

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Exit  "Welcome Modal"                         [Save Draft] [Publish] │
├─────────────────┬──────────────────────────┬─────────────────────┤
│  Blocks Panel   │   Canvas / Preview        │  Properties Panel  │
│  (240px)        │   (flex center)           │  (280px)           │
│                 │                           │                    │
│  + Add Block    │   ┌──────────────────┐    │  [Element name]    │
│  ─────────────  │   │                  │    │  ─────────────     │
│  [Text]         │   │   Live popup     │    │  Typography        │
│  [Button]       │   │   render         │    │  Layout            │
│  [Image]        │   │   (Shadow DOM)   │    │  Spacing           │
│  [Timer]        │   │                  │    │  Colors            │
│  [Form]         │   └──────────────────┘    │                    │
│  [Coupon]       │                           │                    │
│  [Spacer]       │   Device: [⬜] [📱] [⬜]  │                    │
└─────────────────┴──────────────────────────┴─────────────────────┘
```

**Left panel — Blocks:**
- Panel bg: `--bg-base`
- "Add Block" section with draggable block types (dnd-kit)
- Block list shows all current blocks in order
- Selected block: `--accent-500` left border, `--bg-raised` background
- Drag handle: appears on hover, ⠿ icon

**Center canvas:**
- `--bg-overlay` checkered pattern (shows transparency)
- Popup rendered at actual size in the center
- Device switcher: Desktop / Mobile / Tablet — 3 icon buttons, top center
- Zoom: `–` and `+` controls, bottom right

**Right panel — Properties:**
- Context-sensitive: shows properties of selected block
- Tabbed if applicable: Style / Layout / Advanced
- Input fields: `--bg-raised` inputs with `--border-subtle`
- Color pickers: swatch grid + hex input + opacity slider
- Typography: font size slider + weight select + alignment buttons
- No "save" button — changes apply to preview in real time

**Toolbar:**
- Undo/Redo: keyboard shortcuts shown on hover
- Preview in new tab button
- "Reset to template" link (muted, destructive confirmation)

---

### 11. Campaign Detail (/campaigns/detail/:id)

**Layout:** Standard single-column page (max 1000px)

**Page structure:**
```
Campaign Name                          [Edit Design] [⋯ More]
example.com • Modal • Created 3d ago
─────────────────────────────────────────────────────────────

Status:  ● Live      [Pause]    Last triggered: 2h ago

─────────────────────────────────────────────────────────────
Analytics (last 7d)
[Impressions 1,247] [Views 940] [Clicks 91] [CTR 9.7%]

[Sparkline chart — 7d line]
─────────────────────────────────────────────────────────────

Trigger         Scroll 60%
Targeting       URL contains /pricing
Frequency       Once per session
Schedule        Always active

─────────────────────────────────────────────────────────────

Affiliate Slots (2)
[slot card] [slot card]     [+ Add Slot]

─────────────────────────────────────────────────────────────

Variants (A/B)
[variant card: Control 50%] [variant card: B 50%]   [+ Add Variant]
```

**Affiliate slot card:**
- 200px wide card
- Product image thumbnail (top)
- Product name, weight %, CTA text
- Edit / Remove on hover

---

### 12. Analytics (/analytics)

**Layout:** Full-width. Date range picker in header.

**Header:**
```
Analytics                     [Export CSV]    [Last 30 days ▾]
```

**Section 1 — Volume overview:**
4 KPI cards (same style as dashboard but larger)

**Section 2 — Trend charts (full width):**
- Impressions over time (area chart)
- Clicks + conversions overlaid (dual-axis)
- Recharts, custom tooltip with `--bg-raised` background

**Section 3 — Breakdown table:**
| Campaign | Site | Impressions | Views | Clicks | CTR | Conversions | Rev |
|--|--|--|--|--|--|--|--|

- Sortable columns: click header, shows ↑↓ icon
- Pagination: `< 1 2 3 >` — simple, bottom right

**Section 4 — Funnel (horizontal):**
```
Impressions → Views → Clicks → Conversions
  248,391       184K     9.2K      1.8K
  100%         74.1%    3.7%      0.7%
```
Each stage: a horizontal bar, proportional width, with percentage and count.

---

### 13. Sites (/sites)

**Layout:** List page with install wizard state.

**Empty state (no sites):** Full-width card with step-by-step install guide:
1. Copy snippet code
2. Paste before `</body>`
3. Verify connection

**With sites:** Card grid (3 columns)

Each site card:
```
┌──────────────────────────────┐
│ ● Connected                   │  ← status dot
│ example.com                   │  ← domain, --text-md
│                               │
│ 3 campaigns  •  12,400 views  │  ← meta, --text-muted
│                               │
│ Public Key: sp_live_abc123    │  ← monospace
│ [Copy]                        │
│                               │
│ [Manage]           [⋯]       │
└──────────────────────────────┘
```

**Site detail (slide-over drawer):**
Opens as a right-side drawer (480px) when "Manage" is clicked:
- Site settings (name, domain)
- Snippet install code block (syntax highlighted, copy button)
- Connection status with timestamp
- Delete site (red, bottom, with confirmation dialog)

---

### 14. Billing (/billing)

**Layout:** Single column, max 700px.

**Current plan section:**
```
Current Plan: Growth    [Upgrade]

Monthly views:  ■■■■■■■□□□  68%  (102,000 / 150,000)
Campaigns:      ■■□□□□□□□□  20%  (4 / 20)
Sites:          ■□□□□□□□□□  10%  (1 / 10)

Next billing date: June 1, 2026  •  $49/mo
```

**Pricing cards (4 tiers visible):**
Horizontal scroll on mobile, grid on desktop (4 columns).

Each plan card:
- Plan name + price (large mono)
- Feature list
- Current plan: `--border-strong` border, "Current Plan" badge
- Recommended: `--accent-500` border, "Most Popular" badge
- CTA: "Upgrade" or "Downgrade" (with confirmation)
- No gradient backgrounds on cards

**Usage history:**
Simple table: Date / Impressions Used / Plan / Amount.

**Payment method:**
```
Visa •••• 4242    Expires 12/27    [Update]
```

---

### 15. Settings (/settings)

**Layout:** Tabbed settings panel. Left tab rail (160px) + content area.

**Tabs:**
- General
- API Keys
- Notifications
- Integrations
- Danger Zone

**General tab:**
- Org name field
- Default timezone select
- Affiliate link base URL
- Plan tier display (link to Billing)

**API Keys tab:**
- Live key display (masked, copy button, regenerate)
- Test key display
- Webhook URL field
- Each key in a `--bg-raised` code block:
  ```
  ┌─────────────────────────────────────────────────┐
  │  sp_live_••••••••••••••••••••••3f9a    [Copy] [Regenerate] │
  └─────────────────────────────────────────────────┘
  ```

**Integrations tab:**
- Grid of integration cards (Stripe, Clerk, Cloudflare, PostHog, Sentry)
- Each card: logo + name + status badge + "Configure" link
- Disabled integrations: desaturated + "Coming soon" badge

**Danger Zone tab:**
- `--bg-surface` with `1px solid #7f1d1d` (dark red border) card
- "Delete Organization" — red button, two-step confirmation modal

---

### 16. Profile (/profile)

**Layout:** Single column, max 600px.

**Sections:**
- Avatar upload (circle, 80px, click to change)
- Name + Email fields (email read-only if from Clerk)
- Notification preferences (toggle list)
- Connected accounts (SSO providers)
- "Save Changes" at bottom

---

### 17. Sign In (/sign-in)

**Layout:** Full-viewport split

```
┌─────────────────────────┬────────────────────────────────┐
│  Left 50% — brand panel  │  Right 50% — auth form          │
│  --bg-root background    │  --bg-surface background        │
│                          │                                 │
│  [scrollpop wordmark]    │  Sign in to ScrollPop           │
│                          │  ─────────────────────          │
│  "Convert more.          │  Email ________________         │
│   Without the friction." │  Password ______________        │
│                          │                    [Sign in]    │
│  Testimonial quote       │                                 │
│  ─────                   │  ───── or ─────                │
│  Company • Name          │  [Continue with Google]         │
│                          │  [Continue with GitHub]         │
│  [3 stat callouts]       │  ─────────────────────          │
│                          │  No account? Sign up            │
└─────────────────────────┴────────────────────────────────┘
```

**Left panel background:** `--bg-root` with the ambient indigo radial gradient. No image. Keep it dark and clean.

**Stat callouts (left panel, bottom):**
3 items in a row — "12,400 campaigns created", "4.2M popup views served", "98ms median load time"
Each: large mono number, small label below.

**Right panel:** `--bg-surface`, center-aligned form, max 360px form width.

**Sign Up (/sign-up):** Same split layout. Form has Name + Email + Password + confirm. Right panel.

---

### 18. Admin Panel (/admin)

**Layout:** Tabbed. Role-gated (admin role only).

**Tabs:** Tenants / Campaigns / Events / Feature Flags / System Health

**Tenants tab:** Table with: Org ID, Name, Plan, Campaigns, Events (30d), Created. Search + filter.

**Feature Flags tab:**
```
ff_journeys_ui             [●] ON    [Edit targets]
ff_realtime_ops_dashboard  [○] OFF   [Edit targets]
ff_experiments_v1          [●] ON    [Edit targets]
```
Toggles with tenant-list targeting.

**System Health tab:**
- `--bg-raised` card per service: API, Worker, Database, Redis, Stripe
- Each: service name + status dot (green/red/amber) + latency + last checked
- "Run health check" button at top

---

### 19. Ops Center (/ops)

**Layout:** Full-screen, dark, dense. Like a control room.

**Top bar (page-level):**
```
Ops Center    ● Live    Events/min: 1,247    Workers: 3/3    [Pause stream]
```

**Main area — 4-panel grid:**
```
┌─────────────────────────┬─────────────────────────┐
│ Event stream (log)      │ Events/sec chart (live)  │
│                         │                          │
├─────────────────────────┼─────────────────────────┤
│ Active campaigns (list) │ Error rate + queue depth │
└─────────────────────────┴─────────────────────────┘
```

**Event stream panel:**
- Monospace font, small text (11px)
- Lines appear from bottom, scroll up
- Color coding: impression (muted), click (cyan), dismiss (amber), error (red)
- Each line: `HH:MM:SS  IMPRESSION  example.com  campaign-id`

**Live chart:** Recharts area chart, x-axis = last 2 minutes in 5s buckets, updates each tick.

---

### 20. Journeys (/journeys) — Beta

**Layout:** Canvas-style builder (full screen, no sidebar)

**Top bar:**
```
← Journeys    "Post-purchase flow"    [Unsaved changes ●]    [Save]  [Publish]
```

**Canvas:**
- `--bg-root` with a dot-grid pattern (1px dots, `--border-subtle` color, 24px spacing)
- Node-based flow builder (dnd-kit or react-flow)
- Nodes: cards on the canvas with `--bg-surface` background
- Connections: `--accent-500` bezier curves

**Node types:**
- Trigger node (entry) — hexagon shape, indigo
- Popup action node — rectangle with thumbnail preview
- Delay node — pill shape, `--bg-raised`
- Condition node — diamond shape, amber
- End node — circle, muted

**Right panel:** slides in when a node is selected. Properties for that node type.

---

### 21. Experiments (/experiments) — Beta

**Layout:** Standard list + detail split.

**List:** Table of experiments with: Name, Status, Variants, Start date, Winner.
Status badges: Running (pulsing green), Paused, Complete (blue), Draft.

**Experiment detail (drawer or page):**
- Hypothesis text field
- Variant cards: Control + Test(s)
  - Each card: variant name, weight slider, sample size, conv rate
  - Confidence interval visualization (horizontal bar with CI range)
- "Declare winner" button appears when confidence > 95%
- Statistical significance display: `p < 0.05 ✓` or `Not significant yet`

---

## 11. Popup/Snippet UI Design

The popup itself (rendered via snippet in Shadow DOM on customer sites) must look premium enough to not embarrass the operator's brand.

### Design Tokens (Popup — isolated in Shadow DOM)

The popup uses operator-configured colors. But defaults must be clean:

```css
/* Popup default theme */
--popup-bg:      #ffffff;
--popup-text:    #111111;
--popup-accent:  #6366f1;
--popup-radius:  12px;
--popup-shadow:  0 20px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05);
--popup-font:    -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Popup Types & Layout

**Modal:**
```
Overlay (rgba 0 0 0 / 0.5, blur 4px)

      ┌────────────────────────────────┐
      │  [Image / hero area]           │  ← optional, top 40%
      │                                │
      │  Headline text                 │  ← 22px, weight 600
      │  Subheadline / body copy       │  ← 15px, muted
      │                                │
      │  [         CTA Button        ] │  ← full-width
      │                                │
      │  or  Dismiss text link         │  ← small, muted, centered
      └────────────────────────────────┘ ✕
                                    ← close button, top-right, outside card
```
Card width: 420px max, centered.

**Slide-in:**
```
                    ┌──────────────────────┐
                    │  Headline            │ ✕
                    │  Body copy           │
                    │  [CTA]               │
                    └──────────────────────┘
```
Position: bottom-right or bottom-left. Width: 340px. Slides from edge, `--ease-out` 350ms.

**Bar:**
```
┌────────────────────────────────────────────────────────────────────────┐
│  Headline text              [CTA Button]                              ✕ │
└────────────────────────────────────────────────────────────────────────┘
```
Full-width, fixed top or bottom. Height: 52px.

**Floating Bubble:**
```
                    ○  ← 48px circle avatar/icon, bottom-right
```
Click expands to slide-in panel. Pre-expand state shows message count badge.

**Gamified Overlay (Spin-to-win):**
Full-screen modal. Wheel centered. Offer text above/below. Dark background with accent colors.

**Notification Toast:**
```
                    ┌──────────────────────────┐
                    │  🔔  "Sarah just claimed!"│
                    │      2 minutes ago         │
                    └──────────────────────────┘
```
Bottom-left. Social proof style. 300px wide. Auto-dismiss 6s.

**Corner Popup:**
```
┌────────────────────┐
│  [Product image]   │
│  Product name      │
│  [CTA]             │
└────────────────────┘
```
240px wide, bottom corner. Less intrusive than modal.

### Popup Animation Specs

All popup animations run inside Shadow DOM:

| Type | Enter | Exit |
|---|---|---|
| Modal | Backdrop fade in (200ms) → card scale from 0.95 → 1 + fade (300ms, `--ease-out`) | Reverse, 200ms |
| Slide-in | Translate from edge 100% → 0% (350ms, `--ease-out`) | Reverse |
| Bar | Translate from -100% → 0% (250ms, `--ease-out`) | Translate back |
| Bubble | Scale 0 → 1 from transform-origin bottom-right (300ms, `--ease-spring`) | Scale back |
| Takeover | Full bg fade in (300ms), content fade up (400ms, 100ms delay) | Reverse |
| Toast | Slide in from left 30px + fade (250ms) | Fade + compress height (200ms) |

### Close Button

Universal close button design:
- `✕` icon, 20px, `--text-muted`, `--bg-raised` circle 28px diameter
- Positioned: top-right corner, 12px offset
- Hover: `--text-primary`, `--bg-overlay`
- Always present unless `showCloseButton: false`

---

## 12. Component Library Specs

### Buttons

**Primary:**
```css
background: var(--accent-500);
color: #fff;
padding: 8px 16px;
border-radius: 6px;
font-size: 14px;
font-weight: 500;
border: none;
transition: background 100ms;

:hover  { background: var(--accent-600); }
:active { background: var(--accent-700); transform: scale(0.97); }
:disabled { background: var(--bg-overlay); color: var(--text-disabled); cursor: not-allowed; }
```

**Secondary (ghost):**
```css
background: transparent;
color: var(--text-secondary);
border: 1px solid var(--border-subtle);
/* same padding/radius */

:hover { background: var(--bg-raised); color: var(--text-primary); border-color: var(--border-default); }
```

**Destructive:**
```css
background: transparent;
color: #ef4444;
border: 1px solid rgba(239,68,68,0.3);

:hover { background: rgba(239,68,68,0.08); border-color: #ef4444; }
```

**Icon button:**
```css
width: 32px; height: 32px;
background: transparent;
border: none;
border-radius: 6px;
color: var(--text-muted);

:hover { background: var(--bg-raised); color: var(--text-primary); }
```

**Loading state (any button):**
Replace content with a 16px spinner (SVG, rotating 360° over 600ms). Maintain button dimensions.

### Inputs

```css
background: var(--bg-raised);
border: 1px solid var(--border-subtle);
color: var(--text-primary);
padding: 8px 12px;
border-radius: 6px;
font-size: 14px;

:focus { border-color: var(--accent-500); outline: none; box-shadow: 0 0 0 3px var(--accent-glow); }
:invalid { border-color: var(--status-error); }
::placeholder { color: var(--text-disabled); }
```

### Select

Same as input styling. Custom dropdown (not native `<select>`):
- Options list: `--bg-raised` background, `1px solid --border-default` border, `border-radius: 8px`
- Option hover: `--bg-overlay` background
- Checkmark on selected option: `--accent-500`
- Opens with same animation as dropdowns

### Badges

```css
/* Default */
padding: 2px 8px;
border-radius: 4px;
font-size: 11px;
font-weight: 500;
letter-spacing: 0;

/* Variants */
.badge-success { background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); }
.badge-warning { background: rgba(245,158,11,0.12); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
.badge-error   { background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
.badge-neutral { background: var(--bg-raised); color: var(--text-secondary); border: 1px solid var(--border-subtle); }
.badge-accent  { background: rgba(99,102,241,0.12); color: var(--accent-300); border: 1px solid rgba(99,102,241,0.2); }
```

### Modals

```css
.modal-wrapper {
  position: fixed; inset: 0; z-index: 500;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}

.modal-content {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;  /* varies: sm=400, md=480, lg=600, xl=800 */
  padding: 24px;
  box-shadow: 0 25px 80px rgba(0,0,0,0.5);
}

.modal-header { margin-bottom: 16px; }
.modal-title  { font-size: 16px; font-weight: 500; color: var(--text-primary); }
.modal-footer { margin-top: 24px; display: flex; gap: 8px; justify-content: flex-end; }
```

Animation: backdrop fades in (150ms), content scales from 0.96→1 and fades in (250ms, 50ms delay).

### Toasts / Notifications

```css
/* Position: fixed bottom-right, z-9999, stack with 8px gap */
.toast {
  background: var(--bg-raised);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 12px 16px;
  width: 320px;
  display: flex; align-items: flex-start; gap: 12px;
}
/* Left colored accent bar: 3px wide, full height, border-radius left */
.toast-success { --bar-color: var(--status-success); }
.toast-error   { --bar-color: var(--status-error); }
```

### Tables

```css
table { width: 100%; border-collapse: collapse; }
th    { text-align: left; font-size: 11px; color: var(--text-muted); font-weight: 500;
        padding: 8px 12px; border-bottom: 1px solid var(--border-subtle); }
td    { padding: 12px; font-size: 13px; border-bottom: 1px solid var(--border-subtle); }
tr:hover td { background: var(--bg-raised); }
```

Sortable column header: `cursor: pointer`, shows `↑` / `↓` icon on hover and when active.

### Code / Key Display Blocks

```css
.code-block {
  background: var(--bg-raised);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 12px 16px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-secondary);
  position: relative;
}
.code-block .copy-btn {
  position: absolute; top: 8px; right: 8px;
  /* icon button style */
}
```

---

## 13. Empty States

All empty states follow this pattern — no illustrations, no emoji:

```
[Icon outline, 32px, --text-muted]

No campaigns yet.           ← --text-md, --text-primary
Create your first campaign to start converting visitors.  ← --text-sm, --text-muted

[Create Campaign]           ← Primary button
```

Centered in the content area. Max width 400px. Vertical stack with 8px gap.

---

## 14. Responsive / Mobile

### Mobile Nav (< 768px)

Replace sidebar with a bottom navigation bar:
```
┌────────────────────────────────────────────────────────┐
│                     [Content area]                     │
├────────┬──────────┬────────────┬──────────┬────────────┤
│ 🏠     │ 📊       │ + New      │ 🔗       │ ⚙️          │
│ Home   │ Analytics│ Campaign   │ Sites    │ Settings   │
└────────┴──────────┴────────────┴──────────┴────────────┘
```

- 56px tall, fixed bottom
- "New Campaign" center button: `--accent-500` circle button, 48px, elevated
- Active state: icon turns `--accent-300`, label shows
- Inactive: icon `--text-muted`, label hidden (space-saving)

### Mobile Content Adjustments

- KPI cards: 2-column grid on mobile (not 4)
- Campaign table: collapse to card list
- Wizard: stack controls above preview (preview collapsible accordion)
- Design editor: single column with tab switching (Blocks / Preview / Properties)

---

## 15. Icon Set

Use **Lucide** icons throughout. Size conventions:
- Nav icons: 16px
- Button icons: 14px (inline) / 16px (standalone)
- Section header icons: 18px
- Empty state icons: 32px (outline variant)
- Status dots (live/offline): 8px circle, CSS only (no icon)

**Never mix icon sizes within the same component.**

---

## 16. Transition Glossary (for implementation reference)

| Interaction | Duration | Easing | Notes |
|---|---|---|---|
| Page route change | 300ms enter / 150ms exit | `--ease-out` | y+8px enter, y-4px exit |
| Loading bar | fill to 60% over fetch, snap to 100% | ease | 2px fixed top |
| Sidebar collapse | 200ms | `--ease-both` | width + opacity |
| Dropdown open | 150ms | `--ease-out` | scaleY 0.95→1 |
| Modal open | 250ms (50ms delay after backdrop) | `--ease-out` | scale 0.96→1 |
| Drawer open | 300ms | `--ease-out` | translateX from edge |
| Toast appear | 250ms | `--ease-out` | translateX -24px→0 |
| Card hover | 100ms | linear | bg lighten |
| Button press | 50ms | linear | scale 0.97 |
| Toggle switch | 200ms | `--ease-spring` | translate + color |
| Number count-up | 600ms | ease-out | 0 → final value on mount |
| Skeleton shimmer | 1500ms | ease-in-out infinite | left-to-right |
| Popup enter (modal) | 300ms | `--ease-out` | scale 0.95→1 |
| Popup enter (slide) | 350ms | `--ease-out` | translate edge→0 |
| Popup exit (any) | 200ms | `--ease-in` | reverse of enter |

---

## 17. Accessibility

- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text / UI components
- Focus rings: `2px solid --accent-500`, `2px offset`, visible on all interactive elements
- Keyboard navigation: full tab order, arrow keys in menus/selects
- ARIA: `role="dialog"` on modals, `aria-live="polite"` on toasts, `aria-label` on icon-only buttons
- Reduce motion: wrap all non-essential animations in `@media (prefers-reduced-motion: reduce)`
- Screen reader: all status icons have `aria-label`, decorative elements have `aria-hidden="true"`

---

## 18. Implementation Notes (for Google Stitch)

### Priority Order for Build

1. **App shell + sidebar** — Layout, navigation, active states
2. **Loading bar + page transitions** — Global `nprogress`-style bar, route animation wrapper
3. **Dashboard** — KPI cards with count-up, charts, empty state
4. **Campaigns list** — Table with filters, status badges, bulk actions
5. **Campaign Wizard** — 5-step flow, template grid, live preview
6. **Design Editor** — 3-panel, block list, properties panel, canvas
7. **Analytics** — Charts, funnel, breakdown table
8. **Sites** — Card grid, drawer, snippet code block
9. **Billing** — Plan cards, usage bars, history table
10. **Settings** — Tabbed form pages
11. **Sign In / Sign Up** — Split layout
12. **Popup renders** — All 6 popup types with animations (Shadow DOM)
13. **Mobile nav** — Bottom bar, responsive adjustments
14. **Admin Panel** — Tenants table, feature flag toggles, health grid
15. **Ops Center** — Event stream, live chart
16. **Journeys + Experiments** — Beta pages

### Component Build Order

1. Token system (CSS variables in `index.css`)
2. Button variants
3. Input + Select + Checkbox + Toggle
4. Badge variants
5. Modal + Drawer
6. Toast system
7. Table + skeleton
8. KPI card + sparkline
9. Sidebar nav
10. Page wrapper + transition
11. Loading bar

### Files to Modify

| File | Change |
|---|---|
| `apps/dashboard/src/index.css` | Replace all CSS tokens with this design system |
| `apps/dashboard/src/components/Layout.tsx` | Rebuild sidebar to spec, remove canvas glitch effect, add usage bar |
| `apps/dashboard/src/main.tsx` | Add page transition wrapper (Framer Motion AnimatePresence or CSS) |
| `apps/dashboard/src/pages/Dashboard.tsx` | KPI count-up, chart layout |
| `apps/dashboard/src/pages/Campaigns.tsx` | Table + filters + bulk actions |
| `apps/dashboard/src/pages/CampaignWizard.tsx` | Wizard chrome, step indicators |
| `apps/dashboard/src/components/campaign-wizard/TemplateSelector.tsx` | Card grid, hover states |
| `apps/dashboard/src/components/campaign-wizard/DesignControls.tsx` | 3-panel editor |
| `apps/dashboard/src/pages/Analytics.tsx` | Charts + funnel + table |
| `apps/dashboard/src/pages/Sites.tsx` | Card grid + drawer |
| `apps/dashboard/src/pages/Billing.tsx` | Plan cards + usage bars |
| `apps/dashboard/src/pages/Settings.tsx` | Tabbed layout |
| `apps/dashboard/src/pages/SignIn.tsx` | Split layout |
| `packages/snippet/src/main.ts` | Popup types + animation specs |

### Do NOT Change

- Routing logic in `main.tsx` (two-mode execution: Clerk / Demo)
- API data provider in `providers/dataProvider.ts`
- Feature flag system in `lib/flags.ts`
- `packages/shared` types
- Any Zod schemas
- `apps/api` — design changes are frontend only
