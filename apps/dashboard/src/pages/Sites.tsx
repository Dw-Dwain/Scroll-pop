import React from 'react';
import {
  Plus, Copy, Check, Trash2, Edit, Lock, X, Code2,
  ShoppingBag, Globe, AlertCircle, CheckCircle2,
  Download, RefreshCw, ExternalLink, Wifi, WifiOff,
} from 'lucide-react';
import { useList, useCreate, useDelete, useUpdate, useCustomMutation } from '@refinedev/core';
import { getApiBase } from '../providers/dataProvider';
import { usePlan } from '../hooks/usePlan';
import { useClients, useActiveClient } from '../hooks/useClients';
import { LimitBanner } from '../components/PlanGate';

// ─── Site type ───────────────────────────────────────────────────────────────
type SiteRecord = {
  id: string; name: string; domain: string; platform: string;
  publicKey?: string; isActive?: boolean; verifiedAt?: string | null;
  shopifyShop?: string; wpSiteUrl?: string; lastSeenAt?: string;
  totalViews?: number; campaignCount?: number; clientId?: string | null;
};

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
  site: SiteRecord;
  onDisconnect: () => void;
  onVerified?: () => void;
}> = ({ site, onDisconnect, onVerified }) => {
  const [shopInput, setShopInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const { mutateAsync: customMutate } = useCustomMutation<{ oauthUrl: string; shop: string }>();
  const { mutateAsync: verifyMutate } = useCustomMutation<{ verified: boolean; message?: string }>();
  const [verifying, setVerifying] = React.useState(false);
  const [verifyMsg, setVerifyMsg] = React.useState('');
  const [verifyOk, setVerifyOk] = React.useState(false);

  const isConnected = !!site.shopifyShop;

  // Manual-install verification: probe the live storefront for the snippet (no OAuth needed).
  const handleVerifySnippet = async () => {
    setVerifying(true);
    setVerifyMsg('');
    setVerifyOk(false);
    try {
      const r = await verifyMutate({ url: `${getApiBase()}/sites/${site.id}/verify-snippet`, method: 'post', values: {} });
      setVerifyOk(true);
      setVerifyMsg(r.data?.message ?? 'Snippet detected — site verified!');
      onVerified?.();
    } catch (err) {
      setVerifyOk(false);
      setVerifyMsg(err instanceof Error ? err.message : 'Could not detect the snippet on your storefront yet.');
    } finally {
      setVerifying(false);
    }
  };

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initiate Shopify OAuth');
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

      {/* Manual install path — verify without the OAuth app */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Already pasted the snippet in your theme?
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleVerifySnippet}
            disabled={verifying}
            style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
          >
            {verifying ? <RefreshCw size={11} className="spin" /> : (site.verifiedAt ? <Wifi size={11} /> : <WifiOff size={11} />)}
            {site.verifiedAt ? 'Re-test connection' : 'Test connection'}
          </button>
        </div>
        {verifyMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: verifyOk ? 'var(--status-success, #16a34a)' : 'var(--status-error)' }}>
            {verifyOk ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} {verifyMsg}
          </div>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>
          We'll load your storefront and check the ScrollPop snippet is present — no app install required.
        </p>
      </div>
    </div>
  );
};

// ─── WordPress Connect Panel ──────────────────────────────────────────────────

