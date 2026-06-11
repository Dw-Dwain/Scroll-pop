import React, { useRef, useState, useEffect } from 'react';
import { motion, type Variants } from 'motion/react';
import {
  Maximize2,
  Star,
  QrCode,
  RotateCw,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  Grid,
  ZoomIn,
  ZoomOut,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkle
} from 'lucide-react';
import { CampaignElement, CampaignStepConfig, DragState } from './types';

// Injected once — shared keyframes for popup entrance + element animations
const CANVAS_KEYFRAMES = `
@keyframes sp-scale-up   { from { opacity:0; transform:scale(0.75) }      to { opacity:1; transform:scale(1) } }
@keyframes sp-fade-in    { from { opacity:0 }                             to { opacity:1 } }
@keyframes sp-slide-up   { from { opacity:0; transform:translateY(60px) } to { opacity:1; transform:translateY(0) } }
@keyframes sp-slide-down { from { opacity:0; transform:translateY(-60px)} to { opacity:1; transform:translateY(0) } }
@keyframes sp-bounce     { 0%{opacity:0;transform:scale(0.3)} 55%{transform:scale(1.08)} 75%{transform:scale(0.95)} 100%{opacity:1;transform:scale(1)} }
`;
// Inject once at module level
if (typeof document !== 'undefined' && !document.getElementById('sp-canvas-keyframes')) {
  const s = document.createElement('style');
  s.id = 'sp-canvas-keyframes';
  s.textContent = CANVAS_KEYFRAMES;
  document.head.appendChild(s);
}

// Animation variants generator for element-level transitions
const getAnimationVariants = (type: string): Variants => {
  switch (type) {
    case 'fade-in':
      return {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      };
    case 'slide-in':
      return {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0 },
      };
    case 'bounce':
      return {
        hidden: { opacity: 0, scale: 0.3 },
        visible: { 
          opacity: 1, 
          scale: 1,
          transition: { type: 'spring', damping: 12, stiffness: 120 }
        },
      };
    case 'zoom-in':
      return {
        hidden: { opacity: 0, scale: 0.7 },
        visible: { opacity: 1, scale: 1 },
      };
    case 'spin':
      return {
        hidden: { opacity: 0, rotate: -180, scale: 0.5 },
        visible: { opacity: 1, rotate: 0, scale: 1 },
      };
    case 'flip':
      return {
        hidden: { opacity: 0, rotateY: 90 },
        visible: { opacity: 1, rotateY: 0 },
      };
    default:
      return {
        hidden: {},
        visible: {},
      };
  }
};

interface CanvasProps {
  stepConfig: CampaignStepConfig;
  selectedElementId: string | null;
  deviceMode: 'desktop' | 'tablet' | 'mobile';
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, keyOrObj: string | Record<string, unknown>, value?: unknown) => void;
  onUpdateStepConfig: (key: string, value: unknown) => void;
}

