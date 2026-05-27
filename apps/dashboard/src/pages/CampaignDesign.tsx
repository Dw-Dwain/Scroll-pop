import React from 'react';
import { ArrowLeft, Save, Eye } from 'lucide-react';
import { useOne, useApiUrl, useCustom, useCustomMutation } from '@refinedev/core';
import { DesignControls } from '../components/campaign-wizard/DesignControls';
import { LivePreview } from '../components/campaign-wizard/LivePreview';
import { FormDataShape } from '../types/campaign';

interface CampaignDesignProps {
  campaignId: string;
  onNavigate: (path: string) => void;
}

const DEFAULT_DESIGN = {
  kind: 'modal',
  config: {
    headline: 'Special Limited Offer',
    subheadline: 'Get exclusive access to our premium affiliate deals.',
    bodyText: '',
    ctaText: 'Claim Your Deal Now',
    backgroundColor: '#ffffff',
    textColor: '#111111',
    accentColor: '#6366f1',
    borderRadius: 12,
    showCloseButton: true,
    animation: 'slide_up',
    journeyMeta: { priority: 50, suppressionGroup: 'default', cooldownMinutes: 30 },
  },
  affiliateSlots: [],
};

const POPUP_KINDS = [
  { id: 'modal',      label: 'Modal' },
  { id: 'slide_in',   label: 'Slide-in' },
  { id: 'bar',        label: 'Bar' },
  { id: 'fullscreen', label: 'Fullscreen' },
  { id: 'floating_bubble', label: 'Bubble' },
] as const;

export const CampaignDesign: React.FC<CampaignDesignProps> = ({ campaignId, onNavigate }) => {
  const { data: campaignData, isLoading: isCampaignLoading } = useOne({ resource: 'campaigns', id: campaignId });
  const apiUrl = useApiUrl();
  const { data: designData, isLoading: isDesignLoading } = useCustom({
    url: `${apiUrl}/campaigns/${campaignId}/design`,
    method: 'get',
  });
  const { mutate } = useCustomMutation();

  const [design, setDesign] = React.useState<any>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saved' | 'error'>('idle');

  React.useEffect(() => {
    if (designData?.data) setDesign(designData.data);
    else if (!isDesignLoading) setDesign(DEFAULT_DESIGN);
  }, [designData, isDesignLoading]);

  const handleSave = () => {
    setIsSaving(true);
    setSaveStatus('idle');
    mutate(
      { url: `${apiUrl}/campaigns/${campaignId}/design`, method: 'put', values: design },
      {
        onSuccess: () => { setSaveStatus('saved'); setIsSaving(false); setTimeout(() => setSaveStatus('idle'), 2500); },
        onError:   () => { setSaveStatus('error');  setIsSaving(false); },
      }
    );
  };

  const updateConfig = (key: string, value: any) =>
    setDesign((prev: any) => ({ ...prev, config: { ...prev.config, [key]: value } }));

  const campaign = campaignData?.data;

  if (isCampaignLoading || isDesignLoading || !design) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360, color: 'var(--text-muted)', fontSize: 13 }}>
        Loading design editor…
      </div>
    );
  }

  const cfg = design?.config ?? {};
  const journeyMeta = cfg.journeyMeta ?? { priority: 50, suppressionGroup: 'default', cooldownMinutes: 30 };

  const formDataWrapper = { ...cfg, kind: design?.kind || 'modal' } as FormDataShape;

  const setFormDataWrapper = (updater: any) => {
    setDesign((prev: any) => {
      const current = { ...(prev?.config || {}), kind: prev?.kind || 'modal' };
      const next = typeof updater === 'function' ? updater(current) : updater;
      const { kind, ...nextConfig } = next;
      return { ...prev, kind, config: { ...(prev?.config || {}), ...nextConfig } };
    });
  };

  const saveLabel = isSaving ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error — Retry' : 'Save Design';

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => onNavigate('/campaigns')} className="btn btn-icon" title="Back">
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', margin: 0, marginBottom: 2 }}>Design Editor</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{campaign?.name || 'Campaign'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onNavigate(`/campaigns/detail/${campaignId}`)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Eye size={13} />
            Analytics
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary btn-sm"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: saveStatus === 'saved' ? 'var(--status-success)' : saveStatus === 'error' ? 'var(--status-error)' : undefined,
              borderColor: saveStatus === 'saved' ? 'var(--status-success)' : saveStatus === 'error' ? 'var(--status-error)' : undefined,
            }}
          >
            <Save size={13} />
            {saveLabel}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'flex-start' }}>
        {/* Left: controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Popup type */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>Format</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {POPUP_KINDS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setDesign((d: any) => ({ ...d, kind: id }))}
                  style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 5, cursor: 'pointer',
                    border: design?.kind === id ? '1px solid var(--accent-500)' : '1px solid var(--border-subtle)',
                    background: design?.kind === id ? 'rgba(99,102,241,0.1)' : 'var(--bg-raised)',
                    color: design?.kind === id ? 'var(--accent-300)' : 'var(--text-muted)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <DesignControls formData={formDataWrapper} setFormData={setFormDataWrapper} />

          {/* Behavior Controls */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>Behavior</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Priority (1–100)', field: 'priority', type: 'number', min: 1, max: 100 },
                { label: 'Suppression Group', field: 'suppressionGroup', type: 'text' },
                { label: 'Cooldown (minutes)', field: 'cooldownMinutes', type: 'number', min: 0 },
              ].map(({ label, field, type, min, max }) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {label}
                  </label>
                  <input
                    className="input"
                    type={type}
                    min={min}
                    max={max}
                    value={journeyMeta[field]}
                    onChange={(e) => updateConfig('journeyMeta', {
                      ...journeyMeta,
                      [field]: type === 'number' ? Math.max(min ?? 0, Math.min(max ?? Infinity, Number(e.target.value) || 0)) : (e.target.value || 'default'),
                    })}
                    style={{ width: '100%' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: live preview */}
        <div style={{ position: 'sticky', top: 0 }}>
          <LivePreview formData={formDataWrapper} />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            Rendered via Shadow DOM — this is a close approximation.
          </p>
        </div>
      </div>
    </div>
  );
};
