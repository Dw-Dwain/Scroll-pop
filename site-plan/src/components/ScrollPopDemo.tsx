import { useState, useEffect } from 'react';
import { DemoSettings } from '../types';
import { Sparkles, Clipboard, Check, RefreshCw, Layers, Sliders, Laptop, Smartphone, Eye, Code2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScrollPopDemoProps {
  customSetup?: Partial<DemoSettings>;
}

export default function ScrollPopDemo({ customSetup }: ScrollPopDemoProps) {
  const [settings, setSettings] = useState<DemoSettings>({
    popupType: 'newsletter',
    triggerType: 'click',
    triggerValue: 30,
    themeStyle: 'warm-editorial',
    textColor: '#1A1A1A',
    bgColor: '#FAF9F5',
    accentColor: '#C05621',
    position: 'bottom-right',
    roundness: 'md',
    animationType: 'slide-up',
    ...customSetup
  });

  const [activeTab, setActiveTab] = useState<'preview' | 'shopify' | 'wordpress'>('preview');
  const [copied, setCopied] = useState(false);
  const [simulatedTriggered, setSimulatedTriggered] = useState(true);
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');

  // React to external template triggers
  useEffect(() => {
    if (customSetup) {
      setSettings(prev => ({ ...prev, ...customSetup }));
      setSimulatedTriggered(true);
    }
  }, [customSetup]);

  const presetThemes = {
    'minimalist': {
      name: 'Sophisticated Minimalist',
      bg: '#FFFFFF',
      text: '#111111',
      accent: '#222222',
      roundness: 'none' as const,
      font: 'font-sans'
    },
    'warm-editorial': {
      name: 'Lux Warm Editorial',
      bg: '#FAF9F5',
      text: '#1A1A1A',
      accent: '#C05621',
      roundness: 'md' as const,
      font: 'font-serif'
    },
    'tech-mono': {
      name: 'Tech Mono / Brutalist',
      bg: '#0F172A',
      text: '#F8FAFC',
      accent: '#38BDF8',
      roundness: 'none' as const,
      font: 'font-mono'
    },
    'luxury-bold': {
      name: 'Avant Garde Obsidian',
      bg: '#111111',
      text: '#F5F5F5',
      accent: '#D4AF37',
      roundness: 'full' as const,
      font: 'font-serif'
    }
  };

  const handleApplyPreset = (key: keyof typeof presetThemes) => {
    const preset = presetThemes[key];
    setSettings(prev => ({
      ...prev,
      themeStyle: key,
      bgColor: preset.bg,
      textColor: preset.text,
      accentColor: preset.accent,
      roundness: preset.roundness
    }));
    // Re-trigger animation
    setSimulatedTriggered(false);
    setTimeout(() => setSimulatedTriggered(true), 150);
  };

  const popupContents = {
    newsletter: {
      tag: 'NEWSLETTER SUBSCRIPTION',
      title: 'Curated Digest',
      body: 'Receive curated articles, collection previews, and high-quality merchant thoughts twice monthly. Strictly premium, no spam.',
      cta: 'Subscribe Journal',
      inputPlaceholder: 'partners@brand.com'
    },
    coupon: {
      tag: 'EXCLUSIVE MERCH METRIC',
      title: 'Acquisition Boost',
      body: 'Take 15% off your first checkout run. Beautiful section presets that boost Shopify conversion rates by an audited 3.4%.',
      cta: 'Claim Discount Code',
      inputPlaceholder: 'Enter your business email',
      discountCode: 'POP15'
    },
    'slide-in': {
      tag: 'UX CART RETENTION',
      title: 'Cart is Still Open',
      body: 'Your custom collection mock is saved. Secure your slot and complete deployment with a complimentary engineering consultation.',
      cta: 'Finalize Deployment Now',
      inputPlaceholder: 'Send confirmation code to mobile number'
    },
    'cart-abandonment': {
      tag: 'FLASH ACQUISITION',
      title: 'Wait! Don’t Skip Creative Integrity',
      body: 'Over 68% of customers cancel due to tacky widgets. Try the ScrollPop difference with zero Cumulative Layout Shift guarantee.',
      cta: 'Add Elite Layer',
      inputPlaceholder: 'Your primary store URL'
    },
    'floating-bar': {
      tag: 'LIVE ACCELERATION',
      title: 'Free Express Shipment Active',
      body: 'Unlocking free international deployment for the next 24 minutes. Applied automatically.',
      cta: 'Verify Eligibility',
      inputPlaceholder: ''
    }
  };

  const currentContent = popupContents[settings.popupType];

  // Helper code generation
  const shopifySchema = `{
  "name": "ScrollPop Layer",
  "tag": "section",
  "class": "shopify-scrollpop-overlay",
  "settings": [
    {
      "type": "select",
      "id": "popup_type",
      "label": "Campagn Format",
      "options": [{ "value": "${settings.popupType}", "label": "${settings.popupType}" }],
      "default": "${settings.popupType}"
    },
    {
      "type": "color",
      "id": "bg_color",
      "label": "Base Canvas Tint",
      "default": "${settings.bgColor}"
    },
    {
      "type": "color",
      "id": "accent_color",
      "label": "Studio Accent Highlights",
      "default": "${settings.accentColor}"
    },
    {
      "type": "select",
      "id": "border_radius",
      "label": "Border Architecture",
      "options": [{ "value": "${settings.roundness}", "label": "Selected Profile" }],
      "default": "${settings.roundness}"
    }
  ]
}`;

  const wordpressConfig = `<!-- wp:scrollpop/popup-block {
  "popupType": "${settings.popupType}",
  "themeStyle": "${settings.themeStyle}",
  "bgColor": "${settings.bgColor}",
  "textColor": "${settings.textColor}",
  "accentColor": "${settings.accentColor}",
  "triggerType": "${settings.triggerType}",
  "cornerRadius": "${settings.roundness}"
} /-->`;

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-white border border-[#E9E4D9] rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
      
      {/* LEFT: Customizer Control Panel */}
      <div className="lg:col-span-5 border-r border-[#E9E4D9] p-8 flex flex-col gap-8 bg-[#FAF9F5]">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#C05621] uppercase block mb-1">REAL-TIME SIMULATION</span>
          <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">Design customizer</h3>
          <p className="text-zinc-500 text-sm mt-1">
            See how the ScrollPop engine renders layouts. Perfect for custom styling translation.
          </p>
        </div>

        {/* Setting Category: Campaign Layout */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-mono uppercase tracking-wider text-neutral-500 flex items-center justify-between">
            <span>Popup Archetype</span>
            <span className="text-[10px] text-[#C05621] font-bold">Reusable Component</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['newsletter', 'coupon', 'slide-in'] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setSettings(p => ({ ...p, popupType: type }));
                  setSimulatedTriggered(false);
                  setTimeout(() => setSimulatedTriggered(true), 150);
                }}
                className={`py-2 px-3 text-xs font-medium border rounded-md transition-all cursor-pointer ${
                  settings.popupType === type
                    ? 'bg-[#1A1A1A] border-[#1A1A1A] text-[#FAF9F5] shadow-xs'
                    : 'bg-white border-[#E9E4D9] text-[#4A4A4A] hover:bg-neutral-100'
                }`}
              >
                {type === 'newsletter' && 'Newsletter'}
                {type === 'coupon' && 'Promo Offer'}
                {type === 'slide-in' && 'Slide Bag'}
              </button>
            ))}
          </div>
        </div>

        {/* Setting Category: Preset Visual Systems */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-mono uppercase tracking-wider text-neutral-500">
            Design presets (Theme matching)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(presetThemes) as Array<keyof typeof presetThemes>).map((key) => {
              const active = settings.themeStyle === key;
              return (
                <button
                  key={key}
                  onClick={() => handleApplyPreset(key)}
                  className={`text-left p-3 border rounded-lg transition-all flex flex-col gap-1.5 cursor-pointer bg-white ${
                    active ? 'border-[#C05621] ring-1 ring-[#C05621]' : 'border-[#E9E4D9] hover:border-neutral-400'
                  }`}
                >
                  <span className="text-xs font-semibold text-[#1A1A1A] flex items-center gap-1.5 justify-between w-full">
                    {presetThemes[key].name}
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-[#C05621]" />}
                  </span>
                  <div className="flex gap-1.5 items-center">
                    <span className="h-4 w-4 border border-zinc-200 rounded-sm" style={{ backgroundColor: presetThemes[key].bg }} />
                    <span className="h-4 w-4 border border-zinc-200 rounded-sm" style={{ backgroundColor: presetThemes[key].accent }} />
                    <span className="text-[10px] text-zinc-400 font-mono tracking-tight capitalize">{presetThemes[key].roundness} radii</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Styling Overrides */}
        <div className="border-t border-[#E9E4D9]/60 pt-6 flex flex-col gap-5">
          <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-800 flex items-center gap-1">
            <Sliders className="h-3 w-3 text-[#C05621]" /> Design System Tweaks
          </h4>

          {/* Color pickers */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[10px] text-neutral-500 block mb-1">Canvas BG</span>
              <div className="flex items-center gap-1 border border-[#E9E4D9] rounded bg-white p-1">
                <input
                  type="color"
                  value={settings.bgColor}
                  onChange={(e) => setSettings(prev => ({ ...prev, bgColor: e.target.value }))}
                  className="w-6 h-6 border-0 p-0 cursor-pointer rounded-sm"
                />
                <span className="text-[10px] font-mono text-zinc-500 uppercase">{settings.bgColor.substring(1, 5)}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-neutral-500 block mb-1">Accent Paint</span>
              <div className="flex items-center gap-1 border border-[#E9E4D9] rounded bg-white p-1">
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => setSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                  className="w-6 h-6 border-0 p-0 cursor-pointer rounded-sm"
                />
                <span className="text-[10px] font-mono text-zinc-500 uppercase">{settings.accentColor.substring(1, 5)}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-neutral-500 block mb-1">Corner Curves</span>
              <select
                value={settings.roundness}
                onChange={(e) => setSettings(prev => ({ ...prev, roundness: e.target.value as any }))}
                className="w-full text-[10px] font-mono border border-[#E9E4D9] rounded bg-white p-2 h-8 uppercase cursor-pointer"
              >
                <option value="none">None (0px)</option>
                <option value="md">Medium (8px)</option>
                <option value="full">High (24px)</option>
              </select>
            </div>
          </div>

          {/* Position Select */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-neutral-500 block">Simulated Viewport Insertion</span>
            <div className="grid grid-cols-2 gap-2">
              {(['bottom-right', 'center'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setSettings(prev => ({ ...prev, position: pos }))}
                  className={`py-1.5 px-3 text-[11px] font-mono uppercase bg-white border rounded-md transition-all cursor-pointer ${
                    settings.position === pos 
                      ? 'border-[#C05621] text-[#C05621] bg-[#C05621]/5' 
                      : 'border-[#E9E4D9] text-[#4A4A4A] hover:bg-neutral-50'
                  }`}
                >
                  {pos === 'bottom-right' ? '↗ Elegant Slide-in' : '⊙ Modal Overlord'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Re-Trigger */}
        <div className="mt-auto border-t border-[#E9E4D9]/60 pt-6">
          <button
            onClick={() => {
              setSimulatedTriggered(false);
              setTimeout(() => setSimulatedTriggered(true), 150);
            }}
            className="w-full h-11 border border-neutral-800 rounded bg-transparent hover:bg-neutral-800 hover:text-white transition-all text-xs font-mono tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Force Refresh Animation
          </button>
        </div>
      </div>

      {/* RIGHT: Live Visualizer or Code Inspector */}
      <div className="lg:col-span-7 bg-[#111111] p-8 flex flex-col gap-6 relative min-h-[500px]">
        
        {/* Toggle between Live Render and Gutenberg / Shopify schema code block */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('preview')}
              className={`pb-4 text-xs font-mono uppercase tracking-wider relative cursor-pointer ${
                activeTab === 'preview' ? 'text-white font-semibold' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Live Canvas Render
              {activeTab === 'preview' && (
                <div className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-[#C05621]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('shopify')}
              className={`pb-4 text-xs font-mono uppercase tracking-wider relative cursor-pointer ${
                activeTab === 'shopify' ? 'text-white font-semibold' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Shopify Schema JSON
              {activeTab === 'shopify' && (
                <div className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-emerald-500" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('wordpress')}
              className={`pb-4 text-xs font-mono uppercase tracking-wider relative cursor-pointer ${
                activeTab === 'wordpress' ? 'text-white font-semibold' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              WordPress Block HTML
              {activeTab === 'wordpress' && (
                <div className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-sky-500" />
              )}
            </button>
          </div>

          {/* Device toggle for Live Preview */}
          {activeTab === 'preview' && (
            <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 p-0.5 rounded-md">
              <button
                onClick={() => setDeviceMode('desktop')}
                className={`p-1.5 rounded transition-all cursor-pointer ${deviceMode === 'desktop' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
                title="Desktop View"
              >
                <Laptop className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDeviceMode('mobile')}
                className={`p-1.5 rounded transition-all cursor-pointer ${deviceMode === 'mobile' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
                title="Mobile Screen"
              >
                <Smartphone className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Tab Content Display */}
        <div className="flex-1 flex flex-col justify-between">
          
          {activeTab === 'preview' ? (
            /* LIVE CANVAS PREVIEW */
            <div className="relative w-full flex-1 flex items-center justify-center bg-neutral-950 rounded-xl overflow-hidden min-h-[380px] border border-neutral-900">
              
              {/* Backdrops representing an elegant background shopify store */}
              <div className="absolute inset-0 opacity-15 pointer-events-none p-6 text-neutral-400 font-sans selection:bg-transparent flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="font-serif italic font-bold">LUMIÈRE & SOUFRE</span>
                  <div className="flex gap-4 text-[9px] font-mono">
                    <span>COLLECTIONS</span>
                    <span>STUDIO JOURNAL</span>
                    <span>CART [0]</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="aspect-[4/5] bg-neutral-800 rounded flex flex-col justify-end p-2 gap-1 text-[8px] font-mono">
                    <span className="text-white">Linen Trench Coat</span>
                    <span>$340.00 USD</span>
                  </div>
                  <div className="aspect-[4/5] bg-neutral-800 rounded flex flex-col justify-end p-2 gap-1 text-[8px] font-mono">
                    <span className="text-white">Onyx Silk Scarf</span>
                    <span>$110.00 USD</span>
                  </div>
                </div>
              </div>

              {/* Status bar overlays simulating active user state */}
              <div className="absolute top-3 left-3 bg-neutral-900/80 border border-neutral-800/60 backdrop-blur-xs py-1 px-2.5 rounded text-[10px] font-mono text-[#C05621] flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500"></span>
                </span>
                <span>Viewport Simulated Trigger</span>
              </div>

              {/* THE SIMULATED POPUP LAYOUT CONTAINER */}
              <div className={`absolute inset-0 flex p-6 transition-all duration-300 ${
                deviceMode === 'mobile' ? 'max-w-xs mx-auto border-x border-dashed border-neutral-800 bg-neutral-950/80' : ''
              } ${
                settings.position === 'center' ? 'items-center justify-center bg-neutral-950/40 backdrop-blur-2xs' : 'items-end justify-end'
              }`}>
                
                <AnimatePresence>
                  {simulatedTriggered && (
                    <motion.div
                      initial={
                        settings.position === 'center'
                          ? { opacity: 0, scale: 0.95, y: 15 }
                          : { opacity: 0, y: 30, scale: 0.98 }
                      }
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                      style={{ 
                        backgroundColor: settings.bgColor, 
                        color: settings.textColor,
                        // Set border radius based on roundness setting
                        borderRadius: settings.roundness === 'none' ? '0px' : settings.roundness === 'md' ? '12px' : '32px'
                      }}
                      className="w-full max-w-[340px] p-6 shadow-2xl border border-neutral-100/10 flex flex-col gap-4 text-left z-20 relative overflow-hidden group"
                    >
                      {/* Premium Accent Corner Flare */}
                      <span className="absolute top-0 right-0 h-10 w-10 overflow-hidden pointer-events-none">
                        <span className="absolute top-[-25px] right-[-25px] bg-red-400 opacity-15 rotate-45 h-[50px] w-[50px]" style={{ backgroundColor: settings.accentColor }} />
                      </span>

                      {/* Header Row */}
                      <div className="flex items-center justify-between border-b/20 pb-2 border-neutral-500/20">
                        <span 
                          style={{ color: settings.accentColor }}
                          className="text-[9px] font-mono tracking-widest font-extrabold"
                        >
                          {currentContent.tag}
                        </span>
                        <button 
                          onClick={() => setSimulatedTriggered(false)}
                          className="text-neutral-400 hover:text-black opacity-60 hover:opacity-100 transition-opacity text-xs"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Main Copy typography */}
                      <div>
                        <h4 className={`text-base font-bold tracking-tight ${settings.themeStyle === 'warm-editorial' ? 'font-serif text-lg italic' : 'font-sans'}`}>
                          {currentContent.title}
                        </h4>
                        <p className="text-xs opacity-75 font-sans mt-2.5 leading-relaxed font-light">
                          {currentContent.body}
                        </p>
                      </div>

                      {/* Code coupon copy area (if selected) */}
                      {settings.popupType === 'coupon' && (
                        <div className="p-2 bg-neutral-500/10 border border-neutral-500/10 rounded font-mono text-center text-xs flex items-center justify-between gap-2 select-all">
                          <span className="font-bold opacity-90">{currentContent.discountCode}</span>
                          <span className="text-[9px] uppercase tracking-wider text-[#C05621] font-semibold">15% discount loaded</span>
                        </div>
                      )}

                      {/* Input fields / submission actions */}
                      {currentContent.inputPlaceholder && (
                        <input
                          type="text"
                          disabled
                          placeholder={currentContent.inputPlaceholder}
                          className="w-full h-9 rounded px-3 text-xs bg-neutral-500/5 border border-neutral-500/15 focus:outline-hidden disabled:opacity-50"
                        />
                      )}

                      {/* CTA Conversion Button */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        style={{ 
                          backgroundColor: settings.accentColor,
                          color: '#FFFFFF',
                          borderRadius: settings.roundness === 'none' ? '0px' : settings.roundness === 'md' ? '6px' : '24px'
                        }}
                        className="w-full h-10 font-sans font-semibold text-xs tracking-wide shadow-md transition-colors hover:opacity-90 flex items-center justify-center gap-1.5"
                      >
                        {currentContent.cta}
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Simulated Overlay Trigger message when closed */}
                {!simulatedTriggered && (
                  <div className="absolute inset-x-0 bottom-6 text-center text-xs text-neutral-500 font-sans select-none animate-pulse">
                    <span>Popup closed. Feel free to click <span className="text-white hover:underline cursor-pointer" onClick={() => setSimulatedTriggered(true)}>here</span> to re-trigger.</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* CODE EXPORT TABS */
            <div className="flex-1 flex flex-col justify-start bg-neutral-950 rounded-xl p-5 border border-neutral-900 min-h-[380px]">
              <div className="flex items-center justify-between text-neutral-400 text-xs mb-3 font-mono">
                <span>
                  {activeTab === 'shopify' ? 'Shopify Theme Customizer settings schema' : 'WordPress block code representation'}
                </span>
                <button
                  onClick={() => copyCode(activeTab === 'shopify' ? shopifySchema : wordpressConfig)}
                  className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 rounded border border-neutral-800 text-[11px] font-medium flex items-center gap-1.5 text-white active:scale-95 transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Clipboard className="h-3.5 w-3.5" /> Copy Code
                    </>
                  )}
                </button>
              </div>

              <pre className="flex-1 p-4 bg-black/50 overflow-auto rounded border border-neutral-900 text-[11px] font-mono text-zinc-300 leading-relaxed max-h-[300px]">
                <code>{activeTab === 'shopify' ? shopifySchema : wordpressConfig}</code>
              </pre>

              <div className="mt-4 p-3 bg-[#C05621]/10 rounded border border-[#C05621]/20 flex items-start gap-3">
                <Code2 className="h-5 w-5 text-[#C05621] flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-white font-medium">Recreatable Design Token Systems</p>
                  <p className="text-zinc-400 font-light mt-0.5 leading-normal">
                    This JSON blueprint directly represents settings keys in Shopify Schema or block properties in Gutenberg/Elementor. It ensures design consistency between coding platforms.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Core Feature Checklist footer of simulator */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-neutral-800 text-[10px] font-mono text-neutral-400 mt-4">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>0% Layout Shift</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Scroll-Reactive Logic</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C05621]" />
              <span>Shopify Schema Ready</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span>WordPress Block Ready</span>
            </div>
          </div>
          
        </div>
      </div>

    </div>
  );
}
