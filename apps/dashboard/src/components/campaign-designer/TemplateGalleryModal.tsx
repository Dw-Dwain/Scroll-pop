import React from 'react';
import { X, Search, FilePlus2 } from 'lucide-react';
import { Campaign } from './types';
import { PREBUILT_TEMPLATES } from './data/templates';
import { TemplateCard } from './TemplateCard';

const LIKES_KEY = '_sp_template_likes';

/**
 * Full-screen template gallery — a wide modal showing every preset as a thumbnail grid (3–4 across),
 * with a category filter + search. Replaces the old cramped vertical list in the designer sidebar.
 * Self-contained: owns its category/search/likes state. Picking a template calls onPick(tpl).
 */
export function TemplateGalleryModal({
  open, onClose, onPick, onBlank, activeId,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (tpl: Campaign) => void;
  onBlank?: () => void;
  activeId?: string;
}) {
  const [cat, setCat] = React.useState('All');
  const [query, setQuery] = React.useState('');
  const [likedIds, setLikedIds] = React.useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LIKES_KEY) || '[]') as string[]); } catch { return new Set(); }
  });

  const toggleLike = (id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(LIKES_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  // Categories present in the data, 'All' first.
  const categories = React.useMemo(() => {
    const seen: string[] = [];
    for (const t of PREBUILT_TEMPLATES) if (t.category && !seen.includes(t.category)) seen.push(t.category);
    return ['All', ...seen];
  }, []);

  const templates = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = PREBUILT_TEMPLATES
      .filter((t) => cat === 'All' || t.category === cat)
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    // Stable: liked first, otherwise original order.
    return base
      .map((t, i) => ({ t, i }))
      .sort((a, b) => (likedIds.has(b.t.id) ? 1 : 0) - (likedIds.has(a.t.id) ? 1 : 0) || a.i - b.i)
      .map((x) => x.t);
  }, [cat, query, likedIds]);

  // Close on Escape.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 1080, width: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', padding: 0 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Choose a template</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>Pick a starting design — you can customize everything after.</p>
          </div>
          <button className="btn btn-icon" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>

        {/* Category chips + search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 200 }}>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${cat === c ? 'var(--accent-500)' : 'var(--border-subtle)'}`,
                  background: cat === c ? 'var(--accent-500)' : 'var(--bg-raised)',
                  color: cat === c ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 120ms',
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              style={{ paddingLeft: 28, width: 220, fontSize: 12 }}
            />
          </div>
        </div>

        {/* Grid */}
        <div className="custom-scrollbar" style={{ overflowY: 'auto', padding: 22, flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {/* Blank canvas */}
            {onBlank && (
              <button
                onClick={() => { onBlank(); onClose(); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  minHeight: 150, borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)',
                  border: '1px dashed var(--border-default)', background: 'var(--bg-raised)', transition: 'all 120ms',
                }}
                title="Start from a blank canvas"
              >
                <FilePlus2 size={22} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Blank canvas</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Start from scratch</span>
              </button>
            )}

            {templates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                tpl={tpl}
                isActive={tpl.id === activeId}
                liked={likedIds.has(tpl.id)}
                onSelect={(t) => { onPick(t); onClose(); }}
                onToggleLike={toggleLike}
              />
            ))}

            {templates.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '32px 0' }}>
                No templates match “{query}”.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
