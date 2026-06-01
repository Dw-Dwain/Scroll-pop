import { useState } from 'react';
import { RefreshCw, Smartphone, Laptop, ArrowRight, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DASHBOARD_URL = 'https://dashboard.scrollpop.online';

type Position = 'center' | 'top-bar' | 'bottom-bar' | 'bottom-right';

interface Template {
  id: string;
  label: string;
  tag: string;
  title: string;
  body: string;
  cta: string;
  bg: string;
  accent: string;
  text: string;
  radius: number;
  position: Position;
  trigger: string;
  isAffiliate?: boolean;
  hasEmailInput?: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: 'welcome',
    label: 'Welcome',
    tag: '🎁 FIRST ORDER',
    title: 'Welcome! Get 10% Off',
    body: "Sign up and we'll send your exclusive coupon instantly. No spam, unsubscribe any time.",
    cta: 'Claim My 10% Off',
    bg: '#ffffff',
    accent: '#6366f1',
    text: '#111827',
    radius: 24,
    position: 'center',
    trigger: 'Scroll 30%',
    hasEmailInput: true,
  },
  {
    id: 'exit',
    label: 'Exit Intent',
    tag: '⏳ LAST CHANCE',
    title: "Wait — 20% off just for you",
    body: "We don't do this often. This offer expires when you close the window.",
    cta: 'Claim 20% Off Now',
    bg: '#0f172a',
    accent: '#f59e0b',
    text: '#ffffff',
    radius: 16,
    position: 'center',
    trigger: 'Exit intent',
    hasEmailInput: true,
  },
  {
    id: 'header-bar',
    label: 'Header Bar',
    tag: '🔔 ANNOUNCEMENT',
    title: '🚚 Free shipping on orders over $50 — ends tonight!',
    body: '',
    cta: 'Shop Now',
    bg: '#1e1b4b',
    accent: '#a5b4fc',
    text: '#ffffff',
    radius: 0,
    position: 'top-bar',
    trigger: 'Page load',
  },
  {
    id: 'footer-bar',
    label: 'Footer Bar',
    tag: '📣 STICKY OFFER',
    title: 'Get 15% off your first order — no code needed',
    body: '',
    cta: 'Claim Offer',
    bg: '#064e3b',
    accent: '#34d399',
    text: '#ffffff',
    radius: 0,
    position: 'bottom-bar',
    trigger: 'Scroll 20%',
  },
  {
    id: 'slide-in',
    label: 'Side Slide-in',
    tag: '💬 SOFT PROMPT',
    title: 'Before you go…',
    body: 'Join 5,000+ subscribers and get weekly deals straight to your inbox.',
    cta: "Yes, I'm In",
    bg: '#ffffff',
    accent: '#7c3aed',
    text: '#111827',
    radius: 16,
    position: 'bottom-right',
    trigger: 'Dwell 8s',
    hasEmailInput: true,
  },
  {
    id: 'affiliate',
    label: 'Affiliate Deal',
    tag: '🛍️ PARTNER DEAL',
    title: 'Trending: Premium Skincare Kit',
    body: "Editor's pick. Loved by 2,400+ customers. Free shipping today only.",
    cta: 'See This Deal →',
    bg: '#fffbf0',
    accent: '#d97706',
    text: '#1c1917',
    radius: 20,
    position: 'center',
    trigger: 'Scroll 60%',
    isAffiliate: true,
  },
];

