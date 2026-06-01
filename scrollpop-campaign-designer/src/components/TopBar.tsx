import React from 'react';
import { 
  Laptop, 
  Smartphone, 
  Tablet, 
  Eye, 
  Undo2, 
  Redo2, 
  CloudRain, 
  Sparkles,
  Save,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  Activity,
  Play
} from 'lucide-react';
import { Campaign, CampaignStep } from '../types';

interface TopBarProps {
  campaign: Campaign;
  activeStep: CampaignStep;
  deviceMode: 'desktop' | 'tablet' | 'mobile';
  onStepChange: (step: CampaignStep) => void;
  onDeviceModeChange: (mode: 'desktop' | 'tablet' | 'mobile') => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onLaunchSim: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function TopBar({
  campaign,
  activeStep,
  deviceMode,
  onStepChange,
  onDeviceModeChange,
  onUndo,
  onRedo,
  onSave,
  onLaunchSim,
  canUndo,
  canRedo,
}: TopBarProps) {
  return (
    <div className="h-16 w-full shrink-0 border-b border-zinc-200 bg-white px-5 flex items-center justify-between select-none">
      
      {/* 1. Left Side: Brand Branding & Stat Ticker */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-zinc-900 flex items-center justify-center text-white shadow-xs">
          <Sparkles className="h-4 w-4 fill-white/10 text-white" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium tracking-wider text-zinc-400 uppercase font-mono">Campaign Designer</span>
            <span className="text-[9px] text-zinc-500 bg-zinc-100 font-mono tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1">
              <span className="h-1 w-1 bg-zinc-800 rounded-full inline-block" /> LIVE
            </span>
          </div>
          <h2 className="text-xs font-bold text-zinc-950 tracking-tight leading-none mt-1">
            {campaign.name}
          </h2>
        </div>
      </div>

      {/* 2. Middle Block: State Flow Steps (Teaser -> Main -> Success) with cool flows */}
      <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-lg border border-zinc-200/60">
        {(['teaser', 'main', 'success'] as const).map((step) => {
          const isSelected = activeStep === step;
          let stepLabel = 'Teaser Badge';
          if (step === 'main') stepLabel = 'Main Subscriber';
          if (step === 'success') stepLabel = 'Success Code';

          return (
            <button
              key={step}
              onClick={() => onStepChange(step)}
              className={`py-1 px-3 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-zinc-900 text-white shadow-xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/80'
              }`}
            >
              {stepLabel}
            </button>
          );
        })}
      </div>

      {/* 3. Right side: Device switches, Undo/Redo, Sim & Action Controls */}
      <div className="flex items-center gap-4">
        
        {/* Device Switches */}
        <div className="flex items-center gap-0.5 bg-zinc-50 p-1 border border-zinc-200/60 rounded-lg shrink-0">
          <button
            onClick={() => onDeviceModeChange('desktop')}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              deviceMode === 'desktop' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-400 hover:text-zinc-700'
            }`}
            title="Desktop Canvas View (Full)"
          >
            <Laptop className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDeviceModeChange('tablet')}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              deviceMode === 'tablet' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-400 hover:text-zinc-700'
            }`}
            title="Tablet Preview View (768px Width)"
          >
            <Tablet className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDeviceModeChange('mobile')}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              deviceMode === 'mobile' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-400 hover:text-zinc-700'
            }`}
            title="Mobile Design View (410px Width)"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            disabled={!canUndo}
            onClick={onUndo}
            className={`p-1.5 rounded-lg border transition-all ${
              canUndo 
                ? 'border-zinc-200 text-zinc-800 hover:bg-zinc-50 bg-white cursor-pointer' 
                : 'border-zinc-100 text-zinc-300 bg-zinc-50/50 cursor-not-allowed'
            }`}
            title="Undo Design Edit"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={!canRedo}
            onClick={onRedo}
            className={`p-1.5 rounded-lg border transition-all ${
              canRedo 
                ? 'border-zinc-200 text-zinc-800 hover:bg-zinc-50 bg-white cursor-pointer' 
                : 'border-zinc-100 text-zinc-300 bg-zinc-50/50 cursor-not-allowed'
            }`}
            title="Redo Design Edit"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Action button trigger: Launch Store Sandbox */}
        <button
          onClick={onLaunchSim}
          className="py-1.5 px-3 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
        >
          <Play className="h-3 w-3 fill-zinc-900 text-zinc-900" />
          Simulation Sandbox
        </button>

        {/* Save button */}
        <button
          onClick={onSave}
          className="py-1.5 px-3.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-black text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
        >
          <Save className="h-3 w-3 text-zinc-200" />
          Publish Live
        </button>

      </div>
    </div>
  );
}
