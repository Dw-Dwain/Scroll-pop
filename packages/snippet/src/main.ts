/**
 * ScrollPop Snippet — packages/snippet/src/main.ts
 *
 * PERFORMANCE BUDGET: must stay under 10 KB gzipped after build.
 * SECURITY: NEVER touch browser navigation history (pushState, replaceState, or popstate).
 * See CLAUDE.md rules #1 and #2.
 *
 * Architecture:
 * 1. Fetch site config from edge
 * 2. Evaluate targeting rules
 * 3. Register triggers
 * 4. On trigger: check frequency cap → render popup in Shadow DOM
 * 5. Beacon events
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface AffiliateSlot {
  id: string;
  product_name: string;
  product_url: string;
  image_url: string;
  click_tracker_url: string;
  cta_text: string;
  weight: number;
}

interface TriggerConfig {
  id: string;
  type: 'scroll_pct' | 'dwell_time' | 'inactivity' | 'exit_intent_mouse' | 'click';
  params: Record<string, unknown>;
}

interface TargetingRule {
  id: string;
  kind: 'url_exact' | 'url_contains' | 'url_regex' | 'device' | 'returning_visitor';
  operator: 'include' | 'exclude';
  value: Record<string, unknown>;
}

interface FrequencyRule {
  frequency: 'once_per_session' | 'once_per_day' | 'once_per_visitor' | 'always';
}

interface DesignConfig {
  kind: 'modal' | 'slide_in' | 'banner' | 'bar' | 'fullscreen';
  position: 'center' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom';
  size: 'sm' | 'md' | 'lg';
  backgroundColor: string;
  backgroundImage?: string;
  textColor: string;
  accentColor: string;
  borderRadius: number;
  overlayEnabled: boolean;
  overlayOpacity: number;
  headline: string;
  subheadline?: string;
  bodyText?: string;
  ctaText: string;
  ctaStyle: 'button' | 'text_link';
  showCloseButton: boolean;
  closeButtonPosition: 'top-right' | 'top-left';
  showDismissText: boolean;
  dismissText?: string;
  animation: 'fade' | 'slide_up' | 'slide_down' | 'zoom' | 'none';
  showPoweredBy: boolean;
}

interface CampaignConfig {
  id: string;
  design: DesignConfig;
  triggers: TriggerConfig[];
  targeting: TargetingRule[];
  frequency: FrequencyRule;
  affiliateSlots: AffiliateSlot[];
}

interface SiteConfig {
  siteId: string;
  campaigns: CampaignConfig[];
  version: string;
}

function getEdgeUrl(): string {
  if (typeof window !== 'undefined' && (window as any).__SP_EDGE_URL) {
    return (window as any).__SP_EDGE_URL;
  }

  // Fallback 1: Extract origin from document.currentScript src
  if (typeof document !== 'undefined') {
    const currentScript = document.currentScript as HTMLScriptElement;
    if (currentScript?.src) {
      try {
        const urlObj = new URL(currentScript.src);
        if (!urlObj.hostname.includes('cdn.scrollpop.io')) {
          return urlObj.origin;
        }
      } catch {}
    }

    // Fallback 2: Find script tags containing '/p.js'
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i]?.src;
      if (src && src.includes('/p.js')) {
        try {
          const urlObj = new URL(src);
          if (!urlObj.hostname.includes('cdn.scrollpop.io')) {
            return urlObj.origin;
          }
        } catch {}
      }
    }
  }

  return 'https://edge.scrollpop.io';
}

const EDGE_URL = getEdgeUrl();

// ─── Entry Point ──────────────────────────────────────────────────────────────

function init(publicKey: string): void {
  console.log('[ScrollPop] Bootstrapping snippet with key:', publicKey);
  // Defer until page is interactive — don't block LCP
  const run = () => fetchConfigAndBoot(publicKey);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    // Use requestIdleCallback if available, else rAF → setTimeout
    if ('requestIdleCallback' in window) {
      requestIdleCallback(run, { timeout: 4000 });
    } else {
      requestAnimationFrame(() => setTimeout(run, 0));
    }
  }
}

async function fetchConfigAndBoot(publicKey: string): Promise<void> {
  try {
    const url = `${EDGE_URL}/c/${publicKey}`;
    console.log('[ScrollPop] Fetching configuration from:', url);
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      console.error('[ScrollPop] Failed to fetch config, status:', res.status);
      return;
    }

    const config: SiteConfig = await res.json() as SiteConfig;
    console.log('[ScrollPop] Config loaded successfully:', config);

    if (!config.campaigns || config.campaigns.length === 0) {
      console.warn('[ScrollPop] No active campaigns found for this site.');
      return;
    }

    for (const campaign of config.campaigns) {
      if (meetsTargetingRules(campaign.targeting)) {
        console.log('[ScrollPop] Registering triggers for campaign:', campaign.id);
        registerCampaignTriggers(campaign);
      } else {
        console.log('[ScrollPop] Campaign targeting rules not met for:', campaign.id);
      }
    }
  } catch (e) {
    console.error('[ScrollPop] Error booting snippet:', e);
    // Silent fail — never throw errors onto the host page
  }
}

// ─── Targeting ────────────────────────────────────────────────────────────────

function meetsTargetingRules(rules: TargetingRule[]): boolean {
  if (rules.length === 0) return true;

  for (const rule of rules) {
    const matches = evaluateRule(rule);
    if (rule.operator === 'include' && !matches) return false;
    if (rule.operator === 'exclude' && matches) return false;
  }
  return true;
}

function evaluateRule(rule: TargetingRule): boolean {
  const { kind, value } = rule;
  const url = window.location.href;

  switch (kind) {
    case 'url_exact':
      return url === (value['url'] as string);

    case 'url_contains':
      return url.includes(value['pattern'] as string);

    case 'url_regex': {
      try {
        return new RegExp(value['pattern'] as string).test(url);
      } catch {
        return false;
      }
    }

    case 'device': {
      const target = (value['device'] as string) ?? 'all';
      if (target === 'all') return true;
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      const isTablet = /iPad|Tablet/i.test(navigator.userAgent);
      if (target === 'mobile') return isMobile && !isTablet;
      if (target === 'tablet') return isTablet;
      if (target === 'desktop') return !isMobile;
      return true;
    }

    case 'returning_visitor': {
      const isReturning = !!localStorage.getItem('_sp_visited');
      localStorage.setItem('_sp_visited', '1');
      return isReturning === (value['is_returning'] as boolean);
    }

    default:
      return true;
  }
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

function registerCampaignTriggers(campaign: CampaignConfig): void {
  let fired = false;

  const fire = () => {
    if (fired) return;
    if (!checkFrequencyCap(campaign.id, campaign.frequency.frequency)) {
      console.warn('[ScrollPop] Frequency cap met, skipping display for campaign:', campaign.id);
      return;
    }
    fired = true;
    console.log('[ScrollPop] Trigger fired! Displaying campaign popup:', campaign.id);
    beaconEvent(campaign, 'impression');
    renderPopup(campaign);
    setFrequencyCap(campaign.id, campaign.frequency.frequency);
  };

  for (const trigger of campaign.triggers) {
    console.log('[ScrollPop] Registering trigger:', trigger.type, trigger.params);
    registerTrigger(trigger, fire);
  }
}

function registerTrigger(trigger: TriggerConfig, fire: () => void): void {
  switch (trigger.type) {
    // ✅ SAFE: scroll position — no history manipulation
    case 'scroll_pct': {
      const targetPct = (trigger.params['pct'] as number) ?? 50;
      const onScroll = () => {
        const scrolled = window.scrollY;
        const total = document.body.scrollHeight - window.innerHeight;
        if (total <= 0) return;
        const pct = (scrolled / total) * 100;
        if (pct >= targetPct) {
          window.removeEventListener('scroll', onScroll);
          fire();
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      break;
    }

    // ✅ SAFE: time on page
    case 'dwell_time': {
      const seconds = (trigger.params['seconds'] as number) ?? 30;
      setTimeout(fire, seconds * 1000);
      break;
    }

    // ✅ SAFE: inactivity detection
    case 'inactivity': {
      const seconds = (trigger.params['seconds'] as number) ?? 60;
      let timer = setTimeout(fire, seconds * 1000);
      const resetTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(fire, seconds * 1000);
      };
      ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach((evt) =>
        document.addEventListener(evt, resetTimer, { passive: true })
      );
      break;
    }

    // ✅ SAFE: cursor leaving viewport toward top (NOT popstate/history)
    case 'exit_intent_mouse': {
      const sensitivity = (trigger.params['sensitivity'] as number) ?? 20;
      const onMouseMove = (e: MouseEvent) => {
        if (e.clientY <= sensitivity) {
          document.removeEventListener('mousemove', onMouseMove);
          fire();
        }
      };
      document.addEventListener('mousemove', onMouseMove);
      break;
    }

    // ✅ SAFE: element click trigger
    case 'click': {
      const selector = trigger.params['selector'] as string;
      if (!selector) break;
      const onDocClick = (e: Event) => {
        const target = e.target as Element;
        if (target.closest(selector)) {
          document.removeEventListener('click', onDocClick);
          fire();
        }
      };
      document.addEventListener('click', onDocClick);
      break;
    }

    // ❌ Back button hijacking / pop state events are NOT implemented.
    // This is intentional — see CLAUDE.md rule #1.
  }
}

// ─── Frequency Capping ────────────────────────────────────────────────────────

function checkFrequencyCap(campaignId: string, frequency: string): boolean {
  const key = `_sp_${campaignId}`;
  const stored = localStorage.getItem(key);
  if (!stored) return true;

  const { ts } = JSON.parse(stored) as { ts: number };
  const now = Date.now();

  switch (frequency) {
    case 'once_per_visitor':
      return false; // Already shown to this visitor

    case 'once_per_day':
      return now - ts > 86400000; // 24h

    case 'once_per_session':
      return now - ts > (sessionStorage.getItem(`_sp_session_${campaignId}`) ? 0 : Infinity);

    case 'always':
      return true;

    default:
      return true;
  }
}

function setFrequencyCap(campaignId: string, frequency: string): void {
  const key = `_sp_${campaignId}`;
  localStorage.setItem(key, JSON.stringify({ ts: Date.now() }));
  if (frequency === 'once_per_session') {
    sessionStorage.setItem(`_sp_session_${campaignId}`, '1');
  }
}

// ─── Popup Rendering (Shadow DOM) ─────────────────────────────────────────────

function renderPopup(campaign: CampaignConfig): void {
  const { design, affiliateSlots, id: campaignId } = campaign;

  // Pick weighted affiliate slot
  const slot = pickWeightedSlot(affiliateSlots);

  // Create host element
  const host = document.createElement('div');
  host.id = `__sp_popup_${campaignId}`;
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', design.headline);
  document.body.appendChild(host);

  // Attach Shadow DOM — CSS isolation
  const shadow = host.attachShadow({ mode: 'closed' });

  const sizeMap = { sm: '360px', md: '480px', lg: '600px' };
  const width = sizeMap[design.size] ?? '480px';

  const positionStyles = getPositionStyles(design);

  shadow.innerHTML = `
    <style>
      :host { all: initial; font-family: system-ui, sans-serif; }
      ${design.overlayEnabled ? `
      .overlay {
        position: fixed; inset: 0; z-index: 2147483646;
        background: rgba(0,0,0,${design.overlayOpacity ?? 0.5});
        animation: sp-fade-in 0.2s ease;
      }` : ''}
      .popup {
        position: fixed; z-index: 2147483647;
        background: ${design.backgroundColor};
        ${design.backgroundImage ? `background-image: url(${design.backgroundImage}); background-size: cover; background-position: center;` : ''}
        color: ${design.textColor};
        border-radius: ${design.borderRadius}px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        width: ${width}; max-width: calc(100vw - 32px);
        ${positionStyles}
        animation: ${getAnimation(design.animation)};
        overflow: hidden;
      }
      .popup-inner { padding: 24px; }
      .close-btn {
        position: absolute;
        ${design.closeButtonPosition === 'top-right' ? 'top: 12px; right: 12px;' : 'top: 12px; left: 12px;'}
        background: none; border: none; cursor: pointer;
        font-size: 18px; color: ${design.textColor}; opacity: 0.6;
        padding: 4px 8px; border-radius: 4px;
      }
      .close-btn:hover { opacity: 1; background: rgba(0,0,0,0.1); }
      .headline { font-size: 20px; font-weight: 700; margin: 0 0 8px; line-height: 1.3; }
      .subheadline { font-size: 14px; opacity: 0.8; margin: 0 0 16px; }
      .body-text { font-size: 14px; margin: 0 0 16px; line-height: 1.5; }
      .product-image { width: 100%; border-radius: 8px; margin-bottom: 16px; display: block; }
      .cta-btn {
        display: inline-block; width: 100%; text-align: center;
        background: ${design.accentColor}; color: #fff;
        padding: 12px 24px; border-radius: 8px;
        font-weight: 600; font-size: 15px;
        text-decoration: none; box-sizing: border-box;
        transition: opacity 0.15s;
      }
      .cta-btn:hover { opacity: 0.9; }
      .cta-link { color: ${design.accentColor}; text-decoration: underline; font-size: 14px; }
      .dismiss-text { text-align: center; margin-top: 12px; font-size: 12px; opacity: 0.6; cursor: pointer; }
      .dismiss-text:hover { opacity: 1; }
      .powered-by { text-align: center; margin-top: 8px; font-size: 10px; opacity: 0.4; }
      @keyframes sp-fade-in { from { opacity: 0 } to { opacity: 1 } }
      @keyframes sp-slide-up { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: translateY(0) } }
      @keyframes sp-slide-down { from { opacity: 0; transform: translateY(-40px) } to { opacity: 1; transform: translateY(0) } }
      @keyframes sp-zoom { from { opacity: 0; transform: scale(0.9) } to { opacity: 1; transform: scale(1) } }
    </style>

    ${design.overlayEnabled ? '<div class="overlay" id="overlay"></div>' : ''}

    <div class="popup" role="dialog">
      ${design.showCloseButton ? '<button class="close-btn" id="close-btn" aria-label="Close">✕</button>' : ''}
      <div class="popup-inner">
        <h2 class="headline">${escapeHtml(design.headline)}</h2>
        ${design.subheadline ? `<p class="subheadline">${escapeHtml(design.subheadline)}</p>` : ''}
        ${design.bodyText ? `<p class="body-text">${escapeHtml(design.bodyText)}</p>` : ''}

        ${slot?.image_url ? `<img class="product-image" src="${escapeHtml(slot.image_url)}" alt="${escapeHtml(slot.product_name ?? '')}" loading="lazy">` : ''}

        ${slot ? (
    design.ctaStyle === 'button'
      ? `<a class="cta-btn" href="${escapeHtml(slot.click_tracker_url || slot.product_url)}" target="_blank" rel="noopener" id="cta-link">${escapeHtml(slot.cta_text || design.ctaText)}</a>`
      : `<a class="cta-link" href="${escapeHtml(slot.click_tracker_url || slot.product_url)}" target="_blank" rel="noopener" id="cta-link">${escapeHtml(slot.cta_text || design.ctaText)}</a>`
  ) : ''}

        ${design.showDismissText && design.dismissText
    ? `<p class="dismiss-text" id="dismiss-text">${escapeHtml(design.dismissText)}</p>`
    : ''}

        ${design.showPoweredBy ? '<p class="powered-by">Powered by ScrollPop</p>' : ''}
      </div>
    </div>
  `;

  const dismiss = () => {
    host.remove();
    
    // Open affiliate link if present, matching the client's request
    const url = slot?.click_tracker_url || slot?.product_url;
    if (url) {
      window.open(url, '_blank');
      beaconEvent(campaign, 'click', slot?.id);
    } else {
      beaconEvent(campaign, 'dismiss');
    }
  };

  // Wire up close button
  shadow.getElementById('close-btn')?.addEventListener('click', dismiss);
  shadow.getElementById('dismiss-text')?.addEventListener('click', dismiss);
  shadow.getElementById('overlay')?.addEventListener('click', dismiss);

  // Wire up CTA click → beacon then navigate
  shadow.getElementById('cta-link')?.addEventListener('click', () => {
    beaconEvent(campaign, 'click', slot?.id);
    // Navigation handled by the <a> href naturally — no JS redirect, no history manipulation
  });

  // Beacon view after 1s (user actually saw it)
  setTimeout(() => beaconEvent(campaign, 'view'), 1000);
}

function getPositionStyles(design: DesignConfig): string {
  switch (design.position) {
    case 'center': return 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
    case 'bottom-left': return 'bottom: 16px; left: 16px;';
    case 'bottom-right': return 'bottom: 16px; right: 16px;';
    case 'top': return 'top: 0; left: 0; right: 0; width: 100%; max-width: 100%; border-radius: 0;';
    case 'bottom': return 'bottom: 0; left: 0; right: 0; width: 100%; max-width: 100%; border-radius: 0;';
    default: return 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
  }
}

function getAnimation(animation: string): string {
  switch (animation) {
    case 'fade': return 'sp-fade-in 0.3s ease';
    case 'slide_up': return 'sp-slide-up 0.3s ease';
    case 'slide_down': return 'sp-slide-down 0.3s ease';
    case 'zoom': return 'sp-zoom 0.25s ease';
    default: return 'none';
  }
}

// ─── Affiliate Slot Weighting ─────────────────────────────────────────────────

function pickWeightedSlot(slots: AffiliateSlot[]): AffiliateSlot | null {
  if (slots.length === 0) return null;
  if (slots.length === 1) return slots[0] ?? null;

  const total = slots.reduce((sum, s) => sum + (s.weight ?? 1), 0);
  let rand = Math.random() * total;

  for (const slot of slots) {
    rand -= slot.weight ?? 1;
    if (rand <= 0) return slot;
  }
  return slots[slots.length - 1] ?? null;
}

// ─── Event Beaconing ──────────────────────────────────────────────────────────

function beaconEvent(
  campaign: CampaignConfig,
  eventType: 'impression' | 'view' | 'click' | 'dismiss' | 'conversion',
  affiliateSlotId?: string
): void {
  const payload = {
    events: [{
      campaignId: campaign.id,
      eventType,
      affiliateSlotId: affiliateSlotId ?? null,
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
      device: getDevice(),
      pageUrl: window.location.href,
      referrer: document.referrer,
    }],
  };

  const url = `${EDGE_URL}/e`;
  const body = JSON.stringify(payload);

  // Use sendBeacon when available (fires even if page unloads)
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
  } else {
    fetch(url, {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => { /* silent fail */ });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVisitorId(): string {
  const key = '_sp_vid';
  let vid = localStorage.getItem(key);
  if (!vid) {
    vid = crypto.randomUUID();
    localStorage.setItem(key, vid);
  }
  return vid;
}

function getSessionId(): string {
  const key = '_sp_sid';
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

function getDevice(): 'mobile' | 'desktop' | 'tablet' {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function extractPublicKey(): string | null {
  const stub = (window as Window & { __sp?: { q?: unknown[][]; publicKey?: string } }).__sp;
  if (stub?.publicKey) return stub.publicKey;
  if (stub?.q) {
    for (const call of stub.q) {
      if (call[0] === 'init' && typeof call[1] === 'string') {
        return call[1];
      }
    }
  }

  const currentScript = document.currentScript as HTMLScriptElement;
  if (currentScript?.src) {
    const match = currentScript.src.match(/\/v1\/([^\/]+)\/p\.js/);
    if (match && match[1]) {
      return match[1];
    }
  }

  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const src = scripts[i]?.src;
    if (src) {
      const match = src.match(/\/v1\/([^\/]+)\/p\.js/);
      if (match && match[1]) {
        return match[1];
      }
    }
  }

  return null;
}

// Bootstrap
const key = extractPublicKey();
if (key) {
  init(key);
}

