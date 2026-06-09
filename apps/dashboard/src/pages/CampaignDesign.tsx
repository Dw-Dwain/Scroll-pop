import React from 'react';
import { useOne, useApiUrl, useCustom, useCustomMutation } from '@refinedev/core';

// Upgraded Canvas Designer Components
import TopBar from '../components/campaign-designer/TopBar';
import SidebarLeft from '../components/campaign-designer/SidebarLeft';
import Canvas from '../components/campaign-designer/Canvas';
import SidebarRight from '../components/campaign-designer/SidebarRight';
import InteractivePreview from '../components/campaign-designer/InteractivePreview';

import { Campaign, CampaignElement, CampaignStep, ElementType, CampaignStepConfig, CanvasPosition } from '../components/campaign-designer/types';

interface CampaignDesignProps {
  campaignId: string;
  onNavigate: (path: string) => void;
}

type TriggerRow = { type?: string; params?: Record<string, number> };
type TargetingRow = { kind?: string; value?: Record<string, unknown> };
type FrequencyData = { intervalDays?: number; frequency?: string; maxDisplayCount?: number | null; cooldownSeconds?: number | null; showAgainIfConverts?: boolean };

// Helper to bootstrap Campaign object from legacy flat fields or new steps config
function bootstrapCampaign(
  campaignId: string,
  campaignName: string,
  designData: Record<string, unknown>,
  triggersData: TriggerRow[] = [],
  targetingData: TargetingRow[] = [],
  frequencyData: FrequencyData = {}
): Campaign {
  // Cast config to a loose shape — values are validated later by RLS/Zod on the API;
  // here we only need to read optional legacy flat-config fields safely.
  const config = (designData?.['config'] || {}) as Record<string, unknown> & {
    steps?: { main?: { triggers?: Record<string, unknown> }; teaser?: Record<string, unknown>; success?: Record<string, unknown> };
    schedule?: { startsAt?: string; endsAt?: string };
    uiTriggers?: Record<string, unknown>;
    headline?: string; subheadline?: string; bodyText?: string; textColor?: string;
    accentColor?: string; backgroundColor?: string; borderRadius?: number;
    borderColor?: string; borderWidth?: number; boxShadow?: string;
    position?: string; teaserPosition?: string; animation?: string;
    ctaText?: string; teaserHeadline?: string; successHeadline?: string; successBody?: string;
  };
  
  let exitIntent = true;
  let scrollPercent = 30;
  let inactivitySeconds = 20;
  let timeDelaySeconds = 5;

  if (triggersData.length > 0) {
    exitIntent = false;
    scrollPercent = 0;
    inactivitySeconds = 0;
    timeDelaySeconds = 0;
    triggersData.forEach((t) => {
      if (t.type === 'exit_intent_mouse') exitIntent = true;
      if (t.type === 'scroll_pct') scrollPercent = t.params?.pct || 30;
      if (t.type === 'inactivity') inactivitySeconds = t.params?.seconds || 20;
      if (t.type === 'dwell_time') timeDelaySeconds = t.params?.seconds || 5;
    });
  } else {
    exitIntent = (config.steps?.main?.triggers?.['exitIntent'] as boolean | undefined) ?? true;
    scrollPercent = (config.steps?.main?.triggers?.['scrollPercent'] as number | undefined) ?? 30;
    inactivitySeconds = (config.steps?.main?.triggers?.['inactivitySeconds'] as number | undefined) ?? 20;
    timeDelaySeconds = (config.steps?.main?.triggers?.['timeDelaySeconds'] as number | undefined) ?? 5;
  }

  let deviceTargeting = 'all';
  let newVisitorOnly = false;
  let pageTargeting = '*';
  let geoTargeting = 'All Countries';
  let sessionPageCount = 0;
  let utmParam = 'utm_source';
  let utmValue = '';
  let abTestPercent = 100;
  // Schedule lives in config.schedule (canonical) with a uiTriggers fallback.
  const startsAt: string = config.schedule?.startsAt ?? (config.uiTriggers?.['startsAt'] as string | undefined) ?? '';
  const endsAt: string = config.schedule?.endsAt ?? (config.uiTriggers?.['endsAt'] as string | undefined) ?? '';

  if (targetingData.length > 0) {
    targetingData.forEach((t) => {
      if (t.kind === 'device') deviceTargeting = (t.value?.['device'] as string | undefined) || 'all';
      if (t.kind === 'returning_visitor') newVisitorOnly = t.value?.['returning'] === false;
      if (t.kind === 'url_contains') pageTargeting = (t.value?.['pattern'] as string | undefined) || '*';
      if (t.kind === 'geo') {
        const cs = t.value?.['countries'];
        geoTargeting = Array.isArray(cs) ? cs.join(',') : ((t.value?.['country'] as string | undefined) || 'All Countries');
      }
      if (t.kind === 'session_page_views') sessionPageCount = (t.value?.['count'] as number | undefined) || 0;
      if (t.kind === 'utm') {
        utmParam = (t.value?.['param'] as string | undefined) || 'utm_source';
        utmValue = (t.value?.['value'] as string | undefined) ?? (t.value?.['source'] as string | undefined) ?? ''; // tolerate legacy { source }
      }
      if (t.kind === 'ab_test') abTestPercent = (t.value?.['percent'] as number | undefined) || 100;
    });
  } else {
    deviceTargeting = (config.steps?.main?.triggers?.['deviceTargeting'] as string | undefined) ?? 'all';
    newVisitorOnly = (config.steps?.main?.triggers?.['newVisitorOnly'] as boolean | undefined) ?? false;
    pageTargeting = (config.steps?.main?.triggers?.['pageTargeting'] as string | undefined) ?? '*';
    geoTargeting = (config.steps?.main?.triggers?.['geoTargeting'] as string | undefined) ?? 'All Countries';
    sessionPageCount = (config.steps?.main?.triggers?.['sessionPageCount'] as number | undefined) ?? 0;
    utmParam = (config.steps?.main?.triggers?.['utmParam'] as string | undefined) ?? 'utm_source';
    utmValue = (config.steps?.main?.triggers?.['utmValue'] as string | undefined) ?? (config.steps?.main?.triggers?.['utmSource'] as string | undefined) ?? '';
    abTestPercent = (config.steps?.main?.triggers?.['abTestPercent'] as number | undefined) ?? 100;
  }

  const frequencyCapDays = frequencyData?.intervalDays || (frequencyData?.frequency ? (frequencyData.frequency === 'always' ? 0 : 7) : ((config.steps?.main?.triggers?.['frequencyCapDays'] as number | undefined) ?? 7));

  // Build the canonical sidebar trigger state. Start from the values derived from the
  // normalized triggers/targeting tables, restore the Display Frequency dropdown from the
  // frequency rule, then overlay the full saved UI snapshot (config.uiTriggers) so every
  // sidebar control — including ones the normalized tables don't store (page-targeting
  // rule builder, Smart Product Match) — comes back exactly as the user left it.
  let triggers: Campaign['triggers'] = {
    exitIntent,
    scrollPercent,
    inactivitySeconds,
    timeDelaySeconds,
    pageTargeting,
    deviceTargeting: deviceTargeting as 'all' | 'desktop' | 'mobile' | 'tablet',
    geoTargeting,
    frequencyCapDays,
    newVisitorOnly,
    sessionPageCount,
    utmParam,
    utmValue,
    startsAt,
    endsAt,
    abTestPercent,
    frequency: (frequencyData?.frequency as Campaign['triggers']['frequency']) ?? 'once_per_session',
    maxDisplayCount: frequencyData?.maxDisplayCount ?? 0,
    cooldownMinutes: frequencyData?.cooldownSeconds ? Math.round(frequencyData.cooldownSeconds / 60) : 0,
    showAgainIfConverts: frequencyData?.showAgainIfConverts ?? false,
  };
  if (config.uiTriggers && typeof config.uiTriggers === 'object') {
    triggers = { ...triggers, ...(config.uiTriggers as Partial<Campaign['triggers']>) };
    // The frequency rule table stays authoritative for these two (also written on save).
    if (frequencyData?.frequency) triggers.frequency = frequencyData.frequency as 'always' | 'once_per_session' | 'once_per_day' | 'once_per_visitor';
    if (frequencyData?.intervalDays) triggers.frequencyCapDays = frequencyData.intervalDays;
    // Recurrence: the frequency-rule table is authoritative — re-apply after the uiTriggers merge.
    triggers.maxDisplayCount = frequencyData?.maxDisplayCount ?? 0;
    triggers.cooldownMinutes = frequencyData?.cooldownSeconds ? Math.round(frequencyData.cooldownSeconds / 60) : 0;
    triggers.showAgainIfConverts = frequencyData?.showAgainIfConverts ?? false;
  }

  if (config.steps) {
    return {
      id: campaignId,
      name: campaignName,
      category: 'Countdown Campaigns',
      isActive: true,
      steps: config.steps as unknown as Campaign['steps'],
      triggers,
      conversions: 0,
      views: 0,
      createdAt: new Date().toISOString(),
    };
  }

  // Fallback / legacy flat configuration parsing
  const elements: CampaignElement[] = [
    {
      id: 'close-btn',
      type: 'close',
      x: 92,
      y: 4,
      w: 6,
      h: 6,
      content: '✕',
      color: config.textColor || '#374151',
      fontSize: 14,
      fontWeight: '600',
      align: 'center',
      borderRadius: 99,
      zIndex: 100,
    }
  ];

  if (config.headline) {
    elements.push({
      id: 'main-head',
      type: 'heading',
      x: 10,
      y: 15,
      w: 80,
      h: 15,
      content: config.headline,
      color: config.textColor || '#111827',
      fontSize: 24,
      fontWeight: '800',
      align: 'center',
      zIndex: 2,
    });
  }

  if (config.subheadline || config.bodyText) {
    elements.push({
      id: 'main-desc',
      type: 'text',
      x: 15,
      y: 35,
      w: 70,
      h: 12,
      content: config.subheadline || config.bodyText || '',
      color: config.textColor || '#4B5563',
      fontSize: 12,
      align: 'center',
      zIndex: 2,
    });
  }

  // default input
  elements.push({
    id: 'main-input',
    type: 'input',
    x: 20,
    y: 55,
    w: 60,
    h: 12,
    content: 'VIP@FIELD.COM',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    zIndex: 2,
    extraProps: {
      placeholder: 'Your email address...',
      label: 'Email Address'
    }
  });

  // default button
  elements.push({
    id: 'main-submit',
    type: 'button',
    x: 20,
    y: 75,
    w: 60,
    h: 12,
    content: config.ctaText || 'CLAIM OFFER',
    color: '#FFFFFF',
    backgroundColor: config.accentColor || '#6366f1',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: '700',
    align: 'center',
    zIndex: 3,
  });

  const mainStep: CampaignStepConfig = {
    popupType: ((designData?.['kind'] as string | undefined) || 'modal') as CampaignStepConfig['popupType'],
    position: (config.position || 'center') as CanvasPosition,
    width: 600,
    height: 380,
    backgroundColor: config.backgroundColor || '#FFFFFF',
    borderRadius: config.borderRadius || 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    boxShadow: '0px 25px 80px rgba(0,0,0,0.15)',
    overlayColor: 'rgba(0,0,0,0.5)',
    animationEntrance: config.animation || 'scale-up',
    elements,
  };

  const teaserStep: CampaignStepConfig = {
    popupType: 'floating',
    position: (config.teaserPosition || 'bottom-right') as CanvasPosition,
    width: 140,
    height: 60,
    backgroundColor: '#000000',
    borderRadius: 8,
    borderWidth: 0,
    borderColor: '',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    overlayColor: 'rgba(0,0,0,0)',
    animationEntrance: 'slide-up',
    elements: [
      {
        id: 'teaser-t1',
        type: 'text',
        x: 10,
        y: 25,
        w: 80,
        h: 30,
        content: config.teaserHeadline || '⚡ Special Offer!',
        color: '#FFFFFF',
        fontSize: 10,
        align: 'center',
        zIndex: 1,
      }
    ]
  };

  const successStep: CampaignStepConfig = {
    popupType: 'modal',
    position: 'center',
    width: 600,
    height: 380,
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#374151',
    boxShadow: '0px 25px 80px rgba(0,0,0,0.35)',
    overlayColor: 'rgba(0,0,0,0.5)',
    animationEntrance: 'scale-up',
    elements: [
      {
        id: 'close-btn',
        type: 'close',
        x: 90,
        y: 5,
        w: 24,
        h: 24,
        content: '✕',
        borderRadius: 99,
        zIndex: 100,
      },
      {
        id: 'suc-h1',
        type: 'heading',
        x: 10,
        y: 20,
        w: 80,
        h: 15,
        content: config.successHeadline || 'ACQUISITION SECURED',
        color: '#34D399',
        fontSize: 26,
        fontWeight: '900',
        align: 'center',
        zIndex: 2,
      },
      {
        id: 'suc-text-node',
        type: 'text',
        x: 30,
        y: 45,
        w: 40,
        h: 12,
        content: config.successBody || 'Thank You!',
        color: '#111827',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        fontSize: 22,
        fontWeight: '805',
        align: 'center',
        fontFamily: 'monospace',
        zIndex: 3,
      }
    ]
  };

  return {
    id: campaignId,
    name: campaignName,
    category: 'Countdown Campaigns',
    isActive: true,
    steps: {
      teaser: teaserStep,
      main: mainStep,
      success: successStep,
    },
    triggers,
    conversions: 0,
    views: 0,
    createdAt: new Date().toISOString(),
  };
}

