import React from 'react';
import {
  ArrowLeft, Eye, Globe, Megaphone, MousePointerClick, Percent, Radar, Sliders,
  Activity, Play, Disc3, Ticket, Plus, Trash2, Copy, Check, RefreshCw, X,
  Target, Save, Clock, MousePointer2,
} from 'lucide-react';
import { useApiUrl, useCustom, useCustomMutation, useList, useOne } from '@refinedev/core';
import { ABPanel } from '../components/ABPanel';
import InteractivePreview from '../components/campaign-designer/InteractivePreview';
import type { Campaign, CampaignStepConfig } from '../components/campaign-designer/types';

interface CampaignDetailProps {
  campaignId: string;
  onNavigate: (path: string) => void;
}

type RuleItem = { id: string; type?: string; params?: Record<string, number>; kind?: string; operator?: string; value?: Record<string, unknown>; frequency?: string; intervalDays?: number; maxDisplayCount?: number | null; cooldownSeconds?: number | null; showAgainIfConverts?: boolean };

// ── Helpers ────────────────────────────────────────────────────────────────────

// Map raw API triggers → the Campaign.triggers shape InteractivePreview expects
function mapApiTriggers(apiTriggers: RuleItem[], freq: RuleItem | null): Campaign['triggers'] {
  const t: Campaign['triggers'] = {
    exitIntent: false,
    scrollPercent: 0,
    inactivitySeconds: 0,
    timeDelaySeconds: 0,
    pageTargeting: '*',
    deviceTargeting: 'all',
    geoTargeting: 'All Countries',
    frequencyCapDays: 7,
    newVisitorOnly: false,
    sessionPageCount: 0,
    utmParam: 'utm_source',
    utmValue: '',
    startsAt: '',
    endsAt: '',
    frequency: (freq?.frequency as Campaign['triggers']['frequency']) ?? 'once_per_session',
  };
  for (const rule of apiTriggers) {
    if (rule.type === 'scroll_pct')         t.scrollPercent        = rule.params?.pct ?? rule.params?.scroll_pct ?? 50;
    if (rule.type === 'dwell_time')          t.timeDelaySeconds     = rule.params?.seconds ?? 5;
    if (rule.type === 'exit_intent_mouse')   t.exitIntent           = true;
    if (rule.type === 'inactivity')          t.inactivitySeconds    = rule.params?.seconds ?? 30;
  }
  return t;
}

// Flat settings state shared by the spin-wheel triggers/targeting panel.
type FlatSettings = {
  exitIntent: boolean;
  scrollPercent: number;
  timeDelaySeconds: number;
  inactivitySeconds: number;
  frequency: 'always' | 'once_per_session' | 'once_per_day' | 'once_per_visitor';
  frequencyCapDays: number;
  deviceTargeting: 'all' | 'desktop' | 'mobile' | 'tablet';
  pageTargeting: string;
  geoTargeting: string;
  newVisitorOnly: boolean;
  sessionPageCount: number;
  utmParam: string;
  utmValue: string;
};

// Map loaded API triggers + targeting + frequency → the flat settings state.
function mapApiToFlat(apiTriggers: RuleItem[], apiTargeting: RuleItem[], freq: RuleItem | null): FlatSettings {
  const f: FlatSettings = {
    exitIntent: false, scrollPercent: 0, timeDelaySeconds: 0, inactivitySeconds: 0,
    frequency: (freq?.frequency as FlatSettings['frequency']) ?? 'once_per_session',
    frequencyCapDays: freq?.intervalDays ?? 7,
    deviceTargeting: 'all', pageTargeting: '', geoTargeting: 'All Countries',
    newVisitorOnly: false, sessionPageCount: 0, utmParam: 'utm_source', utmValue: '',
  };
  for (const r of apiTriggers) {
    if (r.type === 'scroll_pct')       f.scrollPercent     = r.params?.pct ?? r.params?.scroll_pct ?? 50;
    if (r.type === 'dwell_time')       f.timeDelaySeconds  = r.params?.seconds ?? 5;
    if (r.type === 'exit_intent_mouse') f.exitIntent       = true;
    if (r.type === 'inactivity')       f.inactivitySeconds = r.params?.seconds ?? 30;
  }
  for (const r of apiTargeting) {
    if (r.kind === 'device')             f.deviceTargeting = (r.value?.device as FlatSettings['deviceTargeting']) ?? 'all';
    if (r.kind === 'returning_visitor')  f.newVisitorOnly  = r.value?.returning === false;
    if (r.kind === 'url_contains')       f.pageTargeting   = (r.value?.pattern as string) ?? '';
    if (r.kind === 'geo')                f.geoTargeting    = (r.value?.country as string) ?? 'All Countries';
    if (r.kind === 'session_page_views') f.sessionPageCount = (r.value?.count as number) ?? 0;
    if (r.kind === 'utm')              { f.utmParam = (r.value?.param as string) ?? 'utm_source'; f.utmValue = (r.value?.value as string) ?? ''; }
  }
  return f;
}

