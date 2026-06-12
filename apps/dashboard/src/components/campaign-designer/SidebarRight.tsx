import React from 'react';
import {
  Type,
  Paintbrush,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Layout,
  CornerDownRight,
} from 'lucide-react';
import { CampaignElement, CampaignStepConfig, PopupType, CanvasPosition } from './types';
import { CreativePicker } from './CreativePicker';

// Commit-on-blur number input — prevents mid-type clamping (e.g. typing "500" into "200" becoming "2005000")
function NumInput({
  value, min, max, onChange, className, disabled,
}: {
  value: number; min: number; max: number;
  onChange: (v: number) => void;
  className?: string; disabled?: boolean;
}) {
  const [local, setLocal] = React.useState(String(value));

  // Sync if external value changes (e.g. undo/redo)
  React.useEffect(() => { setLocal(String(value)); }, [value]);

  const commit = () => {
    const parsed = parseInt(local, 10);
    const clamped = isNaN(parsed) ? min : Math.min(max, Math.max(min, parsed));
    setLocal(String(clamped));
    onChange(clamped);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled}
      value={local}
      onChange={(e) => setLocal(e.target.value.replace(/[^0-9]/g, ''))}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur(); } }}
      className={className}
    />
  );
}

interface SidebarRightProps {
  stepConfig: CampaignStepConfig;
  selectedElementId: string | null;
  activeStep?: 'teaser' | 'main' | 'success';
  onUpdateStepConfig: (key: string, value: unknown) => void;
  onUpdateElement: (id: string, keyOrObj: string | Record<string, unknown>, value?: unknown) => void;
  onDeleteElement: (id: string) => void;
  onSelectElement?: (id: string | null) => void;
}

const PRESET_FONTS = [
  { value: 'sans-serif', label: 'Inter (Sans)' },
  { value: 'serif', label: 'Playfair (Editorial)' },
  { value: 'monospace', label: 'JetBrains (Mono)' },
];

