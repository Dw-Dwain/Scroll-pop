import React from 'react';
import { ArrowLeft, Eye, Globe, Megaphone, MousePointerClick, Percent, Radar, Sliders, Activity } from 'lucide-react';
import { useApiUrl, useCustom, useList, useOne } from '@refinedev/core';

interface CampaignDetailProps {
  campaignId: string;
  onNavigate: (path: string) => void;
}

type RuleItem = { id: string; type?: string; params?: any; kind?: string; operator?: string; value?: any; frequency?: string };

export const CampaignDetail: React.FC<CampaignDetailProps> = ({ campaignId, onNavigate }) => {
  const { data: campaignData, isLoading: isCampaignLoading } = useOne({ resource: 'campaigns', id: campaignId });
  const { data: sitesData } = useList({ resource: 'sites' });
  const apiUrl = useApiUrl();
  // Fetch per-campaign data through the Refine data provider so auth is handled
  // uniformly (Clerk JWT on web, internal secret on desktop). The previous raw
  // fetch read `desktop_token` from localStorage, which is only set in Electron —
  // so on the live web app every request went out unauthenticated and returned
  // nothing, leaving this page blank for active campaigns.
  const { data: analyticsRes, isLoading: analyticsLoading } = useCustom({
    url: `${apiUrl}/analytics/campaigns/${campaignId}`, method: 'get',
  });
  const { data: triggersRes } = useCustom({ url: `${apiUrl}/campaigns/${campaignId}/triggers`, method: 'get' });
  const { data: targetingRes } = useCustom({ url: `${apiUrl}/campaigns/${campaignId}/targeting`, method: 'get' });
  const { data: frequencyRes } = useCustom({ url: `${apiUrl}/campaigns/${campaignId}/frequency`, method: 'get' });
  // journeys/ops are beta + flag-gated and may 404 — don't retry or toast on error.
  const { data: diagnoseRes } = useCustom({
    url: `${apiUrl}/journeys/${campaignId}/diagnose`, method: 'get',
    queryOptions: { retry: false }, errorNotification: false,
  });
  const { data: liveEventsRes } = useCustom({
    url: `${apiUrl}/ops/live-events?campaignId=${campaignId}&limit=12`, method: 'get',
    queryOptions: { retry: false }, errorNotification: false,
  });

  const analytics: any[] = (analyticsRes as any)?.data ?? [];
  const triggers: RuleItem[] = (triggersRes as any)?.data ?? [];
  const targeting: RuleItem[] = (targetingRes as any)?.data ?? [];
  const frequency: RuleItem | null = (frequencyRes as any)?.data ?? null;
  const diagnose: any | null = (diagnoseRes as any)?.data ?? null;
  const liveEvents: any[] = (liveEventsRes as any)?.data ?? [];
  const isLoading = analyticsLoading;

  const campaign = campaignData?.data;
  const site = sitesData?.data.find((s: any) => s.id === campaign?.siteId);

  const stats = React.useMemo(() => {
    let impressions = 0, views = 0, clicks = 0;
    for (const row of analytics) {
      if (row.eventType === 'impression') impressions += row.count;
      if (row.eventType === 'view') views += row.count;
      if (row.eventType === 'click') clicks += row.count;
    }
    return { impressions, views, clicks, ctr: impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00' };
  }, [analytics]);

  if (isCampaignLoading || isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320, color: 'var(--text-muted)', fontSize: 13 }}>
        Loading campaign data…
      </div>
    );
  }

  if (!campaign) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Campaign not found.</div>;
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => onNavigate('/campaigns')}
            className="btn btn-icon"
            title="Back to campaigns"
          >
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
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate(`/campaigns/${campaignId}/design`)}>
            Edit Design
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Impressions', value: stats.impressions.toLocaleString(), icon: Eye,               color: 'var(--data-1)' },
          { label: 'Views',       value: stats.views.toLocaleString(),       icon: Megaphone,         color: 'var(--status-success)' },
          { label: 'Clicks',      value: stats.clicks.toLocaleString(),      icon: MousePointerClick, color: 'var(--data-3)' },
          { label: 'CTR',         value: `${stats.ctr}%`,                    icon: Percent,           color: 'var(--accent-300)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Icon size={13} style={{ color }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* Rules Engine */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Sliders size={13} style={{ color: 'var(--accent-300)' }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Rules Engine</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Triggers', items: triggers, render: (t: RuleItem) => `${t.type ?? ''} ${t.params ? JSON.stringify(t.params) : ''}`.trim() },
              { label: 'Targeting', items: targeting, render: (r: RuleItem) => `${r.operator ?? ''} ${r.kind ?? ''} ${r.value ? JSON.stringify(r.value) : ''}`.trim() },
            ].map(({ label, items, render }) => (
              <div key={label} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</div>
                {items.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>None configured.</p>
                ) : items.map((item) => (
                  <p key={item.id} style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                    {render(item)}
                  </p>
                ))}
              </div>
            ))}
            <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Frequency</div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-300)' }}>
                {frequency?.frequency ?? 'once_per_session'}
              </span>
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
              { label: 'Trigger count', value: triggers.length },
              { label: 'Targeting rules', value: targeting.length },
              { label: 'Frequency cap', value: frequency?.frequency ?? 'once_per_session' },
              { label: 'Status', value: campaign.status ?? 'draft' },
              { label: 'Created', value: campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : '—' },
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                { label: 'Rules evaluated', value: diagnose.rulesEvaluated },
                { label: 'Fired', value: diagnose.fired },
                { label: 'Blocked', value: diagnose.blocked },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
              {(diagnose.topBlockedReasons ?? []).length > 0 && (
                <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '10px 12px', marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Top blocked reasons</div>
                  {diagnose.topBlockedReasons.map((r: any) => (
                    <div key={r.reason} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>
                      <span>{r.reason}</span>
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
              {liveEvents.map((evt: any) => (
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
    </div>
  );
};
