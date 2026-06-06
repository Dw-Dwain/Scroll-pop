import React from 'react';
import {
  ArrowLeft, ArrowRight, BookOpen, Zap, Globe, Megaphone, BarChart2,
  Target, RefreshCw, Code2, CreditCard, ChevronRight, ChevronDown,
  ShoppingBag, FileCode, Copy, Check, Layers, Shield,
  TrendingUp, Settings, HelpCircle,
} from 'lucide-react';

interface DocsPageProps { onNavigate: (path: string) => void; }

// ─── shared primitives ────────────────────────────────────────────────────────

const S: React.CSSProperties = { fontFamily: 'var(--font-sans)' };
const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1 style={{ ...S, fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
      {children}
    </h1>
  );
}
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ ...S, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '32px 0 10px' }}>
      {children}
    </h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ ...S, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '22px 0 8px' }}>
      {children}
    </h3>
  );
}
function P({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <p style={{ ...S, fontSize: 13, lineHeight: 1.75, color: muted ? 'var(--text-muted)' : 'var(--text-secondary)', margin: '0 0 14px' }}>
      {children}
    </p>
  );
}
function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--text-secondary)', ...S }}>
          <span style={{ marginTop: 6, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-500)', flexShrink: 0 }} />
          <span style={{ lineHeight: 1.65 }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Note({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warn' | 'tip' }) {
  const colors = {
    info: { bg: 'rgba(99,102,241,0.07)', border: 'rgba(99,102,241,0.25)', label: 'Note', labelColor: 'var(--accent-400)' },
    warn: { bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.25)', label: 'Important', labelColor: '#f59e0b' },
    tip:  { bg: 'rgba(34,197,94,0.07)',  border: 'rgba(34,197,94,0.25)',  label: 'Tip',       labelColor: '#22c55e' },
  }[type];
  return (
    <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '10px 14px', margin: '0 0 16px', ...S, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
      <span style={{ fontWeight: 600, color: colors.labelColor, marginRight: 6 }}>{colors.label}:</span>
      {children}
    </div>
  );
}

function CodeBlock({ code, lang = 'html' }: { code: string; lang?: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ position: 'relative', margin: '0 0 18px' }}>
      <div style={{ position: 'absolute', top: 8, right: 10, zIndex: 1 }}>
        <button onClick={copy} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '14px 16px', overflow: 'auto' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', ...MONO }}>{lang}</div>
        <pre style={{ margin: 0, ...MONO, fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{code}</pre>
      </div>
    </div>
  );
}

function StepCard({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 16, margin: '0 0 20px' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 2 }}>
        {number}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ ...S, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border-subtle)', margin: '28px 0' }} />;
}

// ─── nav sidebar entries ──────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'overview',      label: 'Overview',          icon: BookOpen },
  { id: 'quick-start',   label: 'Quick Start',        icon: Zap },
  { id: 'sites',         label: 'Connecting Sites',   icon: Globe },
  { id: 'campaigns',     label: 'Campaigns',          icon: Megaphone },
  { id: 'triggers',      label: 'Triggers',           icon: RefreshCw },
  { id: 'targeting',     label: 'Targeting Rules',    icon: Target },
  { id: 'affiliate',     label: 'Affiliate Slots',    icon: TrendingUp },
  { id: 'analytics',     label: 'Analytics',          icon: BarChart2 },
  { id: 'ab-testing',    label: 'A/B Testing',        icon: Layers },
  { id: 'billing',       label: 'Plans & Billing',    icon: CreditCard },
  { id: 'api',           label: 'API Reference',      icon: Code2 },
  { id: 'faq',           label: 'FAQ',                icon: HelpCircle },
];

// ─── section content components ──────────────────────────────────────────────