export default function SidebarRight({
  stepConfig,
  selectedElementId,
  activeStep,
  onUpdateStepConfig,
  onUpdateElement,
  onDeleteElement,
}: SidebarRightProps) {
  const elements = stepConfig.elements;
  const activeElement = elements.find((el: CampaignElement) => el.id === selectedElementId);

  return (
    <div
      className="w-[340px] shrink-0 border-l border-zinc-200 bg-white h-full overflow-y-auto p-5 select-none scrollbar-thin text-left designer-panel"
    >
      {activeElement ? (
        // ----------------- ELEMENT CUSTOMIZATION PANEL -----------------
        <div className="space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
            <div className="flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5 text-zinc-900" />
              <span className="text-[10px] font-semibold uppercase text-zinc-500 tracking-wider font-mono">Inspect Layer</span>
            </div>
            <span className="text-[9px] bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded font-medium font-mono uppercase tracking-wider">
              {activeElement.type}
            </span>
          </div>

          {/* 1. Context Content/Text string. For a ScrollPop creative-template image (a /creatives/
              CDN asset) we HIDE the source URL + picker — clients shouldn't swap the creative; the
              panel starts at the affiliate link + fit. */}
          {activeElement.type !== 'close' && !(activeElement.type === 'image' && String(activeElement.content ?? '').includes('/creatives/')) && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">
                {activeElement.type === 'image' ? 'Image Source URL' : 'Display Text Content'}
              </label>
              <textarea
                value={activeElement.content}
                rows={3}
                onChange={(e) => onUpdateElement(activeElement.id, 'content', e.target.value)}
                className="w-full text-xs p-2.5 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline focus:outline-zinc-350 focus:border-zinc-900 outline-hidden font-sans leading-relaxed"
                placeholder={activeElement.type === 'image' ? 'Image URL...' : 'Type element text...'}
              />
            </div>
          )}

          {/* ScrollPop Creatives thumbnail picker — image elements only, hidden for locked creative-template images */}
          {activeElement.type === 'image' && !String(activeElement.content ?? '').includes('/creatives/') && (
            <CreativePicker
              value={activeElement.content}
              onSelect={(url) => onUpdateElement(activeElement.id, 'content', url)}
            />
          )}

          {/* Link URL + fit — image elements. An image with a link is rendered by the snippet as
              the tracked click target itself (the whole creative is clickable) — no separate overlay
              button needed. Leave the link blank for a non-clickable image. */}
          {activeElement.type === 'image' && (
            <div className="space-y-3 pt-3 border-t border-zinc-200">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  🔗 Affiliate / Link URL
                </label>
                <input
                  type="url"
                  className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none font-mono"
                  placeholder="https://affiliate-link.com/product?tag=..."
                  value={activeElement.href ?? (activeElement.extraProps?.href as string) ?? ''}
                  onChange={(e) => onUpdateElement(activeElement.id, 'href', e.target.value)}
                />
                <div className="text-[9px] text-zinc-400 leading-relaxed">
                  Makes the whole image clickable — opens in a new tab and is tracked as a click.
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">
                  Image fit
                </label>
                <select
                  className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none font-sans"
                  value={activeElement.objectFit ?? 'cover'}
                  onChange={(e) => onUpdateElement(activeElement.id, 'objectFit', e.target.value)}
                >
                  <option value="cover">Cover — fill the box, crop overflow</option>
                  <option value="contain">Contain — show the whole image (no crop)</option>
                </select>
                <div className="text-[9px] text-zinc-400 leading-relaxed">
                  Use “Contain” for full ad creatives so nothing gets cropped.
                </div>
              </div>
            </div>
          )}

          {/* Link URL — button (CTA) elements. Close-button destination lives in the
              "Close behaviour" panel below and only applies when ad-then-close is enabled. */}
          {activeElement.type === 'button' && (
            <div className="space-y-1.5 pt-3 border-t border-zinc-200">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
                🔗 Destination URL
              </label>
              <input
                type="url"
                className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none font-mono"
                placeholder="https://affiliate-link.com/product?tag=..."
                value={activeElement.href ?? (activeElement.extraProps?.href as string) ?? ''}
                onChange={(e) => onUpdateElement(activeElement.id, 'href', e.target.value)}
              />
              <div className="text-[9px] text-zinc-400 leading-relaxed">
                Opens in a new tab when clicked.
              </div>
            </div>
          )}

          {/* ── Close behaviour: natural close vs ad-then-close (per-campaign opt-in) ── */}
          {activeElement.type === 'close' && (
            <div className="space-y-2.5 pt-3 border-t border-zinc-200">
              <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest block font-mono">✕ Close Behaviour</span>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={(activeElement.extraProps as { adClose?: boolean } | undefined)?.adClose === true}
                  onChange={(e) => onUpdateElement(activeElement.id, 'extraProps', {
                    ...(activeElement.extraProps || {}),
                    adClose: e.target.checked,
                  })}
                />
                <span className="text-[11px] text-zinc-600 leading-snug">
                  <span className="font-semibold text-zinc-800">Open an affiliate ad before closing</span><br />
                  Off (default): the ✕ closes the popup instantly. On: the 1st ✕ click opens your link in a new tab and keeps the popup; the 2nd click closes it.
                </span>
              </label>
              {(activeElement.extraProps as { adClose?: boolean } | undefined)?.adClose === true && (
                <div className="space-y-1.5 pl-6">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    🔗 Ad link (opens on ✕)
                  </label>
                  <input
                    type="url"
                    className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none font-mono"
                    placeholder="https://affiliate-link.com/product?tag=..."
                    value={activeElement.href ?? (activeElement.extraProps?.href as string) ?? ''}
                    onChange={(e) => onUpdateElement(activeElement.id, 'href', e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Close button dedicated style panel ── */}
          {activeElement.type === 'close' && (
            <div className="space-y-4 pt-3 border-t border-zinc-200">
              <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest block font-mono">✕ Close Button Appearance</span>

              {/* Symbol color */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-semibold text-zinc-500 font-mono">Symbol Color</label>
                  <span className="font-mono text-[9px] bg-zinc-100 px-1 py-0.5 rounded select-all">{activeElement.color ?? '#374151'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activeElement.color ?? '#374151'}
                    onChange={(e) => onUpdateElement(activeElement.id, 'color', e.target.value)}
                    className="h-8 w-12 border border-zinc-200 rounded cursor-pointer bg-transparent shadow-xs shrink-0"
                  />
                  <input
                    type="text"
                    value={activeElement.color ?? '#374151'}
                    onChange={(e) => onUpdateElement(activeElement.id, 'color', e.target.value)}
                    className="w-full text-xs p-1.5 border border-zinc-200 rounded bg-white select-all font-mono"
                  />
                </div>
              </div>

              {/* Background: transparent toggle + color picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold text-zinc-500 font-mono">Button Background</label>
                  <button
                    type="button"
                    onClick={() => {
                      const isTransparent = !activeElement.backgroundColor || activeElement.backgroundColor === 'transparent';
                      onUpdateElement(activeElement.id, 'backgroundColor', isTransparent ? '#FFFFFF' : 'transparent');
                      if (isTransparent) {
                        // also clear border when making visible
                      } else {
                        onUpdateElement(activeElement.id, 'borderColor', 'transparent');
                      }
                    }}
                    className={`text-[9px] font-bold px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                      !activeElement.backgroundColor || activeElement.backgroundColor === 'transparent'
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-500 border-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    {!activeElement.backgroundColor || activeElement.backgroundColor === 'transparent' ? 'Hidden ✓' : 'Visible'}
                  </button>
                </div>

                {activeElement.backgroundColor && activeElement.backgroundColor !== 'transparent' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeElement.backgroundColor}
                      onChange={(e) => onUpdateElement(activeElement.id, 'backgroundColor', e.target.value)}
                      className="h-8 w-12 border border-zinc-200 rounded cursor-pointer bg-transparent shadow-xs shrink-0"
                    />
                    <input
                      type="text"
                      value={activeElement.backgroundColor}
                      onChange={(e) => onUpdateElement(activeElement.id, 'backgroundColor', e.target.value)}
                      className="w-full text-xs p-1.5 border border-zinc-200 rounded bg-white select-all font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Symbol size */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-semibold text-zinc-500 font-mono">Symbol Size</label>
                  <span className="font-mono text-[9px] bg-zinc-100 px-1 py-0.5 rounded">{activeElement.fontSize ?? 14}px</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="24"
                  value={activeElement.fontSize ?? 14}
                  onChange={(e) => onUpdateElement(activeElement.id, 'fontSize', parseInt(e.target.value))}
                  className="w-full accent-zinc-900 cursor-pointer h-1 bg-zinc-200 rounded-lg"
                />
              </div>

              {/* Corner radius */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 font-mono">Corner Radius</label>
                <NumInput
                  value={activeElement.borderRadius ?? 999}
                  min={0} max={999}
                  onChange={(v) => onUpdateElement(activeElement.id, 'borderRadius', v)}
                  className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 2. Typography Options (Heading, Text, Button) */}
          {['heading', 'text', 'button', 'input'].includes(activeElement.type) && (
            <div className="space-y-4 pt-3 border-t border-zinc-200">
              <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest block font-mono">Typography & Alignment</span>
              
              {/* Font Family selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 font-mono">Font Theme / Pair</label>
                <select
                  value={activeElement.fontFamily || 'sans-serif'}
                  onChange={(e) => onUpdateElement(activeElement.id, 'fontFamily', e.target.value)}
                  className="w-full p-2 border border-zinc-200 rounded text-xs bg-white focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-hidden font-sans"
                >
                  {PRESET_FONTS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* Slider for Font Size */}
              {activeElement.fontSize !== undefined && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <label className="text-[10px] font-semibold text-zinc-500 font-mono">Font Size</label>
                    <span className="font-mono text-[9px] font-semibold text-zinc-650 bg-zinc-100 px-1.5 py-0.5 rounded">
                      {activeElement.fontSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="72"
                    value={activeElement.fontSize}
                    onChange={(e) => onUpdateElement(activeElement.id, 'fontSize', parseInt(e.target.value))}
                    className="w-full accent-zinc-900 cursor-pointer h-1 bg-zinc-200 rounded-lg"
                  />
                </div>
              )}

              {/* Text Alignment */}
              {activeElement.align !== undefined && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-zinc-500 block font-mono">Alignment</label>
                  <div className="grid grid-cols-3 gap-1 shrink-0 bg-zinc-100 p-0.5 rounded">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        onClick={() => onUpdateElement(activeElement.id, 'align', align)}
                        className={`py-1 rounded text-xs font-semibold flex justify-center items-center transition-all cursor-pointer ${
                          activeElement.align === align 
                            ? 'bg-white shadow-xs text-zinc-900 font-bold' 
                            : 'text-zinc-400 hover:text-zinc-650'
                        }`}
                      >
                        {align === 'left' && <AlignLeft className="h-3.5 w-3.5" />}
                        {align === 'center' && <AlignCenter className="h-3.5 w-3.5" />}
                        {align === 'right' && <AlignRight className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Color & Style Customization */}
          <div className="space-y-4 pt-3 border-t border-zinc-200">
            <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest block flex items-center gap-1 font-mono">
              <Paintbrush className="h-3.5 w-3.5 text-zinc-805" /> Style Properties
            </span>

            {/* Solid text color pickers — close type has its own dedicated section above */}
            {activeElement.color !== undefined && activeElement.type !== 'close' && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label className="text-[10px] font-semibold text-zinc-500 font-mono">Text Color</label>
                  <span className="font-mono text-[9px] font-semibold select-all bg-zinc-100 px-1 py-0.5 rounded">{activeElement.color}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activeElement.color}
                    onChange={(e) => onUpdateElement(activeElement.id, 'color', e.target.value)}
                    className="h-8 w-12 border border-zinc-200 rounded cursor-pointer bg-transparent shadow-xs shrink-0"
                  />
                  <input
                    type="text"
                    value={activeElement.color}
                    onChange={(e) => onUpdateElement(activeElement.id, 'color', e.target.value)}
                    className="w-full text-xs p-1.5 border border-zinc-200 rounded bg-white select-all font-mono"
                  />
                </div>
              </div>
            )}

            {/* Solid background color picker — close type handles this above */}
            {activeElement.backgroundColor !== undefined && activeElement.type !== 'close' && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label className="text-[10px] font-semibold text-zinc-500 font-mono">Background Color</label>
                  <span className="font-mono text-[9px] font-semibold select-all bg-zinc-100 px-1 py-0.5 rounded">{activeElement.backgroundColor}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activeElement.backgroundColor}
                    onChange={(e) => onUpdateElement(activeElement.id, 'backgroundColor', e.target.value)}
                    className="h-8 w-12 border border-zinc-200 rounded cursor-pointer bg-transparent shadow-xs shrink-0"
                  />
                  <input
                    type="text"
                    value={activeElement.backgroundColor}
                    onChange={(e) => onUpdateElement(activeElement.id, 'backgroundColor', e.target.value)}
                    className="w-full text-xs p-1.5 border border-zinc-200 rounded bg-white select-all font-mono"
                  />
                </div>
              </div>
            )}

            {/* Borders, Corners & Padding */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {activeElement.borderRadius !== undefined && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide font-mono">Corner Radius</label>
                  <NumInput
                    value={activeElement.borderRadius!}
                    min={0} max={99}
                    onChange={(v) => onUpdateElement(activeElement.id, 'borderRadius', v)}
                    className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none"
                  />
                </div>
              )}

              {activeElement.borderWidth !== undefined && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide font-mono">Border Width</label>
                  <NumInput
                    value={activeElement.borderWidth!}
                    min={0} max={10}
                    onChange={(v) => onUpdateElement(activeElement.id, 'borderWidth', v)}
                    className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Border color pickers */}
            {activeElement.borderColor !== undefined && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 font-mono">Border Color Hex</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activeElement.borderColor}
                    onChange={(e) => onUpdateElement(activeElement.id, 'borderColor', e.target.value)}
                    className="h-7 w-10 border border-zinc-200 rounded cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={activeElement.borderColor}
                    onChange={(e) => onUpdateElement(activeElement.id, 'borderColor', e.target.value)}
                    className="w-full text-xs p-1 border border-zinc-200 rounded font-mono"
                  />
                </div>
              </div>
            )}

            {/* Advanced Filters & Transformation Properties */}
            <div className="space-y-3 pt-3 border-t border-zinc-150 border-dashed">
              <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest block font-mono">Transforms & Opacity</span>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Opacity level */}
                <div className="space-y-1 text-left">
                  <div className="flex justify-between items-center text-[10px]">
                    <label className="font-semibold text-zinc-500 font-mono">Opacity</label>
                    <span className="font-mono font-medium text-zinc-500">{Math.round((activeElement.opacity ?? 1) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round((activeElement.opacity ?? 1) * 100)}
                    onChange={(e) => onUpdateElement(activeElement.id, 'opacity', parseFloat(e.target.value) / 100)}
                    className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                {/* Rotation control */}
                <div className="space-y-1 text-left">
                  <div className="flex justify-between items-center text-[10px]">
                    <label className="font-semibold text-zinc-500 font-mono">Rotation</label>
                    <span className="font-mono font-medium text-pink-600">{(activeElement.extraProps?.rotation as number) || 0}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={(activeElement.extraProps?.rotation as number) || 0}
                    onChange={(e) => onUpdateElement(activeElement.id, 'extraProps', {
                      ...(activeElement.extraProps || {}),
                      rotation: parseInt(e.target.value)
                    })}
                    className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-pink-600"
                  />
                </div>
              </div>
            </div>

            {/* Canvas Precision Metrics */}
            <div className="space-y-2 pt-3 border-t border-zinc-150 border-dashed">
              <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest block font-mono">Layout Metrics & Coordinates</span>
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1 text-left">
                  <label className="text-[8px] font-bold text-zinc-400 font-mono">X (%)</label>
                  <NumInput value={activeElement.x} min={0} max={100}
                    onChange={(v) => onUpdateElement(activeElement.id, 'x', v)}
                    className="w-full p-1.5 border border-zinc-200 rounded text-center text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[8px] font-bold text-zinc-400 font-mono">Y (%)</label>
                  <NumInput value={activeElement.y} min={0} max={100}
                    onChange={(v) => onUpdateElement(activeElement.id, 'y', v)}
                    className="w-full p-1.5 border border-zinc-200 rounded text-center text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[8px] font-bold text-zinc-400 font-mono">W (%)</label>
                  <NumInput value={activeElement.w} min={5} max={100}
                    onChange={(v) => onUpdateElement(activeElement.id, 'w', v)}
                    className="w-full p-1.5 border border-zinc-200 rounded text-center text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[8px] font-bold text-zinc-400 font-mono">H (%)</label>
                  <NumInput value={activeElement.h} min={5} max={100}
                    onChange={(v) => onUpdateElement(activeElement.id, 'h', v)}
                    className="w-full p-1.5 border border-zinc-200 rounded text-center text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50"
                  />
                </div>
              </div>
            </div>

            {/* Security Lock and Indices */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-150 border-dashed">
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide font-mono">Z-Index Elevation</label>
                <NumInput
                  value={activeElement.zIndex || 1}
                  min={1} max={100}
                  onChange={(v) => onUpdateElement(activeElement.id, 'zIndex', v)}
                  className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide font-mono">Safety Lock</label>
                <button
                  type="button"
                  onClick={() => onUpdateElement(activeElement.id, 'extraProps', {
                    ...(activeElement.extraProps || {}),
                    isLocked: !activeElement.extraProps?.isLocked
                  })}
                  className={`w-full text-xs p-2 border rounded font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                    activeElement.extraProps?.isLocked 
                      ? 'bg-amber-100 border-amber-300 text-amber-800 font-bold' 
                      : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {activeElement.extraProps?.isLocked ? 'Locked 🔒' : 'Unlocked 🔓'}
                </button>
              </div>
            </div>

          </div>

          {/* 4. Type Specific Advanced parameters */}
          {activeElement.type === 'countdown' && activeElement.extraProps && (
            <div className="space-y-3 pt-3 border-t border-zinc-200">
              <span className="text-[10px] font-semibold text-zinc-405 uppercase tracking-widest block font-mono">
                ⌛ Countdown Extension
              </span>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 font-mono">Target Duration (Minutes)</label>
                <NumInput
                  value={Math.round(((activeElement.extraProps.targetSeconds as number) || 600) / 60)}
                  min={5} max={1440}
                  onChange={(v) => onUpdateElement(activeElement.id, 'extraProps', {
                    ...activeElement.extraProps,
                    targetSeconds: v * 60,
                  })}
                  className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {activeElement.type === 'input' && activeElement.extraProps && (
            <div className="space-y-3 pt-3 border-t border-zinc-200">
              <span className="text-[10px] font-semibold text-zinc-405 uppercase tracking-widest block font-mono">Input Properties</span>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 font-mono">Placeholder Text</label>
                <input
                  type="text"
                  value={(activeElement.extraProps.placeholder as string) || ''}
                  onChange={(e) => onUpdateElement(activeElement.id, 'extraProps', {
                    ...activeElement.extraProps,
                    placeholder: e.target.value
                  })}
                  className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none font-sans"
                />
              </div>
            </div>
          )}

          {/* Delete Element CTA */}
          <div className="pt-5 mt-4 border-t border-zinc-200 flex gap-2">
            <button
              disabled={activeElement.id === 'close-btn'}
              onClick={() => onDeleteElement(activeElement.id)}
              className="w-full py-2.5 rounded text-xs font-semibold bg-zinc-100 hover:bg-red-50 text-zinc-700 hover:text-red-650 border border-zinc-200 hover:border-red-200 transition-colors duration-150 cursor-pointer flex justify-center items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Element Node
            </button>
          </div>
        </div>
      ) : (
        // ----------------- GLOBAL CANVAS SPECIFICATION PANEL -----------------
        <div className="space-y-5">
          <div className="pb-3 border-b border-zinc-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layout className="h-3.5 w-3.5 text-zinc-900" />
              <span className="text-[10px] font-semibold uppercase text-zinc-500 tracking-wider font-mono">Canvas Layout Settings</span>
            </div>
            {activeStep && activeStep !== 'main' && (
              <button
                type="button"
                onClick={() => onUpdateStepConfig('enabled', stepConfig.enabled === false ? true : false)}
                className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  stepConfig.enabled !== false
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200'
                }`}
              >
                {stepConfig.enabled !== false ? 'Enabled ✓' : 'Disabled ✕'}
              </button>
            )}
          </div>

          {/* Layout coordinates type */}
          <div className="p-3.5 rounded border border-zinc-200 bg-zinc-50/55 space-y-2">
            <span className="text-[9px] font-semibold text-zinc-900 uppercase tracking-widest block font-mono">
              Campaign Theme Layout:
            </span>
            <div className="flex items-center gap-2">
              <select
                value={stepConfig.popupType}
                onChange={(e) => onUpdateStepConfig('popupType', e.target.value as PopupType)}
                className="w-full p-2 border border-zinc-200 focus:ring-1 focus:ring-zinc-900 bg-white rounded text-xs font-medium cursor-pointer"
              >
                <option value="modal">🗖 Modal Center Dialog</option>
                <option value="fullscreen">🖥 Fullscreen Takeover</option>
                <option value="stickybar">➖ Sticky Top/Bottom Bar</option>
                <option value="slidein">➠ Slide-in Drawer Window</option>
                <option value="floating">🏷 Floating Bottom Teaser</option>
              </select>
            </div>
          </div>

          {/* Size / Specs */}
          <div className="space-y-4 pt-1">
            <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest block font-mono">Sizing Constraints</span>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 font-mono">Width (px)</label>
                <NumInput
                  value={stepConfig.width}
                  min={200} max={1200}
                  onChange={(v) => onUpdateStepConfig('width', v)}
                  className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 font-mono">Height (px)</label>
                <NumInput
                  value={stepConfig.height}
                  min={100} max={800}
                  disabled={stepConfig.popupType === 'stickybar'}
                  onChange={(v) => onUpdateStepConfig('height', v)}
                  className={`w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none ${
                    stepConfig.popupType === 'stickybar' ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Master Canvas Styling */}
          <div className="space-y-4 pt-4 border-t border-zinc-200">
            <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest block font-mono">Backdrop Aesthetics</span>

            {/* Background Color Solid/Gradient selection */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="text-[10px] font-semibold text-zinc-500 font-mono font-mono">Canvas Background</label>
                <span className="font-mono text-[9px] font-medium select-all bg-zinc-100 px-1 py-0.5 rounded">{stepConfig.backgroundColor}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={stepConfig.backgroundColor.startsWith('#') ? stepConfig.backgroundColor.substring(0, 7) : '#FFFFFF'}
                  onChange={(e) => onUpdateStepConfig('backgroundColor', e.target.value)}
                  className="h-8 w-12 border border-zinc-200 rounded cursor-pointer bg-transparent shadow-xs shrink-0"
                />
                <input
                  type="text"
                  value={stepConfig.backgroundColor}
                  onChange={(e) => onUpdateStepConfig('backgroundColor', e.target.value)}
                  className="w-full text-xs p-1.5 border border-zinc-200 rounded font-mono select-all bg-white"
                  placeholder="HEX, solid or linear grad..."
                />
              </div>
            </div>

            {/* Rounded Geometry */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 font-mono">Border Radius</label>
                <NumInput
                  value={stepConfig.borderRadius}
                  min={0} max={120}
                  onChange={(v) => onUpdateStepConfig('borderRadius', v)}
                  className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 font-mono">Border Weight</label>
                <NumInput
                  value={stepConfig.borderWidth}
                  min={0} max={12}
                  onChange={(v) => onUpdateStepConfig('borderWidth', v)}
                  className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white"
                />
              </div>
            </div>

            {/* Border Hex Color */}
            {stepConfig.borderWidth > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 font-mono">Border Color HEX</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={stepConfig.borderColor}
                    onChange={(e) => onUpdateStepConfig('borderColor', e.target.value)}
                    className="h-7 w-10 border border-zinc-200 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={stepConfig.borderColor}
                    onChange={(e) => onUpdateStepConfig('borderColor', e.target.value)}
                    className="w-full text-xs p-1 border border-zinc-200 rounded bg-white font-mono"
                  />
                </div>
              </div>
            )}

            {/* Back Mask Overlay Color */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 font-mono font-mono">Backdrop Overaly Darkener</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={stepConfig.overlayColor.startsWith('rgba') ? '#000000' : stepConfig.overlayColor}
                  onChange={(e) => onUpdateStepConfig('overlayColor', e.target.value + '72')} // Appends alpha opacity automatically
                  className="h-7 w-10 border border-zinc-200 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={stepConfig.overlayColor}
                  onChange={(e) => onUpdateStepConfig('overlayColor', e.target.value)}
                  className="w-full text-xs p-1 border border-zinc-200 bg-white font-mono rounded"
                />
              </div>
            </div>
          </div>

          {/* Master Canvas Custom Physics/Animations */}
          <div className="space-y-4 pt-4 border-t border-zinc-200">
            <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest block font-mono">Motion Dynamics</span>
            
            {/* Slide up, scale up, etc */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-zinc-650">Entrance Animation Motion</label>
              <select
                value={stepConfig.animationEntrance}
                onChange={(e) => onUpdateStepConfig('animationEntrance', e.target.value)}
                className="w-full p-2 border border-zinc-200 rounded text-xs bg-white focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 cursor-pointer"
              >
                <option value="scale-up">✨ Pop Scale-Up (Modern Spring)</option>
                <option value="fade-in">🌫 Soft Ambient Fade</option>
                <option value="slide-up">⍗ Slide-Up from Bottom</option>
                <option value="slide-down">⍘ Slide-Down from Header</option>
                <option value="bounce">🏀 Energetic Bounce Playful</option>
              </select>
            </div>
          </div>

          {/* Master Canvas Positioning helper */}
          {['modal', 'slidein', 'floating'].includes(stepConfig.popupType) && (
            <div className="space-y-3 pt-4 border-t border-zinc-200">
              <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest block font-mono text-center">
                Screen Alignment Mapping
              </span>
              <div className="grid grid-cols-3 gap-1.5 w-full aspect-square max-w-[140px] mx-auto border border-zinc-200 p-2 rounded bg-zinc-50/50">
                {(['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'] as const).map((pos) => {
                  const translatePos = (p: string): CanvasPosition => {
                    if (p === 'top') return 'top';
                    if (p === 'bottom') return 'bottom';
                    if (p === 'left') return 'left';
                    if (p === 'right') return 'right';
                    if (p === 'top-left') return 'top-left';
                    if (p === 'top-right') return 'top-right';
                    if (p === 'bottom-left') return 'bottom-left';
                    if (p === 'bottom-right') return 'bottom-right';
                    return 'center';
                  };
                  
                  const isCurrent = stepConfig.position === translatePos(pos);
                  return (
                    <button
                      key={pos}
                      onClick={() => onUpdateStepConfig('position', translatePos(pos))}
                      className={`h-full w-full rounded border text-[9px] font-semibold flex items-center justify-center transition-all ${
                        isCurrent 
                          ? 'bg-zinc-900 border-zinc-900 text-white shadow-xs font-bold' 
                          : 'bg-white border-zinc-200 hover:border-zinc-400 cursor-pointer text-zinc-400 hover:text-zinc-700'
                      }`}
                      title={pos}
                    >
                      {pos === 'center' ? '•' : pos === 'left' ? '←' : pos === 'right' ? '→' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Canvas help overlay */}
          <div className="text-[11px] leading-relaxed text-zinc-450 bg-zinc-50 p-3 rounded border border-zinc-200 flex gap-2 items-start text-left font-sans mt-3">
            <CornerDownRight className="h-4 w-4 text-zinc-350 shrink-0 mt-0.5" />
            <span>Select any direct element layer box inside the Canvas workspace to start scaling size coordinates, color variables, or edit font properties!</span>
          </div>
        </div>
      )}
    </div>
  );
}
