import { ArrowRight, ExternalLink } from 'lucide-react';

const DASHBOARD_URL = 'https://dashboard.scrollpop.online';

type Position = 'center' | 'bottom-right' | 'top-bar';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  trigger: string;
  position: Position;
  colors: { bg: string; accent: string; text: string };
  bgImage: string;
  preview: { badge: string; title: string; body: string; cta: string };
}

const TEMPLATES: Template[] = [
  {
    id: 'welcome',
    name: 'Welcome Offer',
    category: 'Welcome',
    description: 'First-order discount for new visitors. Scroll-triggered center modal with email capture.',
    trigger: 'Scroll 30%',
    position: 'center',
    colors: { bg: '#ffffff', accent: '#6366f1', text: '#111827' },
    bgImage: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=60',
    preview: { badge: '🎁 FIRST ORDER', title: 'Welcome! Get 10% Off', body: 'Sign up and your coupon lands instantly.', cta: 'Claim My 10% Off' },
  },
  {
    id: 'exit',
    name: 'Exit Intent',
    category: 'Exit Intent',
    description: 'Last-chance offer fires when the cursor leaves the viewport. High-urgency dark design.',
    trigger: 'Exit intent',
    position: 'center',
    colors: { bg: '#0f172a', accent: '#f59e0b', text: '#ffffff' },
    bgImage: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=60',
    preview: { badge: '⏳ LAST CHANCE', title: 'Wait — 20% Off Just For You', body: 'This offer expires when you leave.', cta: 'Claim 20% Off Now' },
  },
  {
    id: 'email-capture',
    name: 'Email Lead Capture',
    category: 'Email Capture',
    description: 'Classic lightbox for newsletter or course sign-up. Clean, minimal, high-converting.',
    trigger: 'Dwell 10s',
    position: 'center',
    colors: { bg: '#eff6ff', accent: '#2563eb', text: '#1e3a5f' },
    bgImage: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=600&q=60',
    preview: { badge: '📧 FREE COURSE', title: 'Double Your Conversion Rate', body: 'Join 12,000+ marketers — free 5-day course.', cta: 'Send Me The Course' },
  },
  {
    id: 'flash-sale',
    name: 'Flash Sale Countdown',
    category: 'Sale & Promotions',
    description: 'High-urgency sale popup with countdown timer. Crimson and gold — impossible to miss.',
    trigger: 'Scroll 20%',
    position: 'center',
    colors: { bg: '#7f1d1d', accent: '#fbbf24', text: '#ffffff' },
    bgImage: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=600&q=60',
    preview: { badge: '⚡ FLASH SALE', title: '40% Off Everything', body: 'Ends tonight. Code FLASH40 at checkout.', cta: 'Shop the Flash Sale' },
  },
  {
    id: 'slide-in',
    name: 'Side Slide-in',
    category: 'Email Capture',
    description: 'Non-intrusive slide-in card at bottom-right. Soft prompt — low friction, high retention.',
    trigger: 'Dwell 8s',
    position: 'bottom-right',
    colors: { bg: '#ffffff', accent: '#7c3aed', text: '#111827' },
    bgImage: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=600&q=60',
    preview: { badge: '💬 SOFT PROMPT', title: 'Before You Go…', body: 'Join 5,000+ subscribers for weekly deals.', cta: "Yes, I'm In" },
  },
  {
    id: 'affiliate',
    name: 'Affiliate Product Deal',
    category: 'Affiliate',
    description: 'Affiliate-monetised popup with product image and CTA. Triggered deep in the scroll journey.',
    trigger: 'Scroll 60%',
    position: 'center',
    colors: { bg: '#fffbf0', accent: '#d97706', text: '#1c1917' },
    bgImage: 'https://images.unsplash.com/photo-1556228578-0d85b1a4a503?auto=format&fit=crop&w=600&q=60',
    preview: { badge: '🛍️ PARTNER DEAL', title: 'Trending: Premium Skincare Kit', body: "Editor's pick. Free shipping today only.", cta: 'See This Deal →' },
  },
  {
    id: 'announcement-bar',
    name: 'Announcement Bar',
    category: 'Sale & Promotions',
    description: 'Sticky top bar that appears on page load. Least intrusive format — no content blocked.',
    trigger: 'Page load',
    position: 'top-bar',
    colors: { bg: '#1e1b4b', accent: '#a5b4fc', text: '#ffffff' },
    bgImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=60',
    preview: { badge: '🔔', title: '🚚 Free shipping on orders over $50 — ends tonight!', body: '', cta: 'Shop Now' },
  },
  {
    id: 'spin-wheel',
    name: 'Spin-to-Win Wheel',
    category: 'Gamified',
    description: 'Interactive spin wheel with prize segments. Drives 3× more engagement than static popups.',
    trigger: 'Dwell 5s',
    position: 'center',
    colors: { bg: '#0f172a', accent: '#fbbf24', text: '#ffffff' },
    bgImage: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=60',
    preview: { badge: '🎡 SPIN & WIN', title: 'Try Your Luck!', body: 'Spin for up to 50% off. One spin per visit.', cta: 'Spin the Wheel' },
  },
];

