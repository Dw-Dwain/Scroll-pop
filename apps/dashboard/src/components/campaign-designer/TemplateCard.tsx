import { Heart } from 'lucide-react';
import { Campaign } from './types';

/**
 * One template/preset card — the thumbnail (creative hero image when the template has one, else a
 * mini popup mockup) + name + category + a "like" toggle. Extracted verbatim from SidebarLeft's old
 * vertical list so it can be reused in the TemplateGalleryModal grid (and anywhere else).
 */
export function TemplateCard({
  tpl, isActive = false, liked = false, onSelect, onToggleLike,
}: {
  tpl: Campaign;
  isActive?: boolean;
  liked?: boolean;
  onSelect: (tpl: Campaign) => void;
  onToggleLike?: (id: string) => void;
}) {
  const heroImg = tpl.steps.main.elements.find(
    (e) => e.type === 'image' && typeof e.content === 'string' && e.content.startsWith('http'),
  );

  return (
    <div
      onClick={() => onSelect(tpl)}
      className={`group relative overflow-hidden rounded-lg border transition-all duration-200 cursor-pointer ${
        isActive
          ? 'border-zinc-900 ring-1 ring-zinc-900 bg-zinc-50/20'
          : 'border-zinc-200 hover:border-zinc-400 bg-white'
      }`}
    >
      {/* Thumbnail — actual creative image when present, otherwise the mini mockup. */}
      {heroImg ? (
        <div className="relative aspect-video w-full overflow-hidden bg-zinc-100 flex items-center justify-center">
          <img
            src={heroImg.content}
            alt={tpl.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          <span className="absolute top-1 right-1 text-[6px] font-mono uppercase tracking-wider px-1 bg-black/40 text-white rounded">
            {tpl.steps.main.popupType}
          </span>
        </div>
      ) : (
        <div className="relative aspect-video w-full overflow-hidden bg-zinc-50 p-3 flex items-center justify-center transition-all">
          <div
            className="w-[90%] h-[90%] rounded shadow-xs border p-2 flex flex-col justify-between overflow-hidden relative"
            style={{
              backgroundColor: tpl.steps.main.backgroundColor,
              borderColor: tpl.steps.main.borderColor,
              borderWidth: tpl.steps.main.borderWidth || 1,
            }}
          >
            <div className="flex flex-col gap-0.5 w-full pointer-events-none">
              <span className="text-[8px] font-bold truncate" style={{ color: tpl.steps.main.elements.find((e) => e.type === 'heading')?.color || '#111827' }}>
                {tpl.steps.main.elements.find((e) => e.type === 'heading')?.content.substring(0, 24) || 'Exclusive Discount'}
              </span>
              <span className="text-[6px] line-clamp-1 leading-tight text-gray-500">
                {tpl.steps.main.elements.find((e) => e.type === 'text')?.content.substring(0, 48) || 'Sign up to redeem.'}
              </span>
            </div>
            <div className="w-full flex items-center gap-1 mt-1 pointer-events-none">
              <div className="flex-1 h-3 rounded-xs bg-white border border-gray-200 text-[5px] pl-1 pt-0.5 text-gray-300">
                email@com...
              </div>
              <div
                className="px-2 h-3 text-[5px] font-semibold text-white rounded-xs flex items-center justify-center truncate"
                style={{ backgroundColor: tpl.steps.main.elements.find((e) => e.type === 'button')?.backgroundColor || '#000000' }}
              >
                CLAIM
              </div>
            </div>
            <div className="absolute top-1 right-1 flex items-center gap-1 scale-75">
              <span className="text-[6px] font-mono uppercase tracking-wider px-1 bg-black/5 rounded text-gray-650 border border-black/10">
                {tpl.steps.main.popupType}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Info & like */}
      <div className="p-3 border-t border-zinc-200 bg-white text-left">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-zinc-900 group-hover:text-zinc-950 transition-colors truncate">
            {tpl.name}
          </h4>
          {onToggleLike && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleLike(tpl.id); }}
              title={liked ? 'Unlike' : 'Like — pins to the top'}
              aria-label={liked ? 'Unlike template' : 'Like template'}
              className="shrink-0 p-1 -m-1 rounded transition-colors"
            >
              <Heart
                className="h-3.5 w-3.5 transition-colors"
                style={{ color: liked ? '#ef4444' : '#a1a1aa', fill: liked ? '#ef4444' : 'none' }}
              />
            </button>
          )}
        </div>
        <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">
          {tpl.category.split(' ')[0]}
        </span>
      </div>

      {isActive && <div className="absolute inset-0 border border-zinc-950 rounded-lg pointer-events-none" />}
    </div>
  );
}
