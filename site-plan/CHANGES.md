# Site-Plan Session Changes
_Branch: `dw-dwain` and `dwain-coder` (both pushed, identical — commit `f968391` on `dev`)_

---

## 1. Live Demo — 6 Popup Types
**File:** `src/components/ScrollPopDemo.tsx` (full rewrite)

Added 6 popup types to the live demo (was 4, all center modals):
| Type | Position | Trigger |
|---|---|---|
| Welcome | Center modal | Scroll 30% |
| Exit Intent | Center modal | Exit intent |
| Header Bar | Top bar (slides down) | Page load |
| Footer Bar | Bottom bar (slides up) | Scroll 20% |
| Side Slide-in | Bottom-right card | Dwell 8s |
| Affiliate Deal | Center modal + product image | Scroll 60% |

Each type renders its correct visual position in the preview canvas (center overlay, full-width bars, corner card).

**Install Snippet tab — gated:** clicking "Install snippet" now shows a locked state with a "Create Free Account" CTA instead of exposing the raw code. Users must sign up first to get their public key.

---

## 2. Sign-Up URL Fix
**Files:** All `site-plan/src/components/*.tsx`

`https://dashboard.scrollpop.online/sign-up` was returning 404. Every CTA that previously linked to `/sign-up` now links to `https://dashboard.scrollpop.online` (the root, which works and lets Clerk handle routing).

Affected files:
- `Header.tsx` — "Start Free →" desktop + mobile
- `Footer.tsx` — "Start Free →" brand CTA
- `HomeView.tsx` — hero CTA + bottom CTA
- `PricingView.tsx` — all 5 tier buttons
- `TemplatesView.tsx` — all "Use This Template" + section CTAs
- `WordPressShopifyGuide.tsx` — top + bottom CTAs
- `ScrollPopDemo.tsx` — "Start Building Free" + install gate CTA

Sign In links (`/sign-in`) left unchanged — user confirmed those work.

---

## 3. Legal Pages (new)
**File:** `src/components/LegalView.tsx` (new file)
**File:** `src/types.ts` — added `'privacy-policy' | 'terms' | 'security'` to `ActivePage`
**File:** `src/App.tsx` — added routing for all 3 pages
**File:** `src/components/Footer.tsx` — wired footer links from `href="#"` to `onPageChange`

Three real content pages created:

**Privacy Policy** — covers: data collected (account, usage, analytics, billing), usage, sub-processors (Clerk, Stripe, Cloudflare, Neon, Upstash, Sentry), cookies, retention (90 days post-cancellation), GDPR/CCPA rights, contact.

**Terms of Service** — covers: service description, account responsibilities, acceptable use (including explicit ban on `history.pushState` manipulation), billing & refund policy, IP ownership, liability cap, governing law (England & Wales).

**Security** — covers: infrastructure (Cloudflare Workers, Neon/Supabase RLS, Fly.io, Clerk), encryption in transit + at rest, snippet safety guarantees (closed Shadow DOM, no eval, no popstate, <10KB), access controls, GDPR/CCPA/PCI-DSS compliance, incident response (72h notification), vulnerability disclosure.

---

## 4. Template Library — Rebuilt
**File:** `src/components/TemplatesView.tsx` (full rewrite)

**Was:** 24 templates, flat coloured block previews, category filter + search.

**Now:** 8 curated templates, each with:
- Relevant **Unsplash background photo** (blurred/dimmed behind popup)
- **Realistic popup mockup** matching the template's actual design (badge, serif title, body, email input, CTA button) — rendered differently per position type (center modal, bottom-right slide-in, top bar)
- Category + trigger badges overlaid on preview

Templates kept:
1. Welcome Offer — indigo center modal, Scroll 30%
2. Exit Intent — dark/amber center modal, Exit intent
3. Email Lead Capture — blue lightbox, Dwell 10s
4. Flash Sale Countdown — crimson/gold center modal, Scroll 20%
5. Side Slide-in — purple corner card, Dwell 8s
6. Affiliate Product Deal — warm/amber center modal, Scroll 60%
7. Announcement Bar — indigo top bar, Page load
8. Spin-to-Win Wheel — dark/gold center modal, Dwell 5s

---

## 5. Footer Layout Fix
**Files:** `src/App.tsx`, `src/index.css`

**Problem:** Footer was not anchored to the bottom on some pages and scrolled beyond page content.

**Fix 1 — `App.tsx`:** Removed `justify-between` from the root flex container. This was distributing space between all 4 flex children (Header, main, anchor-div, Footer) instead of letting `flex-grow` on `<main>` push the footer cleanly to the bottom.

**Fix 2 — `index.css`:** `.hero-glow-left` had `bottom: -10%` which pushed the absolutely-positioned glow element ~175px below the root div boundary, extending the scroll area past the footer. Changed to `bottom: 0`.

---

## 6. "From the Community" Section Removed
**File:** `src/components/HomeView.tsx`

Removed the testimonials section (lines 453–482). The section data contained em-dashes and special characters that had become mojibake (â€", Ã¨, etc.) due to a prior PowerShell file encoding issue. Removed entirely rather than risk re-corrupting.

---

## 7. "Start Free" Button Text Centering
**File:** `src/components/Header.tsx`

Added `flex items-center justify-center` to the "Start Free →" `<a>` tag in the desktop nav. The `h-11` fixed height without flex centering caused the text to sit at the top of the button.

---

## Sign-Up Status (Answer)

The `/sign-up` route on `https://dashboard.scrollpop.online/sign-up` returns 404. All marketing site CTAs now point to `https://dashboard.scrollpop.online` (root) so users land on the dashboard and Clerk handles auth routing from there.

**To properly fix sign-up,** the dashboard app (`apps/dashboard`) needs a working `/sign-up` route. With Clerk + TanStack Router, this means ensuring `sign-up` is defined as a route (either a `__root.tsx` redirect or a proper `sign-up.tsx` route file wired to Clerk's `<SignUp />` component). That fix lives in `apps/dashboard/src` — not in the marketing site.

---

## Files Changed Summary
```
M  site-plan/src/App.tsx
M  site-plan/src/types.ts
M  site-plan/src/index.css
A  site-plan/src/components/LegalView.tsx       ← NEW
M  site-plan/src/components/Footer.tsx
M  site-plan/src/components/Header.tsx
M  site-plan/src/components/HomeView.tsx
M  site-plan/src/components/PricingView.tsx
M  site-plan/src/components/ScrollPopDemo.tsx
M  site-plan/src/components/TemplatesView.tsx
M  site-plan/src/components/WordPressShopifyGuide.tsx
```

## Branches
- `dw-dwain` — pushed to `origin/dw-dwain`
- `dwain-coder` — pushed to `origin/dwain-coder`
- Both are identical, branched from `dev` at commit `f968391`
- PR target: `main`
- Repo: `https://github.com/Dw-Dwain/Scroll-pop`
