import { describe, it, expect } from 'vitest';
import { configHasAdClose, stripAdCloseFromCampaigns } from './grey-hat';

function campaign(adClose: boolean, withVariant = false) {
  const mk = (ac: boolean) => ({
    steps: {
      main: { elements: [{ type: 'image', href: 'https://amazon.co.jp/x' }, { type: 'close', href: 'https://amazon.co.jp/x', extraProps: { adClose: ac } }] },
    },
  });
  return {
    id: 'c1',
    design: mk(adClose),
    ...(withVariant ? { variants: [{ id: 'v1', weight: 50, design: mk(adClose) }] } : {}),
  };
}

describe('configHasAdClose', () => {
  it('detects ad-close on the base design', () => {
    expect(configHasAdClose([campaign(true)])).toBe(true);
    expect(configHasAdClose([campaign(false)])).toBe(false);
  });

  it('detects ad-close on an A/B variant design', () => {
    const c = campaign(false, true);
    (c as { variants: Array<{ design: { steps: { main: { elements: Array<Record<string, unknown>> } } } }> })
      .variants[0]!.design.steps.main.elements[1]!.extraProps = { adClose: true };
    expect(configHasAdClose([c])).toBe(true);
  });

  it('is false for an empty config', () => {
    expect(configHasAdClose([])).toBe(false);
  });
});

describe('stripAdCloseFromCampaigns', () => {
  it('neutralises ad-close on base + variant designs and drops the close href', () => {
    const c = campaign(true, true);
    stripAdCloseFromCampaigns([c]);

    const base = c.design.steps.main.elements;
    const closeBase = base.find((e: Record<string, unknown>) => e['type'] === 'close')!;
    expect((closeBase['extraProps'] as { adClose?: unknown }).adClose).toBe(false);
    expect('href' in closeBase).toBe(false);

    const v = (c as { variants: Array<{ design: { steps: { main: { elements: Array<Record<string, unknown>> } } } }> }).variants[0]!;
    const closeVar = v.design.steps.main.elements.find((e) => e['type'] === 'close')!;
    expect((closeVar['extraProps'] as { adClose?: unknown }).adClose).toBe(false);

    // The image element's affiliate link (a legitimate CTA, not a dismiss redirect) is untouched.
    expect(base.find((e: Record<string, unknown>) => e['type'] === 'image')!['href']).toBe('https://amazon.co.jp/x');

    expect(configHasAdClose([c])).toBe(false);
  });
});