function PopupMockup({ t }: { t: Template }) {
  if (t.position === 'top-bar') {
    return (
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2.5 z-10"
        style={{ backgroundColor: t.colors.bg }}
      >
        <p className="text-[9px] font-semibold truncate flex-1 pr-2" style={{ color: t.colors.text }}>
          {t.preview.title}
        </p>
        <button
          className="text-[8px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap text-white"
          style={{ backgroundColor: t.colors.accent }}
        >
          {t.preview.cta}
        </button>
      </div>
    );
  }

  if (t.position === 'bottom-right') {
    return (
      <div
        className="absolute bottom-3 right-3 w-44 rounded-xl shadow-2xl p-3.5 z-10 border"
        style={{
          backgroundColor: t.colors.bg,
          borderColor: `${t.colors.text}10`,
        }}
      >
        <span
          className="text-[8px] font-bold px-1.5 py-0.5 rounded-full inline-block mb-1.5"
          style={{ backgroundColor: `${t.colors.accent}20`, color: t.colors.accent }}
        >
          {t.preview.badge}
        </span>
        <p className="text-[9px] font-bold leading-tight mb-1" style={{ color: t.colors.text }}>
          {t.preview.title}
        </p>
        <p className="text-[8px] opacity-60 leading-tight mb-2" style={{ color: t.colors.text }}>
          {t.preview.body}
        </p>
        <div className="h-3.5 w-full rounded mb-1" style={{ backgroundColor: `${t.colors.accent}20`, border: `1px solid ${t.colors.accent}30` }} />
        <div className="h-4 w-full rounded flex items-center justify-center" style={{ backgroundColor: t.colors.accent }}>
          <span className="text-white text-[7px] font-bold">{t.preview.cta}</span>
        </div>
      </div>
    );
  }

  // Center modal
  return (
    <div
      className="w-52 rounded-2xl shadow-2xl overflow-hidden z-10 relative"
      style={{ backgroundColor: t.colors.bg, border: `1px solid ${t.colors.text}10` }}
    >
      <div className="p-4">
        <span
          className="text-[8px] font-bold px-2 py-0.5 rounded-full inline-block mb-2"
          style={{ backgroundColor: `${t.colors.accent}22`, color: t.colors.accent }}
        >
          {t.preview.badge}
        </span>
        <h3
          className="text-[11px] font-bold leading-tight mb-1"
          style={{ color: t.colors.text, fontFamily: 'serif' }}
        >
          {t.preview.title}
        </h3>
        <p className="text-[8px] leading-relaxed mb-3 opacity-65" style={{ color: t.colors.text }}>
          {t.preview.body}
        </p>
        <div
          className="h-5 w-full rounded-md mb-1.5"
          style={{ backgroundColor: `${t.colors.accent}12`, border: `1px solid ${t.colors.accent}30` }}
        />
        <div
          className="h-6 w-full rounded-md flex items-center justify-center"
          style={{ backgroundColor: t.colors.accent }}
        >
          <span className="text-white text-[8px] font-bold">{t.preview.cta}</span>
        </div>
        <p className="text-center text-[7px] mt-2 opacity-40" style={{ color: t.colors.text }}>
          No thanks
        </p>
      </div>
    </div>
  );
}