// Helper to map Upgraded steps designer back to database config schema (Backward Compatible)
function mapCampaignToDesign(campaign: Campaign) {
  const mainStep = campaign.steps.main;
  const teaserStep = campaign.steps.teaser;
  const successStep = campaign.steps.success;

  const headingEl = mainStep.elements.find(e => e.type === 'heading');
  const textEl = mainStep.elements.find(e => e.type === 'text');
  const buttonEl = mainStep.elements.find(e => e.type === 'button');

  const teaserTextEl = teaserStep.elements.find(e => e.type === 'text');
  const successHeadingEl = successStep.elements.find(e => e.type === 'heading');
  const successTextEl = successStep.elements.find(e => e.type === 'text');

  // Parse the alpha out of the main step's overlayColor (e.g. "rgba(0,0,0,0.5)" → 0.5).
  // 0 (or a transparent/absent value) means "no backdrop".
  const overlayAlpha = (() => {
    const raw = mainStep.overlayColor || '';
    const m = /rgba?\([^)]*?,\s*([0-9.]+)\s*\)/.exec(raw);
    if (m && m[1] != null) return Math.min(1, Math.max(0, parseFloat(m[1])));
    // A solid color string with no alpha component → treat as fully opaque-ish backdrop.
    return raw && raw !== 'transparent' ? 0.5 : 0;
  })();

  const config = {
    steps: campaign.steps,
    // Full sidebar trigger/targeting snapshot — authoritative source for restoring the
    // editor exactly as the user left it (incl. Display Frequency, page-targeting rules,
    // and Smart Product Match, which the normalized trigger/targeting tables don't capture).
    uiTriggers: campaign.triggers,
    // Campaign schedule — start/end window, evaluated in the visitor's LOCAL time by the
    // snippet. datetime-local strings ("YYYY-MM-DDTHH:mm", no timezone). Empty = unbounded.
    schedule: {
      startsAt: campaign.triggers.startsAt || '',
      endsAt: campaign.triggers.endsAt || '',
    },
    backgroundColor: mainStep.backgroundColor,
    borderRadius: mainStep.borderRadius,
    borderColor: mainStep.borderColor,
    borderWidth: mainStep.borderWidth,
    boxShadow: mainStep.boxShadow,
    position: mainStep.position,
    animation: mainStep.animationEntrance,
    // Backdrop: the designer stores it as steps.main.overlayColor (an rgba string), but the
    // snippet renders the backdrop from the flat overlayEnabled + overlayOpacity fields. Derive
    // those here so designer-built modals actually get their dark overlay (was silently absent).
    overlayEnabled: overlayAlpha > 0,
    overlayOpacity: overlayAlpha,
    elements: mainStep.elements, // Flat array of main elements for browser snippet parsing
    headline: headingEl ? headingEl.content : 'Special Limited Offer',
    subheadline: textEl ? textEl.content : '',
    ctaText: buttonEl ? buttonEl.content : 'Claim Offer',
    accentColor: buttonEl ? buttonEl.backgroundColor : '#6366f1',
    textColor: headingEl ? headingEl.color : '#111111',
    teaserPosition: teaserStep.position,
    teaserHeadline: teaserTextEl ? teaserTextEl.content : '⚡ Special Offer!',
    successHeadline: successHeadingEl ? successHeadingEl.content : 'Thank You!',
    successBody: successTextEl ? successTextEl.content : 'Your discount code has been reserved successfully.',
  };

  return {
    kind: mainStep.popupType || 'modal',
    config,
    affiliateSlots: [],
  };
}

