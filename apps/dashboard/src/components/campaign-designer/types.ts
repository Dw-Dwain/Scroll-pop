/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PopupType =
  | 'modal'
  | 'fullscreen'
  | 'stickybar'
  | 'slidein'
  | 'floating'
  | 'spinwheel'
  | 'embedded';

export type CanvasPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export type ElementType =
  | 'heading'
  | 'text'
  | 'button'
  | 'input'
  | 'consent'
  | 'countdown'
  | 'product'
  | 'review'
  | 'qrcode'
  | 'urgency'
  | 'shape'
  | 'close'
  | 'image'
  | 'ticker'
  | 'progressbar'
  | 'couponcard'
  | 'phoneinput'
  | 'badge'
  | 'divider';

export interface CampaignElement {
  id: string;
  type: ElementType;
  x: number; // percentage or left position relative to layout container
  y: number; // percentage or top position relative to layout container
  w: number; // width in px or percentage
  h: number; // height in px or percentage
  content: string; // text content or image url
  color?: string;
  fontSize?: number; //px
  fontWeight?: string; // e.g. "normal", "bold", "700"
  fontFamily?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  backgroundColor?: string;
  borderRadius?: number; // px
  borderWidth?: number; // px
  borderColor?: string;
  padding?: number; // px
  boxShadow?: string;
  opacity?: number;
  zIndex: number;
  animationType?: 'none' | 'fade-in' | 'slide-in' | 'bounce' | 'zoom-in' | 'spin' | 'flip';
  animationDuration?: number; // in seconds, default is 0.5
  animationDelay?: number; // in seconds, default is 0
  /** Affiliate / destination URL for button and close elements. Opens in new tab. */
  href?: string;
  extraProps?: Record<string, unknown>;
}

export type CampaignStep = 'teaser' | 'main' | 'success';

export interface CampaignStepConfig {
  enabled?: boolean;
  elements: CampaignElement[];
  backgroundColor: string;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  boxShadow: string;
  width: number; // base editor width in px
  height: number; // base editor height in px
  overlayColor: string; // backdrop overlay string
  animationEntrance: string;
  popupType: PopupType;
  position: CanvasPosition;
}

export interface CampaignTriggers {
  exitIntent: boolean;
  scrollPercent: number; // 0 to 100, 0 is disabled
  inactivitySeconds: number; // 0 is disabled
  timeDelaySeconds: number; // 0 is disabled
  pageTargeting: string; // DEPRECATED: e.g. "/products/*" or "*"
  pageTargetingRules?: Array<{
    operator: 'include' | 'exclude';
    matchType: 'contains' | 'exact' | 'regex';
    value: string;
  }>;
  deviceTargeting: 'all' | 'desktop' | 'mobile' | 'tablet';
  geoTargeting: string; // country code/name
  frequencyCapDays: number;
  // Advanced audience targeting
  newVisitorOnly: boolean; // show only to first-time visitors
  sessionPageCount: number; // fire after visiting N pages (0 = disabled)
  utmParam: string;  // which UTM param to match: utm_source/medium/campaign/term/content
  utmValue: string;  // show only when the chosen UTM param matches this value (empty = all)
  // Campaign schedule — datetime-local strings ("YYYY-MM-DDTHH:mm"), visitor's local time.
  // Empty = unbounded on that side. The popup only fires within [startsAt, endsAt].
  startsAt: string;
  endsAt: string;
  abTestPercent?: number; // deprecated — A/B testing is now handled by the variants system
  enableSmartAffiliate?: boolean; // scrape page to inject dynamic product details
  // How often the popup may show to the same visitor (persisted as the campaign frequency rule)
  frequency?: 'always' | 'once_per_session' | 'once_per_day' | 'once_per_visitor';
  // Recurrence (optional, layered on top of `frequency`). Persisted to the frequency rule.
  maxDisplayCount?: number;       // max total displays to one visitor; 0 = unlimited
  cooldownMinutes?: number;       // minimum minutes between displays (stored as seconds in the API)
  showAgainIfConverts?: boolean;  // keep showing even after the visitor converts
  // Same-page auto-reopen (re-engagement). Stored in config.uiTriggers (no API dependency).
  reopenAfterSeconds?: number;    // seconds after close to auto-reopen on the same page; 0 = off
  reopenMaxTimes?: number;        // max auto-reopens on one page load
  // Sequence chaining (FU-7) — advance to another campaign's popup after this one is
  // dismissed/converts. Stored in config.uiTriggers; the snippet loads journey.js to run it
  // (hard guards: max 2 chained popups/page, no repeats, ≥5s gap). Empty = off.
  sequenceNextCampaignId?: string;                       // the campaign to show next
  sequenceAdvanceOn?: 'dismiss' | 'convert' | 'both';    // which event triggers the advance
  sequenceDelaySeconds?: number;                         // delay before the next popup (min 5s at runtime)
}

export interface Campaign {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
  steps: {
    teaser: CampaignStepConfig;
    main: CampaignStepConfig;
    success: CampaignStepConfig;
  };
  triggers: CampaignTriggers;
  conversions: number;
  views: number;
  createdAt: string;
}

export interface DragState {
  elementId: string | null;
  dragStartX: number;
  dragStartY: number;
  elemStartX: number;
  elemStartY: number;
  action: 'drag' | 'resize' | 'rotate' | null;
  resizeHandle?: string | undefined; // 'nw' | 'ne' | 'se' | 'sw' | 'e' | 's'
  elemStartW?: number;
  elemStartH?: number;
}

export interface BrandStyle {
  id: string;
  name: string;
  fontHeading: string;
  fontBody: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
}
