import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  FolderSync, 
  ShoppingBag, 
  Sparkles, 
  TrendingUp, 
  Activity, 
  Search, 
  Sliders, 
  Layers, 
  Palette, 
  ArrowRight,
  Sparkle,
  MessageSquareShare,
  Calendar,
  CheckCircle,
  HelpCircle,
  Clock,
  Eye
} from 'lucide-react';
import { Campaign, CampaignElement, CampaignStep, ElementType, PopupType, CanvasPosition } from './types';
import { PREBUILT_TEMPLATES } from './data/templates';
import SidebarLeft from './components/SidebarLeft';
import SidebarRight from './components/SidebarRight';
import TopBar from './components/TopBar';
import Canvas from './components/Canvas';
import InteractivePreview from './components/InteractivePreview';

export default function App() {
  // Campaign Manager States
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isEditorMode, setIsEditorMode] = useState<boolean>(false);
  
  // Workspace UI States
  const [activeStep, setActiveStep] = useState<CampaignStep>('main');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showStoreSim, setShowStoreSim] = useState<boolean>(false);

  // Undo & Redo History System State
  const [history, setHistory] = useState<CampaignElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Toast Alerts State
  const [toast, setToast] = useState<string | null>(null);

  // 1. Initial Load campaigns list from Prebuilts & LocalStorage
  useEffect(() => {
    const cached = localStorage.getItem('canva_pop_campaigns');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCampaigns(parsed);
          return;
        }
      } catch (err) {
        console.error('Failed parsing cached campaigns', err);
      }
    }
    // Default to template catalog
    setCampaigns(PREBUILT_TEMPLATES);
    localStorage.setItem('canva_pop_campaigns', JSON.stringify(PREBUILT_TEMPLATES));
  }, []);

  const toastMessage = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Convert elements list into state backup snapshot
  const pushHistoryState = (elements: CampaignElement[]) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(JSON.parse(JSON.stringify(elements)));
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      const snapshot = history[targetIndex];
      setHistoryIndex(targetIndex);

      // Apply snapshot elements list to current active step
      if (campaign) {
        const updatedSteps = { ...campaign.steps };
        updatedSteps[activeStep] = {
          ...updatedSteps[activeStep],
          elements: JSON.parse(JSON.stringify(snapshot))
        };
        setCampaign({ ...campaign, steps: updatedSteps });
      }
      toastMessage('⏪ Design Action Undo Success');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      const snapshot = history[targetIndex];
      setHistoryIndex(targetIndex);

      if (campaign) {
        const updatedSteps = { ...campaign.steps };
        updatedSteps[activeStep] = {
          ...updatedSteps[activeStep],
          elements: JSON.parse(JSON.stringify(snapshot))
        };
        setCampaign({ ...campaign, steps: updatedSteps });
      }
      toastMessage('⏩ Design Action Redo Success');
    }
  };

  // 2. Select visual campaign template to start editing
  const selectCampaign = (selected: Campaign) => {
    const cloned = JSON.parse(JSON.stringify(selected)) as Campaign;
    setCampaign(cloned);
    setActiveStep('main');
    setIsEditorMode(true);
    setSelectedElementId(null);
    
    // Bootstrap undo history
    setHistory([JSON.parse(JSON.stringify(cloned.steps.main.elements))]);
    setHistoryIndex(0);
    
    toastMessage(`🎨 Launched Canva Designer for: ${selected.name}`);
  };

  // 3. Update active campaign properties general / triggers / layout
  const handleUpdateStepConfig = (keyOrObj: string | Record<string, any>, value?: any) => {
    if (!campaign) return;

    setCampaign((prev) => {
      if (!prev) return prev;
      const updatedSteps = { ...prev.steps };
      let newStepConfig = { ...updatedSteps[activeStep] };

      if (typeof keyOrObj === 'string') {
        newStepConfig[keyOrObj as any] = value;
      } else {
        newStepConfig = {
          ...newStepConfig,
          ...keyOrObj
        };
      }

      updatedSteps[activeStep] = newStepConfig;
      return { ...prev, steps: updatedSteps };
    });

    // Save step elements changes history
    if (typeof keyOrObj === 'string') {
      if (keyOrObj === 'elements') {
        pushHistoryState(value);
      }
    } else {
      if ('elements' in keyOrObj) {
        pushHistoryState(keyOrObj.elements);
      }
    }
  };

  const handleUpdateTriggers = (key: string, value: any) => {
    if (!campaign) return;
    const updatedTriggers = {
      ...campaign.triggers,
      [key]: value
    };
    setCampaign({ ...campaign, triggers: updatedTriggers });
  };

  // 4. Layer Elements Manipulation (Add, Update, Remove, Z-Index Sort)
  const handleAddElement = (type: ElementType) => {
    if (!campaign) return;
    const stepConfig = campaign.steps[activeStep];
    const elementsList = stepConfig.elements;

    // Calculate maximum z-index to place new items cleanly on top
    const maxZ = elementsList.reduce((max, el) => Math.max(max, el.zIndex), 0);
    
    // Create new elements coordinates with standard parameters centered on canvas
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
        baseNewElem.content = 'Write some catching subtitle descriptions here about benefits, newsletters, shipping and free codes drop!';
        baseNewElem.color = '#4B5563';
        baseNewElem.fontSize = 12;
        baseNewElem.fontFamily = 'sans-serif';
        baseNewElem.align = 'center';
        break;
      case 'button':
        baseNewElem.w = 40;
        baseNewElem.h = 10;
        baseNewElem.content = 'ACTIVATE CODE NOW';
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
          placeholder: 'Your primary shopper email...',
          label: 'Email Address'
        };
        break;
      case 'countdown':
        baseNewElem.w = 40;
        baseNewElem.h = 15;
        baseNewElem.content = '599'; // Seconds
        baseNewElem.extraProps = {
          targetSeconds: 599
        };
        break;
      case 'product':
        baseNewElem.w = 50;
        baseNewElem.h = 24;
        baseNewElem.borderRadius = 12;
        break;
      case 'review':
        baseNewElem.w = 50;
        baseNewElem.h = 18;
        baseNewElem.borderRadius = 8;
        break;
      case 'qrcode':
        baseNewElem.w = 20;
        baseNewElem.h = 28;
        break;
      case 'urgency':
        baseNewElem.w = 55;
        baseNewElem.h = 9;
        baseNewElem.content = '🔥 Limited stock remaining! 102 checked out in the last 4 minutes';
        break;
      case 'image':
        baseNewElem.w = 40;
        baseNewElem.h = 40;
        baseNewElem.content = 'https://images.unsplash.com/photo-1542435503-956c469947f6?auto=format&fit=crop&w=450&q=80';
        baseNewElem.borderRadius = 12;
        break;
      case 'shape':
        baseNewElem.w = 20;
        baseNewElem.h = 20;
        baseNewElem.content = 'rect';
        baseNewElem.backgroundColor = '#E0E7FF';
        baseNewElem.borderRadius = 6;
        break;
    }

    const updated = [...elementsList, baseNewElem];
    handleUpdateStepConfig('elements', updated);
    setSelectedElementId(baseNewElem.id);

    toastMessage(`➕ Added visual ${type} block to workspace`);
  };

  const handleUpdateElement = (id: string, key: string, value: any) => {
    if (!campaign) return;
    const stepConfig = campaign.steps[activeStep];
    const elementsList = stepConfig.elements;

    const updated = elementsList.map(item => {
      if (item.id === id) {
        return { ...item, [key]: value };
      }
      return item;
    });

    handleUpdateStepConfig('elements', updated);
  };

  const handleRemoveElement = (id: string) => {
    if (!campaign || id === 'close-btn') return;
    const stepConfig = campaign.steps[activeStep];
    const elementsList = stepConfig.elements;

    const filtered = elementsList.filter(item => item.id !== id);
    handleUpdateStepConfig('elements', filtered);
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }

    toastMessage('🗑 Layer element deleted');
  };

  const handleReorderElement = (id: string, action: 'up' | 'down') => {
    if (!campaign) return;
    const stepConfig = campaign.steps[activeStep];
    const elementsList = stepConfig.elements;

    const targetIndex = elementsList.findIndex(e => e.id === id);
    if (targetIndex === -1) return;

    const updated = elementsList.map((el, idx) => {
      if (el.id === id) {
        const curZ = el.zIndex;
        return {
          ...el,
          zIndex: action === 'up' ? curZ + 1 : Math.max(1, curZ - 1)
        };
      }
      return el;
    });

    handleUpdateStepConfig('elements', updated);
    toastMessage(`📂 Reordered Z-index layers`);
  };

  // 5. Action Handlers (Save, Simulated shopfront conversion)
  const handleSaveCampaign = () => {
    if (!campaign) return;
    
    // Persist edited campaign inside central mock list DB
    const list = campaigns.map(c => c.id === campaign.id ? campaign : c);
    setCampaigns(list);
    localStorage.setItem('canva_pop_campaigns', JSON.stringify(list));

    toastMessage(`💾 Persisted and Published "${campaign.name}" to cloud stores!`);
  };

  const handleRecordSimConversion = () => {
    if (!campaign) return;
    
    // Increment active campaign conversion indicators
    const currentConvs = campaign.conversions + 1;
    const currentViews = campaign.views + 1;
    const updated = {
      ...campaign,
      conversions: currentConvs,
      views: currentViews
    };

    setCampaign(updated);

    const list = campaigns.map(c => c.id === campaign.id ? updated : c);
    setCampaigns(list);
    localStorage.setItem('canva_pop_campaigns', JSON.stringify(list));
  };

  const createNewCampaign = () => {
    const id = `campaign-${Date.now()}`;
    const newCamp: Campaign = {
      id,
      name: 'Custom Flash Campaign',
      category: 'Countdown Campaigns',
      isActive: true,
      conversions: 0,
      views: 0,
      createdAt: new Date().toISOString().split('T')[0],
      triggers: {
        exitIntent: true,
        scrollPercent: 25,
        inactivitySeconds: 15,
        timeDelaySeconds: 4,
        pageTargeting: '*',
        deviceTargeting: 'all',
        geoTargeting: 'All Countries',
        frequencyCapDays: 1,
      },
      steps: {
        teaser: {
          popupType: 'floating',
          position: 'bottom-right',
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
              content: '👜 Unlock Gift Offer',
              color: '#FFFFFF',
              fontSize: 10,
              align: 'center',
              zIndex: 1,
            }
          ]
        },
        main: {
          popupType: 'modal',
          position: 'center',
          width: 600,
          height: 380,
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          boxShadow: '0px 25px 80px rgba(0,0,0,0.15)',
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
              id: 'main-head',
              type: 'heading',
              x: 10,
              y: 15,
              w: 80,
              h: 15,
              content: 'CLAIM YOUR 15% VIP KEY',
              color: '#111827',
              fontSize: 24,
              fontWeight: '800',
              align: 'center',
              fontFamily: 'serif',
              zIndex: 2,
            },
            {
              id: 'main-desc',
              type: 'text',
              x: 15,
              y: 35,
              w: 70,
              h: 12,
              content: 'Unlock immediate priority checkout privileges. Fill in your primary shopping email coordinates below:',
              color: '#4B5563',
              fontSize: 12,
              align: 'center',
              zIndex: 2,
            },
            {
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
            },
            {
              id: 'main-submit',
              type: 'button',
              x: 20,
              y: 75,
              w: 60,
              h: 12,
              content: 'CLAIM VIP ACQUISITION',
              color: '#FFFFFF',
              backgroundColor: '#111827',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: '700',
              align: 'center',
              zIndex: 3,
            }
          ]
        },
        success: {
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
              content: 'ACQUISITION SECURED',
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
              content: 'C-VIP15',
              color: '#111827',
              backgroundColor: '#FFFFFF',
              borderRadius: 10,
              fontSize: 22,
              fontWeight: '805',
              align: 'center',
              fontFamily: 'monospace',
              zIndex: 3,
            },
            {
              id: 'suc-action-btn',
              type: 'button',
              x: 25,
              y: 70,
              w: 50,
              h: 12,
              content: 'ENTER STOREFRONT BAG',
              color: '#FFFFFF',
              backgroundColor: '#34D399',
              borderRadius: 10,
              fontSize: 10,
              fontWeight: '800',
              align: 'center',
              zIndex: 4,
            }
          ]
        }
      }
    };

    const updated = [newCamp, ...campaigns];
    setCampaigns(updated);
    localStorage.setItem('canva_pop_campaigns', JSON.stringify(updated));
    selectCampaign(newCamp);
  };

  // Calculate cumulative high level portal parameters
  const cumulativeViews = campaigns.reduce((acc, c) => acc + c.views, 0);
  const cumulativeConvs = campaigns.reduce((acc, c) => acc + c.conversions, 0);
  const averageCR = cumulativeViews > 0 ? (cumulativeConvs / cumulativeViews) * 100 : 0;

  return (
    <div className="min-h-screen bg-zinc-50/50 font-sans flex flex-col antialiased">
      
      {/* Visual Floating Toasts Alert Banner */}
      {toast && (
        <div className="fixed bottom-6 left-6 px-3 py-2 bg-zinc-900 border border-zinc-800 text-white font-semibold font-mono text-[9px] uppercase tracking-wider rounded shadow-md z-[1000] flex items-center gap-1.5 animate-slide-up">
          <div className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
          <span>{toast}</span>
        </div>
      )}

      {/* RENDER MODE A: ACTIVE DESIGN WORKSPACE CANVA EDITOR */}
      {isEditorMode && campaign ? (
        <div className="h-screen w-full flex flex-col overflow-hidden bg-white">
          
          {/* Top workspace toolbar */}
          <TopBar
            campaign={campaign}
            activeStep={activeStep}
            deviceMode={deviceMode}
            onStepChange={(step) => {
              setActiveStep(step);
              setSelectedElementId(null);
              // reset undo history index for active step configuration
              setHistory([JSON.parse(JSON.stringify(campaign.steps[step].elements))]);
              setHistoryIndex(0);
            }}
            onDeviceModeChange={setDeviceMode}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onSave={handleSaveCampaign}
            onLaunchSim={() => setShowStoreSim(true)}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
          />

          {/* Core Sidebar/Canvas Workspace Frame */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* SidebarLeft for Template Selection / Drag Placements / Trigger parameters */}
            <SidebarLeft
              campaign={campaign}
              activeStep={activeStep}
              onUpdateStepConfig={handleUpdateStepConfig}
              onUpdateTriggers={handleUpdateTriggers}
              onSelectTemplate={(tpl) => {
                // Instantly swap elements list and backdrop theme specs using a batch update object
                const targetConfig = tpl.steps[activeStep];
                handleUpdateStepConfig({
                  elements: JSON.parse(JSON.stringify(targetConfig.elements)),
                  backgroundColor: targetConfig.backgroundColor,
                  borderColor: targetConfig.borderColor,
                  borderWidth: targetConfig.borderWidth,
                  borderRadius: targetConfig.borderRadius,
                  popupType: targetConfig.popupType,
                  width: targetConfig.width,
                  height: targetConfig.height,
                  overlayColor: targetConfig.overlayColor,
                  animationEntrance: targetConfig.animationEntrance,
                });

                setSelectedElementId(null);
                toastMessage(`🔀 Swapped active step to template: ${tpl.name}`);
              }}
              onAddElement={handleAddElement}
              onRemoveElement={handleRemoveElement}
              onReorderElement={handleReorderElement}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onUpdateElement={handleUpdateElement}
            />

            {/* Core Drag & Snap interactive Workspace Design Canvas */}
            <Canvas
              stepConfig={campaign.steps[activeStep]}
              selectedElementId={selectedElementId}
              deviceMode={deviceMode}
              onSelectElement={setSelectedElementId}
              onUpdateElement={handleUpdateElement}
              onUpdateStepConfig={handleUpdateStepConfig}
            />

            {/* Inspect SidebarRight for Property fields customization */}
            <SidebarRight
              stepConfig={campaign.steps[activeStep]}
              selectedElementId={selectedElementId}
              onUpdateStepConfig={handleUpdateStepConfig}
              onUpdateElement={handleUpdateElement}
              onDeleteElement={handleRemoveElement}
            />

          </div>

          {/* Live active Simulated Checkout Cosmetics store preview screen model overlay */}
          {showStoreSim && (
            <InteractivePreview
              campaign={campaign}
              onClose={() => setShowStoreSim(false)}
              onRecordConversion={handleRecordSimConversion}
            />
          )}

        </div>
      ) : (
        // RENDER MODE B: COGNITIVE HOMEPAGE CAMPAIGN PORTAL
        <div className="flex-1 flex flex-col justify-between overflow-x-hidden">
          
          {/* Main Hero Header */}
          <div className="max-w-7xl mx-auto w-full px-6 py-5 border-b border-zinc-200 flex justify-between items-center bg-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 bg-zinc-900 rounded flex items-center justify-center text-white shadow-xs">
                <Sparkle className="h-4 w-4" />
              </div>
              <div className="text-left font-mono">
                <h1 className="text-base tracking-widest font-bold text-zinc-900 leading-none">CANVAPOP</h1>
                <span className="text-[9px] text-zinc-400 font-extrabold uppercase tracking-widest block mt-1.5">Elite popup manager sandbox</span>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono">
              <button
                onClick={createNewCampaign}
                className="py-2 px-4 bg-zinc-900 hover:bg-black text-white rounded text-xs uppercase font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 animate-pulse" /> Create Campaign
              </button>
            </div>
          </div>

          {/* Dynamic Marketing Body */}
          <div className="max-w-7xl mx-auto w-full px-6 py-10 flex-1 space-y-10">
            
            <div className="flex flex-col md:flex-row gap-8 items-center justify-between border-b border-zinc-200 pb-8">
              <div className="space-y-3.5 max-w-xl text-left">
                <div className="flex gap-2 items-center font-mono text-[9px] font-semibold">
                  <span className="bg-zinc-100 text-zinc-800 tracking-widest px-2.5 py-0.5 rounded-sm uppercase">Creative editor flow</span>
                  <span className="bg-zinc-100 text-zinc-850 tracking-widest px-2.5 py-0.5 rounded-sm uppercase font-bold">Shopify ready</span>
                </div>
                <h2 className="text-3xl font-serif text-zinc-950 font-light tracking-tight leading-tight">
                  Design Popup Campaigns with direct visual control.
                </h2>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Ditch rigid parameters form sheets. Position, slide, resize count-downs, or configure lucky spin wheels directly on a visual canvas—then try out the completed coupon codes with our simulated live shop checkout bag!
                </p>
              </div>

              {/* Dynamic SVG Visual Polished Chart Stats */}
              <div className="grid grid-cols-3 gap-4 w-full md:max-w-md shrink-0 font-mono">
                <div className="bg-white p-4 rounded border border-zinc-200 text-left shadow-xs">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">SERVED VIEWS</span>
                  <p className="text-lg font-bold text-zinc-900 mt-1">{(cumulativeViews).toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded border border-zinc-200 text-left shadow-xs">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">CONVERSIONS</span>
                  <p className="text-lg font-bold text-zinc-900 mt-1">{(cumulativeConvs).toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded border border-zinc-200 text-left shadow-xs">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">AVG CONV RATE</span>
                  <p className="text-lg font-bold text-zinc-900 mt-1">{averageCR.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Workspace Template selection grid section */}
            <div className="space-y-4">
              <div className="text-left font-mono">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Premium design catalog</span>
                <h3 className="text-lg font-serif font-light text-zinc-900 mt-0.5">Select a template to launch Canva canvas workspace</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map((tpl) => {
                  return (
                    <div 
                      key={tpl.id}
                      className="bg-white rounded border border-zinc-200 overflow-hidden hover:border-zinc-900 shadow-xs hover:shadow-sm transition-all cursor-pointer group text-left flex flex-col justify-between"
                      onClick={() => selectCampaign(tpl)}
                    >
                      {/* Realistic Thumbnail frame header */}
                      <div className="aspect-video w-full bg-zinc-50/50 border-b border-zinc-150 p-4 flex items-center justify-center relative overflow-hidden">
                        <div 
                          className="w-[90%] h-[92%] rounded shadow-md border p-3 flex flex-col justify-between overflow-hidden relative transition-transform duration-500 group-hover:scale-102"
                          style={{
                            backgroundColor: tpl.steps.main.backgroundColor,
                            borderColor: tpl.steps.main.borderColor,
                            borderWidth: tpl.steps.main.borderWidth,
                          }}
                        >
                          <div className="flex flex-col gap-0.5 pointer-events-none">
                            <span 
                              className="text-[10px] font-black truncate"
                              style={{ color: tpl.steps.main.elements.find(e => e.type === 'heading')?.color || '#111827' }}
                            >
                              {tpl.steps.main.elements.find(e => e.type === 'heading')?.content || 'Exclusive Coupon'}
                            </span>
                            <span className="text-[7px] text-gray-400 line-clamp-2 leading-tight">
                              {tpl.steps.main.elements.find(e => e.type === 'text')?.content || 'Sign up details.'}
                            </span>
                          </div>

                          <div className="w-full flex items-center gap-1.5 pointer-events-none">
                            <div className="flex-1 h-3.5 rounded bg-white border border-zinc-200 text-[6px] pl-1.5 pt-0.5 text-gray-300">
                              email@com...
                            </div>
                            <div 
                              className="px-2.5 h-3.5 text-[6px] font-black text-white rounded flex items-center justify-center truncate"
                              style={{ backgroundColor: tpl.steps.main.elements.find(e => e.type === 'button')?.backgroundColor || '#000000' }}
                            >
                              CLAIM NOW
                            </div>
                          </div>

                          {/* Quick labels watermark */}
                          <div className="absolute top-1 right-1 scale-75 select-none bg-zinc-100 text-zinc-700 font-mono text-[5px] font-bold py-0.5 px-1 rounded uppercase tracking-wider border border-zinc-200">
                            {tpl.steps.main.popupType}
                          </div>
                        </div>
                      </div>

                      {/* Info catalog footer */}
                      <div className="p-4 bg-white space-y-3 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center font-mono">
                            <h4 className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{tpl.category}</h4>
                            <span className="text-[8px] text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded-sm font-bold tracking-wide flex items-center gap-0.5 uppercase">
                              ★ {((tpl.conversions / (tpl.views || 1)) * 100).toFixed(1)}% CR
                            </span>
                          </div>
                          
                          <h3 className="text-sm font-bold text-zinc-900 tracking-tight group-hover:text-black transition-colors mt-1.5">
                            {tpl.name}
                          </h3>
                        </div>

                        {/* Quick design tags list */}
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 font-mono text-[9px]">
                          <div className="flex gap-2">
                            <span className="text-zinc-500 font-semibold">VIEWS: <strong className="text-zinc-900">{(tpl.views).toLocaleString()}</strong></span>
                            <span className="text-zinc-500 font-semibold font-mono">CONV: <strong className="text-zinc-900">{(tpl.conversions).toLocaleString()}</strong></span>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              selectCampaign(tpl);
                            }}
                            className="text-[9px] uppercase tracking-wider font-bold text-zinc-900 hover:text-black transition-colors flex items-center gap-0.5 cursor-pointer"
                          >
                            Design <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {/* Professional promotional bento footer block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
              <div className="p-6 rounded bg-zinc-900 text-white text-left space-y-3 border border-zinc-800 shadow-xs relative overflow-hidden">
                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest font-mono block">CONVERSION DYNAMICS</span>
                <h4 className="text-lg font-serif font-light leading-snug">Gamify campaigns with direct lucky spin wheels and timers.</h4>
                <p className="text-[11px] text-zinc-405 text-zinc-400 leading-relaxed">
                  Interactive campaigns (like Promolayer and premium Shopify apps) boast over twice the subscribe retention rate of generic models. Position interactive elements safely within your CanvaPop canvas editor.
                </p>
                <div className="absolute -bottom-6 -right-6 text-zinc-805 text-zinc-800/10 font-black text-6xl uppercase tracking-tighter select-none rotate-12 pointer-events-none font-serif">
                  CONV
                </div>
              </div>

              <div className="p-6 rounded bg-zinc-100/50 text-zinc-900 border border-zinc-200 text-left space-y-3 shadow-xs relative overflow-hidden">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest font-mono block">INTEGRATED SIMULATOR</span>
                <h4 className="text-lg font-serif font-light leading-snug">Audit layouts instantly with our Lumina mock checkout.</h4>
                <p className="text-[11px] text-zinc-600 leading-relaxed animate-none">
                  Friction-free testing. Add products, apply design promo-codes, check cart deductions, and complete testing transactions to register real-time conversion telemetry inside your active dashboard stats.
                </p>
                <div className="absolute -bottom-6 -right-6 text-zinc-400/10 font-black text-6xl uppercase tracking-tighter select-none rotate-12 pointer-events-none font-serif">
                  TEST
                </div>
              </div>
            </div>

          </div>

          {/* Clean minimal credits footer */}
          <div className="bg-white border-t border-zinc-200 py-5 text-center text-[10px] font-mono text-zinc-450 text-zinc-400 font-medium shrink-0 uppercase tracking-widest">
            © 2026 CanvaPop. DESIGN DRIVEN DIGITAL COMMERCE. ALL RIGHTS RESERVED.
          </div>

        </div>
      )}

    </div>
  );
}