function TemplateCard({ t }: { t: Template }) {
  return (
    <div className="glass rounded-2xl overflow-hidden hover:border-neutral-300 hover:-translate-y-1 transition-all duration-300 flex flex-col group">
      {/* Preview */}
      <div className="relative h-52 overflow-hidden bg-neutral-900">
        {/* Background photo */}
        <img
          src={t.bgImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-35 group-hover:opacity-45 transition-opacity duration-500 group-hover:scale-105 transition-transform"
          referrerPolicy="no-referrer"
        />
        {/* Dark overlay for center modals */}
        {t.position === 'center' && (
          <div className="absolute inset-0 bg-black/40" />
        )}

        {/* Popup mockup */}
        <div className={`absolute inset-0 flex ${
          t.position === 'center' ? 'items-center justify-center' :
          t.position === 'bottom-right' ? 'items-end justify-end' :
          'items-start'
        }`}>
          <PopupMockup t={t} />
        </div>

        {/* Category + trigger badges */}
        <span className="absolute bottom-3 left-3 py-0.5 px-2.5 bg-neutral-900/80 backdrop-blur-sm rounded-full text-[9px] font-mono font-bold tracking-widest uppercase text-white z-20">
          {t.category}
        </span>
        <span
          className="absolute bottom-3 right-3 py-0.5 px-2.5 rounded-full text-[9px] font-mono font-bold z-20"
          style={{ backgroundColor: `${t.colors.accent}30`, color: t.colors.accent === '#ffffff' ? '#a5b4fc' : t.colors.accent }}
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
        <a
          href={DASHBOARD_URL}
          className="w-full h-9 font-mono text-[11px] font-bold uppercase tracking-wider rounded border border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          Use This Template <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

export default function TemplatesView() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-16 font-sans text-neutral-800">

      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] font-semibold block mb-3">POPUP TEMPLATES</span>
        <h1 className="font-serif text-4xl md:text-6xl font-normal tracking-tight leading-none text-gradient">
          Template library
        </h1>
        <p className="text-neutral-600 font-light text-base md:text-lg mt-4 leading-relaxed">
          Eight ready-to-launch popup types — every one fully editable in the visual builder. Pick one, match your brand, go live in minutes.
        </p>
        <a
          href={DASHBOARD_URL}
          className="inline-flex items-center gap-2 mt-8 h-12 px-8 bg-neutral-950 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-xl"
        >
          Browse All Templates in the Dashboard →
        </a>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {TEMPLATES.map((t) => <TemplateCard key={t.id} t={t} />)}
      </div>

      {/* Bottom CTA */}
      <div className="mt-20 p-12 glass rounded-3xl border border-neutral-200 flex flex-col lg:flex-row items-center justify-between gap-8">
        <div className="max-w-xl">
          <span className="text-[10px] font-mono tracking-widest text-[#C05621] uppercase block mb-1 font-semibold">VISUAL BUILDER</span>
          <h3 className="font-serif text-2xl md:text-3xl font-normal text-neutral-900">
            Every template is fully editable
          </h3>
          <p className="text-sm font-light text-neutral-600 mt-2 leading-relaxed">
            Drag, drop, resize — change colours, fonts, and layout to match your brand exactly. What you see in the editor is exactly what your visitors see.
          </p>
        </div>
        <a
          href={DASHBOARD_URL}
          className="h-12 px-8 bg-neutral-950 text-white rounded font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer flex items-center gap-2 shadow-lg whitespace-nowrap"
        >
          Start Building Free <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
