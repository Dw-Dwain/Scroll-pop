import React from 'react';
import { BarChart3, Wallet, RefreshCw } from 'lucide-react';

export const StatisticsPage: React.FC = () => {
  return (
    <div className="space-y-8 font-sans">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">System Statistics</h1>
        <p className="text-slate-400 text-sm font-medium">Recreation of the visual Statistics dual-line chart and Pie balance chart widgets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Card 1: Statistics Line Chart Mockup */}
        <div className="glass-card rounded-3xl p-6 lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <h3 className="font-extrabold text-lg text-slate-100">Statistics Performance</h3>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Total Views</span>
              <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> CTA Clicks</span>
            </div>
          </div>

          {/* Line Chart Grid Drawing */}
          <div className="h-64 relative bg-slate-950/20 rounded-2xl border border-white/5 p-4 flex flex-col justify-between">
            {/* Horizontal helper gridlines */}
            <div className="absolute inset-x-0 top-[20%] border-t border-white/5 pointer-events-none"></div>
            <div className="absolute inset-x-0 top-[40%] border-t border-white/5 pointer-events-none"></div>
            <div className="absolute inset-x-0 top-[60%] border-t border-white/5 pointer-events-none"></div>
            <div className="absolute inset-x-0 top-[80%] border-t border-white/5 pointer-events-none"></div>

            {/* Custom SVG Line graph */}
            <div className="absolute inset-0 p-4">
              <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                {/* View Line (Blue) */}
                <path d="M 0,35 Q 20,10 40,8 T 80,30 T 100,5" fill="none" stroke="#3b82f6" strokeWidth="1.2" />
                <path d="M 0,35 Q 20,10 40,8 T 80,30 T 100,5 L 100,40 L 0,40 Z" fill="url(#blue-gradient)" opacity="0.06" />

                {/* Click Line (Green) */}
                <path d="M 0,38 Q 20,25 40,30 T 80,12 T 100,20" fill="none" stroke="#34d399" strokeWidth="1.2" />
                <path d="M 0,38 Q 20,25 40,30 T 80,12 T 100,20 L 100,40 L 0,40 Z" fill="url(#green-gradient)" opacity="0.06" />

                <defs>
                  <linearGradient id="blue-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                  <linearGradient id="green-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Simulated tooltips */}
            <div className="absolute top-[12%] left-[38%] bg-blue-600 text-white font-extrabold text-[10px] py-1 px-2 rounded-lg shadow-xl shadow-blue-500/20">96.2k</div>
            <div className="absolute top-[62%] left-[78%] bg-emerald-500 text-slate-950 font-extrabold text-[10px] py-1 px-2 rounded-lg shadow-xl shadow-emerald-500/20">12.4k</div>

            <div className="flex justify-between w-full h-full relative z-10 pt-2 flex-col-reverse text-[9px] font-bold text-slate-600 tracking-wider">
              <div className="flex justify-between px-2">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Pie Balance Chart */}
        <div className="glass-card rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-indigo-400" />
              <h3 className="font-extrabold text-lg text-slate-100">Wallet Balance</h3>
            </div>
            <button className="text-slate-400 hover:text-slate-200 cursor-pointer"><RefreshCw className="w-4 h-4" /></button>
          </div>

          <div className="flex flex-col items-center justify-center space-y-6 pt-4">
            {/* Ring progress graph */}
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-slate-900" strokeWidth="2.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-blue-500" strokeDasharray="50, 100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-teal-400" strokeDasharray="30, 100" strokeDashoffset="-50" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-rose-500" strokeDasharray="20, 100" strokeDashoffset="-80" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-0.5 select-none">
                <span className="text-2xl font-black text-slate-100 tracking-tight">+42</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">my balance</span>
              </div>
            </div>

            {/* Color indicators */}
            <div className="grid grid-cols-3 gap-2 w-full text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-2 border-t border-white/5">
              <div className="space-y-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mx-auto block mb-1"></span>
                <span>50% Members</span>
              </div>
              <div className="space-y-0.5 border-x border-white/5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 mx-auto block mb-1"></span>
                <span>30% Sales</span>
              </div>
              <div className="space-y-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mx-auto block mb-1"></span>
                <span>20% Loss</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
