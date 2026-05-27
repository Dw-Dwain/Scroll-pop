import React from 'react';
import { Shield, Key, Bell, Puzzle, AlertTriangle, Copy, Check, Save, Code, Globe } from 'lucide-react';
import { useList } from '@refinedev/core';

const STORAGE_KEY = '_sp_settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, any>;
  } catch {}
  return { name: 'My Organization', plan: 'free', affiliateLink: 'https://affiliate.example.com', timezone: 'UTC' };
}

type Tab = 'general' | 'apikeys' | 'notifications' | 'integrations' | 'danger';

const TABS: { id: Tab; label: string; icon: React.FC<any> }[] = [
  { id: 'general',       label: 'General',       icon: Shield },
  { id: 'apikeys',       label: 'API Keys',       icon: Key },
  { id: 'notifications', label: 'Notifications',  icon: Bell },
  { id: 'integrations',  label: 'Integrations',   icon: Puzzle },
  { id: 'danger',        label: 'Danger Zone',    icon: AlertTriangle },
];

const CONNECTED_SERVICES = [
  { name: 'Stripe',       status: 'connected',   desc: 'Billing & subscriptions' },
  { name: 'Clerk',        status: 'connected',   desc: 'Authentication & users' },
  { name: 'Cloudflare',   status: 'connected',   desc: 'CDN & Workers' },
  { name: 'PostHog',      status: 'pending',     desc: 'Product analytics' },
  { name: 'Sentry',       status: 'pending',     desc: 'Error tracking' },
  { name: 'Slack',        status: 'coming_soon', desc: 'Notifications' },
];

function getSnippetJS(publicKey: string) {
  return `<script>
(function(w,d,s,p){
  p=w.__sp=w.__sp||{};
  if(p.loaded)return; p.loaded=true;
  var el=d.createElement(s); el.async=true; el.defer=true;
  el.src='https://cdn.scrollpop.io/v1/${publicKey}/p.js';
  d.head.appendChild(el);
})(window,document,'script');
<\/script>`;
}

function getWpFunctionsPhp(publicKey: string) {
  return `<?php
function scrollpop_embed_script() {
    $public_key = '${publicKey}';
    ?>
    <script>
    (function(w,d,s,p){
      p=w.__sp=w.__sp||{};
      if(p.loaded)return; p.loaded=true;
      var el=d.createElement(s); el.async=true; el.defer=true;
      el.src='https://cdn.scrollpop.io/v1/<?php echo esc_js( $public_key ); ?>/p.js';
      d.head.appendChild(el);
    })(window,document,'script');
    <\/script>
    <?php
}
add_action( 'wp_head', 'scrollpop_embed_script' );`;
}

function getShopifyThemeLiquid(publicKey: string) {
  return `{%- comment -%} ScrollPop — place just before </head> {%- endcomment -%}
<script>
(function(w,d,s,p){
  p=w.__sp=w.__sp||{};
  if(p.loaded)return; p.loaded=true;
  var el=d.createElement(s); el.async=true; el.defer=true;
  el.src='https://cdn.scrollpop.io/v1/${publicKey}/p.js';
  d.head.appendChild(el);
})(window,document,'script');
<\/script>`;
}