export default function Canvas({
  stepConfig,
  selectedElementId,
  deviceMode,
  onSelectElement,
  onUpdateElement,
  onUpdateStepConfig,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // High-End Workspace UI States
  const [canvasZoom, setCanvasZoom] = useState<number>(1);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showWireframes, setShowWireframes] = useState<boolean>(true);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [isEditingText, setIsEditingText] = useState<string | null>(null);

  const [dragState, setDragState] = useState<DragState & { startRotation?: number }>({
    elementId: null,
    dragStartX: 0,
    dragStartY: 0,
    elemStartX: 0,
    elemStartY: 0,
    action: null,
  });

  const [guidelines, setGuidelines] = useState<{ x?: number; y?: number; xLabel?: string; yLabel?: string }>({});

  // Determine scaling based on device preview mode
  let frameWidth = '100%';
  const containerScale = canvasZoom;
  
  if (deviceMode === 'tablet') {
    frameWidth = '768px';
  } else if (deviceMode === 'mobile') {
    frameWidth = '410px';
  }

  let frameHeight = '600px';
  if (deviceMode === 'tablet') {
    frameHeight = '850px';
  } else if (deviceMode === 'mobile') {
    frameHeight = '720px';
  }

  const getAlignmentClasses = () => {
    if (stepConfig.popupType === 'stickybar') {
      return stepConfig.position === 'top' ? 'items-start justify-center' : 'items-end justify-center';
    }
    
    switch (stepConfig.position) {
      case 'top-left':
        return 'items-start justify-start p-6';
      case 'top':
        return 'items-start justify-center p-6';
      case 'top-right':
        return 'items-start justify-end p-6';
      case 'left':
        return 'items-center justify-start p-6';
      case 'right':
        return 'items-center justify-end p-6';
      case 'bottom-left':
        return 'items-end justify-start p-6';
      case 'bottom':
        return 'items-end justify-center p-6';
      case 'bottom-right':
        return 'items-end justify-end p-6';
      case 'center':
      default:
        return 'items-center justify-center p-6';
    }
  };

  // Handle Drag Start (Supporting Drag, Resize & Rotation)
  const handleDragStart = (
    e: React.MouseEvent, 
    el: CampaignElement, 
    action: 'drag' | 'resize' | 'rotate', 
    handle?: string
  ) => {
    e.stopPropagation();
    onSelectElement(el.id);
    setIsEditingText(null);

    // If locked, prevent editing / manipulation
    if (el.extraProps?.isLocked && action !== 'drag') {
      // Allow selecting but prevent movement
      return;
    }

    const clientX = e.clientX;
    const clientY = e.clientY;

    if (action === 'rotate' && containerRef.current) {
      // Find element absolute center point to calculate angles
      const elementNode = document.getElementById(`canvas-elem-${el.id}`);
      if (elementNode) {
        const rect = elementNode.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        setDragState({
          elementId: el.id,
          dragStartX: centerX,
          dragStartY: centerY,
          elemStartX: el.x,
          elemStartY: el.y,
          action: 'rotate',
          startRotation: (el.extraProps?.rotation as number) || 0,
        });
      }
      return;
    }

    setDragState({
      elementId: el.id,
      dragStartX: clientX,
      dragStartY: clientY,
      elemStartX: el.x,
      elemStartY: el.y,
      elemStartW: el.w,
      elemStartH: el.h,
      action: action === 'drag' && el.extraProps?.isLocked ? null : action,
      resizeHandle: handle,
    });
  };

  // Keyboard nudging — select an element, then use arrow keys for precise, snap-free
  // placement (the mouse drag snaps to alignment guides, which can feel "sticky"). Arrow =
  // 1%, Shift+Arrow = 5%. Ignored while typing in an input/textarea so text editing is safe.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!selectedElementId) return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const el = stepConfig.elements.find((item) => item.id === selectedElementId);
      if (!el) return;
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      const clamp = (n: number) => Math.max(0, Math.min(100, n));
      let { x, y } = el;
      if (e.key === 'ArrowUp') y = clamp(y - step);
      else if (e.key === 'ArrowDown') y = clamp(y + step);
      else if (e.key === 'ArrowLeft') x = clamp(x - step);
      else if (e.key === 'ArrowRight') x = clamp(x + step);
      onUpdateElement(selectedElementId, { x, y });
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedElementId, stepConfig.elements, onUpdateElement]);

  // Drag & Motion Tracker Event Loop
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.elementId || !dragState.action || !containerRef.current) return;
      
      const el = stepConfig.elements.find((item) => item.id === dragState.elementId);
      if (!el || el.extraProps?.isLocked) return;

      const rect = containerRef.current.getBoundingClientRect();
      const containerW = rect.width;
      const containerH = rect.height;

      // Delta in pixels from dragging origin
      const deltaX = e.clientX - dragState.dragStartX;
      const deltaY = e.clientY - dragState.dragStartY;

      if (dragState.action === 'drag') {
        // Convert screen offset pixels to layout percentage points (0-100)
        // Adjust for current canvas zoom factor
        const pctDeltaX = (deltaX / (containerW)) * 100;
        const pctDeltaY = (deltaY / (containerH)) * 100;

        let newX = Math.round(dragState.elemStartX + pctDeltaX);
        let newY = Math.round(dragState.elemStartY + pctDeltaY);

        // Grid boundaries constraint checking
        newX = Math.max(0, Math.min(100 - el.w, newX));
        newY = Math.max(0, Math.min(100 - el.h, newY));

        // Precision visual alignment snap helpers
        const snapsX = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90];
        const snapsY = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90];
        // Lower threshold = less "magnetic" snapping, so dragging feels free-flowing and only
        // snaps when you're genuinely close to an alignment line (was 2.5, which felt sticky).
        const snapThreshold = 1.2;
        
        let snapX: number | undefined;
        let snapY: number | undefined;
        let xLabel: string | undefined;
        let yLabel: string | undefined;

        snapsX.forEach(s => {
          if (Math.abs(newX - s) < snapThreshold) {
            newX = s;
            snapX = s;
            xLabel = `X Snap: ${s}%`;
          }
          // Aligning with central spine
          if (Math.abs((newX + el.w / 2) - s) < snapThreshold) {
            newX = s - Math.round(el.w / 2);
            snapX = s;
            xLabel = `Spine Center: ${s}%`;
          }
        });

        snapsY.forEach(s => {
          if (Math.abs(newY - s) < snapThreshold) {
            newY = s;
            snapY = s;
            yLabel = `Y Snap: ${s}%`;
          }
          if (Math.abs((newY + el.h / 2) - s) < snapThreshold) {
            newY = s - Math.round(el.h / 2);
            snapY = s;
            yLabel = `Spine Center: ${s}%`;
          }
        });

        setGuidelines({ x: snapX, y: snapY, xLabel, yLabel } as { x?: number; y?: number; xLabel?: string; yLabel?: string });
        onUpdateElement(el.id, { x: newX, y: newY });

      } else if (dragState.action === 'resize') {
        const handle = dragState.resizeHandle;
        const pctDeltaX = (deltaX / containerW) * 100;
        const pctDeltaY = (deltaY / containerH) * 100;

        const startW = dragState.elemStartW || el.w;
        const startH = dragState.elemStartH || el.h;
        const startX = dragState.elemStartX || el.x;
        const startY = dragState.elemStartY || el.y;

        // Mathematical Resize updates supporting all 8 anchors
        if (handle === 'e') {
          const newW = Math.max(5, Math.min(100 - el.x, Math.round(startW + pctDeltaX)));
          onUpdateElement(el.id, { w: newW });
        } else if (handle === 's') {
          const newH = Math.max(5, Math.min(100 - el.y, Math.round(startH + pctDeltaY)));
          onUpdateElement(el.id, { h: newH });
        } else if (handle === 'se') {
          const newW = Math.max(5, Math.min(100 - el.x, Math.round(startW + pctDeltaX)));
          const newH = Math.max(5, Math.min(100 - el.y, Math.round(startH + pctDeltaY)));
          onUpdateElement(el.id, { w: newW, h: newH });
        } else if (handle === 'w') {
          let newX = Math.round(startX + pctDeltaX);
          newX = Math.max(0, Math.min(startX + startW - 5, newX));
          const newW = startX + startW - newX;
          onUpdateElement(el.id, { x: newX, w: newW });
        } else if (handle === 'n') {
          let newY = Math.round(startY + pctDeltaY);
          newY = Math.max(0, Math.min(startY + startH - 5, newY));
          const newH = startY + startH - newY;
          onUpdateElement(el.id, { y: newY, h: newH });
        } else if (handle === 'nw') {
          let newX = Math.round(startX + pctDeltaX);
          newX = Math.max(0, Math.min(startX + startW - 5, newX));
          const newW = startX + startW - newX;

          let newY = Math.round(startY + pctDeltaY);
          newY = Math.max(0, Math.min(startY + startH - 5, newY));
          const newH = startY + startH - newY;

          onUpdateElement(el.id, { x: newX, w: newW, y: newY, h: newH });
        } else if (handle === 'ne') {
          let newY = Math.round(startY + pctDeltaY);
          newY = Math.max(0, Math.min(startY + startH - 5, newY));
          const newH = startY + startH - newY;
          const newW = Math.max(5, Math.min(100 - el.x, Math.round(startW + pctDeltaX)));

          onUpdateElement(el.id, { y: newY, h: newH, w: newW });
        } else if (handle === 'sw') {
          let newX = Math.round(startX + pctDeltaX);
          newX = Math.max(0, Math.min(startX + startW - 5, newX));
          const newW = startX + startW - newX;
          const newH = Math.max(5, Math.min(100 - el.y, Math.round(startH + pctDeltaY)));

          onUpdateElement(el.id, { x: newX, w: newW, h: newH });
        }

      } else if (dragState.action === 'rotate') {
        // Angle Calculation based on origin element center point coordinates
        const dx = e.clientX - dragState.dragStartX;
        const dy = e.clientY - dragState.dragStartY;
        const angleRad = Math.atan2(dy, dx);
        
        // Convert to polar degree points (+90 adjusts alignment angle stalk offset)
        let angleDeg = Math.round((angleRad * 180) / Math.PI) + 90;
        if (angleDeg < 0) angleDeg += 360;

        // Snaps lock rotation limits to 0, 45, 90, 180 indices
        const snappingAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
        snappingAngles.forEach(snap => {
          if (Math.abs(angleDeg - snap) < 4.5) {
            angleDeg = snap === 360 ? 0 : snap;
          }
        });

        onUpdateElement(el.id, 'extraProps', {
          ...(el.extraProps || {}),
          rotation: angleDeg
        });
      }
    };

    const handleMouseUp = () => {
      if (dragState.elementId) {
        setDragState({
          elementId: null,
          dragStartX: 0,
          dragStartY: 0,
          elemStartX: 0,
          elemStartY: 0,
          action: null,
        });
        setGuidelines({});
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, stepConfig.elements]); // eslint-disable-line react-hooks/exhaustive-deps

  // Craft.js Style Inline Layer Manipulation Triggers
  const handleDuplicate = (e: React.MouseEvent, el: CampaignElement) => {
    e.stopPropagation();
    const cloned: CampaignElement = JSON.parse(JSON.stringify(el));
    cloned.id = `${el.type}-${Date.now()}`;
    cloned.x = Math.min(85, el.x + 3);
    cloned.y = Math.min(85, el.y + 3);
    cloned.zIndex = Math.max(...stepConfig.elements.map(item => item.zIndex), 0) + 1;
    // Remove locked state on duplication
    if (cloned.extraProps) {
      cloned.extraProps.isLocked = false;
    }
    onUpdateStepConfig('elements', [...stepConfig.elements, cloned]);
    onSelectElement(cloned.id);
  };

  const handleDelete = (e: React.MouseEvent, elId: string) => {
    e.stopPropagation();
    const filtered = stepConfig.elements.filter(item => item.id !== elId);
    onUpdateStepConfig('elements', filtered);
    onSelectElement(null);
  };

  const handleToggleLock = (e: React.MouseEvent, el: CampaignElement) => {
    e.stopPropagation();
    const isLockedNow = !el.extraProps?.isLocked;
    onUpdateElement(el.id, 'extraProps', {
      ...(el.extraProps || {}),
      isLocked: isLockedNow
    });
  };

  const handleLayerOrder = (e: React.MouseEvent, el: CampaignElement, order: 'up' | 'down') => {
    e.stopPropagation();
    const delta = order === 'up' ? 1 : -1;
    onUpdateElement(el.id, 'zIndex', Math.max(1, (el.zIndex || 1) + delta));
  };

  const handleUpdateAlign = (e: React.MouseEvent, el: CampaignElement, alignment: 'left' | 'center' | 'right') => {
    e.stopPropagation();
    onUpdateElement(el.id, 'align', alignment);
  };

  return (
    <div className="flex-1 bg-zinc-50 border-r border-zinc-200 flex flex-col relative select-none overflow-hidden" id="campaign-designer-canvas-frame">
      
      {/* PUCK STYLE BREADCRUMB / VIEWPORT STATUS BAR */}
      <div className="ds-chrome h-11 border-b border-zinc-200 bg-white px-5 flex items-center justify-between shrink-0 font-sans z-20">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-zinc-400 font-mono tracking-wider uppercase">Hierarchy</span>
          <span className="text-zinc-300 text-[10px]">/</span>
          <span className="text-xs font-semibold text-zinc-800">Campaign Wrapper</span>
          <span className="text-zinc-300 text-[10px]">&gt;</span>
          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold font-mono text-[9px] uppercase tracking-wider">
            {stepConfig.popupType} step:
          </span>
          <span className="text-xs font-bold text-zinc-900 border-b border-zinc-900 leading-none">
            {stepConfig.position}
          </span>
        </div>

        {/* Viewport display grids inspector toggles */}
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-zinc-200 p-0.5 rounded-lg bg-zinc-50">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${showGrid ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-400 hover:text-zinc-600'}`}
              title="Toggle Layout Aligner Grid (GrapesJS)"
            >
              <Grid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowWireframes(!showWireframes)}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${showWireframes ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-400 hover:text-zinc-600'}`}
              title="Toggle Wireframe Outline Outliner"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-zinc-200" />

          {/* Canvas ZOOM scale widget controller */}
          <div className="flex items-center gap-1.5 bg-zinc-100 rounded-lg p-0.5">
            <button
              onClick={() => setCanvasZoom(Math.max(0.5, canvasZoom - 0.1))}
              className="p-1 text-zinc-500 hover:text-zinc-900 rounded hover:bg-white cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <span 
              onClick={() => setCanvasZoom(1)}
              className="text-[10px] font-mono font-bold text-zinc-700 px-1 hover:text-black cursor-pointer bg-white rounded shadow-xs"
              title="Reset Zoom to 100%"
            >
              {Math.round(canvasZoom * 100)}%
            </span>
            <button
              onClick={() => setCanvasZoom(Math.min(1.5, canvasZoom + 0.1))}
              className="p-1 text-zinc-500 hover:text-zinc-900 rounded hover:bg-white cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* CORE CANVAS WORKSPACE CONTAINER */}
      <div
        className="ds-canvas-surface flex-1 relative flex items-center justify-center p-12 overflow-auto"
        onClick={() => onSelectElement(null)}
        style={{
          // backgroundColor comes from .ds-canvas-surface (theme-aware); the popup being
          // designed keeps its own configured colors.
          backgroundImage: showGrid ? 'radial-gradient(var(--ds-canvas-dot) 1.2px, transparent 1.2px)' : 'none',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Viewport Box scaled dynamic boundary framework representing simulated browser screen */}
        <div 
          className={`relative transition-all duration-150 border border-zinc-250/90 bg-white shadow-xl rounded-xl overflow-hidden flex ${getAlignmentClasses()}`}
          style={{ 
            width: frameWidth,
            height: frameHeight,
            transform: `scale(${containerScale})`,
            transformOrigin: 'center center',
            zIndex: 10
          }}
        >
          {/* Background Simulated Page/Shop Elements underneath the campaign step */}
          <div className="absolute inset-0 w-full h-full pointer-events-none bg-zinc-50 flex flex-col p-8 opacity-30 select-none">
            <div className="flex justify-between items-center mb-8 border-b border-zinc-200 pb-4">
              <div className="h-6 w-1/5 bg-zinc-300 rounded" />
              <div className="flex gap-4">
                <div className="h-4 w-12 bg-zinc-200 rounded" />
                <div className="h-4 w-12 bg-zinc-200 rounded" />
                <div className="h-4 w-12 bg-zinc-200 rounded" />
              </div>
            </div>
            <div className="h-7 w-1/2 bg-zinc-300 rounded mb-4" />
            <div className="h-3 w-5/6 bg-zinc-200 rounded mb-2" />
            <div className="h-3 w-2/3 bg-zinc-200 rounded mb-2" />
            <div className="h-3 w-3/4 bg-zinc-200 rounded mb-8" />
            <div className="grid grid-cols-3 gap-6 mb-4">
              <div className="h-24 bg-zinc-200 rounded flex items-center justify-center border border-zinc-200 animate-pulse" />
              <div className="h-24 bg-zinc-200 rounded flex items-center justify-center border border-zinc-200 animate-pulse" />
              <div className="h-24 bg-zinc-200 rounded flex items-center justify-center border border-zinc-200 animate-pulse" />
            </div>
          </div>

          {/* Backdrop Mask Overlay inside simulated viewport */}
          {stepConfig.popupType !== 'stickybar' && stepConfig.popupType !== 'floating' && (
            <div 
              className="absolute inset-0 transition-opacity duration-300 pointer-events-none"
              style={{ 
                backgroundColor: stepConfig.overlayColor || 'rgba(15, 23, 42, 0.3)',
                zIndex: 1
              }}
            />
          )}

          {/* Main Visual Custom Step container */}
          <div
            key={`canvas-popup-${stepConfig.animationEntrance}`}
            ref={containerRef}
            onClick={(e) => {
              e.stopPropagation();
              onSelectElement(null);
            }}
            className="relative border border-zinc-200 shadow-2xl bg-white select-none group"
            style={{
              width: stepConfig.popupType === 'stickybar' ? '100%' : stepConfig.popupType === 'fullscreen' ? '100%' : `${stepConfig.width}px`,
              height: stepConfig.popupType === 'stickybar' ? '80px' : stepConfig.popupType === 'fullscreen' ? '100%' : `${stepConfig.height}px`,
              backgroundColor: stepConfig.backgroundColor,
              borderRadius: stepConfig.popupType === 'stickybar' || stepConfig.popupType === 'fullscreen' ? '0px' : `${stepConfig.borderRadius}px`,
              borderWidth: `${stepConfig.borderWidth}px`,
              borderColor: stepConfig.borderColor,
              boxShadow: stepConfig.boxShadow || '0 25px 50px -12px rgba(0,0,0,0.2)',
              zIndex: 10,
              animation: (() => {
                const map: Record<string, string> = {
                  'scale-up':   'sp-scale-up 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
                  'fade-in':    'sp-fade-in 0.4s ease both',
                  'slide-up':   'sp-slide-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
                  'slide-down': 'sp-slide-down 0.4s cubic-bezier(0.22,1,0.36,1) both',
                  'bounce':     'sp-bounce 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
                };
                return map[stepConfig.animationEntrance] ?? map['scale-up'];
              })(),
              // Clip full-bleed child panels (e.g. a colored left rail) to the popup's
              // rounded corners — without this they show square corners over the radius.
              overflow: 'hidden',
            }}
          >
            {/* Visual alignment snap guide indicators overlay */}
            {guidelines.x !== undefined && (
              <div 
                className="absolute top-0 bottom-0 border-l border-dashed border-indigo-500 z-50 pointer-events-none flex flex-col justify-end"
                style={{ left: `${guidelines.x}%` }}
              >
                <span className="bg-indigo-600 text-[8px] font-mono text-white px-1 py-0.5 rounded translate-y-1 transform scale-75 self-start whitespace-nowrap">
                  {guidelines.xLabel || 'X Snap'}
                </span>
              </div>
            )}
            {guidelines.y !== undefined && (
              <div 
                className="absolute left-0 right-0 border-t border-dashed border-indigo-500 z-50 pointer-events-none flex justify-end"
                style={{ top: `${guidelines.y}%` }}
              >
                <span className="bg-indigo-600 text-[8px] font-mono text-white px-1 py-0.5 rounded -translate-y-1 px-1 translate-x-1 transform scale-75 whitespace-nowrap">
                  {guidelines.yLabel || 'Y Snap'}
                </span>
              </div>
            )}

            {/* Elements map */}
            {stepConfig.elements.map((el) => {
              const isSelected = selectedElementId === el.id;
              const isHovered = hoveredElementId === el.id;
              const isLocked = el.extraProps?.isLocked as boolean | undefined;
              const rotAngle = (el.extraProps?.rotation as number) || 0;

              return (
                <div
                  key={el.id}
                  id={`canvas-elem-${el.id}`}
                  onMouseDown={(e) => handleDragStart(e, el, 'drag')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectElement(el.id);
                  }}
                  onMouseEnter={() => setHoveredElementId(el.id)}
                  onMouseLeave={() => setHoveredElementId(null)}
                  className={`absolute ${
                    isLocked ? 'cursor-not-allowed select-none' : 'cursor-move'
                  } ${
                    isSelected 
                      ? 'ring-2 ring-indigo-600 ring-offset-1 z-50 shadow-md' 
                      : isHovered && showWireframes
                        ? 'ring-1.5 ring-dashed ring-pink-500/80 z-40' 
                        : showWireframes
                          ? 'border border-dashed border-zinc-200/50'
                          : 'border border-transparent'
                  }`}
                  style={{
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    width: `${el.w}%`,
                    height: `${el.h}%`,
                    // Close buttons always float above other elements (e.g. full-bleed images) so
                    // the visitor can always dismiss the popup.
                    zIndex: el.type === 'close' ? Math.max(el.zIndex, 900) : el.zIndex,
                    transform: `rotate(${rotAngle}deg)`,
                    transformStyle: 'preserve-3d',
                  }}
                >
                  
                  {/* Element Wireframe type tag inspector (GrapesJS Style) */}
                  {((isHovered && !isSelected) || isSelected) && showWireframes && (
                    <div className="absolute top-0 left-0 bg-zinc-900 text-white font-mono text-[7px] font-semibold px-1 py-0.5 -translate-y-[100%] rounded-tr rounded-tl flex items-center gap-1 z-50 pointer-events-none">
                      {isLocked && <Lock className="h-1.5 w-1.5 text-amber-400" />}
                      <span className="uppercase">{el.type}</span>
                    </div>
                  )}

                  {/* Moveable Realtime Float Coordinates Dimension Box */}
                  {isSelected && (
                    <div className="absolute bottom-0 right-0 bg-indigo-600 text-white font-mono text-[8px] font-bold px-1.5 py-0.5 translate-y-[100%] rounded-br rounded-bl z-50 pointer-events-none flex items-center gap-1 whitespace-nowrap shadow">
                      <span>W:{el.w}% H:{el.h}%</span>
                      <span className="text-indigo-300 bg-indigo-950 px-1 rounded-sm">X:{el.x} Y:{el.y}</span>
                      {rotAngle > 0 && <span className="text-yellow-400 font-extrabold flex items-center gap-0.5"><RotateCw className="h-2 w-2" />{rotAngle}°</span>}
                    </div>
                  )}

                  {/* Inner element renderer container */}
                  <motion.div
                    key={`${el.id}-${el.animationType || 'none'}-${el.animationDuration ?? 0.5}-${el.animationDelay ?? 0}-${(el.extraProps?.replayKey as number) ?? 0}`}
                    initial={el.animationType && el.animationType !== 'none' ? 'hidden' : 'visible'}
                    animate="visible"
                    variants={getAnimationVariants(el.animationType || '')}
                    transition={{
                      duration: el.animationDuration ?? 0.5,
                      delay: el.animationDelay ?? 0,
                    }}
                    className="w-full h-full relative"
                    style={{ opacity: el.opacity ?? 1 }}
                  >
                    
                    {/* HEADING TYPE */}
                    {el.type === 'heading' && (
                      <div className="w-full h-full flex items-center justify-center">
                        {isEditingText === el.id ? (
                          <textarea
                            value={el.content}
                            rows={2}
                            autoFocus
                            onBlur={() => setIsEditingText(null)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onUpdateElement(el.id, 'content', e.target.value)}
                            className="w-full h-full p-1 bg-white border border-zinc-900 outline-hidden font-sans rounded text-black text-center resize-none"
                            style={{
                              fontSize: `${el.fontSize || 24}px`,
                              fontFamily: el.fontFamily || 'sans-serif',
                              fontWeight: el.fontWeight || 'bold',
                            }}
                          />
                        ) : (
                          <h2
                            onDoubleClick={(e) => {
                              if (!isLocked) { e.stopPropagation(); setIsEditingText(el.id); }
                            }}
                            className="w-full h-full select-text break-words leading-tight flex items-center font-bold tracking-tight"
                            style={{
                              color: el.color || '#111827',
                              fontSize: `${el.fontSize || 24}px`,
                              fontFamily: el.fontFamily || 'sans-serif',
                              // Honor the saved alignment (matches the live snippet). Previously the
                              // hardcoded `justify-center text-center` classes always centered the
                              // heading, so the editor showed centered even when align was 'left'.
                              textAlign: el.align || 'center',
                              justifyContent: el.align === 'right' ? 'flex-end' : el.align === 'left' ? 'flex-start' : 'center',
                            }}
                          >
                            {el.content}
                          </h2>
                        )}
                      </div>
                    )}

                    {/* TEXT DESCRIPTION TYPE */}
                    {el.type === 'text' && (
                      <div className="w-full h-full flex items-center justify-center">
                        {isEditingText === el.id ? (
                          <textarea
                            value={el.content}
                            rows={3}
                            autoFocus
                            onBlur={() => setIsEditingText(null)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onUpdateElement(el.id, 'content', e.target.value)}
                            className="w-full h-full p-1 bg-white border border-zinc-900 outline-hidden font-sans rounded text-black resize-none text-left"
                            style={{
                              fontSize: `${el.fontSize || 13}px`,
                              fontFamily: el.fontFamily || 'sans-serif',
                            }}
                          />
                        ) : (
                          <p
                            onDoubleClick={(e) => {
                              if (!isLocked) { e.stopPropagation(); setIsEditingText(el.id); }
                            }}
                            className="w-full h-full break-words select-text overflow-hidden leading-relaxed"
                            style={{
                              color: el.color || '#4B5563',
                              fontSize: `${el.fontSize || 13}px`,
                              fontWeight: el.fontWeight || '400',
                              fontFamily: el.fontFamily || 'sans-serif',
                              textAlign: el.align || 'left',
                              backgroundColor: el.backgroundColor || 'transparent',
                              borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined,
                              borderWidth: el.borderWidth ? `${el.borderWidth}px` : undefined,
                              borderColor: el.borderColor,
                              padding: el.padding ? `${el.padding}px` : undefined,
                            }}
                          >
                            {el.content}
                          </p>
                        )}
                      </div>
                    )}

                    {/* BUTTON TYPE */}
                    {el.type === 'button' && (
                      <button
                        type="button"
                        className="w-full h-full flex items-center justify-center font-bold shadow-xs select-none pointer-events-none transition-all duration-150"
                        style={{
                          backgroundColor: el.backgroundColor || '#000000',
                          color: el.color || '#FFFFFF',
                          borderRadius: `${el.borderRadius ?? 8}px`,
                          fontSize: `${el.fontSize || 12}px`,
                          fontFamily: el.fontFamily || 'sans-serif',
                          borderWidth: `${el.borderWidth ?? 0}px`,
                          borderColor: el.borderColor || 'transparent',
                        }}
                      >
                        {el.content}
                      </button>
                    )}

                    {/* INPUT FORM TYPE */}
                    {el.type === 'input' && (
                      <div className="w-full h-full flex items-center justify-center relative">
                        <input
                          type="text"
                          disabled
                          placeholder={(el.extraProps?.placeholder as string) || el.content || 'Your email address...'}
                          className="w-full h-full text-xs font-medium px-3 text-zinc-705 bg-white shadow-inner select-none pointer-events-none"
                          style={{
                            borderRadius: `${el.borderRadius ?? 8}px`,
                            borderWidth: `${el.borderWidth ?? 1}px`,
                            borderColor: el.borderColor || '#E4E4E7',
                          }}
                        />
                      </div>
                    )}

                    {/* CONSENT CHECKBOX TYPE */}
                    {el.type === 'consent' && (
                      <div
                        className="w-full h-full flex items-start gap-2 select-none pointer-events-none leading-snug"
                        style={{ fontSize: `${el.fontSize ?? 11}px`, color: el.color || '#6B7280' }}
                      >
                        <input type="checkbox" disabled className="shrink-0 mt-0.5" style={{ width: 14, height: 14 }} />
                        <span>{el.content || 'I agree to receive marketing emails.'}</span>
                      </div>
                    )}

                    {/* COUNTDOWN TIMER TYPE */}
                    {el.type === 'countdown' && (
                      <div className="w-full h-full flex items-center justify-center gap-1.5">
                        <div className="flex flex-col items-center justify-center bg-zinc-900 text-white rounded px-2 py-1 shadow font-mono">
                          <span className="text-xs font-extrabold leading-none">14</span>
                          <span className="text-[6px] text-zinc-400 uppercase tracking-wider font-bold mt-0.5">Min</span>
                        </div>
                        <span className="text-zinc-900 font-bold text-xs animate-pulse">:</span>
                        <div className="flex flex-col items-center justify-center bg-zinc-900 text-white rounded px-2 py-1 shadow font-mono">
                          <span className="text-xs font-extrabold leading-none">59</span>
                          <span className="text-[6px] text-zinc-400 uppercase tracking-wider font-bold mt-0.5">Sec</span>
                        </div>
                      </div>
                    )}

                    {/* PRODUCT CARD ROW */}
                    {el.type === 'product' && (
                      <div 
                        className="w-full h-full bg-white border border-zinc-200 p-1.5 text-left flex gap-2 overflow-hidden shadow-xs"
                        style={{ borderRadius: `${el.borderRadius ?? 10}px` }}
                      >
                        <img 
                          src="https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=150&q=50" 
                          alt="Glow Serum" 
                          className="h-full aspect-square object-cover rounded bg-zinc-50 shrink-0 border border-zinc-150"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex flex-col justify-between overflow-hidden">
                          <div>
                            <h4 className="text-[9px] font-bold text-zinc-900 truncate">Organic Glow Tonic</h4>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] font-bold text-zinc-800">$29.00</span>
                              <span className="text-[7px] text-zinc-400 line-through">$42.00</span>
                            </div>
                          </div>
                          <span className="text-[7px] px-1 py-0.5 rounded-sm bg-zinc-100 text-zinc-700 font-mono tracking-wide max-w-fit font-bold uppercase">
                            Best Seller
                          </span>
                        </div>
                      </div>
                    )}

                    {/* USER REVIEW COMPONENT */}
                    {el.type === 'review' && (
                      <div className="w-full h-full flex flex-col justify-center text-left gap-0.5 p-1.5 bg-white border border-zinc-100/80 rounded shadow-2xs">
                        <div className="flex gap-0.5 text-zinc-900">
                          {[1, 2, 3, 4, 5].map(st => (
                            <Star key={st} className="h-2.5 w-2.5 fill-amber-400 text-amber-500" />
                          ))}
                        </div>
                        <span className="text-[9px] italic line-clamp-1 text-zinc-600 font-medium">
                          "Beautiful packaging and real premium skincare quality. Loved the gift"
                        </span>
                        <span className="text-[7px] font-extrabold text-zinc-400 uppercase tracking-widest font-mono">
                          — Emily B.
                        </span>
                      </div>
                    )}

                    {/* QR CODE TYPE */}
                    {el.type === 'qrcode' && (
                      <div className="w-full h-full bg-white border border-zinc-200 p-1.5 rounded flex flex-col items-center justify-center gap-0.5 shadow-2xs">
                        <QrCode className="h-4/5 w-4/5 text-zinc-900" />
                        <span className="text-[6px] text-zinc-500 font-bold uppercase tracking-wider text-center font-mono">Scan Promo Node</span>
                      </div>
                    )}

                    {/* IMAGE TYPE */}
                    {el.type === 'image' && (
                      <img
                        src={el.content || 'https://images.unsplash.com/photo-1542435503-956c469947f6?auto=format&fit=crop&w=400&q=80'}
                        alt="Promo illustration"
                        className="w-full h-full object-cover border border-zinc-200"
                        style={{ borderRadius: `${el.borderRadius ?? 8}px` }}
                        referrerPolicy="no-referrer"
                      />
                    )}

                    {/* SHAPES VECTOR */}
                    {el.type === 'shape' && el.content !== 'wheel' && (
                      <div 
                        className="w-full h-full shadow-2xs"
                        style={{
                          backgroundColor: el.backgroundColor || '#000000',
                          borderRadius: el.content === 'circle' ? '9999px' : `${el.borderRadius ?? 0}px`,
                          borderWidth: `${el.borderWidth ?? 0}px`,
                          borderColor: el.borderColor || 'transparent',
                        }}
                      />
                    )}

                    {/* SPINWHEEL SHAPE TYPE */}
                    {el.type === 'shape' && el.content === 'wheel' && (
                      <div className="w-full h-full rounded-full border-4 border-zinc-900 overflow-hidden relative shadow-md flex items-center justify-center">
                        <div 
                          className="w-full h-full rounded-full pointer-events-none"
                          style={{
                            background: `conic-gradient(from 0deg, 
                              #f43f5e 0deg 45deg, 
                              #fff 45deg 90deg, 
                              #6366f1 90deg 135deg, 
                              #fff 135deg 180deg, 
                              #10b981 180deg 225deg, 
                              #fff 225deg 270deg, 
                              #ec4899 270deg 315deg, 
                              #fff 315deg 360deg)`
                          }}
                        />
                        <div className="absolute h-10 w-10 bg-white border-2 border-zinc-900 rounded-full flex items-center justify-center shadow-md z-10 text-[8px] font-black text-black tracking-tighter">
                          SPIN
                        </div>
                      </div>
                    )}

                    {/* URGENCY BOX */}
                    {el.type === 'urgency' && (
                      <div className="w-full h-full bg-amber-50 border border-amber-200 text-amber-900 rounded font-semibold px-2 flex items-center justify-center gap-1 shrink-0">
                        <Sparkle className="h-3 w-3 text-amber-600 shrink-0 animate-ping" />
                        <span className="text-[9px] tracking-wide font-mono uppercase text-xs truncate">
                          {el.content || 'Only 3 items remaining! code expires soon.'}
                        </span>
                      </div>
                    )}

                    {/* TICKER — Scrolling Social Proof */}
                    {el.type === 'ticker' && (
                      <div className="w-full h-full overflow-hidden flex items-center rounded" style={{ backgroundColor: el.backgroundColor || '#18181B', borderRadius: `${el.borderRadius ?? 6}px` }}>
                        <div className="flex items-center gap-4 animate-marquee whitespace-nowrap px-2" style={{ color: el.color || '#FFFFFF', fontSize: `${el.fontSize || 10}px`, fontFamily: el.fontFamily || 'monospace' }}>
                          <span>🔥 {el.content || '1,247 people purchased this in the last 24 hours!'}</span>
                          <span className="mx-4 opacity-40">•</span>
                          <span>🛒 Sarah from NYC just claimed 20% off</span>
                          <span className="mx-4 opacity-40">•</span>
                          <span>⚡ Only 8 units left at this price!</span>
                          <span className="mx-4 opacity-40">•</span>
                          <span>🔥 {el.content || '1,247 people purchased this in the last 24 hours!'}</span>
                        </div>
                      </div>
                    )}

                    {/* PROGRESS BAR — Goal tracker */}
                    {el.type === 'progressbar' && (
                      <div className="w-full h-full flex flex-col justify-center gap-1 px-2">
                        <div className="flex justify-between items-center">
                          <span style={{ color: el.color || '#111827', fontSize: `${(el.fontSize || 10)}px`, fontFamily: el.fontFamily || 'sans-serif', fontWeight: 'bold' }}>
                            {el.content || '🚚 Add $15 more for FREE shipping!'}
                          </span>
                          <span style={{ color: el.color || '#111827', fontSize: `${(el.fontSize || 9)}px`, fontWeight: 'bold' }}>72%</span>
                        </div>
                        <div className="w-full rounded-full overflow-hidden" style={{ height: '6px', backgroundColor: el.borderColor || '#E5E7EB' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: '72%', backgroundColor: el.backgroundColor || '#111827' }} />
                        </div>
                      </div>
                    )}

                    {/* COUPON CARD — Reveal code */}
                    {el.type === 'couponcard' && (
                      <div
                        className="w-full h-full flex items-center justify-center border-2 border-dashed rounded-lg p-2 gap-2"
                        style={{
                          backgroundColor: el.backgroundColor || '#FEFCE8',
                          borderColor: el.borderColor || '#F59E0B',
                          borderRadius: `${el.borderRadius ?? 8}px`,
                        }}
                      >
                        <span className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: el.color || '#92400E' }}>Your Code:</span>
                        <span className="font-mono font-black tracking-widest text-xs px-2 py-0.5 rounded" style={{ backgroundColor: el.borderColor || '#F59E0B', color: '#FFFFFF' }}>
                          {el.content || 'SAVE20'}
                        </span>
                        <span className="text-[7px] font-bold uppercase text-amber-600">Tap to copy</span>
                      </div>
                    )}

                    {/* PHONE INPUT — SMS opt-in */}
                    {el.type === 'phoneinput' && (
                      <div className="w-full h-full flex items-center gap-1.5 relative">
                        <div
                          className="flex items-center justify-center gap-1.5 w-full h-full px-2 text-xs font-medium shadow-inner select-none pointer-events-none"
                          style={{
                            borderRadius: `${el.borderRadius ?? 8}px`,
                            borderWidth: `${el.borderWidth ?? 1}px`,
                            borderStyle: 'solid',
                            borderColor: el.borderColor || '#BAE6FD',
                            backgroundColor: el.backgroundColor || '#F8FAFC',
                            color: el.color || '#64748B',
                          }}
                        >
                          <span className="text-xs shrink-0">📱</span>
                          <span className="text-xs">{el.content || '+1 (555) Enter your number...'}</span>
                        </div>
                      </div>
                    )}

                    {/* TRUST BADGE */}
                    {el.type === 'badge' && (
                      <div
                        className="w-full h-full flex items-center justify-center gap-1.5 font-semibold"
                        style={{
                          backgroundColor: el.backgroundColor || '#F0FDF4',
                          borderRadius: `${el.borderRadius ?? 8}px`,
                          borderWidth: `${el.borderWidth ?? 1}px`,
                          borderStyle: 'solid',
                          borderColor: el.borderColor || '#BBF7D0',
                          color: el.color || '#14532D',
                          fontSize: `${el.fontSize || 10}px`,
                        }}
                      >
                        <span>🛡️</span>
                        <span className="font-bold uppercase tracking-wide">{el.content || '100% Secure Checkout'}</span>
                      </div>
                    )}

                    {/* DIVIDER — Section separator */}
                    {el.type === 'divider' && (
                      <div className="w-full h-full flex items-center">
                        <div
                          className="w-full"
                          style={{
                            height: `${el.borderWidth ?? 1}px`,
                            backgroundColor: el.borderColor || el.color || '#E5E7EB',
                          }}
                        />
                      </div>
                    )}

                    {/* CLOSE BUTTON FOR POPUPS — always a visible white circle with an outline + X,
                        so it overlays images (and any background) instead of vanishing on a
                        transparent default. A custom backgroundColor is still honored if set. */}
                    {el.type === 'close' && (() => {
                      const hasCustomBg = !!el.backgroundColor && el.backgroundColor !== 'transparent';
                      return (
                        <div
                          className="w-full h-full flex items-center justify-center transition-colors cursor-pointer font-semibold font-mono"
                          style={{
                            borderRadius: `${el.borderRadius ?? 999}px`,
                            color: el.color || '#18181b',
                            background: hasCustomBg ? el.backgroundColor : '#ffffff',
                            border: `${el.borderWidth ?? 1}px solid ${el.borderColor || '#E4E4E7'}`,
                            boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                            fontSize: `${el.fontSize || 14}px`,
                          }}
                        >
                          {el.content || '✕'}
                        </div>
                      );
                    })()}

                  </motion.div>

                  {/* MOVEABLE-STYLE 8 RESIZE HANDLES OVERLAYS AND ANCHORS */}
                  {isSelected && !isLocked && (
                    <>
                      {/* Bounding Visual Frame Border lines (Figma/Moveable style) */}
                      <div className="absolute -inset-0.5 border border-indigo-500 pointer-events-none z-45" />

                      {/* 1. Rotational Stalk & Handle Anchor Node */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 flex flex-col items-center">
                        <div
                          onMouseDown={(e) => handleDragStart(e, el, 'rotate')}
                          className="h-3 w-3 rounded-full bg-indigo-600 hover:bg-indigo-700 cursor-alias border-2 border-white shadow-md active:scale-130 transition-transform z-50 flex items-center justify-center"
                          title="Rotate Layer (Moveable / GrapesJS)"
                        >
                          <RotateCw className="h-1.5 w-1.5 text-white pointer-events-none" />
                        </div>
                        <div className="h-3 w-[1.5px] bg-indigo-500" />
                      </div>

                      {/* 2. Top-Left anchor (nw) */}
                      <div
                        onMouseDown={(e) => handleDragStart(e, el, 'resize', 'nw')}
                        className="absolute h-2.5 w-2.5 bg-white border-2 border-indigo-600 rounded-sm hover:bg-indigo-600 cursor-nwse-resize shadow-xs z-50 transform -translate-x-[4px] -translate-y-[4px]"
                        style={{ left: 0, top: 0 }}
                      />
                      {/* 3. Top-Center anchor (n) */}
                      <div
                        onMouseDown={(e) => handleDragStart(e, el, 'resize', 'n')}
                        className="absolute h-2.5 w-2.5 bg-white border-2 border-indigo-600 rounded-sm hover:bg-indigo-600 cursor-ns-resize shadow-xs z-50 transform -translate-x-1/2 -translate-y-[4px]"
                        style={{ left: '50%', top: 0 }}
                      />
                      {/* 4. Top-Right anchor (ne) */}
                      <div
                        onMouseDown={(e) => handleDragStart(e, el, 'resize', 'ne')}
                        className="absolute h-2.5 w-2.5 bg-white border-2 border-indigo-600 rounded-sm hover:bg-indigo-600 cursor-nesw-resize shadow-xs z-50 transform translate-x-[4px] -translate-y-[4px]"
                        style={{ right: 0, top: 0 }}
                      />
                      {/* 5. Middle-Right anchor (e) */}
                      <div
                        onMouseDown={(e) => handleDragStart(e, el, 'resize', 'e')}
                        className="absolute h-2.5 w-2.5 bg-white border-2 border-indigo-600 rounded-sm hover:bg-indigo-600 cursor-ew-resize shadow-xs z-50 transform translate-x-[4px] -translate-y-1/2"
                        style={{ right: 0, top: '50%' }}
                      />
                      {/* 6. Bottom-Right anchor (se) */}
                      <div
                        onMouseDown={(e) => handleDragStart(e, el, 'resize', 'se')}
                        className="absolute h-3 w-3 bg-indigo-600 border-2 border-white rounded-full hover:bg-black cursor-se-resize shadow-md z-50 transform translate-x-[5px] translate-y-[5px]"
                        style={{ right: 0, bottom: 0 }}
                      />
                      {/* 7. Bottom-Center anchor (s) */}
                      <div
                        onMouseDown={(e) => handleDragStart(e, el, 'resize', 's')}
                        className="absolute h-2.5 w-2.5 bg-white border-2 border-indigo-600 rounded-sm hover:bg-indigo-600 cursor-ns-resize shadow-xs z-50 transform -translate-x-1/2 translate-y-[4px]"
                        style={{ left: '50%', bottom: 0 }}
                      />
                      {/* 8. Bottom-Left anchor (sw) */}
                      <div
                        onMouseDown={(e) => handleDragStart(e, el, 'resize', 'sw')}
                        className="absolute h-2.5 w-2.5 bg-white border-2 border-indigo-600 rounded-sm hover:bg-indigo-600 cursor-nesw-resize shadow-xs z-50 transform -translate-x-[4px] translate-y-[4px]"
                        style={{ left: 0, bottom: 0 }}
                      />
                      {/* 9. Middle-Left anchor (w) */}
                      <div
                        onMouseDown={(e) => handleDragStart(e, el, 'resize', 'w')}
                        className="absolute h-2.5 w-2.5 bg-white border-2 border-indigo-600 rounded-sm hover:bg-indigo-600 cursor-ew-resize shadow-xs z-50 transform -translate-x-[4px] -translate-y-1/2"
                        style={{ left: 0, top: '50%' }}
                      />
                    </>
                  )}

                  {/* Selection Frame and HUD coordinates if instance is locked */}
                  {isSelected && isLocked && (
                    <div className="absolute -inset-0.5 border-2 border-amber-500 pointer-events-none z-45 flex items-center justify-center">
                      <Lock className="h-4 w-4 text-amber-600 bg-white p-0.5 rounded shadow-md" />
                    </div>
                  )}

                  {/* CRAFT.JS IN-CONTEXT FLOATING INTERACTIVE ALIGNMENT TOOLBAR */}
                  {isSelected && (
                    <div 
                      className="absolute z-[100] flex items-center gap-1 bg-zinc-950/95 backdrop-blur-xs text-white p-1 rounded-lg border border-zinc-700/60 shadow-2xl transition-all duration-150 whitespace-nowrap"
                      style={{
                        left: '50%',
                        top: el.y < 16 ? `${100 + 4}%` : 'auto',
                        bottom: el.y >= 16 ? `${100 + 12}%` : 'auto',
                        transform: 'translateX(-50%)',
                      }}
                      onMouseDown={(evt) => evt.stopPropagation()} // Prevents launching a canvas drag when resizing/ordering
                    >
                      {/* Lock Toggle */}
                      <button
                        onClick={(e) => handleToggleLock(e, el)}
                        className={`p-1 rounded cursor-pointer transition-colors ${isLocked ? 'bg-amber-500 text-black hover:bg-amber-400' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                        title={isLocked ? 'Unlock Placement' : 'Lock Placement Coordinates (Canva Security)'}
                      >
                        {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                      </button>

                      <div className="w-[1px] h-3 bg-zinc-800" />

                      {/* Duplicate Item (Craft.js) */}
                      <button
                        onClick={(e) => handleDuplicate(e, el)}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-805 cursor-pointer"
                        title="Quick Clone & Duplicate Layer"
                      >
                        <Copy className="h-3 w-3" />
                      </button>

                      {/* Stacking Hierarchy Elevation orders */}
                      <button
                        onClick={(e) => handleLayerOrder(e, el, 'up')}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-805 cursor-pointer"
                        title="Raise Layer Forward (Z-Index +1)"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      
                      <button
                        onClick={(e) => handleLayerOrder(e, el, 'down')}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-850 cursor-pointer"
                        title="Send Layer Backward (Z-Index -1)"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>

                      {/* Text Align Shortcuts for Quick Alignment overrides */}
                      {['heading', 'text', 'button'].includes(el.type) && (
                        <>
                          <div className="w-[1px] h-3 bg-zinc-800" />
                          <button
                            onClick={(e) => handleUpdateAlign(e, el, 'left')}
                            className={`p-1 rounded cursor-pointer ${el.align === 'left' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                            title="Align Left"
                          >
                            <AlignLeft className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => handleUpdateAlign(e, el, 'center')}
                            className={`p-1 rounded cursor-pointer ${el.align === 'center' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                            title="Align Center"
                          >
                            <AlignCenter className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => handleUpdateAlign(e, el, 'right')}
                            className={`p-1 rounded cursor-pointer ${el.align === 'right' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                            title="Align Right"
                          >
                            <AlignRight className="h-3 w-3" />
                          </button>
                        </>
                      )}

                      <div className="w-[1px] h-3 bg-zinc-800" />

                      {/* Remove Component Trigger */}
                      <button
                        onClick={(e) => handleDelete(e, el.id)}
                        className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/50 cursor-pointer"
                        title="Delete Element Block (Ctrl+Backspace)"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FOOTER CANVAS HELPER CAPABILITIES */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-zinc-200/85 flex items-center gap-3 pointer-events-none text-[10px] font-mono text-zinc-500 shadow-sm z-10 transition-all duration-300">
        <div className="flex items-center gap-1 shrink-0">
          <kbd className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[8.5px] font-bold">DOUBLE CLICK</kbd>
        </div>
        <span>Double-click text boxes to customize inline. Use the floating toolbar to clone & lock layers.</span>
      </div>

    </div>
  );
}
