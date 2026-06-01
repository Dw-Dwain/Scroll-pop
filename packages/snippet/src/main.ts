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
  kind: 'url_exact' | 'url_contains' | 'url_regex' | 'device' | 'returning_visitor' | 'geo' | 'session_page_views' | 'utm' | 'ab_test';
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
  plan: string;
  campaigns: CampaignConfig[];
  version: string;
}

function getEdgeUrl(): string {
  const w = window as any;
  if (typeof window !== 'undefined' && w.__SP_EDGE_URL) return w.__SP_EDGE_URL;
  try {
    const cur = document?.currentScript as any;
    if (cur?.src && typeof cur.src === 'string' && !cur.src.includes('cdn.scrollpop.online')) {
      return new URL(cur.src).origin;
    }
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = (scripts[i] as HTMLScriptElement)?.src;
      if (src?.includes('/p.js') && !src.includes('cdn.scrollpop.online')) {
        return new URL(src).origin;
      }
    }
  } catch {}
  return 'https://edge.scrollpop.online';
}

const EDGE_URL = getEdgeUrl();

let activeSiteId = '';
let adTriggerEnabled = false; // growth+ plans only

// Track when the snippet loaded so we can report time-on-page at trigger
const _pageLoadTime = Date.now();
let _skipTracking = false;

// ─── Exclusion Guards ─────────────────────────────────────────────────────────
// Evaluates if we should skip analytics tracking (but still show popups)
function evaluateSkipTracking(): void {
  if (navigator.doNotTrack === '1' || (window as any).doNotTrack === '1' || localStorage.getItem('__sp_admin') === '1') {
    _skipTracking = true;
  }
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\.local$|\.test$|scrollpop/.test(window.location.hostname)) {
    _skipTracking = true;
  }
}

// Returns true if the snippet should abort entirely (e.g. bots)
function shouldAbortBoot(): boolean {
  const ua = navigator.userAgent;
  const botPattern = /bot|crawler|spider|crawling|Googlebot|Bingbot|Slurp|DuckDuck|Baidu|YandexBot|Sogou|facebookexternalhit|Twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|developers\.google|headlesschrome/i;
  if (botPattern.test(ua) || navigator.webdriver) {
    console.log('[ScrollPop] Bot/crawler detected — aborting boot.');
    return true;
  }
  return false;
}

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
  evaluateSkipTracking();
  if (shouldAbortBoot()) return;

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
    adTriggerEnabled = 'growthscaleagency'.includes(config.plan || '');
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

    case 'geo':
      // Geo-targeting is typically handled at the edge/Cloudflare level by
      // discarding the campaign before it even reaches the browser.
      return true;

    case 'session_page_views': {
      let count = parseInt(sessionStorage.getItem('_sp_page_count') || '0', 10);
      if (!window.sessionStorage.getItem('_sp_page_counted')) {
        count += 1;
        sessionStorage.setItem('_sp_page_count', count.toString());
        sessionStorage.setItem('_sp_page_counted', '1');
      }
      const targetCount = (value['count'] as number) || 0;
      return count >= targetCount;
    }

    case 'utm': {
      const source = (value['source'] as string) || '';
      return window.location.search.toLowerCase().includes(source.toLowerCase());
    }

    case 'ab_test': {
      const percent = (value['percent'] as number) || 100;
      if (percent >= 100) return true;
      if (percent <= 0) return false;
      // Store rollout assignment to keep it stable per visitor
      const abKey = `_sp_ab_${rule.id}`;
      let assigned = localStorage.getItem(abKey);
      if (!assigned) {
        assigned = (Math.random() * 100 <= percent) ? '1' : '0';
        localStorage.setItem(abKey, assigned);
      }
      return assigned === '1';
    }

    default:
      return true;
  }
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

