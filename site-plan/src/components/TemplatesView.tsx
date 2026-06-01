import { useState } from 'react';
import { ArrowRight, Search, ExternalLink } from 'lucide-react';

const DASHBOARD_URL = 'https://dashboard.scrollpop.online';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  trigger: string;
  colors: { bg: string; accent: string; text: string };
  imageUrl?: string;
}

// Real templates matching the actual ScrollPop app library
const TEMPLATES: Template[] = [
  // Welcome
  { id: 'welcome-clean', name: 'Round Welcome — Clean', category: 'Welcome', description: 'Simple welcome popup with first-order discount and email capture.', trigger: 'Scroll 30%', colors: { bg: '#ffffff', accent: '#6366f1', text: '#111827' } },
  { id: 'welcome-contrast', name: 'High Contrast Welcome', category: 'Welcome', description: 'Dark navy/amber two-column layout with bold first-order offer.', trigger: 'Scroll 30%', colors: { bg: '#0f172a', accent: '#f59e0b', text: '#ffffff' } },
  { id: 'welcome-gift', name: 'First Order Offer', category: 'Welcome', description: 'Gift-focused warm orange popup — unlock 20% off first order.', trigger: 'Dwell 5s', colors: { bg: '#fff7ed', accent: '#ea580c', text: '#7c2d12' } },
  { id: 'welcome-shipping', name: 'Welcome + Free Shipping', category: 'Welcome', description: 'Green split layout — no minimum spend free shipping offer.', trigger: 'Scroll 20%', colors: { bg: '#f0fdf4', accent: '#16a34a', text: '#14532d' } },
  { id: 'welcome-slide', name: 'Minimal Welcome Slide-in', category: 'Welcome', description: 'Non-intrusive slide-in for first-time visitors. Low friction.', trigger: 'Dwell 3s', colors: { bg: '#ffffff', accent: '#8b5cf6', text: '#111827' } },
  // Exit Intent
  { id: 'exit-coupon', name: 'Exit — Last Chance Coupon', category: 'Exit Intent', description: 'Final offer before visitor leaves — 20% off coupon with countdown.', trigger: 'Exit intent', colors: { bg: '#ffffff', accent: '#dc2626', text: '#111827' } },
  { id: 'exit-cart', name: 'Exit — Cart Recovery', category: 'Exit Intent', description: 'Dark/amber popup for visitors leaving the cart page.', trigger: 'Exit intent', colors: { bg: '#0f172a', accent: '#f59e0b', text: '#ffffff' } },
  { id: 'exit-browse', name: 'Exit — Browse Recovery', category: 'Exit Intent', description: 'Re-engage visitors who browsed but never added to cart.', trigger: 'Exit intent', colors: { bg: '#ffffff', accent: '#0ea5e9', text: '#111827' } },
  { id: 'exit-demo', name: 'Exit — Book a Demo', category: 'Exit Intent', description: 'B2B exit popup offering a free 15-minute personalised demo.', trigger: 'Exit intent', colors: { bg: '#ffffff', accent: '#4f46e5', text: '#111827' } },
  // Email Capture
  { id: 'email-lightbox', name: 'Lightbox Email Offer', category: 'Email Capture', description: 'Classic lightbox — 15% off instant coupon for email signup.', trigger: 'Scroll 40%', colors: { bg: '#ffffff', accent: '#059669', text: '#111827' } },
  { id: 'email-course', name: 'Free Course Lead Capture', category: 'Email Capture', description: 'Offer a free course or guide in exchange for email signup.', trigger: 'Dwell 10s', colors: { bg: '#eff6ff', accent: '#2563eb', text: '#1e3a5f' } },
  { id: 'email-bar', name: 'Email Nanobar', category: 'Email Capture', description: 'Persistent bottom bar — least intrusive, always visible.', trigger: 'Scroll 10%', colors: { bg: '#111827', accent: '#6366f1', text: '#e5e7eb' } },
  { id: 'email-referral', name: 'Refer a Friend', category: 'Email Capture', description: 'Give $10 · Get $10 — referral popup for loyalty building.', trigger: 'Scroll 50%', colors: { bg: '#f5f3ff', accent: '#7c3aed', text: '#4c1d95' } },
  // Upsell
  { id: 'upsell-qty', name: 'Buy More, Save More', category: 'Upsell', description: 'Triggered after add-to-cart — buy 2 and save 20%.', trigger: 'After add-to-cart', colors: { bg: '#eff6ff', accent: '#2563eb', text: '#1e3a5f' } },
  { id: 'upsell-upgrade', name: 'Upgrade Upsell', category: 'Upsell', description: 'Suggest premium version in a slide-in — "Switch for $10 more".', trigger: 'After add-to-cart', colors: { bg: '#1e1b4b', accent: '#a855f7', text: '#ffffff' } },
  // Cross-Sell
  { id: 'cross-bundle', name: 'Bundle & Complete the Look', category: 'Cross-Sell', description: 'Product recommendation popup triggered after add-to-cart.', trigger: 'After add-to-cart', colors: { bg: '#ffffff', accent: '#111827', text: '#111827' } },
  { id: 'cross-gift', name: 'Free Gift With Purchase', category: 'Cross-Sell', description: 'Show a free gift threshold — spend $75+ to qualify.', trigger: 'Scroll 40%', colors: { bg: '#fdf4ff', accent: '#9333ea', text: '#581c87' } },
  // Sale & Promotions
  { id: 'promo-flash', name: 'Flash Sale — Countdown', category: 'Sale & Promotions', description: 'Crimson urgency popup with countdown timer — 40% off everything.', trigger: 'Scroll 20%', colors: { bg: '#7f1d1d', accent: '#fbbf24', text: '#ffffff' } },
  { id: 'promo-bar', name: 'Promo Announcement Bar', category: 'Sale & Promotions', description: 'Sticky top bar announcing current sales without blocking content.', trigger: 'Page load', colors: { bg: '#6366f1', accent: '#ffffff', text: '#ffffff' } },
  { id: 'promo-bfriday', name: 'Black Friday Blowout', category: 'Sale & Promotions', description: 'Maximum contrast Black Friday popup — 50% off sitewide.', trigger: 'Scroll 20%', colors: { bg: '#000000', accent: '#eab308', text: '#ffffff' } },
  { id: 'promo-xmas', name: 'Christmas Sale', category: 'Sale & Promotions', description: 'Festive Christmas popup with coupon reveal — 25% off.', trigger: 'Scroll 20%', colors: { bg: '#14532d', accent: '#fbbf24', text: '#ffffff' } },
  { id: 'promo-valentine', name: "Valentine's Day Sale", category: 'Sale & Promotions', description: 'Romantic rose pink popup for gift campaigns.', trigger: 'Scroll 20%', colors: { bg: '#fff1f2', accent: '#e11d48', text: '#881337' } },
  // Gamified
  { id: 'spin-wheel', name: 'Spin-to-Win Wheel', category: 'Gamified', description: 'Interactive spin wheel — win up to 50% off. High engagement.', trigger: 'Dwell 5s', colors: { bg: '#0f172a', accent: '#fbbf24', text: '#ffffff' } },
  { id: 'scratch-card', name: 'Scratch & Reveal', category: 'Gamified', description: 'Scratch-card mystery discount — builds curiosity before reveal.', trigger: 'Dwell 5s', colors: { bg: '#1e1b4b', accent: '#fbbf24', text: '#ffffff' } },
];

