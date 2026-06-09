import React from 'react';
import { Loader2, Check, ImageOff } from 'lucide-react';

// The non-editable "ScrollPop Creatives" library is served by the edge worker from R2 at
// /creatives (list) and /creatives/<name> (image). Same host the snippet pulls them from,
// so the URL we store here resolves identically on customer sites. CORS is "*" on the worker.
const CDN = (import.meta.env.VITE_CDN_URL as string | undefined)?.replace(/\/$/, '') || 'https://cdn.scrollpop.online';

const creativeUrl = (name: string) => `${CDN}/creatives/${name}`;

/**
 * Thumbnail grid for picking a ScrollPop Creative image. Clicking a tile writes its full URL
 * into the element's content. Hidden if the library is empty or unreachable (operator can
 * still paste a URL manually in the textarea above).
 */
export function CreativePicker({ value, onSelect }: { value: string; onSelect: (url: string) => void }) {
  const [names, setNames] = React.useState<string[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    fetch(`${CDN}/creatives`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { creatives?: string[] }) => { if (alive) setNames(d.creatives ?? []); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  if (failed) return null;

  return (
    <div className="space-y-2 pt-3 border-t border-zinc-200">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">
          ScrollPop Creatives
        </label>
        {names && <span className="text-[9px] text-zinc-400 font-mono">{names.length} available</span>}
      </div>

      {names === null ? (
        <div className="flex items-center gap-2 text-[11px] text-zinc-400 py-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading library…
        </div>
      ) : names.length === 0 ? (
        <div className="flex items-center gap-2 text-[11px] text-zinc-400 py-3">
          <ImageOff className="h-3.5 w-3.5" /> No creatives uploaded yet.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {names.map((name) => {
            const url = creativeUrl(name);
            const selected = value === url;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onSelect(url)}
                title={name}
                className={`relative aspect-square rounded-md overflow-hidden border bg-zinc-50 transition ${
                  selected ? 'border-zinc-900 ring-2 ring-zinc-900/20' : 'border-zinc-200 hover:border-zinc-400'
                }`}
              >
                <img src={url} alt={name} loading="lazy" className="w-full h-full object-cover" />
                {selected && (
                  <span className="absolute top-1 right-1 bg-zinc-900 text-white rounded-full p-0.5">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <div className="text-[9px] text-zinc-400 leading-relaxed">
        Click a creative to use it. These images are hosted by ScrollPop — perfect for affiliate ad cards.
      </div>
    </div>
  );
}
