import React from 'react';
import { Heart, Copy, ArrowRight, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { TemplatePreset } from '../../types/campaign';

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
  { id: 'all',              label: 'All' },
  { id: 'modal',            label: 'Modal' },
  { id: 'fullscreen',       label: 'Fullscreen' },
  { id: 'slide_in',         label: 'Slide-in' },
  { id: 'bar',              label: 'Bar' },
  { id: 'floating_bubble',  label: 'Bubble' },
  { id: 'gamified_overlay', label: 'Gamified' },
] as const;

const CATEGORIES = ['All', 'Lead Capture', 'Ecommerce', 'Sales', 'SaaS', 'Webinar', 'Survey', 'Holiday', 'Gamified'];

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
  const [activeCategory, setActiveCategory] = React.useState('All');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 18;

  const visibleTemplates = React.useMemo(() =>
    templates.filter(t => {
      const matchKind = activeKind === 'all' || t.kind === activeKind;
      const matchCat = activeCategory === 'All' || t.category === activeCategory;
      const matchSearch = !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchKind && matchCat && matchSearch;
    }),
    [templates, activeKind, activeCategory, searchQuery]
  );

  React.useEffect(() => { setCurrentPage(1); }, [activeCategory, activeKind, searchQuery]);

  const totalPages = Math.ceil(visibleTemplates.length / itemsPerPage);

  const paginatedTemplates = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return visibleTemplates.slice(start, start + itemsPerPage);
  }, [visibleTemplates, currentPage]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Template Library
          </h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
            {visibleTemplates.length} templates
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Choose a starting point — every template is fully editable in the builder.
        </p>
      </div>

      {/* ── Search + type filters ────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 220px' }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input"
            style={{ paddingLeft: 28, width: '100%', height: 32, fontSize: 12 }}
            placeholder="Search templates…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {TYPE_FILTERS.map(({ id, label }) => {
            const active = activeKind === id;
            return (
              <button
                key={id}
                onClick={() => { setActiveKind(id as any); if (id !== 'all' && onTypeChange) onTypeChange(id); }}
                style={{
                  height: 30, padding: '0 10px', borderRadius: 5, fontSize: 11, fontWeight: 500,
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
                  border: active ? '1px solid var(--border-default)' : '1px solid transparent',
                  background: active ? 'var(--bg-raised)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Category pills ───────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {CATEGORIES.map(c => {
          const active = activeCategory === c;
          return (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 10,
                fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', fontWeight: 500,
                border: 'none',
                background: active ? 'var(--text-primary)' : 'var(--bg-raised)',
                color: active ? 'var(--bg-base)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* ── Template grid ────────────────────────────────────────── */}
      {visibleTemplates.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)', border: '1px dashed var(--border-subtle)',
          borderRadius: 8, padding: '48px 24px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>No templates match your filters.</p>
          <button
            onClick={() => { setActiveCategory('All'); setActiveKind('all'); setSearchQuery(''); }}
            style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {paginatedTemplates.map(tmpl => {
              const isFav = favorites.includes(tmpl.id);
              const isHovered = hoveredId === tmpl.id;

              return (
                <div
                  key={tmpl.id}
                  onMouseEnter={() => setHoveredId(tmpl.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => applyTemplate(tmpl)}
                  style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${isHovered ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                    borderRadius: 8, overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxShadow: isHovered ? '0 4px 20px rgba(0,0,0,0.18)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {/* ── Thumbnail ── */}
                  <div style={{
                    position: 'relative', aspectRatio: '16/9', overflow: 'hidden',
                    background: tmpl.colors?.bg || 'var(--bg-raised)', flexShrink: 0,
                  }}>
                    {tmpl.thumbnail ? (
                      <img
                        src={tmpl.thumbnail}
                        alt={tmpl.name}
                        loading="lazy"
                        style={{
                          position: 'absolute', inset: 0, width: '100%', height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.35s ease',
                          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                        }}
                      />
                    ) : (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: `linear-gradient(135deg, ${tmpl.colors?.bg || '#18181b'} 0%, ${tmpl.colors?.accent || '#6366f1'}30 100%)`,
                      }} />
                    )}

                    {/* Kind badge */}
                    <span style={{
                      position: 'absolute', top: 8, left: 8, zIndex: 2,
                      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                      padding: '2px 6px', borderRadius: 3,
                      background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.9)',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      backdropFilter: 'blur(4px)',
                    }}>
                      {tmpl.kind.replace(/_/g, ' ')}
                    </span>

                    {/* Fav + clone — fade in on hover */}
                    <div style={{
                      position: 'absolute', top: 6, right: 6, zIndex: 4,
                      display: 'flex', gap: 3,
                      opacity: isHovered ? 1 : 0,
                      transition: 'opacity 0.15s',
                    }}>
                      <button
                        onClick={e => { e.stopPropagation(); setFavorites(prev => isFav ? prev.filter(id => id !== tmpl.id) : [...prev, tmpl.id]); }}
                        style={{
                          width: 26, height: 26, borderRadius: 5, border: 'none',
                          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                          color: isFav ? '#ef4444' : '#fff', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Heart size={12} fill={isFav ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); cloneTemplate(tmpl); }}
                        style={{
                          width: 26, height: 26, borderRadius: 5, border: 'none',
                          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                          color: '#fff', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Copy size={12} />
                      </button>
                    </div>

                    {/* Hover CTA overlay */}
                    <div style={{
                      position: 'absolute', inset: 0, zIndex: 3,
                      background: 'rgba(9,9,11,0.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: isHovered ? 1 : 0,
                      transition: 'opacity 0.18s',
                      backdropFilter: isHovered ? 'blur(2px)' : 'none',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: '#ffffff', color: '#09090b',
                        fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em',
                        padding: '8px 16px', borderRadius: 6,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
                      }}>
                        Use Template
                        <ArrowRight size={13} />
                      </div>
                    </div>
                  </div>

                  {/* ── Card footer ── */}
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      letterSpacing: '-0.01em',
                    }}>
                      {tmpl.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                        {tmpl.category}
                      </span>
                      {tmpl.tags.slice(0, 1).map(tag => (
                        <span key={tag} style={{
                          fontSize: 9, padding: '1px 5px', borderRadius: 3,
                          background: 'var(--bg-raised)', color: 'var(--text-disabled)',
                          fontFamily: 'var(--font-mono)', textTransform: 'lowercase', letterSpacing: '0.02em',
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: 16, borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 12,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, visibleTemplates.length)} of {visibleTemplates.length}
              </span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.4 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-primary)',
                  }}
                >
                  <ChevronLeft size={14} />
                </button>
                {(() => {
                  const pages: React.ReactNode[] = [];
                  let lastEllipsis = false;
                  for (let p = 1; p <= totalPages; p++) {
                    if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) {
                      lastEllipsis = false;
                      pages.push(
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          style={{
                            width: 28, height: 28, borderRadius: 5, fontSize: 11, fontWeight: 600,
                            border: currentPage === p ? '1px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                            background: currentPage === p ? 'var(--text-primary)' : 'var(--bg-surface)',
                            color: currentPage === p ? 'var(--bg-base)' : 'var(--text-muted)',
                            cursor: 'pointer', transition: 'all 0.12s',
                          }}
                        >
                          {p}
                        </button>
                      );
                    } else if (!lastEllipsis) {
                      lastEllipsis = true;
                      pages.push(
                        <span key={`ell-${p}`} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '0 2px' }}>…</span>
                      );
                    }
                  }
                  return pages;
                })()}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.4 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-primary)',
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
