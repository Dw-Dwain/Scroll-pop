/**
 * ScrollPop Cookie-Consent Banner — packages/snippet/src/consent.ts
 *
 * Lazy-loaded by the core snippet (loadChunk('consent.js')) when the site config has
 * consentBanner.enabled and the visitor has not yet made a choice. Renders a GDPR/CCPA-style
 * consent bar inside its OWN closed Shadow DOM — it never injects global CSS into the host page —
 * and reports the visitor's Accept/Reject choice back to the core via the onChoice callback.
 *
 * Security: every tenant-controlled value (message, button labels, policy URL, colors) is run
 * through the shared sanitize.ts helpers before it reaches the DOM (CLAUDE.md rule 5a). No raw
 * config value is ever interpolated into HTML/CSS unescaped. No eval/document.write.
 *
 * Attaches window.__sp_consent_banner = { show }.
 */
import { escapeHtml, safeHref, safeCssColor } from './sanitize';

interface ConsentBannerConfig {
  enabled?: boolean;
  message?: string;
  acceptText?: string;
  rejectText?: string;
  policyUrl?: string;
  policyText?: string;
  position?: 'bottom' | 'top';
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
}

(function () {
  'use strict';

  function show(cfg: ConsentBannerConfig, onChoice: (granted: boolean) => void): void {
    // Never mount twice (e.g. SPA re-init or a double loadChunk).
    if (document.getElementById('__sp_consent_host')) return;

    const accent = safeCssColor(cfg.accentColor, '#6366f1');
    const bg = safeCssColor(cfg.backgroundColor, '#111827');
    const fg = safeCssColor(cfg.textColor, '#f9fafb');
    const atTop = cfg.position === 'top';
    const message = escapeHtml(
      cfg.message ||
        'We use cookies to analyze traffic and improve your experience. Do you accept?',
    );
    const acceptText = escapeHtml(cfg.acceptText || 'Accept');
    const rejectText = escapeHtml(cfg.rejectText || 'Reject');
    const policyHref = cfg.policyUrl ? safeHref(cfg.policyUrl) : '';
    const policyText = escapeHtml(cfg.policyText || 'Privacy Policy');
    const policyLink =
      policyHref && policyHref !== '#'
        ? `<a href="${policyHref}" target="_blank" rel="noopener" style="color:${accent};text-decoration:underline;margin-left:6px;">${policyText}</a>`
        : '';

    const host = document.createElement('div');
    host.id = '__sp_consent_host';
    // Pin visible with inline !important so a host theme's global reset can't suppress the bar.
    host.style.cssText =
      'position:fixed!important;left:0!important;right:0!important;' +
      (atTop ? 'top:0!important;' : 'bottom:0!important;') +
      'z-index:2147483647!important;all:initial;';
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', 'Cookie consent');
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
<style>
.sp-cc{font-family:system-ui,sans-serif;background:${bg};color:${fg};padding:14px 18px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;box-shadow:0 ${atTop ? '2px' : '-2px'} 16px rgba(0,0,0,.2);}
.sp-cc p{margin:0;font-size:13px;line-height:1.4;flex:1 1 240px;}
.sp-cc-btns{display:flex;gap:8px;flex:0 0 auto;}
.sp-cc button{cursor:pointer;border:none;border-radius:6px;padding:9px 18px;font-size:13px;font-weight:600;font-family:inherit;}
.sp-cc-accept{background:${accent};color:#fff;}
.sp-cc-reject{background:transparent;color:${fg};border:1px solid ${fg}!important;opacity:.85;}
.sp-cc button:focus{outline:2px solid ${accent};outline-offset:2px;}
</style>
<div class="sp-cc">
  <p>${message}${policyLink}</p>
  <div class="sp-cc-btns">
    <button class="sp-cc-reject" id="sp-cc-reject" type="button">${rejectText}</button>
    <button class="sp-cc-accept" id="sp-cc-accept" type="button">${acceptText}</button>
  </div>
</div>`;

    const close = (granted: boolean): void => {
      try { host.remove(); } catch { /* already gone */ }
      try { onChoice(granted); } catch { /* core callback failure must not throw onto host page */ }
    };
    shadow.getElementById('sp-cc-accept')?.addEventListener('click', () => close(true));
    shadow.getElementById('sp-cc-reject')?.addEventListener('click', () => close(false));
    // a11y: keyboard users land on the primary action.
    (shadow.getElementById('sp-cc-accept') as HTMLElement | null)?.focus();
  }

  (window as any).__sp_consent_banner = { show };
})();
