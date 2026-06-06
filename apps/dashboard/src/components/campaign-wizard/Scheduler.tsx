import React from 'react';
import { Clock, Plus, X, Globe } from 'lucide-react';
import { SchedulerWindow } from '../../types/campaign';
import { cn } from '../../lib/utils';

interface SchedulerProps {
  scheduler: SchedulerWindow[];
  setScheduler: React.Dispatch<React.SetStateAction<SchedulerWindow[]>>;
}

const DAYS = ['all', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const TIMEZONES = Intl.supportedValuesOf('timeZone');

const newWindow = (): SchedulerWindow => ({
  id: crypto.randomUUID(),
  day: 'all',
  start: '00:00',
  end: '23:59',
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
});

// A helper to detect overlaps (very basic for now: same day, overlapping time strings)
const hasOverlap = (windows: SchedulerWindow[], target: SchedulerWindow) => {
  const others = windows.filter(w => w.id !== target.id && (w.day === target.day || w.day === 'all' || target.day === 'all'));
  return others.some(w => {
    return (target.start >= w.start && target.start < w.end) || 
           (target.end > w.start && target.end <= w.end) ||
           (target.start <= w.start && target.end >= w.end);
  });
};

export const Scheduler: React.FC<SchedulerProps> = ({ scheduler, setScheduler }) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            Display Schedule
          </h2>
          <p className="text-xs text-slate-500">Define active windows for your campaign. All times are evaluated in the specified timezone.</p>
        </div>

        <div className="space-y-3">
          {scheduler.length === 0 && (
            <div className="py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center">
              <Clock className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-500">No schedule active</p>
              <p className="text-xs text-slate-400">Campaign will be always on if launched.</p>
            </div>
          )}
          
          {scheduler.map((w, _i) => {
            const isOverlapping = hasOverlap(scheduler, w);
            return (
              <div 
                key={w.id} 
                className={cn(
                  "grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-xl border transition-colors items-center",
                  isOverlapping ? "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900" : "bg-slate-50 border-slate-200 dark:bg-slate-950 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50"
                )}
              >
                <div className="md:col-span-3 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Day</label>
                  <select 
                    value={w.day} 
                    onChange={(e) => setScheduler(prev => prev.map(x => x.id === w.id ? { ...x, day: e.target.value as SchedulerWindow['day'] } : x))}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 w-full"
                  >
                    {DAYS.map(d => <option key={d} value={d}>{d === 'all' ? 'Everyday' : d.toUpperCase()}</option>)}
                  </select>
                </div>
                
                <div className="md:col-span-2 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Start Time</label>
                  <input 
                    type="time" 
                    value={w.start} 
                    onChange={(e) => setScheduler(prev => prev.map(x => x.id === w.id ? { ...x, start: e.target.value } : x))}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 w-full"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">End Time</label>
                  <input 
                    type="time" 
                    value={w.end} 
                    onChange={(e) => setScheduler(prev => prev.map(x => x.id === w.id ? { ...x, end: e.target.value } : x))}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 w-full"
                  />
                </div>

                <div className="md:col-span-4 flex flex-col gap-1 relative">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Timezone</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <select 
                      value={w.tz} 
                      onChange={(e) => setScheduler(prev => prev.map(x => x.id === w.id ? { ...x, tz: e.target.value } : x))}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 w-full"
                    >
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                </div>

                <div className="md:col-span-1 flex justify-end mt-4 md:mt-0">
                  <button 
                    onClick={() => setScheduler(prev => prev.filter(x => x.id !== w.id))}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {isOverlapping && (
                  <div className="md:col-span-12 mt-1">
                    <p className="text-[10px] text-rose-500 font-medium">Warning: This window overlaps with another scheduled window.</p>
                  </div>
                )}
              </div>
            );
          })}

          <button 
            onClick={() => setScheduler(prev => [...prev, newWindow()])}
            className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Window
          </button>
        </div>
      </div>
    </div>
  );
};
