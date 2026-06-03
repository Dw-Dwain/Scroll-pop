import { useState } from 'react';
import { ActivePage } from '../types';
import { Sparkles, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DASHBOARD_URL = 'https://dashboard.scrollpop.online';

interface HeaderProps {
  activePage: ActivePage;
  onPageChange: (page: ActivePage) => void;
  onTriggerDemoPopup: (type: 'newsletter' | 'coupon' | 'slide-in') => void;
}

export default function Header({ activePage, onPageChange, onTriggerDemoPopup }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: ActivePage; label: string }[] = [
    { id: 'home',              label: 'Home' },
    { id: 'templates',         label: 'Templates' },
    { id: 'pricing',           label: 'Pricing' },
    { id: 'integration-guide', label: 'Install Guide' },
    { id: 'contact',           label: 'Contact' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-black border-b border-white/10 shadow-md">
      {/* Announcement strip */}
      <div className="w-full bg-[#0a0a0a] text-white/90 py-2 px-4 text-center text-[10px] font-mono tracking-widest flex items-center justify-center gap-2 border-b border-white/5 overflow-hidden">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
        </span>
        <span>SCROLLPOP IS LIVE — SCROLL-TRIGGERED AFFILIATE POPUPS FOR WORDPRESS & SHOPIFY</span>
        <span className="hidden md:inline text-white/30">|</span>
        <button
          onClick={() => onTriggerDemoPopup('coupon')}
          className="hidden md:flex items-center gap-1 text-white hover:text-white/80 font-medium transition-colors underline cursor-pointer"
        >
          See a live popup <Sparkles className="h-3 w-3" />
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 h-20 md:h-24 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => { onPageChange('home'); setMobileMenuOpen(false); }}
          className="flex items-center gap-3 group text-left cursor-pointer"
        >
          <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:rotate-6 shadow-xl">
            <div className="w-4 h-4 md:w-[18px] md:h-[18px] bg-black rounded-sm transform rotate-45" />
          </div>
          <div className="leading-none">
            <span className="block font-sans text-lg md:text-xl font-bold tracking-[0.14em] text-white uppercase">ScrollPop</span>
            <p className="text-[9px] uppercase font-sans font-medium tracking-[0.18em] text-white/50 mt-1 group-hover:text-white/80 transition-colors">CONVERSION STUDIO</p>
          </div>
        </button>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-8 font-sans font-medium text-sm">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`relative py-2 text-white/60 hover:text-white tracking-wide transition-colors uppercase text-xs cursor-pointer ${
                activePage === item.id ? 'text-white font-semibold' : ''
              }`}
            >
              {item.label}
              {activePage === item.id && (
                <motion.div
                  layoutId="activeUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-white"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
            </button>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden lg:flex items-center gap-4 font-sans text-sm">
          <a
            href={`${DASHBOARD_URL}/sign-in`}
            className="px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-white/75 hover:text-white border border-white/10 hover:border-white/30 rounded-full transition-all"
          >
            Sign In
          </a>
          <a
            href={`${DASHBOARD_URL}/sign-up`}
            className="h-11 px-6 rounded-full bg-white text-black text-xs font-bold uppercase tracking-widest transition-all duration-300 hover:bg-opacity-90 hover:-translate-y-0.5 active:translate-y-0 shadow-xl cursor-pointer whitespace-nowrap flex items-center justify-center"
          >
            Start Free →
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6 text-white" /> : <Menu className="h-6 w-6 text-white" />}
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-white/10 bg-[#0a0a0a]/95 backdrop-blur-lg overflow-hidden"
          >
            <div className="px-6 py-8 flex flex-col gap-5 font-sans font-medium text-base">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { onPageChange(item.id); setMobileMenuOpen(false); }}
                  className={`py-2.5 text-left border-b border-white/5 text-sm uppercase tracking-wider ${
                    activePage === item.id ? 'text-white font-bold pl-2 border-l-2 border-white' : 'text-white/60'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-3">
                <a
                  href={`${DASHBOARD_URL}/sign-in`}
                  className="w-full h-11 text-center font-bold tracking-widest rounded-full border border-white/10 text-white/80 hover:bg-white/5 hover:text-white transition-all text-xs uppercase flex items-center justify-center"
                >
                  Sign In
                </a>
                <a
                  href={`${DASHBOARD_URL}/sign-up`}
                  className="w-full h-11 font-bold tracking-widest rounded-full bg-white text-black hover:bg-opacity-95 transition-all text-xs uppercase shadow-xl flex items-center justify-center"
                >
                  Start Free — No Card Needed
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
