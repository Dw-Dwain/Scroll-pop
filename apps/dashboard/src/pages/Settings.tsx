import React from 'react';
import {
  Shield, Key, Bell, Puzzle, AlertTriangle, Copy, Check, Save, Code, Globe,
  ChevronRight, RefreshCw, Eye, EyeOff, ExternalLink, Zap, BarChart2,
  Webhook, Download, Pause, Trash2, Info, Clock, Mail, Smartphone,
  Building2, Link2, Languages, CreditCard, Activity,
} from 'lucide-react';
import { useList, useUpdate, useCustomMutation, useCustom } from '@refinedev/core';
import { getApiBase } from '../providers/dataProvider';
import { usePlan } from '../hooks/usePlan';

const STORAGE_KEY = '_sp_settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, any>;
  } catch {}
  return {
    orgName: 'My Organization',
    orgSlug: 'my-organization',
    website: '',
    supportEmail: '',
    timezone: 'UTC',
    dateFormat: 'MMM D, YYYY',
    currency: 'USD',
    affiliateLink: 'https://affiliate.example.com',
    amazonAffiliate: '',
    rakutenAffiliate: '',
    webhookUrl: '',
    webhookSecret: 'whsec_placeholder_32chars_min',
    notif_weekly: false,
    notif_conversion: true,
    notif_ab_winner: false,
    notif_campaign_status: true,
    notif_snippet_error: true,
    notif_usage_80: true,
    notif_usage_95: true,
    notif_invoice: true,
    notif_trial: false,
    notif_channels_email: true,
    notif_channels_inapp: true,
  };
}

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

type Tab = 'general' | 'apikeys' | 'notifications' | 'integrations' | 'danger';

const TABS: { id: Tab; label: string; icon: React.FC<any>; danger?: boolean }[] = [
  { id: 'general',       label: 'General',       icon: Building2 },
  { id: 'apikeys',       label: 'API Keys',       icon: Key },
  { id: 'notifications', label: 'Notifications',  icon: Bell },
  { id: 'integrations',  label: 'Integrations',   icon: Puzzle },
  { id: 'danger',        label: 'Danger Zone',    icon: AlertTriangle, danger: true },
];

function getSnippetJS(publicKey: string) {
  return `<script>\n(function(w,d,s,p){\n  p=w.__sp=w.__sp||{};\n  if(p.loaded)return; p.loaded=true;\n  var el=d.createElement(s); el.async=true; el.defer=true;\n  el.src='https://cdn.scrollpop.online/v1/${publicKey}/p.js';\n  d.head.appendChild(el);\n})(window,document,'script');\n<\/script>`;
}
function getWpFunctionsPhp(publicKey: string) {
  return `<?php\nfunction scrollpop_embed_script() {\n    $public_key = '${publicKey}';\n    ?>\n    <script>\n    (function(w,d,s,p){\n      p=w.__sp=w.__sp||{};\n      if(p.loaded)return; p.loaded=true;\n      var el=d.createElement(s); el.async=true; el.defer=true;\n      el.src='https://cdn.scrollpop.online/v1/<?php echo esc_js( $public_key ); ?>/p.js';\n      d.head.appendChild(el);\n    })(window,document,'script');\n    <\/script>\n    <?php\n}\nadd_action( 'wp_head', 'scrollpop_embed_script' );`;
}
function getShopifyThemeLiquid(publicKey: string) {
  return `{%- comment -%} ScrollPop — place just before </head> {%- endcomment -%}\n<script>\n(function(w,d,s,p){\n  p=w.__sp=w.__sp||{};\n  if(p.loaded)return; p.loaded=true;\n  var el=d.createElement(s); el.async=true; el.defer=true;\n  el.src='https://cdn.scrollpop.online/v1/${publicKey}/p.js';\n  d.head.appendChild(el);\n})(window,document,'script');\n<\/script>`;
}
function getShopifyAppEmbedBlock(publicKey: string) {
  return `{% comment %} sections/scrollpop-embed.liquid {% endcomment %}\n{% if section.settings.public_key != blank %}\n<script>\n(function(w,d,s,p){\n  p=w.__sp=w.__sp||{};\n  if(p.loaded)return; p.loaded=true;\n  var el=d.createElement(s); el.async=true; el.defer=true;\n  el.src='https://cdn.scrollpop.online/v1/{{ section.settings.public_key }}/p.js';\n  d.head.appendChild(el);\n})(window,document,'script');\n<\/script>\n{% endif %}\n\n{% schema %}\n{\n  "name": "ScrollPop",\n  "target": "head",\n  "settings": [\n    {\n      "type": "text",\n      "id": "public_key",\n      "label": "ScrollPop Public Key",\n      "default": "${publicKey}"\n    }\n  ]\n}\n{% endschema %}`;
}

