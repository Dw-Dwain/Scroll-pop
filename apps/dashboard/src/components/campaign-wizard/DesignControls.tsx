import React, { useState } from 'react';
import {
  Layout, Plus, Sliders, Palette, Layers,
  GripVertical, Trash2,
  Type, Zap, Image as ImageIcon, Clock, Ticket, FormInput,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import { FormDataShape } from '../../types/campaign';

interface DesignControlsProps {
  formData: FormDataShape;
  setFormData: React.Dispatch<React.SetStateAction<FormDataShape>>;
}

/* ── zinc light-theme tokens ──────────────────────────────────── */
const Z = {
  white:     '#ffffff',
  zinc50:    '#fafafa',
  zinc100:   '#f4f4f5',
  zinc200:   '#e4e4e7',
  zinc300:   '#d4d4d8',
  zinc400:   '#a1a1aa',
  zinc500:   '#71717a',
  zinc700:   '#3f3f46',
  zinc800:   '#27272a',
  zinc900:   '#18181b',
};

/* ── micro-components ─────────────────────────────────────────── */

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label style={{
    display: 'block', fontSize: 9, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    color: Z.zinc500, marginBottom: 4,
    fontFamily: 'var(--font-mono, monospace)',
  }}>
    {children}
  </label>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: Z.zinc500,
    fontFamily: 'var(--font-mono, monospace)', marginBottom: 10,
  }}>
    {children}
  </div>
);

const Divider = () => <div style={{ height: 1, background: Z.zinc200, margin: '12px 0' }} />;

const ColorRow: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div>
    <Label>{label}</Label>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: 26, height: 26, borderRadius: 5, overflow: 'hidden', border: `1px solid ${Z.zinc300}`, flexShrink: 0, cursor: 'pointer' }}>
        <input
          type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ position: 'absolute', inset: '-4px', width: 'calc(100% + 8px)', height: 'calc(100% + 8px)', cursor: 'pointer', border: 'none', padding: 0, background: 'none' }}
        />
      </div>
      <span style={{ fontFamily: 'monospace', fontSize: 10, color: Z.zinc700, textTransform: 'uppercase' }}>{value}</span>
    </div>
  </div>
);

/* ── nav rail config ──────────────────────────────────────────── */

const TABS = [
  { id: 'templates', label: 'Presets',  icon: Layout   },
  { id: 'elements',  label: 'Elements', icon: Plus      },
  { id: 'style',     label: 'Style',    icon: Palette   },
  { id: 'triggers',  label: 'Triggers', icon: Sliders   },
  { id: 'layers',    label: 'Layers',   icon: Layers    },
] as const;

type TabId = typeof TABS[number]['id'];

/* ── main component ───────────────────────────────────────────── */

