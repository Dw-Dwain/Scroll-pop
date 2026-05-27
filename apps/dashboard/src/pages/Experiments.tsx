import React from 'react';
import { FlaskConical, Pause, Play, Plus, Trophy } from 'lucide-react';
import { useApiUrl, useCustom, useCustomMutation, useList } from '@refinedev/core';

interface ExperimentsProps {
  onNavigate: (path: string) => void;
}

function ConfidenceBar({ control, variant }: { control: number; variant: number }) {
  const W = 300, H = 40;
  const max = Math.max(control, variant, 0.001);
  const cW = (control / max) * W;
  const vW = (variant / max) * W;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <rect x={0} y={8} width={cW} height={10} rx={2} fill="var(--data-1)" opacity={0.6} />
      <rect x={0} y={22} width={vW} height={10} rx={2} fill="var(--data-5)" opacity={0.6} />
      <text x={cW + 4} y={17} fontSize={9} fill="var(--text-muted)">Control</text>
      <text x={vW + 4} y={31} fontSize={9} fill="var(--text-muted)">Variant</text>
    </svg>
  );
}

export const Experiments: React.FC<ExperimentsProps> = ({ onNavigate }) => {
  const apiUrl = useApiUrl();
  const { data: campaignsData } = useList({ resource: 'campaigns' });
  const [selectedCampaignId, setSelectedCampaignId] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const { mutate } = useCustomMutation();

  React.useEffect(() => {
    const first = campaignsData?.data?.[0]?.id;
    if (!selectedCampaignId && first) setSelectedCampaignId(String(first));
  }, [campaignsData, selectedCampaignId]);

  const { data: experimentsResult, refetch } = useCustom({
    url: selectedCampaignId
      ? `${apiUrl}/campaigns/${selectedCampaignId}/experiments`
      : `${apiUrl}/campaigns/invalid/experiments`,
    method: 'get',
    queryOptions: { enabled: !!selectedCampaignId },
  });

  const experiments: any[] = Array.isArray((experimentsResult as any)?.data)
    ? (experimentsResult as any).data
    : [];

  const createExperiment = () => {
    if (!selectedCampaignId || !newName.trim()) return;
    mutate(
      {
        url: `${apiUrl}/campaigns/${selectedCampaignId}/experiments`,
        method: 'post',
        values: { name: newName.trim(), allocation: { control: 50, variantA: 50 }, guardrails: { minSample: 500 } },
      },
      { onSuccess: () => { setNewName(''); void refetch(); } }
    );
  };

  const updateStatus = (expId: string, status: 'running' | 'paused') => {
    if (!selectedCampaignId) return;
    mutate(
      { url: `${apiUrl}/campaigns/${selectedCampaignId}/experiments/${expId}`, method: 'patch', values: { status } },
      { onSuccess: () => void refetch() }
    );
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>Experiments</h1>
            <span className="badge badge-accent" style={{ fontSize: 9 }}>beta</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Run additive conversion experiments on live campaigns.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <select
          className="input"
          value={selectedCampaignId}
          onChange={(e) => setSelectedCampaignId(e.target.value)}
          style={{ maxWidth: 240 }}
        >
          {(campaignsData?.data ?? []).map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          className="input"
          placeholder="New experiment name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createExperiment()}
          style={{ flex: 1, maxWidth: 300 }}
        />
        <button className="btn btn-primary" onClick={createExperiment}>
          <Plus size={14} />
          Create
        </button>
      </div>

      {/* Experiments list */}
      {experiments.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          borderRadius: 8, padding: '48px 24px', textAlign: 'center',
        }}>
          <FlaskConical size={28} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>No experiments yet.</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {selectedCampaignId ? 'Create your first experiment above.' : 'Select a campaign to see its experiments.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {experiments.map((exp: any) => {
            const controlCvr = exp.results?.control?.conversionRate ?? 0;
            const variantCvr = exp.results?.variantA?.conversionRate ?? 0;
            const confidence = exp.results?.statisticalSignificance ?? 0;
            const isSignificant = confidence >= 0.95;
            return (
              <div key={exp.id} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 8, padding: 20,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{exp.name}</span>
                      <span className={`badge ${
                        exp.status === 'running' ? 'badge-success' :
                        exp.status === 'complete' ? 'badge-info' :
                        exp.status === 'paused'  ? 'badge-warning' :
                        'badge-neutral'
                      }`} style={{ textTransform: 'capitalize' }}>
                        {exp.status ?? 'draft'}
                      </span>
                    </div>
                    {exp.hypothesis && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 480 }}>{exp.hypothesis}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {isSignificant && (
                      <button className="btn btn-secondary btn-sm" style={{ color: 'var(--status-success)', borderColor: 'rgba(34,197,94,0.3)', fontSize: 11 }}>
                        <Trophy size={12} />
                        Declare Winner
                      </button>
                    )}
                    <button
                      onClick={() => updateStatus(exp.id, exp.status === 'running' ? 'paused' : 'running')}
                      className="btn btn-icon"
                    >
                      {exp.status === 'running'
                        ? <Pause size={14} />
                        : <Play size={14} />}
                    </button>
                  </div>
                </div>

                {/* Variant cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Control', cvr: controlCvr, n: exp.results?.control?.sampleSize ?? 0, color: 'var(--data-1)' },
                    { label: 'Variant A (Short Flow)', cvr: variantCvr, n: exp.results?.variantA?.sampleSize ?? 0, color: 'var(--data-5)' },
                  ].map(({ label, cvr, n, color }) => (
                    <div key={label} style={{
                      background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
                      borderRadius: 6, padding: 14,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                        </div>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color, marginBottom: 4 }}>
                        {(cvr * 100).toFixed(2)}%
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>n = {n.toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                {/* Confidence bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Confidence Interval Visualization
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: isSignificant ? 'var(--status-success)' : 'var(--text-muted)' }}>
                      p {'<'} {(1 - confidence).toFixed(2)} {isSignificant ? '✓' : '— not significant yet'}
                    </span>
                  </div>
                  <ConfidenceBar control={controlCvr} variant={variantCvr} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
