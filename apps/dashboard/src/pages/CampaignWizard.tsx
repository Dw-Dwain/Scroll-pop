import React from 'react';
import { ChevronLeft, ChevronRight, Check, Megaphone, Layers, Wand2, Sparkles, Laptop, Tablet, Smartphone, Undo2, Redo2, Play } from 'lucide-react';
import { useCreate, useList } from '@refinedev/core';
import { TemplateSelector } from '../components/campaign-wizard/TemplateSelector';
import { DesignControls } from '../components/campaign-wizard/DesignControls';
import { TemplatePreset, FormDataShape } from '../types/campaign';
import { MASSIVE_TEMPLATES, OSS_TEMPLATES } from '../lib/templates';

// Advanced Canvas Designer Component Imports
import { Campaign, CampaignElement, CampaignStep, ElementType, CampaignStepConfig } from '../components/campaign-designer/types';
import { PREBUILT_TEMPLATES } from '../components/campaign-designer/data/templates';
import SidebarLeftDesigner from '../components/campaign-designer/SidebarLeft';
import CanvasDesigner from '../components/campaign-designer/Canvas';
import SidebarRightDesigner from '../components/campaign-designer/SidebarRight';
import InteractivePreviewDesigner from '../components/campaign-designer/InteractivePreview';

// Merge OSS-inspired templates at the front so they appear first in the marketplace
const ALL_TEMPLATES = [...OSS_TEMPLATES, ...MASSIVE_TEMPLATES];

interface CampaignWizardProps {
  onNavigate: (path: string) => void;
}


const STEPS = [
  { id: 1, label: 'Details',   icon: Megaphone },
  { id: 2, label: 'Design',    icon: Wand2 },
  { id: 3, label: 'Launch',    icon: Sparkles },
] as const;

