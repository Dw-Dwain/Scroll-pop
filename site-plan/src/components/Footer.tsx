import { ActivePage } from '../types';
import { Globe, Shield, ShoppingBag } from 'lucide-react';

const DASHBOARD_URL = 'https://dashboard.scrollpop.online';

interface FooterProps {
  onPageChange: (page: ActivePage) => void;
  onTriggerDemoPopup: (type: 'newsletter' | 'coupon' | 'slide-in') => void;
}

export default function Footer({ onPageChange, onTriggerDemoPopup }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black text-[#FAF9F5] pt-32 pb-12 border-t border-white/10 z-10 relative">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 border-b border-white/5 pb-16">

        {/* Brand */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-black">
              <span className="font-serif font-normal text-lg">S</span>
              <span className="font-sans font-extrabold text-black text-xs -translate-x-0.5 translate-y-1">P</span>
            </div>
            <div>
              <span className="font-serif text-xl font-normal tracking-tight">ScrollPop</span>
              <p className="text-[10px] uppercase font-mono tracking-widest text-white/50 -mt-1">Conversion Studio</p>
            </div>
          </div>
          <p className="text-white/50 text-sm font-sans font-light leading-relaxed max-w-sm">
            Scroll-triggered affiliate popup campaigns for WordPress and Shopify. Visual builder, real analytics, Google-compliant triggers. Free to start.
          </p>
          <a
            href={`${DASHBOARD_URL}/sign-up`}
            className="w-fit h-10 px-6 rounded-full bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-white/90 transition-all shadow-xl"
          >
            Start Free →
          </a>
        </div>

        {/* Product links */}
        <div>
          <h4 className="text-white text-xs font-mono uppercase tracking-widest mb-6">Product</h4>
          <ul className="flex flex-col gap-4 text-sm font-sans text-white/50">
            <li>
              <button onClick={() => onPageChange('home')} className="hover:text-white transition-colors cursor-pointer text-left">Home</button>
            </li>
            <li>
              <button onClick={() => onPageChange('templates')} className="hover:text-white transition-colors cursor-pointer text-left">Template Gallery</button>
            </li>
            <li>
              <button onClick={() => onPageChange('pricing')} className="hover:text-white transition-colors cursor-pointer text-left">Pricing</button>
            </li>
            <li>
              <button onClick={() => onTriggerDemoPopup('coupon')} className="hover:text-white transition-colors cursor-pointer text-left flex items-center gap-1.5 text-white/90">
                Live Demo <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
              </button>
            </li>
          </ul>
        </div>

        {/* Platform links */}
        <div>
          <h4 className="text-white text-xs font-mono uppercase tracking-widest mb-6">Platforms</h4>
          <ul className="flex flex-col gap-4 text-sm font-sans text-white/50">
            <li>
              <button onClick={() => onPageChange('integration-guide')} className="hover:text-white transition-colors cursor-pointer text-left flex items-center gap-2">
                <Globe className="h-3 w-3 text-white/60" /> WordPress Plugin
              </button>
            </li>
            <li>
              <button onClick={() => onPageChange('integration-guide')} className="hover:text-white transition-colors cursor-pointer text-left flex items-center gap-2">
                <ShoppingBag className="h-3 w-3 text-white/60" /> Shopify OAuth
              </button>
            </li>
            <li>
              <button onClick={() => onPageChange('integration-guide')} className="hover:text-white transition-colors cursor-pointer text-left">Shopify App Embed Block</button>
            </li>
            <li>
              <button onClick={() => onPageChange('integration-guide')} className="hover:text-white transition-colors cursor-pointer text-left">HTML / Any CMS</button>
            </li>
          </ul>
        </div>

        {/* Company links */}
        <div>
          <h4 className="text-white text-xs font-mono uppercase tracking-widest mb-6">Company</h4>
          <ul className="flex flex-col gap-4 text-white/50 text-sm font-sans">
            <li>
              <button onClick={() => onPageChange('contact')} className="hover:text-white transition-colors cursor-pointer text-left">Contact</button>
            </li>
            <li>
              <a href={`${DASHBOARD_URL}/sign-in`} className="hover:text-white transition-colors">Sign In</a>
            </li>
            <li>
              <a href={`${DASHBOARD_URL}/sign-up`} className="hover:text-white transition-colors">Create Account</a>
            </li>
            <li className="text-[12px] bg-white/5 border border-white/10 p-2.5 rounded text-white/50 flex items-center gap-2 max-w-[160px]">
              <Shield className="h-3.5 w-3.5 text-white/70 flex-shrink-0" />
              <span>GDPR / CCPA Compliant</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <span className="font-serif text-5xl md:text-8xl lg:text-9xl font-normal text-white/5 select-none pointer-events-none block mb-4 tracking-tighter">
            ScrollPop
          </span>
          <p className="text-xs font-mono text-white/30 tracking-widest">
            © {currentYear} SCROLLPOP. ALL RIGHTS RESERVED.
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs font-mono text-white/30 whitespace-nowrap">
          <a href="#" className="hover:text-white transition-colors">PRIVACY POLICY</a>
          <a href="#" className="hover:text-white transition-colors">TERMS OF SERVICE</a>
          <a href="#" className="hover:text-white transition-colors">SECURITY</a>
        </div>
      </div>
    </footer>
  );
}
