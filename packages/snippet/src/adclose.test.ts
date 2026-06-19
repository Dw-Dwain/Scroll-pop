import { describe, it, expect, beforeAll } from 'vitest';

// adclose.ts is an IIFE that attaches window.__sp_adclose on load, so a fake `window` must exist
// before the module is imported. We import it once, then drive the installed handler.
const opened: string[] = [];
let spAdclose: (ctx: Record<string, unknown>) => void;

beforeAll(async () => {
  (globalThis as Record<string, unknown>)['window'] = { open: (u: string) => { opened.push(u); return null; } };
  await import('./adclose'); // runs the IIFE → attaches window.__sp_adclose
  spAdclose = ((globalThis as Record<string, unknown>)['window'] as { __sp_adclose: typeof spAdclose }).__sp_adclose;
});

function run(ctx: Record<string, unknown>) {
  let installed: (() => void) | null = null;
  const beacons: Array<Record<string, unknown>> = [];
  const dismisses: Array<Record<string, unknown>> = [];
  spAdclose({
    injectMacros: (s: string) => s,
    safeHref: (s: string) => (/^https?:\/\//.test(s) ? s : 'https://' + s), // mimic real scheme-fix
    beaconEvent: (_c: unknown, t: string, sid: string, meta: unknown) => beacons.push({ t, sid, meta }),
    getDisplayDuration: () => 1234,
    dismiss: (viaBtn: boolean, viaAd?: boolean) => dismisses.push({ viaBtn, viaAd }),
    setOnClose: (fn: () => void) => { installed = fn; },
    campaign: { id: 'c1' },
    ...ctx,
  });
  return { installed: installed as (() => void) | null, beacons, dismisses };
}

describe('adclose chunk — window.__sp_adclose', () => {
  it('installs a handler that opens the affiliate URL, beacons close_ad_click, and dismisses via-ad', () => {
    opened.length = 0;
    const { installed, beacons, dismisses } = run({
      closeEl: { extraProps: { adClose: true } },            // no href on the ✕
      elements: [
        { type: 'image', href: 'www.example-affiliate.com/deal?id=42' }, // scheme-less fallback target
        { type: 'close', extraProps: { adClose: true } },
      ],
      slot: { id: 'slot1' },
    });
    expect(typeof installed).toBe('function');
    installed!();
    expect(opened).toEqual(['https://www.example-affiliate.com/deal?id=42']);
    expect(beacons).toEqual([{ t: 'close_ad_click', sid: 'slot1', meta: { destinationUrl: 'https://www.example-affiliate.com/deal?id=42', displayDuration: 1234 } }]);
    expect(dismisses).toEqual([{ viaBtn: true, viaAd: true }]);
  });

  it('prefers an explicit close href over element/slot fallbacks', () => {
    opened.length = 0;
    const { installed } = run({
      closeEl: { href: 'https://amazon.co.jp/dp/1?tag=t-22' },
      elements: [{ type: 'image', href: 'https://other.example/x' }],
      slot: { id: 's', click_tracker_url: 'https://track.example/c' },
    });
    installed!();
    expect(opened).toEqual(['https://amazon.co.jp/dp/1?tag=t-22']);
  });

  it('falls back to the affiliate slot tracker URL when no element href is usable', () => {
    opened.length = 0;
    const { installed } = run({
      closeEl: { extraProps: { adClose: true } },
      elements: [{ type: 'image', href: 'https://x/YOUR_TAG' }], // placeholder → rejected
      slot: { id: 's', click_tracker_url: 'https://track.example/c' },
    });
    installed!();
    expect(opened).toEqual(['https://track.example/c']);
  });

  it('installs NO handler when nothing resolves to a usable URL (core plain-dismiss stays)', () => {
    opened.length = 0;
    const { installed } = run({
      closeEl: { extraProps: { adClose: true } },
      elements: [{ type: 'image' }],
      slot: undefined,
    });
    expect(installed).toBeNull();
    expect(opened).toEqual([]);
  });
});
