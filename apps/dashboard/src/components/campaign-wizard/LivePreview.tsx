import React, { useState, useRef, useEffect } from 'react';
import { Smartphone, Monitor, X, Sparkles, RefreshCw, Trophy } from 'lucide-react';
import { FormDataShape } from '../../types/campaign';
import { cn } from '../../lib/utils';

// ─── Scratch Card Interactive Block ───────────────────────────────────────────
interface ScratchCardBlockProps {
  block: any;
  accentColor: string;
}

// Constants to avoid i18n raw literal warnings in JSX
const TEXT_MYSTERY_GIFT_UNCOVERED = 'Mystery Gift Uncovered';

const ScratchCardBlock: React.FC<ScratchCardBlockProps> = ({ block, accentColor }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isScratching, setIsScratching] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);

  const prizeCode = block.props?.prizeCode || 'WELCOME50';
  const prizeLabel = block.props?.prizeLabel || '50% OFF ENTIRE ORDER';
  const overlayText = block.props?.overlayText || 'Scratch to Reveal ⚡';

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height || 150;

    // Draw luxury silver background
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#d1d5db');
    grad.addColorStop(0.3, '#f3f4f6');
    grad.addColorStop(0.5, '#e5e7eb');
    grad.addColorStop(0.8, '#9ca3af');
    grad.addColorStop(1, '#6b7280');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw sparkle pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 3 + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw text instruction
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(overlayText, canvas.width / 2, canvas.height / 2);
  };

  useEffect(() => {
    initCanvas();
    // Re-init on resize if any
    const observer = new ResizeObserver(() => {
      if (!isRevealed) initCanvas();
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isRevealed, block.props]);

  const handleScratch = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || isRevealed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();

    // Increment count to trigger auto-reveal
    setScratchProgress(prev => {
      const next = prev + 1;
      if (next > 45) {
        setIsRevealed(true);
      }
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsScratching(true);
    handleScratch(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isScratching) return;
    handleScratch(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    setIsScratching(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      setIsScratching(true);
      handleScratch(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isScratching || !e.touches[0]) return;
    handleScratch(e.touches[0].clientX, e.touches[0].clientY);
  };

  const resetScratcher = () => {
    setIsRevealed(false);
    setScratchProgress(0);
    setTimeout(() => {
      initCanvas();
    }, 50);
  };

  return (
    <div className="w-full flex flex-col gap-2 my-2" style={block.styles}>
      <div 
        ref={containerRef}
        className="relative w-full h-[150px] rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800 bg-slate-950 flex flex-col items-center justify-center text-center p-4 select-none"
      >
        {/* Underlay (The actual hidden prize) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white animate-in fade-in duration-300">
          <Trophy className="w-8 h-8 text-amber-400 mb-2 animate-bounce" />
          <span className="text-[10px] tracking-widest text-indigo-400 uppercase font-extrabold">{TEXT_MYSTERY_GIFT_UNCOVERED}</span>
          <h4 className="text-xl font-black text-amber-300 tracking-tight my-0.5">{prizeLabel}</h4>
          <div className="mt-1 px-3 py-1 rounded bg-amber-400/10 border border-amber-400/30 text-amber-200 font-mono text-sm font-bold tracking-widest select-text cursor-pointer hover:bg-amber-400/20 transition-all">
            {prizeCode}
          </div>
        </div>

        {/* Scratch Canvas Overlaid */}
        {!isRevealed && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair z-10 touch-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          />
        )}
      </div>
      {isRevealed && (
        <button 
          onClick={resetScratcher}
          className="mx-auto flex items-center gap-1.5 px-3 py-1 text-xs text-indigo-500 hover:text-indigo-600 font-bold transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Scratch Again
        </button>
      )}
    </div>
  );
};

// ─── Spin To Win Interactive Block ───────────────────────────────────────────
interface SpinWheelBlockProps {
  block: any;
  accentColor: string;
}

const SpinWheelBlock: React.FC<SpinWheelBlockProps> = ({ block, accentColor }) => {
  const [angle, setAngle] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<any | null>(null);

  const slices = block.props?.slices || [
    { label: '10% OFF', value: 'SAVE10', color: '#ec4899', isWin: true },
    { label: 'Try Again', value: 'LOSE', color: '#1e1b4b', isWin: false },
    { label: 'Free Ship', value: 'FREESHIP', color: '#6366f1', isWin: true },
    { label: 'Try Again', value: 'LOSE', color: '#312e81', isWin: false },
    { label: '50% OFF', value: 'SAVE50', color: '#f59e0b', isWin: true },
    { label: 'No Luck', value: 'LOSE', color: '#4338ca', isWin: false },
  ];

  const triggerSpin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setWonPrize(null);

    // Pick a random prize to land on
    const winningIndex = Math.floor(Math.random() * slices.length);
    const selectedSlice = slices[winningIndex];

    const sliceAngle = 360 / slices.length;
    // Calculate ending angle: minimum 5 rotations + offset to land exactly in the center of the winning slice
    const totalRotation = angle + (360 * 5) + (360 - (winningIndex * sliceAngle) - (sliceAngle / 2));
    
    setAngle(totalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      setWonPrize(selectedSlice);
    }, 5000); // matching the transition duration
  };

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <div className="w-full flex flex-col items-center justify-center my-4 overflow-hidden" style={block.styles}>
      
      {/* Outer wrapper with the wheel indicator peg */}
      <div className="relative w-[280px] h-[280px] flex items-center justify-center p-2 rounded-full bg-slate-900 border-4 border-slate-800 shadow-2xl">
        
        {/* Peg Pointer at top */}
        <div className="absolute top-[-6px] left-1/2 transform -translate-x-1/2 w-6 h-7 bg-amber-500 rounded-b-full shadow-lg z-20 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" />
        </div>

        {/* The rotating wheel SVG */}
        <div 
          className="w-full h-full rounded-full overflow-hidden shadow-inner"
          style={{
            transform: `rotate(${angle}deg)`,
            transition: isSpinning ? 'transform 5000ms cubic-bezier(0.15, 0.85, 0.25, 1)' : 'none'
          }}
        >
          <svg viewBox="0 0 300 300" className="w-full h-full">
            {slices.map((slice: any, i: number) => {
              const sliceAngle = 360 / slices.length;
              const startAngleRad = (i * sliceAngle - 90) * Math.PI / 180;
              const endAngleRad = ((i + 1) * sliceAngle - 90) * Math.PI / 180;

              const x1 = 150 + 140 * Math.cos(startAngleRad);
              const y1 = 150 + 140 * Math.sin(startAngleRad);
              const x2 = 150 + 140 * Math.cos(endAngleRad);
              const y2 = 150 + 140 * Math.sin(endAngleRad);

              // Large arc flag is 0 because each sector is always less than 180 degrees
              const pathData = `M 150 150 L ${x1} ${y1} A 140 140 0 0 1 ${x2} ${y2} Z`;

              // Text coordinates
              const textAngleRad = (i * sliceAngle + sliceAngle / 2 - 90) * Math.PI / 180;
              const textX = 150 + 80 * Math.cos(textAngleRad);
              const textY = 150 + 80 * Math.sin(textAngleRad);

              return (
                <g key={i}>
                  <path d={pathData} fill={slice.color || '#cccccc'} stroke="#ffffff" strokeWidth="2" />
                  <text
                    x={textX}
                    y={textY}
                    fill="#ffffff"
                    fontFamily="sans-serif"
                    fontSize="11"
                    fontWeight="900"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${(i * sliceAngle + sliceAngle / 2)}, ${textX}, ${textY})`}
                  >
                    {slice.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Center Peg button */}
        <button
          onClick={triggerSpin}
          disabled={isSpinning}
          className={cn(
            "absolute w-14 h-14 rounded-full bg-slate-950 border-[3px] border-white shadow-xl flex items-center justify-center font-black text-xs text-white z-10 transition-transform active:scale-95",
            isSpinning ? 'cursor-not-allowed opacity-80' : 'hover:scale-105'
          )}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
          {isSpinning ? '⚡' : 'SPIN'}
        </button>
      </div>

      {/* Won Prize Popup */}
      {wonPrize && (
        <div className="mt-4 px-4 py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-sans text-center flex flex-col items-center gap-1 max-w-[260px] animate-in zoom-in-95 duration-300">
          <div className="flex items-center gap-1.5 font-extrabold text-sm">
            <Sparkles className="w-4 h-4 text-amber-500" />
            {wonPrize.isWin ? 'Congratulations! 🎉' : 'Bummer! 🥺'}
          </div>
          <span className="text-xs font-semibold opacity-90">
            {wonPrize.isWin ? `You won: ${wonPrize.label}` : 'Better luck on your next spin!'}
          </span>
          {wonPrize.isWin && wonPrize.value && (
            <div className="mt-1 px-3 py-1 font-mono font-bold text-sm bg-emerald-500/20 rounded border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 select-all cursor-pointer">
              {wonPrize.value}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface LivePreviewProps {
  formData: FormDataShape;
}

export const LivePreview: React.FC<LivePreviewProps> = ({ formData }) => {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [activeState, setActiveState] = useState<'teaser' | 'main' | 'success'>('main');
  const simulatorRef   = useRef<HTMLDivElement>(null);
  const popupCardRef   = useRef<HTMLDivElement>(null);
  const [phoneScale, setPhoneScale] = useState(0.75);
  const [desktopZoom, setDesktopZoom] = useState(1);

  // Scale the phone frame to fit the available simulator area
  useEffect(() => {
    const el = simulatorRef.current;
    if (!el) return;
    const compute = () => {
      const { width, height } = el.getBoundingClientRect();
      const padding = 48; // p-6 = 24px each side
      const scale = Math.min(
        (width  - padding) / 375,
        (height - padding) / 812,
        1, // never upscale
      );
      setPhoneScale(Math.max(scale, 0.3));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode]);

  // Zoom the popup in desktop mode so the whole design fits the frame.
  // The popup card has no CSS zoom/transform on it, so scrollHeight is the true natural size.
  useEffect(() => {
    if (viewMode !== 'desktop' || activeState === 'teaser') {
      setDesktopZoom(1);
      return;
    }
    const popup = popupCardRef.current;
    const frame = simulatorRef.current;
    if (!popup || !frame) return;

    const naturalH = popup.scrollHeight;  // no CSS zoom on this element — this is the real height
    const naturalW = popup.scrollWidth;
    const frameH   = frame.clientHeight - 48;
    const frameW   = frame.clientWidth  - 48;

    if (naturalH <= 0 || naturalW <= 0) return;

    const zoom = Math.min(frameH / naturalH, frameW / naturalW, 1);
    setDesktopZoom(Math.max(zoom, 0.25));
  }, [viewMode, activeState, formData.elements, formData.layoutMode, formData.padding, formData.gap]);

  // Returns absolute-positioning + scale transform for the popup wrapper.
  // Scaling is via transform (not CSS zoom) so it never corrupts position or animations.
  const getPopupWrapperStyle = (): React.CSSProperties => {
    const zoom = viewMode === 'desktop' ? desktopZoom : 1;
    const p = 16;

    if (activeState === 'teaser') {
      const pos = formData.teaserPosition || 'bottom-right';
      return pos === 'bottom-left'
        ? { position: 'absolute', bottom: p, left: p, zIndex: 50, pointerEvents: 'none' }
        : { position: 'absolute', bottom: p, right: p, zIndex: 50, pointerEvents: 'none' };
    }

    // Bar / banner: pin to edge, full width, no padding
    if (formData.kind === 'bar' || formData.kind === 'banner') {
      const isTop = (formData.position ?? 'top-center').startsWith('top');
      return { position: 'absolute', ...(isTop ? { top: 0 } : { bottom: 0 }), left: 0, right: 0, zIndex: 50, pointerEvents: 'none' };
    }

    const origins: Record<string, string> = {
      'top-left':      'left top',     'top-center':    'center top',    'top-right':     'right top',
      'center-left':   'left center',  'center':        'center center', 'center-right':  'right center',
      'bottom-left':   'left bottom',  'bottom-center': 'center bottom', 'bottom-right':  'right bottom',
    };
    const key = formData.position ?? 'center';
    const base: React.CSSProperties = {
      position: 'absolute',
      zIndex: 50,
      pointerEvents: 'none',
      transformOrigin: origins[key] ?? 'center center',
    };

    switch (key) {
      case 'top-left':      return { ...base, top: p, left: p,     transform: `scale(${zoom})` };
      case 'top-center':    return { ...base, top: p, left: '50%', transform: `translateX(-50%) scale(${zoom})` };
      case 'top-right':     return { ...base, top: p, right: p,    transform: `scale(${zoom})` };
      case 'center-left':   return { ...base, top: '50%', left: p,     transform: `translateY(-50%) scale(${zoom})` };
      case 'center':        return { ...base, top: '50%', left: '50%', transform: `translate(-50%, -50%) scale(${zoom})` };
      case 'center-right':  return { ...base, top: '50%', right: p,    transform: `translateY(-50%) scale(${zoom})` };
      case 'bottom-left':   return { ...base, bottom: p, left: p,     transform: `scale(${zoom})` };
      case 'bottom-center': return { ...base, bottom: p, left: '50%', transform: `translateX(-50%) scale(${zoom})` };
      case 'bottom-right':  return { ...base, bottom: p, right: p,    transform: `scale(${zoom})` };
      default:              return { ...base, top: '50%', left: '50%', transform: `translate(-50%, -50%) scale(${zoom})` };
    }
  };

  const getSizeClasses = () => {
    if (activeState === 'teaser') return 'w-auto max-w-xs';
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
      case 'fade':       return 'animate-in fade-in duration-500';
      case 'slide_down': return 'animate-in slide-in-from-top-8 fade-in duration-500';
      case 'zoom':       return 'animate-in zoom-in-95 fade-in duration-500';
      case 'bounce':     return 'sp-anim-bounce';
      case 'elastic':    return 'sp-anim-elastic';
      case 'flip_in':    return 'sp-anim-flip-in';
      case 'none':       return '';
      case 'slide_up':
      default:           return 'animate-in slide-in-from-bottom-8 fade-in duration-500';
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
      case 'timer': {
        const minutes = block.props?.minutes || 15;
        const color = block.props?.color || '#ef4444';
        return (
          <div key={idx} className="flex items-center justify-center gap-4 my-4" style={block.styles}>
            {['00', '00', String(minutes).padStart(2, '0'), '00'].map((num, i) => (
              <div key={i} className="flex flex-col items-center">
                <div 
                  className="bg-slate-900 font-mono text-2xl px-3 py-2 rounded-lg shadow-inner border"
                  style={{ borderColor: `${color}30`, color: color }}
                >
                  {num}
                </div>
                <span className="text-[10px] uppercase font-bold mt-1 opacity-70" style={{ color: color }}>
                  {i === 0 ? 'Days' : i === 1 ? 'Hrs' : i === 2 ? 'Min' : 'Sec'}
                </span>
              </div>
            ))}
          </div>
        );
      }
      case 'form': {
        const fields = block.props?.fields || 'email';
        const placeholder = block.props?.placeholder || 'Enter your email…';
        const btnColor = block.props?.buttonColor || '#6366f1';
        const inputCls = 'w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none bg-white/60 backdrop-blur-sm text-sm';
        return (
          <div key={idx} className="flex flex-col gap-2 my-3" style={block.styles}>
            {(fields === 'name_email') && (
              <input type="text" placeholder="Your name…" className={inputCls} />
            )}
            {(fields === 'email' || fields === 'name_email' || fields === 'phone_email') && (
              <input type="email" placeholder={fields === 'phone_email' ? 'Email address…' : placeholder} className={inputCls} />
            )}
            {(fields === 'phone' || fields === 'phone_email') && (
              <input type="tel" placeholder="Phone number…" className={inputCls} />
            )}
            <button
              className="w-full py-3 px-6 rounded-xl font-bold shadow-lg transition-transform hover:scale-[1.02] text-white text-sm"
              style={{ backgroundColor: btnColor }}
            >
              {block.content || 'Subscribe'}
            </button>
          </div>
        );
      }
      case 'coupon':
        return (
          <div 
            key={idx} 
            className="flex items-center justify-center gap-2 p-3 my-2 border-2 border-dashed rounded-xl bg-slate-50 dark:bg-slate-950/30" 
            style={{ 
              borderColor: formData.accentColor,
              ...block.styles 
            }}
          >
            <span className="font-mono font-bold tracking-widest text-sm text-slate-800 dark:text-slate-200 uppercase select-all cursor-pointer">
              {block.content || 'WELCOME10'}
            </span>
          </div>
        );
      case 'spacer':
        return <div key={idx} style={{ height: block.props?.height || '20px' }} />;
      case 'scratch_card':
        return (
          <ScratchCardBlock key={block.id || idx} block={block} accentColor={formData.accentColor} />
        );
      case 'wheel':
        return (
          <SpinWheelBlock key={block.id || idx} block={block} accentColor={formData.accentColor} />
        );
      default:
        return null;
    }
  };

  const overlayBgColor = `rgba(15, 23, 42, ${formData.overlayOpacity})`;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden font-sans">

      {/* ── Top chrome: step tabs + device toggle ────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px', height: 44, flexShrink: 0,
        background: '#ffffff', borderBottom: '1px solid #e4e4e7',
      }}>
        {/* Step state tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 1, background: '#f4f4f5', borderRadius: 7, padding: '3px' }}>
          {([
            { id: 'teaser',  label: 'Teaser Badge' },
            { id: 'main',    label: 'Main View' },
            { id: 'success', label: 'Success' },
          ] as const).map(s => {
            const active = activeState === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveState(s.id)}
                style={{
                  padding: '4px 10px', borderRadius: 5, fontSize: 10, fontWeight: active ? 600 : 500,
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                  background: active ? '#18181b' : 'transparent',
                  color: active ? '#ffffff' : '#71717a',
                  border: 'none', cursor: 'pointer', transition: 'all 0.12s',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Device toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 1, background: '#f4f4f5', borderRadius: 7, padding: '3px' }}>
          <button
            onClick={() => setViewMode('desktop')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 5, fontSize: 10, fontWeight: viewMode === 'desktop' ? 600 : 500,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
              background: viewMode === 'desktop' ? '#18181b' : 'transparent',
              color: viewMode === 'desktop' ? '#ffffff' : '#71717a',
              border: 'none', cursor: 'pointer', transition: 'all 0.12s',
            }}
          >
            <Monitor size={11} /> Desktop
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 5, fontSize: 10, fontWeight: viewMode === 'mobile' ? 600 : 500,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
              background: viewMode === 'mobile' ? '#18181b' : 'transparent',
              color: viewMode === 'mobile' ? '#ffffff' : '#71717a',
              border: 'none', cursor: 'pointer', transition: 'all 0.12s',
            }}
          >
            <Smartphone size={11} /> Mobile
          </button>
        </div>
      </div>

      {/* Device Simulator Container */}
      <div ref={simulatorRef} className="flex-1 bg-zinc-100 p-6 flex items-center justify-center overflow-hidden">

        <div
          className={cn(
            "relative bg-white shadow-xl overflow-hidden transition-all duration-500 origin-center ring-1 ring-zinc-300/60",
            viewMode === 'mobile'
              ? "w-[375px] h-[812px] rounded-[3rem] ring-[12px] ring-zinc-300"
              : "w-full rounded-xl"
          )}
          style={
            viewMode === 'desktop'
              ? { width: '100%', maxWidth: 820, height: '100%' }
              : { transform: `scale(${phoneScale})`, transformOrigin: 'center center', flexShrink: 0 }
          }
        >
          {/* Mock Website Background */}
          <div className="absolute inset-0 bg-white pointer-events-none flex flex-col items-center pt-20 gap-8">
            <div className="w-3/4 h-8 bg-zinc-200 rounded-lg animate-pulse" />
            <div className="w-1/2 h-4 bg-zinc-200 rounded-lg animate-pulse delay-75" />
            <div className="w-full max-w-2xl h-64 bg-zinc-100 rounded-2xl animate-pulse delay-150 mx-8" />
            <div className="w-2/3 h-4 bg-zinc-200 rounded-lg animate-pulse delay-200" />
            <div className="w-1/3 h-4 bg-zinc-200 rounded-lg animate-pulse delay-300" />
          </div>

          {/* Dim overlay — background only, no layout role */}
          {activeState !== 'teaser' && formData.overlayEnabled && (formData.kind === 'modal' || formData.kind === 'fullscreen') && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: overlayBgColor, pointerEvents: 'none', zIndex: 49 }} />
          )}

          {/* Popup wrapper — absolutely placed + scaled; no zoom on the card itself */}
          <div style={getPopupWrapperStyle()}>
            {/* The Actual Display Ad */}
            <div
              ref={popupCardRef}
              className={cn(
                "pointer-events-auto relative overflow-hidden flex flex-col transition-all duration-300",
                getSizeClasses(),
                getAnimationClass(),
                activeState !== 'teaser' && (formData.kind === 'banner' || formData.kind === 'bar') ? 'w-full' : '',
                activeState !== 'teaser' && formData.kind === 'fullscreen' ? 'max-w-none' : ''
              )}
              style={activeState === 'teaser' ? {
                backgroundColor: formData.backgroundColor,
                color: formData.textColor,
                borderRadius: '9999px',
                padding: '12px 24px',
                border: `1px solid ${formData.accentColor}30`,
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
                cursor: 'pointer',
              } : {
                backgroundColor: formData.backgroundColor,
                color: formData.textColor,
                borderRadius: formData.kind === 'bar' || formData.kind === 'fullscreen' ? 0 : `${formData.borderRadius}px`,
                backgroundImage: formData.backgroundImage ? `url(${formData.backgroundImage})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                boxShadow: (() => {
                  switch (formData.boxShadow) {
                    case 'soft': return '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 8px -1px rgba(0, 0, 0, 0.03)';
                    case 'medium': return '0 10px 30px -4px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.04)';
                    case 'floating': return '0 20px 50px -12px rgba(0, 0, 0, 0.15), 0 8px 24px -4px rgba(0, 0, 0, 0.08)';
                    case 'premium': return '0 30px 70px -10px rgba(0, 0, 0, 0.2), 0 12px 30px -4px rgba(0, 0, 0, 0.1)';
                    case 'glass': return '0 8px 32px 0 rgba(0, 0, 0, 0.08)';
                    case 'dark': return '0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 20px 2px rgba(99, 102, 241, 0.15)';
                    case 'none': return 'none';
                    default: return '0 20px 50px -12px rgba(0, 0, 0, 0.15)';
                  }
                })(),
                backdropFilter: formData.boxShadow === 'glass' ? 'blur(12px)' : 'none',
                WebkitBackdropFilter: formData.boxShadow === 'glass' ? 'blur(12px)' : 'none',
                margin: formData.margin || '0px',
                // No CSS zoom here — scaling is handled by transform on the wrapper above
              }}
            >
              
              {/* Close Button */}
              {activeState !== 'teaser' && formData.showCloseButton && (
                <button
                  className={cn(
                    "absolute w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-current transition-colors z-50",
                    formData.closeButtonPosition === 'top-left' ? 'top-4 left-4' : 'top-4 right-4'
                  )}
                >
                  <X className="w-4 h-4 opacity-70" />
                </button>
              )}

              {/* Teaser rendering */}
              {activeState === 'teaser' ? (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                  <span className="text-sm font-bold tracking-tight whitespace-nowrap">
                    {formData.teaserHeadline || '⚡ Special Promotion!'}
                  </span>
                </div>
              ) : activeState === 'success' ? (
                /* Success rendering */
                <div 
                  className="flex-1 flex flex-col items-center justify-center text-center p-8 min-h-[250px] animate-in zoom-in-95 duration-300"
                  style={{
                    padding: formData.padding || '24px',
                    gap: formData.gap || '12px',
                  }}
                >
                  <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-2 animate-bounce">
                    <Sparkles className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h4 className="font-extrabold text-2xl tracking-tight mb-0 leading-tight">
                    {formData.successHeadline || 'Thank You!'}
                  </h4>
                  <p className="text-sm opacity-80 leading-relaxed max-w-sm">
                    {formData.successBody || 'Your submission has been received successfully.'}
                  </p>
                </div>
              ) : formData.layoutMode === 'blocks' && formData.elements ? (
                /* Layout Rendering Engine */
                <div
                  className="w-full flex flex-col relative z-10"
                  style={{
                    padding: formData.padding || '24px',
                    gap: formData.gap || '12px',
                  }}
                >
                  {formData.elements.map((block, idx) => renderBlock(block, idx))}
                </div>
              ) : (
                /* Legacy Layout Fallback (For backwards compatibility during rollout) */
                <div className="flex flex-col h-full relative z-10">
                  {formData.imageUrl && formData.kind !== 'fullscreen' && formData.kind !== 'bar' && (
                    <img loading="lazy" src={formData.imageUrl} alt="Preview" className="w-full h-40 md:h-56 object-cover" />
                  )}
                  
                  <div 
                    className={cn(
                      "flex-1 flex flex-col",
                      formData.kind === 'fullscreen' ? 'items-center justify-center text-center' : ''
                    )}
                    style={{
                      padding: formData.padding || '24px',
                      gap: formData.gap || '12px',
                    }}
                  >
                    <h4 className="font-extrabold text-2xl md:text-3xl tracking-tight mb-0 leading-tight">
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
