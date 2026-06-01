import React from 'react';
import { 
  Type, 
  Paintbrush, 
  Settings, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Trash2, 
  Layout,
  CornerDownRight,
  Sparkles,
  Play
} from 'lucide-react';
import { CampaignElement, CampaignStepConfig, PopupType, CanvasPosition } from '../types';

interface SidebarRightProps {
  stepConfig: CampaignStepConfig;
  selectedElementId: string | null;
  onUpdateStepConfig: (key: string, value: any) => void;
  onUpdateElement: (id: string, key: string, value: any) => void;
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
  onUpdateStepConfig,
  onUpdateElement,
  onDeleteElement,
}: SidebarRightProps) {
  const elements = stepConfig.elements;
  const activeElement = elements.find(el => el.id === selectedElementId);

  return (
    <div className="w-[340px] shrink-0 border-l border-zinc-200 bg-white h-full overflow-y-auto p-5 select-none scrollbar-thin text-left">
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

          {/* 1. Context Content/Text string */}
          {activeElement.type !== 'close' && (
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

            {/* Solid text color pickers */}
            {activeElement.color !== undefined && (
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

            {/* Solid background color picker */}
            {activeElement.backgroundColor !== undefined && (
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
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={activeElement.borderRadius}
                    onChange={(e) => onUpdateElement(activeElement.id, 'borderRadius', Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none"
                  />
                </div>
              )}

              {activeElement.borderWidth !== undefined && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide font-mono">Border Width</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={activeElement.borderWidth}
                    onChange={(e) => onUpdateElement(activeElement.id, 'borderWidth', Math.max(0, parseInt(e.target.value) || 0))}
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
                    <span className="font-mono font-medium text-pink-600">{activeElement.extraProps?.rotation || 0}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={activeElement.extraProps?.rotation || 0}
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
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={activeElement.x}
                    onChange={(e) => onUpdateElement(activeElement.id, 'x', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                    className="w-full p-1.5 border border-zinc-200 rounded text-center text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[8px] font-bold text-zinc-400 font-mono">Y (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={activeElement.y}
                    onChange={(e) => onUpdateElement(activeElement.id, 'y', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                    className="w-full p-1.5 border border-zinc-200 rounded text-center text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[8px] font-bold text-zinc-400 font-mono">W (%)</label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={activeElement.w}
                    onChange={(e) => onUpdateElement(activeElement.id, 'w', Math.max(5, Math.min(100, parseInt(e.target.value) || 5)))}
                    className="w-full p-1.5 border border-zinc-200 rounded text-center text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[8px] font-bold text-zinc-400 font-mono">H (%)</label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={activeElement.h}
                    onChange={(e) => onUpdateElement(activeElement.id, 'h', Math.max(5, Math.min(100, parseInt(e.target.value) || 5)))}
                    className="w-full p-1.5 border border-zinc-200 rounded text-center text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50"
                  />
                </div>
              </div>
            </div>

            {/* Security Lock and Indices */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-150 border-dashed">
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide font-mono">Z-Index Elevation</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={activeElement.zIndex || 1}
                  onChange={(e) => onUpdateElement(activeElement.id, 'zIndex', Math.max(1, parseInt(e.target.value) || 1))}
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
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={Math.round((activeElement.extraProps.targetSeconds || 600) / 60)}
                  onChange={(e) => onUpdateElement(activeElement.id, 'extraProps', {
                    ...activeElement.extraProps,
                    targetSeconds: Math.max(1, parseInt(e.target.value) || 1) * 60
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
                  value={activeElement.extraProps.placeholder || ''}
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
          <div className="pb-3 border-b border-zinc-200 flex items-center gap-1.5">
            <Layout className="h-3.5 w-3.5 text-zinc-900" />
            <span className="text-[10px] font-semibold uppercase text-zinc-500 tracking-wider font-mono">Canvas Layout Settings</span>
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
                <option value="spinwheel">🎡 Gamified Spin Wheel popup</option>
              </select>
            </div>
          </div>

          {/* Size / Specs */}
          <div className="space-y-4 pt-1">
            <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest block font-mono">Sizing Constraints</span>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 font-mono">Width (px)</label>
                <input
                  type="number"
                  min="200"
                  max="1200"
                  value={stepConfig.width}
                  onChange={(e) => onUpdateStepConfig('width', Math.max(200, parseInt(e.target.value) || 200))}
                  className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 font-mono">Height (px)</label>
                <input
                  type="number"
                  min="100"
                  max="800"
                  value={stepConfig.height}
                  disabled={stepConfig.popupType === 'stickybar'}
                  className={`w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white focus:outline-none ${
                    stepConfig.popupType === 'stickybar' ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                  onChange={(e) => onUpdateStepConfig('height', Math.max(100, parseInt(e.target.value) || 100))}
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
                <input
                  type="number"
                  max="120"
                  min="0"
                  value={stepConfig.borderRadius}
                  onChange={(e) => onUpdateStepConfig('borderRadius', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-xs p-2 border border-zinc-200 rounded bg-zinc-50/50 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 font-mono">Border Weight</label>
                <input
                  type="number"
                  min="0"
                  max="12"
                  value={stepConfig.borderWidth}
                  onChange={(e) => onUpdateStepConfig('borderWidth', Math.max(0, parseInt(e.target.value) || 0))}
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