// Helper to bootstrap Campaign object from legacy flat fields or new steps config
function bootstrapCampaign(campaignId: string, campaignName: string, designData: any): Campaign {
  const config = designData?.config || {};
  
  const prefs = (() => {
    try {
      return JSON.parse(localStorage.getItem('_sp_prefs') ?? '{}');
    } catch {
      return {};
    }
  })();
  const defaultTrigger = prefs.defaultTrigger ?? 'scroll_pct';
  const defaultScrollPercent = prefs.defaultScrollPct ?? 30;
  const defaultFreqCap = prefs.defaultFreqCap ?? 7;

  if (config.steps) {
    return {
      id: campaignId,
      name: campaignName,
      category: 'Countdown Campaigns',
      isActive: true,
      steps: config.steps,
      triggers: {
        exitIntent: config.steps.main?.triggers?.exitIntent ?? (defaultTrigger === 'exit_intent'),
        scrollPercent: config.steps.main?.triggers?.scrollPercent ?? (defaultTrigger === 'scroll_pct' ? defaultScrollPercent : 0),
        inactivitySeconds: config.steps.main?.triggers?.inactivitySeconds ?? (defaultTrigger === 'inactivity' ? 20 : 0),
        timeDelaySeconds: config.steps.main?.triggers?.timeDelaySeconds ?? (defaultTrigger === 'time_delay' || defaultTrigger === 'dwell_time' ? 5 : 0),
        pageTargeting: config.steps.main?.triggers?.pageTargeting ?? '*',
        deviceTargeting: config.steps.main?.triggers?.deviceTargeting ?? 'all',
        geoTargeting: config.steps.main?.triggers?.geoTargeting ?? 'All Countries',
        frequencyCapDays: config.steps.main?.triggers?.frequencyCapDays ?? defaultFreqCap,
        newVisitorOnly: config.steps.main?.triggers?.newVisitorOnly ?? false,
        sessionPageCount: config.steps.main?.triggers?.sessionPageCount ?? 0,
        utmSource: config.steps.main?.triggers?.utmSource ?? '',
        abTestPercent: config.steps.main?.triggers?.abTestPercent ?? 100,
      },
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
    popupType: (designData?.kind as any) || 'modal',
    position: config.position || 'center',
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
    position: config.teaserPosition || 'bottom-right',
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
    triggers: {
      exitIntent: defaultTrigger === 'exit_intent',
      scrollPercent: defaultTrigger === 'scroll_pct' ? defaultScrollPercent : 0,
      inactivitySeconds: defaultTrigger === 'inactivity' ? 20 : 0,
      timeDelaySeconds: defaultTrigger === 'time_delay' || defaultTrigger === 'dwell_time' ? 5 : 0,
      pageTargeting: '*',
      deviceTargeting: 'all' as const,
      geoTargeting: 'All Countries',
      frequencyCapDays: defaultFreqCap,
      newVisitorOnly: false,
      sessionPageCount: 0,
      utmSource: '',
      abTestPercent: 100,
    },
    conversions: 0,
    views: 0,
    createdAt: new Date().toISOString(),
  };
}

export const CampaignWizard: React.FC<CampaignWizardProps> = ({ onNavigate }) => {
  const { data: sitesData } = useList({ resource: 'sites' });
  const { mutateAsync: createCampaign } = useCreate();
  const { mutateAsync: createDesign } = useCreate();
  const { mutateAsync: createTrigger } = useCreate();
  const { mutateAsync: createTargeting } = useCreate();
  const { mutateAsync: createFrequency } = useCreate();
  const { mutateAsync: activateCampaign } = useCreate();

  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [favorites, setFavorites] = React.useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('campaign_template_favorites') ?? '[]'); } catch { return []; }
  });
  const [customTemplates, setCustomTemplates] = React.useState<TemplatePreset[]>([]);
  const [activeKind, setActiveKind] = React.useState<TemplatePreset['kind'] | 'all'>('all');

  // Advanced Visual Designer state variables
  const [campaign, setCampaign] = React.useState<Campaign | null>(null);
  const [activeStep, setActiveStep] = React.useState<CampaignStep>('main');
  const [deviceMode, setDeviceMode] = React.useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>(null);
  const [showStoreSim, setShowStoreSim] = React.useState<boolean>(false);
  const [history, setHistory] = React.useState<CampaignElement[][]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);
  const [toast, setToast] = React.useState<string | null>(null);

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

  const handleUpdateStepConfig = (keyOrObj: string | Record<string, any>, value?: any) => {
    if (!campaign) return;

    setCampaign((prev) => {
      if (!prev) return prev;
      const updatedSteps = { ...prev.steps };
      let newStepConfig = { ...updatedSteps[activeStep] } as any;

      if (typeof keyOrObj === 'string') {
        newStepConfig[keyOrObj as any] = value;
      } else {
        newStepConfig = { ...newStepConfig, ...keyOrObj };
      }

      updatedSteps[activeStep] = newStepConfig;
      return { ...prev, steps: updatedSteps };
    });

    if (typeof keyOrObj === 'string') {
      if (keyOrObj === 'elements') pushHistoryState(value);
    } else if ('elements' in keyOrObj) {
      pushHistoryState(keyOrObj.elements);
    }
  };

  const handleUpdateTriggers = (key: string, value: any) => {
    if (!campaign) return;
    const updatedTriggers = { ...campaign.triggers, [key]: value };
    setCampaign({ ...campaign, triggers: updatedTriggers });
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
      case 'countdown':
        baseNewElem.w = 40;
        baseNewElem.h = 15;
        baseNewElem.content = '599';
        baseNewElem.extraProps = { targetSeconds: 599 };
        break;
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

  const handleUpdateElement = (id: string, keyOrObj: string | Record<string, any>, value?: any) => {
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

  const [formData, setFormData] = React.useState<FormDataShape>(() => {
    let globalAffiliate = 'https://affiliate.link';
    try {
      const stored = localStorage.getItem('_sp_settings');
      if (stored) globalAffiliate = JSON.parse(stored).affiliateLink || globalAffiliate;
    } catch {}
    return {
      siteId: '', name: '', kind: 'modal',
      headline: 'Special Limited Offer', subheadline: 'Get 50% off our premium affiliate deal today.',
      bodyText: 'Unlock access to top-rated products with limited pricing.',
      backgroundColor: '#ffffff', textColor: '#111111', accentColor: '#6366f1', borderRadius: 12,
      padding: '24px', gap: '12px', margin: '0px', boxShadow: 'soft',
      teaserHeadline: '⚡ Special Offer!', teaserPosition: 'bottom-right',
      successHeadline: 'Thank You!', successBody: 'Your discount code has been reserved successfully.',
      ctaText: 'Claim Offer', ctaStyle: 'button',
      showCloseButton: true, closeButtonPosition: 'top-right', showDismissText: false, dismissText: 'No thanks',
      overlayEnabled: true, overlayOpacity: 0.5, animation: 'slide_up', position: 'center', size: 'md', showPoweredBy: true,
      triggerType: 'scroll_pct', triggerParams: { pct: 45, seconds: 20 }, frequency: 'once_per_session',
      productName: 'Premium Membership', productUrl: globalAffiliate,
      imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    };
  });

  React.useEffect(() => { localStorage.setItem('campaign_template_favorites', JSON.stringify(favorites)); }, [favorites]);

  const toastMessage = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const applyTemplate = (t: TemplatePreset) => {
    setFormData((prev) => ({ ...prev, kind: t.kind, backgroundColor: t.colors.bg, textColor: t.colors.text, accentColor: t.colors.accent, ...t.fields }));
    
    // Find prebuilt high-fidelity template matching this id
    const found = PREBUILT_TEMPLATES.find(p => p.id === t.id);
    let camp: Campaign;
    if (found) {
      camp = JSON.parse(JSON.stringify(found));
      camp.name = formData.name || t.name;
    } else {
      camp = bootstrapCampaign(
        `campaign-${Date.now()}`,
        formData.name || t.name,
        {
          kind: t.kind,
          config: {
            headline: t.fields.headline || 'Special Limited Offer',
            subheadline: t.fields.subheadline || 'Get exclusive access.',
            backgroundColor: t.colors.bg || '#ffffff',
            textColor: t.colors.text || '#111111',
            accentColor: t.colors.accent || '#6366f1',
            borderRadius: t.fields.borderRadius || 12,
            ctaText: t.fields.ctaText || 'Claim Offer',
            teaserHeadline: t.fields.teaserHeadline || '⚡ Special Offer!',
            teaserPosition: t.fields.teaserPosition || 'bottom-right',
            successHeadline: t.fields.successHeadline || 'Thank You!',
            successBody: t.fields.successBody || 'Voucher code reserved.',
          }
        }
      );
    }
    setCampaign(camp);
    setHistory([JSON.parse(JSON.stringify(camp.steps.main.elements))]);
    setHistoryIndex(0);
    setActiveStep('main');
    setStep(2);
  };

  React.useEffect(() => {
    if (step === 2 && !campaign) {
      const camp = bootstrapCampaign(
        `campaign-${Date.now()}`,
        formData.name || 'Custom Campaign',
        {
          kind: formData.kind,
          config: {
            headline: formData.headline || 'Special Limited Offer',
            subheadline: formData.subheadline || 'Get 50% off.',
            backgroundColor: formData.backgroundColor || '#ffffff',
            textColor: formData.textColor || '#111111',
            accentColor: formData.accentColor || '#6366f1',
            borderRadius: formData.borderRadius || 12,
            ctaText: formData.ctaText || 'Claim Offer',
            teaserHeadline: formData.teaserHeadline || '⚡ Special Offer!',
            teaserPosition: formData.teaserPosition || 'bottom-right',
            successHeadline: formData.successHeadline || 'Thank You!',
            successBody: formData.successBody || 'Your discount code has been reserved.',
          }
        }
      );
      setCampaign(camp);
      setHistory([JSON.parse(JSON.stringify(camp.steps.main.elements))]);
      setHistoryIndex(0);
      setActiveStep('main');
    }
  }, [step, campaign, formData]);

  const cloneTemplate = (template: TemplatePreset) =>
    setCustomTemplates((prev) => [{ ...template, id: `custom-${crypto.randomUUID()}`, name: `${template.name} Copy`, tags: [...template.tags, 'custom'] }, ...prev]);

  // Build trigger/frequency/targeting specs from step 2's campaign.triggers,
  // falling back to formData defaults when there is no campaign object.
  const buildRuleSpecs = () => {
    const t = campaign?.triggers;
    const triggers: Array<{ type: string; params: Record<string, number> }> = [];
    if (t) {
      if (t.scrollPercent > 0) triggers.push({ type: 'scroll_pct', params: { pct: t.scrollPercent } });
      if (t.timeDelaySeconds > 0) triggers.push({ type: 'dwell_time', params: { seconds: t.timeDelaySeconds } });
      if (t.inactivitySeconds > 0) triggers.push({ type: 'inactivity', params: { seconds: Math.max(5, t.inactivitySeconds) } });
      if (t.exitIntent) triggers.push({ type: 'exit_intent_mouse', params: { sensitivity: 20 } });
    }
    if (triggers.length === 0) {
      triggers.push({
        type: formData.triggerType,
        params: formData.triggerType === 'scroll_pct' ? { pct: formData.triggerParams.pct } : { seconds: formData.triggerParams.seconds },
      });
    }
    const frequency = t?.frequency ?? formData.frequency ?? 'once_per_session';
    const targeting: Array<{ kind: string; operator: string; value: Record<string, unknown> }> = [];
    if (t) {
      if (t.deviceTargeting && t.deviceTargeting !== 'all') targeting.push({ kind: 'device', operator: 'include', value: { device: t.deviceTargeting } });
      if (t.newVisitorOnly) targeting.push({ kind: 'returning_visitor', operator: 'include', value: { returning: false } });
      if (t.pageTargeting && t.pageTargeting.trim() && t.pageTargeting.trim() !== '*') targeting.push({ kind: 'url_contains', operator: 'include', value: { pattern: t.pageTargeting.trim() } });
    }
    return { triggers, frequency, targeting };
  };

  const handleLaunch = async () => {
    if (!formData.siteId || !formData.name) { alert('Campaign name and site are required.'); return; }
    setLoading(true);
    try {
      const campaignRes: any = await createCampaign({ resource: 'campaigns', values: { siteId: formData.siteId, name: formData.name } });
      const campaignId = campaignRes.data.id;

      let designConfig: any;
      let designKind: any = formData.kind;

      if (campaign) {
          const mainStep = campaign.steps.main;
          const teaserStep = campaign.steps.teaser;
          const successStep = campaign.steps.success;

          const headingEl = mainStep.elements.find(e => e.type === 'heading');
          const textEl = mainStep.elements.find(e => e.type === 'text');
          const buttonEl = mainStep.elements.find(e => e.type === 'button');

          const teaserTextEl = teaserStep.elements.find(e => e.type === 'text');
          const successHeadingEl = successStep.elements.find(e => e.type === 'heading');
          const successTextEl = successStep.elements.find(e => e.type === 'text');

          designKind = (mainStep.popupType as any) || 'modal';
          designConfig = {
            steps: campaign.steps,
            backgroundColor: mainStep.backgroundColor,
            borderRadius: mainStep.borderRadius,
            borderColor: mainStep.borderColor,
            borderWidth: mainStep.borderWidth,
            boxShadow: mainStep.boxShadow,
            position: mainStep.position,
            animation: mainStep.animationEntrance,
            elements: mainStep.elements, // Flat array for edge/legacy snippet parsing
            headline: headingEl ? headingEl.content : 'Special Limited Offer',
            subheadline: textEl ? textEl.content : '',
            ctaText: buttonEl ? buttonEl.content : 'Claim Offer',
            accentColor: buttonEl ? buttonEl.backgroundColor : '#6366f1',
            textColor: headingEl ? headingEl.color : '#111111',
            teaserPosition: teaserStep.position,
            teaserHeadline: teaserTextEl ? teaserTextEl.content : '⚡ Special Offer!',
            successHeadline: successHeadingEl ? successHeadingEl.content : 'Thank You!',
            successBody: successTextEl ? successTextEl.content : 'Your discount code has been reserved successfully.',
            
            // Other settings
            showPoweredBy: formData.showPoweredBy,
            afterSubmitAction: formData.afterSubmitAction,
            afterSubmitUrl: formData.afterSubmitUrl,
            afterSubmitEffect: formData.afterSubmitEffect,
            integrations: formData.integrations,
            webhookUrl: formData.webhookUrl,
            whoCanComplete: formData.whoCanComplete,
            sendFollowUpEmail: formData.sendFollowUpEmail,
            sendNotificationEmail: formData.sendNotificationEmail,
          };
        } else {
          designConfig = {
            kind: formData.kind, position: formData.position, size: formData.size,
            backgroundColor: formData.backgroundColor, textColor: formData.textColor, accentColor: formData.accentColor,
            borderRadius: formData.borderRadius, headline: formData.headline || 'Headline',
            subheadline: formData.subheadline || undefined, bodyText: formData.bodyText || undefined,
            ctaText: formData.ctaText || 'Click Here', ctaStyle: formData.ctaStyle,
            showCloseButton: formData.showCloseButton, closeButtonPosition: formData.closeButtonPosition,
            showDismissText: formData.showDismissText, dismissText: formData.dismissText || undefined,
            overlayEnabled: formData.overlayEnabled, overlayOpacity: formData.overlayOpacity,
            animation: formData.animation, showPoweredBy: formData.showPoweredBy,
            backgroundImage: formData.backgroundImage || formData.imageUrl || undefined,
            elements: formData.elements, layoutMode: formData.layoutMode,
            boxShadow: formData.boxShadow, afterSubmitAction: formData.afterSubmitAction,
            afterSubmitUrl: formData.afterSubmitUrl, afterSubmitEffect: formData.afterSubmitEffect,
            integrations: formData.integrations, webhookUrl: formData.webhookUrl,
            whoCanComplete: formData.whoCanComplete, sendFollowUpEmail: formData.sendFollowUpEmail,
            sendNotificationEmail: formData.sendNotificationEmail,
            padding: formData.padding, gap: formData.gap, margin: formData.margin,
            teaserHeadline: formData.teaserHeadline, teaserPosition: formData.teaserPosition,
            successHeadline: formData.successHeadline, successBody: formData.successBody,
          };
        }

        const affiliateSlots = formData.productUrl ? [{
          id: crypto.randomUUID(), product_name: formData.productName || 'Product',
          product_url: formData.productUrl || 'https://example.com',
          image_url: formData.imageUrl || 'https://example.com/image.jpg',
          click_tracker_url: formData.productUrl || 'https://example.com',
          cta_text: formData.ctaText || 'Click Here', weight: 100,
        }] : [];

      await createDesign({ resource: `campaigns/${campaignId}/design`, values: { kind: designKind, config: designConfig, affiliate_slots: affiliateSlots } });

      // Triggers, frequency and targeting now come from step 2's Triggers tab.
      const { triggers, frequency, targeting } = buildRuleSpecs();
      for (const spec of triggers) {
        await createTrigger({ resource: `campaigns/${campaignId}/triggers`, values: spec });
      }
      await createFrequency({ resource: `campaigns/${campaignId}/frequency`, values: { frequency } });
      for (const spec of targeting) {
        await createTargeting({ resource: `campaigns/${campaignId}/targeting`, values: spec });
      }

      // Launch = go live. Activate so the campaign is served by the edge (was left as draft).
      await activateCampaign({ resource: `campaigns/${campaignId}/activate`, values: {} });

      setLoading(false);
      onNavigate('/campaigns');
    } catch (err) {
      console.error('Launch failed', err);
      setLoading(false);
      alert('Failed to launch campaign. Please try again.');
    }
  };

  // Single-column wizard (Details / Design / Launch) — no side preview panel
  const isTwoCol = false;

  // Launch-summary helpers derived from step 2's Triggers tab
  const primaryTriggerLabel = (() => {
    const t = campaign?.triggers;
    if (t) {
      if (t.scrollPercent > 0) return `scroll ${t.scrollPercent}%`;
      if (t.timeDelaySeconds > 0) return `${t.timeDelaySeconds}s delay`;
      if (t.inactivitySeconds > 0) return `${t.inactivitySeconds}s idle`;
      if (t.exitIntent) return 'exit intent';
    }
    return formData.triggerType.replace(/_/g, ' ');
  })();
  const targetingSummary = (() => {
    const t = campaign?.triggers;
    let n = 0;
    if (t) {
      if (t.deviceTargeting && t.deviceTargeting !== 'all') n++;
      if (t.newVisitorOnly) n++;
      if (t.pageTargeting && t.pageTargeting.trim() && t.pageTargeting.trim() !== '*') n++;
    }
    return n === 0 ? 'All visitors' : `${n} rule${n === 1 ? '' : 's'}`;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Minimal chrome */}
      {step !== 2 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingBottom: 20, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)',
          padding: '32px 40px 0',
        }}>
          <button
            onClick={() => onNavigate('/campaigns')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: 'var(--text-muted)', padding: 0,
            }}
          >
            <ChevronLeft size={14} />
            Back to Campaigns
          </button>

          {/* Step label only — navigation handled by Back/Next buttons */}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            Step {step} of {STEPS.length} — {STEPS[step - 1]?.label}
          </span>
        </div>
      )}

      {/* ── Step 2: inline 3-pane editor ─────────────────────────────────────── */}
      {step === 2 && campaign && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          overflow: 'hidden',
          height: 'calc(100vh - 48px)',
          position: 'relative',
          width: '100%',
        }}>
          {/* Toast Alert */}
          {toast && (
            <div className="fixed bottom-6 left-6 px-3 py-2 bg-zinc-900 border border-zinc-800 text-white font-semibold font-mono text-[9px] uppercase tracking-wider rounded shadow-md z-[1000] flex items-center gap-1.5 animate-slide-up">
              <div className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
              <span>{toast}</span>
            </div>
          )}

          {/* Editor Header / TopBar */}
          <div className="h-16 w-full shrink-0 border-b border-zinc-200 bg-white px-5 flex items-center justify-between select-none">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep(1)}
                className="py-1.5 px-3 rounded-lg border border-zinc-200 text-zinc-800 hover:bg-zinc-50 bg-white cursor-pointer flex items-center gap-1.5 shadow-xs text-xs font-semibold mr-1.5"
                title="Go back to Step 1: Details"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>

              <div className="h-9 w-9 rounded-md bg-zinc-900 flex items-center justify-center text-white shadow-xs">
                <Sparkles className="h-4 w-4 fill-white/10 text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium tracking-wider text-zinc-400 uppercase font-mono">Campaign Designer</span>
                  <span className="text-[9px] text-zinc-500 bg-zinc-100 font-mono tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1">
                    <span className="h-1 w-1 bg-zinc-850 rounded-full inline-block" /> STEP 2
                  </span>
                </div>
                <h2 className="text-xs font-bold text-zinc-950 tracking-tight leading-none mt-1">
                  {formData.name || 'Untitled Campaign'}
                </h2>
              </div>
            </div>

            {/* Middle step switch */}
            <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-lg border border-zinc-200/60">
              {(['teaser', 'main', 'success'] as const).map((s) => {
                const isSelected = activeStep === s;
                let stepLabel = 'Teaser Badge';
                if (s === 'main') stepLabel = 'Main Subscriber';
                if (s === 'success') stepLabel = 'Success Code';

                return (
                  <button
                    key={s}
                    onClick={() => {
                      setActiveStep(s);
                      setSelectedElementId(null);
                      setHistory([JSON.parse(JSON.stringify((campaign.steps as any)[s].elements))]);
                      setHistoryIndex(0);
                    }}
                    className={`py-1 px-3 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-zinc-900 text-white shadow-xs font-semibold'
                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/80'
                    }`}
                  >
                    {stepLabel}
                  </button>
                );
              })}
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-0.5 bg-zinc-50 p-1 border border-zinc-200/60 rounded-lg shrink-0">
                <button
                  onClick={() => setDeviceMode('desktop')}
                  className={`p-1.5 rounded-md transition-all cursor-pointer ${
                    deviceMode === 'desktop' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-400 hover:text-zinc-700'
                  }`}
                  title="Desktop Canvas View"
                >
                  <Laptop className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeviceMode('tablet')}
                  className={`p-1.5 rounded-md transition-all cursor-pointer ${
                    deviceMode === 'tablet' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-400 hover:text-zinc-700'
                  }`}
                  title="Tablet Preview View"
                >
                  <Tablet className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeviceMode('mobile')}
                  className={`p-1.5 rounded-md transition-all cursor-pointer ${
                    deviceMode === 'mobile' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-400 hover:text-zinc-700'
                  }`}
                  title="Mobile Design View"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  disabled={historyIndex <= 0}
                  onClick={handleUndo}
                  className={`p-1.5 rounded-lg border transition-all ${
                    historyIndex > 0
                      ? 'border-zinc-200 text-zinc-800 hover:bg-zinc-50 bg-white cursor-pointer'
                      : 'border-zinc-100 text-zinc-300 bg-zinc-50/50 cursor-not-allowed'
                  }`}
                  title="Undo Edit"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled={historyIndex >= history.length - 1}
                  onClick={handleRedo}
                  className={`p-1.5 rounded-lg border transition-all ${
                    historyIndex < history.length - 1
                      ? 'border-zinc-200 text-zinc-800 hover:bg-zinc-50 bg-white cursor-pointer'
                      : 'border-zinc-100 text-zinc-300 bg-zinc-50/50 cursor-not-allowed'
                  }`}
                  title="Redo Edit"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                onClick={() => setShowStoreSim(true)}
                className="py-1.5 px-3 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Play className="h-3 w-3 fill-zinc-900 text-zinc-900" />
                Simulation
              </button>

              <button
                onClick={() => setStep(3)}
                className="py-1.5 px-4 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer"
              >
                Next Step
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <SidebarLeftDesigner
              campaign={campaign}
              activeStep={activeStep}
              onUpdateStepConfig={handleUpdateStepConfig}
              onUpdateTriggers={handleUpdateTriggers}
              onSelectTemplate={(tpl) => {
                // Load the FULL template design (all steps: teaser/main/success), not just the active step.
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

            <CanvasDesigner
              stepConfig={campaign.steps[activeStep]}
              selectedElementId={selectedElementId}
              deviceMode={deviceMode}
              onSelectElement={setSelectedElementId}
              onUpdateElement={handleUpdateElement}
              onUpdateStepConfig={handleUpdateStepConfig}
            />

            <SidebarRightDesigner
              stepConfig={campaign.steps[activeStep]}
              selectedElementId={selectedElementId}
              onUpdateStepConfig={handleUpdateStepConfig}
              onUpdateElement={handleUpdateElement}
              onDeleteElement={handleRemoveElement}
            />
          </div>

          {showStoreSim && (
            <InteractivePreviewDesigner
              campaign={campaign}
              onClose={() => setShowStoreSim(false)}
              onRecordConversion={() => {
                toastMessage('📈 Conversion Recorded in Sandbox Mode!');
              }}
            />
          )}
        </div>
      )}

      {/* ── All other steps: normal scrollable flow ── */}
      {step !== 2 && (
        <div style={{
          flex: 1,
          display: isTwoCol ? 'grid' : 'flex',
          gridTemplateColumns: isTwoCol ? '1fr 1fr' : undefined,
          flexDirection: isTwoCol ? undefined : 'column',
          alignItems: isTwoCol ? 'stretch' : undefined,
          gap: 24,
          height: isTwoCol ? 'calc(100vh - 150px)' : undefined,
          overflow: isTwoCol ? 'hidden' : undefined,
          padding: '0 40px 24px',
        }}>
          {/* Left / main column */}
          <div style={{
            maxWidth: isTwoCol ? undefined : (step === 2 ? 1000 : 640),
            width: '100%',
            margin: isTwoCol ? undefined : '0 auto',
            paddingBottom: isTwoCol ? 40 : 80,
            height: isTwoCol ? '100%' : undefined,
            overflowY: isTwoCol ? 'auto' : undefined,
            paddingRight: isTwoCol ? 12 : 0,
          }} className="custom-scrollbar">

            {/* Step 1: Campaign Details */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Campaign Details</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Name your campaign and select which site it will run on.</p>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Campaign Name
                    </label>
                    <input
                      className="input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Black Friday Sale"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Target Website
                    </label>
                    <select
                      className="input"
                      value={formData.siteId}
                      onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="">Select a site...</option>
                      {sitesData?.data?.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.domain})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Launch */}
            {step === 3 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 32, textAlign: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px',
                  background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--status-success)',
                }}>
                  <Sparkles size={20} />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Ready to Launch</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 24px' }}>
                  Your campaign is configured. Review the summary below before going live.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                  {[
                    { label: 'Format', value: formData.kind.replace(/_/g, ' ') },
                    { label: 'Trigger', value: primaryTriggerLabel },
                    { label: 'Frequency', value: (campaign?.triggers?.frequency ?? formData.frequency ?? 'once_per_session').replace(/_/g, ' ') },
                    { label: 'Targeting', value: targetingSummary },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--bg-raised)', borderRadius: 6, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{value}</div>
                    </div>
                  ))}
                </div>
                
                <div style={{ marginTop: 24 }}>
                  <button
                    onClick={handleLaunch}
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ minWidth: 160, background: 'var(--status-success)', borderColor: 'var(--status-success)' }}
                  >
                    {loading ? 'Launching…' : 'Launch Campaign'}
                  </button>
                </div>
              </div>
            )}

            {/* Wizard Navigation Footer */}
            {step < 3 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 32,
                paddingTop: 20,
                borderTop: '1px solid var(--border-subtle)',
              }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={step === 1}
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (step === 1 && (!formData.name || !formData.siteId)) {
                      alert('Please enter a campaign name and select a target site.');
                      return;
                    }
                    setStep((s) => Math.min(3, s + 1));
                  }}
                >
                  Next Step
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
