import React from 'react';
import { Heart, Copy, Search, ArrowRight, X, RotateCcw } from 'lucide-react';
import { TemplatePreset } from '../../types/campaign';
import type { FormDataShape } from '../../types/campaign';

interface TemplateSelectorProps {
  templates: TemplatePreset[];
  customTemplates: TemplatePreset[];
  favorites: string[];
  setFavorites: React.Dispatch<React.SetStateAction<string[]>>;
  cloneTemplate: (template: TemplatePreset) => void;
  applyTemplate: (template: TemplatePreset) => void;
  activeKind: TemplatePreset['kind'] | 'all';
  setActiveKind: React.Dispatch<React.SetStateAction<TemplatePreset['kind'] | 'all'>>;
  onTypeChange?: (kind: string) => void;
}

const TYPE_FILTERS = [
  { id: 'all',              label: 'All Types' },
  { id: 'modal',            label: 'Modal' },
  { id: 'fullscreen',       label: 'Fullscreen' },
  { id: 'slide_in',         label: 'Slide-in' },
  { id: 'bar',              label: 'Bar' },
  { id: 'floating_bubble',  label: 'Bubble' },
  { id: 'gamified_overlay', label: 'Gamified' },
] as const;

const CATEGORIES = ['All', 'Lead Capture', 'Ecommerce', 'Sales', 'SaaS', 'Webinar', 'Survey', 'Holiday', 'Gamified'];

