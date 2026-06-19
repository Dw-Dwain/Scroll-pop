import { describe, it, expect } from 'vitest';
import {
  isGreyHatTenant,
  killSwitchValueIsEnabled,
  hasAdClose,
  stripAdClose,
  applyGreyHatServePolicy,
  NOVATISE_ORG_KEY,
} from './grey-hat.js';

// A design with one main step containing a close (✕) element wired as an ad-close, plus an image
// element carrying a real affiliate link (a legitimate CTA, which must always survive a strip).
function design(opts: { adClose?: boolean; closeHref?: string; imageHref?: string } = {}) {
  const close: Record<string, unknown> = { id: 'x', type: 'close', extraProps: { adClose: opts.adClose ?? true } };
  if (opts.closeHref) close['href'] = opts.closeHref;
  return {
    steps: {
      main: {
        elements: [
          { id: 'img', type: 'image', href: opts.imageHref ?? 'https://amazon.co.jp/dp/1?tag=t-22' },
          close,
        ],
      },
    },
  };
}

describe('isGreyHatTenant', () => {
  it('is true only for the Novatise org key', () => {
    expect(isGreyHatTenant(NOVATISE_ORG_KEY)).toBe(true);
    expect(isGreyHatTenant('org_acme')).toBe(false);
    expect(isGreyHatTenant('personal_user_123')).toBe(false);
    expect(isGreyHatTenant(null)).toBe(false);
    expect(isGreyHatTenant(undefined)).toBe(false);
  });
});

describe('killSwitchValueIsEnabled (must match the Worker readKillSwitch)', () => {
  it('treats a set/truthy value as ON', () => {
    for (const v of ['1', 'on', 'true', 'yes', 'kill', ' 1 ']) expect(killSwitchValueIsEnabled(v)).toBe(true);
  });
  it('treats empty / falsey sentinels as OFF', () => {
    for (const v of ['', '   ', '0', 'false', 'off', 'FALSE', 'Off', ' 0 ']) expect(killSwitchValueIsEnabled(v)).toBe(false);
  });
});

describe('hasAdClose', () => {
  it('detects an ad-close close element', () => {
    expect(hasAdClose(design({ adClose: true }))).toBe(true);
    expect(hasAdClose(design({ adClose: false }))).toBe(false);
    expect(hasAdClose({ steps: { main: { elements: [{ type: 'close' }] } } })).toBe(false);
  });
});

describe('stripAdClose', () => {
  it('neutralises the close element and drops its href', () => {
    const d = design({ adClose: true, closeHref: 'https://amazon.com/a' });
    expect(stripAdClose(d)).toBe(true);
    const close = (d.steps.main.elements as Array<Record<string, unknown>>).find((e) => e['type'] === 'close')!;
    expect((close['extraProps'] as { adClose?: unknown }).adClose).toBe(false);
    expect('href' in close).toBe(false);
    expect(hasAdClose(d)).toBe(false);
  });

  it('leaves the image element CTA link untouched (a deliberate click, not a dismiss redirect)', () => {
    const d = design({ adClose: true, imageHref: 'https://amazon.co.jp/dp/9?tag=t-22' });
    stripAdClose(d);
    const img = (d.steps.main.elements as Array<Record<string, unknown>>).find((e) => e['type'] === 'image')!;
    expect(img['href']).toBe('https://amazon.co.jp/dp/9?tag=t-22');
  });

  it('leaves a design without an ad-close unchanged', () => {
    expect(stripAdClose({ steps: { main: { elements: [{ type: 'close' }] } } })).toBe(false);
  });
});

describe('applyGreyHatServePolicy (master gate — Novatise isolation)', () => {
  it('strips for a non-Novatise tenant, regardless of destination network', () => {
    const amazon = design({ closeHref: 'https://amazon.co.jp/dp/1?tag=t-22' });
    expect(applyGreyHatServePolicy(amazon, /* greyHatAllowed */ false)).toBe(true);
    expect(hasAdClose(amazon)).toBe(false);

    const other = design({ closeHref: 'https://shop.example.com/deal' });
    expect(applyGreyHatServePolicy(other, false)).toBe(true);
    expect(hasAdClose(other)).toBe(false);
  });

  it('leaves the X-close redirect intact for Novatise, including Amazon/Rakuten destinations', () => {
    const amazon = design({ closeHref: 'https://amazon.co.jp/dp/1?tag=t-22' });
    expect(applyGreyHatServePolicy(amazon, true)).toBe(false);
    expect(hasAdClose(amazon)).toBe(true);

    const rakuten = design({ closeHref: 'https://item.rakuten.co.jp/shop/x/' });
    expect(applyGreyHatServePolicy(rakuten, true)).toBe(false);
    expect(hasAdClose(rakuten)).toBe(true);
  });
});
