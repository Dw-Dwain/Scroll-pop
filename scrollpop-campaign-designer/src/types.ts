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
  | 'countdown'
  | 'product'
  | 'review'
  | 'qrcode'
  | 'urgency'
  | 'shape'
  | 'close'
  | 'image';

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
  extraProps?: Record<string, any>;
}

export type CampaignStep = 'teaser' | 'main' | 'success';

export interface CampaignStepConfig {
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
  pageTargeting: string; // e.g. "/products/*" or "*"
  deviceTargeting: 'all' | 'desktop' | 'mobile';
  geoTargeting: string; // country code/name
  frequencyCapDays: number;
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
  action: 'drag' | 'resize' | null;
  resizeHandle?: string; // 'nw' | 'ne' | 'se' | 'sw' | 'e' | 's'
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