export default function ScrollPopDemo() {
  const [activeTemplate, setActiveTemplate] = useState(0);
  const [activeTab, setActiveTab] = useState<'preview' | 'install'>('preview');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [visible, setVisible] = useState(true);

  const tpl = TEMPLATES[activeTemplate];

  const replayPopup = () => {
    setVisible(false);
    setTimeout(() => setVisible(true), 300);
  };

  const switchTemplate = (i: number) => {
    setActiveTemplate(i);
    setVisible(false);
    setTimeout(() => setVisible(true), 300);
  };

  return (
    <div className="w-full bg-white border border-[#E9E4D9] rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">

      {/* LEFT: Template picker + controls */}
      <div className="lg:col-span-5 border-r border-[#E9E4D9] p-6 flex flex-col gap-5 bg-[#FAF9F5]">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#C05621] uppercase block mb-1">LIVE DEMO</span>
          <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">See it in action</h3>
          <p className="text-zinc-500 text-sm mt-1">
            Real popup templates from the ScrollPop library. Build these in minutes with the visual editor.
          </p>
        </div>

        {/* Template selector — 2×3 grid */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Campaign type</label>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t, i) => (
              <button
                key={t.id}
                onClick={() => switchTemplate(i)}
                className={`text-left p-3 border rounded-lg transition-all cursor-pointer ${
                  activeTemplate === i
                    ? 'border-[#C05621] ring-1 ring-[#C05621] bg-white'
                    : 'border-[#E9E4D9] bg-white hover:border-neutral-400'
                }`}
              >
                <span className="text-xs font-semibold text-[#1A1A1A] block leading-tight">{t.label}</span>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="h-3 w-3 rounded-sm border border-zinc-200 shrink-0" style={{ backgroundColor: t.bg === '#ffffff' ? '#f3f4f6' : t.bg }} />
                  <span className="h-3 w-3 rounded-sm border border-zinc-200 shrink-0" style={{ backgroundColor: t.accent }} />
                  <span className="text-[9px] text-zinc-400 font-mono truncate">{t.trigger}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tab: Preview vs Install */}
        <div className="flex gap-1 border border-[#E9E4D9] rounded-lg p-1 bg-white">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider rounded-md transition-all cursor-pointer ${
              activeTab === 'preview' ? 'bg-[#1A1A1A] text-white' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setActiveTab('install')}
            className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'install' ? 'bg-[#1A1A1A] text-white' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Lock className="h-3 w-3" /> Install snippet
          </button>
        </div>

        {activeTab === 'preview' ? (
          <>
            {/* Device toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDeviceMode('desktop')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-md cursor-pointer transition-all ${deviceMode === 'desktop' ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'border-[#E9E4D9] text-neutral-500 hover:bg-neutral-50'}`}
              >
                <Laptop className="h-3 w-3" /> Desktop
              </button>
              <button
                onClick={() => setDeviceMode('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-md cursor-pointer transition-all ${deviceMode === 'mobile' ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'border-[#E9E4D9] text-neutral-500 hover:bg-neutral-50'}`}
              >
                <Smartphone className="h-3 w-3" /> Mobile
              </button>
            </div>

            {/* Replay button */}
            <button
              onClick={replayPopup}
              className="flex items-center justify-center gap-2 h-10 border border-neutral-300 rounded-lg text-xs font-mono uppercase tracking-wider hover:bg-neutral-50 transition-all cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Replay popup
            </button>

            {/* CTA */}
            <div className="mt-auto pt-4 border-t border-[#E9E4D9]">
              <p className="text-xs text-neutral-500 mb-3">Build this in the visual editor — free to start.</p>
              <a
                href={DASHBOARD_URL}
                className="w-full h-10 bg-[#1A1A1A] text-white rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all"
              >
                Start Building Free <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </>
        ) : (
          /* Install tab — sign-up gate */
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center">
              <Lock className="h-5 w-5 text-neutral-400" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-[#1A1A1A] mb-1">Sign up to get your snippet</h4>
              <p className="text-xs text-neutral-500 leading-relaxed max-w-[240px] mx-auto">
                Create a free account to get your unique public key and install snippet for HTML, Shopify, or WordPress.
              </p>
            </div>
            <a
              href={DASHBOARD_URL}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C05621] hover:bg-[#a84d1e] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            >
              Create Free Account <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* RIGHT: Live popup preview */}
      <div className="lg:col-span-7 bg-[#111111] flex flex-col min-h-[520px] relative overflow-hidden">

        {/* Popup preview canvas */}
        <div className="flex-1 relative overflow-hidden">

          {/* Fake page skeleton */}
          <div className="absolute inset-0 opacity-10 pointer-events-none select-none">
            <div className="w-full h-8 bg-white/20 mb-3" />
            <div className="mx-8 mt-4 space-y-2">
              {[80, 60, 90, 50, 70, 85, 55].map((w, i) => (
                <div key={i} className="h-2 bg-white/20 rounded" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>

          {/* Overlay — only for center modals */}
          {tpl.position === 'center' && visible && (
            <div className="absolute inset-0 bg-black/45 z-[5]" />
          )}

          {/* TOP BAR */}
          <AnimatePresence>
            {visible && tpl.position === 'top-bar' && (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, y: -48 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -48 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 gap-3"
                style={{ backgroundColor: tpl.bg }}
              >
                <p className="text-xs font-semibold truncate flex-1" style={{ color: tpl.text }}>
                  {tpl.title}
                </p>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
                    style={{ backgroundColor: tpl.accent, color: '#fff' }}
                  >
                    {tpl.cta}
                  </button>
                  <button
                    onClick={() => setVisible(false)}
                    className="text-sm leading-none opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                    style={{ color: tpl.text }}
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* BOTTOM BAR */}
          <AnimatePresence>
            {visible && tpl.position === 'bottom-bar' && (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, y: 48 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 48 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 gap-3"
                style={{ backgroundColor: tpl.bg }}
              >
                <p className="text-xs font-semibold truncate flex-1" style={{ color: tpl.text }}>
                  {tpl.title}
                </p>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
                    style={{ backgroundColor: tpl.accent, color: '#fff' }}
                  >
                    {tpl.cta}
                  </button>
                  <button
                    onClick={() => setVisible(false)}
                    className="text-sm leading-none opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                    style={{ color: tpl.text }}
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* BOTTOM-RIGHT SLIDE-IN */}
          <AnimatePresence>
            {visible && tpl.position === 'bottom-right' && (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, x: 80, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 80 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-4 right-4 z-20 shadow-2xl overflow-hidden"
                style={{
                  backgroundColor: tpl.bg,
                  borderRadius: `${tpl.radius}px`,
                  width: deviceMode === 'mobile' ? '210px' : '260px',
                  border: `1px solid ${tpl.text}12`,
                }}
              >
                <button
                  onClick={() => setVisible(false)}
                  className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] cursor-pointer transition-opacity hover:opacity-70"
                  style={{ background: `${tpl.text}15`, color: tpl.text }}
                >
                  ✕
                </button>
                <div className="p-4">
                  <div
                    className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mb-2"
                    style={{ background: `${tpl.accent}20`, color: tpl.accent }}
                  >
                    {tpl.tag}
                  </div>
                  <h3
                    className="text-sm font-bold leading-tight mb-1.5"
                    style={{ color: tpl.text, fontFamily: 'serif' }}
                  >
                    {tpl.title}
                  </h3>
                  <p
                    className="text-[11px] leading-relaxed mb-3 opacity-70"
                    style={{ color: tpl.text }}
                  >
                    {tpl.body}
                  </p>
                  {tpl.hasEmailInput && (
                    <input
                      type="email"
                      placeholder="your@email.com"
                      className="w-full text-[11px] px-2.5 py-1.5 border rounded mb-2 outline-none"
                      style={{
                        borderColor: `${tpl.accent}40`,
                        borderRadius: '6px',
                        backgroundColor: `${tpl.text}08`,
                        color: tpl.text,
                      }}
                    />
                  )}
                  <button
                    className="w-full py-2 text-[11px] font-bold text-white"
                    style={{ backgroundColor: tpl.accent, borderRadius: '6px' }}
                  >
                    {tpl.cta}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CENTER MODAL */}
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <AnimatePresence>
              {visible && tpl.position === 'center' && (
                <motion.div
                  key={tpl.id}
                  initial={{ opacity: 0, y: 20, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="relative z-10 shadow-2xl overflow-hidden"
                  style={{
                    backgroundColor: tpl.bg,
                    borderRadius: `${tpl.radius}px`,
                    width: deviceMode === 'mobile' ? '280px' : '360px',
                    maxWidth: '100%',
                  }}
                >
                  <button
                    onClick={() => setVisible(false)}
                    className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all cursor-pointer"
                    style={{ background: `${tpl.text}15`, color: tpl.text }}
                  >
                    ✕
                  </button>

                  <div className={`p-6 ${tpl.isAffiliate ? 'flex gap-4 items-start' : ''}`}>
                    {/* Affiliate product image */}
                    {tpl.isAffiliate && (
                      <div
                        className="w-20 h-20 rounded-xl flex items-center justify-center shrink-0 text-3xl border"
                        style={{ backgroundColor: `${tpl.accent}15`, borderColor: `${tpl.accent}30` }}
                      >
                        🧴
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div
                        className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-3"
                        style={{ background: `${tpl.accent}20`, color: tpl.accent }}
                      >
                        {tpl.tag}
                      </div>

                      <h3
                        className="text-lg font-bold leading-tight mb-2"
                        style={{ color: tpl.text, fontFamily: 'serif' }}
                      >
                        {tpl.title}
                      </h3>

                      <p
                        className="text-xs leading-relaxed mb-4 opacity-75"
                        style={{ color: tpl.text }}
                      >
                        {tpl.body}
                      </p>

                      {tpl.hasEmailInput && (
                        <input
                          type="email"
                          placeholder="your@email.com"
                          className="w-full text-xs px-3 py-2 border rounded-lg mb-3 outline-none"
                          style={{
                            borderColor: `${tpl.accent}40`,
                            borderRadius: `${Math.min(tpl.radius / 2, 8)}px`,
                            backgroundColor: `${tpl.text}08`,
                            color: tpl.text,
                          }}
                        />
                      )}

                      <button
                        className="w-full py-2.5 text-xs font-bold text-white transition-all"
                        style={{
                          backgroundColor: tpl.accent,
                          borderRadius: `${Math.min(tpl.radius / 2, 8)}px`,
                        }}
                      >
                        {tpl.cta}
                      </button>

                      {!tpl.isAffiliate && (
                        <p
                          className="text-center text-[10px] mt-3 opacity-40 cursor-pointer hover:opacity-70"
                          style={{ color: tpl.text }}
                          onClick={() => setVisible(false)}
                        >
                          No thanks
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Replay prompt when dismissed */}
          {!visible && (
            <div className="absolute inset-0 flex items-center justify-center z-30">
              <button
                onClick={replayPopup}
                className="text-white/50 text-xs font-mono flex items-center gap-2 hover:text-white transition-all cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Click to replay
              </button>
            </div>
          )}
        </div>

        {/* Bottom nav dots */}
        <div className="px-5 py-3 border-t border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex gap-1">
            {TEMPLATES.map((t, i) => (
              <button
                key={t.id}
                onClick={() => switchTemplate(i)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${activeTemplate === i ? 'w-6 bg-[#C05621]' : 'w-1.5 bg-neutral-600 hover:bg-neutral-400'}`}
              />
            ))}
          </div>
          <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider">
            {TEMPLATES[activeTemplate].label} · {TEMPLATES[activeTemplate].trigger}
          </span>
        </div>
      </div>
    </div>
  );
}
