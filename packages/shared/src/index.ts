import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const Plan = z.enum(['free', 'starter', 'growth', 'scale', 'agency']);
export const MemberRole = z.enum(['owner', 'admin', 'editor', 'viewer']);
export const Platform = z.enum(['wordpress', 'shopify', 'html', 'donorbox', 'gofundme', 'other']);
export const CampaignStatus = z.enum(['draft', 'active', 'paused', 'archived']);
export const DesignKind = z.enum(['modal', 'slide_in', 'banner', 'bar', 'fullscreen', 'floating_bubble', 'notification_toast', 'corner_popup', 'gamified_overlay', 'inline_form']);
export const EventType = z.enum([
  'impression', 'view', 'click', 'dismiss', 'conversion',
  'popup_close', 'popup_submit', 'popup_expand', 'popup_minimize',
  'email_capture', 'sms_capture', 'discount_redeemed',
  'checkout_started', 'purchase_completed', 'trigger_fired', 'trigger_blocked',
]);
export const FrequencyType = z.enum(['once_per_session', 'once_per_day', 'once_per_visitor', 'always']);

// NOTE: back_button_capture is intentionally absent from TriggerType.
// See CLAUDE.md rule #1.
export const TriggerType = z.enum([
  'scroll_pct', 'dwell_time', 'inactivity', 'exit_intent_mouse', 'click',
]);

export const TargetingKind = z.enum([
  'url_exact', 'url_contains', 'url_regex', 'device', 'returning_visitor',
  'geo', 'session_page_views', 'utm', 'ab_test',
]);

// ─── Builder Blocks ─────────────────────────────────────────────────────────────

export const BuilderElementSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'image', 'button', 'timer', 'coupon', 'form', 'spacer', 'wheel', 'video', 'scratch_card', 'progress_bar']),
  content: z.string().optional(),
  styles: z.record(z.string()).optional(),
  responsiveStyles: z.object({
    mobile: z.record(z.string()).optional(),
    desktop: z.record(z.string()).optional(),
  }).optional(),
  props: z.record(z.any()).optional(),
});

export type BuilderElement = z.infer<typeof BuilderElementSchema>;

// ─── Design Config ────────────────────────────────────────────────────────────

// Require http(s) scheme on affiliate and design URLs — blocks javascript:, data:, etc.
const safeUrl = z.string().url().refine(
  (u) => /^https?:\/\//i.test(u),
  { message: 'URL must use http or https protocol' },
);

// Per-site saved affiliate links. Managed in Settings, surfaced in the campaign designer as a
// picker that pre-fills an element's `href` (X-close ad link / CTA / affiliate buttons). Stored
// as a JSONB array on `sites.affiliate_links`. The snippet renders the chosen URL through
// safeHref — these are plain element hrefs, so no snippet change is needed.
export const AffiliateLinkSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(80),
  url: safeUrl,
  // Optional click-tracker / redirect URL (e.g. a Rakuten linksynergy wrapper).
  clickTracker: safeUrl.optional(),
});

export const AffiliateSlotSchema = z.object({
  id: z.string().uuid(),
  product_name: z.string().min(1).max(200),
  product_url: safeUrl,
  image_url: safeUrl,
  click_tracker_url: safeUrl,
  cta_text: z.string().min(1).max(100),
  weight: z.number().int().min(1).max(100).default(1),
  coupon: z.string().max(50).optional(),
  // Product-card fields (optional). Used by the affiliate product-card template/block.
  // Free-text price so operators can format it ("$49.99", "£40", "From $19/mo").
  price: z.string().max(40).optional(),
  short_description: z.string().max(280).optional(),
});

export const DesignConfigSchema = z.object({
  kind: DesignKind.default('modal'),
  position: z.enum(['center', 'bottom-left', 'bottom-right', 'top', 'bottom']).default('center'),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#ffffff'),
  backgroundImage: safeUrl.optional(),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#111111'),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6366f1'),
  borderRadius: z.number().int().min(0).max(32).default(12),
  overlayEnabled: z.boolean().default(true),
  overlayOpacity: z.number().min(0).max(1).default(0.5),
  headline: z.string().min(1).max(200),
  subheadline: z.string().max(300).optional(),
  bodyText: z.string().max(1000).optional(),
  ctaText: z.string().min(1).max(100).default('Check it out'),
  ctaStyle: z.enum(['button', 'text_link']).default('button'),
  showCloseButton: z.boolean().default(true),
  closeButtonPosition: z.enum(['top-right', 'top-left']).default('top-right'),
  showDismissText: z.boolean().default(false),
  dismissText: z.string().max(100).optional(),
  animation: z.enum(['fade', 'slide_up', 'slide_down', 'zoom', 'none']).default('slide_up'),
  showPoweredBy: z.boolean().default(true),
  elements: z.array(BuilderElementSchema).optional(),
  layoutMode: z.enum(['legacy', 'blocks']).default('legacy'),
});