// Build a minimal Campaign object from design config + API triggers so
// InteractivePreview can render & simulate without the wizard's Campaign type.
type PreviewConfig = { backgroundColor?: string; borderRadius?: number; animation?: string; steps?: unknown };
function buildPreviewCampaign(campaignId: string, name: string, design: Record<string, unknown>, triggers: Campaign['triggers']): Campaign {
  const cfg = (design?.['config'] ?? {}) as PreviewConfig;
  const stepsArr = cfg.steps as Array<{ id: string }> | Record<string, unknown> | undefined;
  const mainStep = Array.isArray(stepsArr) ? stepsArr.find((s) => s.id === 'main') : (stepsArr as Record<string, unknown> | undefined)?.['main'];
  const teaserStep = Array.isArray(stepsArr) ? stepsArr.find((s) => s.id === 'teaser') : (stepsArr as Record<string, unknown> | undefined)?.['teaser'];
  const successStep = Array.isArray(stepsArr) ? stepsArr.find((s) => s.id === 'success') : (stepsArr as Record<string, unknown> | undefined)?.['success'];

  const fallbackMain = {
    popupType: 'modal' as const,
    position: 'center' as const,
    width: 480,
    height: 320,
    backgroundColor: cfg.backgroundColor || '#ffffff',
    borderRadius: cfg.borderRadius || 12,
    borderWidth: 0,
    borderColor: 'transparent',
    boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
    overlayColor: 'rgba(0,0,0,0.5)',
    animationEntrance: cfg.animation || 'scale-up',
    elements: [],
    enabled: true,
  };

  const emptyStep = {
    popupType: 'modal' as const,
    position: 'center' as const,
    width: 480, height: 200,
    backgroundColor: '#ffffff',
    borderRadius: 8, borderWidth: 0, borderColor: 'transparent',
    boxShadow: '', overlayColor: '', animationEntrance: 'fade-in',
    elements: [], enabled: false,
  };

  return {
    id: campaignId,
    name,
    category: 'Campaign',
    isActive: true,
    steps: {
      teaser:  (teaserStep  ?? emptyStep) as CampaignStepConfig,
      main:    (mainStep    ?? fallbackMain) as CampaignStepConfig,
      success: (successStep ?? emptyStep) as CampaignStepConfig,
    },
    triggers,
    conversions: 0,
    views: 0,
    createdAt: new Date().toISOString(),
  };
}

