import { useState, FormEvent } from 'react';
import { ActivePage, FAQItem } from '../types';
import ScrollPopDemo from './ScrollPopDemo';
import {
  Sparkles, ArrowRight, Gauge, Layers, ShieldCheck, Zap,
  CheckCircle, HelpCircle, ChevronDown, Check,
  ShoppingBag, Globe
} from 'lucide-react';
import { motion } from 'motion/react';

const DASHBOARD_URL = 'https://dashboard.scrollpop.online';

interface HomeViewProps {
  onPageChange: (page: ActivePage) => void;
  onTriggerDemoPopup: (type: 'newsletter' | 'coupon' | 'slide-in') => void;
  selectedTemplateSettings?: any;
}

export default function HomeView({ onPageChange, onTriggerDemoPopup, selectedTemplateSettings }: HomeViewProps) {
  const [activeFaq, setActiveFaq] = useState<string | null>(null);
  const [auditInput, setAuditInput] = useState('');
  const [auditSubmitted, setAuditSubmitted] = useState(false);

  const faqs: FAQItem[] = [
    {
      id: 'faq_1',
      category: 'product',
      question: 'How is ScrollPop different from Privy, OptinMonster or Poptin?',
      answer: 'Most popup tools inject 120–250KB of external JavaScript that can hurt your Core Web Vitals. ScrollPop\'s snippet is ~10KB gzipped, loads asynchronously after the page is interactive (using requestIdleCallback), and renders entirely inside a Shadow DOM — so it never touches your host page CSS. You get a full visual drag-and-drop builder, real analytics, and campaign management, without the page-speed penalty.'
    },
    {
      id: 'faq_2',
      category: 'shopify',
      question: 'How do I install ScrollPop on Shopify?',
      answer: 'Add one small snippet to your theme: Shopify Admin → Online Store → Themes → Edit code, and paste the ScrollPop snippet (with your Public Key) just before </head>. The dashboard gives you the exact code to copy. A one-click Shopify app (OAuth auto-install + App Embed Block, no code) is coming soon.'
    },
    {
      id: 'faq_3',
      category: 'wordpress',
      question: 'How do I install ScrollPop on WordPress?',
      answer: 'On the Free plan, paste the ScrollPop snippet into your header (via your theme\'s functions.php or a "headers and footers" plugin) — the dashboard gives you the exact code. Paid plans also get the dedicated ScrollPop WordPress plugin: a thin PHP plugin you upload via WP Admin → Plugins → Upload, then paste your Public Key. Works with any theme, Gutenberg, Elementor, and WooCommerce.'
    },
    {
      id: 'faq_4',
      category: 'performance',
      question: 'Will popups hurt my Core Web Vitals or SEO?',
      answer: 'No. The snippet loads with async + defer and uses requestIdleCallback so it never blocks LCP. Popups render inside a closed Shadow DOM — zero CSS leakage, zero layout shift. All event beaconing uses navigator.sendBeacon (fire-and-forget, doesn\'t block unload). Google explicitly allows scroll-triggered and time-triggered popups that don\'t block content.'
    },
    {
      id: 'faq_5',
      category: 'billing',
      question: 'What counts as a "popup view"?',
      answer: 'A view is counted when the popup actually renders on a visitor\'s screen — not on page load. Bot traffic, your own visits while logged into the dashboard, and localhost/dev domains are automatically excluded from view counts. Views reset on the 1st of each month.'
    }
  ];

  const handleAuditRequest = (e: FormEvent) => {
    e.preventDefault();
    if (auditInput) setAuditSubmitted(true);
  };

  return (
    <div className="font-sans text-neutral-800 z-10 relative">

      {/* 1. HERO */}
      <section className="relative pt-12 md:pt-20 pb-20 overflow-hidden bg-transparent">
        <div className="max-w-7xl mx-auto px-6 text-center">

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-neutral-100 border border-neutral-200 rounded-full shadow-xs mb-8">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-900 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-neutral-900"></span>
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-600 font-semibold">WordPress & Shopify · Google-compliant · Free to start</span>
          </div>

          <h1 className="font-serif text-5xl md:text-7xl lg:text-[84px] leading-[0.9] text-gradient font-normal max-w-5xl mx-auto mb-8">
            Scroll-triggered popups.<br className="hidden md:inline" /> <span className="font-serif italic text-neutral-900">Built</span> to convert.
          </h1>

          <p className="font-sans font-light text-neutral-600 text-sm md:text-xl max-w-3xl mx-auto mt-6 leading-relaxed">
            Design affiliate popup campaigns in a visual editor. Install on WordPress or Shopify in minutes. Watch real-time analytics track every impression, click, and conversion.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 font-sans">
            <a
              href={DASHBOARD_URL}
              className="w-full sm:w-auto h-12 md:h-14 px-10 bg-neutral-950 text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-2xl hover:bg-neutral-800 transition-all flex items-center justify-center gap-2"
            >
              <span>Start Free — No Card Needed</span> <ArrowRight className="h-4 w-4" />
            </a>
            <button
              onClick={() => onPageChange('templates')}
              className="w-full sm:w-auto h-12 md:h-14 px-10 border border-neutral-300 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-neutral-50 text-neutral-800 transition-all cursor-pointer"
            >
              Browse Templates
            </button>
          </div>

          <div className="mt-20">
            <ScrollPopDemo />
          </div>
        </div>
      </section>

      {/* 2. TRUST STRIP */}
      <section className="bg-transparent py-14 border-y border-neutral-200/60">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500 mb-8 font-medium">
            RUNS ON WORDPRESS, SHOPIFY, DONORBOX, GOFUNDME, AND ANY HTML SITE
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-40 grayscale hover:opacity-75 transition-all duration-300">
            <span className="font-serif text-xl md:text-2xl font-bold tracking-widest text-neutral-800">WORDPRESS</span>
            <span className="font-sans text-xl md:text-2xl font-black tracking-tighter text-neutral-800">Shopify</span>
            <span className="font-serif text-xl md:text-2xl italic font-bold text-neutral-800">Donorbox</span>
            <span className="font-sans text-lg md:text-xl font-bold tracking-widest text-neutral-800">GOFUNDME</span>
            <span className="font-serif text-xl md:text-2xl font-semibold text-neutral-800">HTML/JS</span>
          </div>
        </div>
      </section>

      {/* 3. FEATURE BENTO GRID */}
      <section className="py-24 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] font-semibold block mb-3">PLATFORM CAPABILITIES</span>
          <h2 className="font-serif text-3xl md:text-5xl font-normal tracking-tight text-gradient">
            Everything in one dashboard
          </h2>
          <p className="text-neutral-600 font-light mt-3 text-sm md:text-base leading-relaxed">
            Visual builder, campaign management, analytics, and multi-platform installs — no code required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">

          <div className="md:col-span-7 glass p-8 rounded-2xl flex flex-col justify-between relative overflow-hidden group hover:border-neutral-300 transition-all duration-300">
            <span className="absolute top-0 right-0 h-16 w-16 bg-neutral-100/50 rounded-bl-full pointer-events-none transition-all duration-500 group-hover:scale-150" />
            <div>
              <div className="p-3 bg-neutral-100 text-[#111111] rounded-lg w-fit border border-neutral-200 mb-6">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="font-serif text-2xl font-normal text-neutral-900">Visual Drag-and-Drop Builder</h3>
              <p className="text-neutral-600 text-sm mt-3 font-light leading-relaxed max-w-lg">
                Design your popup exactly as it will appear on the live site. Position elements with pixel precision, customise fonts, colours, animations, and layout — then launch with one click.
              </p>
            </div>
            <div className="mt-8 pt-6 border-t border-neutral-200/60 flex items-center justify-between text-xs font-mono text-neutral-500">
              <span>38+ TEMPLATES ACROSS 14 CATEGORIES</span>
              <span className="text-neutral-900 font-bold">WYSIWYG RENDERS LIVE</span>
            </div>
          </div>

          <div className="md:col-span-5 glass p-8 rounded-2xl flex flex-col justify-between group hover:border-neutral-300 transition-all duration-300">
            <div>
              <div className="p-3 bg-neutral-100 text-[#111111] rounded-lg w-fit border border-neutral-200 mb-6">
                <Gauge className="h-6 w-6" />
              </div>
              <h3 className="font-serif text-2xl font-normal text-neutral-900">Real Analytics, Not Vanity Metrics</h3>
              <p className="text-neutral-600 text-sm mt-3 font-light leading-relaxed">
                Track impressions, views, clicks, dismissals, and conversions. Device split, top countries, trigger breakdown, and funnel conversion rates — updated in real time.
              </p>
            </div>
            <div className="mt-8 flex gap-2">
              <span className="h-1.5 w-6 bg-neutral-800 rounded-full" />
              <span className="h-1.5 w-1.5 bg-neutral-300 rounded-full" />
              <span className="h-1.5 w-1.5 bg-neutral-300 rounded-full" />
            </div>
          </div>

          <div className="md:col-span-5 glass p-8 rounded-2xl flex flex-col justify-between group hover:border-neutral-300 transition-all duration-300">
            <div>
              <div className="p-3 bg-neutral-100 text-[#111111] rounded-lg w-fit border border-neutral-200 mb-6">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="font-serif text-2xl font-normal text-neutral-900">Google-Compliant by Design</h3>
              <p className="text-neutral-600 text-sm mt-3 font-light leading-relaxed">
                ScrollPop never uses back-button capture, history manipulation, or popstate listeners — techniques banned by Google since June 2026. Every trigger is scroll-depth, dwell-time, inactivity, or exit-intent (cursor).
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-neutral-200/60 text-xs font-mono text-neutral-500">
              <span>NO HISTORY.PUSHSTATE. EVER.</span>
            </div>
          </div>

          <div className="md:col-span-7 glass p-8 rounded-2xl flex flex-col justify-between relative overflow-hidden group hover:border-neutral-300 transition-all duration-300">
            <div>
              <div className="p-3 bg-neutral-100 text-[#111111] rounded-lg w-fit border border-neutral-200 mb-6">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="font-serif text-2xl font-normal text-neutral-900">Smart Trigger System</h3>
              <p className="text-neutral-600 text-sm mt-3 font-light leading-relaxed max-w-lg">
                Show the right popup at the right moment. Combine scroll depth, time on page, inactivity, and exit-intent triggers with frequency rules (once per session, day, or visitor) and device/URL targeting.
              </p>
            </div>
            <div className="mt-8 pt-6 border-t border-neutral-200/60 flex flex-wrap items-center gap-3 text-[10px] font-mono text-neutral-500">
              <span className="px-2.5 py-1 bg-neutral-100 border border-neutral-250 rounded">SCROLL DEPTH</span>
              <span className="px-2.5 py-1 bg-neutral-100 border border-neutral-250 rounded">DWELL TIME</span>
              <span className="px-2.5 py-1 bg-neutral-100 border border-neutral-250 rounded">EXIT INTENT</span>
              <span className="px-2.5 py-1 bg-neutral-100 border border-neutral-250 rounded">INACTIVITY</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section className="py-24 bg-transparent border-y border-neutral-200/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] block mb-3 font-semibold">GETTING STARTED</span>
            <h2 className="font-serif text-3xl md:text-5xl font-normal tracking-tight text-gradient">
              Live in under 5 minutes
            </h2>
            <p className="text-neutral-600 font-light mt-3 text-sm md:text-base leading-relaxed">
              No developer needed. No code editing required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="flex flex-col gap-6">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-neutral-100 border border-neutral-250 text-neutral-900 font-mono text-sm font-bold flex items-center justify-center shadow-xs">01</div>
              <div>
                <h4 className="font-serif text-xl font-normal text-neutral-900">Sign up & connect your site</h4>
                <p className="text-neutral-600 text-sm font-light mt-2.5 leading-relaxed">
                  Create a free account and register your domain. Paste a single snippet into any site — WordPress, Shopify, or plain HTML. Paid plans also get the dedicated WordPress plugin. Takes under 2 minutes.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-neutral-100 border border-neutral-250 text-neutral-900 font-mono text-sm font-bold flex items-center justify-center shadow-xs">02</div>
              <div>
                <h4 className="font-serif text-xl font-normal text-neutral-900">Design your campaign</h4>
                <p className="text-neutral-600 text-sm font-light mt-2.5 leading-relaxed">
                  Pick a template or build from scratch in the visual editor. Set your trigger (scroll %, exit intent, time delay), frequency rules, and targeting. Preview exactly what visitors will see.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-neutral-100 border border-neutral-250 text-neutral-900 font-mono text-sm font-bold flex items-center justify-center shadow-xs">03</div>
              <div>
                <h4 className="font-serif text-xl font-normal text-neutral-900">Launch & track performance</h4>
                <p className="text-neutral-600 text-sm font-light mt-2.5 leading-relaxed">
                  Click Launch. Your campaign goes live instantly. Watch impressions, clicks, and conversions flow into the analytics dashboard in real time — broken down by device, country, and trigger type.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. TEMPLATE SHOWCASE */}
      <section className="py-24 max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5 flex flex-col gap-6">
          <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] font-semibold block">38+ TEMPLATES</span>
          <h2 className="font-serif text-3xl md:text-5xl font-normal text-neutral-900 tracking-tight leading-none">
            Every campaign type, ready to launch
          </h2>
          <p className="text-neutral-600 font-light text-sm md:text-base leading-relaxed">
            Welcome offers, exit-intent coupons, email captures, upsell cross-sells, seasonal sales — 14 categories, all editable in the visual builder.
          </p>
          <div className="flex flex-col gap-3 text-xs text-neutral-700 font-light mt-2">
            {['Welcome + first-order discount', 'Exit-intent coupon with countdown timer', 'Email capture with free gift incentive', 'Black Friday / seasonal promotions', 'Spin-to-win and scratch-card gamification'].map(f => (
              <div key={f} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-neutral-800 flex-shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => onPageChange('templates')}
            className="w-fit h-11 px-6 mt-4 rounded-full bg-neutral-950 text-[#FAF9F5] hover:bg-neutral-800 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 shadow-xl"
          >
            <span>Browse All Templates</span> <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="lg:col-span-7 grid grid-cols-2 gap-4">
          {[
            { label: 'Welcome Popup', sub: 'First-order discount + email capture', btn: 'See template' },
            { label: 'Exit Intent', sub: 'Last-chance coupon with countdown', btn: 'See template' },
            { label: 'Email Capture', sub: 'Lead magnet + free course offer', btn: 'See template' },
            { label: 'Seasonal Sale', sub: 'Black Friday / Christmas countdown', btn: 'See template' },
          ].map((card) => (
            <div key={card.label} className="p-6 glass rounded-xl flex flex-col justify-between gap-4 hover:border-neutral-300 transition-all">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500">{card.label}</span>
                <div className="font-serif text-neutral-900 text-base font-normal mt-2 italic">{card.sub}</div>
              </div>
              <button
                onClick={() => onPageChange('templates')}
                className="text-xs font-mono uppercase text-neutral-600 hover:text-neutral-900 underline text-left cursor-pointer"
              >
                {card.btn}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 6. PLATFORMS */}
      <section className="py-24 bg-transparent border-y border-neutral-200/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div className="p-8 md:p-12 rounded-2xl glass flex flex-col gap-6 hover:border-neutral-300 transition-all">
              <div className="h-12 w-12 rounded-xl bg-neutral-950 text-white flex items-center justify-center shadow-lg">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-serif text-3xl font-normal text-neutral-900">For Shopify</h3>
                <p className="text-sm font-light text-neutral-600 leading-relaxed mt-3">
                  Add one snippet to your theme's <code className="font-mono text-xs">theme.liquid</code> (Online Store → Themes → Edit code) just before <code className="font-mono text-xs">&lt;/head&gt;</code>. The dashboard gives you the exact code. A one-click Shopify app — OAuth auto-install and an App Embed Block with no code — is coming soon.
                </p>
                <button onClick={() => onPageChange('integration-guide')} className="mt-4 text-xs font-mono uppercase text-[#C05621] hover:underline cursor-pointer">View Shopify install guide →</button>
              </div>
            </div>

            <div className="p-8 md:p-12 rounded-2xl glass flex flex-col gap-6 hover:border-neutral-300 transition-all">
              <div className="h-12 w-12 rounded-xl bg-neutral-950 text-white flex items-center justify-center shadow-lg">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-serif text-3xl font-normal text-neutral-900">For WordPress</h3>
                <p className="text-sm font-light text-neutral-600 leading-relaxed mt-3">
                  On the Free plan, paste the ScrollPop snippet into your site header (via functions.php or a headers/footers plugin). Paid plans unlock the dedicated WordPress plugin — upload via WP Admin → Plugins → Upload → Activate, then paste your Public Key. Works with every theme, Gutenberg, Elementor, and WooCommerce.
                </p>
                <button onClick={() => onPageChange('integration-guide')} className="mt-4 text-xs font-mono uppercase text-[#C05621] hover:underline cursor-pointer">View WordPress install guide →</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. PERFORMANCE */}
      <section className="py-24 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 flex flex-col gap-6 pb-6 lg:pb-0">
            <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] font-semibold block">PERFORMANCE</span>
            <h2 className="font-serif text-3xl md:text-5xl font-normal text-neutral-900 tracking-tight leading-none">
              Fast enough to be invisible
            </h2>
            <p className="text-neutral-600 font-light text-sm md:text-base leading-relaxed">
              ScrollPop loads after your page is fully interactive using requestIdleCallback. Popups render in an isolated Shadow DOM. Event analytics fire via sendBeacon. Your Core Web Vitals score won't move.
            </p>
          </div>

          <div className="lg:col-span-7 glass p-8 md:p-10 rounded-2xl flex flex-col gap-8">
            <div className="flex items-center gap-3 justify-between border-b border-neutral-200 pb-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Snippet payload comparison</span>
              <span className="text-neutral-800 font-mono text-[9px] uppercase font-bold bg-neutral-100 border border-neutral-200 px-2.5 py-1 rounded">GZIPPED SIZE</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between font-mono text-xs text-neutral-500">
                <span>Typical popup apps (React + trackers + iframes)</span>
                <span className="font-bold text-red-600">120–250 KB</span>
              </div>
              <div className="w-full bg-neutral-100 h-9 rounded-full border border-neutral-200 overflow-hidden relative flex items-center px-4 text-xs">
                <div className="absolute top-0 bottom-0 left-0 bg-red-100 border-r-2 border-red-500 w-[85%]" />
                <span className="relative z-10 text-red-800 font-medium">Blocks rendering · layout shift · slow LCP</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between font-mono text-xs text-neutral-500">
                <span>ScrollPop snippet</span>
                <span className="font-bold text-neutral-800">~10 KB gzipped</span>
              </div>
              <div className="w-full bg-neutral-100 h-9 rounded-full border border-neutral-200 overflow-hidden relative flex items-center px-4 text-xs">
                <div className="absolute top-0 bottom-0 left-0 bg-emerald-50 border-r-2 border-emerald-500 w-[7%]" />
                <span className="relative z-10 text-emerald-800 font-medium">Loads after idle · Shadow DOM · 0 CLS</span>
              </div>
            </div>
            <div className="pt-4 border-t border-neutral-200 text-center text-xs font-light text-neutral-500 leading-normal">
              Loads async, deferred until after page interactive. Never blocks LCP or FID.
            </div>
          </div>
        </div>
      </section>

      {/* 8. COMPARISON TABLE */}
      <section className="py-24 bg-transparent border-y border-neutral-200/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] font-semibold block mb-3">WHY SCROLLPOP</span>
            <h2 className="font-serif text-3xl md:text-5xl font-normal text-neutral-900 tracking-tight">
              How we compare
            </h2>
          </div>
          <div className="w-full glass border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-neutral-50 text-neutral-800 font-mono text-[10px] tracking-widest uppercase">
                    <th className="p-5 border-b border-neutral-200">Feature</th>
                    <th className="p-5 border-b border-neutral-200">Privy / OptinMonster</th>
                    <th className="p-5 border-b border-neutral-200 bg-neutral-100/50 text-neutral-900 font-bold">ScrollPop</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-sans text-neutral-700">
                  {[
                    ['Snippet size',          '120–250 KB (blocks render)',       '~10 KB gzipped (async)'],
                    ['Core Web Vitals impact','Causes layout shift + slow LCP',   '0 CLS · 0 LCP impact'],
                    ['Visual builder',        'Template-locked or code required', 'Full drag-and-drop canvas'],
                    ['Analytics',             'Basic clicks / opens',             'Impressions, CTR, funnel, device, country'],
                    ['Google compliance',     'Many use banned back-button tricks','Never — history.pushState banned by design'],
                    ['WordPress install',     'Plugin (some are bloated)',         'Snippet (free) · WP plugin (paid)'],
                    ['Shopify install',       'App embed or script injection',    'theme.liquid snippet · 1-click app soon'],
                    ['Pricing',               '$29–$199/mo',                      'Free → $19–$299/mo'],
                  ].map(([feature, competitor, us]) => (
                    <tr key={feature}>
                      <td className="p-5 font-normal text-neutral-900 text-xs">{feature}</td>
                      <td className="p-5 text-neutral-500 text-xs">{competitor}</td>
                      <td className="p-5 font-mono text-neutral-900 font-bold text-xs bg-neutral-100/30">{us}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 10. FAQ */}
      <section className="py-24 bg-transparent border-y border-neutral-200/60">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] font-semibold block mb-3">FAQ</span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-gradient">Common questions</h2>
          </div>
          <div className="flex flex-col gap-4 font-sans text-sm text-neutral-800">
            {faqs.map((f) => {
              const active = activeFaq === f.id;
              return (
                <div key={f.id} className="glass rounded-xl overflow-hidden transition-all duration-300 hover:border-neutral-300">
                  <button
                    onClick={() => setActiveFaq(active ? null : f.id)}
                    className="w-full p-5 flex items-center justify-between text-left font-semibold text-neutral-800 hover:text-neutral-950 cursor-pointer"
                  >
                    <span>{f.question}</span>
                    <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform duration-300 ${active ? 'rotate-180' : ''}`} />
                  </button>
                  {active && (
                    <div className="px-5 pb-5 pt-3 text-xs text-neutral-600 font-light leading-relaxed border-t border-neutral-100">
                      <p>{f.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 11. FINAL CTA */}
      <section className="py-24 max-w-4xl mx-auto px-6 text-center flex flex-col items-center gap-6">
        <span className="text-xs font-mono uppercase tracking-widest text-neutral-800 font-bold block bg-neutral-100 border border-neutral-200 py-1.5 px-4 rounded-full shadow-xs">
          FREE PLAN · NO CARD REQUIRED
        </span>
        <h2 className="font-serif text-4xl md:text-5xl font-normal text-gradient tracking-tight leading-none">
          Ready to launch your first campaign?
        </h2>
        <p className="text-neutral-600 text-sm md:text-base font-light max-w-xl mx-auto leading-relaxed">
          Sign up free, connect your WordPress or Shopify site, and have a live scroll-triggered popup in under 5 minutes.
        </p>

        {!auditSubmitted ? (
          <form
            onSubmit={handleAuditRequest}
            className="w-full max-w-md flex flex-col sm:flex-row items-center gap-2 mt-4 font-sans text-xs"
          >
            <input
              required
              type="email"
              placeholder="Enter your email to get started"
              value={auditInput}
              onChange={(e) => setAuditInput(e.target.value)}
              className="w-full h-12 border border-neutral-250 rounded-full px-5 bg-white text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:border-neutral-450 transition-colors"
            />
            <a
              href={DASHBOARD_URL}
              className="w-full sm:w-auto h-12 px-8 bg-neutral-950 hover:bg-neutral-800 text-white font-mono uppercase tracking-wider font-bold rounded-full whitespace-nowrap cursor-pointer transition-all shadow-xl flex items-center justify-center"
            >
              Start Free →
            </a>
          </form>
        ) : (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-xs font-semibold max-w-md mt-4">
            <p className="flex items-center justify-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Head to dashboard.scrollpop.online to complete your free account setup.</span>
            </p>
          </div>
        )}
      </section>

    </div>
  );
}