function registerCampaignTriggers(campaign: CampaignConfig): void {
  let fired = false;

  // fire() is called by a trigger with its metadata so we can beacon it
  const fire = (triggerMeta?: { triggerType: string; scrollPct?: number }) => {
    if (fired) return;

    // Minimum time-on-page gate: visitor must have been here ≥ 2s
    const timeOnPage = Date.now() - _pageLoadTime;
    if (timeOnPage < 2000) {
      console.log('[ScrollPop] Page load <2s — skipping trigger.');
      return;
    }

    if (!checkFrequencyCap(campaign.id, campaign.frequency.frequency)) {
      console.warn('[ScrollPop] Frequency cap met, skipping display for campaign:', campaign.id);
      return;
    }
    fired = true;
    console.log('[ScrollPop] Trigger fired! Displaying campaign popup:', campaign.id);

    // Beacon impression with trigger metadata
    beaconEvent(campaign, 'impression', undefined, {
      triggerType: triggerMeta?.triggerType ?? 'unknown',
      scrollPct:   triggerMeta?.scrollPct  ?? Math.round((window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1)) * 100),
      timeOnPage,
    });

    renderPopup(campaign, timeOnPage);
    setFrequencyCap(campaign.id, campaign.frequency.frequency);
  };

  for (const trigger of campaign.triggers) {
    console.log('[ScrollPop] Registering trigger:', trigger.type, trigger.params);
    registerTrigger(trigger, fire);
  }
}

function registerTrigger(trigger: TriggerConfig, fire: (meta?: { triggerType: string; scrollPct?: number }) => void): void {
  switch (trigger.type) {
    // ✅ SAFE: scroll position — direction-aware (only fires on downward scroll)
    case 'scroll_pct': {
      const targetPct = (trigger.params['pct'] as number) ?? 50;
      let lastScrollY = window.scrollY;
      const onScroll = () => {
        const scrolled = window.scrollY;
        const total = document.body.scrollHeight - window.innerHeight;
        if (total <= 0) return;
        const scrollingDown = scrolled > lastScrollY;
        lastScrollY = scrolled;
        if (!scrollingDown) return;
        const pct = (scrolled / total) * 100;
        if (pct >= targetPct) {
          window.removeEventListener('scroll', onScroll);
          fire({ triggerType: 'scroll_pct', scrollPct: Math.round(pct) });
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      break;
    }

    // ✅ SAFE: time on page
    case 'dwell_time': {
      const seconds = (trigger.params['seconds'] as number) ?? 30;
      setTimeout(() => fire({ triggerType: 'dwell_time' }), seconds * 1000);
      break;
    }

    // ✅ SAFE: inactivity detection
    case 'inactivity': {
      const seconds = (trigger.params['seconds'] as number) ?? 60;
      let timer = setTimeout(() => fire({ triggerType: 'inactivity' }), seconds * 1000);
      const resetTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(() => fire({ triggerType: 'inactivity' }), seconds * 1000);
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
          fire({ triggerType: 'exit_intent_mouse' });
        }
      };
      document.addEventListener('mousemove', onMouseMove);

      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (isTouchDevice) {
        let lastY = window.scrollY;
        let lastT = Date.now();
        let mobileFired = false;
        const onMobileScroll = () => {
          if (mobileFired) return;
          const nowY = window.scrollY;
          const nowT = Date.now();
          const dy = lastY - nowY;
          const dt = nowT - lastT;
          lastY = nowY;
          lastT = nowT;
          if (dy > 120 && dt < 150) {
            mobileFired = true;
            window.removeEventListener('scroll', onMobileScroll);
            fire({ triggerType: 'exit_intent_mouse' });
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
          fire({ triggerType: 'click' });
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

// ─── Dynamic Affiliate & Macros ───────────────────────────────────────────────────
function injectMacros(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    key = key.trim().toLowerCase();
    if (key === 'page_title') return document.title;
    if (key.startsWith('meta:')) {
      const el = document.querySelector(`meta[name="${key.substring(5)}"]`);
      return el ? (el.getAttribute('content') || match) : match;
    }
    if (key.startsWith('og:')) {
      const el = document.querySelector(`meta[property="${key}"]`);
      return el ? (el.getAttribute('content') || match) : match;
    }
    return match;
  });
}

export function detectSmartProduct() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const script = scripts[i];
      if (!script || !script.textContent) continue;
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type'] === 'Product' && item.name) {
          let image = item.image;
          if (Array.isArray(image)) image = image[0];
          if (typeof image === 'object' && image.url) image = image.url;
          return { title: item.name, image: typeof image === 'string' ? image : undefined };
        }
      }
    } catch (e) {}
  }
  
  const ogType = document.querySelector('meta[property="og:type"]')?.getAttribute('content');
  if (ogType === 'product' || ogType === 'product.item') {
    return {
      title: document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
      image: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    };
  }
  return null;
}

