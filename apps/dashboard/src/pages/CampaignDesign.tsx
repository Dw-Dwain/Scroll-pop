import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useOne, useApiUrl, useCustom, useCustomMutation } from '@refinedev/core';

// Upgraded Canvas Designer Components
import TopBar from '../components/campaign-designer/TopBar';
import SidebarLeft from '../components/campaign-designer/SidebarLeft';
import Canvas from '../components/campaign-designer/Canvas';
import SidebarRight from '../components/campaign-designer/SidebarRight';
import InteractivePreview from '../components/campaign-designer/InteractivePreview';

import { Campaign, CampaignElement, CampaignStep, ElementType, CampaignStepConfig } from '../components/campaign-designer/types';

interface CampaignDesignProps {
  campaignId: string;
  onNavigate: (path: string) => void;
}

// Helper to bootstrap Campaign object from legacy flat fields or new steps config
function bootstrapCampaign(campaignId: string, campaignName: string, designData: any): Campaign {
  const config = designData?.config || {};
  
  if (config.steps) {
    return {
      id: campaignId,
      name: campaignName,
      category: 'Countdown Campaigns',
      isActive: true,
      steps: config.steps,
      triggers: {
        exitIntent: config.steps.main?.triggers?.exitIntent ?? true,
        scrollPercent: config.steps.main?.triggers?.scrollPercent ?? 30,
        inactivitySeconds: config.steps.main?.triggers?.inactivitySeconds ?? 20,
        timeDelaySeconds: config.steps.main?.triggers?.timeDelaySeconds ?? 5,
        pageTargeting: config.steps.main?.triggers?.pageTargeting ?? '*',
        deviceTargeting: config.steps.main?.triggers?.deviceTargeting ?? 'all',
        geoTargeting: config.steps.main?.triggers?.geoTargeting ?? 'All Countries',
        frequencyCapDays: config.steps.main?.triggers?.frequencyCapDays ?? 7,
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
      exitIntent: true,
      scrollPercent: 30,
      inactivitySeconds: 20,
      timeDelaySeconds: 5,
      pageTargeting: '*',
      deviceTargeting: 'all' as const,
      geoTargeting: 'All Countries',
      frequencyCapDays: 7,
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

  const config = {
    steps: campaign.steps,
    backgroundColor: mainStep.backgroundColor,
    borderRadius: mainStep.borderRadius,
    borderColor: mainStep.borderColor,
    borderWidth: mainStep.borderWidth,
    boxShadow: mainStep.boxShadow,
    position: mainStep.position,
    animation: mainStep.animationEntrance,
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
  const { data: campaignData, isLoading: isCampaignLoading, isError: isCampaignError } = useOne({ resource: 'campaigns', id: campaignId });
  const apiUrl = useApiUrl();
  const { data: designData, isLoading: isDesignLoading, isError: isDesignError } = useCustom({
    url: `${apiUrl}/campaigns/${campaignId}/design`,
    method: 'get',
  });
  const { mutate } = useCustomMutation();

  const [campaign, setCampaign] = React.useState<Campaign | null>(null);
  const [activeStep, setActiveStep] = React.useState<CampaignStep>('main');
  const [deviceMode, setDeviceMode] = React.useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>(null);
  const [showStoreSim, setShowStoreSim] = React.useState<boolean>(false);

  // Undo / Redo History States
  const [history, setHistory] = React.useState<CampaignElement[][]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);
  const [isSaving, setIsSaving] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  // Bootstrap campaign when API data arrives
  React.useEffect(() => {
    if (campaign) return;
    const bothSettled = !isCampaignLoading && !isDesignLoading;
    if (!bothSettled) return;

    const camp = bootstrapCampaign(
      campaignId,
      campaignData?.data?.name || 'New Campaign',
      designData?.data || {}
    );
    setCampaign(camp);
    setHistory([JSON.parse(JSON.stringify(camp.steps.main.elements))]);
    setHistoryIndex(0);
  }, [campaignData, designData, isCampaignLoading, isDesignLoading, campaignId, campaign]);

  // Fallback: if API is unreachable, restore from sessionStorage cache written by Campaigns page
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (!campaign) {
        // Try to restore name + design from the cache written when "Edit Design" was clicked
        let cachedName = 'New Campaign';
        let cachedDesign: any = {};
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
      }
    }, 1500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleSave = () => {
    if (!campaign) return;
    setIsSaving(true);
    const designPayload = mapCampaignToDesign(campaign);
    mutate(
      { url: `${apiUrl}/campaigns/${campaignId}/design`, method: 'put', values: designPayload },
      {
        onSuccess: () => {
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
    <div className="flex flex-col overflow-hidden bg-white select-none" style={{
      position: 'fixed',
      top: 'var(--topnav-height, 48px)',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 90,
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
          setHistory([JSON.parse(JSON.stringify((campaign.steps as any)[step].elements))]);
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