// ── Sub-components ────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children, noPad }: { title: string; subtitle?: string; children: React.ReactNode; noPad?: boolean }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
      {(title || subtitle) && (
        <div style={{ padding: '18px 24px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: subtitle ? 3 : 0 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>}
        </div>
      )}
      <div style={noPad ? {} : { padding: 24 }}>{children}</div>
    </div>
  );
}

function FieldRow({ label, hint, children, half }: { label: string; hint?: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: half ? 320 : '100%' }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-label={label}
      style={{
        width: 36, height: 20, borderRadius: 10, flexShrink: 0,
        background: checked ? 'var(--accent-500)' : 'var(--bg-overlay)',
        border: `1px solid ${checked ? 'var(--accent-600)' : 'var(--border-default)'}`,
        cursor: 'pointer', position: 'relative', transition: 'background 200ms',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: checked ? 17 : 2,
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        transition: 'left 180ms var(--ease-spring)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function NotifRow({ label, desc, settingKey, settings, onChange, channels }: {
  label: string; desc: string; settingKey: string;
  settings: any; onChange: (k: string, v: any) => void; channels?: boolean;
}) {
  const isOn = !!(settings as any)[settingKey];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
      </div>
      {channels && (
        <div style={{ display: 'flex', gap: 6, marginRight: 16 }}>
          <span title="Email" style={{ opacity: isOn ? 0.9 : 0.25, transition: 'opacity 200ms' }}><Mail size={13} style={{ color: 'var(--text-muted)' }} /></span>
          <span title="In-app" style={{ opacity: isOn ? 0.9 : 0.25, transition: 'opacity 200ms' }}><Smartphone size={13} style={{ color: 'var(--text-muted)' }} /></span>
        </div>
      )}
      <Toggle checked={isOn} onChange={(v) => onChange(settingKey, v)} label={label} />
    </div>
  );
}