// ─── Visual-builder element renderer ──────────────────────────────────────────
// Renders a step's positioned elements (matching the dashboard canvas: elements
// are absolutely positioned with x/y/w/h as percentages of a width×height box).
// IDs are reused (email-input / cta-submit-btn / cta-link / close-btn) so the
// existing interaction wiring applies without change.
function buildElementsHTML(step: any, design: any, slot: any, smartProduct?: any): string {
  const els = [...(step.elements || [])].sort((a: any, b: any) => (a.zIndex || 0) - (b.zIndex || 0));
  const hasInput = els.some((e: any) => e.type === 'input' || e.type === 'phoneinput');
  let usedEmailId = false;
  let usedCtaId = false;
  const out: string[] = [];
  for (const el of els) {
    const ff = el.fontFamily || 'inherit';
    const pos = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;z-index:${el.zIndex || 1};opacity:${el.opacity ?? 1};box-sizing:border-box;overflow:hidden;`;
    
    // Support Option A: inject macros into raw text fields
    const content = el.content ? injectMacros(el.content) : '';

    switch (el.type) {
      case 'heading':
        out.push(`<div style="${pos}display:flex;align-items:center;justify-content:center;text-align:${el.align || 'center'};color:${el.color || '#111827'};font-size:${el.fontSize || 24}px;font-weight:${el.fontWeight || '700'};font-family:${ff};line-height:1.2;">${escapeHtml(content)}</div>`);
        break;
      case 'text':
        out.push(`<div style="${pos}display:flex;align-items:center;text-align:${el.align || 'left'};color:${el.color || '#4B5563'};font-size:${el.fontSize || 13}px;font-weight:${el.fontWeight || '400'};font-family:${ff};line-height:1.5;${el.backgroundColor ? `background:${el.backgroundColor};` : ''}${el.borderRadius ? `border-radius:${el.borderRadius}px;` : ''}${el.padding ? `padding:${el.padding}px;` : ''}">${escapeHtml(content)}</div>`);
        break;
      case 'button': {
        const isSubmit = hasInput && !usedCtaId;
        usedCtaId = true;
        const style = `${pos}display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;background:${el.backgroundColor || design.accentColor || '#6366f1'};color:${el.color || '#fff'};border-radius:${el.borderRadius ?? 8}px;font-size:${el.fontSize || 14}px;font-weight:700;font-family:${ff};border:${el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || 'transparent'}` : 'none'};`;
        if (isSubmit) {
          out.push(`<button type="button" id="cta-submit-btn" style="${style}">${escapeHtml(content || 'Submit')}</button>`);
        } else {
          let rawHref = el.href || slot?.click_tracker_url || slot?.product_url || '#';
          if (smartProduct && smartProduct.title) {
             rawHref += (rawHref.includes('?') ? '&' : '?') + `keyword=${encodeURIComponent(smartProduct.title)}`;
          }
          const href = injectMacros(rawHref);
          out.push(`<a id="cta-link" href="${escapeHtml(href)}" target="_blank" rel="noopener" style="${style}">${escapeHtml(content || 'Continue')}</a>`);
        }
        break;
      }
      case 'input':
      case 'phoneinput': {
        const idAttr = !usedEmailId ? ' id="email-input"' : '';
        usedEmailId = true;
        const ph = el.extraProps?.placeholder || el.content || 'Your email address…';
        out.push(`<input${idAttr} type="email" placeholder="${escapeHtml(injectMacros(ph))}" required style="${pos}padding:0 12px;font-size:13px;color:#1f2937;background:#fff;border:${el.borderWidth ?? 1}px solid ${el.borderColor || '#E4E4E7'};border-radius:${el.borderRadius ?? 8}px;outline:none;">`);
        break;
      }
      case 'image': {
        const imgSrc = (smartProduct && smartProduct.image) ? smartProduct.image : content;
        out.push(`<img src="${escapeHtml(imgSrc)}" alt="" referrerpolicy="no-referrer" style="${pos}object-fit:cover;border-radius:${el.borderRadius ?? 8}px;">`);
        break;
      }
      case 'close':
        out.push(`<button type="button" id="close-btn" aria-label="Close" style="${pos}display:flex;align-items:center;justify-content:center;background:none;border:none;cursor:pointer;color:${el.color || design.textColor || '#374151'};font-size:${el.fontSize || 16}px;">${escapeHtml(content || '✕')}</button>`);
        break;
      case 'shape':
        out.push(`<div style="${pos}background:${el.backgroundColor || '#000'};border-radius:${el.content === 'circle' ? '9999px' : `${el.borderRadius ?? 0}px`};border:${el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || 'transparent'}` : 'none'};"></div>`);
        break;
      case 'divider':
        out.push(`<div style="${pos}display:flex;align-items:center;"><div style="width:100%;border-top:${el.borderWidth ?? 1}px solid ${el.borderColor || el.color || '#e5e7eb'};"></div></div>`);
        break;
      case 'badge':
      case 'urgency':
        out.push(`<div style="${pos}display:flex;align-items:center;justify-content:center;background:${el.backgroundColor || design.accentColor || '#6366f1'};color:${el.color || '#fff'};border-radius:9999px;font-size:${el.fontSize || 11}px;font-weight:700;font-family:${ff};padding:0 8px;">${escapeHtml(content)}</div>`);
        break;
      default:
        if (content) out.push(`<div style="${pos}display:flex;align-items:center;justify-content:center;text-align:center;color:${el.color || design.textColor || '#111'};font-size:${el.fontSize || 13}px;font-family:${ff};">${escapeHtml(content)}</div>`);
    }
  }
  return out.join('');
}

