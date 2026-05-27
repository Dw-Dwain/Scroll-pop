export type RuleOperator = 'and' | 'or';
export type RuleKind = 'url_contains' | 'url_exact' | 'url_regex' | 'device' | 'returning_visitor' | 'time_on_site' | 'idle_time' | 'scroll_depth' | 'exit_intent' | 'browser_back' | 'custom_js' | 'browser_language' | 'referring_website' | 'visit_count' | 'page_view_count' | 'visited_page_count' | 'not_seen_page' | 'previously_viewed' | 'has_clicked_button' | 'is_subscriber' | 'country_state' | 'block_ip';
export type TriggerType = 'scroll_pct' | 'dwell_time' | 'inactivity' | 'exit_intent' | 'custom';

export type SchedulerWindow = {
  id: string;
  day: 'all' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  start: string;
  end: string;
  tz: string;
};

export type RuleCondition = {
  id: string;
  type: 'condition';
  kind: RuleKind;
  operator: 'include' | 'exclude';
  value: string;
};

export type RuleGroup = {
  id: string;
  type: 'group';
  operator: RuleOperator;
  children: Array<RuleCondition | RuleGroup>;
};

export type TemplatePreset = {
  id: string;
  name: string;
  kind: 'modal' | 'slide_in' | 'banner' | 'bar' | 'fullscreen' | 'floating_bubble' | 'notification_toast' | 'corner_popup' | 'gamified_overlay' | 'inline_form';
  category: 'Lead Capture' | 'Sales' | 'Webinar' | 'Survey' | 'Feedback' | 'Gamified' | 'Holiday' | 'Ecommerce' | 'SaaS';
  desc: string;
  thumbnail: string;
  tags: string[];
  colors: { bg: string; text: string; accent: string };
  fields: Partial<FormDataShape>;
};

export type FormDataShape = {
  siteId: string;
  name: string;
  kind: TemplatePreset['kind'];
  headline?: string;
  subheadline?: string;
  bodyText?: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  borderRadius: number;
  boxShadow?: string;
  ctaText?: string;
  ctaStyle?: 'button' | 'text_link';
  showCloseButton: boolean;
  closeButtonPosition: 'top-right' | 'top-left';
  showDismissText: boolean;
  dismissText?: string;
  overlayEnabled: boolean;
  overlayOpacity: number;
  animation: 'fade' | 'slide_up' | 'slide_down' | 'zoom' | 'none';
  position: 'center' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom';
  size: 'sm' | 'md' | 'lg';
  showPoweredBy: boolean;
  triggerType: TriggerType;
  triggerParams: { pct: number; seconds: number };
  frequency: 'once_per_session' | 'once_per_day' | 'once_per_visitor' | 'always' | 'custom';
  frequencyParams?: { days?: number; sessions?: number; maxTimes?: number; period?: 'ever' | 'month' | 'year' };
  productName: string;
  productUrl: string;
  imageUrl?: string;
  backgroundImage?: string;
  elements?: any[]; // Replaced with any[] to simplify types without importing BuilderElement in frontend types temporarily, though it's better to just import it.
  layoutMode?: 'legacy' | 'blocks';

  // Actions
  afterSubmitAction?: 'thank_you_view' | 'redirect_url' | 'none';
  afterSubmitUrl?: string;
  afterSubmitEffect?: 'confetti' | 'none';
  integrations?: string[];
  webhookUrl?: string;
  whoCanComplete?: 'only_new' | 'anyone_once' | 'anyone_multiple';
  sendFollowUpEmail?: boolean;
  sendNotificationEmail?: boolean;
};
