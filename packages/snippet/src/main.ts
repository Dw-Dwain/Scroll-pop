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

import {
  escapeHtml, safeHref, safeCssColor, safeCssUrl, safeCssInt,
  cssNum, cssFont, cssAlign, cssWeight, cssLen,
} from './sanitize.js';

// Pin the Shadow DOM host visible against hostile theme resets (some WP/Shopify themes force
// display:none / visibility:hidden on body-appended nodes). Inline !important wins cross-browser
// (Firefox/Safari included). Defined once; applied on every render path.
const HOST_PIN = 'display:block!important;visibility:visible!important';

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
  price?: string;
  short_description?: string;
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
  // Recurrence (optional). Absent → behaves exactly like the legacy `frequency` above.
  maxDisplayCount?: number | null;  // max total displays; 0/null = unlimited
  cooldownSeconds?: number;         // minimum seconds between displays
  showAgainIfConverts?: boolean;    // if false (default), stop showing once the visitor converts
}

interface DesignConfig {
  kind: 'modal' | 'slide_in' | 'banner' | 'bar' | 'fullscreen';
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom';
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
  // Optional run window — datetime-local strings ("YYYY-MM-DDTHH:mm", no timezone),
  // evaluated in the VISITOR'S local time.
  schedule?: { startsAt?: string; endsAt?: string };
}

interface CampaignConfig {
  id: string;
  design: DesignConfig;
  triggers: TriggerConfig[];
  targeting: TargetingRule[];
  frequency: FrequencyRule;
  affiliateSlots: AffiliateSlot[];
  // A/B test variants. When present, the snippet allocates a visitor to one (weighted, sticky)
  // and renders its design instead of `design`. Tags events with abVariantId.
  variants?: { id: string; weight: number; design: DesignConfig; affiliateSlots: AffiliateSlot[] }[];
}

// A published journey's compiled graph (served by internal/config). Executed by the lazy
// journey.js engine — see src/journey.ts.
interface JourneyConfig {
  id: string;
  entryNodeId: string;
  trigger?: { type: string; params?: Record<string, unknown> } | null;
  schedule?: { startsAt?: string | null; endsAt?: string | null };
  // Page targeting (URL rules) evaluated in the core before the journey is handed to the engine —
  // empty/absent = all pages. Reuses the same evaluator campaigns use.
  targeting?: TargetingRule[];
  // every_page | once_per_session | once_per_visitor — gated inside the engine (journey.ts).
  frequency?: string;
  maxPopups?: number;
  minDelay?: number;
  nodes: Array<{ id: string; type: string; campaignId?: string; config?: Record<string, unknown>; next: Record<string, string> }>;
}

interface SiteConfig {
  siteId: string;
  plan: string;
  requireConsent?: boolean;
  // Optional GDPR/CCPA cookie-consent bar. When enabled, the lazy consent.js chunk renders a
  // banner on first visit and reports the visitor's Accept/Reject choice (persisted locally).
  consentBanner?: ConsentBannerConfig;
  geo?: { country?: string }; // injected per-request by the edge Worker (CF-IPCountry)
  campaigns: CampaignConfig[];
  journeys?: JourneyConfig[];
  version: string;
}

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

function getEdgeUrl(): string {
  const w = window as any;
  if (typeof window !== 'undefined' && w.__SP_EDGE_URL) return w.__SP_EDGE_URL;
  try {
    const cdn = 'cdn.scrollpop.online';
    const cur = document?.currentScript as any;
    if (cur?.src && typeof cur.src === 'string' && !cur.src.includes(cdn)) {
      return new URL(cur.src).origin;
    }
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = (scripts[i] as HTMLScriptElement)?.src;
      if (src?.includes('/p.js') && !src.includes(cdn)) {
        return new URL(src).origin;
      }
    }
  } catch {}
  return 'https://edge.scrollpop.online';
}

const EDGE_URL = getEdgeUrl();

