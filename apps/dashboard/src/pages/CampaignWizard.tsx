import React from 'react';
import { ChevronLeft, ChevronRight, Check, Megaphone, Layers, Wand2, Shield, Sparkles, Zap } from 'lucide-react';
import { useCreate, useList } from '@refinedev/core';
import { TemplateSelector } from '../components/campaign-wizard/TemplateSelector';
import { DesignControls } from '../components/campaign-wizard/DesignControls';
import { RulesBuilder } from '../components/campaign-wizard/RulesBuilder';
import { Scheduler } from '../components/campaign-wizard/Scheduler';
import { LivePreview } from '../components/campaign-wizard/LivePreview';
import { ActionsBuilder } from '../components/campaign-wizard/ActionsBuilder';
import { RuleGroup, RuleCondition, SchedulerWindow, TemplatePreset, FormDataShape } from '../types/campaign';
import { MASSIVE_TEMPLATES } from '../lib/templates';

interface CampaignWizardProps {
  onNavigate: (path: string) => void;
}

const newGroup = (): RuleGroup => ({ id: crypto.randomUUID(), type: 'group', operator: 'and', children: [] });
const newWindow = (): SchedulerWindow => ({ id: crypto.randomUUID(), day: 'all', start: '00:00', end: '23:59', tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });

const STEPS = [
  { id: 1, label: 'Details',   icon: Megaphone },
  { id: 2, label: 'Template',  icon: Layers },
  { id: 3, label: 'Design',    icon: Wand2 },
  { id: 4, label: 'Rules',     icon: Shield },
  { id: 5, label: 'Actions',   icon: Zap },
  { id: 6, label: 'Launch',    icon: Sparkles },
] as const;

