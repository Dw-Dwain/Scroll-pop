import type { SiteConfigPayload } from '@scrollpop/shared';

type ServedCampaigns = SiteConfigPayload['campaigns'];

/**
 * Collect every campaign id referenced by a compiled journey's nodes. Popup nodes carry a
 * `campaignId`; we treat any node with a string campaignId as a reference.
 */
export function journeyCampaignIds(compiledJourneys: ReadonlyArray<Record<string, unknown>>): Set<string> {
  const ids = new Set<string>();
  for (const j of compiledJourneys) {
    const nodes = (j as { nodes?: unknown }).nodes;
    if (!Array.isArray(nodes)) continue;
    for (const n of nodes as Array<{ campaignId?: unknown }>) {
      if (n && typeof n.campaignId === 'string') ids.add(n.campaignId);
    }
  }
  return ids;
}

/**
 * Harden journeys against trigger desync.
 *
 * A campaign that is a step in an ACTIVE journey must be shown ONLY by that journey — never by its
 * own triggers. If it kept independent triggers, its own dwell/scroll/exit trigger could fire it
 * out of sequence; the journey's later `show()` for that node would then be frequency-capped and
 * silently short-circuit the branch (the engine is show-gated — see packages/snippet/src/journey.ts).
 *
 * Stripping a journey-step campaign's triggers in the served config makes that desync impossible:
 * with `triggers: []` the snippet's `registerCampaignTriggers` arms nothing for it, so the only way
 * it can appear is the engine's `ctx.show`. The campaign stays in the payload so `core.show(id)`
 * still resolves it.
 */
export function stripJourneyStepTriggers(
  campaigns: ServedCampaigns,
  compiledJourneys: ReadonlyArray<Record<string, unknown>>,
): ServedCampaigns {
  const ids = journeyCampaignIds(compiledJourneys);
  if (!ids.size) return campaigns;
  return campaigns.map((c) => (ids.has(c.id) ? { ...c, triggers: [] } : c));
}
