import { useState } from 'react';
import { PopupTemplate } from '../types';
import { Sparkles, ArrowRight, Layers, Sliders, Check, Copy, Search } from 'lucide-react';
import { motion } from 'motion/react';

interface TemplatesViewProps {
  onSelectTemplateAsDemo: (template: PopupTemplate) => void;
  onTriggerDemoPopup: (type: 'newsletter' | 'coupon' | 'slide-in', forceStyle?: any) => void;
}

export default function TemplatesView({ onSelectTemplateAsDemo, onTriggerDemoPopup }: TemplatesViewProps) {
  const [filter, setFilter] = useState<string>('all');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const templates: PopupTemplate[] = [
    {
      id: 'template_gainsbourg',
      name: 'The Gainsbourg Journal',
      category: 'newsletter',
      title: 'Curated Parisienne Digest',
      subtitle: 'Subscribe to receive seasonal styling rules, boutique interviews, and bespoke editorial essays.',
      ctaText: 'Subscribe to Journal',
      badge: 'LITERARY EDITION',
      themeStyle: 'warm-editorial',
      imageUrl: 'https://picsum.photos/seed/paris/600/400'
    },
    {
      id: 'template_patagonia',
      name: 'The Patagonia Active Cart',
      category: 'slide-in',
      title: 'Keep Your Gear Safe',
      subtitle: 'Your environmentally conscious custom bag is saved. Finalize dispatch with code CARTZERO for eco packaging.',
      ctaText: 'Dispatch Order Now',
      badge: 'CONSCIOUS CART',
      themeStyle: 'minimalist',
      imageUrl: 'https://picsum.photos/seed/mountain/600/400'
    },
    {
      id: 'template_lafayette',
      name: 'Lafayette Mono Streetwear',
      category: 'coupon',
      title: 'Acquisition Code Loaded',
      subtitle: 'Lock in 15% off curated high-contrast streetwear. Valid on raw selvedge denim & heavyweight fleece.',
      ctaText: 'Claim Lafayette Pass',
      badge: 'DROP LAF_44',
      discountCode: 'LAF15',
      themeStyle: 'tech-mono',
      imageUrl: 'https://picsum.photos/seed/street/600/400'
    },
    {
      id: 'template_glossier',
      name: 'The Glossier Soft Pastel',
      category: 'newsletter',
      title: 'Skin First, Always',
      subtitle: 'Join our aesthetic circle to unlock pre-launches, editorial beauty tutorials, and complimentary delivery codes.',
      ctaText: 'Unlock Pre-Launches',
      badge: 'BESTSELLER CLUB',
      themeStyle: 'warm-editorial',
      imageUrl: 'https://picsum.photos/seed/pastel/600/400'
    },
    {
      id: 'template_kinfolk',
      name: 'Kinfolk Floating Bar',
      category: 'floating-bar',
      title: 'Free International Print Shipping Active',
      subtitle: 'Applied systematically to all hardcopy publications during May checkout runs.',
      ctaText: 'Apply Shipping Benefits',
      badge: 'CIRCULATION',
      themeStyle: 'minimalist'
    },
    {
      id: 'template_obsidian',
      name: 'Avant Garde Obsidian',
      category: 'coupon',
      title: 'Avant-Garde Curators Club',
      subtitle: 'Members receive quarterly physical catalogs and instant premium pre-order codes.',
      ctaText: 'Join the Vanguard',
      badge: 'OBSIDIAN CLUB',
      discountCode: 'ONYX20',
      themeStyle: 'luxury-bold',
      imageUrl: 'https://picsum.photos/seed/black/600/400'
    }
  ];

  const handleCopyDesignTokens = (t: PopupTemplate) => {
    const tokens = JSON.stringify({
      id: t.id,
      theme_style: t.themeStyle,
      source_name: t.name,
      headings_font: t.themeStyle === 'warm-editorial' ? 'Playfair' : t.themeStyle === 'tech-mono' ? 'JetBrains Mono' : 'Inter',
      custom_title: t.title,
      call_to_action: t.ctaText,
    }, null, 2);
    
    navigator.clipboard.writeText(tokens);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTemplates = templates.filter(t => {
    const matchesCat = filter === 'all' || t.category === filter || t.themeStyle === filter;
    const matchesSearch = t.name.toLowerCase().includes(activeSearch.toLowerCase()) || t.title.toLowerCase().includes(activeSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-16 font-sans text-neutral-800">
      
      {/* Page Title & Philosophy */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] font-semibold block mb-3">HIGH-FASHION ARCHETYPE MATRIX</span>
        <h1 className="font-serif text-4xl md:text-6xl font-normal tracking-tight leading-none text-gradient">
          Conversion Canvas Library
        </h1>
        <p className="text-neutral-600 font-light text-base md:text-lg mt-4 leading-relaxed">
          Explore layouts design-partnered with high-end brands. ScrollPop popups don’t feel like visual malware; they fit elegantly into high-conversion editorial storefronts.
        </p>
      </div>

      {/* SEARCH AND CAPTURE CONTROLS */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-neutral-200 mb-12">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All Layouts' },
            { id: 'newsletter', label: 'Newsletters' },
            { id: 'coupon', label: 'Promo Coupons' },
            { id: 'slide-in', label: 'Cart Retention' },
            { id: 'warm-editorial', label: 'Warm Editorial style' },
            { id: 'tech-mono', label: 'Tech Mono style' }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id)}
              className={`py-2 px-4 text-xs font-mono rounded-full border tracking-wide transition-all cursor-pointer ${
                filter === btn.id
                  ? 'bg-neutral-950 border-neutral-950 text-white font-semibold'
                  : 'bg-neutral-100 border-neutral-250 text-neutral-700 hover:bg-neutral-250'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search templates..."
            value={activeSearch}
            onChange={(e) => setActiveSearch(e.target.value)}
            className="w-full text-xs h-10 pl-9 pr-4 rounded-full bg-white text-neutral-800 placeholder-neutral-400 border border-neutral-250 focus:outline-hidden focus:border-neutral-400 transition-colors"
          />
          <Search className="h-4 w-4 text-neutral-400 absolute left-3 top-3" />
        </div>
      </div>

      {/* TEMPLATES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredTemplates.map((item) => (
          <div
            key={item.id}
            className="glass rounded-2xl overflow-hidden hover:border-neutral-300 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
          >
            {/* Visual representation card top */}
            <div className="relative aspect-[3/2] bg-neutral-100 overflow-hidden border-b border-neutral-200 group">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full bg-[#1A1A1A] flex flex-col items-center justify-center p-8 text-center text-[#FAF9F5]">
                  <span className="font-serif text-3xl font-black block tracking-tighter mb-2">Kinfolk Bar</span>
                  <p className="text-[10px] uppercase font-mono tracking-widest text-[#C05621]">100% Horizontal viewport ribbon</p>
                </div>
              )}
              {/* Type Category overlay */}
              <span className="absolute top-4 left-4 py-1 px-3 bg-neutral-900 rounded-full text-[9px] font-mono font-bold tracking-widest uppercase text-white border border-neutral-850">
                {item.category === 'newsletter' && 'Newsletter Digest'}
                {item.category === 'coupon' && 'Promo Code'}
                {item.category === 'slide-in' && 'Slide Cart'}
                {item.category === 'floating-bar' && 'Floating Bar'}
              </span>
            </div>

            {/* Template Info block */}
            <div className="p-6 flex-1 flex flex-col justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 justify-between">
                  <h3 className="font-serif text-lg font-normal text-neutral-900">{item.name}</h3>
                  <span className="text-[9px] font-mono px-2 py-0.5 bg-neutral-100 border border-neutral-200/50 rounded text-neutral-600 capitalize">{item.themeStyle} style</span>
                </div>
                <p className="text-xs text-neutral-600 font-light mt-2 leading-relaxed">
                  Heading: "{item.title}" — {item.subtitle.slice(0, 100)}...
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5">
                {/* ACTIVATE DEMO */}
                <button
                  onClick={() => {
                    onSelectTemplateAsDemo(item);
                    // Force render dynamic layout pop overlay
                    onTriggerDemoPopup(item.category === 'floating-bar' ? 'newsletter' : item.category as any, item);
                  }}
                  className="w-full h-10 font-mono text-[11px] font-bold uppercase tracking-wider rounded border border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 shadow-md"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Live Test Run Template
                </button>

                {/* COPY TOKENS / BLUEPRINTS */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCopyDesignTokens(item)}
                    className="h-9 font-mono text-[10px] font-semibold text-neutral-700 border border-neutral-250 rounded hover:bg-neutral-50 hover:text-neutral-900 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" /> Token Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 text-neutral-450" /> Copy CMS Token
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onSelectTemplateAsDemo(item)}
                    className="h-9 font-mono text-[10px] font-semibold text-neutral-700 border border-neutral-250 rounded hover:bg-neutral-50 hover:text-neutral-900 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Sliders className="h-3 w-3 text-neutral-450" /> Customize Layout
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Integration Call to action */}
      <div className="mt-20 p-12 glass rounded-3xl border border-neutral-200 flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="max-w-xl z-10">
          <span className="text-[10px] font-mono tracking-widest text-[#C05621] uppercase block mb-1 font-semibold">UNCOMPROMISING SPEED</span>
          <h3 className="font-serif text-2xl md:text-3xl font-normal text-neutral-900">
            Engineered for Core Web Vitals Compatibility
          </h3>
          <p className="text-sm font-light text-neutral-600 mt-2 leading-relaxed">
            Every popup template we release has been scrutinized to pass Google's strict CLS (Cumulative Layout Shift) tests on both Shopify and WordPress mobile environments. Recreate the markup cleanly with our provided blueprints.
          </p>
        </div>
        
        <button
          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="h-12 px-8 bg-neutral-950 text-white rounded font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer flex items-center gap-2 z-10 shadow-lg"
        >
          Explore Coding Guidelines <ArrowRight className="h-4 w-4" />
        </button>
      </div>

    </div>
  );
}
