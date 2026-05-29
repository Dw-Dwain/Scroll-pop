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
  coupon?: string;
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
  padding?: string;
  gap?: string;
  margin?: string;
  boxShadow?: string;
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
        if (!urlObj.hostname.includes('cdn.scrollpop.online')) {
          return urlObj.origin;
        }
      } catch {}
    }

    // Fallback 2: Find script tags containing '/p.js'
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts.item(i);
      const src = script?.src;
      if (src && src.includes('/p.js')) {
        try {
          const urlObj = new URL(src);
          if (!urlObj.hostname.includes('cdn.scrollpop.online')) {
            return urlObj.origin;
          }
        } catch {}
      }
    }
  }

  return 'https://edge.scrollpop.online';
}

const EDGE_URL = getEdgeUrl();

let activeSiteId = '';

// ─── Entry Point ──────────────────────────────────────────────────────────────

function init(publicKey: string): void {
  console.log('[ScrollPop] Bootstrapping snippet with key:', publicKey);

  // Network Preconnect to shave off TLS/DNS time for the config fetch
  try {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = EDGE_URL;
    document.head.appendChild(link);
  } catch (e) { /* ignore */ }

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
    activeSiteId = config.siteId;
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
        const pattern = (value['pattern'] as string) || '';
        if (pattern.length > 100) return false; // Enforce max-length constraint to mitigate ReDoS
        return new RegExp(pattern).test(url);
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
    // ✅ SAFE: scroll position — direction-aware (only fires on downward scroll)
    case 'scroll_pct': {
      const targetPct = (trigger.params['pct'] as number) ?? 50;
      let lastScrollY = window.scrollY;
      const onScroll = () => {
        const scrolled = window.scrollY;
        const total = document.body.scrollHeight - window.innerHeight;
        if (total <= 0) return;
        // Only fire when user is scrolling DOWN (not when scrolling back up past threshold)
        const scrollingDown = scrolled > lastScrollY;
        lastScrollY = scrolled;
        if (!scrollingDown) return;
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
    // Also handles mobile exit intent via fast upward scroll velocity detection
    case 'exit_intent_mouse': {
      const sensitivity = (trigger.params['sensitivity'] as number) ?? 20;

      // Desktop: cursor near top of viewport
      const onMouseMove = (e: MouseEvent) => {
        if (e.clientY <= sensitivity) {
          document.removeEventListener('mousemove', onMouseMove);
          fire();
        }
      };
      document.addEventListener('mousemove', onMouseMove);

      // Mobile fallback: rapid upward scroll = user is about to leave
      // Track scroll velocity; if user scrolls up fast (>120px in 150ms) → exit intent
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (isTouchDevice) {
        let lastY = window.scrollY;
        let lastT = Date.now();
        let mobileFired = false;
        const onMobileScroll = () => {
          if (mobileFired) return;
          const nowY = window.scrollY;
          const nowT = Date.now();
          const dy = lastY - nowY;       // positive = scrolling UP
          const dt = nowT - lastT;       // ms elapsed
          lastY = nowY;
          lastT = nowT;
          // Velocity threshold: upward movement >120px in <150ms
          if (dy > 120 && dt < 150) {
            mobileFired = true;
            window.removeEventListener('scroll', onMobileScroll);
            fire();
          }
        };
        window.addEventListener('scroll', onMobileScroll, { passive: true });
      }
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
  if (frequency === 'once_per_session') {
    return !sessionStorage.getItem(`_sp_session_${campaignId}`);
  }

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

function getShadowCSS(shadow: string | undefined): string {
  switch (shadow) {
    case 'soft': return '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 8px -1px rgba(0, 0, 0, 0.03)';
    case 'medium': return '0 10px 30px -4px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.04)';
    case 'floating': return '0 20px 50px -12px rgba(0, 0, 0, 0.15), 0 8px 24px -4px rgba(0, 0, 0, 0.08)';
    case 'premium': return '0 30px 70px -10px rgba(0, 0, 0, 0.2), 0 12px 30px -4px rgba(0, 0, 0, 0.1)';
    case 'glass': return '0 8px 32px 0 rgba(0, 0, 0, 0.08)';
    case 'dark': return '0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 20px 2px rgba(99, 102, 241, 0.15)';
    case 'none': return 'none';
    default: return '0 20px 60px rgba(0,0,0,0.3)';
  }
}

// ─── Visual-builder element renderer ──────────────────────────────────────────
// Renders a step's positioned elements (matching the dashboard canvas: elements
// are absolutely positioned with x/y/w/h as percentages of a width×height box).
// IDs are reused (email-input / cta-submit-btn / cta-link / close-btn) so the
// existing interaction wiring applies without change.
function buildElementsHTML(step: any, design: any, slot: any): string {
  const els = [...(step.elements || [])].sort((a: any, b: any) => (a.zIndex || 0) - (b.zIndex || 0));
  const hasInput = els.some((e: any) => e.type === 'input' || e.type === 'phoneinput');
  let usedEmailId = false;
  let usedCtaId = false;
  const out: string[] = [];
  for (const el of els) {
    const ff = el.fontFamily || 'inherit';
    const pos = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;z-index:${el.zIndex || 1};opacity:${el.opacity ?? 1};box-sizing:border-box;overflow:hidden;`;
    switch (el.type) {
      case 'heading':
        out.push(`<div style="${pos}display:flex;align-items:center;justify-content:center;text-align:${el.align || 'center'};color:${el.color || '#111827'};font-size:${el.fontSize || 24}px;font-weight:${el.fontWeight || '700'};font-family:${ff};line-height:1.2;">${escapeHtml(el.content || '')}</div>`);
        break;
      case 'text':
        out.push(`<div style="${pos}display:flex;align-items:center;text-align:${el.align || 'left'};color:${el.color || '#4B5563'};font-size:${el.fontSize || 13}px;font-weight:${el.fontWeight || '400'};font-family:${ff};line-height:1.5;${el.backgroundColor ? `background:${el.backgroundColor};` : ''}${el.borderRadius ? `border-radius:${el.borderRadius}px;` : ''}${el.padding ? `padding:${el.padding}px;` : ''}">${escapeHtml(el.content || '')}</div>`);
        break;
      case 'button': {
        const isSubmit = hasInput && !usedCtaId;
        usedCtaId = true;
        const style = `${pos}display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;background:${el.backgroundColor || design.accentColor || '#6366f1'};color:${el.color || '#fff'};border-radius:${el.borderRadius ?? 8}px;font-size:${el.fontSize || 14}px;font-weight:700;font-family:${ff};border:${el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || 'transparent'}` : 'none'};`;
        if (isSubmit) {
          out.push(`<button type="button" id="cta-submit-btn" style="${style}">${escapeHtml(el.content || 'Submit')}</button>`);
        } else {
          const href = el.href || slot?.click_tracker_url || slot?.product_url || '#';
          out.push(`<a id="cta-link" href="${escapeHtml(href)}" target="_blank" rel="noopener" style="${style}">${escapeHtml(el.content || 'Continue')}</a>`);
        }
        break;
      }
      case 'input':
      case 'phoneinput': {
        const idAttr = !usedEmailId ? ' id="email-input"' : '';
        usedEmailId = true;
        out.push(`<input${idAttr} type="email" placeholder="${escapeHtml(el.extraProps?.placeholder || el.content || 'Your email address…')}" required style="${pos}padding:0 12px;font-size:13px;color:#1f2937;background:#fff;border:${el.borderWidth ?? 1}px solid ${el.borderColor || '#E4E4E7'};border-radius:${el.borderRadius ?? 8}px;outline:none;">`);
        break;
      }
      case 'image':
        out.push(`<img src="${escapeHtml(el.content || '')}" alt="" referrerpolicy="no-referrer" style="${pos}object-fit:cover;border-radius:${el.borderRadius ?? 8}px;">`);
        break;
      case 'close':
        out.push(`<button type="button" id="close-btn" aria-label="Close" style="${pos}display:flex;align-items:center;justify-content:center;background:none;border:none;cursor:pointer;color:${el.color || design.textColor || '#374151'};font-size:${el.fontSize || 16}px;">${escapeHtml(el.content || '✕')}</button>`);
        break;
      case 'shape':
        out.push(`<div style="${pos}background:${el.backgroundColor || '#000'};border-radius:${el.content === 'circle' ? '9999px' : `${el.borderRadius ?? 0}px`};border:${el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || 'transparent'}` : 'none'};"></div>`);
        break;
      case 'divider':
        out.push(`<div style="${pos}display:flex;align-items:center;"><div style="width:100%;border-top:${el.borderWidth ?? 1}px solid ${el.borderColor || el.color || '#e5e7eb'};"></div></div>`);
        break;
      case 'badge':
        out.push(`<div style="${pos}display:flex;align-items:center;justify-content:center;background:${el.backgroundColor || design.accentColor || '#6366f1'};color:${el.color || '#fff'};border-radius:9999px;font-size:${el.fontSize || 11}px;font-weight:700;font-family:${ff};padding:0 8px;">${escapeHtml(el.content || '')}</div>`);
        break;
      default:
        if (el.content) out.push(`<div style="${pos}display:flex;align-items:center;justify-content:center;text-align:center;color:${el.color || design.textColor || '#111'};font-size:${el.fontSize || 13}px;font-family:${ff};">${escapeHtml(el.content)}</div>`);
    }
  }
  return out.join('');
}

// ─── Popup Rendering (Shadow DOM) ─────────────────────────────────────────────

function renderPopup(campaign: CampaignConfig): void {
  const { design, affiliateSlots, id: campaignId } = campaign;

  // Pick weighted affiliate slot
  const slot = pickWeightedSlot(affiliateSlots);

  // Check popup kinds
  const popupType = (design as any).steps?.main?.popupType || design.kind || 'modal';
  const isSpinWheel = popupType === 'spinwheel' || design.headline?.toLowerCase().includes('spin') || campaignId.includes('spin');
  const isScratchCard = popupType === 'scratchcard' || design.headline?.toLowerCase().includes('scratch') || campaignId.includes('scratch');

  // Visual-builder element mode: render the main step's positioned elements
  // (matches the dashboard canvas) instead of the fixed flat-field layout.
  const mainStep = (design as any).steps?.main;
  const elementMode = !isSpinWheel && !isScratchCard && Array.isArray(mainStep?.elements) && mainStep.elements.length > 0;
  const hasCloseEl = elementMode && mainStep.elements.some((e: any) => e.type === 'close');

  // Create host element
  const host = document.createElement('div');
  host.id = `__sp_popup_${campaignId}`;
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', design.headline);
  document.body.appendChild(host);

  // Attach Shadow DOM — CSS isolation
  const shadow = host.attachShadow({ mode: 'closed' });

  let width = '480px';
  switch (design.size) {
    case 'sm': width = '360px'; break;
    case 'md': width = '480px'; break;
    case 'lg': width = '600px'; break;
  }
  // If Spinwheel or Scratch Card, let's make it a bit wider to look premium
  if (isSpinWheel) width = '640px';
  // Element mode: match the editor's canvas box width.
  if (elementMode && mainStep.width) width = `${mainStep.width}px`;

  const positionStyles = getPositionStyles(design);

  const htmlChunks: string[] = [];

  // Build style tag
  htmlChunks.push('<style>');
  htmlChunks.push(':host { all: initial; font-family: system-ui, sans-serif; }');
  if (design.overlayEnabled) {
    htmlChunks.push('.overlay { position: fixed; inset: 0; z-index: 2147483646; background: rgba(0,0,0,');
    htmlChunks.push(String(design.overlayOpacity ?? 0.5));
    htmlChunks.push('); animation: sp-fade-in 0.2s ease; }');
  }
  htmlChunks.push('.popup { position: fixed; z-index: 2147483647; background: ');
  htmlChunks.push(design.backgroundColor);
  htmlChunks.push('; ');
  if (design.backgroundImage) {
    htmlChunks.push('background-image: url(');
    htmlChunks.push(design.backgroundImage);
    htmlChunks.push('); background-size: cover; background-position: center; ');
  }
  htmlChunks.push('color: ');
  htmlChunks.push(design.textColor);
  htmlChunks.push('; border-radius: ');
  htmlChunks.push(String(design.borderRadius));
  htmlChunks.push('px; box-shadow: ');
  htmlChunks.push(getShadowCSS(design.boxShadow));
  htmlChunks.push('; ');
  if (design.boxShadow === 'glass') {
    htmlChunks.push('backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); ');
  }
  htmlChunks.push('margin: ');
  htmlChunks.push(design.margin ?? '0px');
  htmlChunks.push('; width: ');
  htmlChunks.push(width);
  htmlChunks.push('; max-width: calc(100vw - 32px); ');
  htmlChunks.push(positionStyles);
  htmlChunks.push(' animation: ');
  htmlChunks.push(getAnimation(design.animation));
  htmlChunks.push('; overflow: hidden; }');
  htmlChunks.push('.popup-inner { padding: ');
  htmlChunks.push(design.padding ?? '24px');
  htmlChunks.push('; display: flex; flex-direction: column; gap: ');
  htmlChunks.push(design.gap ?? '12px');
  htmlChunks.push('; }');
  htmlChunks.push('.close-btn { position: absolute; ');
  htmlChunks.push(design.closeButtonPosition === 'top-right' ? 'top: 12px; right: 12px;' : 'top: 12px; left: 12px;');
  htmlChunks.push(' background: none; border: none; cursor: pointer; font-size: 18px; color: ');
  htmlChunks.push(design.textColor);
  htmlChunks.push('; opacity: 0.6; padding: 4px 8px; border-radius: 4px; z-index: 50; }');
  htmlChunks.push('.close-btn:hover { opacity: 1; background: rgba(0,0,0,0.1); }');
  htmlChunks.push('.headline { font-size: 20px; font-weight: 700; margin: 0; line-height: 1.3; }');
  htmlChunks.push('.subheadline { font-size: 14px; opacity: 0.8; margin: 0; }');
  htmlChunks.push('.body-text { font-size: 14px; margin: 0; line-height: 1.5; }');
  htmlChunks.push('.product-image { width: 100%; border-radius: 8px; margin: 0; display: block; }');
  
  // Inputs & Email Capture Styles
  htmlChunks.push('.email-input { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 14px; color: #1f2937; background: #ffffff; outline: none; }');
  htmlChunks.push('.email-input:focus { border-color: ');
  htmlChunks.push(design.accentColor);
  htmlChunks.push('; }');

  htmlChunks.push('.cta-btn { display: inline-block; width: 100%; text-align: center; border: none; cursor: pointer; background: ');
  htmlChunks.push(design.accentColor);
  htmlChunks.push('; color: #fff; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none; box-sizing: border-box; transition: opacity 0.15s; }');
  htmlChunks.push('.cta-btn:hover { opacity: 0.9; }');
  htmlChunks.push('.cta-link { color: ');
  htmlChunks.push(design.accentColor);
  htmlChunks.push('; text-decoration: underline; font-size: 14px; cursor: pointer; }');
  htmlChunks.push('.dismiss-text { text-align: center; margin-top: 4px; font-size: 12px; opacity: 0.6; cursor: pointer; }');
  htmlChunks.push('.dismiss-text:hover { opacity: 1; }');
  htmlChunks.push('.powered-by { text-align: center; margin-top: 4px; font-size: 10px; opacity: 0.4; }');

  // Gamified elements styling
  htmlChunks.push('.gamified-container { display: flex; flex-direction: row; gap: 20px; align-items: center; justify-content: center; }');
  htmlChunks.push('.gamified-left { flex: 1; display: flex; flex-direction: column; gap: 10px; }');
  htmlChunks.push('.gamified-right { display: flex; align-items: center; justify-content: center; shrink-0; }');
  
  // Spin Wheel CSS
  htmlChunks.push('.spin-wrapper { position: relative; width: 220px; height: 220px; background: #1e1b4b; border-radius: 50%; border: 4px solid #312e81; box-shadow: 0 4px 12px rgba(0,0,0,0.3); overflow: hidden; display: flex; align-items: center; justify-content: center; }');
  htmlChunks.push('.spin-wheel-svg { width: 100%; height: 100%; transform: rotate(0deg); transition: transform 3s cubic-bezier(0.15, 0.85, 0.25, 1); }');
  htmlChunks.push('.spin-peg { position: absolute; top: -4px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 14px solid #f59e0b; z-index: 20; }');
  htmlChunks.push('.spin-center-btn { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 44px; height: 44px; border-radius: 50%; background: #ffffff; border: 3px solid #1e1b4b; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; color: #1e1b4b; cursor: pointer; z-index: 10; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }');

  // Scratch Card CSS
  htmlChunks.push('.scratch-container { position: relative; width: 260px; height: 150px; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; background: #000000; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 2px 6px rgba(0,0,0,0.4); }');
  htmlChunks.push('.scratch-canvas { position: absolute; inset: 0; cursor: crosshair; z-index: 10; touch-action: none; }');
  htmlChunks.push('.scratch-prize { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #ffffff; font-family: monospace; z-index: 1; }');

  // Success Code Copy block
  htmlChunks.push('.success-coupon-box { display: flex; align-items: center; justify-content: center; gap: 8px; border: 2px dashed ');
  htmlChunks.push(design.accentColor);
  htmlChunks.push('; border-radius: 8px; padding: 12px; background: rgba(99, 102, 241, 0.05); font-size: 18px; font-weight: 800; font-family: monospace; letter-spacing: 2px; text-align: center; cursor: pointer; transition: background 0.2s; }');
  htmlChunks.push('.success-coupon-box:hover { background: rgba(99, 102, 241, 0.1); }');
  htmlChunks.push('.success-icon { width: 44px; height: 44px; background: #d1fae5; color: #065f46; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px auto; font-size: 20px; }');

  // Real-time Email Correction Styles
  htmlChunks.push('.email-suggest { font-size: 11px; color: ');
  htmlChunks.push(design.accentColor);
  htmlChunks.push('; background: rgba(99, 102, 241, 0.08); padding: 6px 12px; border-radius: 6px; margin-top: -4px; margin-bottom: 4px; cursor: pointer; display: none; align-items: center; gap: 4px; font-weight: 600; }');
  htmlChunks.push('.email-suggest:hover { background: rgba(99, 102, 241, 0.15); }');

  // Persistent Teaser Badge Styles
  const isTeaserLeft = design.position === 'bottom-left' || design.position === 'top';
  htmlChunks.push('.teaser-badge { position: fixed; z-index: 2147483647; ');
  htmlChunks.push(isTeaserLeft ? 'left: 20px;' : 'right: 20px;');
  htmlChunks.push(' bottom: 20px; background: ');
  htmlChunks.push(design.accentColor);
  htmlChunks.push('; color: #ffffff; padding: 10px 18px; border-radius: 9999px; font-weight: 700; font-size: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); cursor: pointer; display: none; align-items: center; gap: 6px; transition: transform 0.2s, opacity 0.2s; }');
  htmlChunks.push('.teaser-badge:hover { transform: scale(1.05); }');

  htmlChunks.push('@keyframes sp-fade-in { from { opacity: 0 } to { opacity: 1 } }');
  htmlChunks.push('@keyframes sp-slide-up { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: translateY(0) } }');
  htmlChunks.push('@keyframes sp-slide-down { from { opacity: 0; transform: translateY(-40px) } to { opacity: 1; transform: translateY(0) } }');
  htmlChunks.push('@keyframes sp-zoom { from { opacity: 0; transform: scale(0.9) } to { opacity: 1; transform: scale(1) } }');
  htmlChunks.push('@keyframes sp-bounce { 0% { opacity:0; transform:translateY(-60px) scale(0.95) } 55% { opacity:1; transform:translateY(12px) scale(1.02) } 75% { transform:translateY(-6px) scale(0.99) } 90% { transform:translateY(3px) scale(1.005) } 100% { opacity:1; transform:translateY(0) scale(1) } }');
  htmlChunks.push('@keyframes sp-elastic { 0% { opacity:0; transform:scale(0.4) } 55% { opacity:1; transform:scale(1.08) } 75% { transform:scale(0.96) } 90% { transform:scale(1.02) } 100% { opacity:1; transform:scale(1) } }');
  htmlChunks.push('@keyframes sp-flip-in { 0% { opacity:0; transform:perspective(600px) rotateX(-90deg) translateY(-40px) } 60% { opacity:1; transform:perspective(600px) rotateX(8deg) } 80% { transform:perspective(600px) rotateX(-4deg) } 100% { opacity:1; transform:perspective(600px) rotateX(0deg) translateY(0) } }');
  htmlChunks.push('</style>');

  // Overlay
  if (design.overlayEnabled) {
    htmlChunks.push('<div class="overlay" id="overlay"></div>');
  }

  // Popup Container
  htmlChunks.push('<div class="popup" role="dialog" id="popup-card">');
  // Default close button — skipped in element mode when the design includes its own close element.
  if (design.showCloseButton && !hasCloseEl) {
    htmlChunks.push('<button class="close-btn" id="close-btn" aria-label="Close">✕</button>');
  }

  // ─── Element mode: render the builder's positioned elements ─────────────────
  if (elementMode) {
    htmlChunks.push(`<div class="popup-inner" id="popup-view-main" style="padding:0;position:relative;height:${mainStep.height || 520}px;display:block;">`);
    htmlChunks.push(buildElementsHTML(mainStep, design, slot));
    htmlChunks.push('</div>');
  } else {

  // Inner Content
  htmlChunks.push('<div class="popup-inner" id="popup-view-main">');

  // If gamified, let's wrap with flex layout
  if (isSpinWheel || isScratchCard) {
    htmlChunks.push('<div class="gamified-container">');
    htmlChunks.push('<div class="gamified-left">');
  }

  htmlChunks.push('<h2 class="headline">');
  htmlChunks.push(escapeHtml(design.headline));
  htmlChunks.push('</h2>');

  if (design.subheadline) {
    htmlChunks.push('<p class="subheadline">');
    htmlChunks.push(escapeHtml(design.subheadline));
    htmlChunks.push('</p>');
  }

  if (design.bodyText) {
    htmlChunks.push('<p class="body-text">');
    htmlChunks.push(escapeHtml(design.bodyText));
    htmlChunks.push('</p>');
  }

  // Render product image for standard templates if present
  if (!isSpinWheel && !isScratchCard && slot?.image_url) {
    htmlChunks.push('<img class="product-image" src="');
    htmlChunks.push(escapeHtml(slot.image_url));
    htmlChunks.push('" alt="');
    htmlChunks.push(escapeHtml(slot.product_name ?? ''));
    htmlChunks.push('" loading="lazy">');
  }

  // Render email input field for lead capture templates (anything not stickybar)
  const showEmailInput = design.position !== 'top' && design.position !== 'bottom' && design.headline !== 'Cookie Consent Notice 🍪';
  if (showEmailInput) {
    htmlChunks.push('<div style="width: 100%; display: flex; flex-direction: column; gap: 8px;">');
    htmlChunks.push('<input type="email" class="email-input" id="email-input" placeholder="Enter your email for active coupon key..." required>');
    htmlChunks.push('</div>');
  }

  if (slot) {
    const btnText = slot.cta_text || design.ctaText;
    const isGamifiedSubmit = isSpinWheel || isScratchCard || showEmailInput;
    
    if (isGamifiedSubmit) {
      // Form Submit / Spin Trigger Button
      const actText = isSpinWheel ? 'SPIN WHEEL NOW 🎰' : (isScratchCard ? 'REVEAL MY OFFER ⚡' : btnText);
      htmlChunks.push('<button class="cta-btn" id="cta-submit-btn">');
      htmlChunks.push(escapeHtml(actText));
      htmlChunks.push('</button>');
    } else {
      const trackerUrl = slot.click_tracker_url || slot.product_url;
      // Plain Clickout affiliate button
      if (design.ctaStyle === 'button') {
        htmlChunks.push('<a class="cta-btn" href="');
        htmlChunks.push(escapeHtml(trackerUrl));
        htmlChunks.push('" target="_blank" rel="noopener" id="cta-link">');
        htmlChunks.push(escapeHtml(btnText));
        htmlChunks.push('</a>');
      } else {
        htmlChunks.push('<a class="cta-link" href="');
        htmlChunks.push(escapeHtml(trackerUrl));
        htmlChunks.push('" target="_blank" rel="noopener" id="cta-link">');
        htmlChunks.push(escapeHtml(btnText));
        htmlChunks.push('</a>');
      }
    }
  }

  if (design.showDismissText && design.dismissText) {
    htmlChunks.push('<p class="dismiss-text" id="dismiss-text">');
    htmlChunks.push(escapeHtml(design.dismissText));
    htmlChunks.push('</p>');
  }

  if (design.showPoweredBy) {
    htmlChunks.push('<p class="powered-by">Powered by ScrollPop</p>');
  }

  if (isSpinWheel || isScratchCard) {
    htmlChunks.push('</div>'); // End gamified-left
    htmlChunks.push('<div class="gamified-right">');
    
    if (isSpinWheel) {
      // Conic SVG Spin Wheel
      htmlChunks.push('<div class="spin-wrapper">');
      htmlChunks.push('<div class="spin-peg"></div>');
      htmlChunks.push('<svg viewBox="0 0 300 300" class="spin-wheel-svg" id="spin-wheel-element">');
      
      const slices = [
        { label: '50% OFF', color: '#ec4899' },
        { label: 'TRY AGAIN', color: '#1e1b4b' },
        { label: 'FREE SHIP', color: '#6366f1' },
        { label: 'NO LUCK', color: '#312e81' },
        { label: '25% OFF', color: '#f59e0b' },
        { label: 'TRY AGAIN', color: '#4338ca' },
      ];
      
      slices.forEach((slice, i) => {
        const sliceAngle = 360 / slices.length;
        const startAngleRad = (i * sliceAngle - 90) * Math.PI / 180;
        const endAngleRad = ((i + 1) * sliceAngle - 90) * Math.PI / 180;

        const x1 = 150 + 140 * Math.cos(startAngleRad);
        const y1 = 150 + 140 * Math.sin(startAngleRad);
        const x2 = 150 + 140 * Math.cos(endAngleRad);
        const y2 = 150 + 140 * Math.sin(endAngleRad);

        const pathData = `M 150 150 L ${x1} ${y1} A 140 140 0 0 1 ${x2} ${y2} Z`;

        const textAngleRad = (i * sliceAngle + sliceAngle / 2 - 90) * Math.PI / 180;
        const textX = 150 + 80 * Math.cos(textAngleRad);
        const textY = 150 + 80 * Math.sin(textAngleRad);

        htmlChunks.push('<g>');
        htmlChunks.push(`<path d="${pathData}" fill="${slice.color}" stroke="#ffffff" stroke-width="2"/>`);
        htmlChunks.push(`<text x="${textX}" y="${textY}" fill="#ffffff" font-family="sans-serif" font-size="11" font-weight="900" text-anchor="middle" dominant-baseline="middle" transform="rotate(${(i * sliceAngle + sliceAngle / 2)}, ${textX}, ${textY})">${slice.label}</text>`);
        htmlChunks.push('</g>');
      });
      
      htmlChunks.push('</svg>');
      htmlChunks.push('<div class="spin-center-btn" id="spin-center-btn">SPIN</div>');
      htmlChunks.push('</div>'); // End spin-wrapper
    } else {
      // HTML5 Canvas Scratcher
      htmlChunks.push('<div class="scratch-container" id="scratch-container">');
      htmlChunks.push('<div class="scratch-prize">');
      htmlChunks.push('🏆 MYSTERY VOUCHER 🏆');
      htmlChunks.push(`<h4 style="margin: 4px 0; color: #fbbf24; font-size: 16px;">${escapeHtml(slot?.product_name || 'SECRET SPECIALS 30% OFF')}</h4>`);
      htmlChunks.push(`<span style="font-size: 14px; font-weight: bold; background: rgba(255,255,255,0.15); padding: 4px 10px; border-radius: 6px; border: 1px dashed #fbbf24;">${escapeHtml(slot?.coupon || 'SCRATCH30')}</span>`);
      htmlChunks.push('</div>');
      htmlChunks.push('<canvas class="scratch-canvas" id="scratch-canvas"></canvas>');
      htmlChunks.push('</div>'); // End scratch-container
    }
    
    htmlChunks.push('</div>'); // End gamified-right
    htmlChunks.push('</div>'); // End gamified-container
  }

  htmlChunks.push('</div>'); // End popup-view-main
  } // end non-element (flat-field) layout
  htmlChunks.push('</div>'); // End popup

  // Minimizable Teaser Badge
  htmlChunks.push('<div class="teaser-badge" id="teaser-badge">');
  htmlChunks.push('⚡ ');
  htmlChunks.push(escapeHtml(design.subheadline || 'Special Offer'));
  htmlChunks.push('</div>');

  shadow.innerHTML = htmlChunks.join('');

  // Grab compiled Elements references inside closed Shadow DOM
  const popupCard = shadow.getElementById('popup-card');
  const overlay = shadow.getElementById('overlay');
  const teaser = shadow.getElementById('teaser-badge');
  const popupViewMain = shadow.getElementById('popup-view-main');

  let hasRedirected = false;
  const dismiss = () => {
    if (!hasRedirected) {
      hasRedirected = true;
      // Open affiliate link in a new tab (as explicitly requested)
      const url = slot?.click_tracker_url || slot?.product_url;
      if (url) {
        window.open(url, '_blank');
      }
      // Track as 'dismiss' event in analytics
      beaconEvent(campaign, 'dismiss', slot?.id);
      return;
    }

    // Smoothly minimize to teaser state instead of fully removing
    if (popupCard) popupCard.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    if (teaser) teaser.style.display = 'flex';
  };

  const reopen = () => {
    if (popupCard) popupCard.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
    if (teaser) teaser.style.display = 'none';
  };

  // Switch to success congratulations screen state
  const transitionToSuccess = (email: string) => {
    // Record conversion event with email input!
    beaconEvent(campaign, 'conversion', slot?.id, { email });

    const couponTxt = slot?.coupon || 'WELCOME50';
    const trackerUrl = slot?.click_tracker_url || slot?.product_url || '#';

    // Construct beautiful success HTML
    popupViewMain!.innerHTML = `
      <div class="success-icon">✓</div>
      <h2 class="headline" style="text-align: center;">Congratulations! Voucher active!</h2>
      <p class="subheadline" style="text-align: center; margin-bottom: 12px;">Your custom campaign promocode was copied safely.</p>
      <div class="success-coupon-box" id="success-coupon-box" title="Click to copy voucher code">
        <span>${escapeHtml(couponTxt)}</span>
      </div>
      <a class="cta-btn" href="${escapeHtml(trackerUrl)}" target="_blank" rel="noopener" id="success-cta-btn" style="margin-top: 10px;">
        SHOP WITH VOUCHER CODE
      </a>
      <p class="powered-by" style="margin-top: 6px;">Powered by ScrollPop</p>
    `;

    // Wire up clipboard copy trigger
    shadow.getElementById('success-coupon-box')?.addEventListener('click', () => {
      navigator.clipboard.writeText(couponTxt);
      const span = shadow.querySelector('.success-coupon-box span');
      if (span) span.textContent = 'COPIED! ✓';
      setTimeout(() => {
        if (span) span.textContent = couponTxt;
      }, 1500);
    });

    // Wire up CTA redirect click tracking
    shadow.getElementById('success-cta-btn')?.addEventListener('click', () => {
      beaconEvent(campaign, 'click', slot?.id);
    });
  };

  // Wire up close button & teaser reopening
  shadow.getElementById('close-btn')?.addEventListener('click', dismiss);
  shadow.getElementById('dismiss-text')?.addEventListener('click', dismiss);
  shadow.getElementById('overlay')?.addEventListener('click', dismiss);
  shadow.getElementById('teaser-badge')?.addEventListener('click', reopen);

  // Wire up CTA click → beacon then navigate
  shadow.getElementById('cta-link')?.addEventListener('click', () => {
    beaconEvent(campaign, 'click', slot?.id);
  });

  // Handle standard lead capture submission
  const emailInput = shadow.getElementById('email-input') as HTMLInputElement | null;
  const submitBtn = shadow.getElementById('cta-submit-btn');

  const executeLeadSubmit = () => {
    const emailVal = emailInput ? emailInput.value.trim() : '';
    if (emailInput && (!emailVal || !emailVal.includes('@'))) {
      if (emailInput) {
        emailInput.style.borderColor = '#ef4444';
        emailInput.focus();
      }
      return;
    }
    transitionToSuccess(emailVal || 'anonymous@scrollpop.online');
  };

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      if (isSpinWheel) {
        // Spin Wheel Trigger
        const spinWheelEl = shadow.getElementById('spin-wheel-element') as SVGElement | null;
        const emailVal = emailInput ? emailInput.value.trim() : '';
        if (!emailVal || !emailVal.includes('@')) {
          if (emailInput) {
            emailInput.style.borderColor = '#ef4444';
            emailInput.focus();
          }
          return;
        }

        submitBtn.setAttribute('disabled', 'true');
        submitBtn.textContent = '🎰 SPINNING...';

        // Select a winning segment and spin
        const targetDegrees = 360 * 5 + (Math.random() * 360);
        if (spinWheelEl) {
          spinWheelEl.style.transform = `rotate(${targetDegrees}deg)`;
        }

        setTimeout(() => {
          transitionToSuccess(emailVal);
        }, 3000);
      } else if (isScratchCard) {
        // Scratch card fallback submit
        executeLeadSubmit();
      } else {
        // Standard email capture submit
        executeLeadSubmit();
      }
    });
  }

  // Real-time Spin Wheel center button click
  shadow.getElementById('spin-center-btn')?.addEventListener('click', () => {
    submitBtn?.dispatchEvent(new Event('click'));
  });

  // Real physics Scratch Card logic inside shadow DOM
  if (isScratchCard) {
    const canvas = shadow.getElementById('scratch-canvas') as HTMLCanvasElement | null;
    const container = shadow.getElementById('scratch-container');
    
    if (canvas && container) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Sizing
        canvas.width = 260;
        canvas.height = 150;

        // Draw luxury silver coating
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#d1d5db');
        grad.addColorStop(0.3, '#f3f4f6');
        grad.addColorStop(0.5, '#e5e7eb');
        grad.addColorStop(0.8, '#9ca3af');
        grad.addColorStop(1, '#6b7280');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Text Overlay
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Scratch to Reveal ⚡', canvas.width / 2, canvas.height / 2);

        // Scratching state
        let isScratching = false;
        let scratchCount = 0;

        const scratch = (clientX: number, clientY: number) => {
          const rect = canvas.getBoundingClientRect();
          const x = clientX - rect.left;
          const y = clientY - rect.top;

          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.arc(x, y, 16, 0, Math.PI * 2);
          ctx.fill();

          scratchCount++;
          // Auto reveal once they scratch enough
          if (scratchCount > 40) {
            canvas.style.display = 'none';
          }
        };

        canvas.addEventListener('mousedown', (e) => {
          isScratching = true;
          scratch(e.clientX, e.clientY);
        });

        canvas.addEventListener('mousemove', (e) => {
          if (isScratching) scratch(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', () => {
          isScratching = false;
        });

        // Touch support
        canvas.addEventListener('touchstart', (e) => {
          if (e.touches[0]) {
            isScratching = true;
            scratch(e.touches[0].clientX, e.touches[0].clientY);
          }
        });

        canvas.addEventListener('touchmove', (e) => {
          if (isScratching && e.touches[0]) {
            scratch(e.touches[0].clientX, e.touches[0].clientY);
          }
        });

        canvas.addEventListener('touchend', () => {
          isScratching = false;
        });
      }
    }
  }

  // Attach auto email correction logic inside shadow DOM / document form elements
  try {
    if (emailInput) {
      const suggestDiv = document.createElement('div');
      suggestDiv.className = 'email-suggest';
      emailInput.parentNode?.insertBefore(suggestDiv, emailInput.nextSibling);

      emailInput.addEventListener('input', (e) => {
        const val = (e.target as HTMLInputElement).value;
        const correction = suggestCorrectEmail(val);
        if (correction) {
          suggestDiv.innerHTML = `Did you mean <strong style="text-decoration: underline;">${escapeHtml(correction)}</strong>?`;
          suggestDiv.style.display = 'flex';
          suggestDiv.onclick = () => {
            emailInput.value = correction;
            suggestDiv.style.display = 'none';
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          };
        } else {
          suggestDiv.style.display = 'none';
        }
      });
    }
  } catch (err) { /* ignore safety bounds */ }

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
    case 'fade':       return 'sp-fade-in 0.3s ease';
    case 'slide_up':   return 'sp-slide-up 0.3s ease';
    case 'slide_down': return 'sp-slide-down 0.3s ease';
    case 'zoom':       return 'sp-zoom 0.25s ease';
    case 'bounce':     return 'sp-bounce 0.55s cubic-bezier(0.34,1.56,0.64,1) both';
    case 'elastic':    return 'sp-elastic 0.5s cubic-bezier(0.34,1.56,0.64,1) both';
    case 'flip_in':    return 'sp-flip-in 0.45s cubic-bezier(0.16,1,0.3,1) both';
    default:           return 'none';
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
  return slots.slice(-1)[0] ?? null;
}