const CATEGORIES = ['All', 'Welcome', 'Exit Intent', 'Email Capture', 'Upsell', 'Cross-Sell', 'Sale & Promotions', 'Gamified'];

function TemplateCard({ t }: { t: Template }) {
  return (
    <div className="glass rounded-2xl overflow-hidden hover:border-neutral-300 hover:-translate-y-1 transition-all duration-300 flex flex-col">
      {/* Colour preview strip */}
      <div
        className="relative h-36 flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: t.colors.bg }}
      >
        {/* Fake popup preview */}
        <div
          className="w-44 shadow-lg rounded-lg p-4 border"
          style={{
            backgroundColor: t.colors.bg,
            borderColor: `${t.colors.accent}30`,
          }}
        >
          <div
            className="h-1.5 w-8 rounded-full mb-2"
            style={{ backgroundColor: t.colors.accent }}
          />
          <div
            className="h-2 w-full rounded mb-1 opacity-30"
            style={{ backgroundColor: t.colors.text }}
          />
          <div
            className="h-2 w-3/4 rounded mb-3 opacity-20"
            style={{ backgroundColor: t.colors.text }}
          />
          <div
            className="h-5 w-full rounded text-center"
            style={{ backgroundColor: t.colors.accent }}
          />
        </div>

        {/* Category badge */}
        <span className="absolute top-3 left-3 py-0.5 px-2.5 bg-neutral-900/80 backdrop-blur-sm rounded-full text-[9px] font-mono font-bold tracking-widest uppercase text-white">
          {t.category}
        </span>

        {/* Trigger badge */}
        <span
          className="absolute top-3 right-3 py-0.5 px-2.5 rounded-full text-[9px] font-mono font-bold"
          style={{ backgroundColor: `${t.colors.accent}25`, color: t.colors.accent }}
        >
          {t.trigger}
        </span>
      </div>

      {/* Info */}
      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div>
          <h3 className="font-serif text-base font-normal text-neutral-900">{t.name}</h3>
          <p className="text-xs text-neutral-600 font-light mt-1 leading-relaxed">{t.description}</p>
        </div>

        {/* Single CTA */}
        <a
          href={`${DASHBOARD_URL}/sign-up`}
          className="w-full h-9 font-mono text-[11px] font-bold uppercase tracking-wider rounded border border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          Use This Template <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

export default function TemplatesView() {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = TEMPLATES.filter(t => {
    const matchCat = filter === 'All' || t.category === filter;
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-16 font-sans text-neutral-800">

      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] font-semibold block mb-3">38+ TEMPLATES</span>
        <h1 className="font-serif text-4xl md:text-6xl font-normal tracking-tight leading-none text-gradient">
          Template library
        </h1>
        <p className="text-neutral-600 font-light text-base md:text-lg mt-4 leading-relaxed">
          Every template is fully editable in the ScrollPop visual builder. Pick one, customise it to match your brand, and launch in minutes.
        </p>
        <a
          href={`${DASHBOARD_URL}/sign-up`}
          className="inline-flex items-center gap-2 mt-8 h-12 px-8 bg-neutral-950 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-xl"
        >
          Browse All Templates in the Dashboard →
        </a>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-8 border-b border-neutral-200 mb-12">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`py-1.5 px-4 text-xs font-mono rounded-full border tracking-wide transition-all cursor-pointer ${
                filter === cat
                  ? 'bg-neutral-950 border-neutral-950 text-white font-semibold'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-72 flex-shrink-0">
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs h-10 pl-9 pr-4 rounded-full bg-white text-neutral-800 placeholder-neutral-400 border border-neutral-200 focus:outline-none focus:border-neutral-400 transition-colors"
          />
          <Search className="h-4 w-4 text-neutral-400 absolute left-3 top-3" />
        </div>
      </div>

      {/* Count */}
      <p className="text-xs font-mono text-neutral-500 mb-8 uppercase tracking-wider">
        {filtered.length} template{filtered.length !== 1 ? 's' : ''} {filter !== 'All' ? `in ${filter}` : ''}
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((t) => <TemplateCard key={t.id} t={t} />)}
      </div>

      {/* Bottom CTA */}
      <div className="mt-20 p-12 glass rounded-3xl border border-neutral-200 flex flex-col lg:flex-row items-center justify-between gap-8">
        <div className="max-w-xl">
          <span className="text-[10px] font-mono tracking-widest text-[#C05621] uppercase block mb-1 font-semibold">VISUAL BUILDER</span>
          <h3 className="font-serif text-2xl md:text-3xl font-normal text-neutral-900">
            Every template is fully editable
          </h3>
          <p className="text-sm font-light text-neutral-600 mt-2 leading-relaxed">
            Drag, drop, resize — change colours, fonts, and layout to match your brand exactly. What you see in the editor is exactly what visitors see on your site.
          </p>
        </div>
        <a
          href={`${DASHBOARD_URL}/sign-up`}
          className="h-12 px-8 bg-neutral-950 text-white rounded font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer flex items-center gap-2 shadow-lg whitespace-nowrap"
        >
          Start Building Free <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
