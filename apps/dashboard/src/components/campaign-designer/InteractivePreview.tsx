import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  User, 
  Search, 
  Menu, 
  ArrowLeft, 
  Sparkles, 
  Clock, 
  Heart, 
  Check, 
  Copy, 
  CornerDownRight, 
  MousePointerClick,
  MonitorOff,
  Star,
  QrCode
} from 'lucide-react';
import { Campaign, CampaignStepConfig, CampaignElement } from './types';

interface InteractivePreviewProps {
  campaign: Campaign;
  onClose: () => void;
  onRecordConversion: () => void;
}

// ── Animation helpers (CSS keyframes, no framer-motion needed) ────────────

const PREVIEW_KEYFRAMES = `
@keyframes sp-fade-in       { from { opacity:0 }                             to { opacity:1 } }
@keyframes sp-scale-up      { from { opacity:0; transform:scale(0.75) }      to { opacity:1; transform:scale(1) } }
@keyframes sp-slide-up      { from { opacity:0; transform:translateY(60px) } to { opacity:1; transform:translateY(0) } }
@keyframes sp-slide-down    { from { opacity:0; transform:translateY(-60px)}  to { opacity:1; transform:translateY(0) } }
@keyframes sp-bounce        { 0%{opacity:0;transform:scale(0.3)} 55%{transform:scale(1.08)} 75%{transform:scale(0.95)} 100%{opacity:1;transform:scale(1)} }
@keyframes sp-el-fade       { from { opacity:0 }                             to { opacity:1 } }
@keyframes sp-el-slide      { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
@keyframes sp-el-zoom       { from { opacity:0; transform:scale(0.6) }       to { opacity:1; transform:scale(1) } }
@keyframes sp-el-bounce     { 0%{opacity:0;transform:scale(0.3)} 60%{transform:scale(1.1)} 80%{transform:scale(0.95)} 100%{opacity:1;transform:scale(1)} }
@keyframes sp-el-spin       { from { opacity:0; transform:rotate(-180deg) scale(0.5) } to { opacity:1; transform:rotate(0deg) scale(1) } }
@keyframes sp-el-flip       { from { opacity:0; transform:rotateY(90deg) }   to { opacity:1; transform:rotateY(0deg) } }
`;

function entranceStyle(anim: string): React.CSSProperties {
  const map: Record<string, string> = {
    'scale-up':   'sp-scale-up 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
    'fade-in':    'sp-fade-in  0.4s ease both',
    'slide-up':   'sp-slide-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
    'slide-down': 'sp-slide-down 0.4s cubic-bezier(0.22,1,0.36,1) both',
    'bounce':     'sp-bounce   0.6s cubic-bezier(0.34,1.56,0.64,1) both',
  };
  return map[anim] ? { animation: map[anim] } : {};
}

/** Map campaign position + popupType → flex alignment CSS classes for the backdrop */
function backdropClasses(position: string, popupType: string): string {
  if (popupType === 'fullscreen') return 'items-center justify-center p-0';
  if (popupType === 'stickybar') {
    return position === 'bottom' ? 'items-end justify-stretch p-0' : 'items-start justify-stretch p-0';
  }
  const map: Record<string, string> = {
    'center':       'items-center justify-center p-4',
    'top':          'items-start justify-center p-4',
    'bottom':       'items-end   justify-center p-4',
    'top-left':     'items-start justify-start  p-4',
    'top-right':    'items-start justify-end    p-4',
    'bottom-left':  'items-end   justify-start  p-4',
    'bottom-right': 'items-end   justify-end    p-4',
    'left':         'items-center justify-start  p-4',
    'right':        'items-center justify-end    p-4',
  };
  return map[position] ?? 'items-center justify-center p-4';
}

/** Map popupType → overlay opacity (stickybar / slidein show store behind) */
function backdropOverlay(popupType: string): string {
  if (['stickybar', 'floating', 'slidein'].includes(popupType)) return 'rgba(0,0,0,0)';
  if (popupType === 'fullscreen') return 'rgba(0,0,0,0)';
  return 'rgba(0,0,0,0.55)';
}

function elementAnimStyle(type: string | undefined, delay: number = 0, duration: number = 0.5): React.CSSProperties {
  if (!type || type === 'none') return {};
  const map: Record<string, string> = {
    'fade-in':  'sp-el-fade',
    'slide-in': 'sp-el-slide',
    'zoom-in':  'sp-el-zoom',
    'bounce':   'sp-el-bounce',
    'spin':     'sp-el-spin',
    'flip':     'sp-el-flip',
  };
  const name = map[type];
  if (!name) return {};
  return { animation: `${name} ${duration}s ease ${delay}s both` };
}

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  rating: number;
  category: string;
  image: string;
}

