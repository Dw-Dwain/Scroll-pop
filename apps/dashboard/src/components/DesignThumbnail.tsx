import React from 'react';

// Shared design preview renderer. Extracted from Campaigns.tsx so the Experiments page can render
// the SAME visual the campaign cards use — a real, to-scale picture of a popup's saved design
// config — rather than re-implementing it (or, worse, only showing weights). One renderer, one
// source of truth for "what this popup actually looks like".

export type StepConfig = {
  id?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
  borderRadius?: number;
  elements?: Array<{
    id: string; x?: number; y?: number; w?: number; h?: number; zIndex?: number; type?: string;
    content?: string; color?: string; fontSize?: number; fontFamily?: string; align?: string;
    backgroundColor?: string; borderRadius?: number; borderWidth?: number; borderColor?: string;
    padding?: number; extraProps?: { placeholder?: string }; opacity?: number;
  }>;
};

/** Schematic fallback shown when a design has no `steps` config yet (keyed off the popup kind). */
export function PopupPreview({ kind }: { kind: string }) {
  const palette: Record<string, { bg: string; accent: string }> = {
    modal:      { bg: '#f5f3ff', accent: '#6366f1' },
    bar:        { bg: '#f0fdf4', accent: '#22c55e' },
    banner:     { bg: '#fff7ed', accent: '#f59e0b' },
    fullscreen: { bg: '#fdf4ff', accent: '#a855f7' },
    floating:   { bg: '#eff6ff', accent: '#3b82f6' },
    spin_wheel: { bg: '#fdf2ff', accent: '#8b5cf6' },
  };
  const { bg, accent } = palette[kind] ?? { bg: '#f4f4f5', accent: '#6366f1' };

  return (
    <div style={{ height: 130, background: bg, borderRadius: '8px 8px 0 0', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 5, pointerEvents: 'none' }}>
        <div style={{ height: 5, background: 'rgba(0,0,0,0.08)', borderRadius: 3, width: '65%' }} />
        <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 3, width: '45%' }} />
        <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 3, width: '55%' }} />
        <div style={{ height: 4, background: 'rgba(0,0,0,0.05)', borderRadius: 3, width: '40%', marginTop: 2 }} />
      </div>
      {kind === 'bar' ? (
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, height: 22, background: accent, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 8, color: '#fff', fontWeight: 700, letterSpacing: '0.06em', fontFamily: 'monospace' }}>ANNOUNCEMENT BAR</span>
        </div>
      ) : kind === 'floating' ? (
        <div style={{ position: 'absolute', bottom: 14, right: 14, width: 56, height: 30, background: accent, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.18)' }}>
          <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>⚡ offer</span>
        </div>
      ) : kind === 'fullscreen' ? (
        <div style={{ position: 'absolute', inset: 6, background: accent, borderRadius: 4, opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 9, color: '#fff', fontWeight: 700, letterSpacing: '0.04em' }}>FULLSCREEN</span>
        </div>
      ) : kind === 'spin_wheel' ? (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
          <svg width="70" height="70" viewBox="0 0 70 70">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const colors = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#6d28d9', '#ddd6fe'];
              const slice = (Math.PI * 2) / 6;
              const start = i * slice - Math.PI / 2;
              const end = start + slice;
              const r = 32, cx = 35, cy = 35;
              const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
              const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
              return (
                <g key={i}>
                  <path d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`} fill={colors[i]} stroke="#fff" strokeWidth="1.5" />
                  <text x={cx + (r * 0.62) * Math.cos(start + slice / 2)} y={cy + (r * 0.62) * Math.sin(start + slice / 2)} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="6" fontWeight="bold">
                    {['10%', 'Free', '20%', '5%', 'Ship', '15%'][i]}
                  </text>
                </g>
              );
            })}
            <circle cx="35" cy="35" r="5" fill="#fff" />
            <polygon points="35,1 32,9 38,9" fill="#f59e0b" />
          </svg>
          <div style={{ textAlign: 'center', fontSize: 8, fontWeight: 700, color: accent, marginTop: 2, letterSpacing: '0.04em' }}>SPIN TO WIN</div>
        </div>
      ) : (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 88, height: 62, background: '#fff', borderRadius: 7, boxShadow: '0 4px 20px rgba(0,0,0,0.14)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 9, background: accent }} />
          <div style={{ flex: 1, padding: '5px 7px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ height: 3, background: '#e5e7eb', borderRadius: 1, width: '80%' }} />
            <div style={{ height: 3, background: '#f3f4f6', borderRadius: 1, width: '60%' }} />
            <div style={{ height: 7, background: accent, borderRadius: 3, marginTop: 4, opacity: 0.9 }} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Renders a popup design `config` to a to-scale visual thumbnail. Falls back to a schematic
 * `PopupPreview` when the design has no `steps`. `height`/`showStatus`/`radius` let callers tune
 * it for cards (Campaigns) vs. compact A/B preview tiles (Experiments).
 */
export function DesignThumbnail({
  config, status, kind, height = 130, showStatus = true, radius = '8px 8px 0 0',
}: {
  config: Record<string, unknown>; status?: string; kind?: string;
  height?: number; showStatus?: boolean; radius?: string;
}) {
  const mainStep = Array.isArray(config?.['steps'])
    ? (config['steps'] as StepConfig[]).find((s) => s.id === 'main')
    : (config?.['steps'] as Record<string, StepConfig> | undefined)?.['main'];

  if (!mainStep) {
    return <PopupPreview kind={kind ?? 'modal'} />;
  }

  const containerW = 280;
  const availW = containerW - 40;
  const availH = height - 40;
  const scaleX = availW / (mainStep.width ?? 300);
  const scaleY = availH / (mainStep.height ?? 200);
  const scale = Math.min(scaleX, scaleY, 1);

  return (
    <div style={{ height, background: 'var(--bg-raised)', borderRadius: radius, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.3, backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 0)', backgroundSize: '12px 12px' }} />
      <div style={{
        width: mainStep.width, height: mainStep.height,
        backgroundColor: mainStep.backgroundColor || '#ffffff',
        borderRadius: mainStep.borderRadius || 0,
        position: 'relative', transform: `scale(${scale})`, transformOrigin: 'center center',
        flexShrink: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 1,
      }}>
        {mainStep.elements?.map((el) => (
          <div key={el.id} style={{ position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`, zIndex: el.zIndex }}>
            {el.type === 'heading' && (
              <h2 style={{ width: '100%', height: '100%', margin: 0, color: el.color, fontSize: `${el.fontSize || 22}px`, fontFamily: el.fontFamily, textAlign: (el.align || 'center') as React.CSSProperties['textAlign'], display: 'flex', alignItems: 'center', justifyContent: 'center', wordBreak: 'break-word', fontWeight: 800 }}>
                {el.content}
              </h2>
            )}
            {el.type === 'text' && (
              <p style={{ width: '100%', height: '100%', margin: 0, color: el.color, fontSize: `${el.fontSize || 12}px`, fontFamily: el.fontFamily, textAlign: (el.align || 'left') as React.CSSProperties['textAlign'], backgroundColor: el.backgroundColor || 'transparent', borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined, borderWidth: el.borderWidth ? `${el.borderWidth}px` : undefined, borderColor: el.borderColor, padding: el.padding ? `${el.padding}px` : undefined }}>
                {el.content}
              </p>
            )}
            {el.type === 'button' && (
              <button style={{ width: '100%', height: '100%', border: 'none', backgroundColor: el.backgroundColor || '#000000', color: el.color || '#FFFFFF', borderRadius: `${el.borderRadius ?? 8}px`, fontSize: `${el.fontSize || 11}px`, fontFamily: el.fontFamily, fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {el.content}
              </button>
            )}
            {el.type === 'input' && (
              <input readOnly placeholder={el.extraProps?.placeholder || 'Email...'} style={{ width: '100%', height: '100%', border: '1px solid #e4e4e7', backgroundColor: '#fff', borderRadius: `${el.borderRadius ?? 8}px`, fontSize: '12px', padding: '0 8px', pointerEvents: 'none' }} />
            )}
            {el.type === 'shape' && el.content === 'wheel' && (
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '3px solid #18181b', background: 'conic-gradient(#09090b 0 51deg, #18181b 51deg 102deg, #27272a 102deg 153deg, #3f3f46 153deg 204deg, #52525b 204deg 255deg, #71717a 255deg 306deg, #e4e4e7 306deg 360deg)' }} />
            )}
            {el.type === 'image' && el.content && (
              <img src={el.content} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined }} />
            )}
          </div>
        ))}
      </div>

      {showStatus && status && (
        <div style={{
          position: 'absolute', top: 8, left: 8, padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 600,
          fontFamily: 'monospace', letterSpacing: '0.05em', textTransform: 'uppercase',
          background: status === 'active' ? 'rgba(34,197,94,0.12)' : status === 'paused' ? 'rgba(245,158,11,0.12)' : 'rgba(113,113,122,0.1)',
          color: status === 'active' ? '#16a34a' : status === 'paused' ? '#d97706' : '#71717a',
          border: `1px solid ${status === 'active' ? 'rgba(34,197,94,0.2)' : status === 'paused' ? 'rgba(245,158,11,0.2)' : 'rgba(113,113,122,0.2)'}`,
          zIndex: 10,
        }}>
          {status ?? 'draft'}
        </div>
      )}
    </div>
  );
}
