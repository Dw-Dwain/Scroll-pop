import React, { useState } from 'react';
import { Palette, Type, Layout, Settings, Plus, GripVertical, Trash2, Image as ImageIcon, MousePointer2, Clock, Ticket, CheckSquare, Maximize } from 'lucide-react';
import { FormDataShape } from '../../types/campaign';
import { cn } from '../../lib/utils';

interface DesignControlsProps {
  formData: FormDataShape;
  setFormData: React.Dispatch<React.SetStateAction<FormDataShape>>;
}

export const DesignControls: React.FC<DesignControlsProps> = ({ formData, setFormData }) => {
  const [activeTab, setActiveTab] = useState<'content' | 'appearance' | 'layout'>('content');

  const tabs = [
    { id: 'content', label: 'Builder', icon: Layout },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'layout', label: 'Settings', icon: Settings },
  ] as const;

  const updateBlock = (idx: number, updates: any) => {
    if (!formData.elements) return;
    const newElements = [...formData.elements];
    newElements[idx] = { ...newElements[idx], ...updates };
    setFormData(prev => ({ ...prev, elements: newElements }));
  };

  const removeBlock = (idx: number) => {
    if (!formData.elements) return;
    const newElements = [...formData.elements];
    newElements.splice(idx, 1);
    setFormData(prev => ({ ...prev, elements: newElements }));
  };

  const addBlock = (type: string) => {
    const newBlock = { id: Math.random().toString(36).substring(7), type, content: type === 'button' ? 'Click Me' : type === 'text' ? 'New Text Block' : '', styles: {} };
    const elements = formData.elements ? [...formData.elements, newBlock] : [newBlock];
    setFormData(prev => ({ ...prev, elements, layoutMode: 'blocks' }));
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-full max-h-[800px]">
        {/* Header & Tabs */}
        <div className="px-6 pt-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Design & Settings</h2>
          </div>
          <div className="flex gap-4">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center gap-2 pb-3 px-1 text-sm font-semibold transition-colors border-b-2",
                    isActive ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  )}
                >
                  <tab.icon className="w-4 h-4" /> {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto hide-scrollbar space-y-6">
          {activeTab === 'content' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {formData.layoutMode !== 'blocks' && (
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl text-sm text-indigo-900 dark:text-indigo-200 mb-6">
                  <strong>Legacy Layout Detected.</strong> This template uses the old flat-field structure. 
                  <button onClick={() => setFormData(prev => ({ ...prev, layoutMode: 'blocks', elements: [{ type: 'text', content: prev.headline || 'Headline', styles: { fontSize: '24px', fontWeight: 'bold' } }, { type: 'text', content: prev.bodyText || '', styles: {} }, { type: 'button', content: prev.ctaText || 'Submit', styles: { backgroundColor: prev.accentColor, color: '#fff' } }] }))} className="ml-2 underline font-bold hover:text-indigo-600">Upgrade to Block Engine</button>
                </div>
              )}

              {formData.layoutMode === 'blocks' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Blocks</h3>
                  </div>
                  
                  {formData.elements?.map((block: any, idx: number) => (
                    <div key={block.id || idx} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex gap-3 relative group">
                      <div className="cursor-grab text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mt-2">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{block.type}</span>
                          <button onClick={() => removeBlock(idx)} className="text-slate-400 hover:text-rose-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {(block.type === 'text' || block.type === 'button') && (
                          <textarea 
                            value={block.content || ''} 
                            onChange={(e) => updateBlock(idx, { content: e.target.value })} 
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                            rows={block.type === 'text' ? 2 : 1}
                            placeholder={`Enter ${block.type} content...`}
                          />
                        )}
                        {block.type === 'image' && (
                          <input 
                            type="text"
                            value={block.content || ''} 
                            onChange={(e) => updateBlock(idx, { content: e.target.value })} 
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Image URL..."
                          />
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="grid grid-cols-3 gap-2 pt-4">
                    <button onClick={() => addBlock('text')} className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors gap-2 group">
                      <Type className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-indigo-600">Text</span>
                    </button>
                    <button onClick={() => addBlock('button')} className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors gap-2 group">
                      <MousePointer2 className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-indigo-600">Button</span>
                    </button>
                    <button onClick={() => addBlock('image')} className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors gap-2 group">
                      <ImageIcon className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-indigo-600">Image</span>
                    </button>
                    <button onClick={() => addBlock('timer')} className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors gap-2 group">
                      <Clock className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-indigo-600">Timer</span>
                    </button>
                    <button onClick={() => addBlock('coupon')} className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors gap-2 group">
                      <Ticket className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-indigo-600">Coupon</span>
                    </button>
                    <button onClick={() => addBlock('form')} className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors gap-2 group">
                      <CheckSquare className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-indigo-600">Form</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Background</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={formData.backgroundColor} onChange={(e) => setFormData(prev => ({ ...prev, backgroundColor: e.target.value }))} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                    <span className="text-xs font-mono uppercase">{formData.backgroundColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Text</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={formData.textColor} onChange={(e) => setFormData(prev => ({ ...prev, textColor: e.target.value }))} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                    <span className="text-xs font-mono uppercase">{formData.textColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Accent (CTA)</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={formData.accentColor} onChange={(e) => setFormData(prev => ({ ...prev, accentColor: e.target.value }))} className="h-10 w-10 rounded cursor-pointer border-0 p-0" />
                    <span className="text-xs font-mono uppercase">{formData.accentColor}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Border Radius</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={32} value={formData.borderRadius} onChange={(e) => setFormData(prev => ({ ...prev, borderRadius: Number(e.target.value) }))} className="flex-grow accent-indigo-600" />
                  <span className="text-xs font-mono w-8">{formData.borderRadius}px</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Shadow</label>
                <select 
                  value={formData.boxShadow || 'none'} 
                  onChange={(e) => setFormData(prev => ({ ...prev, boxShadow: e.target.value }))} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="none">None</option>
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="xl">Extra Large</option>
                  <option value="2xl">2X Large</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Background Image (Optional)</label>
                <input 
                  value={formData.backgroundImage || ''} 
                  onChange={(e) => setFormData(prev => ({ ...prev, backgroundImage: e.target.value }))} 
                  placeholder="https://..." 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-800 dark:text-slate-200">Show Close Button (X)</label>
                  <input type="checkbox" checked={formData.showCloseButton} onChange={(e) => setFormData(prev => ({ ...prev, showCloseButton: e.target.checked }))} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                </div>
                {formData.showCloseButton && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Close Button Position</label>
                    <select 
                      value={formData.closeButtonPosition} 
                      onChange={(e) => setFormData(prev => ({ ...prev, closeButtonPosition: e.target.value as any }))} 
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'layout' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Position</label>
                  <select 
                    value={formData.position} 
                    onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value as any }))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="center">Center</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Size / Width</label>
                  <select 
                    value={formData.size} 
                    onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value as any }))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="sm">Small</option>
                    <option value="md">Medium</option>
                    <option value="lg">Large</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Entry Animation</label>
                <select 
                  value={formData.animation} 
                  onChange={(e) => setFormData(prev => ({ ...prev, animation: e.target.value as any }))} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="fade">Fade In</option>
                  <option value="slide_up">Slide Up</option>
                  <option value="slide_down">Slide Down</option>
                  <option value="zoom">Zoom In</option>
                  <option value="none">None</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-slate-800 dark:text-slate-200">Enable Background Overlay</label>
                  <input type="checkbox" checked={formData.overlayEnabled} onChange={(e) => setFormData(prev => ({ ...prev, overlayEnabled: e.target.checked }))} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                </div>
                {formData.overlayEnabled && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Overlay Opacity ({Math.round(formData.overlayOpacity * 100)}%)</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min={0} max={1} step={0.05} value={formData.overlayOpacity} onChange={(e) => setFormData(prev => ({ ...prev, overlayOpacity: Number(e.target.value) }))} className="flex-grow accent-indigo-600" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