export const CampaignDesign: React.FC<CampaignDesignProps> = ({ campaignId, onNavigate }) => {
  const { data: campaignData, isLoading: isCampaignLoading, isError: _isCampaignError } = useOne({ resource: 'campaigns', id: campaignId });
  const apiUrl = useApiUrl();
  // A/B variant editing: when ?variant=<id> is present this builder edits that variant's design
  // (loaded from / saved to /variants/:id) instead of the campaign's base design. Triggers/
  // targeting/frequency are campaign-level and are not touched in variant mode.
  const variantId = React.useMemo(() => new URLSearchParams(window.location.search).get('variant') || undefined, []);
  const { data: designData, isLoading: isDesignLoading, isError: _isDesignError } = useCustom({
    url: variantId ? `${apiUrl}/variants/${variantId}` : `${apiUrl}/campaigns/${campaignId}/design`,
    method: 'get',
  });
  const { data: triggersData, isLoading: isTriggersLoading } = useCustom({
    url: `${apiUrl}/campaigns/${campaignId}/triggers`,
    method: 'get',
  });
  const { data: targetingData, isLoading: isTargetingLoading } = useCustom({
    url: `${apiUrl}/campaigns/${campaignId}/targeting`,
    method: 'get',
  });
  const { data: frequencyData, isLoading: isFrequencyLoading } = useCustom({
    url: `${apiUrl}/campaigns/${campaignId}/frequency`,
    method: 'get',
  });
  const { mutate, mutateAsync } = useCustomMutation();

  const [campaign, setCampaign] = React.useState<Campaign | null>(null);
  const [activeStep, setActiveStep] = React.useState<CampaignStep>('main');
  const [deviceMode, setDeviceMode] = React.useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>(null);
  const [showStoreSim, setShowStoreSim] = React.useState<boolean>(false);

  // Undo / Redo History States
  const [history, setHistory] = React.useState<CampaignElement[][]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);
  const [_isSaving, setIsSaving] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  // Track whether the API data has been loaded yet. A ref (not state) so changes to it
  // don't trigger re-renders and don't interfere with user edits once loaded.
  const apiLoadedRef = React.useRef(false);

  // Primary load: bootstrap campaign when BOTH API responses settle.
  // We intentionally do NOT guard on `campaign` here — the 1500ms fallback below can fire
  // first (Render cold-start takes 3-10s), set `campaign` with defaults, and then the
  // `if (campaign) return` guard would block the real API data from ever loading.
  // The apiLoadedRef ensures we only load once (so in-progress user edits are never reset).
  React.useEffect(() => {
    if (apiLoadedRef.current) return;
    const bothSettled = !isCampaignLoading && !isDesignLoading && !isTriggersLoading && !isTargetingLoading && !isFrequencyLoading;
    if (!bothSettled) return;

    apiLoadedRef.current = true;
    const camp = bootstrapCampaign(
      campaignId,
      (campaignData?.data as { name?: string } | undefined)?.name || 'New Campaign',
      (designData?.data as Record<string, unknown> | undefined) || {},
      (triggersData?.data as TriggerRow[]) || [],
      (targetingData?.data as TargetingRow[]) || [],
      (frequencyData?.data as FrequencyData) || {}
    );
    setCampaign(camp);
    setHistory([JSON.parse(JSON.stringify(camp.steps.main.elements))]);
    setHistoryIndex(0);
   
  }, [campaignData, designData, triggersData, targetingData, frequencyData, isCampaignLoading, isDesignLoading, isTriggersLoading, isTargetingLoading, isFrequencyLoading, campaignId]);

  // Fallback: if API hasn't responded within 8s, load from sessionStorage cache so the
  // canvas isn't stuck on a blank spinner. The primary effect above will override this
  // with real data when the API finally responds (apiLoadedRef is still false at that point).
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (apiLoadedRef.current) return; // real data already arrived
      let cachedName = 'New Campaign';
      let cachedDesign: Record<string, unknown> = {};
      try {
        const raw = sessionStorage.getItem(`sp_campaign_${campaignId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.name) cachedName = parsed.name;
          if (parsed.config) cachedDesign = { kind: parsed.kind, config: parsed.config };
        }
      } catch {}
      const camp = bootstrapCampaign(campaignId, cachedName, cachedDesign);
      setCampaign(camp);
      setHistory([JSON.parse(JSON.stringify(camp.steps.main.elements))]);
      setHistoryIndex(0);
    }, 8000);
    return () => clearTimeout(timer);
   
  }, [campaignId]);

  const toastMessage = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const pushHistoryState = (elements: CampaignElement[]) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(JSON.parse(JSON.stringify(elements)));
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0 && campaign) {
      const targetIndex = historyIndex - 1;
      const snapshot = history[targetIndex];
      setHistoryIndex(targetIndex);

      const updatedSteps = { ...campaign.steps };
      updatedSteps[activeStep] = {
        ...updatedSteps[activeStep],
        elements: JSON.parse(JSON.stringify(snapshot))
      };
      setCampaign({ ...campaign, steps: updatedSteps });
      toastMessage('⏪ Design Action Undo Success');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1 && campaign) {
      const targetIndex = historyIndex + 1;
      const snapshot = history[targetIndex];
      setHistoryIndex(targetIndex);

      const updatedSteps = { ...campaign.steps };
      updatedSteps[activeStep] = {
        ...updatedSteps[activeStep],
        elements: JSON.parse(JSON.stringify(snapshot))
      };
      setCampaign({ ...campaign, steps: updatedSteps });
      toastMessage('⏩ Design Action Redo Success');
    }
  };

  const handleUpdateStepConfig = (keyOrObj: string | Record<string, unknown>, value?: unknown) => {
    if (!campaign) return;

    setCampaign((prev) => {
      if (!prev) return prev;
      const updatedSteps = { ...prev.steps };
      let newStepConfig = { ...updatedSteps[activeStep] } as Record<string, unknown>;

      if (typeof keyOrObj === 'string') {
        newStepConfig[keyOrObj] = value;
      } else {
        newStepConfig = { ...newStepConfig, ...keyOrObj };
      }

      updatedSteps[activeStep] = newStepConfig as unknown as CampaignStepConfig;
      return { ...prev, steps: updatedSteps };
    });

    if (typeof keyOrObj === 'string') {
      if (keyOrObj === 'elements') pushHistoryState(value as CampaignElement[]);
    } else if ('elements' in keyOrObj) {
      pushHistoryState(keyOrObj.elements as CampaignElement[]);
    }
  };

  const handleUpdateTriggers = (key: string, value: unknown) => {
    // Functional update — reading `campaign` from the closure would clobber rapid
    // successive trigger changes (each handler would start from the same stale state,
    // so only the last write survived). This keeps every sidebar change.
    setCampaign((prev) => (prev ? { ...prev, triggers: { ...prev.triggers, [key]: value } } : prev));
  };

  const handleAddElement = (type: ElementType) => {
    if (!campaign) return;
    const stepConfig = campaign.steps[activeStep];
    const elementsList = stepConfig.elements;
    const maxZ = elementsList.reduce((max, el) => Math.max(max, el.zIndex), 0);

    const baseNewElem: CampaignElement = {
      id: `${type}-${Date.now()}`,
      type,
      x: 30,
      y: 35,
      w: 40,
      h: 12,
      zIndex: maxZ + 1,
      content: '',
    };

    switch (type) {
      case 'heading':
        baseNewElem.w = 50;
        baseNewElem.h = 14;
        baseNewElem.content = 'Exclusive Discount!';
        baseNewElem.color = '#111827';
        baseNewElem.fontSize = 24;
        baseNewElem.fontWeight = 'bold';
        baseNewElem.fontFamily = 'sans-serif';
        baseNewElem.align = 'center';
        break;
      case 'text':
        baseNewElem.w = 55;
        baseNewElem.h = 16;
        baseNewElem.content = 'Unlock premium affiliate vouchers today by entering your details below.';
        baseNewElem.color = '#4B5563';
        baseNewElem.fontSize = 12;
        baseNewElem.fontFamily = 'sans-serif';
        baseNewElem.align = 'center';
        break;
      case 'button':
        baseNewElem.w = 40;
        baseNewElem.h = 10;
        baseNewElem.content = 'CLAIM NOW';
        baseNewElem.color = '#FFFFFF';
        baseNewElem.backgroundColor = '#EC4899';
        baseNewElem.borderRadius = 8;
        baseNewElem.fontSize = 11;
        baseNewElem.fontFamily = 'sans-serif';
        break;
      case 'input':
        baseNewElem.w = 45;
        baseNewElem.h = 11;
        baseNewElem.content = 'shopper@email.com';
        baseNewElem.backgroundColor = '#FFFFFF';
        baseNewElem.borderWidth = 1;
        baseNewElem.borderColor = '#E5E7EB';
        baseNewElem.borderRadius = 8;
        baseNewElem.extraProps = {
          placeholder: 'Your email address...',
          label: 'Email Address'
        };
        break;
      case 'consent':
        // Marketing-consent checkbox. Required by default; submit is blocked until ticked.
        baseNewElem.w = 70;
        baseNewElem.h = 8;
        baseNewElem.content = 'I agree to receive marketing emails.';
        baseNewElem.color = '#6B7280';
        baseNewElem.fontSize = 11;
        baseNewElem.align = 'left';
        baseNewElem.extraProps = { required: true };
        break;
      case 'countdown': {
        // content = ISO datetime 30 minutes from now (the snippet counts down to this target).
        // The operator edits content in the right-panel to set a different target date/time.
        const thirtyMin = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        baseNewElem.w = 50;
        baseNewElem.h = 14;
        baseNewElem.content = thirtyMin;
        baseNewElem.color = '#B91C1C';
        baseNewElem.fontSize = 32;
        baseNewElem.fontWeight = '700';
        break;
      }
      case 'image':
        baseNewElem.w = 40;
        baseNewElem.h = 40;
        baseNewElem.content = 'https://images.unsplash.com/photo-1542435503-956c469947f6?auto=format&fit=crop&w=450&q=80';
        baseNewElem.borderRadius = 12;
        break;
    }

    const updated = [...elementsList, baseNewElem];
    handleUpdateStepConfig('elements', updated);
    setSelectedElementId(baseNewElem.id);
    toastMessage(`➕ Added visual ${type} block`);
  };

  const handleUpdateElement = (id: string, keyOrObj: string | Record<string, unknown>, value?: unknown) => {
    if (!campaign) return;
    const stepConfig = campaign.steps[activeStep];
    const updated = stepConfig.elements.map(item => {
      if (item.id === id) {
        if (typeof keyOrObj === 'object') {
          return { ...item, ...keyOrObj };
        } else {
          return { ...item, [keyOrObj]: value };
        }
      }
      return item;
    });
    handleUpdateStepConfig('elements', updated);
  };

  const handleRemoveElement = (id: string) => {
    if (!campaign || id === 'close-btn') return;
    const filtered = campaign.steps[activeStep].elements.filter(item => item.id !== id);
    handleUpdateStepConfig('elements', filtered);
    if (selectedElementId === id) setSelectedElementId(null);
    toastMessage('🗑 Layer element deleted');
  };

  const handleReorderElement = (id: string, action: 'up' | 'down') => {
    if (!campaign) return;
    const stepConfig = campaign.steps[activeStep];
    const updated = stepConfig.elements.map(el => {
      if (el.id === id) {
        return { ...el, zIndex: action === 'up' ? el.zIndex + 1 : Math.max(1, el.zIndex - 1) };
      }
      return el;
    });
    handleUpdateStepConfig('elements', updated);
  };

  const handleSave = () => {
    if (!campaign) return;
    setIsSaving(true);
    const designPayload = mapCampaignToDesign(campaign);
    // Preserve existing affiliate slots — mapCampaignToDesign always returns [] because
    // affiliate slots live on the design record, not on the Campaign canvas object.
    designPayload.affiliateSlots = ((designData?.data as { affiliateSlots?: unknown[] } | undefined)?.affiliateSlots ?? []) as typeof designPayload.affiliateSlots;

    // A/B variant mode: save only the design to the variant; triggers/targeting/frequency are
    // campaign-level and shared across variants, so they're left untouched here.
    if (variantId) {
      mutate(
        { url: `${apiUrl}/variants/${variantId}`, method: 'put', values: { config: designPayload.config, affiliateSlots: designPayload.affiliateSlots } },
        {
          onSuccess: () => {
            setIsSaving(false);
            toastMessage('💾 Variant saved!');
            setTimeout(() => onNavigate(`/campaigns/detail/${campaignId}`), 700);
          },
          onError: () => {
            setIsSaving(false);
            toastMessage('❌ Error: Failed to save variant.');
          },
        }
      );
      return;
    }

    const t = campaign.triggers;
    const triggersList: Array<{ type: string; params: Record<string, number> }> = [];
    if (t) {
      if (t.scrollPercent > 0) triggersList.push({ type: 'scroll_pct', params: { pct: t.scrollPercent } });
      if (t.timeDelaySeconds > 0) triggersList.push({ type: 'dwell_time', params: { seconds: t.timeDelaySeconds } });
      if (t.inactivitySeconds > 0) triggersList.push({ type: 'inactivity', params: { seconds: Math.max(5, t.inactivitySeconds) } });
      if (t.exitIntent) triggersList.push({ type: 'exit_intent_mouse', params: { sensitivity: 20 } });
    }
    const targetingList: Array<{ kind: string; operator: string; value: Record<string, unknown> }> = [];
    if (t) {
      if (t.deviceTargeting && t.deviceTargeting !== 'all') targetingList.push({ kind: 'device', operator: 'include', value: { device: t.deviceTargeting } });
      if (t.newVisitorOnly) targetingList.push({ kind: 'returning_visitor', operator: 'include', value: { returning: false } });
      // Page targeting: the advanced multi-rule builder (pageTargetingRules) supersedes the
      // single legacy `pageTargeting` field. Map each rule to a real targeting row so the
      // snippet actually enforces them (previously they were only stored in config.uiTriggers
      // and never written here, so they had no runtime effect).
      const pageRules = t.pageTargetingRules ?? [];
      if (pageRules.length > 0) {
        pageRules.forEach((r) => {
          const v = (r.value ?? '').trim();
          if (!v) return;
          const kind = r.matchType === 'exact' ? 'url_exact' : r.matchType === 'regex' ? 'url_regex' : 'url_contains';
          const value = kind === 'url_exact' ? { url: v } : { pattern: v };
          targetingList.push({ kind, operator: r.operator === 'exclude' ? 'exclude' : 'include', value });
        });
      } else if (t.pageTargeting && t.pageTargeting.trim() && t.pageTargeting.trim() !== '*') {
        targetingList.push({ kind: 'url_contains', operator: 'include', value: { pattern: t.pageTargeting.trim() } });
      }
      if (t.geoTargeting && t.geoTargeting !== 'All Countries') {
        // geoTargeting is a CSV of ISO codes (e.g. "US,JP"). One country → legacy {country};
        // multiple → {countries:[...]} (the snippet's geo check supports both).
        const countries = t.geoTargeting.split(',').map((s) => s.trim()).filter(Boolean);
        if (countries.length === 1) targetingList.push({ kind: 'geo', operator: 'include', value: { country: countries[0] as string } });
        else if (countries.length > 1) targetingList.push({ kind: 'geo', operator: 'include', value: { countries } });
      }
      if (t.sessionPageCount > 0) targetingList.push({ kind: 'session_page_views', operator: 'include', value: { count: t.sessionPageCount } });
      if (t.utmValue && t.utmValue.trim() !== '') targetingList.push({ kind: 'utm', operator: 'include', value: { param: t.utmParam || 'utm_source', value: t.utmValue.trim() } });
      // Real A/B is now handled by the variants system (see the A/B Test panel on Campaign
      // Detail). The old single-percentage ab_test gate has been removed (P0-4).
    }

    // Persist the Display Frequency dropdown exactly as chosen (was previously derived from
    // frequencyCapDays, so the dropdown selection was silently lost on save).
    const freqMode = t?.frequency ?? 'once_per_session';
    const freqInterval = t?.frequencyCapDays && t.frequencyCapDays > 0 ? t.frequencyCapDays : undefined;
    // Recurrence (optional). Convert the UI's minutes to the seconds the API stores.
    const maxDisplayCount = t?.maxDisplayCount && t.maxDisplayCount > 0 ? t.maxDisplayCount : null;
    const cooldownSeconds = t?.cooldownMinutes && t.cooldownMinutes > 0 ? t.cooldownMinutes * 60 : null;
    const showAgainIfConverts = !!t?.showAgainIfConverts;

    // Save design
    mutate(
      { url: `${apiUrl}/campaigns/${campaignId}/design`, method: 'put', values: designPayload },
      {
        onSuccess: async () => {
          // After design succeeds, save triggers
          try {
            await mutateAsync({ url: `${apiUrl}/campaigns/${campaignId}/triggers`, method: 'put', values: triggersList });
            await mutateAsync({ url: `${apiUrl}/campaigns/${campaignId}/frequency`, method: 'put', values: { frequency: freqMode, intervalDays: freqInterval, maxDisplayCount, cooldownSeconds, showAgainIfConverts } });
            await mutateAsync({ url: `${apiUrl}/campaigns/${campaignId}/targeting`, method: 'put', values: targetingList });
          } catch (err) {
            console.error('Failed to save triggers/targeting:', err);
          }
          setIsSaving(false);
          toastMessage('💾 Campaign Published & Live Successfully!');
          // Return to the campaigns list after a brief moment so the toast is seen.
          setTimeout(() => onNavigate('/campaigns'), 700);
        },
        onError: () => {
          setIsSaving(false);
          toastMessage('❌ Error: Failed to save changes.');
        },
      }
    );
  };

  // Show spinner only while in-flight; once both have settled, campaign will be populated
  if ((isCampaignLoading || isDesignLoading) && !campaign) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360, color: 'var(--text-muted)', fontSize: 13 }}>
        Loading advanced canvas designer…
      </div>
    );
  }

  // Safety: should never reach here after fix, but keeps TypeScript happy
  if (!campaign) return null;

  return (
    <div className="flex flex-col overflow-hidden select-none" style={{
      position: 'fixed',
      top: 'var(--topnav-height, 48px)',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 90,
      background: 'var(--bg-surface)',
    }}>
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 left-6 px-3 py-2 bg-zinc-900 border border-zinc-800 text-white font-semibold font-mono text-[9px] uppercase tracking-wider rounded shadow-md z-[1000] flex items-center gap-1.5 animate-slide-up">
          <div className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header & Controls bar */}
      <TopBar
        campaign={campaign}
        activeStep={activeStep}
        deviceMode={deviceMode}
        onStepChange={(step) => {
          setActiveStep(step);
          setSelectedElementId(null);
          setHistory([JSON.parse(JSON.stringify(campaign.steps[step as CampaignStep].elements))]);
          setHistoryIndex(0);
        }}
        onDeviceModeChange={setDeviceMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSave}
        onLaunchSim={() => setShowStoreSim(true)}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onBack={() => onNavigate('/campaigns')}
      />

      {/* Main Designer Workspace Grid Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbox Drawer */}
        <SidebarLeft
          campaign={campaign}
          activeStep={activeStep}
          onUpdateStepConfig={handleUpdateStepConfig}
          onUpdateTriggers={handleUpdateTriggers}
          onSelectTemplate={(tpl) => {
            // Load the FULL saved design (all steps: teaser/main/success), not just the active step.
            setCampaign((prev) => (prev ? { ...prev, steps: JSON.parse(JSON.stringify(tpl.steps)) } : prev));
            setSelectedElementId(null);
            const mainEls = JSON.parse(JSON.stringify(tpl.steps.main?.elements ?? []));
            setHistory([mainEls]);
            setHistoryIndex(0);
            toastMessage(`🎨 Template design loaded`);
          }}
          onAddElement={handleAddElement}
          onRemoveElement={handleRemoveElement}
          onReorderElement={handleReorderElement}
          selectedElementId={selectedElementId}
          onSelectElement={setSelectedElementId}
          onUpdateElement={handleUpdateElement}
        />

        {/* Center Interactive Canvas */}
        <Canvas
          stepConfig={campaign.steps[activeStep]}
          selectedElementId={selectedElementId}
          deviceMode={deviceMode}
          onSelectElement={setSelectedElementId}
          onUpdateElement={handleUpdateElement}
          onUpdateStepConfig={handleUpdateStepConfig}
        />

        {/* Right Properties Inspector */}
        <SidebarRight
          stepConfig={campaign.steps[activeStep]}
          selectedElementId={selectedElementId}
          activeStep={activeStep}
          onUpdateStepConfig={handleUpdateStepConfig}
          onUpdateElement={handleUpdateElement}
          onDeleteElement={handleRemoveElement}
        />
      </div>

      {/* Simulated Live Storefront Sandbox Modal Overlay */}
      {showStoreSim && (
        <InteractivePreview
          campaign={campaign}
          onClose={() => setShowStoreSim(false)}
          onRecordConversion={() => {
            toastMessage('📈 Conversion Recorded in Sandbox Mode!');
          }}
        />
      )}
    </div>
  );
};