// ── Spin Wheel inline SVG preview ─────────────────────────────────────────────
function SpinWheelPreview({ slices, size = 220 }: { slices: { label: string; color?: string }[]; size?: number }) {
  const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#f97316'];
  const n = slices.length || 6;
  const arc = (Math.PI * 2) / n;
  const r = size / 2 - 4;
  const cx = size / 2, cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.18))' }}>
      {slices.map((sl, i) => {
        const start = i * arc - Math.PI / 2;
        const end = start + arc;
        const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end),   y2 = cy + r * Math.sin(end);
        const lx = cx + r * 0.65 * Math.cos(start + arc / 2);
        const ly = cy + r * 0.65 * Math.sin(start + arc / 2);
        const col = sl.color || COLORS[i % COLORS.length];
        return (
          <g key={i}>
            <path d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`} fill={col} stroke="#fff" strokeWidth="2" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fill="#fff"
              fontSize={Math.min(13, Math.floor(r * 0.14))} fontWeight="700"
              style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {sl.label.length > 10 ? sl.label.slice(0, 9) + '…' : sl.label}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={r * 0.1} fill="#fff" />
      {/* Pointer */}
      <polygon points={`${cx},${cy - r - 2} ${cx - 9},${cy - r + 14} ${cx + 9},${cy - r + 14}`} fill="#f59e0b" />
    </svg>
  );
}

// ── Coupons panel ─────────────────────────────────────────────────────────────
function CouponsPanel({ campaignId, apiUrl }: { campaignId: string; apiUrl: string }) {
  const { data: couponsRes, refetch } = useCustom({
    url: `${apiUrl}/coupons?campaignId=${campaignId}&limit=200`, method: 'get',
  });
  const { mutateAsync: customMutate } = useCustomMutation();
  const [prefix, setPrefix] = React.useState('SAVE');
  const [count, setCount] = React.useState(5);
  const [discountPct, setDiscountPct] = React.useState<number | ''>('');
  const [generating, setGenerating] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  type CouponItem = { id: string; code: string; discountPct?: number; uses?: number; maxUses?: number | null; expiresAt?: string };
  const coupons = ((couponsRes as { data?: CouponItem[] } | undefined)?.data ?? []) as CouponItem[];
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2800); };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const body: Record<string, unknown> = { campaignId, count, prefix };
      if (discountPct !== '') body['discountPct'] = discountPct;
      await customMutate({ url: `${apiUrl}/coupons/generate`, method: 'post', values: body });
      await refetch();
      showToast(`Generated ${count} coupon${count !== 1 ? 's' : ''}.`);
    } catch { showToast('Failed to generate coupons.'); }
    finally { setGenerating(false); }
  };

  const handleDelete = async (id: string) => {
    await customMutate({ url: `${apiUrl}/coupons/${id}`, method: 'delete', values: {} }).catch(() => {});
    await refetch();
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Ticket size={13} style={{ color: 'var(--data-3)' }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Coupon Codes</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{coupons.length} code{coupons.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Generator */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14, padding: '12px 14px', background: 'var(--bg-raised)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Prefix</div>
          <input className="input" style={{ width: 90, fontSize: 12 }} value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12))} placeholder="SAVE" />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Count</div>
          <input className="input" style={{ width: 70, fontSize: 12 }} type="number" min={1} max={500} value={count} onChange={e => setCount(Math.min(500, Math.max(1, +e.target.value)))} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Discount %</div>
          <input className="input" style={{ width: 80, fontSize: 12 }} type="number" min={1} max={100} placeholder="e.g. 20" value={discountPct} onChange={e => setDiscountPct(e.target.value === '' ? '' : Math.min(100, Math.max(1, +e.target.value)))} />
        </div>
        <button
          className="btn btn-primary btn-sm"
          style={{ gap: 5, whiteSpace: 'nowrap' }}
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? <RefreshCw size={12} className="spin" /> : <Plus size={12} />}
          Generate
        </button>
      </div>

      {/* Coupon list */}
      {coupons.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No codes yet — generate some above.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {coupons.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg-raised)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-300)', flex: 1, letterSpacing: '0.06em' }}>{c.code}</code>
              {c.discountPct && <span className="badge badge-neutral" style={{ fontSize: 9 }}>{c.discountPct}% off</span>}
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {c.uses}{c.maxUses != null ? `/${c.maxUses}` : ''} uses
              </span>
              {c.expiresAt && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>exp {new Date(c.expiresAt).toLocaleDateString()}</span>}
              <button className="btn btn-icon btn-sm" onClick={() => handleCopy(c.code)} title="Copy">
                {copied === c.code ? <Check size={11} style={{ color: 'var(--status-success)' }} /> : <Copy size={11} />}
              </button>
              <button className="btn btn-icon btn-sm" onClick={() => handleDelete(c.id)} title="Delete">
                <Trash2 size={11} style={{ color: 'var(--status-error)' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '12px 18px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 13, color: 'var(--text-primary)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Spin Wheel config panel ───────────────────────────────────────────────────
function SpinWheelPanel({ campaignId, design, apiUrl, onDesignSaved }: { campaignId: string; design: Record<string, unknown>; apiUrl: string; onDesignSaved: () => void }) {
  const cfg = (design?.config ?? {}) as { slices?: Array<{ label?: string; color?: string }>; kind?: string; [key: string]: unknown };
  const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#f97316'];
  const initSlices = (cfg.slices ?? []).map((s, i) => ({ label: s.label || '', color: s.color || COLORS[i % COLORS.length] || '#6366f1' }));
  while (initSlices.length < 6) initSlices.push({ label: '', color: COLORS[initSlices.length % COLORS.length] || '#6366f1' });

  const [slices, setSlices] = React.useState<{ label: string; color: string }[]>(initSlices);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const { mutateAsync: customMutate } = useCustomMutation();

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const newConfig = {
        ...cfg,
        kind: 'spin_wheel',
        slices: slices.filter(s => s.label.trim()),
      };
      await customMutate({
        url: `${apiUrl}/campaigns/${campaignId}/design`,
        method: 'put',
        values: { kind: 'spin_wheel', config: newConfig, affiliate_slots: (design?.['affiliateSlots'] as unknown[]) ?? [] },
      });
      showToast('Wheel saved!');
      onDesignSaved();
    } catch { showToast('Failed to save.'); }
    finally { setSaving(false); }
  };

  const activeSlices = slices.filter(s => s.label.trim());

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Disc3 size={13} style={{ color: 'var(--accent-500)' }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Spin Wheel Configuration</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start' }}>
        {/* Slice editor */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Prize Slices — {activeSlices.length} active
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {slices.map((sl, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="color"
                  value={sl.color}
                  onChange={e => setSlices(prev => prev.map((s, j) => j === i ? { ...s, color: e.target.value ?? s.color } : s))}
                  style={{ width: 28, height: 28, borderRadius: 4, border: '1px solid var(--border-subtle)', cursor: 'pointer', padding: 2 }}
                  title="Slice colour"
                />
                <input
                  className="input"
                  style={{ flex: 1, fontSize: 12 }}
                  placeholder={`Slice ${i + 1} (e.g. 20% OFF, Free Ship)`}
                  value={sl.label}
                  onChange={e => setSlices(prev => prev.map((s, j) => j === i ? { ...s, label: e.target.value } : s))}
                />
                {slices.length > 2 && (
                  <button className="btn btn-icon btn-sm" onClick={() => setSlices(prev => prev.filter((_, j) => j !== i))}>
                    <X size={11} style={{ color: 'var(--text-muted)' }} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {slices.length < 8 && (
              <button className="btn btn-secondary btn-sm" style={{ gap: 5 }}
                onClick={() => setSlices(prev => [...prev, { label: '', color: COLORS[prev.length % COLORS.length]! }])}>
                <Plus size={11} /> Add slice
              </button>
            )}
            <button className="btn btn-primary btn-sm" style={{ gap: 5, marginLeft: 'auto' }} onClick={handleSave} disabled={saving || activeSlices.length < 2}>
              {saving ? <RefreshCw size={11} className="spin" /> : <Check size={11} />}
              Save wheel
            </button>
          </div>
          {toast && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--status-success)' }}>{toast}</div>}
        </div>

        {/* Live preview */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <SpinWheelPreview slices={activeSlices.length >= 2 ? activeSlices : slices} size={200} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Live preview</span>
        </div>
      </div>
    </div>
  );
}

// ── Triggers / Targeting / Frequency panel (spin-wheel — mirrors the design editor) ──
function TriggersTargetingPanel({
  campaignId, apiUrl, apiTriggers, apiTargeting, frequency, onSaved,
}: {
  campaignId: string; apiUrl: string;
  apiTriggers: RuleItem[]; apiTargeting: RuleItem[]; frequency: RuleItem | null;
  onSaved: () => void;
}) {
  const { mutateAsync: customMutate } = useCustomMutation();
  const [s, setS] = React.useState<FlatSettings>(() => mapApiToFlat(apiTriggers, apiTargeting, frequency));
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const seeded = React.useRef(false);

  // Seed once when the API data first arrives (the parent may render before fetch resolves).
  React.useEffect(() => {
    if (!seeded.current && (apiTriggers.length || apiTargeting.length || frequency)) {
      setS(mapApiToFlat(apiTriggers, apiTargeting, frequency));
      seeded.current = true;
    }
  }, [apiTriggers, apiTargeting, frequency]);

  const set = <K extends keyof FlatSettings>(k: K, v: FlatSettings[K]) => setS(prev => ({ ...prev, [k]: v }));
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2800); };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build the normalized trigger/targeting arrays exactly like the design editor does.
      const triggersList: Array<{ type: string; params: Record<string, number> }> = [];
      if (s.scrollPercent > 0)     triggersList.push({ type: 'scroll_pct', params: { pct: s.scrollPercent } });
      if (s.timeDelaySeconds > 0)  triggersList.push({ type: 'dwell_time', params: { seconds: s.timeDelaySeconds } });
      if (s.inactivitySeconds > 0) triggersList.push({ type: 'inactivity', params: { seconds: Math.max(5, s.inactivitySeconds) } });
      if (s.exitIntent)            triggersList.push({ type: 'exit_intent_mouse', params: { sensitivity: 20 } });

      const targetingList: Array<{ kind: string; operator: string; value: Record<string, unknown> }> = [];
      if (s.deviceTargeting !== 'all')                 targetingList.push({ kind: 'device', operator: 'include', value: { device: s.deviceTargeting } });
      if (s.newVisitorOnly)                            targetingList.push({ kind: 'returning_visitor', operator: 'include', value: { returning: false } });
      if (s.pageTargeting.trim() && s.pageTargeting.trim() !== '*') targetingList.push({ kind: 'url_contains', operator: 'include', value: { pattern: s.pageTargeting.trim() } });
      if (s.geoTargeting !== 'All Countries')          targetingList.push({ kind: 'geo', operator: 'include', value: { country: s.geoTargeting } });
      if (s.sessionPageCount > 0)                      targetingList.push({ kind: 'session_page_views', operator: 'include', value: { count: s.sessionPageCount } });
      if (s.utmValue.trim() !== '')                    targetingList.push({ kind: 'utm', operator: 'include', value: { param: s.utmParam || 'utm_source', value: s.utmValue.trim() } });

      const freqInterval = s.frequencyCapDays > 0 ? s.frequencyCapDays : undefined;

      await customMutate({ url: `${apiUrl}/campaigns/${campaignId}/triggers`, method: 'put', values: triggersList });
      await customMutate({ url: `${apiUrl}/campaigns/${campaignId}/frequency`, method: 'put', values: { frequency: s.frequency, intervalDays: freqInterval } });
      await customMutate({ url: `${apiUrl}/campaigns/${campaignId}/targeting`, method: 'put', values: targetingList });

      showToast('Triggers & targeting saved!');
      onSaved();
    } catch {
      showToast('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5, display: 'block' };
  const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 };
  const GEO = ['All Countries', 'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IN', 'BR', 'JP', 'SG'];

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Sliders size={13} style={{ color: 'var(--accent-300)' }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Triggers, Targeting & Frequency</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 18px' }}>
        Same controls as the campaign design editor — when this wheel fires, who sees it, and how often.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
        {/* Triggers */}
        <div>
          <div style={sectionTitle}><MousePointer2 size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />When it fires</div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>Exit intent</span>
            <input type="checkbox" checked={s.exitIntent} onChange={e => set('exitIntent', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Scroll depth trigger (%) — 0 = off</label>
            <input className="input" type="number" min={0} max={100} value={s.scrollPercent} onChange={e => set('scrollPercent', Math.min(100, Math.max(0, +e.target.value)))} style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>Dwell time (seconds) — 0 = off</label>
            <input className="input" type="number" min={0} value={s.timeDelaySeconds} onChange={e => set('timeDelaySeconds', Math.max(0, +e.target.value))} style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>Inactivity (seconds) — 0 = off</label>
            <input className="input" type="number" min={0} value={s.inactivitySeconds} onChange={e => set('inactivitySeconds', Math.max(0, +e.target.value))} style={{ width: '100%', fontSize: 12 }} />
          </div>
        </div>

        {/* Targeting */}
        <div>
          <div style={sectionTitle}><Target size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />Who sees it</div>

          <div>
            <label style={labelStyle}>Device</label>
            <select className="input" value={s.deviceTargeting} onChange={e => set('deviceTargeting', e.target.value as FlatSettings['deviceTargeting'])} style={{ width: '100%', fontSize: 12 }}>
              <option value="all">All devices</option>
              <option value="desktop">Desktop only</option>
              <option value="mobile">Mobile only</option>
              <option value="tablet">Tablet only</option>
            </select>
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>Page URL contains (blank = all pages)</label>
            <input className="input" value={s.pageTargeting} onChange={e => set('pageTargeting', e.target.value)} placeholder="/products" style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>Country</label>
            <select className="input" value={s.geoTargeting} onChange={e => set('geoTargeting', e.target.value)} style={{ width: '100%', fontSize: 12 }}>
              {GEO.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 0' }}>
            <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>New visitors only</span>
            <input type="checkbox" checked={s.newVisitorOnly} onChange={e => set('newVisitorOnly', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>Fire after N page views (0 = off)</label>
            <input className="input" type="number" min={0} value={s.sessionPageCount} onChange={e => set('sessionPageCount', Math.max(0, +e.target.value))} style={{ width: '100%', fontSize: 12 }} />
          </div>
        </div>

        {/* Frequency + UTM */}
        <div>
          <div style={sectionTitle}><Clock size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />How often + UTM</div>

          <div>
            <label style={labelStyle}>Display frequency</label>
            <select className="input" value={s.frequency} onChange={e => set('frequency', e.target.value as FlatSettings['frequency'])} style={{ width: '100%', fontSize: 12 }}>
              <option value="always">Always</option>
              <option value="once_per_session">Once per session</option>
              <option value="once_per_day">Once per day</option>
              <option value="once_per_visitor">Once per visitor</option>
            </select>
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>Frequency cap (days)</label>
            <input className="input" type="number" min={0} value={s.frequencyCapDays} onChange={e => set('frequencyCapDays', Math.max(0, +e.target.value))} style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>UTM parameter</label>
            <select className="input" value={s.utmParam} onChange={e => set('utmParam', e.target.value)} style={{ width: '100%', fontSize: 12 }}>
              {['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>UTM value (blank = any)</label>
            <input className="input" value={s.utmValue} onChange={e => set('utmValue', e.target.value)} placeholder="e.g. summer_sale" style={{ width: '100%', fontSize: 12 }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
        <button className="btn btn-primary btn-sm" style={{ gap: 5 }} onClick={handleSave} disabled={saving}>
          {saving ? <RefreshCw size={11} className="spin" /> : <Save size={11} />}
          Save settings
        </button>
        {toast && <span style={{ fontSize: 12, color: toast.startsWith('Failed') ? 'var(--status-error)' : 'var(--status-success)' }}>{toast}</span>}
      </div>
    </div>
  );
}

// Human-readable labels for the snippet's trigger_blocked reasons (the trigger debugger).
// Unknown reasons fall back to the raw string so new reasons still render.
const BLOCK_REASON_LABELS: Record<string, string> = {
  frequency_cap: 'Frequency cap reached',
  popup_open: 'Another popup was open',
  unknown: 'Other',
};

// ── Main component ─────────────────────────────────────────────────────────────
export const CampaignDetail: React.FC<CampaignDetailProps> = ({ campaignId, onNavigate }) => {
  const { data: campaignData, isLoading: isCampaignLoading } = useOne({ resource: 'campaigns', id: campaignId });
  const { data: sitesData } = useList({ resource: 'sites' });
  const apiUrl = useApiUrl();

  const { data: analyticsRes, isLoading: analyticsLoading } = useCustom({
    url: `${apiUrl}/analytics/campaigns/${campaignId}`, method: 'get',
  });
  const { data: triggersRes, refetch: refetchTriggers } = useCustom({ url: `${apiUrl}/campaigns/${campaignId}/triggers`, method: 'get' });
  const { data: targetingRes, refetch: refetchTargeting } = useCustom({ url: `${apiUrl}/campaigns/${campaignId}/targeting`, method: 'get' });
  const { data: frequencyRes, refetch: refetchFrequency } = useCustom({ url: `${apiUrl}/campaigns/${campaignId}/frequency`, method: 'get' });
  const { data: designRes, refetch: refetchDesign } = useCustom({
    url: `${apiUrl}/campaigns/${campaignId}/design`, method: 'get',
  });
  const { data: diagnoseRes } = useCustom({
    url: `${apiUrl}/campaigns/${campaignId}/diagnose`, method: 'get',
    queryOptions: { retry: false }, errorNotification: false,
  });
  const { data: liveEventsRes } = useCustom({
    url: `${apiUrl}/ops/live-events?campaignId=${campaignId}&limit=12`, method: 'get',
    queryOptions: { retry: false }, errorNotification: false,
  });

  const [showSimulation, setShowSimulation] = React.useState(false);

  type ApiResult<T> = { data?: T } | undefined;
  // Wrap in useMemo so hook deps receive a stable reference instead of a new array/null on every render
  const analytics = React.useMemo(
    () => (analyticsRes as ApiResult<Array<{ eventType: string; count: number }>>)?.data ?? [],
    [analyticsRes],
  );
  const triggers: RuleItem[] = React.useMemo(
    () => (triggersRes as ApiResult<RuleItem[]>)?.data ?? [],
    [triggersRes],
  );
  const targeting: RuleItem[] = ((targetingRes as ApiResult<RuleItem[]>)?.data ?? []);
  const frequency: RuleItem | null = ((frequencyRes as ApiResult<RuleItem>)?.data ?? null);
  const design = ((designRes as ApiResult<Record<string, unknown>>)?.data ?? null);
  type DiagnoseData = { rulesEvaluated?: number; fired?: number; blocked?: number; topBlockedReasons?: Array<{ reason: string; count: number }> };
  const diagnose = ((diagnoseRes as ApiResult<DiagnoseData>)?.data ?? null);
  type LiveEvent = { id: string; ts?: string; eventType?: string; domain?: string; visitorId?: string };
  const liveEvents = ((liveEventsRes as ApiResult<LiveEvent[]>)?.data ?? []);

  type CampaignRecord = { id: string; name: string; siteId?: string; status?: string; createdAt?: string; kind?: string };
  const campaign = campaignData?.data as CampaignRecord | undefined;
  const site = sitesData?.data?.find((s) => (s as { id?: string }).id === campaign?.siteId) as { domain?: string } | undefined;
  const designKind: string = (design?.['kind'] as string | undefined) ?? 'modal';
  const isSpinWheel = designKind === 'spin_wheel';

  const stats = React.useMemo(() => {
    let impressions = 0, views = 0, clicks = 0;
    for (const row of analytics) {
      if (row.eventType === 'impression') impressions += row.count;
      if (row.eventType === 'view') views += row.count;
      if (row.eventType === 'click') clicks += row.count;
    }
    return { impressions, views, clicks, ctr: impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00' };
  }, [analytics]);

  // Build preview campaign only when design + triggers are loaded
  const previewCampaign = React.useMemo<Campaign | null>(() => {
    if (!campaign || !design) return null;
    const mappedTriggers = mapApiTriggers(triggers, frequency);
    return buildPreviewCampaign(campaignId, campaign.name, design, mappedTriggers);
  }, [campaign, design, triggers, frequency, campaignId]);

  if (isCampaignLoading || analyticsLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320, color: 'var(--text-muted)', fontSize: 13 }}>
        Loading campaign data…
      </div>
    );
  }

  if (!campaign) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Campaign not found.</div>;
  }

  // Trigger label helpers
  const triggerLabel = (t: RuleItem) => {
    if (t.type === 'scroll_pct')       return `Scroll ${t.params?.pct ?? t.params?.scroll_pct ?? 50}%`;
    if (t.type === 'dwell_time')       return `Dwell ${t.params?.seconds ?? 5}s`;
    if (t.type === 'exit_intent_mouse') return 'Exit intent';
    if (t.type === 'inactivity')       return `Inactivity ${t.params?.seconds ?? 30}s`;
    if (t.type === 'click')            return 'Click';
    return t.type ?? 'unknown';
  };

  return (
    <div style={{ maxWidth: 1400, width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => onNavigate('/campaigns')} className="btn btn-icon" title="Back to campaigns">
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', margin: 0, marginBottom: 3 }}>
              {campaign.name}
            </h1>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Globe size={11} />
              {site?.domain ?? 'Unknown site'}
              <span style={{ marginLeft: 6 }}>·</span>
              <span style={{ textTransform: 'capitalize' }}>{campaign.status ?? 'draft'}</span>
              {isSpinWheel && (
                <><span style={{ marginLeft: 6 }}>·</span><span style={{ color: 'var(--accent-400)' }}>Spin to Win</span></>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Simulate button — only for standard (non-spin) campaigns with a design */}
          {!isSpinWheel && previewCampaign && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ gap: 6 }}
              onClick={() => setShowSimulation(true)}
              title="Open interactive simulation with real trigger settings"
            >
              <Play size={12} /> Simulate
            </button>
          )}
          {!isSpinWheel && (
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate(`/campaigns/${campaignId}/design`)}>
              Edit Design
            </button>
          )}
        </div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Impressions', value: stats.impressions.toLocaleString(), icon: Eye,               color: 'var(--data-1)',       desc: 'Times this popup was shown to a visitor.' },
          { label: 'Views',       value: stats.views.toLocaleString(),       icon: Megaphone,         color: 'var(--status-success)', desc: 'Popups that stayed on screen long enough to be seen (~1s+).' },
          { label: 'Clicks',      value: stats.clicks.toLocaleString(),      icon: MousePointerClick, color: 'var(--data-3)',       desc: 'Clicks on the CTA / affiliate link inside the popup.' },
          { label: 'CTR',         value: `${stats.ctr}%`,                    icon: Percent,           color: 'var(--accent-300)',   desc: 'Click-through rate — clicks divided by impressions.' },
        ].map(({ label, value, icon: Icon, color, desc }) => (
          <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Icon size={13} style={{ color }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color }}>
              {value}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.45 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Spin wheel config + triggers/targeting (spin_wheel only — it has no design editor) */}
      {isSpinWheel && design && (
        <>
          <SpinWheelPanel campaignId={campaignId} design={design} apiUrl={apiUrl} onDesignSaved={() => refetchDesign()} />
          <TriggersTargetingPanel
            campaignId={campaignId}
            apiUrl={apiUrl}
            apiTriggers={triggers}
            apiTargeting={targeting}
            frequency={frequency}
            onSaved={() => { void refetchTriggers(); void refetchTargeting(); void refetchFrequency(); }}
          />
        </>
      )}

      {/* Coupons — visible for all campaign types */}
      <CouponsPanel campaignId={campaignId} apiUrl={apiUrl} />

      {/* Rules + Summary grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 12 }}>
        {/* Rules Engine */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Sliders size={13} style={{ color: 'var(--accent-300)' }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Rules Engine</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Triggers</div>
              {triggers.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>None configured.</p>
              ) : triggers.map((t) => (
                <p key={t.id} style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                  {triggerLabel(t)}
                </p>
              ))}
            </div>
            <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Targeting</div>
              {targeting.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>None configured.</p>
              ) : targeting.map((r) => (
                <p key={r.id} style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                  {`${r.operator ?? ''} ${r.kind ?? ''} ${r.value ? JSON.stringify(r.value) : ''}`.trim()}
                </p>
              ))}
            </div>
            <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Frequency</div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-300)' }}>
                {frequency?.frequency ?? 'once_per_session'}
              </span>
              {(frequency?.maxDisplayCount || frequency?.cooldownSeconds || frequency?.showAgainIfConverts) ? (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                  ↻ {frequency?.maxDisplayCount ? `Max ${frequency.maxDisplayCount} displays` : 'Unlimited displays'}
                  {frequency?.cooldownSeconds ? ` · ≥${Math.round((frequency.cooldownSeconds as number) / 60)} min gap` : ''}
                  {` · ${frequency?.showAgainIfConverts ? 'shows after convert' : 'stops after convert'}`}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Activity size={13} style={{ color: 'var(--data-2)' }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Summary</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Type',            value: isSpinWheel ? 'Spin to Win' : ((design?.['kind'] as string | undefined) ?? 'modal') },
              { label: 'Trigger count',   value: triggers.length },
              { label: 'Targeting rules', value: targeting.length },
              { label: 'Frequency cap',   value: frequency?.frequency ?? 'once_per_session' },
              { label: 'Status',          value: campaign.status ?? 'draft' },
              { label: 'Created',         value: campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* A/B Test panel — hidden for spin wheels: variant design editing routes into the
          canvas editor, which has no spin-wheel template. */}
      {!isSpinWheel && (
        <div style={{ marginBottom: 12 }}>
          <ABPanel campaignId={campaignId} onNavigate={onNavigate} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        {/* Trigger Debugger */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Radar size={13} style={{ color: 'var(--data-2)' }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Trigger Debugger</span>
          </div>
          {!diagnose ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No diagnostics available yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Triggered', value: diagnose.rulesEvaluated, hint: 'trigger condition met' },
                { label: 'Shown',     value: diagnose.fired,          hint: 'proceeded to display' },
                { label: 'Blocked',   value: diagnose.blocked,        hint: 'suppressed before display' },
              ].map(({ label, value, hint }) => (
                <div key={label} title={hint} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{value ?? 0}</span>
                </div>
              ))}
              {(diagnose.topBlockedReasons ?? []).length > 0 && (
                <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '10px 12px', marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Top blocked reasons</div>
                  {diagnose.topBlockedReasons?.map((r) => (
                    <div key={r.reason} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>
                      <span>{BLOCK_REASON_LABELS[r.reason] ?? r.reason}</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Event Trace */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Activity size={13} style={{ color: 'var(--status-success)' }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Live Event Trace</span>
          </div>
          {liveEvents.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No recent events for this campaign.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {liveEvents.map((evt) => (
                <div key={evt.id} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-muted)', minWidth: 60 }}>
                    {evt.ts ? new Date(evt.ts).toLocaleTimeString('en', { hour12: false }) : '—'}
                  </span>
                  <span style={{
                    color: evt.eventType === 'click' ? 'var(--data-2)' : evt.eventType === 'impression' ? 'var(--data-1)' : evt.eventType === 'conversion' ? 'var(--data-3)' : 'var(--text-muted)',
                    minWidth: 80, textTransform: 'uppercase',
                  }}>
                    {evt.eventType}
                  </span>
                  <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {evt.domain ?? evt.visitorId?.slice(0, 12) ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Interactive simulation modal */}
      {showSimulation && previewCampaign && (
        <InteractivePreview
          campaign={previewCampaign}
          onClose={() => setShowSimulation(false)}
          onRecordConversion={() => {}}
        />
      )}
    </div>
  );
};