// ─── Lazy chunk loader ──────────────────────────────────────────────────────────
// Loads an optional sibling bundle (spin.js, targeting.js, …) on demand so the core
// p.js stays under its 10 KB gate. Each chunk attaches itself to a window.__sp_* global.
// Cached per file; resolves on load OR error (the caller guards on the chunk's global so a
// failed/blocked fetch degrades gracefully and never throws onto the host page).
const _chunkBase = EDGE_URL.replace(/\/c\/.*/, '');
const _chunkLoads: Record<string, Promise<void>> = {};
function loadChunk(file: string): Promise<void> {
  return (_chunkLoads[file] ||= new Promise<void>((resolve) => {
    const s = document.createElement('script');
    s.src = `${_chunkBase}/${file}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  }));
}

let activeSiteId = '';
let sitePlan = 'free'; // tenant plan — gates the "Powered by ScrollPop" badge
let visitorCountry = ''; // ISO country from the edge (config.geo.country) for geo targeting

// All served campaigns, keyed by id — lets the lazy journey.js sequence runtime present a
// chained "next" popup by id (advance-on-dismiss/convert). Populated during boot.
const campaignById = new Map<string, CampaignConfig>();

// Track when the snippet loaded so we can report time-on-page at trigger
const _pageLoadTime = Date.now();

// One-popup-at-a-time guard. True while a full popup is on screen; a new flow (another campaign or
// journey) whose trigger fires meanwhile is suppressed rather than stacked. Claimed when a popup
// renders, released when it's dismissed/converted — including before a journey advances, so a
// journey's own step-to-step chain still flows. (Spin-wheel popups are exempt — see renderPopup.)
let _spVisible = false;
let _skipTracking = false;
let _requireConsent = false; // strict per-tenant opt-in (set from config)

// EEA + UK (ISO-3166 alpha-2). Visitors here get opt-in-by-default consent: no analytics,
// no persistent visitor id, and no event beacons until consent is explicitly granted —
// regardless of the tenant's requireConsent flag (ePrivacy Art.5(3) / GDPR Art.6). The
// country comes from the edge (config.geo.country, derived from CF-IPCountry). Unknown geo is
// treated as non-EEA (opt-out default), matching prior behavior for the rest of the world.
const EEA_UK = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB',
]);
function consentRequiredByGeo(): boolean {
  return !!visitorCountry && EEA_UK.has(visitorCountry.toUpperCase());
}

// ─── Exclusion Guards ─────────────────────────────────────────────────────────
// Evaluates if we should skip analytics tracking (but still show popups)
function evaluateSkipTracking(): void {
  // Recomputed from scratch each call so granting consent can flip tracking back ON
  // (not just OFF) — the consent banner re-runs this after a visitor accepts.
  _skipTracking = false;
  // Honor Global Privacy Control (legally recognized under CCPA/CPRA) and the
  // internal admin flag. We intentionally do NOT honor the legacy Do Not Track
  // signal: it's deprecated (W3C disbanded the working group, browsers dropped the
  // UI) and non-binding, and respecting it silently dropped a large share of real
  // leads/analytics. GDPR/ePrivacy is handled separately by the explicit consent
  // gate below (window.__sp_consent / Consent Mode + per-tenant requireConsent).
  if ((navigator as any).globalPrivacyControl === true || localStorage.getItem('__sp_admin') === '1') {
    _skipTracking = true;
  }
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\.local$|\.test$|scrollpop/.test(window.location.hostname)) {
    _skipTracking = true;
  }
  // Consent gate (GDPR/ePrivacy): the host site or its CMP can deny analytics by
  // setting window.__sp_consent = false (or Google Consent Mode analytics_storage
  // = 'denied'). When denied we still render popups but record no analytics and
  // never persist a visitor id. EU/UK customers may also wire this to their own CMP.
  // Opt-in (skip until consent is explicitly granted) is the default when EITHER the
  // tenant requires it (_requireConsent) OR the visitor is in the EEA/UK (geo gate).
  const w = window as any;
  const cm = w.gtag_consent?.analytics_storage ?? w.__sp_consent_mode;
  const optInRequired = _requireConsent || consentRequiredByGeo();
  if (w.__sp_consent === false || cm === 'denied' || (optInRequired && w.__sp_consent !== true && cm !== 'granted')) {
    _skipTracking = true;
  }
}

// ─── Cookie-consent banner ────────────────────────────────────────────────────
// When the site enables consentBanner, show a GDPR/CCPA consent bar on first visit
// (rendered by the lazy consent.js chunk in its own closed Shadow DOM). The visitor's
// choice is persisted locally and re-applied on return visits. Granting flips
// window.__sp_consent on and re-evaluates tracking; rejecting keeps analytics off.
// Honors Global Privacy Control as an automatic opt-out (never shows the bar).
const CONSENT_CHOICE_KEY = '__sp_consent_choice';
function initConsent(cfg: SiteConfig): void {
  let banner = cfg.consentBanner;
  // EEA/UK opt-in: those visitors default to no tracking, so they need a path to grant
  // consent even when the tenant didn't configure a bar. Synthesize a default one (its copy
  // falls back to the built-in strings in consent.js).
  if (!banner?.enabled && consentRequiredByGeo()) {
    banner = { ...banner, enabled: true };
  }
  if (!banner?.enabled) return;

  const apply = (granted: boolean): void => {
    (window as any).__sp_consent = granted;
    // Mirror the choice into Google Consent Mode v2 if gtag is present on the host page.
    const g = (window as any).gtag;
    if (typeof g === 'function') {
      const v = granted ? 'granted' : 'denied';
      g('consent', 'update', { analytics_storage: v, ad_storage: v, ad_user_data: v, ad_personalization: v });
    }
    evaluateSkipTracking();
  };
  const store = (v: 'granted' | 'denied'): void => {
    try { localStorage.setItem(CONSENT_CHOICE_KEY, v); } catch { /* private mode */ }
  };

  // GPC is a legally recognized opt-out (CCPA/CPRA): record denial, never nag with the bar.
  if ((navigator as any).globalPrivacyControl === true) { store('denied'); return apply(false); }

  let prior: string | null = null;
  try { prior = localStorage.getItem(CONSENT_CHOICE_KEY); } catch { /* private mode */ }
  if (prior === 'granted') return apply(true);
  if (prior === 'denied') return apply(false);

  // No prior choice → show the banner. Guard on the chunk's global so a blocked/failed
  // fetch degrades gracefully (the existing consent gate still governs tracking).
  void loadChunk('consent.js').then(() => {
    (window as any).__sp_consent_banner?.show(banner, (granted: boolean) => {
      store(granted ? 'granted' : 'denied');
      apply(granted);
    });
  });
}

// Returns true if the snippet should abort entirely (e.g. bots)
function shouldAbortBoot(): boolean {
  const ua = navigator.userAgent;
  const botPattern = /bot|spider|crawl|slurp|headless|facebookexternalhit|embedly|pinterest|outbrain/i;
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
    sitePlan = config.plan || 'free';
    visitorCountry = config.geo?.country || '';
    // Strict opt-in: popups still render, but record no analytics until consent is granted.
    // Required either by the tenant (config.requireConsent) or by the visitor's geo (EEA/UK).
    // Re-evaluate now that BOTH the tenant flag and the visitor country are known — the
    // boot-time evaluate ran before geo was available.
    if (config.requireConsent) _requireConsent = true;
    evaluateSkipTracking();
    // Cookie-consent bar: apply a returning visitor's stored choice, or show the banner.
    initConsent(config);
    console.log('[ScrollPop] Config loaded successfully:', config);

    if (!config.campaigns || config.campaigns.length === 0) {
      console.warn('[ScrollPop] No active campaigns found for this site.');
      return;
    }

    // Lazy-load the advanced-targeting evaluator before we evaluate rules, but only if a
    // campaign actually uses one of its rule kinds (keeps it off the critical path otherwise).
    const needsTargeting =
      config.campaigns.some((c) => c.targeting?.some((r) => ADVANCED_TARGET_KINDS.has(r.kind))) ||
      (config.journeys?.some((j) => j.targeting?.some((r) => ADVANCED_TARGET_KINDS.has(r.kind))) ?? false);
    if (needsTargeting) await loadChunk('targeting.js');

    for (const campaign of config.campaigns) {
      campaignById.set(campaign.id, campaign); // registry for sequence chaining
      if (!withinSchedule(campaign.design)) {
        console.log('[ScrollPop] Campaign outside its scheduled window:', campaign.id);
        continue;
      }
      if (meetsTargetingRules(campaign.targeting)) {
        console.log('[ScrollPop] Registering triggers for campaign:', campaign.id);
        preloadCampaignImages(campaign);
        registerCampaignTriggers(campaign);
      } else {
        console.log('[ScrollPop] Campaign targeting rules not met for:', campaign.id);
      }
    }

    // Published journeys (node-based flows). Load the engine chunk only when the site has any,
    // so it never touches the core budget. Hand it the compiled graphs + the two core seams it
    // needs: show a campaign by id, and arm a trigger using the core's own trigger primitives.
    if (config.journeys && config.journeys.length) {
      // Page targeting is evaluated HERE (in the core), reusing the same rule evaluator campaigns
      // use — so a journey only reaches the engine on a page it's allowed to run on. The engine
      // (journey.ts) handles per-visitor frequency. Schedule is still gated by the engine's
      // withinWindow() on the served `schedule`.
      const journeys = config.journeys.filter((j) => meetsTargetingRules(j.targeting ?? []));
      if (!journeys.length) return;
      void loadChunk('journey.js').then(() => {
        (window as unknown as {
          __sp_journey?: {
            run: (j: JourneyConfig[], ctx: {
              show: (id: string, bypassFreq?: boolean, jctx?: Record<string, unknown>) => boolean;
              arm: (t: { type: string; params?: Record<string, unknown> }, cb: () => void) => void;
              close: (campaignId: string) => void;
            }) => void;
          };
        }).__sp_journey?.run(journeys, {
          // jctx = { journeyId, nodeId } — stamped onto every event this popup beacons (per-step funnel).
          show: (id: string, bypassFreq?: boolean, jctx?: Record<string, unknown>) => { const c = campaignById.get(id); return c ? presentCampaign(c, { bypassFreq: bypassFreq === true, journeyMeta: jctx }) : false; },
          arm: (t, cb) => registerTrigger(
            { id: 'journey', type: t.type as TriggerConfig['type'], params: t.params ?? {} },
            () => cb(),
          ),
          // Tear down a journey popup the engine advances PAST on its 'timeout' branch (the visitor
          // neither dismissed nor converted, so the core's dismiss path never ran) and free the
          // one-at-a-time slot, so the next step can show. dismiss/convert already close in the core.
          close: (id: string) => closePopupById(id),
        });
      });
    }
  } catch (e) {
    console.error('[ScrollPop] Error booting snippet:', e);
    // Silent fail — never throw errors onto the host page
  }
}

// ─── Scheduling ───────────────────────────────────────────────────────────────
// Start/end window evaluated in the VISITOR'S local time. startsAt/endsAt are
// datetime-local strings ("YYYY-MM-DDTHH:mm", no timezone), so new Date() parses
// them in the visitor's own zone. Popups simply don't fire outside the window.
function withinSchedule(design: DesignConfig): boolean {
  const s = design.schedule;
  if (!s) return true;
  const now = Date.now();
  if (s.startsAt && now < new Date(s.startsAt).getTime()) return false;
  if (s.endsAt && now > new Date(s.endsAt).getTime()) return false;
  return true;
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
      // Operators paste URLs without a scheme ("www.site.com/") — compare scheme-less,
      // hash- and trailing-slash-insensitive forms so the rule means "this page".
      return normalizeUrl(url) === normalizeUrl(value['url'] as string);

    case 'url_contains':
      return url.includes(value['pattern'] as string);

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

    case 'geo': {
      // Country match against the edge-injected visitor country (ISO alpha-2, uppercase).
      // Fail open if the edge couldn't resolve a country. Supports a multi-country list
      // (value.countries) or a single value.country (legacy). Codes are uppercase ISO.
      if (!visitorCountry) return true;
      const cs = value['countries'];
      return Array.isArray(cs) ? cs.includes(visitorCountry) : visitorCountry === value['country'];
    }

    // ab_test: real variant allocation is built in the A/B testing feature (backlog #6).
    // Until then this is a passthrough — the percentage gate is rebuilt there properly.
    case 'ab_test': return true;

    // Heavier rule kinds live in the lazy targeting.js chunk (loaded on the boot path before
    // this runs when any campaign needs them). Delegate to it; fail closed if it didn't load.
    case 'url_regex':
    case 'returning_visitor':
    case 'session_page_views':
    case 'utm': {
      const t = (window as unknown as { __sp_targeting?: { evaluateRule: (r: TargetingRule) => boolean } }).__sp_targeting;
      return t ? t.evaluateRule(rule) : false;
    }

    default:
      return true;
  }
}

// Rule kinds whose evaluation lives in the lazy targeting.js chunk.
const ADVANCED_TARGET_KINDS = new Set(['url_regex', 'returning_visitor', 'session_page_views', 'utm']);

// Lowercase, drop the http(s) scheme, the #fragment, and any trailing slash so a stored
// "www.site.com/page" matches a live "https://www.site.com/page/#section".
function normalizeUrl(u: string): string {
  return (u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/#.*$/, '').replace(/\/+$/, '');
}

// Kick off the download of any configured `image`-element URLs as soon as a campaign is
// scheduled to show — well before its trigger fires. Without this, full-bleed image
// templates show a blank popup until the <img> (only created at render time) finishes
// downloading. The browser image cache makes this a no-op cost if the image was already
// loaded elsewhere on the page.
function preloadCampaignImages(campaign: CampaignConfig): void {
  for (const el of (campaign.design as any)?.steps?.main?.elements || [])
    if (el.type === 'image') new Image().src = safeHref(el.content);
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

function registerCampaignTriggers(campaign: CampaignConfig): void {
  let fired = false;
  let triggerBeaconed = false;
  // Block telemetry is also once-per-load (B1): a multi-trigger campaign re-enters fire() per
  // trigger, and a still-blocked display would emit trigger_blocked N times while trigger_fired is
  // emitted once — making "Blocked" exceed "Triggered" in the Journeys diagnose funnel.
  let blockBeaconed = false;

  // fire() is called by a trigger with its metadata so we can beacon it
  const fire = (triggerMeta?: { triggerType: string; scrollPct?: number }) => {
    if (fired) return;

    // Minimum time-on-page gate: visitor must have been here ≥ 2s
    const timeOnPage = Date.now() - _pageLoadTime;
    if (timeOnPage < 2000) {
      console.log('[ScrollPop] Page load <2s — skipping trigger.');
      return;
    }

    // Funnel: record that a trigger condition was met — once per load, even if the frequency
    // cap then blocks display — so "Trigger Fired" ≥ "Popup Shown" in analytics.
    if (!triggerBeaconed) {
      triggerBeaconed = true;
      beaconEvent(campaign, 'trigger_fired', undefined, { triggerType: triggerMeta?.triggerType ?? 'unknown' });
    }

    if (!checkFrequencyCap(campaign.id, campaign.frequency)) {
      // Real block telemetry (Journeys diagnose): the trigger fired but display was suppressed
      // by the frequency cap. Emitted once per load (B1).
      if (!blockBeaconed) { blockBeaconed = true; beaconEvent(campaign, 'trigger_blocked', undefined, { reason: 'frequency_cap' }); }
      return;
    }
    // One popup at a time: don't stack over a popup that's already on screen. The trigger is
    // one-shot, so this campaign just won't show on this page (keeps multiple campaigns/journeys
    // on one page from overlapping).
    if (_spVisible) {
      if (!blockBeaconed) { blockBeaconed = true; beaconEvent(campaign, 'trigger_blocked', undefined, { reason: 'popup_open' }); }
      return;
    }
    fired = true;
    console.log('[ScrollPop] Trigger fired! Displaying campaign popup:', campaign.id);

    // Allocate the A/B variant first so the impression (and every later event) is attributed
    // to the chosen variant via abVariantId.
    resolveVariant(campaign);

    // Beacon impression with trigger metadata
    beaconEvent(campaign, 'impression', undefined, {
      triggerType: triggerMeta?.triggerType ?? 'unknown',
      scrollPct:   triggerMeta?.scrollPct  ?? Math.round((window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1)) * 100),
      timeOnPage,
    });

    renderPopup(campaign, timeOnPage);
    setFrequencyCap(campaign.id, campaign.frequency);
  };

  for (const trigger of campaign.triggers) {
    console.log('[ScrollPop] Registering trigger:', trigger.type, trigger.params);
    registerTrigger(trigger, fire);
  }
}

// Detect mobile once at module scope (navigator.maxTouchPoints covers iOS + Android).
const isMobile = () =>
  typeof navigator !== 'undefined' &&
  (navigator.maxTouchPoints > 0 || /Mobi|Android/i.test(navigator.userAgent));

// Apply mobileOverrides from trigger params when on a mobile device (P3-10).
function effectiveParams(params: Record<string, unknown>): Record<string, unknown> {
  if (!isMobile()) return params;
  const overrides = params['mobileOverrides'] as Record<string, unknown> | undefined;
  if (!overrides) return params;
  return { ...params, ...overrides };
}

function registerTrigger(trigger: TriggerConfig, fire: (meta?: { triggerType: string; scrollPct?: number }) => void): void {
  const p = effectiveParams(trigger.params);
  switch (trigger.type) {
    // ✅ SAFE: scroll position — direction-aware (only fires on downward scroll)
    case 'scroll_pct': {
      const targetPct = (p['pct'] as number) ?? 50;
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
      const seconds = (p['seconds'] as number) ?? 30;
      setTimeout(() => fire({ triggerType: 'dwell_time' }), seconds * 1000);
      break;
    }

    // ✅ SAFE: inactivity detection
    case 'inactivity': {
      let t: ReturnType<typeof setTimeout>;
      const ms = ((p['seconds'] as number) || 60) * 1000;
      const r = () => {
        clearTimeout(t);
        t = setTimeout(() => fire({ triggerType: 'inactivity' }), ms);
      };
      r();
      ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach((e) =>
        document.addEventListener(e, r, { passive: true })
      );
      break;
    }

    // ✅ SAFE: cursor leaving viewport toward top (NOT popstate/history). DESKTOP ONLY — there is
    // no reliable mobile exit signal, so exit-intent campaigns never arm on touch devices (firing
    // on a fast scroll-up was a false positive). Mobile visitors simply don't see exit-intent popups.
    case 'exit_intent_mouse': {
      if (isMobile()) break; // never arm exit-intent on mobile
      const sensitivity = (p['sensitivity'] as number) ?? 20;
      const onMouseMove = (e: MouseEvent) => {
        if (e.clientY <= sensitivity) {
          document.removeEventListener('mousemove', onMouseMove);
          fire({ triggerType: 'exit_intent_mouse' });
        }
      };
      document.addEventListener('mousemove', onMouseMove);
      break;
    }

    // ✅ SAFE: element click trigger
    case 'click': {
      const selector = p['selector'] as string;
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

type FreqState = { n?: number; ts?: number; c?: boolean };
function freqState(campaignId: string): FreqState {
  try { return JSON.parse(localStorage.getItem(`_sp_${campaignId}`) || '{}') as FreqState; } catch { return {}; }
}

// Recurrence-aware frequency gate. The legacy `frequency` enum still drives the defaults; the
// optional recurrence fields layer on top, so existing campaigns behave exactly as before.
function checkFrequencyCap(campaignId: string, f: FrequencyRule): boolean {
  // Rage-close protection: if the visitor X-closed this popup within 3s earlier in the session,
  // don't show it again for the rest of the session (set by dismiss()).
  try { if (sessionStorage.getItem('_sp_rg' + campaignId)) return false; } catch { /* private mode */ }
  // When recurrence is configured (max displays or a cooldown), it takes precedence over the
  // legacy per-session gate — otherwise "once per session" would block every re-display.
  const recurring = (f.maxDisplayCount ?? 0) > 0 || (f.cooldownSeconds ?? 0) > 0;
  if (!recurring && f.frequency === 'once_per_session' && sessionStorage.getItem(`_sp_session_${campaignId}`)) {
    return false;
  }
  const s = freqState(campaignId);
  const now = Date.now();
  // Stop showing once the visitor converted, unless explicitly allowed to recur.
  if (s.c && !f.showAgainIfConverts) return false;
  // Minimum gap between displays (recurrence; also expresses legacy once_per_day = 24h).
  const cooldownMs = (f.cooldownSeconds ?? (f.frequency === 'once_per_day' ? 86400 : 0)) * 1000;
  if (cooldownMs && s.ts && now - s.ts < cooldownMs) return false;
  // Max total displays (recurrence; also expresses legacy once_per_visitor = 1). 0/absent = unlimited.
  const max = f.maxDisplayCount ?? (f.frequency === 'once_per_visitor' ? 1 : 0);
  if (max && (s.n ?? 0) >= max) return false;
  return true;
}

function setFrequencyCap(campaignId: string, f: FrequencyRule): void {
  const s = freqState(campaignId);
  try {
    localStorage.setItem(`_sp_${campaignId}`, JSON.stringify({ n: (s.n ?? 0) + 1, ts: Date.now(), c: !!s.c }));
  } catch { /* storage blocked — non-fatal */ }
  if (f.frequency === 'once_per_session') {
    try { sessionStorage.setItem(`_sp_session_${campaignId}`, '1'); } catch { /* non-fatal */ }
  }
}

// Record that the visitor converted so showAgainIfConverts=false stops future displays.
function markConverted(campaignId: string): void {
  const s = freqState(campaignId);
  s.c = true;
  try { localStorage.setItem(`_sp_${campaignId}`, JSON.stringify(s)); } catch { /* non-fatal */ }
}

function getShadowCSS(shadow: string | undefined): string {
  switch (shadow) {
    case 'soft': return '0 4px 20px -2px rgba(0,0,0,0.05), 0 2px 8px -1px rgba(0,0,0,0.03)';
    case 'medium': return '0 10px 30px -4px rgba(0,0,0,0.08), 0 4px 12px -2px rgba(0,0,0,0.04)';
    case 'floating': return '0 20px 50px -12px rgba(0,0,0,0.15), 0 8px 24px -4px rgba(0,0,0,0.08)';
    case 'premium': return '0 30px 70px -10px rgba(0,0,0,0.2), 0 12px 30px -4px rgba(0,0,0,0.1)';
    case 'glass': return '0 8px 32px 0 rgba(0,0,0,0.08)';
    case 'dark': return '0 20px 40px -10px rgba(0,0,0,0.7), 0 0 20px 2px rgba(99,102,241,0.15)';
    case 'none': return 'none';
    default: return '0 20px 60px rgba(0,0,0,0.3)';
  }
}

// ─── Dynamic Affiliate & Macros ───────────────────────────────────────────────────
// Memoized browsing-context product (JSON-LD / OpenGraph) so {{product}} adapts the popup to
// whatever the visitor is viewing — without re-parsing the page for every macro.
let _spMacroProduct: ReturnType<typeof detectSmartProduct> | undefined;
function injectMacros(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    key = key.trim().toLowerCase();
    if (key === 'page_title') return document.title;
    // Context macros: the product/page the visitor is browsing (tie surveys/offers to it).
    if (key === 'product' || key === 'product_image') {
      if (_spMacroProduct === undefined) _spMacroProduct = detectSmartProduct();
      const og = (p: string) => document.querySelector(`meta[property="og:${p}"]`)?.getAttribute('content') || '';
      return key === 'product'
        ? (_spMacroProduct?.title || og('title') || document.title || match)
        : (_spMacroProduct?.image || og('image') || match);
    }
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

// Append a smart-product keyword to a URL, preserving any existing query string.
function withKeyword(url: string, title: string): string {
  return url + (url.includes('?') ? '&' : '?') + `keyword=${encodeURIComponent(title)}`;
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
// Formats milliseconds remaining into HH:MM:SS (or MM:SS when < 1 hour).
function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

function buildElementsHTML(step: any, design: any, slot: any, smartProduct?: any): string {
  const els = [...(step.elements || [])].sort((a: any, b: any) => (a.zIndex || 0) - (b.zIndex || 0));
  const hasInput = els.some((e: any) => e.type === 'input' || e.type === 'phoneinput');
  let usedEmailId = false;
  let usedCtaId = false;
  const out: string[] = [];

  // Sanitize design-level CSS values used as fallbacks for element colors
  const cssAccent = safeCssColor(design.accentColor, '#6366f1');
  const cssText   = safeCssColor(design.textColor, '#111111');
  const elColor   = (raw: unknown, fb: string) => safeCssColor(raw, fb);
  const elBgColor = (raw: unknown, fb: string) => safeCssColor(raw, fb);
  const elBorderR = (raw: unknown, fb: number) => safeCssInt(raw, 0, 999, fb);
  // Map a saved text alignment to a flex justify-content. Text/heading elements use
  // display:flex (for vertical centering), where `text-align` alone can't position a
  // single line horizontally — justify-content is what actually honors el.align.
  const elJustify = (a: unknown, fb: string) => {
    const v = cssAlign(a, fb);
    return v === 'right' ? 'flex-end' : v === 'center' ? 'center' : 'flex-start';
  };

  for (const el of els) {
    const ff = cssFont(el.fontFamily);
    const op = Math.min(Math.max(0, cssNum(el.opacity, 1)), 1);
    const pos = `position:absolute;left:${cssNum(el.x, 0)}%;top:${cssNum(el.y, 0)}%;width:${cssNum(el.w, 100)}%;height:${cssNum(el.h, 10)}%;z-index:${cssNum(el.zIndex, 1)};opacity:${op};box-sizing:border-box;overflow:hidden;`;

    // Support Option A: inject macros into raw text fields
    const content = el.content ? injectMacros(el.content) : '';

    switch (el.type) {
      case 'heading':
        out.push(`<div style="${pos}display:flex;align-items:center;justify-content:${elJustify(el.align, 'center')};text-align:${cssAlign(el.align, 'center')};color:${elColor(el.color, '#111827')};font-size:${cssNum(el.fontSize, 24)}px;font-weight:${cssWeight(el.fontWeight, '700')};font-family:${ff};line-height:1.2;">${escapeHtml(content)}</div>`);
        break;
      case 'text':
        out.push(`<div style="${pos}display:flex;align-items:center;justify-content:${elJustify(el.align, 'left')};text-align:${cssAlign(el.align, 'left')};color:${elColor(el.color, '#4B5563')};font-size:${cssNum(el.fontSize, 13)}px;font-weight:${cssWeight(el.fontWeight, '400')};font-family:${ff};line-height:1.5;${el.backgroundColor ? `background:${elBgColor(el.backgroundColor, 'transparent')};` : ''}${el.borderWidth ? `border:${cssNum(el.borderWidth, 1)}px solid ${elColor(el.borderColor, 'transparent')};` : ''}${el.borderRadius ? `border-radius:${elBorderR(el.borderRadius, 0)}px;` : ''}${el.padding ? `padding:${cssLen(el.padding, '0')};` : ''}">${escapeHtml(content)}</div>`);
        break;
      case 'button': {
        const isSubmit = hasInput && !usedCtaId;
        usedCtaId = true;
        // A transparent button is a full-card invisible click overlay (affiliate creatives) — it
        // must NOT show a default "Continue" label over the image. Only labelled/visible buttons do.
        const bgRaw = String(el.backgroundColor ?? '');
        const transp = bgRaw === 'transparent' || bgRaw === 'rgba(0,0,0,0)' || bgRaw === '#00000000' || /,\s*0(\.0+)?\s*\)$/.test(bgRaw);
        const style = `${pos}display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;background:${elBgColor(el.backgroundColor, cssAccent)};color:${elColor(el.color, '#fff')};border-radius:${elBorderR(el.borderRadius, 8)}px;font-size:${cssNum(el.fontSize, 14)}px;font-weight:700;font-family:${ff};border:${el.borderWidth ? `${cssNum(el.borderWidth, 1)}px solid ${elColor(el.borderColor, 'transparent')}` : 'none'};`;
        if (isSubmit) {
          out.push(`<button type="button" id="cta-submit-btn" style="${style}">${escapeHtml(content || 'Submit')}</button>`);
        } else {
          let rawHref = el.href || slot?.click_tracker_url || slot?.product_url || '#';
          if (smartProduct && smartProduct.title) {
             rawHref = withKeyword(rawHref, smartProduct.title);
          }
          const href = safeHref(injectMacros(rawHref));
          out.push(`<a id="cta-link" href="${escapeHtml(href)}" target="_blank" rel="noopener" style="${style}">${escapeHtml(content || (transp ? '' : 'Continue'))}</a>`);
        }
        break;
      }
      case 'input':
      case 'phoneinput': {
        const idAttr = !usedEmailId ? ' id="email-input"' : '';
        usedEmailId = true;
        const ph = el.extraProps?.placeholder || el.content || 'Your email address…';
        out.push(`<input${idAttr} type="email" placeholder="${escapeHtml(injectMacros(ph))}" required style="${pos}padding:0 12px;font-size:13px;color:#1f2937;background:#fff;border:${cssNum(el.borderWidth, 1)}px solid ${elColor(el.borderColor, '#E4E4E7')};border-radius:${elBorderR(el.borderRadius, 8)}px;outline:none;">`);
        break;
      }
      case 'consent': {
        // Marketing-consent checkbox. Submit is gated on it in executeLeadSubmit when
        // data-required is set; consent state is recorded in the lead event metadata.
        const reqAttr = el.extraProps?.['required'] === false ? '' : ' data-required="1"';
        out.push(`<label style="${pos}display:flex;align-items:flex-start;gap:8px;font-size:${cssNum(el.fontSize, 11)}px;color:${elColor(el.color, '#6B7280')};font-family:${ff};line-height:1.35;cursor:pointer;"><input type="checkbox" id="consent-checkbox"${reqAttr} style="flex-shrink:0;width:15px;height:15px;margin-top:1px;cursor:pointer;"><span>${escapeHtml(content || 'I agree to receive emails.')}</span></label>`);
        break;
      }
      case 'image': {
        const imgSrc = safeHref((smartProduct && smartProduct.image) ? smartProduct.image : content);
        const r = elBorderR(el.borderRadius, 8);
        // Honor a per-element object-fit; default 'cover' to match the designer canvas (object-cover).
        const fitRaw = String(el.objectFit ?? '');
        const fit = (fitRaw === 'contain' || fitRaw === 'fill' || fitRaw === 'none' || fitRaw === 'scale-down') ? fitRaw : 'cover';
        // When the image has an href it becomes the click target itself (id=cta-link → tracked +
        // opens the affiliate link) — no separate full-card button overlaying/hiding it.
        const imgHref = el.href ? safeHref(injectMacros(String(el.href))) : '';
        if (imgHref && !usedCtaId) {
          usedCtaId = true;
          // width/height:100% are REQUIRED here: an absolutely-positioned <img> (a replaced element)
          // with only inset:0 and auto width/height renders at its INTRINSIC size (NOT stretched to
          // the insets), so object-fit never applies and a large creative overflows/clips to its
          // top-left corner. Explicit 100% makes it fill the box so object-fit governs the scale.
          out.push(`<a id="cta-link" href="${escapeHtml(imgHref)}" target="_blank" rel="noopener" style="${pos}display:block;"><img src="${escapeHtml(imgSrc)}" alt="" referrerpolicy="no-referrer" style="position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:${fit};border-radius:${r}px;"></a>`);
        } else {
          out.push(`<img src="${escapeHtml(imgSrc)}" alt="" referrerpolicy="no-referrer" style="${pos}display:block;object-fit:${fit};border-radius:${r}px;">`);
        }
        break;
      }
      case 'close': {
        // The default '✕' (U+2715) — and several other X marks — are missing from common UI fonts →
        // rendered blank on the front end (but fine in the designer). Normalize ANY X-like glyph to
        // '×' (U+00D7, present in every font); keep genuinely custom text (e.g. "Close").
        const cc = content && !/^[×✕✖✗✘⨯╳xX✕＋]$/.test(content.trim()) ? content : '×';
        const cbg = elBgColor(el.backgroundColor, '#fff');
        let xcol = elColor(el.color, '#18181b'); // default DARK (the circle is white by default)
        // Guarantee contrast: a white/near-white X on a white/transparent circle would be invisible.
        const light = (c: string) => /^#(f{3}|f{6})$/i.test(c) || c === 'transparent';
        if (light(cbg) && light(xcol)) xcol = '#18181b';
        out.push(`<button type="button" id="close-btn" aria-label="Close" style="${pos}display:flex;align-items:center;justify-content:center;background:${cbg};border:1px solid #E4E4E7;border-radius:${elBorderR(el.borderRadius, 999)}px;box-shadow:0 1px 4px rgba(0,0,0,.18);cursor:pointer;color:${xcol};font-weight:700;font-size:${cssNum(el.fontSize, 16)}px;">${escapeHtml(cc)}</button>`);
        break;
      }
      case 'shape':
        out.push(`<div style="${pos}background:${elBgColor(el.backgroundColor, '#000')};border-radius:${el.content === 'circle' ? '9999px' : `${elBorderR(el.borderRadius, 0)}px`};border:${el.borderWidth ? `${cssNum(el.borderWidth, 1)}px solid ${elColor(el.borderColor, 'transparent')}` : 'none'};"></div>`);
        break;
      case 'divider':
        out.push(`<div style="${pos}display:flex;align-items:center;"><div style="width:100%;border-top:${cssNum(el.borderWidth, 1)}px solid ${elColor(el.borderColor || el.color, '#e5e7eb')};"></div></div>`);
        break;
      case 'badge':
      case 'urgency':
        out.push(`<div style="${pos}display:flex;align-items:center;justify-content:center;background:${elBgColor(el.backgroundColor, cssAccent)};color:${elColor(el.color, '#fff')};border-radius:9999px;font-size:${cssNum(el.fontSize, 11)}px;font-weight:700;font-family:${ff};padding:0 8px;">${escapeHtml(content)}</div>`);
        break;
      case 'countdown': {
        // el.content = ISO datetime string (target) OR a number of minutes from now.
        // Renders the initial value immediately; renderPopup starts the live tick after innerHTML is set.
        // content: ISO datetime string (target date) OR plain number treated as seconds remaining.
        const parsedDate = Date.parse(el.content || '');
        const targetMs = parsedDate ? parsedDate : (Date.now() + cssNum(Number(el.content), 600) * 1_000);
        const cdId = `__sp_cd_${String(el.id).replace(/[^a-z0-9]/gi, '_')}`;
        out.push(`<div id="${cdId}" style="${pos}display:flex;align-items:center;justify-content:center;font-family:${ff || 'monospace'};font-size:${cssNum(el.fontSize, 32)}px;font-weight:${cssWeight(el.fontWeight, '700')};color:${elColor(el.color, '#B91C1C')};background:${elBgColor(el.backgroundColor, 'transparent')};border-radius:${elBorderR(el.borderRadius, 0)}px;letter-spacing:0.04em;">${escapeHtml(fmtCountdown(targetMs - Date.now()))}</div>`);
        break;
      }
      default:
        if (content) out.push(`<div style="${pos}display:flex;align-items:center;justify-content:center;text-align:center;color:${elColor(el.color, cssText)};font-size:${cssNum(el.fontSize, 13)}px;font-family:${ff};">${escapeHtml(content)}</div>`);
    }
  }
  return out.join('');
}

// ─── Sequence chaining (FU-7) ─────────────────────────────────────────────────
// Present a campaign programmatically (used by the lazy journey.js runtime to chain to a
// "next" popup). Respects the next campaign's frequency cap; beacons a 'sequence' impression.
// Remove a popup's host from the page and free the one-at-a-time slot. Used by the journey engine
// when it advances PAST a popup on the 'timeout' branch (the visitor didn't dismiss/convert, so the
// core's dismiss path never ran). Best-effort — a missing host is fine.
function closePopupById(campaignId: string): void {
  document.getElementById('__sp_popup_' + campaignId)?.remove();
  _spVisible = false;
}

// Attribution for the journey popup currently on screen. The one-at-a-time guard means at most one
// is active, so a single holder is enough; beaconEvent merges it (when the campaign id matches) into
// every event the popup fires, so per-step journey funnels work even when the same campaign is reused
// as multiple nodes. Left set after close — harmless, since it's keyed by id and journey-step
// campaigns are trigger-stripped (only the journey ever shows them); the next show overwrites it.
let _journeyMeta: { id: string; meta: Record<string, unknown> } | null = null;

function presentCampaign(campaign: CampaignConfig, opts?: { bypassFreq?: boolean; journeyMeta?: Record<string, unknown> | undefined }): boolean {
  if (!opts?.bypassFreq && !checkFrequencyCap(campaign.id, campaign.frequency)) return false;
  if (_spVisible) return false; // one popup at a time — don't stack over a visible popup
  resolveVariant(campaign);
  _journeyMeta = opts?.journeyMeta ? { id: campaign.id, meta: opts.journeyMeta } : null;
  beaconEvent(campaign, 'impression', undefined, { triggerType: 'sequence' });
  renderPopup(campaign);
  setFrequencyCap(campaign.id, campaign.frequency);
  return true;
}

// Seam exposed to the lazy journey.js chunk: show a chained popup by id. journey.js owns the
// anti-trap guards (max chain length, no repeats, min delay) — see src/journey.ts.
(window as unknown as { __sp_core?: { show: (id: string) => boolean } }).__sp_core = {
  show: (id: string) => {
    const c = campaignById.get(id);
    return c ? presentCampaign(c) : false;
  },
};

// If this campaign declares a follow-up sequence, hand it to the journey runtime (lazy-loaded).
// `on` is the event that just happened ('dismiss' | 'convert'); the configured advanceOn must
// match (or be 'both'). Never chains to itself.
function maybeAdvanceSequence(campaign: CampaignConfig, design: DesignConfig, on: 'dismiss' | 'convert'): void {
  // Cheap guard so we only fetch journey.js when a sequence is actually configured (the flat
  // uiTriggers fields ride the design save like auto-reopen). The chunk owns the advanceOn match,
  // delay, and anti-trap guards — keeps those bytes out of the core bundle.
  const ui = (design as { uiTriggers?: Record<string, unknown> }).uiTriggers;
  if (!ui || !ui['sequenceNextCampaignId']) return;
  void loadChunk('journey.js').then(() => {
    (window as unknown as { __sp_journey?: { advance: (selfId: string, ui: Record<string, unknown>, on: string) => void } })
      .__sp_journey?.advance(campaign.id, ui, on);
  });
}

// Notify the journey engine (if loaded) that a popup was dismissed/converted, so a running
// node-based journey can follow the matching branch. No-op when no journeys are active (the
// chunk isn't loaded), so it's safe to call on every outcome.
function notifyJourney(campaignId: string, on: 'dismiss' | 'convert'): void {
  (window as unknown as { __sp_journey?: { notify?: (id: string, on: 'dismiss' | 'convert') => void } })
    .__sp_journey?.notify?.(campaignId, on);
}

// ─── Popup Rendering (Shadow DOM) ─────────────────────────────────────────────

// A/B: weighted, sticky-per-visitor variant allocation. Records the chosen variant id for
// event attribution (abVariantId). Falls back to the base design when there are no variants.
const _variantByCampaign: Record<string, string> = {};
function resolveVariant(campaign: CampaignConfig): { design: DesignConfig; affiliateSlots: AffiliateSlot[] } {
  const vs = campaign.variants;
  if (!vs || !vs.length) return { design: campaign.design, affiliateSlots: campaign.affiliateSlots };
  const key = '_sp_ab_' + campaign.id;
  let chosen = vs[0]!; // vs.length >= 1 guaranteed above
  let saved: string | null = null;
  try { saved = localStorage.getItem(key); } catch {}
  const sticky = saved ? vs.find((v) => v.id === saved) : undefined;
  if (sticky) {
    chosen = sticky;
  } else {
    const total = vs.reduce((s, v) => s + v.weight, 0);
    let r = Math.random() * total;
    for (const v of vs) { r -= v.weight; if (r < 0) { chosen = v; break; } }
    try { localStorage.setItem(key, chosen.id); } catch {}
  }
  _variantByCampaign[campaign.id] = chosen.id;
  return { design: chosen.design, affiliateSlots: chosen.affiliateSlots };
}

// ─── Spin-to-Win lazy loader ──────────────────────────────────────────────────
// Only fetched when the campaign kind is 'spin_wheel', so the main bundle stays
// under the 10 KB gate. The chunk sets window.__sp_spin = { render }.

function launchSpinWheel(campaign: CampaignConfig): void {
  const doLaunch = () => {
    const spinMod = (window as any).__sp_spin;
    if (!spinMod?.render) return;
    const { design, affiliateSlots } = resolveVariant(campaign);
    const host = document.createElement('div');
    host.id = `__sp_popup_${campaign.id}`;
    host.style.cssText = HOST_PIN;
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });
    spinMod.render(
      shadow,
      { ...(design as any), slices: (design as any).slices ?? affiliateSlots.map((s: AffiliateSlot) => ({ label: s.cta_text || s.product_name, color: '', coupon: s.coupon })) },
      (winner: { label: string; coupon?: string }) => {
        beaconEvent(campaign, 'conversion', undefined, { coupon_code: winner.coupon, label: winner.label });
      },
      () => {
        const el = document.getElementById(`__sp_popup_${campaign.id}`);
        if (el) el.remove();
        beaconEvent(campaign, 'dismiss');
      },
    );
    beaconEvent(campaign, 'impression');
  };

  void loadChunk('spin.js').then(doLaunch);
}

function renderPopup(campaign: CampaignConfig, impressionTime?: number): void {
  const { id: campaignId } = campaign;
  // Spin-to-win: delegate entirely to the lazy-loaded spin chunk. (Exempt from the one-at-a-time
  // slot — spin.js owns its own teardown and can't release the core flag.)
  if ((campaign.design as any).kind === 'spin_wheel') {
    launchSpinWheel(campaign);
    return;
  }
  _spVisible = true; // claim the single on-screen popup slot (released on dismiss/convert)
  const { design, affiliateSlots } = resolveVariant(campaign);
  const _impressionTs = Date.now();
  const getDisplayDuration = () => Math.round(Date.now() - _impressionTs);

  // Pick weighted affiliate slot
  let slot = pickWeightedSlot(affiliateSlots);
  if (slot) slot = { ...slot };

  // Detect Smart Product. The flag lives in the design config (config.uiTriggers, written by
  // both editors), NOT on campaign.triggers — that's the normalized trigger ARRAY from the
  // edge, so the old `campaign.triggers.enableSmartAffiliate` was always undefined and Smart
  // Product Match never ran live. Read it from the design config instead.
  const smartAffiliate = !!((design as any)?.uiTriggers?.enableSmartAffiliate ?? (design as any)?.enableSmartAffiliate);
  const smartProduct = smartAffiliate ? detectSmartProduct() : null;
  if (smartProduct && slot) {
    if (smartProduct.image) slot.image_url = smartProduct.image;
    if (smartProduct.title) {
      if (slot.product_url) slot.product_url = withKeyword(slot.product_url, smartProduct.title);
      if (slot.click_tracker_url) slot.click_tracker_url = withKeyword(slot.click_tracker_url, smartProduct.title);
    }
  }

  const getStep = (id: string) => {
    const s = (design as any).steps;
    return Array.isArray(s) ? s.find((x: any) => x.id === id) : s?.[id];
  };

  // Visual-builder element mode: render the main step's positioned elements
  // (matches the dashboard canvas) instead of the fixed flat-field layout.
  const mainStep = getStep('main');
  const elementMode = Array.isArray(mainStep?.elements) && mainStep.elements.length > 0;
  const hasCloseEl = elementMode && mainStep.elements.some((e: any) => e.type === 'close');

  // Create host element
  const host = document.createElement('div');
  host.id = `__sp_popup_${campaignId}`;
  // Some host themes hide body-appended elements via a global reset (e.g. a rule that sets
  // `display:none` on unknown `body > *`). Pin the host visible with inline !important so the
  // popup can never be suppressed by the host page's CSS. (Confirmed on Shopify themes.)
  host.style.cssText = HOST_PIN;
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', design.headline);
  // A11y: remember what had focus on the host page so we can restore it when the modal closes
  // (WCAG 2.4.3 Focus Order — focus must return somewhere sensible, not the top of the document).
  const prevFocus = document.activeElement as HTMLElement | null;
  document.body.appendChild(host);

  // Attach Shadow DOM — CSS isolation
  const shadow = host.attachShadow({ mode: 'closed' });

  let width = '480px';
  switch (design.size) {
    case 'sm': width = '360px'; break;
    case 'md': width = '480px'; break;
    case 'lg': width = '600px'; break;
  }
  // Element mode: match the editor's canvas box width (sanitized to a number).
  if (elementMode && mainStep.width) width = `${cssNum(mainStep.width, 480)}px`;

  const positionStyles = getPositionStyles(design);

  const htmlChunks: string[] = [];

  const add = (...args: string[]) => htmlChunks.push(...args);

  // Sanitize design config values before injecting into CSS
  const cssBackground = safeCssColor(design.backgroundColor, '#ffffff');
  const cssText       = safeCssColor(design.textColor, '#111111');
  const cssAccent     = safeCssColor(design.accentColor, '#6366f1');
  const cssBgImage    = safeCssUrl(design.backgroundImage);
  const cssBorderR    = safeCssInt(design.borderRadius, 0, 32, 12);
  const cssOverlayOp  = Math.min(Math.max(0, Number(design.overlayOpacity ?? 0.5)), 1);
  const cssMargin     = cssLen(design.margin, '0px');
  const cssPadding    = cssLen(design.padding, '24px');
  const cssGap        = cssLen(design.gap, '12px');

  // Build style tag
  htmlChunks.push(`
<style>
:host{all:initial;font-family:system-ui,sans-serif;}
${design.overlayEnabled ? `.overlay{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,${cssOverlayOp});animation:sp-fade-in .2s ease;}` : ''}
.popup{position:fixed;z-index:2147483647;background:${cssBackground};${cssBgImage ? `background-image:url("${cssBgImage}");background-size:cover;background-position:center;` : ''}color:${cssText};border-radius:${cssBorderR}px;box-shadow:${getShadowCSS(design.boxShadow)};${design.boxShadow === 'glass' ? 'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);' : ''}margin:${cssMargin};width:${width};max-width:calc(100vw - 32px);${positionStyles}animation:${getAnimation(design.animation)};overflow:hidden;}
.popup-inner{padding:${cssPadding};display:flex;flex-direction:column;gap:${cssGap};}
@media (max-width:560px){.popup{width:min(${width},94vw)!important;max-width:94vw!important;max-height:90dvh!important;}.popup-inner{width:100%!important;height:auto!important;max-height:90dvh!important;aspect-ratio:var(--sp-ar,auto)!important;}}
.close-btn{position:absolute;${design.closeButtonPosition === 'top-right' ? 'top:12px;right:12px;' : 'top:12px;left:12px;'}background:none;border:none;cursor:pointer;font-size:18px;color:${cssText};opacity:.6;padding:4px 8px;border-radius:4px;z-index:50;}
.close-btn:hover{opacity:1;background:rgba(0,0,0,.1);}
.headline{font-size:20px;font-weight:700;margin:0;line-height:1.3;}
.subheadline{font-size:14px;opacity:.8;margin:0;}
.body-text{font-size:14px;margin:0;line-height:1.5;}
.product-image{width:100%;border-radius:8px;margin:0;display:block;}
.email-input{width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid #d1d5db;font-size:14px;color:#1f2937;background:#fff;outline:none;}
.email-input:focus{border-color:${cssAccent};}
.cta-btn{display:inline-block;width:100%;text-align:center;border:none;cursor:pointer;background:${cssAccent};color:#fff;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;box-sizing:border-box;transition:opacity .15s;}
.cta-btn:hover{opacity:.9;}
.cta-link{color:${cssAccent};text-decoration:underline;font-size:14px;cursor:pointer;}
.dismiss-text{text-align:center;margin-top:4px;font-size:12px;opacity:.6;cursor:pointer;}
.dismiss-text:hover{opacity:1;}
.powered-by{text-align:center;margin-top:4px;font-size:10px;opacity:.4;}
.success-coupon-box{display:flex;align-items:center;justify-content:center;gap:8px;border:2px dashed ${cssAccent};border-radius:8px;padding:12px;background:rgba(99,102,241,.05);font-size:18px;font-weight:800;font-family:monospace;letter-spacing:2px;text-align:center;cursor:pointer;transition:background .2s;}
.success-coupon-box:hover{background:rgba(99,102,241,.1);}
.success-icon{width:44px;height:44px;background:#d1fae5;color:#065f46;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 10px auto;font-size:20px;}
</style>
  `);

  // Persistent Teaser Badge Styles
  const isTeaserLeft = design.position === 'bottom-left' || design.position === 'top';
  htmlChunks.push(`
<style>
.teaser-badge{position:fixed;z-index:2147483647;${isTeaserLeft ? 'left:20px;' : 'right:20px;'}bottom:20px;background:${cssAccent};color:#fff;padding:10px 18px;border-radius:9999px;font-weight:700;font-size:12px;box-shadow:0 10px 30px rgba(0,0,0,.15);cursor:pointer;display:none;align-items:center;gap:6px;transition:transform .2s,opacity .2s;}
.teaser-badge:hover{transform:scale(1.05);}
@keyframes sp-fade-in{from{opacity:0}to{opacity:1}}
@keyframes sp-slide-up{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
@keyframes sp-slide-down{from{opacity:0;transform:translateY(-40px)}to{opacity:1;transform:translateY(0)}}
@keyframes sp-zoom{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
@keyframes sp-bounce{0%{opacity:0;transform:translateY(-60px) scale(.95)}55%{opacity:1;transform:translateY(12px) scale(1.02)}75%{transform:translateY(-6px) scale(.99)}90%{transform:translateY(3px) scale(1.005)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes sp-elastic{0%{opacity:0;transform:scale(.4)}55%{opacity:1;transform:scale(1.08)}75%{transform:scale(.96)}90%{transform:scale(1.02)}100%{opacity:1;transform:scale(1)}}
@keyframes sp-flip-in{0%{opacity:0;transform:perspective(600px) rotateX(-90deg) translateY(-40px)}60%{opacity:1;transform:perspective(600px) rotateX(8deg)}80%{transform:perspective(600px) rotateX(-4deg)}100%{opacity:1;transform:perspective(600px) rotateX(0deg) translateY(0)}}
</style>
  `);

  // Overlay
  if (design.overlayEnabled) {
    htmlChunks.push('<div class="overlay" id="overlay"></div>');
  }

  // Popup Container
  // --sp-ar lets the mobile media query scale the popup to the viewport while keeping the design's
  // aspect ratio (so a fixed-size creative shrinks to fit instead of overflowing/zooming the page).
  htmlChunks.push(`<div class="popup" role="dialog" aria-modal="true" tabindex="-1" id="popup-card" style="--sp-ar:${cssNum(mainStep?.width, 360)}/${cssNum(mainStep?.height, 520)};">`);
  // Default close button — skipped in element mode when the design includes its own close element.
  if (design.showCloseButton && !hasCloseEl) {
    htmlChunks.push('<button class="close-btn" id="close-btn" aria-label="Close">✕</button>');
  }

  // ─── Element mode: render the builder's positioned elements ─────────────────
  // Element render — the only mode now. The legacy flat-field layout (headline/subheadline/
  // email/CTA assembled from flat design fields) was removed: every design the builder produces
  // is element-mode (verified across all live campaigns) and spin is delegated earlier. The shared
  // wiring below (close/CTA/email-submit/success) hooks the same element IDs from buildElementsHTML.
  htmlChunks.push(`<div class="popup-inner" id="popup-view-main" style="padding:0;position:relative;height:${cssNum(mainStep?.height, 520)}px;display:block;">`);
  if (elementMode) htmlChunks.push(buildElementsHTML(mainStep, design, slot, smartProduct));
  htmlChunks.push('</div>');
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

  // Start countdown timers for any countdown elements in the main step.
  // Each countdown element renders its initial value in buildElementsHTML and then
  // ticks live once per second until it reaches zero (P1-11).
  if (elementMode && mainStep?.elements) {
    for (const el of mainStep.elements as any[]) {
      if (el.type !== 'countdown') continue;
      const cdId = `__sp_cd_${String(el.id).replace(/[^a-z0-9]/gi, '_')}`;
      const cdEl = shadow.getElementById(cdId);
      if (!cdEl) continue;
      const targetMs = Date.parse(el.content || '') || (Date.now() + cssNum(Number(el.content), 10) * 60_000);
      const iv = setInterval(() => {
        const rem = targetMs - Date.now();
        cdEl.textContent = fmtCountdown(rem);
        if (rem <= 0) clearInterval(iv);
      }, 1000);
    }
  }

  // Grab compiled Elements references inside closed Shadow DOM
  const popupCard = shadow.getElementById('popup-card');
  const overlay = shadow.getElementById('overlay');
  const teaser = shadow.getElementById('teaser-badge');
  const popupViewMain = shadow.getElementById('popup-view-main');

  // Auto-reopen (re-engagement): re-show the popup on the SAME page N seconds after it's closed,
  // up to reopenMaxTimes. Driven by design.uiTriggers (rides the design save — no API dependency).
  // Aggressive UX — capped and off by default (reopenAfterSeconds=0).
  const _reopenRaw = safeCssInt((design as any).uiTriggers?.reopenAfterSeconds, 0, 300, 0);
  // Enforce a 15s minimum gap between displays (compliance/UX guardrail). 0 = off.
  const reopenAfter = _reopenRaw > 0 ? Math.max(15, _reopenRaw) : 0;
  const reopenMax = safeCssInt((design as any).uiTriggers?.reopenMaxTimes, 0, 20, 1);
  let reopens = 0;

  // ─── Accessibility: keyboard focus trap + Esc dismiss (WCAG 2.1 SC 2.1.2 / 4.1.2) ──
  // The popup is a modal dialog, so keyboard focus is kept inside it while open — but ALWAYS
  // escapable via Esc or the close control, which is exactly what SC 2.1.2 ("No Keyboard Trap")
  // requires (trapping is permitted only when a discoverable exit exists). Focus is moved into
  // the dialog on open and restored to the host page on close. Listener lives on the closed
  // shadow root for the popup's lifetime; it self-guards while minimised to the teaser.
  const FOCUS_SEL =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const focusables = () =>
    Array.from(shadow.querySelectorAll<HTMLElement>(FOCUS_SEL)).filter((el) => el.getClientRects().length > 0);
  const focusFirst = () => {
    const f = focusables();
    try { (f[0] || popupCard || host).focus(); } catch { /* element not focusable — ignore */ }
  };
  const onKeydown = (e: KeyboardEvent) => {
    if (!popupCard || popupCard.style.display === 'none') return; // minimised to teaser → no trap
    if (e.key === 'Escape') { e.stopPropagation(); dismiss(true); return; }
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (f.length === 0) { e.preventDefault(); return; }
    const first = f[0]!, last = f[f.length - 1]!;
    const active = shadow.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || !active || !shadow.contains(active))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };
  shadow.addEventListener('keydown', onKeydown as EventListener);

  // dismiss() — close the popup and minimise to the teaser badge.
  // `viaAd` = closed by an adClose redirect: it's already beaconed as 'close_ad_click', and it's an
  // intentional redirect (not an annoyed quit), so it skips the 'popup_close' beacon AND the rage
  // guard — keeping re-shows + auto-reopen alive for ad exposure.
  let dismissed = false;
  const dismiss = (isClose = false, viaAd = false) => {
    if (dismissed) return;
    dismissed = true;
    const dur = getDisplayDuration();
    // Don't double-count an ad-close (already 'close_ad_click') or skew the rage-close rate.
    if (!viaAd) beaconEvent(campaign, isClose ? 'popup_close' : 'dismiss', slot?.id, { displayDuration: dur });
    // Rage-close protection: an X-close within 3s means the visitor was annoyed. Flag it for the
    // rest of the session so checkFrequencyCap suppresses re-shows, and skip auto-reopen — don't
    // badger someone who clearly didn't want the popup. An ad-close is exempt (intentional redirect).
    const rage = isClose && dur < 3000 && !viaAd;
    if (rage) { try { sessionStorage.setItem('_sp_rg' + campaign.id, '1'); } catch { /* private mode */ } }
    if (popupCard) popupCard.style.display = 'none';
    _spVisible = false; // release the one-at-a-time slot (a blocked flow / journey step can show now)
    if (overlay)   overlay.style.display = 'none';
    if (teaser)    teaser.style.display = 'flex';
    // A11y: return keyboard focus to whatever the visitor was on before the popup stole it.
    try { prevFocus?.focus?.(); } catch { /* element gone — ignore */ }
    if (!rage && reopenAfter > 0 && reopens < reopenMax) {
      reopens++;
      setTimeout(() => {
        dismissed = false; // allow it to be closed again
        reopen();
        beaconEvent(campaign, 'impression', undefined, { triggerType: 'auto_reopen' });
      }, reopenAfter * 1000);
    } else {
      // Sequence chaining only when auto-reopen isn't re-engaging this same popup (never stack
      // both — that's the popup-trap pattern). Advance to the configured next campaign.
      maybeAdvanceSequence(campaign, design, 'dismiss');
      notifyJourney(campaign.id, 'dismiss'); // node-based journey: follow the 'dismiss' branch
    }
  };

  const reopen = () => {
    _spVisible = true; // re-claim the slot for the re-opened popup (teaser click or auto-reopen)
    if (popupCard) popupCard.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
    if (teaser) teaser.style.display = 'none';
    setTimeout(focusFirst, 60); // a11y: re-arm focus inside the dialog on re-open
  };

  // Switch to success congratulations screen state
  const transitionToSuccess = (email: string) => {
    // Record marketing-consent state for proof of consent. (The exact label shown is
    // stored on the campaign design, so consent + the event timestamp is sufficient.)
    const consentEl = shadow.getElementById('consent-checkbox') as HTMLInputElement | null;
    const consentMeta: Record<string, unknown> = consentEl ? { consent: consentEl.checked } : {};
    // email_capture = lead collected; conversion = outcome (covers popup_submit).
    // The email MUST be in the email_capture metadata — the API's ESP sync, auto-responder,
    // and Zapier/outbound webhook all read the address from this event (extractLeadEmail).
    // Previously this sent only { hasEmail: true }, so those integrations silently no-op'd.
    if (email && email !== 'anonymous@scrollpop.online') {
      beaconEvent(campaign, 'email_capture', slot?.id, { email, hasEmail: true, ...consentMeta });
    }
    beaconEvent(campaign, 'conversion', slot?.id, { email, ...consentMeta });
    markConverted(campaign.id); // recurrence: stops re-showing unless showAgainIfConverts
    _spVisible = false; // release before chaining so a journey 'convert' branch can show the next step
    maybeAdvanceSequence(campaign, design, 'convert'); // chain to next popup if advanceOn=convert/both
    notifyJourney(campaign.id, 'convert'); // node-based journey: follow the 'convert' branch

    const successStep = getStep('success');
    if (successStep?.enabled === false) {
      // If success screen is disabled, just dismiss the modal immediately
      dismiss(true);
      return;
    }

    // Element mode: if the operator designed a custom Success step in the builder,
    // render THOSE elements (so the live success screen matches the design) instead
    // of the built-in coupon card below. Wire any CTA/close the design includes.
    if (elementMode && successStep?.elements?.length && popupViewMain) {
      popupViewMain.innerHTML = buildElementsHTML(successStep, design, slot, smartProduct);
      popupViewMain.querySelector('#cta-link')?.addEventListener('click', () => beaconEvent(campaign, 'click', slot?.id));
      popupViewMain.querySelector('#close-btn')?.addEventListener('click', () => dismiss(true));
      return;
    }

    const couponTxt = slot?.coupon || 'WELCOME50';
    const trackerUrl = slot?.click_tracker_url || slot?.product_url || '#';

    // Construct beautiful success HTML (built-in fallback when no custom Success step)
    popupViewMain!.innerHTML = `<div class="success-icon">✓</div><h2 class="headline" style="text-align:center">Congratulations! Voucher active!</h2><p class="subheadline" style="text-align:center;margin-bottom:12px">Your promo code is ready below.</p><div class="success-coupon-box" id="success-coupon-box" title="Copy code"><span>${escapeHtml(couponTxt)}</span></div><a class="cta-btn" href="${escapeHtml(safeHref(trackerUrl))}" target="_blank" rel="noopener" id="success-cta-btn" style="margin-top:10px">Shop now</a>${sitePlan === 'free' ? '<p class="powered-by" style="margin-top:6px">Powered by ScrollPop</p>' : ''}`;

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

  // Close (X) button behaviour is per-campaign:
  //   default            → natural instant close (X just dismisses the popup).
  //   extraProps.adClose → single-click "ad-then-close": ONE X click opens the operator's affiliate
  //                        link in a new tab AND dismisses the popup in the same click. (Previously a
  //                        two-step flow — the 1st click opened the ad and kept the popup, a 2nd click
  //                        was needed to close. The second close has been removed.)
  const closeEl = elementMode ? mainStep?.elements?.find((e: any) => e.type === 'close') : null;
  const adClose = closeEl?.extraProps?.adClose === true;
  // Ad-close target priority: explicit href on the close element → the step's primary affiliate
  // link (the image/button href — where creative templates put it) → the affiliate slot URL.
  // Mirrors the designer preview's getStepAffiliate so production matches the simulation: new
  // creative-template campaigns keep the link on the image element, not the close button, so
  // closeEl.href alone is empty and the X used to close instantly instead of opening the ad.
  let stepAffiliateHref = '';
  if (adClose && !closeEl?.href && elementMode && Array.isArray(mainStep?.elements)) {
    for (const e of mainStep.elements as any[]) {
      const l = e?.href || e?.extraProps?.href;
      if (typeof l === 'string' && l.length > 4 && !l.includes('YOUR_') && !l.includes('REPLACE-')) { stepAffiliateHref = l; break; }
    }
  }
  const rawCloseHref = adClose ? (closeEl?.href || stepAffiliateHref || slot?.click_tracker_url || slot?.product_url || '') : '';
  const safeCloseHref = rawCloseHref ? safeHref(injectMacros(rawCloseHref)) : '';
  const closeUrl = (safeCloseHref && safeCloseHref !== '#') ? safeCloseHref : null;
  shadow.getElementById('close-btn')?.addEventListener('click', () => {
    if (closeUrl) {
      // adClose: ONE click opens the affiliate redirect in a new tab AND closes the popup (below).
      // Beacon as 'close_ad_click' (NOT 'click') — the X-close redirect stays out of Clicks/CTR.
      window.open(closeUrl, '_blank', 'noopener');
      beaconEvent(campaign, 'close_ad_click', slot?.id, { destinationUrl: closeUrl, displayDuration: getDisplayDuration() });
    }
    // Close on this same click — whether or not an ad fired (no-ad / free / starter just close).
    // viaAd=true when an ad fired so the close is exempt from rage suppression (re-shows stay alive).
    // Do NOT clear the frequency cap on close: the cap (`_sp_<id>` ts/count + `_sp_session_<id>`) is
    // written when the popup SHOWS, and wiping it here defeats once_per_day / once_per_visitor /
    // recurrence / convert-suppression — the popup would re-open on the next load. Closing the popup
    // must never reset how often it's allowed to show. (Removed the old SR-11 cap-clear, which only
    // ever made sense as an adClose re-engagement hack and broke operator frequency settings.)
    dismiss(true, !!closeUrl);
  });
  // An explicit "no thanks" dismiss-text link still closes, but clicking/tapping the dark backdrop
  // does NOT (intentional: the popup is X-only, so a stray tap outside — common on mobile — can't
  // dismiss it). The overlay is purely a visual scrim now.
  shadow.getElementById('dismiss-text')?.addEventListener('click', () => dismiss(false));
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
        emailInput.setAttribute('aria-invalid', 'true'); // a11y: announce the error to AT
        emailInput.focus();
      }
      return;
    }
    if (emailInput) emailInput.removeAttribute('aria-invalid');
    // Marketing-consent gate: if a required consent checkbox is present and unticked, block submit.
    const consentBox = shadow.getElementById('consent-checkbox') as HTMLInputElement | null;
    if (consentBox && consentBox.getAttribute('data-required') === '1' && !consentBox.checked) {
      consentBox.style.outline = '2px solid #ef4444';
      consentBox.focus();
      return;
    }
    transitionToSuccess(emailVal || 'anonymous@scrollpop.online');
  };

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      // Lead-capture submit (email-capture popups)
      executeLeadSubmit();
    });
  }

  // A11y: move keyboard focus into the dialog now that it has rendered and wired up.
  setTimeout(focusFirst, 60);

  // Beacon view after 1s (user actually saw it)
  setTimeout(() => beaconEvent(campaign, 'view'), 1000);
}

function getPositionStyles(design: DesignConfig): string {
  switch (design.position) {
    case 'center': return 'top:50%;left:50%;translate:-50% -50%;';
    case 'top-left': return 'top: 16px; left: 16px;';
    case 'top-right': return 'top: 16px; right: 16px;';
    case 'bottom-left': return 'bottom: 16px; left: 16px;';
    case 'bottom-right': return 'bottom: 16px; right: 16px;';
    case 'top': return 'top: 0; left: 0; right: 0; width: 100%; max-width: 100%; border-radius: 0;';
    case 'bottom': return 'bottom: 0; left: 0; right: 0; width: 100%; max-width: 100%; border-radius: 0;';
    default: return 'top:50%;left:50%;translate:-50% -50%;';
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
  | 'impression' | 'view' | 'click' | 'close_ad_click' | 'dismiss' | 'conversion'
  | 'popup_close' | 'popup_submit' | 'popup_expand' | 'popup_minimize'
  | 'email_capture' | 'sms_capture' | 'discount_redeemed'
  | 'checkout_started' | 'purchase_completed' | 'trigger_fired' | 'trigger_blocked';

const getScrollDepthPct = () =>
  Math.round(scrollY / Math.max(document.body.scrollHeight - innerHeight, 1) * 100);

function beaconEvent(
  campaign: CampaignConfig,
  eventType: BeaconEventType,
  affiliateSlotId?: string,
  extraMeta?: Record<string, unknown>
): void {
  if (_skipTracking) return;

  // Merge journey/node attribution for the active journey popup so this event lands in its per-step
  // funnel (only when the ids match — a standalone popup of a different campaign isn't tagged).
  const jm = _journeyMeta && _journeyMeta.id === campaign.id ? _journeyMeta.meta : null;
  const meta = jm ? { ...extraMeta, ...jm } : (extraMeta ?? null);

  const payload = {
    events: [{
      campaignId:     campaign.id,
      siteId:         activeSiteId,
      eventType,
      abVariantId:    _variantByCampaign[campaign.id] ?? null,
      affiliateSlotId: affiliateSlotId ?? null,
      visitorId:      getVisitorId(),
      sessionId:      getSessionId(),
      device:         getDevice(),
      pageUrl:        window.location.href,
      referrer:       document.referrer,
      scrollDepthPct: getScrollDepthPct(),
      meta,
    }],
  };

  const url = `${EDGE_URL}/e`;
  const body = JSON.stringify(payload);

  // keepalive fetch fallback. text/plain is a CORS-safelisted content type → no preflight (the
  // API JSON-parses the body regardless of header); credentials are omitted so Firefox ETP /
  // strict-privacy doesn't treat it as third-party tracking storage and block it.
  const sendFetch = () => fetch(url, {
    method: 'POST',
    body,
    keepalive: true,
    // credentials omitted (cross-origin default already sends no cookies) — keeps it
    // out of "third-party tracking storage" heuristics that block Firefox-ETP visitors.
    credentials: 'omit',
    headers: { 'Content-Type': 'text/plain' },
  }).catch(() => { /* silent fail */ });

  // sendBeacon returns false when the UA refuses to queue the request — e.g. Firefox ETP /
  // strict-privacy silently drops a third-party beacon. We MUST honour that return value and
  // fall back to fetch, or the event is lost (the analytics undercount these visitors caused).
  if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return;
  sendFetch();
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

