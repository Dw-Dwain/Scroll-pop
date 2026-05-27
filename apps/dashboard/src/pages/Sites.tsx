import React from 'react';
import { Plus, Copy, Check, Trash2, Edit, Lock, X, Link2, Code2 } from 'lucide-react';
import { useList, useCreate, useDelete, useUpdate } from '@refinedev/core';
import { usePlan } from '../hooks/usePlan';
import { LimitBanner } from '../components/PlanGate';

export const Sites: React.FC<{ onNavigate?: (path: string) => void }> = ({ onNavigate }) => {
  const { data: sitesData, refetch } = useList({ resource: 'sites' });
  const { mutate: createSite } = useCreate();
  const { mutate: deleteSite } = useDelete();
  const { mutate: updateSite } = useUpdate();
  const { withinLimit, limits, isAdmin } = usePlan();

  const siteCount = sitesData?.data?.length ?? 0;
  const atSiteLimit = !isAdmin && siteCount >= limits.maxSites;

  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [newSite, setNewSite] = React.useState({ name: '', domain: '', platform: 'html' });
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [selectedSnippet, setSelectedSnippet] = React.useState<any | null>(null);
  const [embedMode, setEmbedMode] = React.useState<'cdn' | 'dev'>('cdn');
  const [devUrl, setDevUrl] = React.useState('https://whole-ends-divide.loca.lt');
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editSite, setEditSite] = React.useState({ id: '', name: '', platform: 'html' });
  const [verifyingId, setVerifyingId] = React.useState<string | null>(null);
  const [connectUrl, setConnectUrl] = React.useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createSite({
      resource: 'sites',
      values: newSite,
      successNotification: () => ({ message: 'Site registered', type: 'success' }),
    }, {
      onSuccess: (data: any) => {
        setIsAddOpen(false);
        setNewSite({ name: '', domain: '', platform: 'html' });
        refetch();
        setSelectedSnippet(data.data);
      },
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remove this site? Associated campaigns will be archived.')) return;
    deleteSite({ resource: 'sites', id }, { onSuccess: () => refetch() });
  };

  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    const isDesktop = !!(window as any).electronAPI?.isDesktop;
    if (isDesktop) {
      try {
        const token = localStorage.getItem('desktop_token');
        const apiBase = (window as any).electronAPI.getLocalApiUrl();
        const res = await fetch(`${apiBase}/api/v1/sites/${id}/verify`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) refetch();
        else alert('Verification failed.');
      } catch {
        alert('Cannot reach local server.');
      } finally {
        setVerifyingId(null);
      }
    } else {
      updateSite({ resource: 'sites', id, values: { verifiedAt: new Date().toISOString() } }, {
        onSuccess: () => { refetch(); setVerifyingId(null); },
        onError: () => { setVerifyingId(null); },
      });
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
  el.src='https://cdn.scrollpop.io/v1/${publicKey}/p.js';
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

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>
            Connected Sites
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Manage external domains and tracking snippets.
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
              setSelectedSnippet(null);
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
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>
              {/* Status + domain */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className={`badge ${site.verifiedAt ? 'badge-success' : 'badge-warning'}`}>
                    {site.verifiedAt ? 'CONNECTED' : 'PENDING'}
                  </span>
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
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, textTransform: 'capitalize' }}>
                  {site.name !== site.domain ? site.name : site.platform ?? 'HTML'} Environment
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>CAMPAIGNS</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 500 }}>
                    {String(site.campaignCount ?? '0').padStart(2, '0')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>TOTAL VIEWS</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 500 }}>
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
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-300)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                  onClick={() => setSelectedSnippet(site)}
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                >
                  {site.verifiedAt ? 'Manage Site' : 'Complete Setup'}
                </button>
              </div>

              {!site.verifiedAt && (
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
      </div>

      {/* Snippet selected */}
      {selectedSnippet && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Code2 size={16} style={{ color: 'var(--accent-300)' }} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>Installation Snippet</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
              </div>
            </div>
            <button className="btn btn-icon" onClick={() => setSelectedSnippet(null)}>
              <X size={14} />
            </button>
          </div>

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
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Dev / Tunnel URL
              </label>
              <input
                type="text"
                className="input"
                placeholder="https://your-tunnel.loca.lt"
                value={devUrl}
                onChange={(e) => setDevUrl(e.target.value)}
              />
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <pre className="code-block" style={{ fontSize: 12, lineHeight: '20px', color: 'var(--accent-300)' }}>
              {getSnippetHTML(selectedSnippet.publicKey ?? 'YOUR_KEY', embedMode, devUrl)}
            </pre>
            <button
              onClick={() => copyToClipboard(getSnippetHTML(selectedSnippet.publicKey ?? '', embedMode, devUrl), 'snippet')}
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
              <button className="btn btn-icon" onClick={() => setIsAddOpen(false)}><X size={14} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Site Name</label>
                <input type="text" required className="input" placeholder="My Affiliate Blog"
                  value={newSite.name} onChange={(e) => setNewSite({ ...newSite, name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Domain</label>
                <input type="text" required className="input" placeholder="mydomain.com"
                  value={newSite.domain} onChange={(e) => setNewSite({ ...newSite, domain: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Platform</label>
                <select className="input" value={newSite.platform} onChange={(e) => setNewSite({ ...newSite, platform: e.target.value })}>
                  <option value="html">Custom HTML / JS</option>
                  <option value="wordpress">WordPress</option>
                  <option value="shopify">Shopify</option>
                  <option value="donorbox">Donorbox</option>
                  <option value="other">Other CMS</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Register Site</button>
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
