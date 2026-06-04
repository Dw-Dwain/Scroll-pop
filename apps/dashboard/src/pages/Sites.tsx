import React from 'react';
import {
  Plus, Copy, Check, Trash2, Edit, Lock, X, Link2, Code2,
  ShoppingBag, Globe, ArrowRight, AlertCircle, CheckCircle2,
  Download, RefreshCw, ExternalLink, Wifi, WifiOff,
} from 'lucide-react';
import { useList, useCreate, useDelete, useUpdate, useCustomMutation } from '@refinedev/core';
import { getApiBase } from '../providers/dataProvider';
import { usePlan } from '../hooks/usePlan';
import { LimitBanner } from '../components/PlanGate';

// ─── Platform icons ───────────────────────────────────────────────────────────

const PlatformIcon: React.FC<{ platform: string; size?: number }> = ({ platform, size = 16 }) => {
  if (platform === 'shopify') return <ShoppingBag size={size} style={{ color: '#96bf48' }} />;
  if (platform === 'wordpress') return <Globe size={size} style={{ color: '#21759b' }} />;
  return <Code2 size={size} style={{ color: 'var(--text-muted)' }} />;
};

const platformLabel = (p: string) => {
  const map: Record<string, string> = {
    shopify: 'Shopify', wordpress: 'WordPress', html: 'HTML / JS',
    donorbox: 'Donorbox', gofundme: 'GoFundMe', other: 'Other CMS',
  };
  return map[p] ?? p;
};

// ─── Shopify Connect Panel ────────────────────────────────────────────────────

const ShopifyConnectPanel: React.FC<{
  site: any;
  onDisconnect: () => void;
}> = ({ site, onDisconnect }) => {
  const [shopInput, setShopInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const { mutateAsync: customMutate } = useCustomMutation<{ oauthUrl: string; shop: string }>();

  const isConnected = !!site.shopifyShop;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopInput.trim()) return;
    setError('');
    setLoading(true);

    // Normalise: strip protocol, strip trailing .myshopify.com if user pasted full URL
    let shop = shopInput.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!shop.endsWith('.myshopify.com')) shop = `${shop}.myshopify.com`;

    try {
      const result = await customMutate({
        url: `${getApiBase()}/shopify/install`,
        method: 'post',
        values: { shop },
      });
      // Redirect user to Shopify permission screen
      window.location.href = result.data.oauthUrl;
    } catch (err: any) {
      setError(err?.message ?? 'Failed to initiate Shopify OAuth');
    } finally {
      setLoading(false);
    }
  };

  if (isConnected) {
    return (
      <div style={{ background: 'rgba(150,191,72,0.07)', border: '1px solid rgba(150,191,72,0.3)', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} style={{ color: '#96bf48' }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Shopify Connected</span>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-error)', fontSize: 11 }} onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{site.shopifyShop}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <a
            href={`https://${site.shopifyShop}/admin`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <ExternalLink size={11} /> Shopify Admin
          </a>
          <a
            href={`https://${site.shopifyShop}/admin/themes/current/editor`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <ShoppingBag size={11} /> Theme Editor
          </a>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '10px 0 0' }}>
          The ScrollPop snippet is injected via Script Tag. To use App Embed Blocks instead,
          go to your Theme Editor → App Embeds → ScrollPop.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <ShoppingBag size={14} style={{ color: '#96bf48' }} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>Connect Shopify Store</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
        Authorize ScrollPop to inject your popup snippet and register webhooks automatically via OAuth 2.0.
      </p>
      <form onSubmit={handleConnect} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          className="input"
          placeholder="yourstore.myshopify.com"
          value={shopInput}
          onChange={(e) => setShopInput(e.target.value)}
          style={{ flex: 1, fontSize: 12 }}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading} style={{ whiteSpace: 'nowrap' }}>
          {loading ? <RefreshCw size={12} className="spin" /> : <><ShoppingBag size={12} /> Connect</>}
        </button>
      </form>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--status-error)' }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>
        You'll be redirected to Shopify to grant permissions, then returned here.
      </p>
    </div>
  );
};

// ─── WordPress Connect Panel ──────────────────────────────────────────────────

