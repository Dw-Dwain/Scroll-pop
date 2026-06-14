import { describe, it, expect } from 'vitest';
import { stripJourneyStepTriggers, journeyCampaignIds } from './journey-config.js';
import type { SiteConfigPayload } from '@scrollpop/shared';

type Campaign = SiteConfigPayload['campaigns'][number];

function campaign(id: string, withTrigger = true): Campaign {
  return {
    id,
    design: {} as Campaign['design'],
    triggers: (withTrigger ? [{ id: 't1', type: 'dwell_time', params: { seconds: 5 } }] : []) as Campaign['triggers'],
    targeting: [],
    frequency: { frequency: 'always' } as Campaign['frequency'],
    affiliateSlots: [],
  };
}

function journey(campaignIds: Array<string | null>): Record<string, unknown> {
  return {
    id: 'jny', entryNodeId: 'entry',
    nodes: [
      { id: 'entry', type: 'entry', next: { always: 'p0' } },
      ...campaignIds.map((cid, i) => ({ id: `p${i}`, type: 'popup', campaignId: cid ?? undefined, next: {} })),
      { id: 'goal', type: 'goal', next: {} },
    ],
  };
}

describe('journeyCampaignIds', () => {
  it('collects campaign ids from popup nodes across journeys (deduped)', () => {
    const ids = journeyCampaignIds([journey(['a', 'b']), journey(['b', 'c'])]);
    expect([...ids].sort()).toEqual(['a', 'b', 'c']);
  });

  it('ignores nodes without a string campaignId', () => {
    expect(journeyCampaignIds([journey([null])]).size).toBe(0);
  });

  it('returns empty for no journeys / malformed journeys', () => {
    expect(journeyCampaignIds([]).size).toBe(0);
    expect(journeyCampaignIds([{ nodes: 'oops' } as unknown as Record<string, unknown>]).size).toBe(0);
  });
});

describe('stripJourneyStepTriggers', () => {
  it('strips triggers from journey-referenced campaigns but keeps them in the payload', () => {
    const campaigns = [campaign('a'), campaign('b'), campaign('standalone')];
    const out = stripJourneyStepTriggers(campaigns, [journey(['a', 'b'])]);

    expect(out).toHaveLength(3); // none removed — engine still resolves them by id
    expect(out.find((c) => c.id === 'a')!.triggers).toEqual([]);
    expect(out.find((c) => c.id === 'b')!.triggers).toEqual([]);
    expect(out.find((c) => c.id === 'standalone')!.triggers).toHaveLength(1); // untouched
  });

  it('returns the same array when there are no journeys', () => {
    const campaigns = [campaign('a')];
    const out = stripJourneyStepTriggers(campaigns, []);
    expect(out).toBe(campaigns);
    expect(out[0]!.triggers).toHaveLength(1);
  });

  it('does not mutate the input campaigns', () => {
    const campaigns = [campaign('a')];
    stripJourneyStepTriggers(campaigns, [journey(['a'])]);
    expect(campaigns[0]!.triggers).toHaveLength(1); // original object untouched (map copies)
  });
});