function SectionOverview() {
  return (
    <div>
      <H1>ScrollPop Documentation</H1>
      <P muted>Everything you need to build, deploy, and monetise scroll-triggered popup campaigns.</P>
      <Divider />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, margin: '0 0 28px' }}>
        {[
          { icon: Zap,       title: 'Quick Start',      desc: 'Live in under 5 minutes on any platform.' },
          { icon: Globe,     title: 'Multi-Platform',   desc: 'WordPress, Shopify, HTML, Donorbox and more.' },
          { icon: Target,    title: 'Smart Targeting',  desc: 'URL, device, UTM, and visitor rules.' },
          { icon: TrendingUp,title: 'Affiliate Revenue',desc: 'Weighted product slots with click tracking.' },
          { icon: BarChart2, title: 'Real Analytics',   desc: 'Impressions, CTR, conversions per campaign.' },
          { icon: Shield,    title: 'Google-Safe',      desc: 'No history manipulation. Shadow DOM only.' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Icon size={15} style={{ color: 'var(--accent-500)' }} />
              <span style={{ ...S, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{title}</span>
            </div>
            <p style={{ ...S, fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>{desc}</p>
          </div>
        ))}
      </div>
      <H2>How ScrollPop Works</H2>
      <P>ScrollPop is a multi-tenant popup platform. Here's the end-to-end flow:</P>
      <UL items={[
        <><strong>You register a Site</strong> — a domain you want to show popups on. Each site gets a unique public key.</>,
        <><strong>You build a Campaign</strong> — pick a popup design, set triggers (scroll %, dwell time, exit intent…), configure targeting rules, and optionally add affiliate product slots.</>,
        <><strong>You install the snippet</strong> — a single &lt;script&gt; tag (~8 KB gzipped) that you paste into your site once. It fetches your active campaign config from ScrollPop's edge network.</>,
        <><strong>The snippet fires popups</strong> — entirely inside a Shadow DOM so it never touches your page's CSS or browser history. Events (impressions, clicks, conversions) are beaconed back for analytics.</>,
        <><strong>You read the data</strong> — the Analytics page shows per-campaign CTR, conversion rates, and top affiliate slots so you know what's working.</>,
      ]} />
      <Note type="tip">New user? Jump to <strong>Quick Start</strong> in the sidebar — you can have your first campaign live in about 5 minutes.</Note>
    </div>
  );
}

function SectionQuickStart() {
  const snippet = `<!-- ScrollPop — paste once, just before </body> -->
<script>
(function(w,d,s,k){
  w.__sp=w.__sp||{q:[]};
  w.__sp.key=k;
  var t=d.createElement(s);
  t.async=1;
  t.src='https://cdn.scrollpop.online/v1/'+k+'/p.js';
  d.head.appendChild(t);
})(window,document,'script','YOUR_PUBLIC_KEY');
</script>`;

  return (
    <div>
      <H1>Quick Start</H1>
      <P muted>From zero to live popup in five steps.</P>
      <Divider />

      <StepCard number={1} title="Create your account & organisation">
        <P>Sign up at <strong>dashboard.scrollpop.online</strong>. During onboarding, create an Organisation — this is your tenant that holds all your sites and campaigns. Plans start free.</P>
      </StepCard>

      <StepCard number={2} title="Register a Site">
        <P>Go to <strong>Sites</strong> in the left nav → click <strong>Add Site</strong>. Enter the site name and domain (e.g. <code style={MONO}>mystore.com</code>), pick your platform. Hit <strong>Register Site</strong>. ScrollPop will generate a unique <strong>public key</strong> for that site.</P>
        <Note type="info">One site = one domain. You can register unlimited sites on Growth+ plans. Free plan allows 1 site.</Note>
      </StepCard>

      <StepCard number={3} title="Install the snippet">
        <P>On the Sites page, click your site to open the detail panel. The <strong>Code Snippet</strong> tab shows your personalised script tag. Paste it once, just before the closing <code style={MONO}>&lt;/body&gt;</code> tag on every page where you want popups to be eligible.</P>
        <CodeBlock code={snippet} lang="html" />
        <P>For WordPress or Shopify, see the platform-specific guides — the snippet is injected automatically.</P>
      </StepCard>

      <StepCard number={4} title="Create your first Campaign">
        <P>Go to <strong>Campaigns</strong> → <strong>New Campaign</strong>. The wizard walks you through:</P>
        <UL items={[
          'Choosing a popup type (modal, slide-in, banner, bar, fullscreen, floating bubble, corner popup, notification toast)',
          'Setting a trigger — scroll percentage is the most common starting point (try 40 %)',
          'Writing a headline and body copy',
          'Adding a CTA button with a destination URL',
          'Setting frequency (once per session is the default)',
        ]} />
      </StepCard>

      <StepCard number={5} title="Publish & verify">
        <P>Click <strong>Publish Campaign</strong>. Visit your live site, scroll down past your trigger point — the popup should appear. Check the <strong>Analytics</strong> page; you should see an impression event within a few seconds of the popup rendering.</P>
        <Note type="tip">Use the Dev Mode embed URL in Sites → Code Snippet to test against a local tunnel (localtunnel / ngrok) before going live.</Note>
      </StepCard>
    </div>
  );
}

function SectionSites() {
  const wpSnippet = `// Functions.php or a plugin:
add_action('wp_footer', function() {
  $key = get_option('scrollpop_public_key');
  if ($key) {
    echo '<script>(function(w,d,s,k){w.__sp=w.__sp||{q:[]};w.__sp.key=k;var t=d.createElement(s);t.async=1;t.src="https://cdn.scrollpop.online/v1/"+k+"/p.js";d.head.appendChild(t);})(window,document,"script","'.$key.'");</script>';
  }
});`;

  return (
    <div>
      <H1>Connecting Sites</H1>
      <P muted>ScrollPop supports every platform that runs HTML. Here's how to integrate on each one.</P>
      <Divider />

      <H2>Platform Overview</H2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, margin: '0 0 24px' }}>
        {[
          { icon: ShoppingBag, label: 'Shopify', note: 'OAuth — one click' },
          { icon: Globe,       label: 'WordPress', note: 'PHP plugin' },
          { icon: Code2,       label: 'Raw HTML', note: 'Paste snippet' },
          { icon: FileCode,    label: 'Donorbox', note: 'Embed snippet in custom HTML block' },
          { icon: FileCode,    label: 'GoFundMe', note: 'Add via custom script settings' },
          { icon: Settings,    label: 'Other CMS', note: 'Any platform accepting custom scripts' },
        ].map(({ icon: Icon, label, note }) => (
          <div key={label} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <Icon size={13} style={{ color: 'var(--accent-400)' }} />
              <span style={{ ...S, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
            </div>
            <span style={{ ...S, fontSize: 11, color: 'var(--text-muted)' }}>{note}</span>
          </div>
        ))}
      </div>

      <H2>Shopify</H2>
      <StepCard number={1} title="Register the site first">
        <P>Sites → Add Site → set domain to <code style={MONO}>yourstore.myshopify.com</code>, platform = Shopify.</P>
      </StepCard>
      <StepCard number={2} title="Connect via OAuth">
        <P>Open the site detail → <strong>Shopify OAuth</strong> tab. Enter your store subdomain (e.g. <code style={MONO}>my-store</code> — not the full URL). Click <strong>Connect</strong>. You'll be redirected to Shopify's permission screen. Approve it.</P>
        <P>ScrollPop will automatically inject a Script Tag into your store — you don't need to edit theme files at all.</P>
      </StepCard>
      <StepCard number={3} title="Verify">
        <P>You'll be returned to the ScrollPop dashboard with a green "Shopify Connected" badge. Publish a campaign and visit a product page to confirm the popup fires.</P>
      </StepCard>
      <Note type="warn">Shopify requires your app to register GDPR webhooks (customer data request, customer redact, shop redact). ScrollPop handles all of these automatically during the OAuth flow.</Note>

      <Divider />

      <H2>WordPress</H2>
      <StepCard number={1} title="Download the plugin">
        <P>Sites → site detail → <strong>WordPress Plugin</strong> tab → click <strong>Download Plugin (.zip)</strong>. In your WordPress admin go to Plugins → Add New → Upload Plugin → install and activate.</P>
      </StepCard>
      <StepCard number={2} title="Copy your public key">
        <P>Back in ScrollPop, the WordPress tab shows your site's public key. In WordPress admin → Settings → ScrollPop, paste the key and save. The plugin injects the snippet automatically in <code style={MONO}>wp_footer</code>.</P>
      </StepCard>
      <StepCard number={3} title="Verify connection">
        <P>Click <strong>Verify Installation</strong> in the WordPress tab. ScrollPop will ping your site's REST endpoint (<code style={MONO}>/wp-json/scrollpop/v1/status</code>) and confirm the key matches.</P>
      </StepCard>
      <Note type="tip">If your WordPress site is behind a WAF that blocks REST API requests, temporarily allow the ScrollPop verification call or whitelist the Render IP range.</Note>
      <H3>Manual WordPress (without plugin)</H3>
      <P>If you prefer not to use the plugin, you can add the snippet manually:</P>
      <CodeBlock code={wpSnippet} lang="php" />

      <Divider />

      <H2>Raw HTML / Any CMS</H2>
      <P>Paste the snippet code (from Sites → Code Snippet tab) just before the closing <code style={MONO}>&lt;/body&gt;</code> tag on every page. That's it — no build step required.</P>
      <Note type="info">The snippet is fully async and deferred — it will never block page load or affect your Core Web Vitals.</Note>

      <Divider />

      <H2>Site Settings</H2>
      <UL items={[
        <><strong>Platform</strong> — cosmetic label; does not affect functionality.</>,
        <><strong>Domain</strong> — used in the snippet embed URL and for Shopify OAuth validation.</>,
        <><strong>Public Key</strong> — the unique identifier that links your snippet to this site's campaign config. Never share this key publicly in a way that lets others impersonate your site.</>,
        <><strong>Verified At</strong> — date the plugin/snippet was confirmed live. Shown as a green badge.</>,
      ]} />
    </div>
  );
}

function SectionCampaigns() {
  return (
    <div>
      <H1>Campaigns</H1>
      <P muted>A campaign is the central object in ScrollPop — it groups your popup design, triggers, targeting rules, and affiliate slots together.</P>
      <Divider />

      <H2>Campaign Anatomy</H2>
      <UL items={[
        <><strong>Design</strong> — the visual popup: type (modal, slide-in, banner…), colours, headline, body, CTA, and affiliate slots.</>,
        <><strong>Triggers</strong> — one or more conditions that fire the popup (scroll %, dwell time, inactivity, exit intent, element click).</>,
        <><strong>Targeting Rules</strong> — optional filters: only show on certain URLs, on mobile only, to returning visitors, etc.</>,
        <><strong>Frequency</strong> — how often the same visitor sees the popup (once per session, once per day, once ever, or always).</>,
        <><strong>Status</strong> — draft (editing only), active (live), paused (hidden but not deleted), archived (soft-deleted).</>,
      ]} />

      <H2>Popup Design Types</H2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, margin: '0 0 20px' }}>
        {[
          { type: 'Modal',              desc: 'Centred overlay with optional dim. Highest impact.' },
          { type: 'Slide-in',           desc: 'Slides in from a corner. Less intrusive than modal.' },
          { type: 'Banner',             desc: 'Full-width strip across top or bottom of the viewport.' },
          { type: 'Bar',                desc: 'Thin sticky bar. Great for sitewide announcements.' },
          { type: 'Fullscreen',         desc: 'Covers entire viewport. Use sparingly.' },
          { type: 'Floating Bubble',    desc: 'Small persistent icon that expands on click.' },
          { type: 'Notification Toast', desc: 'Social-proof style pop in the corner.' },
          { type: 'Corner Popup',       desc: 'Compact card in bottom corner.' },
          { type: 'Inline Form',        desc: 'Embeds into page content rather than overlaying.' },
        ].map(({ type, desc }) => (
          <div key={type} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '11px 13px' }}>
            <div style={{ ...S, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>{type}</div>
            <p style={{ ...S, fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{desc}</p>
          </div>
        ))}
      </div>

      <H2>Creating a Campaign</H2>
      <P>Go to <strong>Campaigns → New Campaign</strong>. The wizard has three pages:</P>
      <StepCard number={1} title="Basics">
        <P>Name, site, popup type, headline (required), sub-headline, body text, CTA text + URL, animation style, close button position.</P>
      </StepCard>
      <StepCard number={2} title="Triggers & Frequency">
        <P>Add at least one trigger. You can stack multiple triggers — the popup fires when the <em>first</em> one is satisfied. Set frequency to control repeat impressions.</P>
      </StepCard>
      <StepCard number={3} title="Targeting (optional)">
        <P>Add URL rules, device filters, or visitor-type conditions. If you add no targeting rules the popup shows on all pages of the linked site.</P>
      </StepCard>

      <H2>Editing a Campaign</H2>
      <P>Open a campaign from the Campaigns list → click the name to open Campaign Detail. From there you can:</P>
      <UL items={[
        'Edit the design inline (or open the full-screen visual builder)',
        'Add / remove / reorder triggers',
        'Update targeting rules',
        'Change frequency',
        'Switch status (draft → active, active → paused, etc.)',
        'Duplicate or archive the campaign',
      ]} />

      <H2>Publishing Changes</H2>
      <P>When you save changes to an active campaign, they are queued for the next edge sync. Active campaigns are cached at the Cloudflare edge in KV — changes propagate in under 60 seconds globally.</P>
      <Note type="warn">Deleting a campaign is a soft-delete (archived). Campaign data is retained for analytics. Hard deletion of analytics data is not available from the UI — contact support.</Note>
    </div>
  );
}

function SectionTriggers() {
  return (
    <div>
      <H1>Triggers</H1>
      <P muted>Triggers determine when a popup fires. Each campaign can have multiple triggers — the first one to activate shows the popup.</P>
      <Divider />

      <H2>Available Trigger Types</H2>

      <H3>Scroll Percentage</H3>
      <P>The popup fires when the visitor has scrolled down a set percentage of the page height.</P>
      <UL items={[
        <><strong>Parameter:</strong> <code style={MONO}>pct</code> — integer from 1 to 100.</>,
        'Recommended starting value: 40 % (visitor is clearly engaged).',
        'For long-form content (blog posts, landing pages), try 60–70 %.',
        'For checkout-flow pages, 20–30 % captures more visitors before they leave.',
      ]} />

      <H3>Dwell Time</H3>
      <P>Fires after the visitor has spent a set number of seconds on the page.</P>
      <UL items={[
        <><strong>Parameter:</strong> <code style={MONO}>seconds</code> — 1 to 3 600.</>,
        'A 30-second dwell trigger qualifies for intent without being premature.',
        'Combine with a scroll trigger (multi-trigger) to require both time and engagement.',
      ]} />

      <H3>Inactivity</H3>
      <P>Fires after the visitor has not moved their mouse or touched the screen for a set period.</P>
      <UL items={[
        <><strong>Parameter:</strong> <code style={MONO}>seconds</code> — 5 to 3 600.</>,
        'Good for re-engagement campaigns on long pages.',
        'Resets on any mouse movement or scroll.',
      ]} />

      <H3>Exit Intent (Mouse)</H3>
      <P>Fires when the visitor's cursor moves toward the top of the viewport (browser chrome), indicating they are about to navigate away. Desktop only — mobile falls back to inactivity.</P>
      <UL items={[
        <><strong>Parameter:</strong> <code style={MONO}>sensitivity</code> — pixels from top edge (5–100). Default: 20.</>,
        'A lower number fires sooner (cursor closer to tab bar). 20 px is a good default.',
        'This is the highest-converting trigger for exit offers and discount codes.',
      ]} />
      <Note type="warn">ScrollPop does NOT use <code style={MONO}>window.onbeforeunload</code>, <code style={MONO}>history.pushState</code>, or back-button interception. These are banned under Google's spam policies and are architecturally excluded from the platform.</Note>

      <H3>Element Click</H3>
      <P>Fires when a visitor clicks a specific CSS selector on the page (e.g. a "See offers" button).</P>
      <UL items={[
        <><strong>Parameter:</strong> <code style={MONO}>selector</code> — any valid CSS selector, e.g. <code style={MONO}>#see-offers</code> or <code style={MONO}>.cta-button</code>.</>,
        'The snippet adds a delegated listener on <code>document</code> — the element does not need to exist at snippet load time.',
        'Useful for programmatically opening popups from your own UI.',
      ]} />

      <H2>Multi-Trigger Campaigns</H2>
      <P>You can add multiple triggers to a single campaign. The popup fires as soon as <em>any one</em> trigger fires. Example: scroll 40 % <em>OR</em> 45 seconds dwell — whichever comes first.</P>
      <Note type="tip">For affiliate pop-overs, a 50 % scroll trigger paired with a 60-second dwell is a high-performing combination across most content sites.</Note>

      <H2>Trigger Frequency Interaction</H2>
      <P>Even if a trigger fires, the popup will be suppressed if the <strong>frequency rule</strong> says the visitor has already seen it. The trigger and frequency rules are evaluated independently — triggers decide <em>when</em> to show; frequency decides <em>whether</em> to show.</P>
    </div>
  );
}

function SectionTargeting() {
  return (
    <div>
      <H1>Targeting Rules</H1>
      <P muted>Targeting rules let you show campaigns only to visitors who match specific conditions. All rules in a campaign are AND-ed together.</P>
      <Divider />

      <H2>Rule Types</H2>

      <H3>URL — Exact Match</H3>
      <P>Show the popup only on a specific URL. The full path (including query string if specified) must match exactly.</P>
      <CodeBlock code={`Value: https://mysite.com/pricing
→ Only fires on /pricing, not /pricing?plan=pro`} lang="text" />

      <H3>URL — Contains</H3>
      <P>Show the popup on any URL containing a substring.</P>
      <CodeBlock code={`Value: /blog/
→ Fires on /blog/, /blog/post-title/, /en/blog/ etc.`} lang="text" />

      <H3>URL — Regex</H3>
      <P>Full regular expression match against the page URL. Use for complex patterns.</P>
      <CodeBlock code={`Value: /product/[a-z0-9-]+$
→ Matches /product/red-shoes but not /product/red-shoes/reviews`} lang="text" />

      <H3>Device</H3>
      <P>Restrict to <strong>mobile</strong> or <strong>desktop</strong>. Detection is via User-Agent — tablets are classified as mobile.</P>
      <UL items={[
        'Use mobile-specific popups that are narrower and have larger tap targets.',
        'Exit-intent (mouse) only fires on desktop — on mobile it auto-downgrades to inactivity trigger.',
      ]} />

      <H3>Returning Visitor</H3>
      <P>Show the popup only to visitors who have visited the site at least once before (detected via a localStorage flag set by the snippet on the first visit).</P>
      <UL items={[
        'Useful for follow-up offers: "Welcome back — here\'s an exclusive deal."',
        'Combine with a 20 % scroll trigger for low-friction re-engagement.',
      ]} />

      <H2>Include vs. Exclude</H2>
      <P>Each rule has an <strong>operator</strong>: <code style={MONO}>include</code> or <code style={MONO}>exclude</code>.</P>
      <UL items={[
        <><strong>Include:</strong> Visitor must match this rule for the popup to show.</>,
        <><strong>Exclude:</strong> If the visitor matches this rule, the popup is suppressed regardless of other rules. Useful for "show everywhere except /thank-you".</>,
      ]} />

      <H2>Rule Evaluation Order</H2>
      <P>Rules are evaluated client-side in the snippet at trigger time. <strong>Exclude rules are evaluated first</strong> — if any exclude matches, the popup is skipped immediately without checking includes.</P>
      <Note type="tip">Start with no targeting rules (show on all pages) for your first campaign. Add targeting after you have at least 200 impressions of analytics data to act on.</Note>
    </div>
  );
}

function SectionAffiliate() {
  return (
    <div>
      <H1>Affiliate Slots</H1>
      <P muted>Affiliate slots let you display monetised product creatives inside your popups. ScrollPop handles the weighted rotation and click tracking automatically.</P>
      <Divider />

      <H2>What Is an Affiliate Slot?</H2>
      <P>An affiliate slot is a product creative containing:</P>
      <UL items={[
        <><strong>Product name</strong> — displayed as the popup headline or sub-heading.</>,
        <><strong>Product URL</strong> — the destination page (e.g. the merchant's product listing).</>,
        <><strong>Image URL</strong> — the product image displayed in the popup.</>,
        <><strong>Click tracker URL</strong> — your affiliate network's tracking URL. Clicks are sent through this link before redirecting to the product URL.</>,
        <><strong>CTA Text</strong> — e.g. "Shop Now", "Claim Offer", "Get 20% Off".</>,
        <><strong>Weight</strong> — integer 1–100. Higher weight = shown more often in rotation.</>,
        <><strong>Coupon code</strong> (optional) — displayed as a copyable badge inside the popup.</>,
      ]} />

      <H2>Adding Affiliate Slots to a Campaign</H2>
      <P>In the Campaign Detail → Design tab, scroll to the <strong>Affiliate Slots</strong> section. Click <strong>Add Slot</strong> and fill in the fields. You can add up to 10 slots per campaign.</P>
      <Note type="info">When multiple slots are present, the snippet picks one per impression using a weighted random algorithm. Weights do not need to sum to 100 — they are relative.</Note>

      <H2>Click Tracking</H2>
      <P>Every CTA click is sent through the click tracker URL you provide. This is your affiliate link (e.g. ShareASale, Impact, CJ, Amazon Associates). ScrollPop also fires a <code style={MONO}>click</code> event beacon to your analytics so you can see click counts per slot in the Analytics page.</P>
      <Note type="warn">The click tracker URL must be a valid HTTPS URL. HTTP links are blocked by the Shadow DOM's Content Security Policy.</Note>

      <H2>Coupon Codes</H2>
      <P>If you add a <code style={MONO}>coupon</code> value, the popup design will render it as a highlighted, copyable badge. Visitors can copy the code with one tap. ScrollPop fires a separate <code style={MONO}>conversion</code> event when the coupon is copied — this is tracked in Analytics as a soft conversion.</P>

      <H2>Rotation Weights — Strategy</H2>
      <UL items={[
        'Start all slots at weight 1 (equal rotation). After 500+ impressions, boost the weight of your best-converting slot.',
        'Use weight 10 for a proven slot alongside weight 1 for a test slot to A/B at a 90/10 split.',
        'Seasonal campaigns: add a holiday slot at weight 5, keep your evergreen slot at weight 1.',
      ]} />
    </div>
  );
}

function SectionAnalytics() {
  return (
    <div>
      <H1>Analytics</H1>
      <P muted>ScrollPop tracks five event types per campaign. All events are beaconed via navigator.sendBeacon for zero-impact on page performance.</P>
      <Divider />

      <H2>Event Types</H2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, margin: '0 0 22px' }}>
        {[
          { event: 'impression', desc: 'The popup config was loaded for this visitor session (popup eligible to show).' },
          { event: 'view',       desc: 'The popup was actually rendered and visible in the DOM.' },
          { event: 'click',      desc: 'Visitor clicked the CTA button (affiliate link).' },
          { event: 'dismiss',    desc: 'Visitor clicked the close button or clicked the overlay.' },
          { event: 'conversion', desc: 'Visitor copied a coupon code or reached a defined conversion URL.' },
        ].map(({ event, desc }) => (
          <div key={event} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '11px 13px' }}>
            <div style={{ ...MONO, fontWeight: 600, fontSize: 12, color: 'var(--accent-400)', marginBottom: 5 }}>{event}</div>
            <p style={{ ...S, fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{desc}</p>
          </div>
        ))}
      </div>

      <H2>Key Metrics Explained</H2>
      <UL items={[
        <><strong>CTR (Click-Through Rate)</strong> — clicks ÷ views × 100. Industry benchmark for affiliate popups: 3–8 %.</>,
        <><strong>View Rate</strong> — views ÷ impressions × 100. Low view rate usually means your trigger fires too late or targeting is too narrow.</>,
        <><strong>Conversion Rate</strong> — conversions ÷ clicks × 100. Tracks coupon copies and defined conversion events.</>,
        <><strong>Dismiss Rate</strong> — dismisses ÷ views × 100. High dismiss rate ({'>'}80 %) suggests mismatch between offer and audience.</>,
      ]} />

      <H2>Analytics Dashboard</H2>
      <P>The <strong>Analytics</strong> page shows:</P>
      <UL items={[
        'Time-series chart of views and clicks (30-day window by default)',
        'Per-campaign breakdown table with sortable columns',
        'Top affiliate slots by click volume',
        'Export to CSV via the Download button',
      ]} />

      <H2>Data Latency</H2>
      <P>Events are beaconed to the Cloudflare Worker edge, buffered in Redis (Upstash), and flushed to PostgreSQL (Neon) in near-real-time. Expect up to 5 seconds of latency from event to dashboard display.</P>
      <Note type="info">The OpsCenter page (enabled on Growth+ plans) shows a live SSE stream of events as they arrive — useful for monitoring a campaign launch in real time.</Note>

      <H2>Data Retention</H2>
      <P>Analytics events are stored indefinitely in the TimescaleDB hypertable. There is no automatic purge. At {'>'}50M events/month, the platform migrates to ClickHouse for analytical queries (this is a v3 feature).</P>
    </div>
  );
}

function SectionABTesting() {
  return (
    <div>
      <H1>A/B Testing</H1>
      <P muted>Run multiple variants of a campaign against each other with controlled traffic splits.</P>
      <Divider />

      <Note type="warn">A/B testing (Experiments) is currently a beta feature. Enable it via Settings → Feature Flags → <code style={MONO}>ff_experiments_ui</code>.</Note>

      <H2>How Variants Work</H2>
      <P>Each campaign can have multiple <strong>Variants</strong>. Each variant has its own design configuration and a <strong>weight</strong> (0–100). The snippet picks a variant for each session using a weighted random selection, then caches the choice in <code style={MONO}>sessionStorage</code> so the same visitor always sees the same variant within a session.</P>
      <UL items={[
        'Weight 50 / 50 = classic A/B split.',
        'Weight 80 / 20 = champion / challenger test.',
        'Weight 33 / 33 / 33 = three-way test.',
        'Weights do not need to sum to 100 — they are relative ratios.',
      ]} />

      <H2>Setting Up an Experiment</H2>
      <StepCard number={1} title="Open Experiments">
        <P>Navigate to <strong>Experiments</strong> in the sidebar (visible if the feature flag is on).</P>
      </StepCard>
      <StepCard number={2} title="Create an experiment">
        <P>Link it to a campaign and define your variants. Each variant has its own headline, design settings, and CTA.</P>
      </StepCard>
      <StepCard number={3} title="Let it run">
        <P>You need at least 200 views per variant to reach statistical significance. The platform shows a significance indicator on the Experiments page once enough data is collected.</P>
      </StepCard>
      <StepCard number={4} title="Declare a winner">
        <P>Promote the winning variant to 100 % traffic, or permanently replace the campaign design with the winner. Losing variants are archived.</P>
      </StepCard>

      <H2>What to Test</H2>
      <UL items={[
        'Headline copy (biggest impact on CTR)',
        'CTA button text ("Shop Now" vs "Get 20% Off" vs "Claim Deal")',
        'Popup type (modal vs slide-in — slide-in typically has lower CTR but higher view rate)',
        'Trigger percentage (40 % vs 60 % scroll)',
        'Product image vs no image',
        'Coupon present vs no coupon',
      ]} />
    </div>
  );
}

function SectionBilling() {
  return (
    <div>
      <H1>Plans & Billing</H1>
      <P muted>ScrollPop bills on monthly popup views. Choose the plan that matches your traffic.</P>
      <Divider />

      <H2>Plan Comparison</H2>
      <div style={{ overflowX: 'auto', margin: '0 0 24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', ...S, fontSize: 13 }}>
          <thead>
            <tr>
              {['Plan', 'Price / mo', 'Popup Views / mo', 'Sites', 'Powered By Badge'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['Free',    '$0',   '1,000',       '1',    'Yes'],
              ['Starter', '$19',  '25,000',      '3',    'No'],
              ['Growth',  '$49',  '150,000',     '10',   'No'],
              ['Scale',   '$129', '500,000',     '∞',    'No'],
              ['Agency',  '$299', '2,000,000',   '∞',    'No'],
            ].map(([plan, price, views, sites, badge], i) => (
              <tr key={plan} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                <td style={{ padding: '9px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>{plan}</td>
                <td style={{ padding: '9px 12px', color: 'var(--text-secondary)', ...MONO }}>{price}</td>
                <td style={{ padding: '9px 12px', color: 'var(--text-secondary)' }}>{views}</td>
                <td style={{ padding: '9px 12px', color: 'var(--text-secondary)' }}>{sites}</td>
                <td style={{ padding: '9px 12px', color: badge === 'Yes' ? 'var(--status-warning)' : 'var(--status-success)' }}>{badge}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>View Counting</H2>
      <P>A <strong>view</strong> is counted when the popup is rendered and visible to a visitor (not just eligible). Impressions (the popup was loaded but not yet shown) do not count against your limit.</P>

      <H2>What Happens When You Hit Your Limit</H2>
      <P>When your monthly view count reaches the plan cap, the snippet stops rendering new popups for the remainder of the billing period. Existing events and analytics data are unaffected. You'll receive an email warning at 80 % usage.</P>
      <Note type="warn">Campaigns remain active — popups just won't render for new visitors once the cap is hit. Upgrade immediately if traffic spikes unexpectedly.</Note>

      <H2>Upgrading / Downgrading</H2>
      <P>Go to <strong>Billing</strong> in the left nav. Click <strong>Change Plan</strong>. Upgrades are effective immediately and prorated. Downgrades take effect at the next billing cycle.</P>

      <H2>The "Powered By ScrollPop" Badge</H2>
      <P>Free plan popups display a small "Powered by ScrollPop" link in the popup footer. All paid plans remove this badge. You can preview what the badge looks like in the Campaign Design editor.</P>
    </div>
  );
}

function SectionAPI() {
  const authExample = `curl https://scroll-pop.onrender.com/api/v1/sites \\
  -H "Authorization: Bearer <clerk_jwt>"`;

  const createSite = `POST /api/v1/sites
Content-Type: application/json

{
  "name": "My Blog",
  "domain": "myblog.com",
  "platform": "html"
}`;

  const createCampaign = `POST /api/v1/campaigns
Content-Type: application/json

{
  "siteId": "uuid",
  "name": "Exit Offer May",
  "status": "draft"
}`;

  const beaconEvent = `POST https://edge.scrollpop.online/e
Content-Type: application/json

{
  "events": [{
    "campaignId": "uuid",
    "eventType": "click",
    "affiliateSlotId": "uuid",
    "visitorId": "anon_abc123",
    "sessionId": "sess_xyz",
    "device": "desktop",
    "pageUrl": "https://mysite.com/blog/post"
  }]
}`;

  return (
    <div>
      <H1>API Reference</H1>
      <P muted>The ScrollPop REST API lets you manage sites, campaigns, and analytics programmatically. All endpoints are versioned at <code style={MONO}>/api/v1/</code>.</P>
      <Divider />

      <H2>Authentication</H2>
      <P>All authenticated endpoints require a Clerk JWT in the <code style={MONO}>Authorization: Bearer</code> header. Get your JWT from the Clerk session on the frontend.</P>
      <CodeBlock code={authExample} lang="shell" />
      <P>The API decodes the JWT to identify your tenant. All data operations are automatically scoped to your organisation — you cannot read or write another tenant's data.</P>

      <H2>Response Format</H2>
      <P>All success responses are wrapped:</P>
      <CodeBlock code={`{ "data": <payload>, "meta": { "total": 42 } }`} lang="json" />
      <P>All error responses:</P>
      <CodeBlock code={`{ "error": { "code": "NOT_FOUND", "message": "Site not found", "details": {} } }`} lang="json" />

      <H2>Core Endpoints</H2>

      <H3>Sites</H3>
      <UL items={[
        <><code style={MONO}>GET /api/v1/sites</code> — list all sites for your tenant</>,
        <><code style={MONO}>POST /api/v1/sites</code> — create a site</>,
        <><code style={MONO}>GET /api/v1/sites/:id</code> — get a site</>,
        <><code style={MONO}>PATCH /api/v1/sites/:id</code> — update name / platform</>,
        <><code style={MONO}>DELETE /api/v1/sites/:id</code> — soft-delete a site</>,
        <><code style={MONO}>POST /api/v1/sites/:id/verify-wordpress</code> — verify WP plugin is live</>,
      ]} />
      <CodeBlock code={createSite} lang="http" />

      <H3>Campaigns</H3>
      <UL items={[
        <><code style={MONO}>GET /api/v1/campaigns?siteId=uuid</code> — list campaigns for a site</>,
        <><code style={MONO}>POST /api/v1/campaigns</code> — create a campaign</>,
        <><code style={MONO}>PATCH /api/v1/campaigns/:id</code> — update name / status</>,
        <><code style={MONO}>DELETE /api/v1/campaigns/:id</code> — archive a campaign</>,
      ]} />
      <CodeBlock code={createCampaign} lang="http" />

      <H3>Designs</H3>
      <UL items={[
        <><code style={MONO}>GET /api/v1/designs?campaignId=uuid</code> — get design for a campaign</>,
        <><code style={MONO}>POST /api/v1/designs</code> — create / replace design</>,
        <><code style={MONO}>PATCH /api/v1/designs/:id</code> — update design fields</>,
      ]} />

      <H3>Triggers</H3>
      <UL items={[
        <><code style={MONO}>GET /api/v1/triggers?campaignId=uuid</code></>,
        <><code style={MONO}>POST /api/v1/triggers</code> — add a trigger</>,
        <><code style={MONO}>DELETE /api/v1/triggers/:id</code> — remove a trigger</>,
      ]} />

      <H3>Targeting Rules</H3>
      <UL items={[
        <><code style={MONO}>GET /api/v1/targeting?campaignId=uuid</code></>,
        <><code style={MONO}>POST /api/v1/targeting</code> — add a rule</>,
        <><code style={MONO}>DELETE /api/v1/targeting/:id</code> — remove a rule</>,
      ]} />

      <H3>Analytics</H3>
      <UL items={[
        <><code style={MONO}>GET /api/v1/analytics/overview</code> — aggregate stats for your tenant</>,
        <><code style={MONO}>GET /api/v1/analytics/campaigns</code> — per-campaign breakdown</>,
      ]} />

      <H3>Event Ingest (Edge)</H3>
      <P>Events are written to the Cloudflare Worker edge endpoint, not the API directly:</P>
      <CodeBlock code={beaconEvent} lang="http" />
      <Note type="info">The snippet uses <code style={MONO}>navigator.sendBeacon()</code> for event ingest — this means events are sent even if the user navigates away immediately after the click. The API endpoint at <code style={MONO}>/e</code> is a local dev fallback.</Note>

      <H2>Rate Limits</H2>
      <P>The API is rate-limited at 200 requests per minute per tenant. If you exceed this, you'll receive a <code style={MONO}>429 Too Many Requests</code> response. Contact support to raise limits for bulk automation use cases.</P>
    </div>
  );
}

function SectionFAQ() {
  const faqs = [
    {
      q: 'Will ScrollPop popups hurt my Google Search ranking?',
      a: 'No — as long as your campaigns follow Google\'s intrusive interstitials guidelines. ScrollPop is specifically engineered to avoid all banned patterns: no history manipulation, no back-button interception, no window.onbeforeunload. The snippet renders inside a Shadow DOM and never injects CSS into the host page. Follow the popup type guidelines (avoid fullscreen on mobile for SEO-critical pages) and you\'re compliant.',
    },
    {
      q: 'Can I use ScrollPop on multiple domains with one account?',
      a: 'Yes. Register each domain as a separate Site. The number of sites you can register depends on your plan (Free: 1, Starter: 3, Growth: 10, Scale/Agency: unlimited).',
    },
    {
      q: 'How does the snippet affect page speed?',
      a: 'The snippet is fully async — it never blocks page parsing or rendering. It uses requestIdleCallback (with a setTimeout fallback) to defer all work until after the page is interactive. The bundle is ~8 KB gzipped. Typical LCP impact: zero ms.',
    },
    {
      q: 'Can I show the same popup multiple times to the same visitor?',
      a: 'Yes — set the frequency to "Always". Options are: once per session, once per day, once per visitor (lifetime), or always. Frequency state is stored in sessionStorage (session) or localStorage (day/lifetime).',
    },
    {
      q: 'My popup isn\'t showing — how do I debug it?',
      a: 'Check in order: (1) Is the campaign status set to Active? (2) Does your site\'s public key in the snippet match the one in the dashboard? (3) Have you scrolled past the trigger percentage? (4) Open DevTools → Application → localStorage — if __sp_seen_<campaignId> exists, the frequency rule suppressed it. Clear storage and try again. (5) Check the Analytics page for impression events — if impressions appear but views don\'t, the trigger is not firing.',
    },
    {
      q: 'How do I track conversions from affiliate clicks?',
      a: 'ScrollPop fires a click event for every affiliate CTA click. If your affiliate network supports postback pixels, add a pixel to your landing page that fires a conversion event back via the API. Alternatively, use the coupon code feature — coupon copies are tracked as conversions automatically.',
    },
    {
      q: 'Can I embed ScrollPop into a React / Next.js site?',
      a: 'Yes — paste the snippet into your _document.tsx or layout.tsx. It works in any framework. The snippet is vanilla JS and does not conflict with React\'s virtual DOM. For Next.js App Router, use next/script with strategy="afterInteractive".',
    },
    {
      q: 'Is there a way to dismiss a popup programmatically?',
      a: 'Yes — call window.__sp.dismiss() from your own JavaScript. You can also open a popup programmatically with window.__sp.show("<campaignId>"). These are advanced APIs — they\'re part of the snippet\'s public surface.',
    },
    {
      q: 'What data is collected about my visitors?',
      a: 'ScrollPop collects: anonymous visitor ID (random UUID stored in localStorage, never tied to PII), session ID, device type (desktop/mobile), page URL, referrer, and event type. No names, emails, or IP addresses are stored by default. See the Privacy Policy for full details.',
    },
    {
      q: 'Can I white-label ScrollPop for my agency clients?',
      a: 'The Agency plan removes the "Powered by ScrollPop" badge. Full white-labelling (custom domain, custom branding on the dashboard) is a v3 feature planned for Q4 2026.',
    },
  ];

  const [open, setOpen] = React.useState<number | null>(0);

  return (
    <div>
      <H1>FAQ</H1>
      <P muted>Common questions about ScrollPop.</P>
      <Divider />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {faqs.map(({ q, a }, i) => (
          <div key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', gap: 12 }}
            >
              <span style={{ ...S, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'left', lineHeight: 1.4 }}>{q}</span>
              {open === i ? <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
            </button>
            {open === i && (
              <div style={{ paddingBottom: 14 }}>
                <P>{a}</P>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

const SECTION_COMPONENTS: Record<string, React.FC> = {
  'overview':   SectionOverview,
  'quick-start': SectionQuickStart,
  'sites':      SectionSites,
  'campaigns':  SectionCampaigns,
  'triggers':   SectionTriggers,
  'targeting':  SectionTargeting,
  'affiliate':  SectionAffiliate,
  'analytics':  SectionAnalytics,
  'ab-testing': SectionABTesting,
  'billing':    SectionBilling,
  'api':        SectionAPI,
  'faq':        SectionFAQ,
};

export const DocsPage: React.FC<DocsPageProps> = ({ onNavigate }) => {
  const [activeSection, setActiveSection] = React.useState('overview');
  const [_sidebarOpen, setSidebarOpen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const SectionContent = SECTION_COMPONENTS[activeSection] ?? SectionOverview;

  const goTo = (id: string) => {
    setActiveSection(id);
    setSidebarOpen(false);
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const currentIdx = SECTIONS.findIndex(s => s.id === activeSection);
  const prevSection = currentIdx > 0 ? SECTIONS[currentIdx - 1] : null;
  const nextSection = currentIdx < SECTIONS.length - 1 ? SECTIONS[currentIdx + 1] : null;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 110px)', overflow: 'hidden', ...S }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: '1px solid var(--border-subtle)',
        overflowY: 'auto', padding: '20px 0',
        background: 'var(--bg-root)',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 8 }}>
          <button
            onClick={() => onNavigate('/dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', padding: 0 }}
          >
            <ArrowLeft size={12} /> Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <BookOpen size={15} style={{ color: 'var(--accent-500)' }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Docs</span>
          </div>
        </div>

        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const isActive = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => goTo(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                background: isActive ? 'rgba(99,102,241,0.1)' : 'none',
                border: 'none', cursor: 'pointer',
                padding: '7px 16px',
                borderLeft: isActive ? '2px solid var(--accent-500)' : '2px solid transparent',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              <Icon size={13} style={{ color: isActive ? 'var(--accent-400)' : 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: isActive ? 'var(--accent-300)' : 'var(--text-secondary)', fontWeight: isActive ? 600 : 400, textAlign: 'left' }}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '32px 40px 60px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <SectionContent />

          {/* Prev / Next navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
            {prevSection ? (
              <button onClick={() => goTo(prevSection.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 14px', cursor: 'pointer' }}>
                <ArrowLeft size={13} style={{ color: 'var(--text-muted)' }} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', ...S, marginBottom: 2 }}>Previous</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, ...S }}>{prevSection.label}</div>
                </div>
              </button>
            ) : <div />}
            {nextSection ? (
              <button onClick={() => goTo(nextSection.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 14px', cursor: 'pointer' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', ...S, marginBottom: 2 }}>Next</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, ...S }}>{nextSection.label}</div>
                </div>
                <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
              </button>
            ) : <div />}
          </div>
        </div>
      </div>
    </div>
  );
};
