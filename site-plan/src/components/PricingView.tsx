import { ArrowRight, Check, AlertTriangle, ShieldCheck, Mail } from 'lucide-react';
import { ActivePage } from '../types';

const DASHBOARD_URL = 'https://dashboard.scrollpop.online';

interface PricingViewProps {
  onPageChange: (page: ActivePage) => void;
}

export default function PricingView({ onPageChange }: PricingViewProps) {
  const tiers = [
    {
      id: 'free',
      name: 'Free',
      badge: 'NO CARD REQUIRED',
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
    },
    {
      id: 'agency',
      name: 'Agency',
      badge: 'UNLIMITED',
      description: 'For agencies and high-volume affiliate networks — tailored to your scale.',
      views: 'Custom popup volume',
      features: [
        'Unlimited sites & campaigns',
        'Everything in Free',
        'A/B testing & advanced analytics',
        'Geo targeting & API access',
        'White-label (remove branding)',
        'Team member access',
        'Dedicated support & custom integrations',
      ],
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-16 font-sans text-neutral-800">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] font-semibold block mb-3">TRANSPARENT PRICING</span>
        <h1 className="font-serif text-4xl md:text-6xl font-normal tracking-tight leading-none text-gradient">
          Simple, honest plans
        </h1>
        <p className="text-neutral-600 font-light text-base md:text-lg mt-4 leading-relaxed">
          Start free — no card required. Need more scale? The Agency plan is tailored to your volume — get in touch and we'll build a plan around you.
        </p>
      </div>

      {/* Pricing grid — Free + Agency, centered */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch mb-20 max-w-3xl mx-auto">
        {tiers.map((tier) => {
          const isAgency = tier.id === 'agency';
          return (
            <div
              key={tier.id}
              className={`glass rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 relative overflow-hidden backdrop-blur-md ${
                isAgency
                  ? 'border-[#C05621] ring-2 ring-[#C05621]/15 shadow-2xl'
                  : 'border-neutral-200/80 hover:border-neutral-300 hover:-translate-y-1 shadow-xs'
              }`}
            >
              {isAgency && (
                <div className="absolute top-0 right-0 bg-[#C05621] text-white text-[9px] font-mono uppercase tracking-widest font-extrabold py-1.5 px-6 rotate-45 translate-x-7 translate-y-3.5 z-10 shadow-md">
                  AGENCY
                </div>
              )}

              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#C05621] block mb-2">{tier.badge}</span>
                <h3 className="font-serif text-2xl font-normal text-neutral-900">{tier.name}</h3>
                <p className="text-xs text-neutral-600 mt-2 font-light leading-relaxed">{tier.description}</p>

                {/* Price */}
                <div className="py-5 border-b border-neutral-200 my-4 flex items-baseline gap-1.5">
                  {isAgency ? (
                    <span className="text-4xl font-serif font-normal text-neutral-900">Let’s talk</span>
                  ) : (
                    <>
                      <span className="text-4xl font-serif font-normal text-neutral-900">$0</span>
                      <span className="text-xs text-neutral-500 font-sans tracking-wide">/ mo</span>
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

              {isAgency ? (
                <button
                  type="button"
                  onClick={() => onPageChange('contact')}
                  className="mt-8 w-full h-11 rounded font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer bg-neutral-950 text-white hover:bg-neutral-800 shadow-md"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Contact us for more</span>
                </button>
              ) : (
                <a
                  href={`${DASHBOARD_URL}/sign-up`}
                  className="mt-8 w-full h-11 rounded font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer bg-neutral-950 text-white hover:bg-neutral-800 shadow-md"
                >
                  <span>Start Free</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
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
              The Free plan is yours for as long as you like. Cancel an Agency plan any time — no contracts. Your data is always yours and exportable.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
