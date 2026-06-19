/**
 * Grey-hat affiliate containment (the "X-close → affiliate redirect" tactic).
 *
 * The snippet only fires a close-redirect when a popup's close (✕) element carries
 * `extraProps.adClose === true` AND resolves to a destination href. We contain that tactic
 * in the CONFIG the edge serves — NOT in the snippet binary — so it stays isolated to the one
 * party that runs it by choice, and can be turned off centrally and instantly:
 *
 *   Master gate (layer 4): the X-close redirect is permitted ONLY for the Novatise org tenant
 *     (`tenant.clerkOrgId === 'org_novatise'`). Every other account (free/agency) gets a plain ✕.
 *     This is the ISOLATION: if Novatise/Jon's affiliate accounts ever get hit for this, no other
 *     client is exposed — they never had it. Enforced server-side at WRITE (designs route strips
 *     it from non-Novatise saves) AND SERVE (config assembly strips it from non-Novatise payloads,
 *     so even a leaked/forced config can't enable it). The dashboard hides the toggle (cosmetic).
 *   Kill switch (layer 2): a global KV flip the Worker honours per-request (see apps/worker) —
 *     the instant, no-deploy off-ramp if a network audit lands on Novatise.
 *
 * NOTE: there is intentionally NO per-network restriction. Novatise's affiliate play IS Amazon /
 * Rakuten, and Jon has accepted that risk on his own accounts — the job is to ISOLATE it to him,
 * not to second-guess what he runs within his own tenant. The kill switch is the off-ramp.
 *
 * "Strip" = neutralise the close element so the ✕ just dismisses: drop `extraProps.adClose` and
 * any close href. The snippet's entire close-redirect path is gated on `adClose === true`, so this
 * is the precise off switch. Image/button CTA hrefs are NOT touched — those are legitimate clicks
 * (a deliberate tap on the creative), not the dismiss-gesture redirect, and fire normally for every
 * tenant and every network.
 *
 * Pure functions only — no DB/Fastify imports — so they're trivially unit-testable and can run at
 * both the write and serve layers.
 */

/** The single shared tenant that every verified @novatise.com login maps to. Mirrors the value
 *  in plugins/tenant-context.ts (imported there to avoid drift). */
export const NOVATISE_ORG_KEY = 'org_novatise';

/** True only for the Novatise org tenant — the sole tenant permitted to run grey-hat tactics. */
export function isGreyHatTenant(clerkOrgId: string | null | undefined): boolean {
  return clerkOrgId === NOVATISE_ORG_KEY;
}

// ─── Design-config traversal ────────────────────────────────────────────────────
// The visual builder emits `steps` as either an object keyed by step id ({ main, success, … })
// or an array of step objects ({ id, elements }). The snippet reads both; so do we.

type Element = Record<string, unknown>;
type Step = { elements?: unknown };

function stepsOf(design: unknown): Step[] {
  const s = (design as { steps?: unknown } | null | undefined)?.steps;
  if (Array.isArray(s)) return s as Step[];
  if (s && typeof s === 'object') return Object.values(s as Record<string, Step>);
  return [];
}

function elementsOf(step: Step | undefined): Element[] {
  return Array.isArray(step?.elements) ? (step!.elements as Element[]) : [];
}

/** Does this design have at least one close (✕) element wired as an ad-close? */
export function hasAdClose(design: unknown): boolean {
  for (const step of stepsOf(design)) {
    for (const el of elementsOf(step)) {
      if (el?.['type'] === 'close' && (el['extraProps'] as { adClose?: unknown } | undefined)?.adClose === true) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Neutralise every ad-close in a design IN PLACE: the ✕ goes back to a plain dismiss.
 * Returns whether anything changed. Mutation is safe — callers pass DB-fresh / cloned objects.
 */
export function stripAdClose(design: unknown): boolean {
  let changed = false;
  for (const step of stepsOf(design)) {
    for (const el of elementsOf(step)) {
      if (el?.['type'] !== 'close') continue;
      const extra = el['extraProps'] as Record<string, unknown> | undefined;
      if (extra && extra['adClose'] === true) { extra['adClose'] = false; changed = true; }
      // Belt-and-suspenders: drop the close destination so there's nothing to redirect to even
      // if a future snippet path stops gating strictly on adClose.
      if ('href' in el) { delete el['href']; changed = true; }
      if (extra && 'href' in extra) { delete extra['href']; changed = true; }
    }
  }
  return changed;
}

/**
 * Serve-time grey-hat master gate for one design, applied IN PLACE:
 *   - Novatise tenant  → leave as-is (they run it by choice; the KV kill switch is the off-ramp).
 *   - everyone else    → strip (isolation — no other client can receive the X-close redirect).
 * Returns whether the design was stripped.
 */
export function applyGreyHatServePolicy(design: unknown, greyHatAllowed: boolean): boolean {
  if (greyHatAllowed) return false;
  return stripAdClose(design);
}