export const CampaignWizard: React.FC<CampaignWizardProps> = ({ onNavigate }) => {
  const { data: sitesData } = useList({ resource: 'sites' });
  const { mutate: createCampaign } = useCreate();
  const { mutate: createDesign } = useCreate();
  const { mutate: createTrigger } = useCreate();
  const { mutate: createTargeting } = useCreate();
  const { mutate: createFrequency } = useCreate();

  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [favorites, setFavorites] = React.useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('campaign_template_favorites') ?? '[]'); } catch { return []; }
  });
  const [customTemplates, setCustomTemplates] = React.useState<TemplatePreset[]>([]);
  const [activeKind, setActiveKind] = React.useState<TemplatePreset['kind'] | 'all'>('all');
  const [ruleTree, setRuleTree] = React.useState<RuleGroup>(() => newGroup());
  const [scheduler, setScheduler] = React.useState<SchedulerWindow[]>([newWindow()]);

  const [formData, setFormData] = React.useState<FormDataShape>(() => {
    let globalAffiliate = 'https://affiliate.link';
    try {
      const stored = localStorage.getItem('_sp_settings');
      if (stored) globalAffiliate = JSON.parse(stored).affiliateLink || globalAffiliate;
    } catch {}
    return {
      siteId: '', name: '', kind: 'modal',
      headline: 'Special Limited Offer', subheadline: 'Get 50% off our premium affiliate deal today.',
      bodyText: 'Unlock access to top-rated products with limited pricing.',
      backgroundColor: '#ffffff', textColor: '#111111', accentColor: '#6366f1', borderRadius: 12,
      ctaText: 'Claim Offer', ctaStyle: 'button',
      showCloseButton: true, closeButtonPosition: 'top-right', showDismissText: false, dismissText: 'No thanks',
      overlayEnabled: true, overlayOpacity: 0.5, animation: 'slide_up', position: 'center', size: 'md', showPoweredBy: true,
      triggerType: 'scroll_pct', triggerParams: { pct: 45, seconds: 20 }, frequency: 'once_per_session',
      productName: 'Premium Membership', productUrl: globalAffiliate,
      imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    };
  });

  React.useEffect(() => { localStorage.setItem('campaign_template_favorites', JSON.stringify(favorites)); }, [favorites]);

  const applyTemplate = (t: TemplatePreset) => {
    setFormData((prev) => ({ ...prev, kind: t.kind, backgroundColor: t.colors.bg, textColor: t.colors.text, accentColor: t.colors.accent, ...t.fields }));
    setStep(3);
  };

  const cloneTemplate = (template: TemplatePreset) =>
    setCustomTemplates((prev) => [{ ...template, id: `custom-${crypto.randomUUID()}`, name: `${template.name} Copy`, tags: [...template.tags, 'custom'] }, ...prev]);

  const createTargetingRules = (campaignId: string) => {
    const flat: RuleCondition[] = [];
    const walk = (group: RuleGroup) => group.children.forEach((c) => c.type === 'condition' ? flat.push(c as RuleCondition) : walk(c as RuleGroup));
    walk(ruleTree);
    flat.forEach((rule) => {
      if (!rule.value && rule.kind !== 'returning_visitor') return;
      const value = rule.kind === 'device' ? { device: rule.value } : rule.kind === 'returning_visitor' ? { returning: rule.value !== 'false' } : { pattern: rule.value };
      createTargeting({ resource: `campaigns/${campaignId}/targeting`, values: { kind: rule.kind, operator: rule.operator, value } });
    });
    createTargeting({ resource: `campaigns/${campaignId}/targeting`, values: { kind: 'url_contains', operator: 'include', value: { meta: 'rules_builder', combinator: ruleTree.operator, tree: ruleTree, scheduler } } });
  };

  const handleLaunch = async () => {
    if (!formData.siteId || !formData.name) { alert('Campaign name and site are required.'); return; }
    setLoading(true);
    createCampaign({ resource: 'campaigns', values: { siteId: formData.siteId, name: formData.name } }, {
      onSuccess: (campaignRes: any) => {
        const campaignId = campaignRes.data.id;
        const designConfig = {
          kind: formData.kind, position: formData.position, size: formData.size,
          backgroundColor: formData.backgroundColor, textColor: formData.textColor, accentColor: formData.accentColor,
          borderRadius: formData.borderRadius, headline: formData.headline || 'Headline',
          subheadline: formData.subheadline || undefined, bodyText: formData.bodyText || undefined,
          ctaText: formData.ctaText || 'Click Here', ctaStyle: formData.ctaStyle,
          showCloseButton: formData.showCloseButton, closeButtonPosition: formData.closeButtonPosition,
          showDismissText: formData.showDismissText, dismissText: formData.dismissText || undefined,
          overlayEnabled: formData.overlayEnabled, overlayOpacity: formData.overlayOpacity,
          animation: formData.animation, showPoweredBy: formData.showPoweredBy,
          backgroundImage: formData.backgroundImage || formData.imageUrl || undefined,
          elements: formData.elements, layoutMode: formData.layoutMode,
          boxShadow: formData.boxShadow, afterSubmitAction: formData.afterSubmitAction,
          afterSubmitUrl: formData.afterSubmitUrl, afterSubmitEffect: formData.afterSubmitEffect,
          integrations: formData.integrations, webhookUrl: formData.webhookUrl,
          whoCanComplete: formData.whoCanComplete, sendFollowUpEmail: formData.sendFollowUpEmail,
          sendNotificationEmail: formData.sendNotificationEmail,
        };
        const affiliateSlots = formData.productUrl ? [{
          id: crypto.randomUUID(), product_name: formData.productName || 'Product',
          product_url: formData.productUrl || 'https://example.com',
          image_url: formData.imageUrl || 'https://example.com/image.jpg',
          click_tracker_url: formData.productUrl || 'https://example.com',
          cta_text: formData.ctaText || 'Click Here', weight: 100,
        }] : [];
        createDesign({ resource: `campaigns/${campaignId}/design`, values: { kind: formData.kind, config: designConfig, affiliate_slots: affiliateSlots } }, {
          onSuccess: () => createTrigger({ resource: `campaigns/${campaignId}/triggers`, values: { type: formData.triggerType, params: formData.triggerType === 'scroll_pct' ? { pct: formData.triggerParams.pct } : { seconds: formData.triggerParams.seconds } } }, {
            onSuccess: () => createFrequency({ resource: `campaigns/${campaignId}/frequency`, values: { frequency: formData.frequency } }, {
              onSuccess: () => { createTargetingRules(campaignId); setLoading(false); onNavigate('/campaigns'); },
              onError: () => setLoading(false),
            }),
            onError: () => setLoading(false),
          }),
          onError: () => setLoading(false),
        });
      },
      onError: () => setLoading(false),
    });
  };

  const isTwoCol = step >= 3;

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Minimal chrome */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: 20, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)',
      }}>
        <button
          onClick={() => onNavigate('/campaigns')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: 'var(--text-muted)', padding: 0,
          }}
        >
          <ChevronLeft size={14} />
          Back to Campaigns
        </button>

        {/* Step dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {STEPS.map((s, idx) => {
            const done = step > s.id;
            const current = step === s.id;
            return (
              <React.Fragment key={s.id}>
                {idx > 0 && (
                  <div style={{
                    width: 20, height: 1,
                    background: done ? 'var(--accent-500)' : 'var(--border-subtle)',
                  }} />
                )}
                <button
                  onClick={() => s.id < step && setStep(s.id)}
                  disabled={s.id > step}
                  title={s.label}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 500, cursor: s.id <= step ? 'pointer' : 'default',
                    border: current ? '2px solid var(--accent-500)' : done ? '2px solid var(--accent-500)' : '1px solid var(--border-default)',
                    background: done ? 'var(--accent-500)' : current ? 'rgba(99,102,241,0.12)' : 'var(--bg-raised)',
                    color: done ? '#fff' : current ? 'var(--accent-300)' : 'var(--text-muted)',
                    boxShadow: current ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
                    transition: 'all 0.15s var(--ease-out)',
                    padding: 0,
                  }}
                >
                  {done ? <Check size={12} /> : s.id}
                </button>
              </React.Fragment>
            );
          })}
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            {STEPS[step - 1]?.label}
          </span>
        </div>
      </div>

      {/* Main area */}
      <div style={{
        flex: 1,
        display: isTwoCol ? 'grid' : 'flex',
        gridTemplateColumns: isTwoCol ? '1fr 360px' : undefined,
        flexDirection: isTwoCol ? undefined : 'column',
        alignItems: isTwoCol ? 'flex-start' : undefined,
        gap: 24,
      }}>
        {/* Left / main column */}
        <div style={{
          maxWidth: isTwoCol ? undefined : 640,
          width: '100%',
          margin: isTwoCol ? undefined : '0 auto',
          paddingBottom: 80,
        }}>

          {/* Step 1: Campaign Details */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Campaign Details</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Name your campaign and select which site it will run on.</p>
              </div>

              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Campaign Name
                  </label>
                  <input
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Black Friday Sale"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Target Site
                  </label>
                  <select
                    className="input"
                    value={formData.siteId}
                    onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select a site…</option>
                    {sitesData?.data?.map((site: any) => (
                      <option key={site.id} value={site.id}>{site.name} ({site.domain})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Format
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {([
                      { value: 'modal', label: 'Modal' },
                      { value: 'slide_in', label: 'Slide-in' },
                      { value: 'bar', label: 'Bar' },
                      { value: 'fullscreen', label: 'Fullscreen' },
                      { value: 'floating_bubble', label: 'Bubble' },
                      { value: 'gamified_overlay', label: 'Gamified' },
                    ] as const).map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setFormData({ ...formData, kind: value })}
                        style={{
                          padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                          border: formData.kind === value ? '1px solid var(--accent-500)' : '1px solid var(--border-subtle)',
                          background: formData.kind === value ? 'rgba(99,102,241,0.1)' : 'var(--bg-raised)',
                          color: formData.kind === value ? 'var(--accent-300)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Template */}
          {step === 2 && (
            <TemplateSelector
              templates={MASSIVE_TEMPLATES}
              customTemplates={customTemplates}
              favorites={favorites}
              setFavorites={setFavorites}
              cloneTemplate={cloneTemplate}
              applyTemplate={applyTemplate}
              activeKind={activeKind}
              setActiveKind={setActiveKind}
              onTypeChange={(kind) => {
                setFormData(prev => {
                  let position = prev.position;
                  let size = prev.size;
                  if (kind === 'slide_in') { position = 'bottom-right'; size = 'md'; }
                  if (kind === 'floating_bubble') { position = 'bottom-left'; size = 'sm'; }
                  if (kind === 'fullscreen') { position = 'center'; size = 'lg'; }
                  if (kind === 'modal' || kind === 'gamified_overlay') { position = 'center'; size = 'md'; }
                  if (kind === 'bar') { position = 'top'; size = 'lg'; }
                  return { ...prev, kind: kind as any, position, size };
                });
              }}
            />
          )}

          {/* Step 3: Design */}
          {step === 3 && (
            <DesignControls formData={formData} setFormData={setFormData} />
          )}

          {/* Step 4: Targeting */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <RulesBuilder ruleTree={ruleTree} setRuleTree={setRuleTree} />
              <Scheduler scheduler={scheduler} setScheduler={setScheduler} />

              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 16 }}>Trigger Conditions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Trigger Event
                    </label>
                    <select
                      className="input"
                      value={formData.triggerType}
                      onChange={(e) => setFormData({ ...formData, triggerType: e.target.value as any })}
                      style={{ width: '100%' }}
                    >
                      <option value="scroll_pct">Scroll depth</option>
                      <option value="dwell_time">Time on page</option>
                      <option value="inactivity">Inactivity delay</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Parameter
                    </label>
                    {formData.triggerType === 'scroll_pct' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                        <input
                          type="range" min={1} max={100}
                          value={formData.triggerParams.pct}
                          onChange={(e) => setFormData({ ...formData, triggerParams: { ...formData.triggerParams, pct: Number(e.target.value) || 45 } })}
                          style={{ flex: 1, accentColor: 'var(--accent-500)' }}
                        />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', minWidth: 32 }}>
                          {formData.triggerParams.pct}%
                        </span>
                      </div>
                    ) : (
                      <input
                        type="number" min={1}
                        className="input"
                        value={formData.triggerParams.seconds}
                        onChange={(e) => setFormData({ ...formData, triggerParams: { ...formData.triggerParams, seconds: Number(e.target.value) || 20 } })}
                        style={{ width: '100%' }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Actions */}
          {step === 5 && (
            <ActionsBuilder formData={formData} setFormData={setFormData} />
          )}

          {/* Step 6: Launch */}
          {step === 6 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 32, textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px',
                background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--status-success)',
              }}>
                <Sparkles size={20} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Ready to Launch</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 24px' }}>
                Your campaign is fully configured. Review the live preview to confirm everything looks right before going live.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                {[
                  { label: 'Format', value: formData.kind.replace(/_/g, ' ') },
                  { label: 'Trigger', value: formData.triggerType.replace(/_/g, ' ') },
                  { label: 'Rules', value: `${ruleTree.children.length} groups` },
                  { label: 'Schedule', value: `${scheduler.length} windows` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'var(--bg-raised)', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{value}</div>
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop: 24 }}>
                <button
                  onClick={handleLaunch}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ minWidth: 160, background: 'var(--status-success)', borderColor: 'var(--status-success)' }}
                >
                  {loading ? 'Launching…' : 'Launch Campaign'}
                </button>
              </div>
            </div>
          )}


        </div>

        {/* Right column: live preview (steps 3+) */}
        {isTwoCol && (
          <div style={{ position: 'sticky', top: 0 }}>
            <LivePreview formData={formData} />
          </div>
        )}
      </div>
    </div>
  );
};