// ─── Trigger Params ───────────────────────────────────────────────────────────

// Optional per-device overrides for numeric trigger thresholds (P3-10).
// When the snippet detects a mobile device it applies these values instead of the top-level
// ones. Only the fields present in the override object are substituted.
const MobileOverridesSchema = z.object({
  pct: z.number().min(1).max(100).optional(),
  seconds: z.number().min(1).max(3600).optional(),
}).optional();

export const TriggerParamsSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('scroll_pct'), pct: z.number().min(1).max(100).default(50), mobileOverrides: MobileOverridesSchema }),
  z.object({ type: z.literal('dwell_time'), seconds: z.number().min(1).max(3600).default(30), mobileOverrides: MobileOverridesSchema }),
  z.object({ type: z.literal('inactivity'), seconds: z.number().min(5).max(3600).default(60), mobileOverrides: MobileOverridesSchema }),
  z.object({ type: z.literal('exit_intent_mouse'), sensitivity: z.number().min(5).max(100).default(20) }),
  z.object({ type: z.literal('click'), selector: z.string().min(1) }),
]);

// ─── API Response wrapper ─────────────────────────────────────────────────────

export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({ data: dataSchema });

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

// ─── Journeys (node-based multi-step flows) ─────────────────────────────────────

export const JourneyStatus = z.enum(['draft', 'active', 'paused', 'archived']);
export const JourneyNodeType = z.enum(['entry', 'popup', 'delay', 'condition', 'split', 'goal']);
// Which outcome of a node a given edge follows.
export const JourneyBranch = z.enum(['always', 'dismiss', 'convert', 'timeout', 'true', 'false', 'split']);

export const JourneyNodeSchema = z.object({
  id: z.string().uuid(),
  type: JourneyNodeType,
  // 'popup' nodes reference the campaign whose design/variant is shown.
  campaignId: z.string().uuid().nullable().optional(),
  config: z.record(z.unknown()).default({}),
  posX: z.number().int().default(0),
  posY: z.number().int().default(0),
});

export const JourneyEdgeSchema = z.object({
  id: z.string().uuid(),
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  branch: JourneyBranch.default('always'),
  config: z.record(z.unknown()).default({}),
});

export const JourneySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  siteId: z.string().uuid().nullable().optional(),
  status: JourneyStatus,
  // Journey-level active window (ISO 8601). The whole flow only arms between these.
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  version: z.number().int(),
  nodes: z.array(JourneyNodeSchema),
  edges: z.array(JourneyEdgeSchema),
});

// Compact compiled graph served to the snippet's journey engine. `next` is an adjacency map of
// branch → target node id, so the runtime walks the graph without re-deriving edges.
export const CompiledJourneyNodeSchema = z.object({
  id: z.string(),
  type: JourneyNodeType,
  campaignId: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  next: z.record(z.string()).default({}),
});

export const CompiledJourneySchema = z.object({
  id: z.string(),
  entryNodeId: z.string(),
  // Entry trigger hoisted for the engine to arm without walking the graph.
  trigger: z.record(z.unknown()).nullable().optional(),
  // Journey-level active window (ISO 8601), enforced by the snippet in visitor-local time.
  schedule: z.object({
    startsAt: z.string().nullable().optional(),
    endsAt: z.string().nullable().optional(),
  }).optional(),
  // Runtime guardrails the engine enforces.
  maxPopups: z.number().optional(),
  minDelay: z.number().optional(),
  nodes: z.array(CompiledJourneyNodeSchema),
});

// ─── Experiments (A/B variants) ─────────────────────────────────────────────────

export const VariantSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  name: z.string().min(1).max(80),
  weight: z.number().int().min(0).max(100),
  config: z.record(z.unknown()).default({}),
  affiliateSlots: z.array(AffiliateSlotSchema).default([]),
});

