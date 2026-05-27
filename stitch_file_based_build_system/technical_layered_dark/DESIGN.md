---
name: Technical Layered Dark
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1c1b1d'
  surface-container: '#201f22'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#313032'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#c8c5ca'
  on-secondary: '#303033'
  secondary-container: '#47464a'
  on-secondary-container: '#b6b4b8'
  tertiary: '#4ae176'
  on-tertiary: '#003915'
  tertiary-container: '#00a74b'
  on-tertiary-container: '#003111'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#e4e1e6'
  secondary-fixed-dim: '#c8c5ca'
  on-secondary-fixed: '#1b1b1e'
  on-secondary-fixed-variant: '#47464a'
  tertiary-fixed: '#6bff8f'
  tertiary-fixed-dim: '#4ae176'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005321'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
  bg-root: '#09090b'
  bg-base: '#111113'
  bg-surface: '#18181b'
  bg-raised: '#27272a'
  bg-overlay: '#3f3f46'
  border-subtle: '#27272a'
  border-default: '#3f3f46'
  border-strong: '#71717a'
  accent-glow: rgba(99, 102, 241, 0.2)
  status-warning: '#f59e0b'
  status-error: '#ef4444'
  data-cyan: '#22d3ee'
  data-violet: '#a78bfa'
  data-emerald: '#34d399'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  headline-md:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '500'
    lineHeight: 26px
  body-base:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-xs:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
  mono-kpi-xl:
    fontFamily: Geist Mono
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
  mono-kpi-lg:
    fontFamily: Geist Mono
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  mono-sm:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  mono-md:
    fontFamily: Geist Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  internal-sm: 8px
  internal-md: 12px
  padding-std: 16px
  padding-card: 20px
  gap-section: 24px
  sidebar-width: 220px
  max-width-page: 1280px
  max-width-form: 560px
---

## Brand & Style
This design system is built for performance-oriented, data-heavy environments where precision and speed are paramount. It targets developers, analysts, and power users who value information density over decorative flair.

The aesthetic leans heavily into **Minimalism** and **Modern Corporate** styles, specifically drawing from the "Linear" and "Vercel" design movements. It prioritizes clarity through a rigid layering system, utilizing a monochromatic Zinc foundation accented by high-energy Indigo. The emotional response should be one of focused control—UI elements are sharp, transitions are snappy, and the visual noise is suppressed to let data lead the experience.

## Colors
The palette is governed by a **Layered Depth** philosophy. Instead of traditional shadows, depth is communicated through stepping up the lightness of the Zinc-based grayscale.

- **Foundational Layers:** Use `bg-root` for the page backdrop. Content areas and sidebars reside on `bg-base`, while discrete cards or panels use `bg-surface`.
- **Interactions:** `bg-raised` is reserved for interactive states (hover), inputs, and code blocks. `bg-overlay` is used for the highest-level floating elements like tooltips.
- **Accents:** Indigo (`#6366f1`) is the primary driver for CTAs and focus states. It is often accompanied by a subtle `accent-glow` to maintain a "high-tech" feel without relying on heavy gradients.
- **Data Visualization:** A dedicated 5-color palette (Indigo, Cyan, Amber, Violet, Emerald) provides clear distinction for metrics and experimental variables.

## Typography
The typography is designed for technical legibility. We use a dual-stack approach: **Inter** for all UI and interface elements, and **Geist Mono** for data, IDs, and technical strings.

Key constraints:
- **Weight:** Never exceed 600 (Semi-bold). The system relies on size and color (Primary vs. Secondary text) for hierarchy rather than heavy weights.
- **Data Display:** All dashboard metrics, KPI values, and code snippets must use the Mono stack to ensure tabular alignment and a technical "command-line" aesthetic.
- **Scale:** Sizes are intentionally kept small to increase information density, peaking at 32px for large numeric KPIs.

## Layout & Spacing
The layout follows a strict **4px rhythm**. 

- **Grid Model:** A fluid system within a fixed `1280px` container. 
- **Sidebar:** A fixed `220px` sidebar on desktop, collapsing to a `48px` rail for tablets, and transitioning to a `56px` bottom navigation bar on mobile.
- **Spacing Logic:** Use `16px` for standard component padding. Increase to `20px` for card internals and `24px` for vertical gaps between major page sections. Forms should be constrained to a `560px` max-width to maintain readability.

## Elevation & Depth
This design system intentionally avoids standard `box-shadow` to maintain a flat, architectural feel. 

- **Tonal Layering:** Depth is created by the 5-tier surface system (Root → Base → Surface → Raised → Overlay). Each step up in hierarchy is represented by a lighter background value and a progressively more prominent border.
- **Backdrop Blurs:** High-priority overlays (Modals) utilize a heavy `24px` blur. Drawers use a lighter `4px` blur to maintain context of the page behind.
- **Borders as Depth:** Use `border-subtle` for standard definition and `border-default` for active or focused elements. `border-strong` is reserved for highlighting "current" states (e.g., active pricing plan).

## Shapes
Shapes are functional and precise. We use a "Soft" roundedness approach to slightly take the edge off the technical aesthetic without appearing "bubbly."

- **Badges:** 4px (tight and compact).
- **Control Elements:** 6px (buttons, inputs, code blocks).
- **Cards & Toasts:** 8px (standard container radius).
- **Modals:** 12px (softest radius, used for the highest-level containers).

## Components
- **Buttons:** 6px radius, `body-sm` font. Primary variant uses the Indigo background; secondary uses `bg-raised` with a `border-subtle`.
- **Inputs:** `bg-raised` surface with `border-subtle`. On focus, transition to `border-default` with a 2px Indigo offset and a subtle `accent-glow`.
- **Cards:** Use `bg-surface` with `20px` padding. Hover states transition the background to `bg-raised`.
- **Chips/Badges:** 4px radius, `label-xs` font. Use subtle backgrounds (e.g., Indigo at 10% opacity) for low-priority tags.
- **Status Indicators:** Use 8px circular "Live" dots for status. Success uses Emerald, Warning uses Amber, and Error uses Red.
- **Sidebar:** Active items are indicated by a `2px` Indigo solid border on the left-hand side only, with a text color shift to `text-primary`.
- **Data Tables:** High density, `body-sm` text. Use `border-subtle` for row dividers. Numeric columns must use the Mono font stack.