import { useState } from 'react';
import { ArrowRight, Check, AlertTriangle, ShieldCheck } from 'lucide-react';

const DASHBOARD_URL = 'https://dashboard.scrollpop.online';

const ANNUAL_DISCOUNT = 0.2; // 20% off annual

export default function PricingView() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  const tiers = [
    {
      id: 'free',
      name: 'Free',
      badge: 'NO CARD REQUIRED',
      priceMonthly: 0,
      description: 'Everything you need to run your first popup campaign.',
      views: '1,000 popup views / mo',
      features: [
        '1 site',
        '1 active campaign',
        'Visual drag-and-drop builder',
        '38+ popup templates',
        'Snippet install — WordPress, Shopify & HTML',
        'Scroll / dwell / exit triggers',
        'Basic analytics (impressions, clicks, CTR)',
      ],
      cta: 'Start Free',
      popular: false,
      href: `${DASHBOARD_URL}/sign-up`,
    },
    {
      id: 'starter',
      name: 'Starter',
      badge: 'MOST POPULAR',
      priceMonthly: 19,
      description: 'For solo creators, bloggers and affiliate publishers.',
      views: '25,000 popup views / mo',
      features: [
        '3 sites',
        '5 active campaigns',
        'Everything in Free',
        'Dedicated WordPress plugin',
        'No "Powered by ScrollPop" badge',
        'Priority support',
      ],
      cta: 'Start Starter',
      popular: true,
      href: `${DASHBOARD_URL}/sign-up`,
    },
    {
      id: 'growth',
      name: 'Growth',
      badge: 'BEST VALUE',
      priceMonthly: 49,
      description: 'For growing affiliate sites and content publishers.',
      views: '150,000 popup views / mo',
      features: [
        '10 sites',
        '20 active campaigns',
        'Everything in Starter',
        'A/B testing',
        'Advanced analytics',
        'Custom webhook on conversion',
        'Geo targeting',
      ],
      cta: 'Start Growth',
      popular: false,
      href: `${DASHBOARD_URL}/sign-up`,
    },
    {
      id: 'scale',
      name: 'Scale',
      badge: 'HIGH VOLUME',
      priceMonthly: 129,
      description: 'For high-traffic publishers and media companies.',
      views: '500,000 popup views / mo',
      features: [
        'Unlimited sites',
        'Unlimited campaigns',
        'Everything in Growth',
        'Shopify App Embed Block',
        'API access',
      ],
      cta: 'Start Scale',
      popular: false,
      href: `${DASHBOARD_URL}/sign-up`,
    },
    {
      id: 'agency',
      name: 'Agency',
      badge: 'UNLIMITED',
      priceMonthly: 299,
      description: 'For agencies and high-volume affiliate networks.',
      views: '2,000,000 popup views / mo',
      features: [
        'Unlimited everything',
        'Everything in Scale',
        'White-label (remove branding)',
        'Team member access',
        'Dedicated support',
        'Custom integrations',
      ],
      cta: 'Start Agency',
      popular: false,
      href: `${DASHBOARD_URL}/sign-up`,
    },
  ];

  const price = (monthly: number) => {
    if (monthly === 0) return 0;
    return billing === 'annual' ? Math.round(monthly * (1 - ANNUAL_DISCOUNT)) : monthly;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-16 font-sans text-neutral-800">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] font-semibold block mb-3">TRANSPARENT PRICING</span>
        <h1 className="font-serif text-4xl md:text-6xl font-normal tracking-tight leading-none text-gradient">
          Simple, honest plans
        </h1>
        <p className="text-neutral-600 font-light text-base md:text-lg mt-4 leading-relaxed">
          Start free — no card required. Paid plans are launching soon; you'll stay on Free until checkout opens.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-1.5 bg-[#111111] border border-neutral-900 p-1.5 rounded-full mt-10">
          <button
            onClick={() => setBilling('monthly')}
            className={`py-2 px-5 text-xs font-semibold rounded-full uppercase tracking-wider transition-all cursor-pointer ${
              billing === 'monthly' ? 'bg-[#FAF9F5] text-neutral-900 font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`py-2 px-5 text-xs font-semibold rounded-full uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              billing === 'annual' ? 'bg-[#FAF9F5] text-neutral-900 font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Annual <span className="bg-neutral-800 border border-neutral-700 text-white text-[9px] px-2 py-0.5 rounded-full">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Pricing grid — 5 columns on xl, 3 on lg, 1 on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 items-stretch mb-20">
        {tiers.map((tier) => {
          const p = price(tier.priceMonthly);
          return (
            <div
              key={tier.id}
              className={`glass rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 relative overflow-hidden backdrop-blur-md ${
                tier.popular
                  ? 'border-[#C05621] ring-2 ring-[#C05621]/15 shadow-2xl lg:-translate-y-2'
                  : 'border-neutral-200/80 hover:border-neutral-300 hover:-translate-y-1 shadow-xs'
              }`}
            >
              {tier.popular && (
                <div className="absolute top-0 right-0 bg-[#C05621] text-white text-[9px] font-mono uppercase tracking-widest font-extrabold py-1.5 px-6 rotate-45 translate-x-7 translate-y-3.5 z-10 shadow-md">
                  POPULAR
                </div>
              )}

              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#C05621] block mb-2">{tier.badge}</span>
                <h3 className="font-serif text-2xl font-normal text-neutral-900">{tier.name}</h3>
                <p className="text-xs text-neutral-600 mt-2 font-light leading-relaxed">{tier.description}</p>

                {/* Price */}
                <div className="py-5 border-b border-neutral-200 my-4 flex items-baseline gap-1.5">
                  {p === 0 ? (
                    <span className="text-4xl font-serif font-normal text-neutral-900">Free</span>
                  ) : (
                    <>
                      <span className="text-4xl font-serif font-normal text-neutral-900">${p}</span>
                      <span className="text-xs text-neutral-500 font-sans tracking-wide">/ mo{billing === 'annual' ? ' · billed annually' : ''}</span>
                    </>
                  )}
                </div>

                {/* Views */}
                <div className="text-xs font-mono text-[#C05621] font-semibold mb-4 uppercase tracking-wide">
                  {tier.views}
                </div>

                {/* Features */}
                <ul className="flex flex-col gap-3 pt-1">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3">
                      <div className="h-4 w-4 rounded-full bg-neutral-950 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="text-xs text-neutral-600 font-light leading-normal">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {tier.id === 'free' ? (
                <a
                  href={tier.href}
                  className="mt-8 w-full h-11 rounded font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer bg-neutral-950 text-white hover:bg-neutral-800 shadow-md"
                >
                  <span>Start Free</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Paid plans are launching soon"
                  className="mt-8 w-full h-11 rounded font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-neutral-100 border border-neutral-250 text-neutral-500 cursor-not-allowed"
                >
                  Coming Soon
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Trust banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto p-10 rounded-2xl glass border border-neutral-200 text-neutral-800 z-10 relative">
        <div className="flex gap-4">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[#C05621] flex-shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold tracking-wide text-neutral-900">Privacy-first analytics</h4>
            <p className="text-xs text-neutral-600 mt-1 font-light leading-relaxed">
              We never sell visitor data and use first-party storage only — no third-party tracking cookies. ScrollPop respects Do-Not-Track and a host-site consent signal. See our Privacy Policy &amp; DPA for sub-processors and data handling.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex-shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold tracking-wide text-neutral-900">No lock-in</h4>
            <p className="text-xs text-neutral-600 mt-1 font-light leading-relaxed">
              The Free plan is yours for as long as you like. When paid plans launch you'll be able to cancel any time — no contracts. Your data is always yours and exportable.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