// ─── Popup Rendering (Shadow DOM) ─────────────────────────────────────────────

function renderPopup(campaign: CampaignConfig, impressionTime?: number): void {
  const { design, affiliateSlots, id: campaignId } = campaign;
  const _impressionTs = Date.now();
  const getDisplayDuration = () => Math.round(Date.now() - _impressionTs);

  // Pick weighted affiliate slot
  let slot = pickWeightedSlot(affiliateSlots);
  if (slot) slot = { ...slot };

  // Detect Smart Product
  const smartProduct = (campaign.triggers as any)?.enableSmartAffiliate ? detectSmartProduct() : null;
  if (smartProduct && slot) {
    if (smartProduct.image) slot.image_url = smartProduct.image;
    if (smartProduct.title) {
      if (slot.product_url) slot.product_url += (slot.product_url.includes('?') ? '&' : '?') + `keyword=${encodeURIComponent(smartProduct.title)}`;
      if (slot.click_tracker_url) slot.click_tracker_url += (slot.click_tracker_url.includes('?') ? '&' : '?') + `keyword=${encodeURIComponent(smartProduct.title)}`;
    }
  }

  // Check popup kinds
  const popupType = (design as any).steps?.main?.popupType || design.kind || 'modal';
  const isSpinWheel = popupType === 'spinwheel' || design.headline?.toLowerCase().includes('spin') || campaignId.includes('spin');
  const isScratchCard = popupType === 'scratchcard' || design.headline?.toLowerCase().includes('scratch') || campaignId.includes('scratch');

  const getStep = (id: string) => {
    const s = (design as any).steps;
    return Array.isArray(s) ? s.find((x: any) => x.id === id) : s?.[id];
  };

  // Visual-builder element mode: render the main step's positioned elements
  // (matches the dashboard canvas) instead of the fixed flat-field layout.
  const mainStep = getStep('main');
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

  const add = (...args: string[]) => htmlChunks.push(...args);

  // Build style tag
  htmlChunks.push(`
<style>
:host { all: initial; font-family: system-ui, sans-serif; }
${design.overlayEnabled ? `.overlay { position: fixed; inset: 0; z-index: 2147483646; background: rgba(0,0,0,${design.overlayOpacity ?? 0.5}); animation: sp-fade-in 0.2s ease; }` : ''}
.popup { position: fixed; z-index: 2147483647; background: ${design.backgroundColor};
${design.backgroundImage ? `background-image: url(${design.backgroundImage}); background-size: cover; background-position: center; ` : ''}
color: ${design.textColor}; border-radius: ${design.borderRadius}px; box-shadow: ${getShadowCSS(design.boxShadow)};
${design.boxShadow === 'glass' ? 'backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); ' : ''}
margin: ${design.margin ?? '0px'}; width: ${width}; max-width: calc(100vw - 32px); ${positionStyles} animation: ${getAnimation(design.animation)}; overflow: hidden; }
.popup-inner { padding: ${design.padding ?? '24px'}; display: flex; flex-direction: column; gap: ${design.gap ?? '12px'}; }
.close-btn { position: absolute; ${design.closeButtonPosition === 'top-right' ? 'top: 12px; right: 12px;' : 'top: 12px; left: 12px;'} background: none; border: none; cursor: pointer; font-size: 18px; color: ${design.textColor}; opacity: 0.6; padding: 4px 8px; border-radius: 4px; z-index: 50; }
.close-btn:hover { opacity: 1; background: rgba(0,0,0,0.1); }
.headline { font-size: 20px; font-weight: 700; margin: 0; line-height: 1.3; }
.subheadline { font-size: 14px; opacity: 0.8; margin: 0; }
.body-text { font-size: 14px; margin: 0; line-height: 1.5; }
.product-image { width: 100%; border-radius: 8px; margin: 0; display: block; }
.email-input { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 14px; color: #1f2937; background: #ffffff; outline: none; }
.email-input:focus { border-color: ${design.accentColor}; }
.cta-btn { display: inline-block; width: 100%; text-align: center; border: none; cursor: pointer; background: ${design.accentColor}; color: #fff; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none; box-sizing: border-box; transition: opacity 0.15s; }
.cta-btn:hover { opacity: 0.9; }
.cta-link { color: ${design.accentColor}; text-decoration: underline; font-size: 14px; cursor: pointer; }
.dismiss-text { text-align: center; margin-top: 4px; font-size: 12px; opacity: 0.6; cursor: pointer; }
.dismiss-text:hover { opacity: 1; }
.powered-by { text-align: center; margin-top: 4px; font-size: 10px; opacity: 0.4; }
.gamified-container { display: flex; flex-direction: row; gap: 20px; align-items: center; justify-content: center; }
.gamified-left { flex: 1; display: flex; flex-direction: column; gap: 10px; }
.gamified-right { display: flex; align-items: center; justify-content: center; shrink-0; }
.spin-wrapper { position: relative; width: 220px; height: 220px; background: #1e1b4b; border-radius: 50%; border: 4px solid #312e81; box-shadow: 0 4px 12px rgba(0,0,0,0.3); overflow: hidden; display: flex; align-items: center; justify-content: center; }
.spin-wheel-svg { width: 100%; height: 100%; transform: rotate(0deg); transition: transform 3s cubic-bezier(0.15, 0.85, 0.25, 1); }
.spin-peg { position: absolute; top: -4px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 14px solid #f59e0b; z-index: 20; }
.spin-center-btn { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 44px; height: 44px; border-radius: 50%; background: #ffffff; border: 3px solid #1e1b4b; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; color: #1e1b4b; cursor: pointer; z-index: 10; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
.scratch-container { position: relative; width: 260px; height: 150px; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; background: #000000; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 2px 6px rgba(0,0,0,0.4); }
.scratch-canvas { position: absolute; inset: 0; cursor: crosshair; z-index: 10; touch-action: none; }
.scratch-prize { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #ffffff; font-family: monospace; z-index: 1; }
.success-coupon-box { display: flex; align-items: center; justify-content: center; gap: 8px; border: 2px dashed ${design.accentColor}; border-radius: 8px; padding: 12px; background: rgba(99, 102, 241, 0.05); font-size: 18px; font-weight: 800; font-family: monospace; letter-spacing: 2px; text-align: center; cursor: pointer; transition: background 0.2s; }
.success-coupon-box:hover { background: rgba(99, 102, 241, 0.1); }
.success-icon { width: 44px; height: 44px; background: #d1fae5; color: #065f46; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px auto; font-size: 20px; }
.email-suggest { font-size: 11px; color: ${design.accentColor}; background: rgba(99, 102, 241, 0.08); padding: 6px 12px; border-radius: 6px; margin-top: -4px; margin-bottom: 4px; cursor: pointer; display: none; align-items: center; gap: 4px; font-weight: 600; }
.email-suggest:hover { background: rgba(99, 102, 241, 0.15); }
`);

  // Persistent Teaser Badge Styles
  const isTeaserLeft = design.position === 'bottom-left' || design.position === 'top';
  htmlChunks.push(`
.teaser-badge { position: fixed; z-index: 2147483647; ${isTeaserLeft ? 'left: 20px;' : 'right: 20px;'} bottom: 20px; background: ${design.accentColor}; color: #ffffff; padding: 10px 18px; border-radius: 9999px; font-weight: 700; font-size: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); cursor: pointer; display: none; align-items: center; gap: 6px; transition: transform 0.2s, opacity 0.2s; }
.teaser-badge:hover { transform: scale(1.05); }
@keyframes sp-fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes sp-slide-up { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: translateY(0) } }
@keyframes sp-slide-down { from { opacity: 0; transform: translateY(-40px) } to { opacity: 1; transform: translateY(0) } }
@keyframes sp-zoom { from { opacity: 0; transform: scale(0.9) } to { opacity: 1; transform: scale(1) } }
@keyframes sp-bounce { 0% { opacity:0; transform:translateY(-60px) scale(0.95) } 55% { opacity:1; transform:translateY(12px) scale(1.02) } 75% { transform:translateY(-6px) scale(0.99) } 90% { transform:translateY(3px) scale(1.005) } 100% { opacity:1; transform:translateY(0) scale(1) } }
@keyframes sp-elastic { 0% { opacity:0; transform:scale(0.4) } 55% { opacity:1; transform:scale(1.08) } 75% { transform:scale(0.96) } 90% { transform:scale(1.02) } 100% { opacity:1; transform:scale(1) } }
@keyframes sp-flip-in { 0% { opacity:0; transform:perspective(600px) rotateX(-90deg) translateY(-40px) } 60% { opacity:1; transform:perspective(600px) rotateX(8deg) } 80% { transform:perspective(600px) rotateX(-4deg) } 100% { opacity:1; transform:perspective(600px) rotateX(0deg) translateY(0) } }
</style>
  `);

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
    htmlChunks.push(buildElementsHTML(mainStep, design, slot, smartProduct));
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
  htmlChunks.push(escapeHtml(injectMacros(design.headline || '')));
  htmlChunks.push('</h2>');

  if (design.subheadline) {
    htmlChunks.push('<p class="subheadline">');
    htmlChunks.push(escapeHtml(injectMacros(design.subheadline)));
    htmlChunks.push('</p>');
  }

  if (design.bodyText) {
    htmlChunks.push('<p class="body-text">');
    htmlChunks.push(escapeHtml(injectMacros(design.bodyText)));
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
    htmlChunks.push(escapeHtml(injectMacros(design.dismissText)));
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

  const teaserStep = getStep('teaser');
  if (teaserStep?.enabled !== false) {
    // Minimizable Teaser Badge
    htmlChunks.push('<div class="teaser-badge" id="teaser-badge">');
    htmlChunks.push('⚡ ');
    htmlChunks.push(escapeHtml(design.subheadline || 'Special Offer'));
    htmlChunks.push('</div>');
  }

  shadow.innerHTML = htmlChunks.join('');

  // Grab compiled Elements references inside closed Shadow DOM
  const popupCard = shadow.getElementById('popup-card');
  const overlay = shadow.getElementById('overlay');
  const teaser = shadow.getElementById('teaser-badge');
  const popupViewMain = shadow.getElementById('popup-view-main');

  // dismiss() — close the popup and minimise to the teaser badge.
  // Beacons the 'dismiss' event exactly once.
  let dismissed = false;
  const dismiss = (isClose = false) => {
    if (dismissed) return;
    dismissed = true;
    beaconEvent(campaign, isClose ? 'popup_close' : 'dismiss', slot?.id, { displayDuration: getDisplayDuration() });
    if (popupCard) popupCard.style.display = 'none';
    if (overlay)   overlay.style.display = 'none';
    if (teaser)    teaser.style.display = 'flex';
  };

  const reopen = () => {
    if (popupCard) popupCard.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
    if (teaser) teaser.style.display = 'none';
  };

  // Switch to success congratulations screen state
  const transitionToSuccess = (email: string) => {
    // email_capture = lead collected; conversion = outcome (covers popup_submit)
    if (email && email !== 'anonymous@scrollpop.online') {
      beaconEvent(campaign, 'email_capture', slot?.id, { hasEmail: true });
    }
    beaconEvent(campaign, 'conversion', slot?.id, { email });

    const successStep = getStep('success');
    if (successStep?.enabled === false) {
      // If success screen is disabled, just dismiss the modal immediately
      dismiss(true);
      return;
    }

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

  // Close (X) button behavior depends on plan tier:
  //
  // growth | scale | agency — two-step ad-trigger flow:
  //   1st click → opens the affiliate ad in a new tab, popup stays visible.
  //   User closes the new tab and returns — popup is still there.
  //   2nd click → dismisses popup and resets frequency cap.
  //
  // free | starter — standard instant dismiss (no ad-trigger on X).
  const closeEl = elementMode ? mainStep?.elements?.find((e: any) => e.type === 'close') : null;
  const closeUrl = adTriggerEnabled ? (closeEl?.href || slot?.click_tracker_url || slot?.product_url || null) : null;
  let adOpened = false;
  shadow.getElementById('close-btn')?.addEventListener('click', () => {
    if (closeUrl && !adOpened) {
      // First click: open ad, keep popup alive, beacon click
      adOpened = true;
      window.open(closeUrl, '_blank', 'noopener');
      beaconEvent(campaign, 'click', slot?.id, { destinationUrl: closeUrl, displayDuration: getDisplayDuration() });
    } else {
      // Second click, or free/starter plan — instant close
      dismiss(true);
      sessionStorage.removeItem(`_sp_session_${campaign.id}`);
      try { localStorage.removeItem(`_sp_fr_${campaign.id}`); } catch {}
    }
  });
  // Overlay/dismiss-text clicks are passive dismissals, not intentional close
  shadow.getElementById('dismiss-text')?.addEventListener('click', () => dismiss(false));
  shadow.getElementById('overlay')?.addEventListener('click', () => dismiss(false));
  shadow.getElementById('teaser-badge')?.addEventListener('click', reopen);

  // Wire up CTA click → beacon then navigate
  shadow.getElementById('cta-link')?.addEventListener('click', (e) => {
    const href = (e.currentTarget as HTMLAnchorElement)?.href || slot?.click_tracker_url || '';
    beaconEvent(campaign, 'click', slot?.id, { destinationUrl: href, displayDuration: getDisplayDuration() });
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
      // Logic removed for bundle size
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

type BeaconEventType =
  | 'impression' | 'view' | 'click' | 'dismiss' | 'conversion'
  | 'popup_close' | 'popup_submit' | 'popup_expand' | 'popup_minimize'
  | 'email_capture' | 'sms_capture' | 'discount_redeemed'
  | 'checkout_started' | 'purchase_completed' | 'trigger_fired';

const getScrollDepthPct = () =>
  Math.round(scrollY / Math.max(document.body.scrollHeight - innerHeight, 1) * 100);

function beaconEvent(
  campaign: CampaignConfig,
  eventType: BeaconEventType,
  affiliateSlotId?: string,
  extraMeta?: Record<string, unknown>
): void {
  if (_skipTracking) return;

  const payload = {
    events: [{
      campaignId:     campaign.id,
      siteId:         activeSiteId,
      eventType,
      affiliateSlotId: affiliateSlotId ?? null,
      visitorId:      getVisitorId(),
      sessionId:      getSessionId(),
      device:         getDevice(),
      pageUrl:        window.location.href,
      referrer:       document.referrer,
      scrollDepthPct: getScrollDepthPct(),
      meta:           extraMeta ?? null,
    }],
  };

  const url = `${EDGE_URL}/e`;
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    // MUST use text/plain for sendBeacon to avoid CORS preflight issues that cause silent failure
    navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
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

function escapeHtml(str: string | undefined | null): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Removed suggestCorrectEmail
// ─── Bootstrap ────────────────────────────────────────────────────────────────

function extractPublicKey(): string | null {
  const s = window as any;
  if (s.__sp?.publicKey) return s.__sp.publicKey;
  const init = s.__sp?.q?.find((c: any) => c[0] === 'init' && typeof c[1] === 'string');
  if (init) return init[1];

  const currentSrc = (document.currentScript as HTMLScriptElement)?.src;
  if (currentSrc) {
    const m = currentSrc.match(/\/v1\/([^\/]+)\/p\.js/);
    if (m && m[1]) return m[1];
  }

  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const src = scripts.item(i)?.src;
    if (src) {
      const match = src.match(/\/v1\/([^\/]+)\/p\.js/);
      if (match && match[1]) return match[1];
    }
  }
  return null;
}

// Bootstrap
const key = extractPublicKey();
if (key) {
  init(key);
}