const WordPressConnectPanel: React.FC<{
  site: SiteRecord;
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
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  // The R2 public URL has no Cache-Control header, so browsers/edge can serve a stale
  // copy after the zip is re-uploaded. Pin a version query param and bump it whenever the
  // plugin zip changes — this guarantees a fresh download (the cache key includes the query).
  // Keep in sync with packages/wp-plugin/scrollpop/scrollpop.php "Version:".
  // 1.0.1: bumped to evict the cached 1.0.0 R2 object, which had backslash path
  // separators (Windows-built zip) and failed WP activation with "Plugin file does not exist."
  const PLUGIN_VERSION = '1.0.1';
  // Served by the Worker from R2 over our own production domain (cdn.scrollpop.online) — NOT the
  // rate-limited *.r2.dev public bucket URL, which Cloudflare documents as not-for-production (P3-3).
  const pluginDownloadUrl = `https://cdn.scrollpop.online/scrollpop-wp.zip?v=${PLUGIN_VERSION}`;

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
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
          Download the plugin, then in WordPress go to{' '}
          <strong>Plugins → Add New → Upload Plugin</strong>, choose the{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>.zip</code>, and click{' '}
          <strong>Install Now → Activate</strong>.
        </p>

        {/* Don't-unzip warning. Extracting the zip and uploading the resulting folder nests
            scrollpop.php one level too deep (e.g. scrollpop-wp-1/scrollpop/scrollpop.php),
            and WordPress activation fails with "Plugin file does not exist." */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 6, padding: '8px 10px', margin: '0 0 10px' }}>
          <AlertCircle size={13} style={{ color: '#eab308', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            <strong>Upload the .zip exactly as downloaded — do not unzip or extract it first.</strong>{' '}
            WordPress unzips it for you. Uploading an extracted folder makes activation fail with
            “Plugin file does not exist.”
          </span>
        </div>

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
  const { withinLimit: _withinLimit, limits, isAdmin, canWrite } = usePlan();
  const { clients, isAgency } = useClients();
  const { activeClientId } = useActiveClient();

  const allSites = (sitesData?.data as SiteRecord[] | undefined) ?? [];
  // Agency client filter: when a client workspace is active, only show its sites.
  const visibleSites = activeClientId ? allSites.filter((s) => s.clientId === activeClientId) : allSites;
  const clientName = (id?: string | null) => clients.find((c) => c.id === id)?.name;

  const siteCount = allSites.length; // plan limit is tenant-wide, not per-client
  const atSiteLimit = !isAdmin && siteCount >= limits.maxSites;

  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [newSite, setNewSite] = React.useState({ name: '', domain: '', platform: 'html' });
  const [isCreating, setIsCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState('');
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [selectedSite, setSelectedSite] = React.useState<SiteRecord | null>(null);
  const [activeTab, setActiveTab] = React.useState<'snippet' | 'shopify' | 'shopify-embed' | 'wordpress'>('snippet');
  const [embedMode, setEmbedMode] = React.useState<'cdn' | 'dev'>('cdn');
  const [devUrl, setDevUrl] = React.useState(''); // operator pastes their own tunnel URL
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editSite, setEditSite] = React.useState({ id: '', name: '', platform: 'html', clientId: '' });
  const [verifyingId, setVerifyingId] = React.useState<string | null>(null);

  // Detect Shopify OAuth success redirect
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('shopify_connected') === '1') {
      refetch();
      // Strip query params
      window.history.replaceState({}, '', window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open panel for newly selected platform
  React.useEffect(() => {
    if (!selectedSite) return;
    if (selectedSite.platform === 'shopify') setActiveTab('shopify');
    else if (selectedSite.platform === 'wordpress') setActiveTab('wordpress');
    else setActiveTab('snippet');
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      onSuccess: (raw: { data: unknown }) => {
        const data = raw as { data?: SiteRecord };
        setIsCreating(false);
        setIsAddOpen(false);
        setCreateError('');
        setNewSite({ name: '', domain: '', platform: 'html' });
        refetch();
        const site = data?.data ?? null;
        if (site) {
          // Inherit the active client workspace so the new site stays in the current view.
          if (activeClientId) {
            updateSite({ resource: 'sites', id: site.id, values: { clientId: activeClientId }, successNotification: false }, { onSuccess: () => refetch() });
            site.clientId = activeClientId;
          }
          setSelectedSite(site);
          if (site.platform === 'shopify') setActiveTab('shopify');
          else if (site.platform === 'wordpress') setActiveTab('wordpress');
          else setActiveTab('snippet');
        }
      },
      onError: (error: { message?: string }) => {
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

  const handleShopifyDisconnect = async (site: SiteRecord) => {
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
</script>`;
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
</script>`;
  };

  const liveSites = visibleSites.filter((s) => s.verifiedAt).length;

  // Available tabs for a given site
  const tabsFor = (site: SiteRecord) => {
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
    <div style={{ width: '100%' }}>
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
          {canWrite && (
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
          )}
        </div>
      </div>

      {atSiteLimit && <LimitBanner type="site" current={siteCount} max={limits.maxSites} onNavigate={onNavigate} />}

      {/* Sites grid — clean card layout (mirrors Campaigns) so they're easy to scan & scroll */}
      {visibleSites.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
          {visibleSites.map((site) => {
            const isSelected = selectedSite?.id === site.id;
            const connected = !!site.verifiedAt;
            return (
              <div
                key={site.id}
                onClick={() => setSelectedSite(site)}
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid ${isSelected ? 'var(--accent-400)' : 'var(--border-subtle)'}`,
                  borderRadius: 8,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (isSelected) return;
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLElement).style.borderColor = isSelected ? 'var(--accent-400)' : 'var(--border-subtle)';
                }}
              >
                {/* Header: platform icon + domain + status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <PlatformIcon platform={site.platform} size={16} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {site.domain ?? site.name}
                    </span>
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: connected ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: connected ? 'var(--status-success)' : 'var(--status-warning)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--status-success)' : 'var(--status-warning)' }} />
                    {connected ? 'Connected' : 'Pending'}
                  </span>
                </div>

                {/* Body: platform/name meta + stats */}
                <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>{platformLabel(site.platform)}</span>
                    {site.name !== site.domain && (
                      <>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{site.name}</span>
                      </>
                    )}
                    {isAgency && !activeClientId && site.clientId && clientName(site.clientId) && (
                      <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent-400)', border: '1px solid rgba(var(--accent-rgb),0.25)' }}>
                        {clientName(site.clientId)}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 16, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Campaigns</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{site.campaignCount ?? 0}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Views</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {(site.totalViews ?? 0) >= 1000 ? `${((site.totalViews ?? 0) / 1000).toFixed(1)}k` : (site.totalViews ?? 0)}
                      </div>
                    </div>
                  </div>

                  {!connected && site.platform !== 'shopify' && site.platform !== 'wordpress' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleVerify(site.id); }}
                      disabled={verifyingId === site.id}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--status-warning)', justifyContent: 'flex-start', padding: 0, fontSize: 11 }}
                    >
                      {verifyingId === site.id ? 'Verifying…' : 'Verify connection'}
                    </button>
                  )}
                </div>

                {/* Footer: actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedSite(site); }}
                    className="btn btn-sm btn-secondary"
                    style={{ flex: 1, justifyContent: 'center', gap: 5, fontSize: 11 }}
                  >
                    <Code2 size={12} /> {connected ? 'Manage & snippet' : 'Complete setup'}
                  </button>
                  {canWrite && (
                    <>
                      <button
                        className="btn btn-icon"
                        title="Edit"
                        onClick={(e) => { e.stopPropagation(); setEditSite({ id: site.id, name: site.name, platform: site.platform, clientId: site.clientId ?? '' }); setIsEditOpen(true); }}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        className="btn btn-icon"
                        title="Remove"
                        style={{ color: 'var(--status-error)' }}
                        onClick={(e) => { e.stopPropagation(); handleDelete(site.id); }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
          {activeClientId
            ? 'No sites in this client workspace yet. Click "+ New Site" to add one, or assign an existing site to this client via its Edit dialog.'
            : 'No sites yet — connect one below to get started.'}
        </div>
      )}

      {/* Selected site: setup / detail in a centered modal popup */}
      {selectedSite && (
        <div className="modal-backdrop" onClick={() => setSelectedSite(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            width: '100%',
            maxWidth: 760,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
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
                  onClick={() => setActiveTab(tab.key as 'snippet' | 'shopify' | 'shopify-embed' | 'wordpress')}
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
                onVerified={() => {
                  refetch();
                  setSelectedSite({ ...selectedSite, verifiedAt: new Date().toISOString() });
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
        </div>
      )}


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
                  values: {
                    name: editSite.name,
                    platform: editSite.platform,
                    ...(isAgency ? { clientId: editSite.clientId || null } : {}),
                  },
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
              {isAgency && (
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Client Workspace</label>
                  <select className="input" value={editSite.clientId} onChange={(e) => setEditSite({ ...editSite, clientId: e.target.value })}>
                    <option value="">— Unassigned (agency-level) —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Assign this site to a client to group it under that workspace in the client switcher.
                  </p>
                </div>
              )}
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