const STORE_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Nourishing Botanical Cream 100ml',
    price: 36,
    originalPrice: 48,
    rating: 4.8,
    category: 'Skincare',
    image: 'https://images.pexels.com/photos/3685530/pexels-photo-3685530.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
  },
  {
    id: 'p2',
    name: 'Radiance Glow Seed Oil 30ml',
    price: 42,
    originalPrice: 60,
    rating: 4.9,
    category: 'Serums',
    image: 'https://images.pexels.com/photos/4465124/pexels-photo-4465124.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
  },
  {
    id: 'p3',
    name: 'French Clay Exfoliating Scrub',
    price: 24,
    originalPrice: 32,
    rating: 4.7,
    category: 'Masks',
    image: 'https://images.pexels.com/photos/6621374/pexels-photo-6621374.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
  },
  {
    id: 'p4',
    name: 'Soothing Lavender Sleep Spray',
    price: 18,
    originalPrice: 24,
    rating: 4.9,
    category: 'Aromatherapy',
    image: 'https://images.pexels.com/photos/4041392/pexels-photo-4041392.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
  }
];

export default function InteractivePreview({
  campaign,
  onClose,
  onRecordConversion,
}: InteractivePreviewProps) {
  // Store Simulation State
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [couponCode, setCouponCode] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<string>('');
  const [checkoutStep, setCheckoutStep] = useState<'shopping' | 'checkout' | 'thankyou'>('shopping');
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Campaign Trigger Engine Simulation State
  const [showTeaser, setShowTeaser] = useState(true);
  const [showMainCampaign, setShowMainCampaign] = useState(false);
  const [campaignStep, setCampaignStep] = useState<'main' | 'success'>('main');
  const [viewerInputs, setViewerInputs] = useState<Record<string, string>>({});
  const [spinnerDegrees, setSpinnerDegrees] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<string>('');
  const [scrollDepth, setScrollDepth] = useState(0);

  // Affiliate link / tab-redirect state
  const [adWindow, setAdWindow] = useState<Window | null>(null);
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  
  const shopPageRef = useRef<HTMLDivElement>(null);

  // Trigger Tickers
  const [countdownTimer, setCountdownTimer] = useState(599);

  // Handle countdown ticker tick
  useEffect(() => {
    let interval = setInterval(() => {
      setCountdownTimer((prev) => {
        if (prev <= 1) return 599;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format countdown string
  const getFormattedTimer = () => {
    const mins = Math.floor(countdownTimer / 60);
    const secs = countdownTimer % 60;
    return `${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}`;
  };

  // Poll the opened ad window — auto-dismiss popup once user closes the tab
  useEffect(() => {
    if (!adWindow) return;
    const interval = setInterval(() => {
      if (adWindow.closed) {
        clearInterval(interval);
        setAdWindow(null);
        setAwaitingReturn(false);
        setShowMainCampaign(false);
        setShowTeaser(true);
        showToast('✅ Ad tab closed — popup dismissed');
      }
    }, 500);
    return () => clearInterval(interval);
  }, [adWindow]);

  // Fallback: visibilitychange — when user tabs back after opening ad
  useEffect(() => {
    if (!awaitingReturn) return;
    const handler = () => {
      if (document.visibilityState === 'visible') {
        // Give the poll effect a moment to detect window.closed first
        setTimeout(() => {
          if (awaitingReturn) {
            // If still waiting (poll didn't fire yet), allow manual dismiss
            setAwaitingReturn(false);
          }
        }, 600);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [awaitingReturn]);

  // Resolve the affiliate href for a given step config (first button or close element with href)
  const getStepAffiliate = (stepConfig: any): string => {
    for (const el of stepConfig.elements as any[]) {
      const link = el.href || el.extraProps?.href;
      if (link && link.length > 4 && !link.includes('YOUR_')) return link;
    }
    return '';
  };

  // Open affiliate link in new tab — first call arms the dismiss gate, second dismisses
  const handleAffiliateDismiss = (stepConfig: any) => {
    const href = getStepAffiliate(stepConfig);
    if (!href) {
      // No affiliate link — just close normally
      setShowMainCampaign(false);
      setShowTeaser(true);
      showToast('❌ Popup dismissed');
      return;
    }
    if (!awaitingReturn) {
      // First click: open ad, lock popup until tab is closed
      const win = window.open(href, '_blank', 'noopener');
      setAdWindow(win);
      setAwaitingReturn(true);
      showToast('🛒 Ad opened — close that tab to dismiss this popup');
    } else {
      // Already redirected — user manually clicked again (fallback)
      setAwaitingReturn(false);
      setAdWindow(null);
      setShowMainCampaign(false);
      setShowTeaser(true);
    }
  };

  // Monitor simulated scrolling inside store frame
  const handleStoreScroll = (e: any) => {
    const target = e.currentTarget;
    const scrollPct = Math.round(
      (target.scrollTop / (target.scrollHeight - target.clientHeight)) * 100
    );
    setScrollDepth(scrollPct);

    // Scroll trigger validation
    if (
      campaign.triggers.scrollPercent > 0 && 
      scrollPct >= campaign.triggers.scrollPercent && 
      !showMainCampaign && 
      campaignStep === 'main'
    ) {
      triggerMainPopup('Scroll Trigger depth met!');
    }
  };

  // Time delay simulation trigger
  useEffect(() => {
    if (campaign.triggers.timeDelaySeconds > 0) {
      const timer = setTimeout(() => {
        if (!showMainCampaign && campaignStep === 'main') {
          triggerMainPopup('Time delay of ' + campaign.triggers.timeDelaySeconds + 's met!');
        }
      }, campaign.triggers.timeDelaySeconds * 1000);
      return () => clearTimeout(timer);
    } else {
      // Instant triggering
      triggerMainPopup('Instant trigger');
    }
  }, []);

  const triggerMainPopup = (reason?: string) => {
    setShowMainCampaign(true);
    setShowTeaser(false);
    showToast(`🔔 Campaign Triggered: ${reason || 'Trigger Activated'}`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Simulate Add item to basket
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    showToast(`👜 Added ${product.name} to checkout bag!`);
  };

  const getSubtotal = () => {
    return cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  };

  const getDiscountAmount = () => {
    if (!appliedCoupon) return 0;
    
    // Check various coupon formats
    const cleaned = appliedCoupon.toUpperCase().trim();
    if (cleaned.includes('15') || cleaned.includes('MOCHI') || cleaned.includes('ATELIER')) {
      return getSubtotal() * 0.15;
    }
    if (cleaned.includes('20') || cleaned.includes('GLOW')) {
      return getSubtotal() * 0.20;
    }
    if (cleaned.includes('30') || cleaned.includes('FLASH')) {
      return getSubtotal() * 0.30;
    }
    if (cleaned.includes('50') || cleaned.includes('LUCKY')) {
      return getSubtotal() * 0.50;
    }
    if (cleaned.includes('AURELIA')) {
      return Math.min(getSubtotal(), 100);
    }
    return 0; // Default flat fallback
  };

  // Copy success code to clipboard
  const handleCopyCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setCouponCode(codeText);
    showToast(`📋 Copied code "${codeText}" to simulated checkout clipboard!`);
    setTimeout(() => setCopied(false), 2000);
  };

  // Engage Submit Sign up newsletter Form / Spin Wheel Raffle
  const handleCampaignSubmit = (stepConfig: any) => {
    // Record user conversion click
    onRecordConversion();

    // Check if it's spinwheel campaign
    const isWheel = stepConfig.elements.some((e: any) => e.content === 'wheel');

    if (isWheel) {
      if (isSpinning) return;
      setIsSpinning(true);
      showToast('🎡 Spinning the Lucky Wheel... good luck!');
      
      // Rotate 3-5 full rounds + random slice
      const randomSegments = ['50% Off!', 'Free Gift Set', 'Try Again', '20% Off', '10% Off', 'Free Ship', '100$ Voucher'];
      const randomIndex = Math.floor(Math.random() * randomSegments.length);
      const degreePerSegment = 360 / randomSegments.length;
      const targetDegree = 360 * 4 + (randomIndex * degreePerSegment);

      setSpinnerDegrees(targetDegree);

      setTimeout(() => {
        setIsSpinning(false);
        const resolvedPrize = randomSegments[randomIndex];
        setWonPrize(resolvedPrize || '');
        showToast(`🎉 Congrats! You won: ${resolvedPrize}!`);
        // Move to success congratulations screen
        setTimeout(() => {
          setCampaignStep('success');
        }, 1200);
      }, 3200);

    } else {
      // Direct success screen transition
      setCampaignStep('success');
      showToast('💌 Subscription Confirmed! Discount Code Activated.');
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs z-50 flex flex-col md:flex-row items-center justify-center p-3 md:p-6 overflow-hidden">
      <style>{PREVIEW_KEYFRAMES}</style>
      
      {/* 1. LEFT UTILITY COLUMN: Dashboard conversion stats */}
      <div className="w-full md:w-[320px] shrink-0 bg-zinc-900 text-white rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none p-5 flex flex-col justify-between border border-zinc-800 h-[220px] md:h-[650px] overflow-y-auto">
        <div>
          <button 
            onClick={onClose}
            className="mb-4 text-xs font-mono text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 p-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] uppercase font-bold tracking-wider max-w-fit cursor-pointer border border-zinc-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Canva
          </button>
          
          <div className="space-y-1">
            <span className="text-[9px] bg-white font-extrabold text-[#09090b] px-2 py-0.5 rounded-sm uppercase tracking-widest font-mono">
              Sandbox Env
            </span>
            <h3 className="text-xs font-bold font-mono tracking-wider mt-3 text-zinc-100 uppercase">CAMPAIGN LIVE INSIGHTS</h3>
            <p className="text-[11px] text-zinc-400 leading-normal">
              Test coupon codes, exit intents, newsletter signups, and customer scroll behaviors in safe preview mode.
            </p>
          </div>

          {/* Real scroll and interaction metrics */}
          <div className="mt-5 space-y-3">
            <div className="p-3 bg-[#09090b]/50 rounded border border-zinc-800 space-y-1">
              <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider block">Customer View Scroll</span>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-300">Scroll Depth:</span>
                <span className="text-xs font-bold font-mono text-white">{scrollDepth}%</span>
              </div>
              <div className="w-full bg-zinc-805 bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1">
                <div className="bg-white h-full transition-all duration-150" style={{ width: `${scrollDepth}%` }} />
              </div>
            </div>

            <div className="p-3 bg-[#09090b]/50 rounded border border-zinc-800 space-y-1">
              <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider block">Campaign Triggers</span>
              <div className="flex flex-col gap-1 text-[11px] font-mono text-zinc-400">
                <div className="flex justify-between">
                  <span>Exit Intent:</span>
                  <span className={campaign.triggers.exitIntent ? 'text-white font-bold' : 'text-zinc-600'}>
                    {campaign.triggers.exitIntent ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Scroll Target:</span>
                  <span className="text-white font-bold">{campaign.triggers.scrollPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Time Delay:</span>
                  <span className="text-white font-bold">{campaign.triggers.timeDelaySeconds}s</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic developer helper CTA */}
        <div className="mt-4 p-3 bg-zinc-950/60 rounded border border-zinc-800 text-zinc-450 text-xs">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-300 font-mono block mb-1">💡 EXIT INTENT TEST</span>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            Forced evaluation of closing intent behavior. Click the action button below to trigger popup overlay immediately:
          </p>
          <button 
            onClick={() => triggerMainPopup('Simulated Exit Intent Trigger Click')}
            className="w-full py-2 bg-white hover:bg-zinc-200 text-black font-semibold rounded text-xs mt-3.5 cursor-pointer font-mono tracking-wide transition-colors"
          >
            FORCE EXIT TRIGGER
          </button>
        </div>
      </div>

      {/* 2. MAIN MIDDLE FRAME: Simulated Custom Apothecary Shopfront */}
      <div className="flex-1 flex flex-col bg-white rounded-b-2xl md:rounded-r-2xl border border-slate-200 h-[480px] md:h-[650px] overflow-hidden relative">
        
        {/* Real-time Toast messages overlay */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 p-3 bg-slate-900 text-white font-semibold text-xs rounded-xl shadow-xl border border-slate-700/50 z-[1000] flex items-center gap-2 max-w-md animate-bounce">
            <Sparkles className="h-4 w-4 text-amber-400 fill-amber-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Mock Store Header */}
        <div className="h-14 w-full border-b border-gray-100 bg-[#FCFBF7] px-4 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-2">
            <Menu className="h-4 w-4 text-gray-500" />
            <h1 className="font-serif text-lg font-light tracking-widest text-slate-900">L U M I N A</h1>
          </div>
          
          <div className="flex items-center gap-4 text-gray-600">
            <Search className="h-4 w-4" />
            <User className="h-4 w-4" />
            
            {/* Basket Button */}
            <button 
              onClick={() => setCheckoutStep(checkoutStep === 'checkout' ? 'shopping' : 'checkout')}
              className="relative p-2 hover:bg-gray-100 rounded-full cursor-pointer transition-colors shrink-0"
            >
              <ShoppingBag className="h-4 w-4 text-zinc-800" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-zinc-900 text-white text-[9px] font-mono leading-none rounded-full h-4 w-4 flex items-center justify-center font-bold">
                  {cart.reduce((s,i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Store Catalog Layout */}
        <div 
          ref={shopPageRef}
          onScroll={handleStoreScroll}
          className="flex-1 overflow-y-auto bg-[#FAF9F5] p-5 pb-20 relative scroll-smooth scrollbar-thin"
        >
          {checkoutStep === 'shopping' && (
            <div className="space-y-8 max-w-3xl mx-auto">
              
              {/* Promo Banner block */}
              <div className="bg-[#EFECE5] rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden">
                <div className="space-y-2 text-left">
                  <span className="text-[9px] font-bold text-[#A78B79] tracking-widest block uppercase">Organic Apothecary Series</span>
                  <h2 className="text-3xl font-serif text-slate-900 font-light leading-tight">Reveal Botanical Glow Secrets</h2>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Premium small-batch formulations crafted with 100% cold-pressed organic botanicals and zero synthetic stabilizers.
                  </p>
                </div>
                <img
                  src="https://images.pexels.com/photos/3762875/pexels-photo-3762875.jpeg?auto=compress&cs=tinysrgb&w=280&h=280&fit=crop"
                  alt="Apothecary jar"
                  className="h-28 w-28 object-cover rounded-2xl transform rotate-3 hover:rotate-0 transition-transform"
                />
              </div>

              {/* Grid Catalog */}
              <div className="space-y-3 text-left">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Core Apothecary Catalog</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {STORE_PRODUCTS.map((prod) => (
                    <div 
                      key={prod.id} 
                      className="bg-white border border-[#EDECE6] rounded-2xl p-3 flex flex-col justify-between group"
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-gray-50">
                        <img 
                          src={prod.image} 
                          alt={prod.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <button className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-700 shadow-sm transition-colors cursor-pointer">
                          <Heart className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-3 flex flex-col gap-1.5">
                        <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-1">{prod.name}</h4>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-slate-900">${prod.price}.00</span>
                            <span className="text-[10px] text-gray-400 line-through">${prod.originalPrice}.00</span>
                          </div>
                          
                          <button
                            onClick={() => addToCart(prod)}
                            className="bg-zinc-900 text-white rounded py-1 px-3 text-[10px] font-mono tracking-wide uppercase hover:bg-black transition-colors cursor-pointer"
                          >
                            Add to Bag
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom scroll reminder visual */}
              <div className="py-2 text-center text-xs text-gray-400 italic">
                Scroll further down to trigger the scroll-percentage campaign Popup!
              </div>

            </div>
          )}

          {checkoutStep === 'checkout' && (
            <div className="max-w-2xl mx-auto bg-white border border-[#EDECE6] rounded-2xl p-6 text-left shadow-xs">
              <h3 className="font-serif text-xl font-light text-slate-900 pb-3 border-b border-gray-100 flex items-center justify-between">
                <span>Secure Cart Checkout</span>
                <button 
                  onClick={() => setCheckoutStep('shopping')}
                  className="text-xs font-bold text-gray-500 hover:text-black cursor-pointer"
                >
                  Continue Browsing
                </button>
              </h3>

              {cart.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="text-xs text-gray-400 block mb-2">Checkout bag is empty.</span>
                  <button 
                    onClick={() => setCheckoutStep('shopping')}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
                  >
                    Browse Organic Catalog
                  </button>
                </div>
              ) : (
                <div className="space-y-4 mt-4">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex gap-3 justify-between items-center pb-3 border-b border-gray-50">
                      <img src={item.product.image} className="h-12 w-12 rounded-lg object-cover" />
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-slate-900">{item.product.name}</h4>
                        <span className="text-[11px] text-gray-400">Qty: {item.quantity}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900">${item.product.price * item.quantity}.00</span>
                    </div>
                  ))}

                  {/* Coupon entry slot */}
                  <div className="pt-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Apply campaign promocode</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="ENTER DISCOUNTO..."
                        className="flex-1 p-2 border border-gray-200 rounded-lg text-xs font-bold uppercase"
                      />
                      <button 
                        onClick={() => {
                          setAppliedCoupon(couponCode);
                          showToast(`🎟 Coupon "${couponCode}" applied successfully!`);
                        }}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs shrink-0 cursor-pointer"
                      >
                        Apply Code
                      </button>
                    </div>
                  </div>

                  {/* Sizing calculations */}
                  <div className="space-y-2 pt-4 border-t border-gray-100 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Bag Subtotal:</span>
                      <span>${getSubtotal().toFixed(2)}</span>
                    </div>
                    {getDiscountAmount() > 0 && (
                      <div className="flex justify-between text-emerald-600 font-semibold">
                        <span>Campaign Discount:</span>
                        <span>-${getDiscountAmount().toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-500">
                      <span>Shipping:</span>
                      <span>{appliedCoupon.toUpperCase().includes('SHIP50') ? 'FREE (DHL)' : '$4.99'}</span>
                    </div>
                    <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-gray-50">
                      <span>Order Total:</span>
                      <span>${Math.max(0, getSubtotal() - getDiscountAmount() + (appliedCoupon.toUpperCase().includes('SHIP50') ? 0 : 4.99)).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Simulated checkout proceed */}
                  <button 
                    onClick={() => {
                      setCart([]);
                      setAppliedCoupon('');
                      setCouponCode('');
                      setCheckoutStep('thankyou');
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold select-none cursor-pointer transition-colors text-center shadow-xs block"
                  >
                    Place Secure Order Checkout
                  </button>
                </div>
              )}
            </div>
          )}

          {checkoutStep === 'thankyou' && (
            <div className="max-w-md mx-auto py-16 text-center space-y-4">
              <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Check className="h-6 w-6" />
              </div>
              <h3 className="font-serif text-2xl text-slate-900 font-light">Order Completed Successfully!</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Thank you! Your simulated boutique transaction processed successfully capturing campaign conversion telemetry!
              </p>
              <button 
                onClick={() => setCheckoutStep('shopping')}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold leading-normal cursor-pointer"
              >
                Go Back Shopfront
              </button>
            </div>
          )}

          {/* 3. SIMULATED ACTIVE CAMPAED FLOATS (Stickybar / Teasers) */}
          {showTeaser && campaign.steps.teaser.elements.length > 0 && (
            <div 
              onClick={() => triggerMainPopup('Teaser Click')}
              className="fixed bottom-6 right-6 transition-all border shadow-2xl overflow-hidden hover:scale-105 active:scale-95 cursor-pointer z-[400] flex flex-col justify-between"
              style={{
                width: `${campaign.steps.teaser.width}px`,
                height: `${campaign.steps.teaser.height}px`,
                backgroundColor: campaign.steps.teaser.backgroundColor,
                borderRadius: `${campaign.steps.teaser.borderRadius}px`,
                borderWidth: `${campaign.steps.teaser.borderWidth}px`,
                borderColor: campaign.steps.teaser.borderColor,
                boxShadow: campaign.steps.teaser.boxShadow || '0 8px 30px rgba(0,0,0,0.15)',
              }}
            >
              {/* Teaser items rendering */}
              {campaign.steps.teaser.elements.map((el: any) => (
                <div 
                  key={el.id}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${el.x}%`, 
                    top: `${el.y}%`, 
                    width: `${el.w}%`, 
                    height: `${el.h}%`, 
                    zIndex: el.zIndex,
                    opacity: el.opacity ?? 1,
                  }}
                >
                  {el.type === 'shape' && (
                    <div 
                      className="w-full h-full" 
                      style={{ 
                        backgroundColor: el.backgroundColor, 
                        borderRadius: el.content === 'circle' ? '50%' : `${el.borderRadius || 0}px` 
                      }} 
                    />
                  )}
                  {el.type === 'text' && (
                    <span 
                      className="w-full h-full font-bold select-none text-[10px] flex items-center justify-center text-center px-1"
                      style={{ color: el.color, fontFamily: el.fontFamily }}
                    >
                      {el.content}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

        {/* 4. MODAL POPUP BACKDROP OVERLAY SIMULATOR */}
        {showMainCampaign && (
          <div
            className={`absolute inset-0 z-[990] flex ${backdropClasses(campaign.steps.main.position, campaign.steps.main.popupType)}`}
            style={{ background: backdropOverlay(campaign.steps.main.popupType) }}
          >
            {/* Active configured template container representing popupType */}
            {(() => {
              const activeStepConfig = campaignStep === 'main' ? campaign.steps.main : campaign.steps.success;
              const isWheel      = activeStepConfig.elements.some((e: any) => e.content === 'wheel');
              const isStickybar  = activeStepConfig.popupType === 'stickybar';
              const isFullscreen = activeStepConfig.popupType === 'fullscreen';

              // Stickybar: stretch full width; fullscreen: fill frame
              const popupWidth  = (isStickybar || isFullscreen) ? '100%' : `${activeStepConfig.width}px`;
              const popupHeight = isFullscreen ? '100%' : `${activeStepConfig.height}px`;
              const popupRadius = isStickybar ? 0 : activeStepConfig.borderRadius;

              // Only show the fallback X if the design has no dedicated close element
              const hasCloseEl = activeStepConfig.elements.some((e: any) => e.type === 'close');

              return (
                <div
                  key={`popup-${campaignStep}-${activeStepConfig.animationEntrance}`}
                  className="relative shadow-2xl text-left overflow-hidden"
                  style={{
                    width: popupWidth,
                    height: popupHeight,
                    backgroundColor: activeStepConfig.backgroundColor,
                    borderRadius: `${popupRadius}px`,
                    borderWidth: `${activeStepConfig.borderWidth}px`,
                    borderColor: activeStepConfig.borderColor,
                    boxShadow: isStickybar
                      ? '0 4px 24px rgba(0,0,0,0.18)'
                      : (activeStepConfig.boxShadow || '0 25px 80px rgba(0,0,0,0.25)'),
                    ...entranceStyle(activeStepConfig.animationEntrance || 'scale-up'),
                  }}
                >
                  {/* Fallback close button — only rendered when design has no close element */}
                  {!hasCloseEl && (
                    <button
                      onClick={() => handleAffiliateDismiss(activeStepConfig)}
                      title={awaitingReturn ? 'Close the ad tab first, then click again' : 'Close popup'}
                      className="absolute top-3.5 right-3.5 h-6 w-6 rounded-full border flex items-center justify-center font-mono text-xs select-none cursor-pointer z-[1000] transition-all shadow-xs"
                      style={{
                        background: awaitingReturn ? '#FEF3C7' : '#FFFFFF',
                        borderColor: awaitingReturn ? '#F59E0B' : '#E4E4E7',
                        color: awaitingReturn ? '#92400E' : '#18181B',
                        animation: awaitingReturn ? 'sp-bounce 1.2s ease infinite' : 'none',
                      }}
                    >
                      {awaitingReturn ? '⏳' : '✕'}
                    </button>
                  )}

                  {/* "Return to close" overlay — shown while ad tab is open */}
                  {awaitingReturn && (
                    <div
                      className="absolute inset-x-0 bottom-0 z-[999] flex items-center justify-center gap-3 px-4 py-3"
                      style={{ background: 'rgba(0,0,0,0.75)', borderRadius: '0 0 12px 12px' }}
                    >
                      <span style={{ fontSize: 11, color: '#FCD34D', fontWeight: 600 }}>
                        ⏳ Close the ad tab to dismiss this popup
                      </span>
                      <button
                        onClick={() => { setAwaitingReturn(false); setAdWindow(null); setShowMainCampaign(false); setShowTeaser(true); }}
                        style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                      >
                        skip
                      </button>
                    </div>
                  )}

                  {/* Render Elements inside dialog with real interaction */}
                  {activeStepConfig.elements.map((el: any) => {
                    return (
                      <div
                        key={el.id}
                        className="absolute"
                        style={{
                          left: `${el.x}%`,
                          top: `${el.y}%`,
                          width: `${el.w}%`,
                          height: `${el.h}%`,
                          zIndex: el.zIndex,
                          opacity: el.animationType && el.animationType !== 'none' ? undefined : (el.opacity ?? 1),
                          ...elementAnimStyle(el.animationType, el.animationDelay ?? 0, el.animationDuration ?? 0.5),
                        }}
                      >
                        {/* Text labels */}
                        {el.type === 'heading' && (
                          <h2 
                            className="w-full h-full text-center leading-tight font-extrabold select-none flex items-center justify-center break-words"
                            style={{ 
                              color: el.color, 
                              fontSize: `${el.fontSize || 22}px`, 
                              fontFamily: el.fontFamily,
                              textAlign: el.align || 'center'
                            }}
                          >
                            {el.content}
                          </h2>
                        )}

                        {el.type === 'text' && (
                          <p 
                            className="w-full h-full select-none text-xs leading-relaxed"
                            style={{ 
                              color: el.color, 
                              fontSize: `${el.fontSize || 12}px`, 
                              fontFamily: el.fontFamily,
                              textAlign: el.align || 'left',
                              backgroundColor: el.backgroundColor || 'transparent',
                              borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined,
                              borderWidth: el.borderWidth ? `${el.borderWidth}px` : undefined,
                              borderColor: el.borderColor,
                              padding: el.padding ? `${el.padding}px` : undefined,
                            }}
                          >
                            {/* Dynamically bind won spin segments prize values if success step */}
                            {campaignStep === 'success' && el.content.includes('[SPUN_PRIZE_VALUE]') 
                              ? el.content.replace('[SPUN_PRIZE_VALUE]', wonPrize || 'a 50% Shop Coupon!') 
                              : el.content}
                          </p>
                        )}

                        {/* Interactive click CTA buttons of campaign */}
                        {el.type === 'button' && (
                          <button
                            onClick={() => {
                              const href = el.href || el.extraProps?.href;
                              // If button has an affiliate/destination URL — open in new tab
                              if (href && href.length > 4 && !href.includes('YOUR_')) {
                                window.open(href, '_blank', 'noopener');
                                showToast('🛒 Opening destination in new tab…');
                                // Also advance to success step
                                if (campaignStep === 'main') setCampaignStep('success');
                                return;
                              }
                              // Fallback: original submit / coupon flow
                              if (campaignStep === 'main') {
                                handleCampaignSubmit(activeStepConfig);
                              } else {
                                const couponEl = activeStepConfig.elements.find((e: any) => e.type === 'text' && (e.content.length < 20 || e.id.includes('coupon') || e.id.includes('code')));
                                const couponTxt = couponEl ? couponEl.content : 'LUCKYSPIN50';
                                handleCopyCode(couponTxt);
                                setShowMainCampaign(false);
                                setCheckoutStep('checkout');
                              }
                            }}
                            className="w-full h-full font-bold uppercase transition-all shadow-md flex items-center justify-center hover:brightness-110 active:scale-95 cursor-pointer"
                            style={{
                              backgroundColor: el.backgroundColor || '#000000',
                              color: el.color || '#FFFFFF',
                              borderRadius: `${el.borderRadius ?? 8}px`,
                              fontSize: `${el.fontSize || 11}px`,
                              fontFamily: el.fontFamily,
                            }}
                          >
                            {isSpinning && el.content.includes('SPIN') ? '🎡 SPINNING...' : el.content}
                          </button>
                        )}

                        {/* Text inputs inside modal */}
                        {el.type === 'input' && (
                          <div className="w-full h-full relative">
                            <input 
                              type="email"
                              value={viewerInputs[el.id] || ''}
                              onChange={(e) => setViewerInputs({ ...viewerInputs, [el.id]: e.target.value })}
                              placeholder={el.extraProps?.placeholder || 'Email entry...'}
                              className="w-full h-full text-xs font-semibold px-3 border border-zinc-200 focus:border-zinc-900 outline-hidden bg-white text-zinc-900"
                              style={{ borderRadius: `${el.borderRadius ?? 8}px` }}
                            />
                          </div>
                        )}

                        {/* Real physics color segment Spin Wheel */}
                        {el.type === 'shape' && el.content === 'wheel' && (
                          <div className="w-full h-full rounded-full border-4 border-zinc-900 overflow-hidden relative shadow-lg flex items-center justify-center">
                            
                            {/* SVG Color Wheel Conic Cones rotating */}
                            <div 
                              className="w-full h-full rounded-full transition-transform duration-[3000ms] pointer-events-none ease-out"
                              style={{
                                transform: `rotate(${spinnerDegrees}deg)`,
                                background: `conic-gradient(from 0deg, 
                                  #09090b 0deg 51deg, 
                                  #18181b 51deg 102deg, 
                                  #27272a 102deg 153deg, 
                                  #3f3f46 153deg 204deg, 
                                  #52525b 204deg 255deg, 
                                  #71717a 255deg 306deg, 
                                  #e4e4e7 306deg 360deg)`
                              }}
                            />
                            {/* Sparkles visual inner wheel */}
                            <div className="absolute h-9 w-9 bg-white rounded-full flex items-center justify-center border border-zinc-900 text-[9px] font-black tracking-tighter text-zinc-900 shadow-md z-20">
                              SPIN
                            </div>
                          </div>
                        )}

                        {/* Interactive components indicators inside modal */}
                        {el.type === 'countdown' && (
                          <div className="w-full h-full flex items-center justify-center gap-2">
                            <div className="flex flex-col items-center justify-center bg-zinc-905 bg-zinc-900 text-white rounded px-2.5 py-1 text-center font-mono shadow-xs border border-zinc-800">
                              <span className="text-xs font-bold font-mono text-white leading-none">{getFormattedTimer().split(':')[0]}</span>
                              <span className="text-[7px] text-zinc-400 uppercase mt-0.5 tracking-wider leading-none">Min</span>
                            </div>
                            <span className="text-zinc-650 font-bold text-sm">:</span>
                            <div className="flex flex-col items-center justify-center bg-zinc-905 bg-zinc-900 text-white rounded px-2.5 py-1 text-center font-mono shadow-xs border border-zinc-805">
                              <span className="text-xs font-bold font-mono text-white leading-none">{getFormattedTimer().split(':')[1]}</span>
                              <span className="text-[7px] text-zinc-400 uppercase mt-0.5 tracking-wider leading-none">Sec</span>
                            </div>
                          </div>
                        )}

                        {/* Star reviews block */}
                        {el.type === 'review' && (
                          <div className="w-full h-full flex flex-col justify-center text-left bg-transparent p-1.5 rounded gap-0.5 overflow-hidden">
                            <div className="flex gap-0.5 text-zinc-900 fill-zinc-900">
                              {[1,2,3,4,5].map(st => (
                                <Star key={st} className="h-3 w-3 fill-zinc-900 text-zinc-900" />
                              ))}
                            </div>
                            <span className="text-[9px] italic line-clamp-2 text-zinc-600">
                              "Instant coupon redeemed! Simple modal with high conversion checkout feel"
                            </span>
                          </div>
                        )}

                        {/* QR Code hub */}
                        {el.type === 'qrcode' && (
                          <div className="w-full h-full bg-white p-1 rounded-lg border border-[#EDECE6] flex items-center justify-center z-10">
                            <QrCode className="h-5/6 w-5/6 text-slate-950" />
                          </div>
                        )}

                        {/* Decorative vectors of step */}
                        {el.type === 'shape' && (
                          <div 
                            className="w-full h-full shadow-xs"
                            style={{
                              backgroundColor: el.backgroundColor,
                              borderRadius: el.content === 'circle' ? '9999px' : `${el.borderRadius || 0}px`,
                              borderWidth: `${el.borderWidth || 0}px`,
                              borderColor: el.borderColor || 'transparent',
                            }}
                          />
                        )}

                        {/* Close element — affiliate-gate + respects el.color / el.backgroundColor */}
                        {el.type === 'close' && (() => {
                          const isTransparentBg = !el.backgroundColor || el.backgroundColor === 'transparent';
                          return (
                            <div
                              onClick={() => handleAffiliateDismiss(activeStepConfig)}
                              title={awaitingReturn ? 'Close the ad tab first' : 'Close popup'}
                              className="w-full h-full flex items-center justify-center transition-all cursor-pointer font-bold"
                              style={{
                                background:   awaitingReturn ? '#FEF3C7' : (isTransparentBg ? 'transparent' : el.backgroundColor),
                                border:       awaitingReturn ? '1px solid #F59E0B' : (isTransparentBg ? 'none' : `1px solid ${el.borderColor || '#E5E7EB'}`),
                                borderRadius: `${el.borderRadius ?? 999}px`,
                                color:        awaitingReturn ? '#92400E' : (el.color || '#1F2937'),
                                fontSize:     `${el.fontSize || 14}px`,
                              }}
                            >
                              {awaitingReturn ? '⏳' : (el.content || '✕')}
                            </div>
                          );
                        })()}

                        {el.type === 'image' && (
                          <img 
                            src={el.content || 'https://images.unsplash.com/photo-1542435503-956c469947f6?auto=format&fit=crop&w=400&q=80'}
                            alt="Campaign banner"
                            className="w-full h-full object-cover rounded-lg bg-gray-50 border border-black/10"
                            style={{ borderRadius: `${el.borderRadius || 0}px` }}
                            referrerPolicy="no-referrer"
                          />
                        )}

                      </div>
                    );
                  })}
                </div>
              );
            })()}

          </div>
        )}

      </div>

    </div>
  );
}