const templateToFormData = (tmpl: TemplatePreset): FormDataShape => ({
  siteId: '', name: tmpl.name, kind: tmpl.kind,
  headline: (tmpl.fields as any)?.headline ?? 'Special Limited Offer',
  subheadline: (tmpl.fields as any)?.subheadline ?? '',
  bodyText: (tmpl.fields as any)?.bodyText ?? '',
  backgroundColor: tmpl.colors.bg, textColor: tmpl.colors.text, accentColor: tmpl.colors.accent,
  borderRadius: 12, ctaText: (tmpl.fields as any)?.ctaText ?? 'Claim Offer', ctaStyle: 'button',
  showCloseButton: true, closeButtonPosition: 'top-right', showDismissText: false, dismissText: 'No thanks',
  overlayEnabled: true, overlayOpacity: 0.5, animation: 'slide_up', position: 'center', size: 'md',
  showPoweredBy: true, triggerType: 'scroll_pct', triggerParams: { pct: 45, seconds: 20 },
  frequency: 'once_per_session', productName: '', productUrl: '',
  imageUrl: (tmpl.fields as any)?.imageUrl ?? '',
});

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  templates,
  favorites,
  setFavorites,
  cloneTemplate,
  applyTemplate,
  activeKind,
  setActiveKind,
  onTypeChange,
}) => {
  const [activeCategory, setActiveCategory] = React.useState<string>('All');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [flippedId, setFlippedId] = React.useState<string | null>(null);

  const visibleTemplates = React.useMemo(() =>
    templates.filter((t) => {
      const matchKind = activeKind === 'all' || t.kind === activeKind;
      const matchCategory = activeCategory === 'All' || t.category === activeCategory;
      const matchSearch = !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchKind && matchCategory && matchSearch;
    }),
    [templates, activeKind, activeCategory, searchQuery]
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Template Marketplace</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Choose a starting point — every template is fully editable in the builder.
        </p>
      </div>

      {/* Search + type filter row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '0 0 240px' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 30, width: '100%' }}
            placeholder="Search templates…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TYPE_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => {
                setActiveKind(id as any);
                if (id !== 'all' && onTypeChange) onTypeChange(id);
              }}
              style={{
                padding: '5px 12px', borderRadius: 4, fontSize: 12, fontWeight: 500,
                border: activeKind === id ? '1px solid var(--accent-500)' : '1px solid var(--border-subtle)',
                background: activeKind === id ? 'rgba(99,102,241,0.1)' : 'var(--bg-raised)',
                color: activeKind === id ? 'var(--accent-300)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            style={{
              padding: '3px 10px', borderRadius: 3, fontSize: 11, fontWeight: 500,
              border: activeCategory === c ? '1px solid var(--border-default)' : '1px solid transparent',
              background: activeCategory === c ? 'var(--bg-raised)' : 'transparent',
              color: activeCategory === c ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Count */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        {visibleTemplates.length} template{visibleTemplates.length !== 1 ? 's' : ''}
      </div>

      {visibleTemplates.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)', border: '1px dashed var(--border-subtle)',
          borderRadius: 8, padding: '48px 24px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>No templates match your filters.</p>
          <button
            onClick={() => { setActiveCategory('All'); setActiveKind('all'); setSearchQuery(''); }}
            style={{ fontSize: 12, color: 'var(--accent-300)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
        }}>
          {visibleTemplates.map((tmpl) => {
            const isFav = favorites.includes(tmpl.id);
            const isHovered = hoveredId === tmpl.id;
            const isFlipped = flippedId === tmpl.id;
            const hasAnyFlipped = flippedId !== null;
            const fd = templateToFormData(tmpl);

            return (
              <div
                key={tmpl.id}
                style={{
                  perspective: '1200px',
                  position: 'relative',
                  zIndex: isFlipped ? 50 : 1,
                  transform: isFlipped ? 'scale(1.35)' : 'scale(1)',
                  transformOrigin: 'top center',
                  transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), z-index 0s',
                  opacity: hasAnyFlipped && !isFlipped ? 0.35 : 1,
                  pointerEvents: hasAnyFlipped && !isFlipped ? 'none' : undefined,
                }}
              >
                <div
                  style={{
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.4s ease',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    position: 'relative',
                  }}
                >
                  {/* ── FRONT FACE ── */}
                  <div
                    onMouseEnter={() => setHoveredId(tmpl.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      backfaceVisibility: 'hidden',
                      background: 'var(--bg-surface)',
                      border: `1px solid ${isHovered ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                      borderRadius: 8, overflow: 'hidden',
                      display: 'flex', flexDirection: 'column',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    {/* Thumbnail */}
                    <div style={{ position: 'relative', height: 160, background: 'var(--bg-raised)', overflow: 'hidden', flexShrink: 0 }}>
                      <img
                        loading="lazy"
                        decoding="async"
                        src={tmpl.thumbnail}
                        alt={tmpl.name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 12 }}
                      />
                      <span style={{
                        position: 'absolute', top: 8, left: 8,
                        fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                        background: 'var(--bg-overlay)', color: 'var(--text-secondary)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {tmpl.kind.replace(/_/g, ' ')}
                      </span>
                      {/* Hover overlay */}
                      {isHovered && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'rgba(9,9,11,0.75)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}>
                          <button
                            onClick={() => applyTemplate(tmpl)}
                            className="btn btn-primary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}
                          >
                            Use Template
                            <ArrowRight size={13} />
                          </button>
                          <button
                            onClick={() => setFlippedId(tmpl.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}
                          >
                            Preview
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Card body */}
                    <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {tmpl.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {tmpl.category}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          <button
                            onClick={() => setFavorites((prev) => isFav ? prev.filter((id) => id !== tmpl.id) : [...prev, tmpl.id])}
                            style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4, color: isFav ? 'var(--status-error)' : 'var(--text-muted)' }}
                            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Heart size={13} fill={isFav ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            onClick={() => cloneTemplate(tmpl)}
                            style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4, color: 'var(--text-muted)' }}
                            title="Duplicate"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>
                      {tmpl.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                          {tmpl.tags.slice(0, 3).map((tag) => (
                            <span key={tag} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── BACK FACE ── */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      position: 'absolute',
                      inset: 0,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--accent-500)',
                      borderRadius: 8,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* Back header */}
                    <div style={{
                      padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                    }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>{tmpl.name}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{tmpl.kind.replace(/_/g, ' ')} · {tmpl.category}</div>
                      </div>
                      <button
                        onClick={() => setFlippedId(null)}
                        style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 4, display: 'flex' }}
                      >
                        <RotateCcw size={12} />
                      </button>
                    </div>

                    {/* Compact preview viewport */}
                    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#1a1a2e', minHeight: 0 }}>
                      <CompactPreview formData={fd} />
                    </div>

                    {/* Back footer */}
                    <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => { applyTemplate(tmpl); setFlippedId(null); }}
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 11 }}
                      >
                        Use Template <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Click-away to unflip */}
      {flippedId && (
        <div
          onClick={() => setFlippedId(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
        />
      )}
    </div>
  );
};

function CompactPreview({ formData }: { formData: FormDataShape }) {
  const kind = formData.kind ?? 'modal';
  const pos  = formData.position ?? 'center';
  const accent = formData.accentColor ?? '#6366f1';

  const posStyle = (): React.CSSProperties => {
    if (kind === 'bar')          return { top: pos === 'bottom' ? 'auto' : 0, bottom: pos === 'bottom' ? 0 : 'auto', left: 0, right: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'stretch' };
    if (pos === 'bottom-right')  return { bottom: 8, right: 8, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' };
    if (pos === 'bottom-left')   return { bottom: 8, left: 8, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start' };
    return { inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  };

  const overlayActive = formData.overlayEnabled && (kind === 'modal' || kind === 'fullscreen');

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Fake page */}
      <div style={{ position: 'absolute', inset: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5, opacity: 0.15 }}>
        <div style={{ height: 6, background: '#fff', borderRadius: 2, width: '55%' }} />
        <div style={{ height: 5, background: '#fff', borderRadius: 2, width: '35%' }} />
        <div style={{ height: 44, background: '#fff', borderRadius: 3, marginTop: 2 }} />
        <div style={{ height: 5, background: '#fff', borderRadius: 2, width: '70%' }} />
        <div style={{ height: 5, background: '#fff', borderRadius: 2, width: '45%' }} />
        <div style={{ height: 5, background: '#fff', borderRadius: 2, width: '55%' }} />
      </div>

      {overlayActive && <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${formData.overlayOpacity ?? 0.5})`, zIndex: 10 }} />}

      {/* Popup */}
      <div style={{ position: 'absolute', zIndex: 20, ...posStyle() }}>
        {kind === 'floating_bubble' ? (
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>💬</div>
        ) : kind === 'gamified_overlay' ? (
          <GamifiedCompact accent={accent} />
        ) : (
          <div style={{
            width: kind === 'bar' ? '100%' : kind === 'fullscreen' ? '100%' : 130,
            backgroundColor: formData.backgroundColor ?? '#fff',
            color: formData.textColor ?? '#111',
            borderRadius: kind === 'bar' ? 0 : 8,
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            {formData.imageUrl && kind !== 'bar' && (
              <img src={formData.imageUrl} alt="" style={{ width: '100%', height: 40, objectFit: 'cover', display: 'block' }} />
            )}
            <div style={{ padding: kind === 'bar' ? '5px 10px' : '8px 10px', display: 'flex', flexDirection: kind === 'bar' ? 'row' : 'column', alignItems: kind === 'bar' ? 'center' : 'flex-start', gap: kind === 'bar' ? 8 : 3 }}>
              <div style={{ flex: 1 }}>
                {formData.headline && <div style={{ fontWeight: 700, fontSize: 8.5, lineHeight: 1.3 }}>{formData.headline}</div>}
                {formData.subheadline && kind !== 'bar' && <div style={{ fontSize: 7.5, opacity: 0.7, marginBottom: 2 }}>{formData.subheadline}</div>}
              </div>
              <button style={{ padding: kind === 'bar' ? '3px 7px' : '4px 8px', background: accent, color: '#fff', border: 'none', borderRadius: 4, fontSize: 7.5, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {formData.ctaText || 'Claim Offer'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Kind label */}
      <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 8, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {kind.replace(/_/g, ' ')}
      </div>
    </div>
  );
}

function GamifiedCompact({ accent }: { accent: string }) {
  const n = 8;
  const colors = [accent, '#f59e0b', accent, '#22c55e', accent, '#ec4899', accent, '#f59e0b'];
  const prizes = ['20%', 'FREE', '10%', 'SPIN', '30%', 'GIFT', '15%', 'BONUS'];
  const size = 72, cx = size / 2, cy = size / 2, r = size / 2 - 2;
  const step = (2 * Math.PI) / n;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size}>
        {Array.from({ length: n }, (_, i) => {
          const a0 = i * step - Math.PI / 2, a1 = a0 + step;
          const x1 = cx + r * Math.cos(a0), y1 = cy + r * Math.sin(a0);
          const x2 = cx + r * Math.cos(a1), y2 = cy + r * Math.sin(a1);
          const tm = a0 + step / 2;
          const tx = cx + r * 0.65 * Math.cos(tm), ty = cy + r * 0.65 * Math.sin(tm);
          return (
            <g key={i}>
              <path d={`M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 0,1 ${x2},${y2} Z`} fill={colors[i]} stroke="#111" strokeWidth={0.5} />
              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize={4} fill="#fff" fontWeight="700" transform={`rotate(${(i * 360 / n) + 180 / n}, ${tx}, ${ty})`}>{prizes[i]}</text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={7} fill="#111" stroke="#333" strokeWidth={0.5} />
      </svg>
      <div style={{ background: accent, color: '#fff', fontSize: 7, fontWeight: 700, padding: '2px 8px', borderRadius: 3 }}>SPIN TO WIN</div>
    </div>
  );
}