export const DesignControls: React.FC<DesignControlsProps> = ({ formData, setFormData }) => {
  const [activeTab, setActiveTab] = useState<TabId>('elements');

  const updateBlock = (idx: number, updates: any) => {
    if (!formData.elements) return;
    const next = [...formData.elements];
    next[idx] = { ...next[idx], ...updates };
    setFormData(prev => ({ ...prev, elements: next }));
  };

  const removeBlock = (idx: number) => {
    if (!formData.elements) return;
    const next = [...formData.elements];
    next.splice(idx, 1);
    setFormData(prev => ({ ...prev, elements: next }));
  };

  const moveBlock = (idx: number, dir: 'up' | 'down') => {
    if (!formData.elements) return;
    const next = [...formData.elements];
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setFormData(prev => ({ ...prev, elements: next }));
  };

  const addBlock = (type: string) => {
    let props: any;
    if (type === 'scratch_card') props = { prizeCode: 'LUCKY25', prizeLabel: '25% OFF YOUR ORDER!', overlayText: 'Scratch to Reveal ⚡' };
    else if (type === 'wheel') props = { slices: [{ label: '10% OFF', value: 'SAVE10', color: '#ec4899', isWin: true }, { label: 'Try Again', value: 'LOSE', color: '#1e1b4b', isWin: false }, { label: 'Free Ship', value: 'FREESHIP', color: '#6366f1', isWin: true }, { label: 'Try Again', value: 'LOSE', color: '#312e81', isWin: false }, { label: '50% OFF', value: 'SAVE50', color: '#f59e0b', isWin: true }, { label: 'No Luck', value: 'LOSE', color: '#4338ca', isWin: false }] };
    else if (type === 'form') props = { fields: 'email', placeholder: 'Enter your email…', buttonColor: '#18181b' };
    const newBlock = {
      id: Math.random().toString(36).substring(7), type,
      content: type === 'button' ? 'Click Me' : type === 'text' ? 'New Text Block' : type === 'form' ? 'Subscribe' : '',
      styles: type === 'scratch_card' ? { width: '100%', height: '150px', borderRadius: '12px' } : {},
      props,
    };
    const elements = formData.elements ? [...formData.elements, newBlock] : [newBlock];
    setFormData(prev => ({ ...prev, elements, layoutMode: 'blocks' }));
    setActiveTab('layers');
  };

  const inputS: React.CSSProperties = {
    width: '100%', background: Z.white, border: `1px solid ${Z.zinc200}`,
    borderRadius: 6, padding: '7px 10px', fontSize: 12, color: Z.zinc900,
    outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.12s',
  };

  const iFocus = {
    onFocus: (e: React.FocusEvent<any>) => { e.currentTarget.style.borderColor = Z.zinc900; },
    onBlur:  (e: React.FocusEvent<any>) => { e.currentTarget.style.borderColor = Z.zinc200; },
  };

  const blockCount = formData.elements?.length ?? 0;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: Z.white }}>

      {/* ── Icon navigation rail — matches SidebarLeft ────────────── */}
      <div style={{
        width: 80, flexShrink: 0,
        borderRight: `1px solid ${Z.zinc200}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 16, gap: 4, background: Z.zinc50,
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            const isLayers = tab.id === 'layers';
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                style={{
                  position: 'relative',
                  width: 56, height: 56,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 4, borderRadius: 8,
                  background: active ? Z.zinc900 : 'transparent',
                  color: active ? Z.white : Z.zinc500,
                  border: 'none', cursor: 'pointer',
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(228,228,231,0.5)'; (e.currentTarget as HTMLElement).style.color = !active ? Z.zinc900 : Z.white; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = !active ? Z.zinc500 : Z.white; }}
              >
                <tab.icon style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'monospace', lineHeight: 1 }}>
                  {tab.label}
                </span>
                {isLayers && blockCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 14, height: 14, borderRadius: '50%',
                    background: active ? Z.white : Z.zinc900,
                    color: active ? Z.zinc900 : Z.white,
                    fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${active ? Z.zinc700 : Z.white}`,
                  }}>
                    {blockCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* Bottom watermark */}
        <div style={{ fontSize: 8, letterSpacing: '0.12em', color: Z.zinc400, fontFamily: 'monospace', paddingBottom: 16, paddingTop: 12, borderTop: `1px solid ${Z.zinc200}`, width: '100%', textAlign: 'center', textTransform: 'uppercase' }}>
          sp-v1
        </div>
      </div>

      {/* ── Scrollable content drawer ─────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px', background: Z.white, minHeight: 0 }}>

        {/* ── Presets (template mini-cards) ─────────────────────── */}
        {activeTab === 'templates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <SectionTitle>Premium Presets</SectionTitle>
              <p style={{ fontSize: 11, color: Z.zinc500, lineHeight: 1.5, marginBottom: 12 }}>
                Apply an expert-crafted layout to reset the entire popup design in one click.
              </p>
            </div>
            <div style={{ padding: '32px 0', textAlign: 'center', border: `1px dashed ${Z.zinc200}`, borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: Z.zinc400 }}>
                Go to Step 2 — Template Library to browse presets.
              </span>
            </div>
          </div>
        )}

        {/* ── Elements: add blocks ───────────────────────────────── */}
        {activeTab === 'elements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <SectionTitle>Campaign Elements</SectionTitle>
              <p style={{ fontSize: 11, color: Z.zinc500, lineHeight: 1.5, marginBottom: 12 }}>
                Add interactive components. Click any block to inject it directly into your popup layout.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { type: 'text',        label: 'Large Title',   icon: Type,      desc: 'Headline block' },
                { type: 'button',      label: 'Action Button', icon: Zap,       desc: 'CTA & click promo' },
                { type: 'image',       label: 'Image Asset',   icon: ImageIcon, desc: 'Brand graphic node' },
                { type: 'form',        label: 'Email Form',    icon: FormInput, desc: 'Collect addresses' },
                { type: 'timer',       label: 'Countdown',     icon: Clock,     desc: 'Limited offer clock' },
                { type: 'coupon',      label: 'Coupon Code',   icon: Ticket,    desc: 'Promo code display' },
                { type: 'scratch_card', label: 'Scratch Card', icon: Ticket,    desc: 'Gamified reveal' },
                { type: 'wheel',       label: 'Spin Wheel',    icon: Sliders,   desc: 'Prize spin-to-win' },
              ].map(({ type, label, icon: Icon, desc }) => (
                <button
                  key={type}
                  onClick={() => addBlock(type)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 4, padding: '12px 8px', borderRadius: 8,
                    border: `1px solid ${Z.zinc200}`,
                    background: `${Z.zinc50}80`,
                    cursor: 'pointer', textAlign: 'center',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = Z.zinc100; (e.currentTarget as HTMLElement).style.borderColor = Z.zinc900; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${Z.zinc50}80`; (e.currentTarget as HTMLElement).style.borderColor = Z.zinc200; }}
                >
                  <Icon style={{ width: 18, height: 18, color: Z.zinc700 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: Z.zinc900, lineHeight: 1 }}>{label}</span>
                  <span style={{ fontSize: 9, color: Z.zinc400, lineHeight: 1.3 }}>{desc}</span>
                </button>
              ))}
            </div>

            <div style={{ padding: '12px 14px', background: Z.zinc50, border: `1px solid ${Z.zinc200}`, borderRadius: 8, marginTop: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: Z.zinc500, fontFamily: 'monospace', display: 'block', marginBottom: 5 }}>Design Tip</span>
              <p style={{ fontSize: 11, color: Z.zinc500, lineHeight: 1.55 }}>
                Add elements here then adjust colors and sizing in the Style tab. Use the Layers tab to reorder blocks.
              </p>
            </div>
          </div>
        )}

        {/* ── Style: colors, shape, shadow ───────────────────────── */}
        {activeTab === 'style' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionTitle>Colors</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <ColorRow label="Background" value={formData.backgroundColor} onChange={v => setFormData(p => ({ ...p, backgroundColor: v }))} />
              <ColorRow label="Text" value={formData.textColor} onChange={v => setFormData(p => ({ ...p, textColor: v }))} />
              <ColorRow label="Accent / CTA" value={formData.accentColor} onChange={v => setFormData(p => ({ ...p, accentColor: v }))} />
            </div>

            <Divider />
            <SectionTitle>Shape & Spacing</SectionTitle>

            <div>
              <Label>Border Radius</Label>
              <select value={formData.borderRadius} onChange={e => setFormData(p => ({ ...p, borderRadius: Number(e.target.value) }))} style={inputS} {...iFocus}>
                <option value={0}>Sharp — 0px</option>
                <option value={6}>Subtle — 6px</option>
                <option value={8}>Small — 8px</option>
                <option value={12}>Medium — 12px</option>
                <option value={16}>Rounded — 16px</option>
                <option value={24}>Extra — 24px</option>
                <option value={32}>Pill — 32px</option>
              </select>
            </div>
            <div>
              <Label>Inner Padding</Label>
              <select value={formData.padding || '24px'} onChange={e => setFormData(p => ({ ...p, padding: e.target.value }))} style={inputS} {...iFocus}>
                {['4px','8px','12px','16px','20px','24px','32px','40px','48px'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <Label>Elements Gap</Label>
              <select value={formData.gap || '12px'} onChange={e => setFormData(p => ({ ...p, gap: e.target.value }))} style={inputS} {...iFocus}>
                {['4px','8px','12px','16px','20px','24px','32px'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <Divider />
            <SectionTitle>Shadow</SectionTitle>
            <select value={formData.boxShadow || 'none'} onChange={e => setFormData(p => ({ ...p, boxShadow: e.target.value }))} style={inputS} {...iFocus}>
              <option value="none">None</option>
              <option value="soft">Soft Ambient</option>
              <option value="medium">Medium Depth</option>
              <option value="floating">Floating</option>
              <option value="premium">Premium Editorial</option>
              <option value="glass">Glassmorphism</option>
              <option value="dark">Dark Glow</option>
            </select>

            <Divider />
            <SectionTitle>Background Image</SectionTitle>
            <input type="text" value={formData.backgroundImage || ''} onChange={e => setFormData(p => ({ ...p, backgroundImage: e.target.value }))} placeholder="https://…" style={inputS} {...iFocus} />

            <Divider />
            <SectionTitle>Close Button</SectionTitle>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: 12, color: Z.zinc700 }}>Show close button</span>
              <input type="checkbox" checked={formData.showCloseButton} onChange={e => setFormData(p => ({ ...p, showCloseButton: e.target.checked }))} style={{ accentColor: Z.zinc900, width: 14, height: 14 }} />
            </label>
            {formData.showCloseButton && (
              <div>
                <Label>Position</Label>
                <select value={formData.closeButtonPosition} onChange={e => setFormData(p => ({ ...p, closeButtonPosition: e.target.value as any }))} style={inputS} {...iFocus}>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* ── Triggers: position, animation, overlay ─────────────── */}
        {activeTab === 'triggers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionTitle>Campaign Triggers</SectionTitle>

            {/* Trigger type */}
            <div style={{ padding: '12px 14px', border: `1px solid ${Z.zinc200}`, borderRadius: 8, background: `${Z.zinc50}55`, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: Z.zinc900 }}>Trigger Event</span>
              </div>
              <Label>When to show</Label>
              <select value={formData.triggerType} onChange={e => setFormData(p => ({ ...p, triggerType: e.target.value as any }))} style={inputS} {...iFocus}>
                <option value="scroll_pct">Scroll Depth</option>
                <option value="dwell_time">Time Delay</option>
                <option value="exit_intent">Exit Intent</option>
                <option value="inactivity">Inactivity</option>
              </select>
              {formData.triggerType === 'scroll_pct' ? (
                <div>
                  <Label>Scroll percentage — {formData.triggerParams.pct}%</Label>
                  <input type="range" min={1} max={100} value={formData.triggerParams.pct} onChange={e => setFormData(p => ({ ...p, triggerParams: { ...p.triggerParams, pct: Number(e.target.value) } }))} style={{ width: '100%', accentColor: Z.zinc900 }} />
                </div>
              ) : (
                <div>
                  <Label>Delay (seconds)</Label>
                  <input type="number" min={1} value={formData.triggerParams.seconds || 20} onChange={e => setFormData(p => ({ ...p, triggerParams: { ...p.triggerParams, seconds: Number(e.target.value) } }))} style={inputS} {...iFocus} />
                </div>
              )}
            </div>

            <Divider />
            <SectionTitle>Position & Animation</SectionTitle>

            {/* Position grid */}
            <div>
              <Label>Position on screen</Label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, background: Z.zinc50, border: `1px solid ${Z.zinc200}`, borderRadius: 8, padding: 6 }}>
                {([
                  ['top-left','↖','Top Left'],['top-center','↑','Top Center'],['top-right','↗','Top Right'],
                  ['center-left','←','Center Left'],['center','·','Center'],['center-right','→','Center Right'],
                  ['bottom-left','↙','Bottom Left'],['bottom-center','↓','Bottom Center'],['bottom-right','↘','Bottom Right'],
                ] as const).map(([val, arrow, label]) => {
                  const active = formData.position === val;
                  return (
                    <button key={val} title={label} onClick={() => setFormData(p => ({ ...p, position: val }))}
                      style={{
                        aspectRatio: '1', borderRadius: 6,
                        border: `1px solid ${active ? Z.zinc900 : Z.zinc200}`,
                        background: active ? Z.zinc900 : Z.white,
                        color: active ? Z.white : Z.zinc400,
                        cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.1s',
                      }}
                      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = Z.zinc900; (e.currentTarget as HTMLElement).style.color = Z.zinc700; } }}
                      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = Z.zinc200; (e.currentTarget as HTMLElement).style.color = Z.zinc400; } }}
                    >
                      {arrow}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>Size</Label>
              <select value={formData.size} onChange={e => setFormData(p => ({ ...p, size: e.target.value as any }))} style={inputS} {...iFocus}>
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
              </select>
            </div>

            <div>
              <Label>Animation</Label>
              <select value={formData.animation} onChange={e => setFormData(p => ({ ...p, animation: e.target.value as any }))} style={inputS} {...iFocus}>
                <option value="fade">Fade In</option>
                <option value="slide_up">Slide Up</option>
                <option value="slide_down">Slide Down</option>
                <option value="zoom">Zoom In</option>
                <option value="bounce">Bounce Drop</option>
                <option value="elastic">Elastic Pop</option>
                <option value="flip_in">Flip In</option>
                <option value="none">None</option>
              </select>
            </div>

            <Divider />
            <SectionTitle>Overlay</SectionTitle>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: 12, color: Z.zinc700 }}>Enable background overlay</span>
              <input type="checkbox" checked={formData.overlayEnabled} onChange={e => setFormData(p => ({ ...p, overlayEnabled: e.target.checked }))} style={{ accentColor: Z.zinc900, width: 14, height: 14 }} />
            </label>
            {formData.overlayEnabled && (
              <div>
                <Label>Opacity — {Math.round(formData.overlayOpacity * 100)}%</Label>
                <input type="range" min={0} max={1} step={0.05} value={formData.overlayOpacity} onChange={e => setFormData(p => ({ ...p, overlayOpacity: Number(e.target.value) }))} style={{ width: '100%', accentColor: Z.zinc900 }} />
              </div>
            )}

            <Divider />
            <SectionTitle>Display Frequency</SectionTitle>
            <select value={formData.frequency} onChange={e => setFormData(p => ({ ...p, frequency: e.target.value as any }))} style={inputS} {...iFocus}>
              <option value="always">Every page view</option>
              <option value="once_per_session">Once per session</option>
              <option value="once_per_day">Once per day</option>
              <option value="once_per_visitor">Once per visitor</option>
            </select>
          </div>
        )}

        {/* ── Layers: block list ─────────────────────────────────── */}
        {activeTab === 'layers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionTitle>Canvas Layers ({blockCount})</SectionTitle>
            <p style={{ fontSize: 11, color: Z.zinc500, lineHeight: 1.5, marginBottom: 4 }}>
              Control block ordering. Delete redundant elements below.
            </p>

            {formData.layoutMode !== 'blocks' && (
              <div style={{ padding: '10px 12px', background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, fontSize: 11, color: '#713f12' }}>
                <strong>Legacy layout.</strong>{' '}
                <button
                  onClick={() => setFormData(prev => ({ ...prev, layoutMode: 'blocks', elements: [{ type: 'text', content: prev.headline || 'Headline', styles: { fontSize: '24px', fontWeight: 'bold' } }, { type: 'text', content: prev.bodyText || '', styles: {} }, { type: 'button', content: prev.ctaText || 'Submit', styles: { backgroundColor: prev.accentColor, color: '#fff' } }] }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', textDecoration: 'underline', fontSize: 11, padding: 0 }}
                >
                  Upgrade to Block Engine
                </button>
              </div>
            )}

            {formData.layoutMode === 'blocks' && (
              <>
                {(!formData.elements || formData.elements.length === 0) && (
                  <div style={{ height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, border: `1px dashed ${Z.zinc200}`, borderRadius: 8, background: `${Z.zinc50}50` }}>
                    <Layers style={{ width: 24, height: 24, color: Z.zinc300, marginBottom: 8 }} />
                    <span style={{ fontSize: 11, color: Z.zinc400, textAlign: 'center', lineHeight: 1.5 }}>
                      Empty canvas. Add elements from the <button onClick={() => setActiveTab('elements')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: Z.zinc700, textDecoration: 'underline', fontSize: 11, padding: 0 }}>Elements tab</button>.
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {formData.elements?.map((block: any, idx: number) => (
                    <div key={block.id || idx} style={{ padding: '10px 12px', border: `1px solid ${Z.zinc200}`, borderRadius: 8, background: Z.zinc50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <GripVertical style={{ width: 14, height: 14, color: Z.zinc300, flexShrink: 0, cursor: 'grab' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: Z.zinc500, fontFamily: 'monospace', marginBottom: 2 }}>
                            {block.type}
                          </div>
                          <div style={{ fontSize: 11, color: Z.zinc900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                            {block.content || '(block)'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                        <button onClick={() => moveBlock(idx, 'up')} style={{ width: 22, height: 22, border: 'none', background: 'none', cursor: 'pointer', color: Z.zinc500, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = Z.zinc200} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
                          <ArrowUp style={{ width: 13, height: 13 }} />
                        </button>
                        <button onClick={() => moveBlock(idx, 'down')} style={{ width: 22, height: 22, border: 'none', background: 'none', cursor: 'pointer', color: Z.zinc500, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = Z.zinc200} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
                          <ArrowDown style={{ width: 13, height: 13 }} />
                        </button>
                        <button onClick={() => removeBlock(idx)} style={{ width: 22, height: 22, border: 'none', background: 'none', cursor: 'pointer', color: Z.zinc400, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fee2e2'; (e.currentTarget as HTMLElement).style.color = '#dc2626'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = Z.zinc400; }}>
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Inline block content editors */}
                {formData.elements && formData.elements.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: Z.zinc400, fontFamily: 'monospace' }}>Block Editors</div>
                    {formData.elements.map((block: any, idx: number) => {
                      if (block.type === 'text' || block.type === 'button' || block.type === 'coupon') {
                        return (
                          <div key={block.id || idx} style={{ padding: '10px 12px', border: `1px solid ${Z.zinc200}`, borderRadius: 8, background: Z.white }}>
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: Z.zinc500, fontFamily: 'monospace', marginBottom: 6 }}>{block.type}</div>
                            <textarea value={block.content || ''} onChange={e => updateBlock(idx, { content: e.target.value })} rows={block.type === 'text' ? 2 : 1} placeholder={block.type === 'coupon' ? 'WELCOME10' : `${block.type} content…`} style={{ ...inputS, resize: 'none' }} {...iFocus} />
                          </div>
                        );
                      }
                      if (block.type === 'image') {
                        return (
                          <div key={block.id || idx} style={{ padding: '10px 12px', border: `1px solid ${Z.zinc200}`, borderRadius: 8, background: Z.white }}>
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: Z.zinc500, fontFamily: 'monospace', marginBottom: 6 }}>Image URL</div>
                            <input type="text" value={block.content || ''} onChange={e => updateBlock(idx, { content: e.target.value })} placeholder="https://…" style={inputS} {...iFocus} />
                          </div>
                        );
                      }
                      if (block.type === 'form') {
                        return (
                          <div key={block.id || idx} style={{ padding: '10px 12px', border: `1px solid ${Z.zinc200}`, borderRadius: 8, background: Z.white, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: Z.zinc500, fontFamily: 'monospace' }}>Form block</div>
                            <div><Label>Fields</Label>
                              <select value={block.props?.fields || 'email'} onChange={e => updateBlock(idx, { props: { ...block.props, fields: e.target.value } })} style={inputS} {...iFocus}>
                                <option value="email">Email only</option>
                                <option value="name_email">Name + Email</option>
                                <option value="phone">Phone only</option>
                                <option value="phone_email">Phone + Email</option>
                              </select>
                            </div>
                            <div><Label>Button label</Label>
                              <input type="text" value={block.content || ''} onChange={e => updateBlock(idx, { content: e.target.value })} placeholder="Subscribe" style={inputS} {...iFocus} />
                            </div>
                          </div>
                        );
                      }
                      if (block.type === 'timer') {
                        return (
                          <div key={block.id || idx} style={{ padding: '10px 12px', border: `1px solid ${Z.zinc200}`, borderRadius: 8, background: Z.white, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: Z.zinc500, fontFamily: 'monospace' }}>Countdown</div>
                            <div><Label>Duration (minutes)</Label>
                              <input type="number" min={1} value={block.props?.minutes || 15} onChange={e => updateBlock(idx, { props: { ...block.props, minutes: Math.max(1, Number(e.target.value) || 15) } })} style={inputS} {...iFocus} />
                            </div>
                          </div>
                        );
                      }
                      if (block.type === 'scratch_card') {
                        return (
                          <div key={block.id || idx} style={{ padding: '10px 12px', border: `1px solid ${Z.zinc200}`, borderRadius: 8, background: Z.white, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: Z.zinc500, fontFamily: 'monospace' }}>Scratch Card</div>
                            {[{ key: 'prizeCode', label: 'Coupon code', ph: 'WELCOME50' }, { key: 'prizeLabel', label: 'Prize label', ph: '50% OFF' }, { key: 'overlayText', label: 'Scratch text', ph: 'Scratch to Reveal' }].map(({ key, label, ph }) => (
                              <div key={key}><Label>{label}</Label><input type="text" value={block.props?.[key] || ''} onChange={e => updateBlock(idx, { props: { ...block.props, [key]: e.target.value } })} placeholder={ph} style={inputS} {...iFocus} /></div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}

                {/* Multi-state flow */}
                <Divider />
                <SectionTitle>Multi-State Flow</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div><Label>Teaser headline</Label><input type="text" value={formData.teaserHeadline || ''} onChange={e => setFormData(p => ({ ...p, teaserHeadline: e.target.value }))} placeholder="⚡ Click here!" style={inputS} {...iFocus} /></div>
                  <div><Label>Teaser position</Label>
                    <select value={formData.teaserPosition || 'bottom-right'} onChange={e => setFormData(p => ({ ...p, teaserPosition: e.target.value as any }))} style={inputS} {...iFocus}>
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                    </select>
                  </div>
                  <div><Label>Success headline</Label><input type="text" value={formData.successHeadline || ''} onChange={e => setFormData(p => ({ ...p, successHeadline: e.target.value }))} placeholder="Thank you!" style={inputS} {...iFocus} /></div>
                  <div><Label>Success body</Label><textarea value={formData.successBody || ''} onChange={e => setFormData(p => ({ ...p, successBody: e.target.value }))} placeholder="Check your inbox." rows={2} style={{ ...inputS, resize: 'none' }} {...iFocus} /></div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
