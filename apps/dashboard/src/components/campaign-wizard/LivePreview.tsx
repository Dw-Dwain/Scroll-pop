import React, { useState } from 'react';
import { Smartphone, Monitor, X, Sparkles, AlertCircle } from 'lucide-react';
import { FormDataShape } from '../../types/campaign';
import { cn } from '../../lib/utils';

interface LivePreviewProps {
  formData: FormDataShape;
}

export const LivePreview: React.FC<LivePreviewProps> = ({ formData }) => {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  const getPositionClasses = () => {
    switch (formData.position) {
      case 'bottom-right': return 'inset-0 items-end justify-end p-4 md:p-8';
      case 'bottom-left': return 'inset-0 items-end justify-start p-4 md:p-8';
      case 'top': return 'inset-x-0 top-0 items-start justify-center p-4 md:p-8';
      case 'bottom': return 'inset-x-0 bottom-0 items-end justify-center p-4 md:p-8';
      case 'center':
      default: return 'inset-0 items-center justify-center p-4 md:p-8';
    }
  };

  const getSizeClasses = () => {
    if (formData.kind === 'fullscreen') {
      return viewMode === 'desktop' ? 'w-[55%] h-full max-h-[85vh]' : 'w-full h-full';
    }
    switch (formData.size) {
      case 'sm': return 'max-w-sm';
      case 'lg': return 'max-w-2xl';
      case 'md':
      default: return 'max-w-lg';
    }
  };

  const getAnimationClass = () => {
    switch (formData.animation) {
      case 'fade': return 'animate-in fade-in duration-500';
      case 'slide_down': return 'animate-in slide-in-from-top-8 fade-in duration-500';
      case 'zoom': return 'animate-in zoom-in-95 fade-in duration-500';
      case 'none': return '';
      case 'slide_up':
      default: return 'animate-in slide-in-from-bottom-8 fade-in duration-500';
    }
  };

  const renderBlock = (block: any, idx: number) => {
    switch (block.type) {
      case 'text':
        return (
          <div key={idx} style={block.styles} className="mb-3">
            {block.content}
          </div>
        );
      case 'image':
        return (
          <img key={idx} src={block.content} style={block.styles} alt="Block image" className="w-full object-cover mb-4" />
        );
      case 'button':
        return (
          <button key={idx} style={block.styles} className="w-full py-3 px-6 rounded-xl font-bold shadow-lg mt-2 transition-transform hover:scale-[1.02]">
            {block.content}
          </button>
        );
      case 'timer':
        return (
          <div key={idx} className="flex items-center justify-center gap-4 my-4" style={block.styles}>
            {['00', '15', '30', '45'].map((num, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="bg-slate-900 text-white font-mono text-2xl px-3 py-2 rounded-lg shadow-inner">{num}</div>
                <span className="text-[10px] uppercase font-bold mt-1 opacity-70">{['Days', 'Hrs', 'Min', 'Sec'][i]}</span>
              </div>
            ))}
          </div>
        );
      case 'form':
        return (
          <div key={idx} className="flex flex-col gap-3 my-4">
            <input type="email" placeholder="Enter your email..." className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500 bg-white/50 backdrop-blur-sm text-sm" />
            <button style={block.styles} className="w-full py-3 px-6 rounded-xl font-bold shadow-lg transition-transform hover:scale-[1.02]">
              {block.content || 'Submit'}
            </button>
          </div>
        );
      case 'spacer':
        return <div key={idx} style={{ height: block.props?.height || '20px' }} />;
      default:
        return null;
    }
  };

  const overlayBgColor = `rgba(15, 23, 42, ${formData.overlayOpacity})`;

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden font-sans">
      
      {/* Top Browser Bar with Toggles */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
        </div>
        <div className="flex bg-slate-950 rounded-lg p-1">
          <button
            onClick={() => setViewMode('desktop')}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
              viewMode === 'desktop' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Monitor className="w-4 h-4" /> Desktop
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
              viewMode === 'mobile' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Smartphone className="w-4 h-4" /> Mobile
          </button>
        </div>
        <div className="w-10" />
      </div>

      {/* Device Simulator Container */}
      <div className="flex-1 bg-slate-900/50 p-6 flex items-center justify-center overflow-hidden">
        
        <div 
          className={cn(
            "relative bg-white shadow-2xl overflow-hidden transition-all duration-500 origin-center ring-1 ring-slate-800/50",
            viewMode === 'mobile' 
              ? "w-[375px] h-[812px] rounded-[3rem] ring-[12px] ring-slate-800" 
              : "w-full h-full rounded-xl"
          )}
        >
          {/* Mock Website Background */}
          <div className="absolute inset-0 bg-slate-50 pointer-events-none opacity-50 flex flex-col items-center pt-20 gap-8">
            <div className="w-3/4 h-8 bg-slate-200 rounded-lg animate-pulse" />
            <div className="w-1/2 h-4 bg-slate-200 rounded-lg animate-pulse delay-75" />
            <div className="w-full max-w-2xl h-64 bg-slate-200 rounded-2xl animate-pulse delay-150 mx-8" />
            <div className="w-2/3 h-4 bg-slate-200 rounded-lg animate-pulse delay-200" />
            <div className="w-1/3 h-4 bg-slate-200 rounded-lg animate-pulse delay-300" />
          </div>

          {/* Render Overlay & Positioning */}
          <div 
            className={cn("absolute flex pointer-events-none z-50", getPositionClasses())}
            style={formData.overlayEnabled && (formData.kind === 'modal' || formData.kind === 'fullscreen') ? { backgroundColor: overlayBgColor } : {}}
          >
            {/* The Actual Display Ad */}
            <div
              className={cn(
                "pointer-events-auto relative overflow-hidden shadow-2xl flex flex-col",
                getSizeClasses(),
                getAnimationClass(),
                formData.kind === 'banner' || formData.kind === 'bar' ? 'w-full' : '',
                formData.kind === 'fullscreen' ? 'max-w-none' : ''
              )}
              style={{
                backgroundColor: formData.backgroundColor,
                color: formData.textColor,
                borderRadius: formData.kind === 'bar' || formData.kind === 'fullscreen' ? 0 : `${formData.borderRadius}px`,
                backgroundImage: formData.backgroundImage ? `url(${formData.backgroundImage})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              
              {/* Close Button */}
              {formData.showCloseButton && (
                <button
                  className={cn(
                    "absolute w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-current transition-colors z-50",
                    formData.closeButtonPosition === 'top-left' ? 'top-4 left-4' : 'top-4 right-4'
                  )}
                >
                  <X className="w-4 h-4 opacity-70" />
                </button>
              )}

              {/* Layout Rendering Engine */}
              {formData.layoutMode === 'blocks' && formData.elements ? (
                <div className="w-full h-full p-6 md:p-8 flex flex-col relative z-10 overflow-y-auto custom-scrollbar">
                  {formData.elements.map((block, idx) => renderBlock(block, idx))}
                </div>
              ) : (
                /* Legacy Layout Fallback (For backwards compatibility during rollout) */
                <div className="flex flex-col h-full relative z-10">
                  {formData.imageUrl && formData.kind !== 'fullscreen' && formData.kind !== 'bar' && (
                    <img loading="lazy" src={formData.imageUrl} alt="Preview" className="w-full h-40 md:h-56 object-cover" />
                  )}
                  
                  <div className={cn(
                    "flex-1 p-6 md:p-8 flex flex-col",
                    formData.kind === 'fullscreen' ? 'items-center justify-center text-center p-12 md:p-24' : ''
                  )}>
                    <h4 className="font-extrabold text-2xl md:text-3xl tracking-tight mb-2 leading-tight">
                      {formData.headline || 'Your Headline Here'}
                    </h4>
                    
                    {formData.subheadline && (
                      <p className="font-semibold text-lg opacity-90 mb-3 leading-snug">
                        {formData.subheadline}
                      </p>
                    )}
                    
                    {formData.bodyText && (
                      <p className="text-sm opacity-80 leading-relaxed mb-6 flex-grow">
                        {formData.bodyText}
                      </p>
                    )}
                    
                    <div className="mt-auto space-y-4 pt-4">
                      {formData.ctaStyle === 'button' ? (
                        <button
                          className="w-full py-3.5 px-6 rounded-xl font-extrabold text-[15px] shadow-lg transition-transform hover:scale-[1.02]"
                          style={{ backgroundColor: formData.accentColor, color: '#ffffff' }}
                        >
                          {formData.ctaText || 'Submit'}
                        </button>
                      ) : (
                        <button
                          className="w-full py-3 font-bold hover:opacity-80 transition-opacity underline decoration-2 underline-offset-4"
                          style={{ color: formData.accentColor }}
                        >
                          {formData.ctaText || 'Submit'}
                        </button>
                      )}
                      
                      {formData.showDismissText && (
                        <button className="w-full text-xs font-semibold opacity-60 hover:opacity-100 transition-opacity pb-2">
                          {formData.dismissText || 'No thanks'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