export const VariantResultSchema = z.object({
  variantId: z.string(),
  name: z.string().optional(),
  weight: z.number().optional(),
  impressions: z.number().int(),
  clicks: z.number().int(),
  conversions: z.number().int(),
  conversionRate: z.number(),
  // Significance vs. the baseline (control) variant.
  confidence: z.number().min(0).max(1).optional(), // P(beats baseline)
  isSignificant: z.boolean().optional(),
  isWinner: z.boolean().optional(),
  upliftPct: z.number().optional(),
});

export const ExperimentResultsSchema = z.object({
  campaignId: z.string(),
  variants: z.array(VariantResultSchema),
  decided: z.boolean(),
  winnerVariantId: z.string().nullable(),
  minImpressions: z.number().int(),
  totalImpressions: z.number().int(),
});

// ─── Plan Limits ──────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<z.infer<typeof Plan>, {
  monthlyViews: number;
  sites: number;
  showPoweredBy: boolean;
}> = {
  free:    { monthlyViews: 1_000,     sites: 1,   showPoweredBy: true },
  starter: { monthlyViews: 25_000,    sites: 3,   showPoweredBy: false },
  growth:  { monthlyViews: 150_000,   sites: 10,  showPoweredBy: false },
  scale:   { monthlyViews: 500_000,   sites: 999, showPoweredBy: false },
  agency:  { monthlyViews: 2_000_000, sites: 999, showPoweredBy: false },
};

export const PLAN_PRICES_USD: Record<z.infer<typeof Plan>, number> = {
  free:    0,
  starter: 19,
  growth:  49,
  scale:   129,
  agency:  299,
};

// ─── Exported types ───────────────────────────────────────────────────────────

export type Plan = z.infer<typeof Plan>;
export type MemberRole = z.infer<typeof MemberRole>;
export type Platform = z.infer<typeof Platform>;
export type CampaignStatus = z.infer<typeof CampaignStatus>;
export type DesignConfig = z.infer<typeof DesignConfigSchema>;
export type AffiliateSlot = z.infer<typeof AffiliateSlotSchema>;
export type AffiliateLink = z.infer<typeof AffiliateLinkSchema>;
export type TriggerType = z.infer<typeof TriggerType>;
export type TargetingKind = z.infer<typeof TargetingKind>;
export type JourneyStatus = z.infer<typeof JourneyStatus>;
export type JourneyNodeType = z.infer<typeof JourneyNodeType>;
export type JourneyBranch = z.infer<typeof JourneyBranch>;
export type JourneyNode = z.infer<typeof JourneyNodeSchema>;
export type JourneyEdge = z.infer<typeof JourneyEdgeSchema>;
export type Journey = z.infer<typeof JourneySchema>;
export type CompiledJourney = z.infer<typeof CompiledJourneySchema>;
export type CompiledJourneyNode = z.infer<typeof CompiledJourneyNodeSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type VariantResult = z.infer<typeof VariantResultSchema>;
export type ExperimentResults = z.infer<typeof ExperimentResultsSchema>;

// Site config payload sent by the edge Worker to the snippet
export interface SiteConfigPayload {
  siteId: string;
  plan: 'free' | 'starter' | 'growth' | 'scale' | 'agency';
  /** Strict opt-in: when true the snippet records no analytics until the host grants consent. */
  requireConsent?: boolean;
  /** Optional GDPR/CCPA cookie-consent bar, rendered by the snippet's lazy consent.js chunk.
   *  Only present when the operator has enabled it. */
  consentBanner?: {
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
  };
  /** Internal (edge-only): the edge Worker uses these to enforce the monthly view cap in
   *  real time, then STRIPS them before the response reaches the browser. Never sent to the snippet. */
  tenantId?: string;
  monthlyViewLimit?: number;
  campaigns: Array<{
    id: string;
    design: DesignConfig;
    triggers: Array<{ id: string; type: TriggerType; params: Record<string, unknown> }>;
    targeting: Array<{
      id: string;
      kind: z.infer<typeof TargetingKind>;
      operator: 'include' | 'exclude';
      value: Record<string, unknown>;
    }>;
    frequency: { frequency: z.infer<typeof FrequencyType> };
    affiliateSlots: AffiliateSlot[];
  }>;
  /** Published journeys for this site — the snippet's journey engine arms each entry trigger and
   *  walks the compiled graph. Popup nodes reference a campaign id that is also present in
   *  `campaigns` above (publish enforces that the referenced campaigns are active + same-site). */
  journeys?: CompiledJourney[];
  version: string;
}