// ─── Event Beaconing ──────────────────────────────────────────────────────────

function beaconEvent(
  campaign: CampaignConfig,
  eventType: 'impression' | 'view' | 'click' | 'dismiss' | 'conversion',
  affiliateSlotId?: string,
  extraMeta?: Record<string, unknown>
): void {
  const payload = {
    events: [{
      campaignId: campaign.id,
      siteId: activeSiteId,
      eventType,
      affiliateSlotId: affiliateSlotId ?? null,
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
      device: getDevice(),
      pageUrl: window.location.href,
      referrer: document.referrer,
      meta: extraMeta ?? null,
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

function suggestCorrectEmail(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const local = parts[0];
  const domain = parts[1]?.toLowerCase().trim();
  if (!local || !domain) return null;

  let correctedDomain = '';
  switch (domain) {
    case 'gamil.com':
    case 'gmial.com':
    case 'gmal.com':
    case 'gamil.co':
      correctedDomain = 'gmail.com';
      break;
    case 'yaho.com':
      correctedDomain = 'yahoo.com';
      break;
    case 'hotmial.com':
      correctedDomain = 'hotmail.com';
      break;
    case 'msn.con':
      correctedDomain = 'msn.com';
      break;
    case 'outlook.con':
      correctedDomain = 'outlook.com';
      break;
  }

  if (correctedDomain) {
    return `${local}@${correctedDomain}`;
  }
  return null;
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
    const script = scripts.item(i);
    const src = script?.src;
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

