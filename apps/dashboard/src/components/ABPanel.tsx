import React, { useCallback, useEffect, useState } from 'react';
import { FlaskConical, Plus, Trash2, Pencil, Trophy } from 'lucide-react';
import { authedFetch } from '../providers/dataProvider';

interface ABPanelProps {
  campaignId: string;
  onNavigate: (path: string) => void;
}

interface Variant {
  id: string;
  name: string;
  weight: number;
}

interface VariantResult {
  variantId: string;
  impressions: number;
  clicks: number;
  conversions: number;
}

export function ABPanel({ campaignId, onNavigate }: ABPanelProps) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [results, setResults] = useState<Record<string, VariantResult>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, rRes] = await Promise.all([
        authedFetch(`/variants?campaignId=${campaignId}`),
        authedFetch(`/variants/results?campaignId=${campaignId}`),
      ]);
      const vJson = vRes.ok ? await vRes.json() : { data: [] };
      const rJson = rRes.ok ? await rRes.json() : { data: { variants: [] } };
      setVariants(vJson.data ?? []);
      // /variants/results returns an OBJECT now: { campaignId, variants:[…], decided, … }.
      // (It used to be a bare array — keep the fallback so an old shape never crashes the panel.)
      const rData = rJson.data;
      const rows: VariantResult[] = Array.isArray(rData) ? rData : (rData?.variants ?? []);
      const map: Record<string, VariantResult> = {};
      for (const r of rows) {
        if (r.variantId) map[r.variantId] = r;
      }
      setResults(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load A/B variants');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { void load(); }, [load]);

  const addVariant = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch('/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });
      if (!res.ok) throw new Error('Failed to add variant');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add variant');
    } finally {
      setBusy(false);
    }
  };

  const saveWeight = async (id: string, weight: number) => {
    try {
      await authedFetch(`/variants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight }),
      });
    } catch { /* non-fatal — local state already reflects it */ }
  };

  const deleteVariant = async (id: string) => {
    if (!window.confirm('Delete this variant?')) return;
    try {
      await authedFetch(`/variants/${id}`, { method: 'DELETE' });
      setVariants((prev) => prev.filter((v) => v.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const totalWeight = variants.reduce((s, v) => s + (v.weight || 0), 0) || 1;
  const ctr = (r?: VariantResult) => (r && r.impressions > 0 ? ((r.clicks / r.impressions) * 100).toFixed(1) + '%' : '—');
  const cvr = (r?: VariantResult) => (r && r.impressions > 0 ? ((r.conversions / r.impressions) * 100).toFixed(1) + '%' : '—');

  // Highlight the leading variant by conversion rate (needs a little data to be meaningful).
  let leaderId = '';
  let bestCvr = -1;
  for (const v of variants) {
    const r = results[v.id];
    if (r && r.impressions >= 20) {
      const rate = r.conversions / r.impressions;
      if (rate > bestCvr) { bestCvr = rate; leaderId = v.id; }
    }
  }

  return (
    <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlaskConical size={17} style={{ color: 'var(--accent-500)' }} />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>A/B Test</h3>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => void addVariant()} disabled={busy}>
          <Plus size={14} style={{ marginRight: 5 }} />Add variant
        </button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Each variant is a full design served to a weighted share of visitors. Add 2+ variants, edit their designs,
        and ScrollPop splits traffic and tracks results per variant. With no variants, the base design serves to everyone.
      </p>

      {error && <div style={{ fontSize: 12, color: 'var(--status-error)', marginBottom: 10 }}>{error}</div>}

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading…</div>
      ) : variants.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 16px', border: '1px dashed var(--border-default)', borderRadius: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>No A/B test running. Add variants to split-test designs.</div>
          <button className="btn btn-primary btn-sm" onClick={() => void addVariant()} disabled={busy}>
            <Plus size={14} style={{ marginRight: 5 }} />Start A/B test
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {variants.map((v) => {
            const r = results[v.id];
            const sharePct = Math.round(((v.weight || 0) / totalWeight) * 100);
            const isLeader = v.id === leaderId;
            return (
              <div key={v.id} style={{ border: `1px solid ${isLeader ? 'var(--accent-500)' : 'var(--border-subtle)'}`, borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{v.name}</span>
                    {isLeader && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--accent-500)', background: 'var(--bg-surface)', borderRadius: 12, padding: '1px 7px' }}>
                        <Trophy size={11} /> Leading
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button className="btn btn-icon" title="Edit variant design" onClick={() => onNavigate(`/campaigns/${campaignId}/design?variant=${v.id}`)}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn btn-icon" title="Delete variant" onClick={() => void deleteVariant(v.id)} style={{ color: 'var(--text-muted)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Weight */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 6px' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 64 }}>Traffic</span>
                  <input
                    type="range" min={0} max={100} value={v.weight}
                    onChange={(e) => {
                      const weight = parseInt(e.target.value, 10);
                      setVariants((prev) => prev.map((x) => x.id === v.id ? { ...x, weight } : x));
                    }}
                    onMouseUp={(e) => void saveWeight(v.id, parseInt((e.target as HTMLInputElement).value, 10))}
                    onTouchEnd={(e) => void saveWeight(v.id, parseInt((e.target as HTMLInputElement).value, 10))}
                    style={{ flex: 1, accentColor: 'var(--accent-500)' }}
                  />
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)', width: 78, textAlign: 'right' }}>
                    {v.weight} → {sharePct}%
                  </span>
                </div>

                {/* Results */}
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                  <Stat label="Impressions" value={r ? r.impressions.toLocaleString() : '0'} />
                  <Stat label="Clicks" value={r ? r.clicks.toLocaleString() : '0'} />
                  <Stat label="CTR" value={ctr(r)} />
                  <Stat label="Conversions" value={r ? r.conversions.toLocaleString() : '0'} />
                  <Stat label="Conv. rate" value={cvr(r)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}
