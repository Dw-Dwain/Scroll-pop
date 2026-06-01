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
  'checkout_started', 'purchase_completed', 'trigger_fired',
]);
export const FrequencyType = z.enum(['once_per_session', 'once_per_day', 'once_per_visitor', 'always']);

// NOTE: back_button_capture is intentionally absent from TriggerType.
// See CLAUDE.md rule #1.
export const TriggerType = z.enum([
  'scroll_pct', 'dwell_time', 'inactivity', 'exit_intent_mouse', 'click',
]);

export const TargetingKind = z.enum([
  'url_exact', 'url_contains', 'url_regex', 'device', 'returning_visitor',
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

export const AffiliateSlotSchema = z.object({
  id: z.string().uuid(),
  product_name: z.string().min(1).max(200),
  product_url: z.string().url(),
  image_url: z.string().url(),
  click_tracker_url: z.string().url(),
  cta_text: z.string().min(1).max(100),
  weight: z.number().int().min(1).max(100).default(1),
  coupon: z.string().max(50).optional(),
});

export const DesignConfigSchema = z.object({
  kind: DesignKind.default('modal'),
  position: z.enum(['center', 'bottom-left', 'bottom-right', 'top', 'bottom']).default('center'),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#ffffff'),
  backgroundImage: z.string().url().optional(),
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

export const TriggerParamsSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('scroll_pct'), pct: z.number().min(1).max(100).default(50) }),
  z.object({ type: z.literal('dwell_time'), seconds: z.number().min(1).max(3600).default(30) }),
  z.object({ type: z.literal('inactivity'), seconds: z.number().min(5).max(3600).default(60) }),
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
export type TriggerType = z.infer<typeof TriggerType>;
export type TargetingKind = z.infer<typeof TargetingKind>;

// Site config payload sent by the edge Worker to the snippet
export interface SiteConfigPayload {
  siteId: string;
  plan: 'free' | 'starter' | 'growth' | 'scale' | 'agency';
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
  version: string;
}