const WordPressConnectPanel: React.FC<{
  site: any;
  onVerified: () => void;
}> = ({ site, onVerified }) => {
  const [verifying, setVerifying] = React.useState(false);
  const [verifyError, setVerifyError] = React.useState('');
  const [verifySuccess, setVerifySuccess] = React.useState(false);
  const [wpUrl, setWpUrl] = React.useState(site.wpSiteUrl ?? `https://${site.domain}`);
  const [savingUrl, setSavingUrl] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState(false);
  const { mutateAsync: customMutate } = useCustomMutation<{ verified: boolean; message?: string }>();

  const handleCopyKey = () => {
    navigator.clipboard.writeText(site.publicKey ?? '');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSaveUrl = async () => {
    setSavingUrl(true);
    try {
      await customMutate({
        url: `${getApiBase()}/sites/${site.id}/wordpress-url`,
        method: 'patch',
        values: { wpSiteUrl: wpUrl },
      });
    } finally {
      setSavingUrl(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError('');
    setVerifySuccess(false);
    try {
      await customMutate({
        url: `${getApiBase()}/sites/${site.id}/verify-wordpress`,
        method: 'post',
        values: {},
      });
      setVerifySuccess(true);
      onVerified();
    } catch (err: any) {
      setVerifyError(err?.message ?? 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const pluginDownloadUrl = 'https://pub-0a090ba944ba46269b65a6cfbb0ed1f0.r2.dev/scrollpop-wp.zip';

  return (
    <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Globe size={14} style={{ color: '#21759b' }} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>WordPress Plugin Setup</span>
        {site.verifiedAt && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#16a34a' }}>
            <Wifi size={11} /> Connected
          </span>
        )}
        {!site.verifiedAt && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--status-warning)' }}>
            <WifiOff size={11} /> Not verified
          </span>
        )}
      </div>

      {/* Step 1: Download plugin */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Step 1 — Install Plugin
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
          Download and install the ScrollPop WordPress plugin, then activate it.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href={pluginDownloadUrl}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Download size={12} /> Download Plugin (.zip)
          </a>
          <a
            href="https://wordpress.org/support/article/managing-plugins/#manual-upload-via-wordpress-admin"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <ExternalLink size={11} /> Upload guide
          </a>
        </div>
      </div>

      {/* Step 2: Enter public key */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Step 2 — Enter Site Public Key
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
          In WordPress, go to <strong>Settings → ScrollPop</strong> and paste this key:
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 10px' }}>
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-500)', flex: 1 }}>
            {site.publicKey ?? 'sp_pub_...'}
          </code>
          <button className="btn btn-icon" style={{ width: 24, height: 24 }} onClick={handleCopyKey} title="Copy">
            {copiedKey ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      {/* Step 3: Verify */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Step 3 — Verify Connection
        </div>

        {/* Optional WP URL override */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            WordPress Site URL <span style={{ color: 'var(--text-muted)' }}>(if different from domain)</span>
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="url"
              className="input"
              placeholder={`https://${site.domain}`}
              value={wpUrl}
              onChange={(e) => setWpUrl(e.target.value)}
              style={{ flex: 1, fontSize: 12 }}
            />
            <button className="btn btn-secondary btn-sm" onClick={handleSaveUrl} disabled={savingUrl} style={{ whiteSpace: 'nowrap' }}>
              {savingUrl ? <RefreshCw size={12} className="spin" /> : 'Save'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            We'll call: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{wpUrl.replace(/\/$/, '')}/wp-json/scrollpop/v1/status</code>
          </p>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={handleVerify}
          disabled={verifying}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {verifying
            ? <><RefreshCw size={12} className="spin" /> Verifying...</>
            : <><CheckCircle2 size={12} /> Verify Connection</>
          }
        </button>

        {verifyError && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--status-error)', background: 'rgba(239,68,68,0.07)', padding: '8px 10px', borderRadius: 6 }}>
            <AlertCircle size={12} style={{ marginTop: 2, flexShrink: 0 }} /> {verifyError}
          </div>
        )}

        {verifySuccess && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--status-success)' }}>
            <CheckCircle2 size={12} /> Plugin verified — snippet is live!
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Sites page ──────────────────────────────────────────────────────────

export const Sites: React.FC<{ onNavigate?: (path: string) => void }> = ({ onNavigate }) => {
  const { data: sitesData, refetch } = useList({ resource: 'sites' });
  const { mutate: createSite } = useCreate();
  const { mutate: deleteSite } = useDelete();
  const { mutate: updateSite } = useUpdate();
  const { mutateAsync: customMutate } = useCustomMutation<{ disconnected: boolean }>();
  const { withinLimit, limits, isAdmin } = usePlan();

  const siteCount = sitesData?.data?.length ?? 0;
  const atSiteLimit = !isAdmin && siteCount >= limits.maxSites;

  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [newSite, setNewSite] = React.useState({ name: '', domain: '', platform: 'html' });
  const [isCreating, setIsCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState('');
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [selectedSite, setSelectedSite] = React.useState<any | null>(null);
  const [activeTab, setActiveTab] = React.useState<'snippet' | 'shopify' | 'shopify-embed' | 'wordpress'>('snippet');
  const [embedMode, setEmbedMode] = React.useState<'cdn' | 'dev'>('cdn');
  const [devUrl, setDevUrl] = React.useState(''); // operator pastes their own tunnel URL
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editSite, setEditSite] = React.useState({ id: '', name: '', platform: 'html' });
  const [verifyingId, setVerifyingId] = React.useState<string | null>(null);
  const [connectUrl, setConnectUrl] = React.useState('');

  // Detect Shopify OAuth success redirect
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('shopify_connected') === '1') {
      refetch();
      // Strip query params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Auto-open panel for newly selected platform
  React.useEffect(() => {
    if (!selectedSite) return;
    if (selectedSite.platform === 'shopify') setActiveTab('shopify');
    else if (selectedSite.platform === 'wordpress') setActiveTab('wordpress');
    else setActiveTab('snippet');
  }, [selectedSite?.id]);

  const handleCreate = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isCreating) return;
    if (!newSite.name.trim() || !newSite.domain.trim()) {
      setCreateError('Site name and domain are required.');
      return;
    }
    setCreateError('');
    setIsCreating(true);
    createSite({
      resource: 'sites',
      values: newSite,
      successNotification: false,
    }, {
      onSuccess: (data: any) => {
        setIsCreating(false);
        setIsAddOpen(false);
        setCreateError('');
        setNewSite({ name: '', domain: '', platform: 'html' });
        refetch();
        const site = data?.data ?? null;
        if (site) {
          setSelectedSite(site);
          if (site.platform === 'shopify') setActiveTab('shopify');
          else if (site.platform === 'wordpress') setActiveTab('wordpress');
          else setActiveTab('snippet');
        }
      },
      onError: (error: any) => {
        setIsCreating(false);
        const msg = error?.message ?? '';
        if (msg.includes('409') || msg.toLowerCase().includes('duplicate')) {
          setCreateError('This domain is already registered. Try a different domain.');
        } else if (msg.includes('401') || msg.includes('403')) {
          setCreateError('Authentication error. Please refresh and try again.');
        } else if (msg) {
          setCreateError(`Failed to register: ${msg}`);
        } else {
          setCreateError('Could not reach the server. Is the API running?');
        }
      },
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remove this site? Associated campaigns will be archived.')) return;
    deleteSite({ resource: 'sites', id }, { onSuccess: () => {
      refetch();
      if (selectedSite?.id === id) setSelectedSite(null);
    }});
  };

  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    updateSite({ resource: 'sites', id, values: { verifiedAt: new Date().toISOString() } }, {
      onSuccess: () => { refetch(); setVerifyingId(null); },
      onError: () => { setVerifyingId(null); },
    });
  };

  const handleShopifyDisconnect = async (site: any) => {
    if (!confirm(`Disconnect ${site.shopifyShop} from ScrollPop? The script tag will be removed.`)) return;
    try {
      await customMutate({
        url: `${getApiBase()}/shopify/disconnect`,
        method: 'delete',
        values: { shop: site.shopifyShop },
      });
      refetch();
    } catch {
      alert('Failed to disconnect');
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getSnippetHTML = (publicKey: string, mode: 'cdn' | 'dev', tunnelUrl: string) => {
    if (mode === 'cdn') {
      return `<script>
(function(w,d,s){
  var p=w.__sp=w.__sp||{q:[],identify:function(v){p.q.push(['identify',v])},loaded:false};
  if(p.loaded)return; p.loaded=true;
  var el=d.createElement(s); el.async=true; el.defer=true;
  el.src='https://cdn.scrollpop.online/v1/${publicKey}/p.js';
  d.head.appendChild(el);
})(window,document,'script');
</\script>`;
    }
    const cleanUrl = (tunnelUrl || '').replace(/\/$/, '');
    return `<script>
(function(w,d,s){
  w.__SP_EDGE_URL = '${cleanUrl}';
  var p=w.__sp=w.__sp||{q:[],identify:function(v){p.q.push(['identify',v])},loaded:false};
  if(p.loaded)return; p.loaded=true;
  var el=d.createElement(s); el.async=true; el.defer=true;
  el.src='${cleanUrl}/v1/${publicKey}/p.js';
  d.head.appendChild(el);
})(window,document,'script');
</\script>`;
  };

  const handleConnectQuick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectUrl.trim()) return;
    let domain = connectUrl.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    setNewSite({ name: domain, domain, platform: 'html' });
    setConnectUrl('');
    setIsAddOpen(true);
  };

  const liveSites = sitesData?.data?.filter((s: any) => s.verifiedAt)?.length ?? 0;

  // Available tabs for a given site
  const tabsFor = (site: any) => {
    const tabs: { key: string; label: string }[] = [
      { key: 'snippet', label: 'Code Snippet' },
    ];
    if (site.platform === 'shopify') {
      tabs.push({ key: 'shopify', label: 'Shopify OAuth' });
      tabs.push({ key: 'shopify-embed', label: 'App Embed Block' });
    }
    if (site.platform === 'wordpress') tabs.push({ key: 'wordpress', label: 'WordPress Plugin' });
    return tabs;
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            Connected Sites
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Manage external domains, Shopify stores, and WordPress plugins.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {liveSites > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-success)' }} />
              <span style={{ fontSize: 12, color: 'var(--status-success)' }}>{liveSites} Live {liveSites === 1 ? 'Domain' : 'Domains'}</span>
            </div>
          )}
          <button
            onClick={() => {
              if (atSiteLimit) { onNavigate?.('/billing'); return; }
              setSelectedSite(null);
              setCreateError('');
              setIsAddOpen(true);
            }}
            className="btn btn-primary"
            disabled={atSiteLimit}
          >
            {atSiteLimit ? <Lock size={14} /> : <Plus size={14} />}
            {atSiteLimit ? `Limit (${siteCount}/${limits.maxSites})` : '+ New Site'}
          </button>
        </div>
      </div>

      {atSiteLimit && <LimitBanner type="site" current={siteCount} max={limits.maxSites} onNavigate={onNavigate} />}

      {/* Sites grid */}
      {sitesData?.data && sitesData.data.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
          {sitesData.data.map((site: any) => (
            <div key={site.id} style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${selectedSite?.id === site.id ? 'var(--accent-400)' : 'var(--border-subtle)'}`,
              borderRadius: 8,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              cursor: 'default',
            }}>
              {/* Status + domain */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PlatformIcon platform={site.platform} size={14} />
                    <span className={`badge ${site.verifiedAt ? 'badge-success' : 'badge-warning'}`}>
                      {site.verifiedAt ? 'CONNECTED' : 'PENDING'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn btn-icon"
                      onClick={() => { setEditSite({ id: site.id, name: site.name, platform: site.platform }); setIsEditOpen(true); }}
                      title="Edit"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      className="btn btn-icon"
                      onClick={() => handleDelete(site.id)}
                      style={{ color: 'var(--status-error)' }}
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{site.domain ?? site.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {platformLabel(site.platform)}
                  {site.name !== site.domain ? ` — ${site.name}` : ''}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'var(--bg-raised)', borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campaigns</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {site.campaignCount ?? 0}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-raised)', borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Views</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {site.totalViews
                      ? site.totalViews >= 1000 ? `${(site.totalViews / 1000).toFixed(1)}k` : site.totalViews
                      : '0'}
                  </div>
                </div>
              </div>

              {/* Public key */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>PUBLIC KEY</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  padding: '6px 10px',
                }}>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-500)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {site.publicKey ?? 'sp_pub_...'}
                  </code>
                  <button
                    className="btn btn-icon"
                    style={{ width: 24, height: 24 }}
                    onClick={() => copyToClipboard(site.publicKey ?? '', `key-${site.id}`)}
                    title="Copy"
                  >
                    {copiedKey === `key-${site.id}`
                      ? <Check size={12} style={{ color: 'var(--status-success)' }} />
                      : <Copy size={12} />}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setSelectedSite(selectedSite?.id === site.id ? null : site);
                  }}
                  className={`btn ${selectedSite?.id === site.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                >
                  {selectedSite?.id === site.id
                    ? 'Close Setup'
                    : site.verifiedAt ? 'Manage Site' : 'Complete Setup'}
                </button>
              </div>

              {!site.verifiedAt && site.platform !== 'shopify' && site.platform !== 'wordpress' && (
                <button
                  onClick={() => handleVerify(site.id)}
                  disabled={verifyingId === site.id}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--status-warning)', justifyContent: 'center', width: '100%' }}
                >
                  {verifyingId === site.id ? 'Verifying...' : 'Verify connection'}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Platform-aware setup panel */}
      {selectedSite && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          marginBottom: 24,
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PlatformIcon platform={selectedSite.platform} size={16} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>{selectedSite.domain}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— {platformLabel(selectedSite.platform)}</span>
            </div>
            <button className="btn btn-icon" onClick={() => setSelectedSite(null)}><X size={14} /></button>
          </div>

          {/* Tabs */}
          {tabsFor(selectedSite).length > 1 && (
            <div style={{ display: 'flex', gap: 2, padding: '10px 20px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              {tabsFor(selectedSite).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ borderRadius: '4px 4px 0 0', borderBottom: 'none', fontSize: 12 }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: 20 }}>
            {/* Code Snippet tab */}
            {activeTab === 'snippet' && (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Paste this code inside the <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-300)' }}>&lt;head&gt;</code> tag of your website.
                </p>

                <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                  {(['cdn', 'dev'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setEmbedMode(mode)}
                      className={`btn btn-sm ${embedMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {mode === 'cdn' ? 'Production CDN' : 'Local Dev / Tunnel'}
                    </button>
                  ))}
                </div>

                {embedMode === 'dev' && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Dev / Tunnel URL</label>
                    <input type="text" className="input" placeholder="https://your-tunnel.loca.lt"
                      value={devUrl} onChange={(e) => setDevUrl(e.target.value)} />
                  </div>
                )}

                <div style={{ position: 'relative' }}>
                  <pre className="code-block" style={{ fontSize: 12, lineHeight: '20px', color: 'var(--accent-300)' }}>
                    {getSnippetHTML(selectedSite.publicKey ?? 'YOUR_KEY', embedMode, devUrl)}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(getSnippetHTML(selectedSite.publicKey ?? '', embedMode, devUrl), 'snippet')}
                    className="btn btn-icon"
                    style={{ position: 'absolute', top: 8, right: 8, background: 'var(--bg-raised)' }}
                    title="Copy"
                  >
                    {copiedKey === 'snippet'
                      ? <Check size={14} style={{ color: 'var(--status-success)' }} />
                      : <Copy size={14} />}
                  </button>
                </div>

                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-raised)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--status-info)' }}>ℹ</span>
                  Need help? Read our Integration Guide or contact technical support.
                </div>
              </>
            )}

            {/* Shopify tab */}
            {activeTab === 'shopify' && (
              <ShopifyConnectPanel
                site={selectedSite}
                onDisconnect={() => {
                  handleShopifyDisconnect(selectedSite);
                  setSelectedSite(null);
                }}
              />
            )}

            {/* Shopify App Embed Block tab */}
            {activeTab === 'shopify-embed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: '12px 14px', background: 'rgba(150,191,72,0.06)', border: '1px solid rgba(150,191,72,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <strong>App Embed Block</strong> — the recommended way to add ScrollPop to Shopify. No theme code editing required. Works with Online Store 2.0 themes.
                </div>

                {/* Step 1 */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-500)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Open your theme customizer</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px 28px' }}>
                    In your Shopify Admin go to <strong>Online Store → Themes → Customize</strong>.
                  </p>
                  <a
                    href={`https://${selectedSite?.domain}/admin/themes/current/editor`}
                    target="_blank" rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: 28, gap: 5, fontSize: 11 }}
                  >
                    <ExternalLink size={11} /> Open Theme Customizer
                  </a>
                </div>

                {/* Step 2 */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-500)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Enable the ScrollPop embed block</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 0 28px' }}>
                    In the Theme Customizer click <strong>App Embeds</strong> (bottom-left panel) → find <strong>ScrollPop</strong> → toggle it <strong>on</strong>.
                  </p>
                </div>

                {/* Step 3 */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-500)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>3</div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Paste your Public Key</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px 28px' }}>
                    In the ScrollPop embed settings paste this site's Public Key:
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 28 }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-raised)', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedSite?.publicKey ?? '—'}
                    </code>
                    <button
                      className="btn btn-icon btn-sm"
                      onClick={() => { navigator.clipboard.writeText(selectedSite?.publicKey ?? ''); }}
                      title="Copy public key"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>

                {/* Step 4 */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-500)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>4</div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Save and publish</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 0 28px' }}>
                    Click <strong>Save</strong> in the Theme Customizer. ScrollPop will now load on every page of your store.
                  </p>
                </div>

                <div style={{ padding: '10px 14px', background: 'var(--bg-raised)', borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
                  💡 <strong>Don't see ScrollPop in App Embeds?</strong> Make sure the ScrollPop app is installed on your store first via the <strong>Shopify OAuth</strong> tab, then refresh the Theme Customizer.
                </div>
              </div>
            )}

            {/* WordPress tab */}
            {activeTab === 'wordpress' && (
              <WordPressConnectPanel
                site={selectedSite}
                onVerified={() => {
                  refetch();
                  // Update selectedSite local state to show verified
                  setSelectedSite({ ...selectedSite, verifiedAt: new Date().toISOString() });
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Connect a new site inline form */}
      <div style={{
        border: '1px dashed var(--border-default)',
        borderRadius: 8,
        padding: 32,
        textAlign: 'center',
        marginBottom: 24,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: 'var(--bg-raised)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          color: 'var(--text-muted)',
        }}>
          <Link2 size={20} />
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 6px', color: 'var(--text-primary)' }}>
          Connect a new site
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px', maxWidth: 360, marginInline: 'auto' }}>
          Ready to track conversions? Add your domain and we'll generate a unique tracking snippet.
        </p>
        <form onSubmit={handleConnectQuick} style={{ display: 'flex', gap: 8, justifyContent: 'center', maxWidth: 400, margin: '0 auto' }}>
          <input
            type="text"
            className="input"
            placeholder="https://example.com"
            value={connectUrl}
            onChange={(e) => setConnectUrl(e.target.value)}
            style={{ flex: 1, maxWidth: 280 }}
          />
          <button type="submit" className="btn btn-primary">Connect</button>
        </form>

        {/* Quick platform buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button
            onClick={() => { setNewSite({ name: '', domain: '', platform: 'shopify' }); setIsAddOpen(true); }}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            <ShoppingBag size={12} style={{ color: '#96bf48' }} /> Connect Shopify
          </button>
          <button
            onClick={() => { setNewSite({ name: '', domain: '', platform: 'wordpress' }); setIsAddOpen(true); }}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            <Globe size={12} style={{ color: '#21759b' }} /> Connect WordPress
          </button>
        </div>
      </div>

      {/* Add Site Modal */}
      {isAddOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Register New Site</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Add a website domain to unlock snippets and campaign targets.
                </p>
              </div>
              <button className="btn btn-icon" onClick={() => { setIsAddOpen(false); setCreateError(''); }}><X size={14} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Platform</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { value: 'html', label: 'HTML / JS', icon: <Code2 size={16} /> },
                    { value: 'shopify', label: 'Shopify', icon: <ShoppingBag size={16} style={{ color: '#96bf48' }} /> },
                    { value: 'wordpress', label: 'WordPress', icon: <Globe size={16} style={{ color: '#21759b' }} /> },
                    { value: 'donorbox', label: 'Donorbox', icon: <Code2 size={16} /> },
                    { value: 'gofundme', label: 'GoFundMe', icon: <Code2 size={16} /> },
                    { value: 'other', label: 'Other', icon: <Code2 size={16} /> },
                  ].map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setNewSite({ ...newSite, platform: p.value })}
                      style={{
                        padding: '10px 8px',
                        border: `1px solid ${newSite.platform === p.value ? 'var(--accent-400)' : 'var(--border-subtle)'}`,
                        borderRadius: 6,
                        background: newSite.platform === p.value ? 'rgba(var(--accent-rgb), 0.08)' : 'var(--bg-raised)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        color: newSite.platform === p.value ? 'var(--accent-400)' : 'var(--text-muted)',
                        fontFamily: 'inherit',
                      }}
                    >
                      {p.icon}
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Site Name</label>
                <input type="text" required className="input"
                  placeholder={
                    newSite.platform === 'shopify'   ? 'My Shopify Store' :
                    newSite.platform === 'wordpress' ? 'My WordPress Site' :
                    newSite.platform === 'donorbox'  ? 'My Donorbox Campaign' :
                    newSite.platform === 'gofundme'  ? 'My GoFundMe Page' :
                    'My Website'
                  }
                  value={newSite.name} onChange={(e) => setNewSite({ ...newSite, name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  {newSite.platform === 'shopify' ? 'Shopify Domain (yourstore.myshopify.com)' : 'Website Domain'}
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder={
                    newSite.platform === 'shopify'   ? 'yourstore.myshopify.com' :
                    newSite.platform === 'wordpress' ? 'mysite.com' :
                    newSite.platform === 'donorbox'  ? 'donorbox.me/my-campaign' :
                    newSite.platform === 'gofundme'  ? 'gofundme.com/f/my-page' :
                    'mysite.com'
                  }
                  value={newSite.domain}
                  onChange={(e) => setNewSite({ ...newSite, domain: e.target.value })}
                />
              </div>
              {newSite.platform === 'shopify' && (
                <div style={{ padding: '10px 12px', background: 'rgba(150,191,72,0.07)', border: '1px solid rgba(150,191,72,0.2)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ShoppingBag size={12} style={{ color: '#96bf48' }} /> After registration:</strong>
                  <span style={{ color: 'var(--text-muted)' }}> Click <strong>Complete Setup → Shopify OAuth</strong> to authorize the app and inject your snippet automatically.</span>
                </div>
              )}
              {newSite.platform === 'wordpress' && (
                <div style={{ padding: '10px 12px', background: 'rgba(33,117,155,0.07)', border: '1px solid rgba(33,117,155,0.2)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={12} style={{ color: '#21759b' }} /> After registration:</strong>
                  <span style={{ color: 'var(--text-muted)' }}> Click <strong>Complete Setup → WordPress Plugin</strong> to download the plugin and verify your connection.</span>
                </div>
              )}
              {createError && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 10px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, fontSize: 12, color: 'var(--status-error)' }}>
                  <AlertCircle size={12} style={{ marginTop: 2, flexShrink: 0 }} /> {createError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setIsAddOpen(false); setCreateError(''); }}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isCreating}
                  onClick={(e) => { e.preventDefault(); handleCreate(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {isCreating ? <><RefreshCw size={12} className="spin" /> Registering...</> : 'Register Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Site Modal */}
      {isEditOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Edit Site</h3>
              <button className="btn btn-icon" onClick={() => setIsEditOpen(false)}><X size={14} /></button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateSite({
                  resource: 'sites', id: editSite.id,
                  values: { name: editSite.name, platform: editSite.platform },
                  successNotification: () => ({ message: 'Site updated', type: 'success' }),
                }, { onSuccess: () => { refetch(); setIsEditOpen(false); } });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Site Name</label>
                <input type="text" required className="input"
                  value={editSite.name} onChange={(e) => setEditSite({ ...editSite, name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Platform</label>
                <select className="input" value={editSite.platform} onChange={(e) => setEditSite({ ...editSite, platform: e.target.value })}>
                  <option value="html">Custom HTML / JS</option>
                  <option value="wordpress">WordPress</option>
                  <option value="shopify">Shopify</option>
                  <option value="donorbox">Donorbox</option>
                  <option value="other">Other CMS</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
