/**
 * ScrollPop X-close affiliate redirect — packages/snippet/src/adclose.ts
 *
 * Lazy chunk loaded by the core (loadChunk('adclose.js')) ONLY when a campaign's close (✕) element
 * opts into adClose (extraProps.adClose === true). The X-close → affiliate redirect lives HERE, not
 * in the core p.js, so a site that never serves an adClose config never downloads this code — the
 * served core binary literally cannot perform the redirect (code-isolation / attestation, layer 6).
 * The server-side Novatise gate (apps/api) only ever puts adClose in Novatise configs, so in
 * practice only Novatise sites ever fetch this chunk.
 *
 * The core wires the ✕ to a plain dismiss by default; this chunk installs the redirect behaviour
 * via ctx.setOnClose once loaded. If the chunk is blocked/slow the ✕ still closes (graceful).
 *
 * Attaches window.__sp_adclose(ctx). Tenant-controlled hrefs are sanitized via the safeHref the
 * core passes in (CLAUDE.md rule 5a) before reaching window.open.
 */

interface AdCloseCtx {
  /** The popup's close (✕) element from the main step. */
  closeEl: { href?: string; extraProps?: { href?: string } } | null | undefined;
  /** All main-step elements — scanned for the affiliate link when the ✕ itself has none. */
  elements: Array<{ href?: string; extraProps?: { href?: string } }> | undefined;
  /** The allocated affiliate slot (last-resort redirect target). */
  slot: { id?: string; click_tracker_url?: string; product_url?: string } | undefined;
  campaign: unknown;
  injectMacros: (s: string) => string;
  safeHref: (s: string) => string;
  beaconEvent: (campaign: unknown, type: string, slotId?: string, meta?: Record<string, unknown>) => void;
  getDisplayDuration: () => number;
  dismiss: (viaButton: boolean, viaAd?: boolean) => void;
  /** Installs the ✕ click behaviour the core invokes. */
  setOnClose: (fn: () => void) => void;
}

(function () {
  'use strict';

  (window as Window & { __sp_adclose?: (ctx: AdCloseCtx) => void }).__sp_adclose = function (ctx: AdCloseCtx): void {
    const { closeEl, elements, slot } = ctx;

    // Target priority mirrors the designer preview's getStepAffiliate so production matches the
    // simulation: explicit close href → the step's first usable element href (creative templates
    // put the affiliate link on the image, not the ✕) → the affiliate slot tracker/product URL.
    let href = closeEl?.href || '';
    if (!href && Array.isArray(elements)) {
      for (const e of elements) {
        const l = e?.href || e?.extraProps?.href;
        if (typeof l === 'string' && l.length > 4 && !l.includes('YOUR_') && !l.includes('REPLACE-')) {
          href = l;
          break;
        }
      }
    }
    if (!href) href = slot?.click_tracker_url || slot?.product_url || '';

    const safe = href ? ctx.safeHref(ctx.injectMacros(href)) : '';
    const url = safe && safe !== '#' ? safe : null;
    if (!url) return; // nothing valid to redirect to — the core's plain dismiss stays in place

    ctx.setOnClose(function () {
      // ONE click opens the affiliate redirect in a new tab AND closes the popup.
      // Beacon as 'close_ad_click' (NOT 'click') so the X-close redirect stays out of Clicks/CTR.
      // viaAd=true exempts this close from rage suppression (re-shows stay alive).
      window.open(url, '_blank', 'noopener');
      ctx.beaconEvent(ctx.campaign, 'close_ad_click', slot?.id, {
        destinationUrl: url,
        displayDuration: ctx.getDisplayDuration(),
      });
      ctx.dismiss(true, true);
    });
  };
})();

// Mark this file as an ES module (it's otherwise a side-effect-only IIFE) so it can be imported
// from the unit test. esbuild still emits the same IIFE bundle for the chunk.
export {};
