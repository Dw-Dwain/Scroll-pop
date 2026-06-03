import { useState } from 'react';
import { Clipboard, Check, ShoppingBag, Globe, Zap, Settings, Layers, Download, ToggleRight, Key } from 'lucide-react';

const DASHBOARD_URL = 'https://dashboard.scrollpop.online';

export default function WordPressShopifyGuide() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<'wordpress' | 'shopify' | 'html'>('wordpress');

  const copyCode = (sectionKey: string, codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const snippetCode = `<!-- ScrollPop — paste inside <head> -->
<script>
(function(w,d,s,p){
  p=w.__sp=w.__sp||{};
  if(p.loaded)return; p.loaded=true;
  var el=d.createElement(s); el.async=true; el.defer=true;
  el.src='https://cdn.scrollpop.online/v1/YOUR_PUBLIC_KEY/p.js';
  d.head.appendChild(el);
})(window,document,'script');
</script>`;

  return (
    <div className="max-w-7xl mx-auto px-6 py-16 font-sans text-neutral-800">

      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] font-semibold block mb-3">INSTALL GUIDE</span>
        <h1 className="font-serif text-4xl md:text-6xl font-normal tracking-tight leading-none text-gradient">
          Live in under 5 minutes
        </h1>
        <p className="text-neutral-600 font-light text-base md:text-lg mt-4 leading-relaxed">
          Connect your site, then manage all your campaigns from the dashboard. No code editing required.
        </p>
        <a
          href={`${DASHBOARD_URL}/sign-up`}
          className="inline-flex items-center gap-2 mt-8 h-12 px-8 bg-neutral-950 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-xl"
        >
          Get Your Public Key (Free) →
        </a>
      </div>

      {/* Platform tabs */}
      <div className="flex gap-2 mb-12 border-b border-neutral-200">
        {(['wordpress', 'shopify', 'html'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setActivePlatform(p)}
            className={`px-6 py-3 text-xs font-mono uppercase tracking-widest font-bold transition-all cursor-pointer border-b-2 -mb-px ${
              activePlatform === p
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {p === 'wordpress' ? 'WordPress' : p === 'shopify' ? 'Shopify' : 'HTML / Other'}
          </button>
        ))}
      </div>

      {/* ── WORDPRESS ── */}
      {activePlatform === 'wordpress' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-xl bg-neutral-950 text-white flex items-center justify-center shadow-lg">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-serif text-2xl font-normal text-neutral-900">WordPress</h2>
                <p className="text-xs text-neutral-500 font-mono uppercase tracking-wide mt-0.5">Free: snippet · Paid: dedicated plugin</p>
              </div>
            </div>

            <div className="mb-8 p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-600 font-light leading-relaxed">
              <strong className="text-neutral-900 font-semibold">On the Free plan</strong>, paste the ScrollPop snippet into your site header — via your theme's <code className="font-mono">functions.php</code> or a "headers and footers" plugin (the exact code is in your dashboard, and on the HTML / JS tab above). <strong className="text-neutral-900 font-semibold">Paid plans</strong> also get the dedicated ScrollPop WordPress plugin below.
            </div>

            <div className="flex flex-col gap-8">
              {[
                {
                  icon: <Download className="h-5 w-5" />, step: '01',
                  title: 'Download the plugin',
                  body: 'Go to your ScrollPop dashboard → Sites → your WordPress site → WordPress Plugin tab. Click "Download Plugin (.zip)". The file is scrollpop-wp.zip (~5KB).'
                },
                {
                  icon: <Settings className="h-5 w-5" />, step: '02',
                  title: 'Install & activate',
                  body: 'In your WordPress admin go to Plugins → Add New Plugin → Upload Plugin → choose scrollpop-wp.zip → Install Now → Activate.'
                },
                {
                  icon: <Key className="h-5 w-5" />, step: '03',
                  title: 'Paste your Public Key',
                  body: 'Go to Settings → ScrollPop. Paste your site\'s Public Key (found in your ScrollPop dashboard → Sites → your site card). Save changes.'
                },
                {
                  icon: <Zap className="h-5 w-5" />, step: '04',
                  title: 'Verify & go live',
                  body: 'Back in the ScrollPop dashboard, click "Complete Setup → Verify Connection". Once verified (green), your campaigns will start serving automatically.'
                },
              ].map((s) => (
                <div key={s.step} className="flex gap-5">
                  <div className="flex flex-col items-center">
                    <div className="h-10 w-10 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-900 font-mono text-sm font-bold flex items-center justify-center flex-shrink-0">{s.step}</div>
                    <div className="w-px flex-1 bg-neutral-200 mt-2" />
                  </div>
                  <div className="pb-8">
                    <h4 className="font-serif text-lg font-normal text-neutral-900 mb-2">{s.title}</h4>
                    <p className="text-sm text-neutral-600 font-light leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-8 flex flex-col gap-6">
            <h3 className="font-serif text-xl font-normal text-neutral-900">What the plugin does</h3>
            <div className="flex flex-col gap-4 text-xs text-neutral-600 font-light">
              {[
                'Injects the ScrollPop snippet into your wp_head — just like adding a Google Analytics tag',
                'No frontend files added, no database tables created',
                'Settings page in WP Admin for your Public Key',
                'Compatible with Gutenberg, Elementor, WooCommerce, and all themes',
                'Verified in the ScrollPop dashboard before campaigns start serving',
              ].map((f) => (
                <div key={f} className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
              <p className="text-xs font-mono text-neutral-500 uppercase tracking-wide mb-2">Your snippet URL (after connecting)</p>
              <code className="text-xs font-mono text-neutral-800 break-all">
                cdn.scrollpop.online/v1/<span className="text-[#C05621]">YOUR_PUBLIC_KEY</span>/p.js
              </code>
            </div>
          </div>
        </div>
      )}

      {/* ── SHOPIFY ── */}
      {activePlatform === 'shopify' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-xl bg-neutral-950 text-white flex items-center justify-center shadow-lg">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-serif text-2xl font-normal text-neutral-900">Shopify</h2>
                <p className="text-xs text-neutral-500 font-mono uppercase tracking-wide mt-0.5">Paste a snippet now · one-click app coming soon</p>
              </div>
            </div>

            {/* Option A — available now */}
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-5">
                <span className="px-2.5 py-1 bg-neutral-950 text-white text-[9px] font-mono uppercase tracking-wider rounded-full">AVAILABLE NOW</span>
                <span className="text-xs text-neutral-500">theme.liquid snippet</span>
              </div>
              {[
                { step: '01', title: 'Open your theme code', body: 'In Shopify Admin → Online Store → Themes → (your active theme) → ⋯ → Edit code.' },
                { step: '02', title: 'Paste the snippet', body: 'Open theme.liquid, and just before </head> paste the ScrollPop snippet (with your Public Key) — copy it from your ScrollPop dashboard. Save.' },
                { step: '03', title: 'Launch & go live', body: 'Every page now loads the snippet. Launch a campaign from the ScrollPop dashboard to start serving popups.' },
              ].map((s) => (
                <div key={s.step} className="flex gap-5 mb-6">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-900 font-mono text-xs font-bold flex items-center justify-center flex-shrink-0">{s.step}</div>
                    <div className="w-px flex-1 bg-neutral-200 mt-2" />
                  </div>
                  <div className="pb-5">
                    <h4 className="font-serif text-base font-normal text-neutral-900 mb-1.5">{s.title}</h4>
                    <p className="text-sm text-neutral-600 font-light leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Option B — coming soon */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <span className="px-2.5 py-1 bg-amber-100 border border-amber-200 text-amber-800 text-[9px] font-mono uppercase tracking-wider rounded-full">COMING SOON</span>
                <span className="text-xs text-neutral-500">One-click Shopify app</span>
              </div>
              <p className="text-sm text-neutral-600 font-light leading-relaxed">
                We're building a native Shopify app so you can install ScrollPop without touching theme code: connect your store via OAuth (ScrollPop auto-injects the snippet), or toggle on the App Embed Block in the Theme Customizer on Online Store 2.0 themes. Until it ships, use the theme.liquid snippet above — it works on every plan and theme today.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="glass rounded-2xl p-8">
              <h3 className="font-serif text-xl font-normal text-neutral-900 mb-5">How installs work today</h3>
              <div className="flex flex-col gap-4">
                {[
                  { label: 'theme.liquid snippet (now)', desc: 'Available today on every Shopify plan and theme. Paste one snippet before </head> — same idea as adding a Google Analytics tag.' },
                  { label: 'One-click app (coming soon)', desc: 'OAuth auto-install + an App Embed Block toggle, no theme code. In active development — the snippet above works in the meantime.' },
                ].map((o) => (
                  <div key={o.label} className="flex items-start gap-3 p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
                    <ToggleRight className="h-5 w-5 text-[#C05621] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-neutral-900 block">{o.label}</span>
                      <span className="text-xs text-neutral-600 font-light">{o.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <h3 className="font-mono text-xs uppercase tracking-widest text-neutral-500 mb-4">Shopify plan requirements</h3>
              <div className="flex flex-col gap-2 text-xs text-neutral-600 font-light">
                <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /><span>theme.liquid snippet — all plans including Basic</span></div>
                <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /><span>Works on every theme (no OS 2.0 requirement)</span></div>
                <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /><span>No Shopify Plus required</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HTML / OTHER ── */}
      {activePlatform === 'html' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-xl bg-neutral-950 text-white flex items-center justify-center shadow-lg">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-serif text-2xl font-normal text-neutral-900">HTML / Any Platform</h2>
                <p className="text-xs text-neutral-500 font-mono uppercase tracking-wide mt-0.5">One snippet · Any CMS · 30 seconds</p>
              </div>
            </div>

            <p className="text-sm text-neutral-600 font-light leading-relaxed mb-8">
              Works on any website — Squarespace, Wix, Webflow, custom HTML, Donorbox, GoFundMe, or anything that lets you add a script to the <code className="font-mono bg-neutral-100 px-1 rounded text-neutral-800">&lt;head&gt;</code>.
            </p>

            {[
              { step: '01', title: 'Get your Public Key', body: 'Sign up and register your site in the ScrollPop dashboard. Copy the Public Key shown on your site card.' },
              { step: '02', title: 'Add the snippet to your site', body: 'Paste the snippet below inside the <head> of your site. Replace YOUR_PUBLIC_KEY with the key from step 1.' },
              { step: '03', title: 'Create and launch a campaign', body: 'Back in the dashboard, create a campaign for this site. Set your trigger, design your popup, click Launch. The popup will appear on your site immediately.' },
            ].map((s) => (
              <div key={s.step} className="flex gap-5 mb-8">
                <div className="flex flex-col items-center">
                  <div className="h-10 w-10 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-900 font-mono text-sm font-bold flex items-center justify-center flex-shrink-0">{s.step}</div>
                  <div className="w-px flex-1 bg-neutral-200 mt-2" />
                </div>
                <div className="pb-8">
                  <h4 className="font-serif text-lg font-normal text-neutral-900 mb-2">{s.title}</h4>
                  <p className="text-sm text-neutral-600 font-light leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-6">
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-neutral-900 border-b border-neutral-700">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Snippet — paste inside &lt;head&gt;</span>
                <button
                  onClick={() => copyCode('html', snippetCode)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-[10px] font-mono text-neutral-300 transition-all cursor-pointer"
                >
                  {copiedSection === 'html' ? <Check className="h-3 w-3 text-emerald-400" /> : <Clipboard className="h-3 w-3" />}
                  {copiedSection === 'html' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="p-5 text-[11px] font-mono text-emerald-400 bg-neutral-950 overflow-x-auto leading-relaxed whitespace-pre-wrap">{snippetCode}</pre>
            </div>

            <div className="glass rounded-2xl p-6">
              <h3 className="font-mono text-xs uppercase tracking-widest text-neutral-500 mb-4">Where to add it in popular platforms</h3>
              <div className="flex flex-col gap-3 text-xs text-neutral-600">
                {[
                  ['Squarespace', 'Settings → Advanced → Code Injection → Header'],
                  ['Webflow', 'Project Settings → Custom Code → Head Code'],
                  ['Wix', 'Settings → Custom Code → Add Code → Head'],
                  ['Shopify (manual)', 'Themes → Edit code → layout/theme.liquid → before </head>'],
                  ['WordPress (manual)', 'Appearance → Theme Editor → header.php → before </head>'],
                ].map(([platform, path]) => (
                  <div key={platform} className="flex items-start gap-2">
                    <span className="font-semibold text-neutral-800 w-32 flex-shrink-0">{platform}</span>
                    <span className="font-mono text-neutral-500">{path}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mt-20 text-center">
        <p className="text-neutral-600 text-sm font-light mb-6">Need help? The setup wizard inside the dashboard walks you through every step.</p>
        <a
          href={`${DASHBOARD_URL}/sign-up`}
          className="inline-flex items-center gap-2 h-12 px-8 bg-neutral-950 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-xl"
        >
          Open the Dashboard →
        </a>
      </div>
    </div>
  );
}