function getShopifyAppEmbedBlock(publicKey: string) {
  return `{% comment %} sections/scrollpop-embed.liquid {% endcomment %}
{% if section.settings.public_key != blank %}
<script>
(function(w,d,s,p){
  p=w.__sp=w.__sp||{};
  if(p.loaded)return; p.loaded=true;
  var el=d.createElement(s); el.async=true; el.defer=true;
  el.src='https://cdn.scrollpop.io/v1/{{ section.settings.public_key }}/p.js';
  d.head.appendChild(el);
})(window,document,'script');
<\/script>
{% endif %}

{% schema %}
{
  "name": "ScrollPop",
  "target": "head",
  "settings": [
    {
      "type": "text",
      "id": "public_key",
      "label": "ScrollPop Public Key",
      "default": "${publicKey}"
    }
  ]
}
{% endschema %}`
}

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<Tab>('general');
  const [settings, setSettings] = React.useState(loadSettings);
  const [isSaved, setIsSaved] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState('');
  const [activePlatform, setActivePlatform] = React.useState<'wordpress' | 'shopify' | 'html'>('wordpress');
  const [selectedSiteId, setSelectedSiteId] = React.useState<string>('');

  const { data: sitesData } = useList({ resource: 'sites' });
  const sites = (sitesData?.data ?? []) as any[];

  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? sites[0] ?? null;
  const publicKey = selectedSite?.publicKey ?? 'YOUR_PUBLIC_KEY';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Manage organization, credentials, and integrations.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Tab rail */}
        <div style={{ width: 160, flexShrink: 0 }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`nav-item${activeTab === id ? ' active' : ''}`}
              style={{
                width: '100%',
                marginBottom: 2,
                color: id === 'danger' && activeTab !== id ? 'var(--status-error)' : undefined,
              }}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* General */}
          {activeTab === 'general' && (
            <form onSubmit={handleSave}>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 20px', letterSpacing: '-0.01em' }}>General</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Organization Name</label>
                    <input className="input" type="text" value={settings.name ?? ''} onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Default Timezone</label>
                    <select className="input" value={settings.timezone ?? 'UTC'} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}>
                      {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo'].map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Affiliate Link Base URL</label>
                    <input className="input" type="url" placeholder="https://affiliate.example.com" value={settings.affiliateLink ?? ''} onChange={(e) => setSettings({ ...settings, affiliateLink: e.target.value })} />
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Used as the default CTA URL in new campaigns.
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Current Plan</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{settings.plan ?? 'free'}</span>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--accent-300)' }}>
                        Manage billing →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="submit" className="btn btn-primary">
                  {isSaved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save Changes</>}
                </button>
              </div>
            </form>
          )}

          {/* API Keys */}
          {activeTab === 'apikeys' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Site public keys */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Site Public Keys</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 20px' }}>
                  Each site has a unique public key used in the embed snippet. These are safe to expose client-side.
                </p>
                {sites.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>
                    No sites registered yet. <a href="/sites" style={{ color: 'var(--accent-300)' }}>Add a site →</a>
                  </div>
                ) : (
                  sites.map((site: any) => (
                    <div key={site.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Globe size={12} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{site.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{site.domain}</span>
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
                        borderRadius: 6, padding: '8px 12px',
                      }}>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-300)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {site.publicKey ?? 'sp_pub_...'}
                        </code>
                        <button
                          className="btn btn-icon btn-sm"
                          onClick={() => handleCopy(site.publicKey ?? '', `site-${site.id}`)}
                          title="Copy public key"
                        >
                          {copiedKey === `site-${site.id}`
                            ? <Check size={13} style={{ color: 'var(--status-success)' }} />
                            : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Webhook */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Webhook Endpoint</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
                  POST events sent here: impression, click, conversion, dismiss.
                </p>
                <input
                  className="input"
                  type="url"
                  placeholder="https://your-server.com/webhooks/scrollpop"
                  value={settings.webhookUrl ?? ''}
                  onChange={(e) => {
                    const updated = { ...settings, webhookUrl: e.target.value };
                    setSettings(updated);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                  }}
                  style={{ maxWidth: 480 }}
                />
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 20px', letterSpacing: '-0.01em' }}>Notifications</h3>
              {[
                { key: 'notif_weekly', label: 'Weekly performance digest', desc: 'Sent every Monday morning' },
                { key: 'notif_conversion', label: 'Conversion milestones', desc: 'When a campaign hits 100, 1k, 10k conversions' },
                { key: 'notif_error', label: 'Snippet errors', desc: 'If your embed script fails to load' },
                { key: 'notif_billing', label: 'Usage warnings', desc: 'When approaching plan limits at 80% and 95%' },
              ].map(({ key, label, desc }) => (
                <div key={key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0', borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                  <button
                    onClick={() => {
                      const updated = { ...settings, [key]: !(settings as any)[key] };
                      setSettings(updated);
                      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                    }}
                    style={{
                      width: 36, height: 20, borderRadius: 10,
                      background: (settings as any)[key] ? 'var(--accent-500)' : 'var(--bg-raised)',
                      border: `1px solid ${(settings as any)[key] ? 'var(--accent-600)' : 'var(--border-default)'}`,
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 200ms',
                    }}
                    aria-label={label}
                  >
                    <div style={{
                      position: 'absolute',
                      top: 2, left: (settings as any)[key] ? 18 : 2,
                      width: 14, height: 14, borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 200ms var(--ease-spring)',
                    }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Integrations */}
          {activeTab === 'integrations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Platform guide header */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Platform Setup</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 20px' }}>
                  Install the ScrollPop snippet on your platform. Select a site to get the correct keys and code.
                </p>

                {/* Site selector */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Site</label>
                  {sites.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      No sites yet. <a href="/sites" style={{ color: 'var(--accent-300)' }}>Register a site →</a>
                    </div>
                  ) : (
                    <select
                      className="input"
                      style={{ maxWidth: 320 }}
                      value={selectedSiteId || selectedSite?.id || ''}
                      onChange={(e) => setSelectedSiteId(e.target.value)}
                    >
                      {sites.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name} — {s.domain}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Public key display */}
                {selectedSite && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Public Key</label>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
                      borderRadius: 6, padding: '8px 12px', maxWidth: 480,
                    }}>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-300)', flex: 1 }}>
                        {publicKey}
                      </code>
                      <button className="btn btn-icon btn-sm" onClick={() => handleCopy(publicKey, 'pubkey')} title="Copy">
                        {copiedKey === 'pubkey' ? <Check size={13} style={{ color: 'var(--status-success)' }} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Platform tabs */}
                <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--bg-raised)', borderRadius: 6, padding: 3, width: 'fit-content' }}>
                  {(['wordpress', 'shopify', 'html'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setActivePlatform(p)}
                      style={{
                        padding: '5px 14px', borderRadius: 4, fontSize: 12, fontWeight: 500,
                        background: activePlatform === p ? 'var(--bg-overlay)' : 'transparent',
                        color: activePlatform === p ? 'var(--text-primary)' : 'var(--text-muted)',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      {p === 'wordpress' ? 'WordPress' : p === 'shopify' ? 'Shopify' : 'HTML / Generic'}
                    </button>
                  ))}
                </div>

                {/* WordPress */}
                {activePlatform === 'wordpress' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Code size={13} />
                        Option A — Add to <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>functions.php</code>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                        Add this to your child theme's <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>functions.php</code>. Works with any WordPress theme.
                      </p>
                      <div style={{ position: 'relative' }}>
                        <pre style={{
                          fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: '18px',
                          background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
                          borderRadius: 6, padding: 16, overflowX: 'auto',
                          color: 'var(--accent-300)', margin: 0, whiteSpace: 'pre',
                        }}>
                          {getWpFunctionsPhp(publicKey)}
                        </pre>
                        <button
                          className="btn btn-icon btn-sm"
                          onClick={() => handleCopy(getWpFunctionsPhp(publicKey), 'wp_php')}
                          style={{ position: 'absolute', top: 8, right: 8, background: 'var(--bg-overlay)' }}
                          title="Copy"
                        >
                          {copiedKey === 'wp_php' ? <Check size={13} style={{ color: 'var(--status-success)' }} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Code size={13} />
                        Option B — Insert Headers and Footers plugin
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                        Install "Insert Headers and Footers" in WP Admin, then paste this into the <em>Header</em> field.
                      </p>
                      <div style={{ position: 'relative' }}>
                        <pre style={{
                          fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: '18px',
                          background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
                          borderRadius: 6, padding: 16, overflowX: 'auto',
                          color: 'var(--accent-300)', margin: 0, whiteSpace: 'pre',
                        }}>
                          {getSnippetJS(publicKey)}
                        </pre>
                        <button
                          className="btn btn-icon btn-sm"
                          onClick={() => handleCopy(getSnippetJS(publicKey), 'wp_snippet')}
                          style={{ position: 'absolute', top: 8, right: 8, background: 'var(--bg-overlay)' }}
                          title="Copy"
                        >
                          {copiedKey === 'wp_snippet' ? <Check size={13} style={{ color: 'var(--status-success)' }} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-raised)', borderRadius: 6, padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                      <strong style={{ color: 'var(--text-secondary)' }}>Plugin coming soon.</strong> A dedicated WordPress plugin with automatic updates, campaign analytics widget, and WooCommerce integration is in development.
                    </div>
                  </div>
                )}

                {/* Shopify */}
                {activePlatform === 'shopify' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Code size={13} />
                        Option A — Edit <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>theme.liquid</code>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                        In Shopify Admin → Online Store → Themes → Edit code, open <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>layout/theme.liquid</code> and paste before <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>&lt;/head&gt;</code>.
                      </p>
                      <div style={{ position: 'relative' }}>
                        <pre style={{
                          fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: '18px',
                          background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
                          borderRadius: 6, padding: 16, overflowX: 'auto',
                          color: 'var(--accent-300)', margin: 0, whiteSpace: 'pre',
                        }}>
                          {getShopifyThemeLiquid(publicKey)}
                        </pre>
                        <button
                          className="btn btn-icon btn-sm"
                          onClick={() => handleCopy(getShopifyThemeLiquid(publicKey), 'shopify_theme')}
                          style={{ position: 'absolute', top: 8, right: 8, background: 'var(--bg-overlay)' }}
                          title="Copy"
                        >
                          {copiedKey === 'shopify_theme' ? <Check size={13} style={{ color: 'var(--status-success)' }} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Code size={13} />
                        Option B — App Embed Block (Shopify CLI)
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                        Create <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>sections/scrollpop-embed.liquid</code> in your theme with this content. Enables merchants to enable/disable without touching code.
                      </p>
                      <div style={{ position: 'relative' }}>
                        <pre style={{
                          fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: '18px',
                          background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
                          borderRadius: 6, padding: 16, overflowX: 'auto',
                          color: 'var(--accent-300)', margin: 0, whiteSpace: 'pre',
                        }}>
                          {getShopifyAppEmbedBlock(publicKey)}
                        </pre>
                        <button
                          className="btn btn-icon btn-sm"
                          onClick={() => handleCopy(getShopifyAppEmbedBlock(publicKey), 'shopify_embed')}
                          style={{ position: 'absolute', top: 8, right: 8, background: 'var(--bg-overlay)' }}
                          title="Copy"
                        >
                          {copiedKey === 'shopify_embed' ? <Check size={13} style={{ color: 'var(--status-success)' }} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-raised)', borderRadius: 6, padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                      <strong style={{ color: 'var(--text-secondary)' }}>Shopify App coming soon.</strong> A native Shopify app with one-click install, automatic site registration, and Shopify Flow integration is in development.
                    </div>
                  </div>
                )}

                {/* Generic HTML */}
                {activePlatform === 'html' && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Code size={13} />
                      Embed snippet — paste before <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>&lt;/head&gt;</code>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                      Works on any HTML page, React app, Next.js, static site generator, or donation platform.
                    </p>
                    <div style={{ position: 'relative' }}>
                      <pre style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: '18px',
                        background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
                        borderRadius: 6, padding: 16, overflowX: 'auto',
                        color: 'var(--accent-300)', margin: 0, whiteSpace: 'pre',
                      }}>
                        {getSnippetJS(publicKey)}
                      </pre>
                      <button
                        className="btn btn-icon btn-sm"
                        onClick={() => handleCopy(getSnippetJS(publicKey), 'html_snippet')}
                        style={{ position: 'absolute', top: 8, right: 8, background: 'var(--bg-overlay)' }}
                        title="Copy"
                      >
                        {copiedKey === 'html_snippet' ? <Check size={13} style={{ color: 'var(--status-success)' }} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Connected services */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Connected Services</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>Infrastructure integrations managed by the platform.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {CONNECTED_SERVICES.map(({ name, status, desc }) => (
                    <div key={name} style={{
                      background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
                      borderRadius: 6, padding: '12px 14px',
                      opacity: status === 'coming_soon' ? 0.5 : 1,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{name}</span>
                        <span className={`badge ${status === 'connected' ? 'badge-success' : status === 'pending' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 9 }}>
                          {status === 'coming_soon' ? 'soon' : status}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          {activeTab === 'danger' && (
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid #7f1d1d',
              borderRadius: 8,
              padding: 24,
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 8px', color: 'var(--status-error)', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} />
                Danger Zone
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px' }}>
                These actions are permanent and cannot be undone.
              </p>

              <div style={{ padding: '16px', background: 'rgba(239,68,68,0.05)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.15)' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Delete Organization
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
                  Permanently delete your organization, all campaigns, sites, and data. This cannot be reversed.
                </p>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Type <strong style={{ color: 'var(--text-secondary)' }}>DELETE</strong> to confirm
                  </label>
                  <input
                    className="input"
                    type="text"
                    placeholder="DELETE"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    style={{ maxWidth: 240, borderColor: deleteConfirm === 'DELETE' ? 'var(--status-error)' : undefined }}
                  />
                </div>
                <button
                  className="btn btn-destructive btn-sm"
                  disabled={deleteConfirm !== 'DELETE'}
                  style={{ opacity: deleteConfirm !== 'DELETE' ? 0.5 : 1 }}
                >
                  Delete Organization
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