function CodeBlock({ code, copyKey, copiedKey, onCopy }: { code: string; copyKey: string; copiedKey: string | null; onCopy: (text: string, key: string) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <pre style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: '19px',
        background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
        borderRadius: 8, padding: 16, overflowX: 'auto',
        color: 'var(--accent-300)', margin: 0, whiteSpace: 'pre',
      }}>
        {code}
      </pre>
      <button
        className="btn btn-icon btn-sm"
        onClick={() => onCopy(code, copyKey)}
        style={{ position: 'absolute', top: 8, right: 8, background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)' }}
        title="Copy code"
      >
        {copiedKey === copyKey ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<Tab>('general');
  const [settings, setSettings] = React.useState(loadSettings);
  const [isSaved, setIsSaved] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState('');
  const [activePlatform, setActivePlatform] = React.useState<'wordpress' | 'shopify' | 'html'>('wordpress');
  const [selectedSiteId, setSelectedSiteId] = React.useState<string>('');
  const [showSecretKey, setShowSecretKey] = React.useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = React.useState(false);
  const [testingWebhook, setTestingWebhook] = React.useState(false);

  const [toastMsg, setToastMsg] = React.useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const [secretKey, setSecretKey] = React.useState(() => {
    return localStorage.getItem('_sp_secret_key') ?? '';
  });

  const handleRotateSecretKey = () => {
    // No API-key system exists in the backend yet — don't fabricate a key that won't work.
    showToast("API key management isn't available yet — coming in a future release.");
  };

  const handleTestWebhook = async () => {
    if (!settings.webhookUrl) {
      showToast("Please enter a webhook endpoint URL first.");
      return;
    }
    setTestingWebhook(true);
    try {
      const response = await fetch(settings.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ScrollPop-Signature': 'sha256=mock_signature_for_testing_purposes',
        },
        body: JSON.stringify({
          event: 'conversion',
          timestamp: new Date().toISOString(),
          campaign: { id: 'camp_test_123', name: 'Test Campaign' },
          visitor: { id: 'vis_test_456', device: 'desktop', country: 'US' },
        }),
      });
      if (response.ok) {
        showToast("✅ Test event sent successfully! Status: " + response.status);
      } else {
        showToast("⚠️ Webhook returned status code: " + response.status);
      }
    } catch (err: any) {
      showToast("❌ Failed to connect to webhook: " + err.message);
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleRequestExport = () => {
    // No export backend yet. Point users at the working per-campaign CSV export on Analytics.
    showToast("Account-wide export isn't available yet — use the CSV export on the Analytics page.");
  };

  const [pausing, setPausing] = React.useState(false);
  const handlePauseAll = async () => {
    if (!window.confirm("Pause all active campaigns immediately? This disables popups across all live sites.")) return;
    const active = campaigns.filter((c) => c.status === 'active');
    if (active.length === 0) { showToast("No active campaigns to pause."); return; }
    setPausing(true);
    let paused = 0;
    try {
      for (const c of active) {
        try {
          await customMutate({ url: `${getApiBase()}/campaigns/${c.id}/pause`, method: 'post', values: {} });
          paused++;
        } catch { /* keep going; report the count actually paused */ }
      }
      await refetchCampaigns();
      showToast(paused === active.length
        ? `Paused ${paused} campaign${paused === 1 ? '' : 's'}.`
        : `Paused ${paused} of ${active.length}; ${active.length - paused} failed.`);
    } finally {
      setPausing(false);
    }
  };

  const handleResetAnalytics = () => {
    // Events are an immutable append-only log; there is no reset endpoint. Don't fake it.
    showToast("Resetting analytics isn't available — event history is immutable in this beta.");
  };

  const handleDeleteOrg = () => {
    if (deleteConfirm !== 'DELETE') return;
    // No account-deletion backend yet; clearing localStorage would NOT delete server data,
    // so we don't pretend it did. Surface an honest message instead.
    showToast("Account deletion isn't available yet — contact support to close your account.");
  };

  // Organization identity (workspace name/slug/branding) is an Agency-tier feature.
  // meetsMinPlan('agency') is also true for super-admin / Novatise (unlimited).
  const { meetsMinPlan } = usePlan();
  const canManageOrg = meetsMinPlan('agency');

  const { data: sitesData } = useList({ resource: 'sites' });
  const sites = (sitesData?.data ?? []) as any[];
  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? sites[0] ?? null;
  const publicKey = selectedSite?.publicKey ?? 'YOUR_PUBLIC_KEY';

  // Tenant (org) — name is real server data persisted via PATCH /tenants/:id
  const { data: tenantData } = useList({ resource: 'tenants' });
  const tenant = (tenantData?.data?.[0] ?? null) as any;
  const { mutateAsync: updateTenant } = useUpdate();

  // Campaigns — used by Pause-all
  const { data: campaignsData, refetch: refetchCampaigns } = useList({ resource: 'campaigns', pagination: { mode: 'off' } });
  const campaigns = (campaignsData?.data ?? []) as any[];
  const { mutateAsync: customMutate } = useCustomMutation();

  // Seed org fields from the server tenant once it loads.
  React.useEffect(() => {
    if (tenant?.name && tenant.name !== settings.orgName) {
      setSettings((s: Record<string, any>) => ({ ...s, orgName: tenant.name, orgSlug: slugify(tenant.name) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.name]);

  const persistSettings = (updated: Record<string, any>) => {
    setSettings(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // Client-side preferences (timezone, notifications, default triggers) persist locally;
    // the organization name is real server data and goes to the API.
    persistSettings(settings);
    try {
      if (tenant?.id && settings.orgName && settings.orgName !== tenant.name) {
        await updateTenant({ resource: 'tenants', id: tenant.id, values: { name: settings.orgName } });
      }
      setIsSaved(true);
      showToast("Settings saved.");
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err: any) {
      showToast(err?.message ?? "Couldn't save organization name to the server.");
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Notification preferences are real server data (gate which notifications get
  // emitted). Seed the notif_* toggles from the server on load, and persist each
  // change back via PUT /notification-prefs (not just localStorage).
  const { data: notifPrefsRes } = useCustom({
    url: `${getApiBase()}/notification-prefs`,
    method: 'get',
    queryOptions: { queryKey: ['notification-prefs'] },
  });
  React.useEffect(() => {
    const serverPrefs = (notifPrefsRes as any)?.data;
    if (serverPrefs && typeof serverPrefs === 'object' && Object.keys(serverPrefs).length > 0) {
      setSettings((s: Record<string, any>) => ({ ...s, ...serverPrefs }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifPrefsRes]);

  const handleNotifChange = (key: string, value: boolean) => {
    persistSettings({ ...settings, [key]: value });
    // Persist notification prefs server-side so they gate real notification delivery.
    customMutate({ url: `${getApiBase()}/notification-prefs`, method: 'put', values: { [key]: value } })
      .catch(() => showToast("Couldn't save notification preference to the server."));
  };

  return (
    <section style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Left panel — sticky */}
      <div style={{
        width: 240, flexShrink: 0,
        padding: '32px 24px',
        borderRight: '1px solid var(--border-subtle)',
        height: '100%', overflowY: 'auto',
        background: 'var(--bg-surface)',
      }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Settings</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            Organization &amp; preferences
          </p>
        </div>
        {TABS.map(({ id, label, icon: Icon, danger }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`nav-item${activeTab === id ? ' active' : ''}`}
            style={{ width: '100%', marginBottom: 2, color: danger && activeTab !== id ? 'var(--status-error)' : undefined }}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Content — centered in remaining space */}
      <div style={{ flex: 1, overflowY: 'auto', height: '100%', padding: '32px 48px 120px', display: 'flex', justifyContent: 'center', minWidth: 0 }}>
        <div style={{ width: '100%', maxWidth: 720 }}>
          <form onSubmit={handleSave}>
            {/* ── GENERAL ── */}
            {activeTab === 'general' && (
              <div>
              {/* Organization — Agency-tier only */}
              {!canManageOrg ? (
                <SectionCard title="Organization" subtitle="Your workspace identity visible to team members.">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Building2 size={15} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        Organization identity is an Agency-plan feature
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        Custom workspace name, slug, website, and support email are available on the Agency plan.
                      </div>
                    </div>
                    <span className="badge badge-neutral" style={{ fontSize: 10, flexShrink: 0 }}>Agency</span>
                  </div>
                </SectionCard>
              ) : (
              <SectionCard title="Organization" subtitle="Your workspace identity visible to team members.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <FieldRow label="Organization Name">
                    <input
                      className="input"
                      type="text"
                      value={settings.orgName ?? ''}
                      onChange={(e) => {
                        const name = e.target.value;
                        setSettings({ ...settings, orgName: name, orgSlug: slugify(name) });
                      }}
                    />
                  </FieldRow>
                  <FieldRow label="Slug" hint="Auto-generated from your organization name; used in API endpoints and URLs.">
                    <div style={{ position: 'relative' }}>
                      <input
                        className="input"
                        type="text"
                        value={settings.orgSlug ?? ''}
                        onChange={(e) => setSettings({ ...settings, orgSlug: slugify(e.target.value) })}
                        style={{ paddingLeft: 124, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                      />
                      <span style={{
                        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                        pointerEvents: 'none', whiteSpace: 'nowrap',
                      }}>
                        scrollpop.online/
                      </span>
                    </div>
                  </FieldRow>
                  <FieldRow label="Website URL">
                    <input
                      className="input"
                      type="url"
                      placeholder="https://yourcompany.com"
                      value={settings.website ?? ''}
                      onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                    />
                  </FieldRow>
                  <FieldRow label="Support Email">
                    <input
                      className="input"
                      type="email"
                      placeholder="support@yourcompany.com"
                      value={settings.supportEmail ?? ''}
                      onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                    />
                  </FieldRow>
                </div>
              </SectionCard>
              )}

              {/* Localization */}
              <SectionCard title="Localization" subtitle="Regional preferences for dates, times, and currency.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <FieldRow label="Timezone">
                    <select className="input" value={settings.timezone ?? 'UTC'} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}>
                      {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney'].map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow label="Date Format">
                    <select className="input" value={settings.dateFormat ?? 'MMM D, YYYY'} onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}>
                      <option value="MMM D, YYYY">Jan 1, 2026</option>
                      <option value="MM/DD/YYYY">01/01/2026</option>
                      <option value="DD/MM/YYYY">01/01/2026 (EU)</option>
                      <option value="YYYY-MM-DD">2026-01-01</option>
                    </select>
                  </FieldRow>
                  <FieldRow label="Currency">
                    <select className="input" value={settings.currency ?? 'USD'} onChange={(e) => setSettings({ ...settings, currency: e.target.value })}>
                      {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </FieldRow>
                </div>
              </SectionCard>

              {/* Affiliate Networks */}
              <SectionCard title="Affiliate Networks" subtitle="Saved affiliate links to reuse across campaigns and ad slots.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <FieldRow label="Affiliate Base URL" hint="Default CTA URL pre-filled in new campaigns.">
                    <input
                      className="input"
                      type="url"
                      placeholder="https://affiliate.example.com"
                      value={settings.affiliateLink ?? ''}
                      onChange={(e) => setSettings({ ...settings, affiliateLink: e.target.value })}
                    />
                  </FieldRow>
                  <FieldRow label="Amazon Associates Link" hint="Your Amazon affiliate link or storefront (e.g. https://amzn.to/… or ?tag=yourtag-20).">
                    <input
                      className="input"
                      type="url"
                      placeholder="https://www.amazon.com/?tag=yourtag-20"
                      value={settings.amazonAffiliate ?? ''}
                      onChange={(e) => setSettings({ ...settings, amazonAffiliate: e.target.value })}
                    />
                  </FieldRow>
                  <FieldRow label="Rakuten Affiliate Link" hint="Your Rakuten Advertising deep link or publisher URL.">
                    <input
                      className="input"
                      type="url"
                      placeholder="https://click.linksynergy.com/…"
                      value={settings.rakutenAffiliate ?? ''}
                      onChange={(e) => setSettings({ ...settings, rakutenAffiliate: e.target.value })}
                    />
                  </FieldRow>
                </div>
                <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Zap size={14} style={{ color: 'var(--accent-500)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    These links can be selected when adding affiliate slots in the campaign designer. Deeper auto-wiring (auto-tagging product URLs) is coming soon.
                  </span>
                </div>
              </SectionCard>

              </div>
            )}

          {/* ── API KEYS ── */}
          {activeTab === 'apikeys' && (
            <div>
              {/* Secret API Key */}
              <SectionCard
                title="Secret API Key"
                subtitle="Used to authenticate server-side API calls. Never expose this in client-side code."
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <span className="badge badge-success" style={{ fontSize: 10 }}>Live</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rate limit: 1,000 req/min</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} /> Created May 2026
                  </span>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {showSecretKey ? secretKey : `sk_live_${'•'.repeat(32)}`}
                  </code>
                  <button className="btn btn-icon btn-sm" onClick={() => setShowSecretKey(v => !v)} title={showSecretKey ? 'Hide' : 'Reveal'}>
                    {showSecretKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button className="btn btn-icon btn-sm" onClick={() => handleCopy(secretKey, 'secret_key')} title="Copy">
                    {copiedKey === 'secret_key' ? <Check size={13} style={{ color: 'var(--status-success)' }} /> : <Copy size={13} />}
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ gap: 5 }} onClick={handleRotateSecretKey} title="Rotate key">
                    <RefreshCw size={12} /> Rotate
                  </button>
                </div>
                <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Info size={13} style={{ color: 'var(--status-warning)', marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Rotating generates a new key immediately. Your previous key will stop working within 60 seconds. Update your server environment variables before rotating.
                  </span>
                </div>
              </SectionCard>

              {/* Site Public Keys */}
              <SectionCard title="Site Public Keys" subtitle="Safe to expose in client-side embed code. One key per registered site.">
                {sites.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center' }}>
                    <Globe size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>No sites registered yet.</div>
                    <a href="/sites" style={{ fontSize: 13, color: 'var(--accent-300)' }}>Register your first site →</a>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {sites.map((site: any) => (
                      <div key={site.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <Globe size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{site.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{site.domain}</span>
                          <span className={`badge ${site.isActive ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 9, marginLeft: 'auto' }}>
                            {site.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          background: 'var(--bg-raised)', borderRadius: 6, padding: '8px 12px',
                        }}>
                          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-300)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {site.publicKey ?? 'sp_pub_...'}
                          </code>
                          <button className="btn btn-icon btn-sm" onClick={() => handleCopy(site.publicKey ?? '', `site-${site.id}`)} title="Copy">
                            {copiedKey === `site-${site.id}` ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Webhook */}
              <SectionCard title="Webhook Endpoint" subtitle="Receive real-time event payloads from ScrollPop to your server.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <FieldRow label="Endpoint URL" hint="POST requests will be sent here for impression, click, conversion, and dismiss events.">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="input"
                        type="url"
                        placeholder="https://your-server.com/webhooks/scrollpop"
                        value={settings.webhookUrl ?? ''}
                        onChange={(e) => persistSettings({ ...settings, webhookUrl: e.target.value })}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleTestWebhook}
                        disabled={testingWebhook || !settings.webhookUrl}
                        style={{ minWidth: 120, fontSize: 12 }}
                      >
                        {testingWebhook ? "Sending..." : "Send test event"}
                      </button>
                    </div>
                  </FieldRow>

                  <FieldRow label="Signing Secret" hint="Verify webhook authenticity by checking the X-ScrollPop-Signature header.">
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
                      borderRadius: 8, padding: '10px 14px',
                    }}>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {showWebhookSecret ? settings.webhookSecret : `whsec_${'•'.repeat(28)}`}
                      </code>
                      <button className="btn btn-icon btn-sm" onClick={() => setShowWebhookSecret(v => !v)}>
                        {showWebhookSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button className="btn btn-icon btn-sm" onClick={() => handleCopy(settings.webhookSecret ?? '', 'wh_secret')}>
                        {copiedKey === 'wh_secret' ? <Check size={13} style={{ color: 'var(--status-success)' }} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </FieldRow>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Events delivered</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['impression', 'view', 'click', 'dismiss', 'conversion'].map((evt) => (
                        <span key={evt} className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{evt}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeTab === 'notifications' && (
            <div>
              {/* Channel Preferences */}
              <SectionCard title="Delivery Channels" subtitle="Choose how you receive notifications.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[
                    { key: 'notif_channels_email', label: 'Email notifications', desc: 'Sent to your account email address', icon: Mail },
                    { key: 'notif_channels_inapp', label: 'In-app notifications', desc: 'Shown in the notification center', icon: Smartphone },
                  ].map(({ key, label, desc, icon: Icon }, i, arr) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={15} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                        </div>
                      </div>
                      <Toggle checked={!!(settings as any)[key]} onChange={(v) => handleNotifChange(key, v)} label={label} />
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Activity */}
              <SectionCard title="Campaign Activity" subtitle="Notifications about campaign performance and events.">
                <div>
                  <NotifRow label="Conversion milestones" desc="When a campaign hits 100, 1k, 10k, or 100k conversions" settingKey="notif_conversion" settings={settings} onChange={handleNotifChange} channels />
                  <NotifRow label="A/B test winner declared" desc="When a variant reaches statistical significance (≥95% confidence)" settingKey="notif_ab_winner" settings={settings} onChange={handleNotifChange} channels />
                  <NotifRow label="Campaign status changes" desc="When a campaign goes live, pauses, or expires" settingKey="notif_campaign_status" settings={settings} onChange={handleNotifChange} channels />
                </div>
              </SectionCard>

              {/* Alerts */}
              <SectionCard title="Alerts" subtitle="Critical issues that may affect your campaigns.">
                <div>
                  <NotifRow label="Snippet load errors" desc="If your embed script fails to load on a registered site" settingKey="notif_snippet_error" settings={settings} onChange={handleNotifChange} channels />
                  <NotifRow label="Usage approaching 80%" desc="Early warning before you approach your plan limit" settingKey="notif_usage_80" settings={settings} onChange={handleNotifChange} channels />
                  <NotifRow label="Usage approaching 95%" desc="Final warning — you're close to hitting your plan cap" settingKey="notif_usage_95" settings={settings} onChange={handleNotifChange} channels />
                </div>
              </SectionCard>

              {/* Billing */}
              <SectionCard title="Billing & Reports" subtitle="Invoices, renewals, and digest emails.">
                <div>
                  <NotifRow label="Invoice issued" desc="When a new invoice is generated for your subscription" settingKey="notif_invoice" settings={settings} onChange={handleNotifChange} channels />
                  <NotifRow label="Trial ending soon" desc="7 days and 1 day before your trial expires" settingKey="notif_trial" settings={settings} onChange={handleNotifChange} channels />
                  <NotifRow label="Weekly performance digest" desc="Summary of views, clicks, and conversions every Monday" settingKey="notif_weekly" settings={settings} onChange={handleNotifChange} channels />
                </div>
              </SectionCard>
            </div>
          )}

          {/* ── INTEGRATIONS ── */}
          {activeTab === 'integrations' && (
            <div>
              {/* Platform Setup */}
              <SectionCard title="Platform Setup" subtitle="Install the ScrollPop snippet on your platform.">
                {/* Site selector */}
                <div style={{ marginBottom: 20 }}>
                  <FieldRow label="Site" half>
                    {sites.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        No sites yet. <a href="/sites" style={{ color: 'var(--accent-300)' }}>Register a site →</a>
                      </div>
                    ) : (
                      <select className="input" value={selectedSiteId || selectedSite?.id || ''} onChange={(e) => setSelectedSiteId(e.target.value)}>
                        {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name} — {s.domain}</option>)}
                      </select>
                    )}
                  </FieldRow>
                </div>

                {selectedSite && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, marginBottom: 20 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Public Key</span>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-300)', flex: 1 }}>{publicKey}</code>
                    <button className="btn btn-icon btn-sm" onClick={() => handleCopy(publicKey, 'pubkey')}>
                      {copiedKey === 'pubkey' ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
                    </button>
                  </div>
                )}

                {/* Platform tabs */}
                <div style={{ display: 'flex', gap: 2, marginBottom: 24, background: 'var(--bg-raised)', borderRadius: 6, padding: 3, width: 'fit-content', border: '1px solid var(--border-subtle)' }}>
                  {(['wordpress', 'shopify', 'html'] as const).map((p) => (
                    <button key={p} onClick={() => setActivePlatform(p)} style={{
                      padding: '5px 16px', borderRadius: 4, fontSize: 12, fontWeight: 500,
                      background: activePlatform === p ? 'var(--bg-surface)' : 'transparent',
                      color: activePlatform === p ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: activePlatform === p ? '1px solid var(--border-subtle)' : '1px solid transparent',
                      cursor: 'pointer', boxShadow: activePlatform === p ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 100ms',
                    }}>
                      {p === 'wordpress' ? 'WordPress' : p === 'shopify' ? 'Shopify' : 'HTML / Generic'}
                    </button>
                  ))}
                </div>

                {activePlatform === 'wordpress' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Code size={13} /> Option A — Add to <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-raised)', padding: '1px 5px', borderRadius: 3 }}>functions.php</code>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>Add to your child theme. Works with any WordPress theme.</p>
                      <CodeBlock code={getWpFunctionsPhp(publicKey)} copyKey="wp_php" copiedKey={copiedKey} onCopy={handleCopy} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Code size={13} /> Option B — Insert Headers and Footers plugin
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>Install the "Insert Headers and Footers" plugin, paste this into the <em>Header</em> field.</p>
                      <CodeBlock code={getSnippetJS(publicKey)} copyKey="wp_snippet" copiedKey={copiedKey} onCopy={handleCopy} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8 }}>
                      <Zap size={14} style={{ color: 'var(--accent-500)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        <strong>WordPress plugin coming soon</strong> — one-click install, auto-updates, and WooCommerce integration.
                      </span>
                    </div>
                  </div>
                )}

                {activePlatform === 'shopify' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Code size={13} /> Option A — Edit <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-raised)', padding: '1px 5px', borderRadius: 3 }}>theme.liquid</code>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
                        Open Shopify Admin → Online Store → Themes → Edit code. Paste before <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>&lt;/head&gt;</code>.
                      </p>
                      <CodeBlock code={getShopifyThemeLiquid(publicKey)} copyKey="shopify_theme" copiedKey={copiedKey} onCopy={handleCopy} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Code size={13} /> Option B — App Embed Block (Shopify CLI)
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
                        Create <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>sections/scrollpop-embed.liquid</code>. Lets merchants toggle without editing code.
                      </p>
                      <CodeBlock code={getShopifyAppEmbedBlock(publicKey)} copyKey="shopify_embed" copiedKey={copiedKey} onCopy={handleCopy} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8 }}>
                      <Zap size={14} style={{ color: 'var(--accent-500)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        <strong>Native Shopify App coming soon</strong> — one-click install, automatic site registration, and Shopify Flow integration.
                      </span>
                    </div>
                  </div>
                )}

                {activePlatform === 'html' && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Code size={13} /> Paste before <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-raised)', padding: '1px 5px', borderRadius: 3 }}>&lt;/head&gt;</code>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
                      Works on any HTML page, React app, Next.js, Vue, static site, or donation platform.
                    </p>
                    <CodeBlock code={getSnippetJS(publicKey)} copyKey="html_snippet" copiedKey={copiedKey} onCopy={handleCopy} />
                  </div>
                )}
              </SectionCard>

              {/* Connected Services */}
              <SectionCard title="Connected Services" subtitle="Infrastructure services powering your ScrollPop workspace.">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {[
                    { name: 'Stripe', desc: 'Billing & subscriptions', status: 'connected', detail: 'Webhooks active' },
                    { name: 'Clerk', desc: 'Authentication & users', status: 'connected', detail: 'Multi-tenant orgs' },
                    { name: 'Cloudflare', desc: 'CDN, Workers & KV', status: 'connected', detail: '23ms avg latency' },
                    { name: 'Upstash Redis', desc: 'Event ingest buffer', status: 'connected', detail: '~12k ops/day' },
                    { name: 'PostHog', desc: 'Product analytics', status: 'pending', detail: 'Setup required' },
                    { name: 'Sentry', desc: 'Error tracking', status: 'pending', detail: 'Setup required' },
                    { name: 'Zapier', desc: 'Workflow automation', status: 'coming_soon', detail: 'Q3 2026' },
                    { name: 'Slack', desc: 'Team notifications', status: 'coming_soon', detail: 'Q3 2026' },
                    { name: 'Google Analytics', desc: 'UA / GA4 events', status: 'coming_soon', detail: 'Q4 2026' },
                  ].map(({ name, desc, status, detail }) => (
                    <div key={name} style={{
                      border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '14px 16px',
                      background: status === 'coming_soon' ? 'var(--bg-raised)' : 'var(--bg-surface)',
                      opacity: status === 'coming_soon' ? 0.6 : 1,
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                        <span className={`badge ${status === 'connected' ? 'badge-success' : status === 'pending' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 9 }}>
                          {status === 'coming_soon' ? 'soon' : status}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                      <div style={{ fontSize: 10, color: status === 'connected' ? 'var(--status-success)' : 'var(--text-muted)', fontWeight: 500 }}>{detail}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}

          {/* ── DANGER ZONE ── */}
          {activeTab === 'danger' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Export */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Export Your Data</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Account-wide export isn't available yet. For now, export per-campaign analytics as CSV from the Analytics page.</div>
                </div>
                <button type="button" onClick={handleRequestExport} className="btn btn-secondary" style={{ gap: 6, flexShrink: 0 }}>
                  <Download size={13} /> Request Export
                </button>
              </div>

              {/* Pause all campaigns */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Pause All Campaigns</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Immediately pause every active campaign across all your sites. Campaigns can be individually reactivated afterward.</div>
                </div>
                <button type="button" onClick={handlePauseAll} disabled={pausing} className="btn btn-secondary" style={{ gap: 6, flexShrink: 0, color: 'var(--status-warning)', borderColor: 'rgba(245,158,11,0.3)' }}>
                  {pausing ? <RefreshCw size={13} className="spin" /> : <Pause size={13} />} {pausing ? 'Pausing…' : 'Pause All'}
                </button>
              </div>

              {/* Reset analytics */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Reset Analytics</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Permanently erase all impression, click, and conversion event data. Campaign configurations are preserved. Cannot be undone.</div>
                </div>
                <button type="button" onClick={handleResetAnalytics} className="btn btn-secondary" style={{ gap: 6, flexShrink: 0, color: 'var(--status-error)', borderColor: 'rgba(239,68,68,0.3)' }}>
                  <BarChart2 size={13} /> Reset Data
                </button>
              </div>

              {/* Delete Organization */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <AlertTriangle size={16} style={{ color: 'var(--status-error)' }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--status-error)' }}>Delete Organization</div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
                  Permanently delete your organization, all campaigns, sites, analytics, and billing data. This cannot be undone. Your Stripe subscription will be cancelled immediately.
                </p>
                <div style={{ padding: '16px', background: 'rgba(239,68,68,0.04)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.1)' }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                    Type <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-error)' }}>DELETE</strong> to unlock the button
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="input"
                      type="text"
                      placeholder="DELETE"
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      style={{ maxWidth: 200, borderColor: deleteConfirm === 'DELETE' ? 'var(--status-error)' : undefined }}
                    />
                    <button
                      type="button"
                      onClick={handleDeleteOrg}
                      className="btn btn-destructive"
                      disabled={deleteConfirm !== 'DELETE'}
                      style={{ gap: 6, opacity: deleteConfirm !== 'DELETE' ? 0.4 : 1, cursor: deleteConfirm !== 'DELETE' ? 'not-allowed' : 'pointer' }}
                    >
                      <Trash2 size={13} /> Delete Organization
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Global Save Changes Button */}
          {activeTab !== 'danger' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', marginTop: 24, marginBottom: 32 }}>
              <button type="submit" className="btn btn-primary" style={{ gap: 7, minWidth: 130 }}>
                {isSaved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save Changes</>}
              </button>
            </div>
          )}
          </form>
        </div>
        </div>

      {/* Floating Premium Toast notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 10, padding: '14px 20px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'slide-up 200ms ease-out',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-500)' }} />
          <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--text-primary)' }}>{toastMsg}</span>
        </div>
      )}
    </section>
  );
};
