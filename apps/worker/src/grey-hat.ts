/**
 * Grey-hat (X-close → affiliate redirect) EDGE containment.
 *
 * The origin (apps/api) already gates this at config assembly, but the Worker re-enforces it on
 * every request so the global kill switch is INSTANT (no deploy, no waiting for a KV-cached config
 * to expire) and a stale/forced KV config still can't enable it. These are intentionally a behaviour
 * duplicate of apps/api/src/lib/grey-hat.ts — the Worker is a separate bundle and `@scrollpop/shared`
 * holds only types/Zod (no runtime), so the logic can't be imported. Kept minimal: detect + strip.
 * The matching unit tests in both packages guard against the two copies drifting.
 */

/** The design `steps` are emitted as either an object keyed by step id or an array of steps. */
function stepsOf(design: unknown): Array<{ elements?: unknown }> {
  const s = (design as { steps?: unknown } | null | undefined)?.steps;
  if (Array.isArray(s)) return s as Array<{ elements?: unknown }>;
  if (s && typeof s === 'object') return Object.values(s as Record<string, { elements?: unknown }>);
  return [];
}

/** Every design carried by a campaign (its base design + any A/B variant designs). */
function designsOf(campaign: unknown): unknown[] {
  const base = (campaign as { design?: unknown }).design;
  const variants = (campaign as { variants?: Array<{ design?: unknown }> }).variants;
  const out: unknown[] = [base];
  if (Array.isArray(variants)) for (const v of variants) out.push(v?.design);
  return out;
}

function isAdCloseEl(el: Record<string, unknown>): boolean {
  return el?.['type'] === 'close' &&
    (el['extraProps'] as { adClose?: unknown } | undefined)?.adClose === true;
}

/** Does any campaign (or A/B variant) carry a close (✕) element wired as an ad-close? */
export function configHasAdClose(campaigns: unknown[]): boolean {
  for (const c of campaigns) {
    for (const d of designsOf(c)) {
      for (const step of stepsOf(d)) {
        const els = Array.isArray(step?.elements) ? (step.elements as Array<Record<string, unknown>>) : [];
        if (els.some(isAdCloseEl)) return true;
      }
    }
  }
  return false;
}

/** Neutralise every ad-close across all campaigns/variants IN PLACE: the ✕ reverts to a plain dismiss. */
export function stripAdCloseFromCampaigns(campaigns: unknown[]): void {
  for (const c of campaigns) {
    for (const d of designsOf(c)) {
      for (const step of stepsOf(d)) {
        const els = Array.isArray(step?.elements) ? (step.elements as Array<Record<string, unknown>>) : [];
        for (const el of els) {
          if (el?.['type'] !== 'close') continue;
          const extra = el['extraProps'] as Record<string, unknown> | undefined;
          if (extra && extra['adClose'] === true) extra['adClose'] = false;
          if ('href' in el) delete el['href'];
          if (extra && 'href' in extra) delete extra['href'];
        }
      }
    }
  }
}
