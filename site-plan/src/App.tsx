import { useState, useEffect, FormEvent } from 'react';
import { ActivePage, PopupTemplate } from './types';
import Header from './components/Header';
import Footer from './components/Footer';
import HomeView from './components/HomeView';
import TemplatesView from './components/TemplatesView';
import PricingView from './components/PricingView';
import WordPressShopifyGuide from './components/WordPressShopifyGuide';
import ContactView from './components/ContactView';
import LegalView from './components/LegalView';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Check, Mail, ShoppingBag } from 'lucide-react';

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('home');
  
  // Custom states to inject from templates sandbox
  const [selectedTemplateSettings, setSelectedTemplateSettings] = useState<any>(null);

  // Global overlay demo trigger
  const [globalOverlay, setGlobalOverlay] = useState<'newsletter' | 'coupon' | 'slide-in' | null>(null);
  const [overlayConfig, setOverlayConfig] = useState<any>({
    title: 'Acquisition layer active',
    subtitle: 'Beautiful, high-conversion section designed to blend naturally with high-end typography.',
    cta: 'Claim Benefits Now',
    bgColor: '#FAF9F5',
    textColor: '#1A1A1A',
    accentColor: '#C05621',
    roundness: 'md',
    themeStyle: 'warm-editorial'
  });

  const [overlayInput, setOverlayInput] = useState('');
  const [overlayConverted, setOverlayConverted] = useState(false);

  // Automatically scroll to top on page switches for standard browser routing parity
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as any });
  }, [activePage]);

  const handleTriggerGlobalOverlay = (type: 'newsletter' | 'coupon' | 'slide-in', forceStyle?: any) => {
    setGlobalOverlay(type);
    setOverlayConverted(false);
    setOverlayInput('');
    
    if (forceStyle) {
      setOverlayConfig({
        title: forceStyle.title,
        subtitle: forceStyle.subtitle,
        cta: forceStyle.ctaText,
        bgColor: forceStyle.themeStyle === 'tech-mono' ? '#0F172A' : forceStyle.themeStyle === 'luxury-bold' ? '#111111' : '#FAF9F5',
        textColor: forceStyle.themeStyle === 'tech-mono' ? '#F8FAFC' : forceStyle.themeStyle === 'luxury-bold' ? '#F5F5F5' : '#1A1A1A',
        accentColor: forceStyle.themeStyle === 'tech-mono' ? '#38BDF8' : forceStyle.themeStyle === 'luxury-bold' ? '#D4AF37' : '#C05621',
        roundness: forceStyle.themeStyle === 'minimalist' || forceStyle.themeStyle === 'tech-mono' ? 'none' : 'md',
        themeStyle: forceStyle.themeStyle,
        badge: forceStyle.badge,
        discountCode: forceStyle.discountCode
      });
    } else {
      // Default configurations
      if (type === 'newsletter') {
        setOverlayConfig({
          title: 'Join the curations library',
          subtitle: 'Subscribe to receive seasonal design tips, boutique templates, and headless performance audits twice monthly.',
          cta: 'Subscribe Journal',
          bgColor: '#FAF9F5',
          textColor: '#1A1A1A',
          accentColor: '#C05621',
          roundness: 'md',
          themeStyle: 'warm-editorial'
        });
      } else if (type === 'coupon') {
        setOverlayConfig({
          title: 'Unlock Acquire Boost',
          subtitle: 'Unlocking 15% off first-batch template license folders, applicable systematically. Zero layout shifts guaranteed.',
          cta: 'Claim Special Code',
          bgColor: '#111111',
          textColor: '#F5F5F5',
          accentColor: '#D4AF37',
          roundness: 'full',
          themeStyle: 'luxury-bold',
          discountCode: 'ACQUIRE15'
        });
      } else {
        setOverlayConfig({
          title: 'Restore Custom Cart',
          subtitle: 'Your boutique theme customizer folder config values are saved. Dispatch custom templates now.',
          cta: 'Secure Files Transfer',
          bgColor: '#FFFFFF',
          textColor: '#111111',
          accentColor: '#1A1A1A',
          roundness: 'none',
          themeStyle: 'minimalist'
        });
      }
    }
  };

  const handleOverlaySubmit = (e: FormEvent) => {
    e.preventDefault();
    setOverlayConverted(true);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#111111] selection:bg-black selection:text-white flex flex-col overflow-x-hidden antialiased relative">
      
      {/* Editorial Sophisticated Light ambient background glows */}
      <div className="hero-glow z-0" />
      <div className="hero-glow-left z-0" />
      
      {/* Editorial Header */}
      <Header 
        activePage={activePage} 
        onPageChange={setActivePage} 
        onTriggerDemoPopup={(style) => handleTriggerGlobalOverlay(style)} 
      />

      {/* Main Dynamic View Contaminent Container */}
      <main className="flex-grow">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {activePage === 'home' && (
              <HomeView 
                onPageChange={setActivePage} 
                onTriggerDemoPopup={(style) => handleTriggerGlobalOverlay(style)} 
                selectedTemplateSettings={selectedTemplateSettings}
              />
            )}
            {activePage === 'templates' && (
              <TemplatesView />
            )}
            {activePage === 'pricing' && (
              <PricingView />
            )}
            {activePage === 'integration-guide' && (
              <WordPressShopifyGuide />
            )}
            {activePage === 'contact' && (
              <ContactView />
            )}
            {activePage === 'privacy-policy' && (
              <LegalView page="privacy-policy" onPageChange={setActivePage} />
            )}
            {activePage === 'terms' && (
              <LegalView page="terms" onPageChange={setActivePage} />
            )}
            {activePage === 'security' && (
              <LegalView page="security" onPageChange={setActivePage} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Anchor point utilized by template deep links */}
      <div id="scrollpop-simulator-anchor" className="h-1" />

      {/* Corporate Luxury Footer */}
      <Footer 
        onPageChange={setActivePage} 
        onTriggerDemoPopup={(style) => handleTriggerGlobalOverlay(style)} 
      />

      {/* ========================================================= */}
      {/* GLOBAL SCROLLPOP LIVE TEST RUN INTERACTION LAYER           */}
      {/* ========================================================= */}
      <AnimatePresence>
        {globalOverlay && (
          <div className="fixed inset-0 z-100 flex items-end justify-end p-6 md:p-8 pointer-events-none">
            
            {/* Ambient overlay blur representing backdrop visual blockages */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGlobalOverlay(null)}
              className="absolute inset-0 bg-neutral-950/25 backdrop-blur-3xs pointer-events-auto"
            />

            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 240, damping: 25 }}
              style={{
                backgroundColor: overlayConfig.bgColor,
                color: overlayConfig.textColor,
                borderRadius: overlayConfig.roundness === 'none' ? '0px' : overlayConfig.roundness === 'md' ? '12px' : '40px'
              }}
              className="w-full max-w-sm p-6 shadow-2xl border border-white/10 flex flex-col gap-5 text-left relative z-110 pointer-events-auto group max-h-[85vh] overflow-y-auto"
            >
              {/* Premium Corner Highlight */}
              <span className="absolute top-0 right-0 h-12 w-12 overflow-hidden pointer-events-none">
                <span className="absolute top-[-30px] right-[-30px] opacity-20 rotate-45 h-[60px] w-[60px]" style={{ backgroundColor: overlayConfig.accentColor }} />
              </span>

              {/* Popup Meta strip */}
              <div className="flex items-center justify-between border-b border-neutral-500/10 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span style={{ color: overlayConfig.accentColor }} className="text-[9px] font-mono tracking-widest font-extrabold uppercase">
                    {overlayConfig.badge || 'LIVE POPUP DEMO ACTIVE'}
                  </span>
                </div>
                <button
                  onClick={() => setGlobalOverlay(null)}
                  className="p-1 rounded-full hover:bg-neutral-500/10 text-neutral-400 hover:text-inherit transition-all text-sm cursor-pointer"
                  aria-label="Dismiss custom layer preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Main Typography Layer */}
              <AnimatePresence mode="wait">
                {!overlayConverted ? (
                  <motion.div
                    key="input-stage"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-4"
                  >
                    <div>
                      <h4 className={`text-lg font-bold tracking-tight ${overlayConfig.themeStyle === 'warm-editorial' ? 'font-serif italic' : overlayConfig.themeStyle === 'tech-mono' ? 'font-mono' : 'font-sans'}`}>
                        {overlayConfig.title}
                      </h4>
                      <p className="text-xs opacity-80 mt-2 font-sans font-light leading-relaxed">
                        {overlayConfig.subtitle}
                      </p>
                    </div>

                    {/* Promo-code block representation */}
                    {globalOverlay === 'coupon' && (
                      <div className="p-2.5 bg-neutral-500/10 border border-neutral-500/15 rounded flex items-center justify-between font-mono text-xs text-neutral-300">
                        <span className="font-bold tracking-widest">{overlayConfig.discountCode || 'OFFER15'}</span>
                        <span className="text-[9px] text-yellow-500 uppercase font-semibold">Ready at checkout</span>
                      </div>
                    )}

                    {/* Interactive Input Form */}
                    <form onSubmit={handleOverlaySubmit} className="flex flex-col gap-3">
                      <div className="relative">
                        <input
                          required
                          type="email"
                          placeholder="e.g. curator@merchant.com"
                          value={overlayInput}
                          onChange={(e) => setOverlayInput(e.target.value)}
                          className="w-full text-xs h-9 pl-3 pr-2 rounded bg-neutral-500/10 border border-neutral-500/20 focus:outline-hidden text-inherit placeholder:opacity-50"
                        />
                      </div>
                      
                      <button
                        type="submit"
                        style={{
                          backgroundColor: overlayConfig.accentColor,
                          color: '#FFFFFF'
                        }}
                        className="h-10 text-xs font-sans font-bold tracking-wide transition-opacity hover:opacity-95 shadow-md flex items-center justify-center gap-1.5 uppercase cursor-pointer"
                      >
                        <span>{overlayConfig.cta}</span>
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success-stage"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-6 flex flex-col items-center justify-center gap-4"
                  >
                    <div className="h-10 w-10 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-neutral-100" style={{ color: overlayConfig.textColor }}>Acquisition Successful</h4>
                      <p className="text-xs mt-1.5 opacity-75 font-light leading-relaxed max-w-sm">
                        Thank you for registering. This simulated subscription recorded {overlayInput} safely and closed the conversion loops seamlessly on the frontend level.
                      </p>
                    </div>
                    <button
                      onClick={() => setGlobalOverlay(null)}
                      className="mt-2 text-[10px] font-mono tracking-widest uppercase hover:underline opacity-60 cursor-pointer"
                    >
                      Dismiss Preview Overlay
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Non-intrusive status footer */}
              <div className="text-[8px] font-mono opacity-50 text-center border-t border-neutral-500/5 pt-2 flex items-center justify-center gap-3">
                <span>0ms layout shifts</span>
                <span>•</span>
                <span>Self-hosted cookie first</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
