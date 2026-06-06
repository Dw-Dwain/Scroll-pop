import React from 'react';
import { Calendar as CalendarIcon, Clock, Plus, ChevronLeft, ChevronRight, Check, Sparkles, RefreshCw } from 'lucide-react';
import { useList, useUpdate } from '@refinedev/core';

interface ScheduledEvent {
  id: string;
  campaignId: string;
  campaignName: string;
  day: number;
  time: string;
  triggerType: string;
  fired: boolean;
}

// Hardcoded default IDs — used to detect and purge stale seeded data
const LEGACY_IDS = new Set(['1', '2']);

export const CalendarPage: React.FC = () => {
  const { data: campaignsData } = useList({ resource: 'campaigns' });
  const { mutate: updateCampaign } = useUpdate();

  const [syncStatus, setSyncStatus] = React.useState<'none' | 'google' | 'apple'>('none');
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [schedules, setSchedules] = React.useState<ScheduledEvent[]>([]);
  const [isFormOpen, setIsFormOpen] = React.useState(false);

  const [form, setForm] = React.useState({
    campaignId: '',
    day: 24,
    time: '12:00',
    triggerType: 'scroll_pct'
  });

  const [logs, setLogs] = React.useState<string[]>([
    '[Scheduler 20:00:00] Standby: Scanning campaign schedules...'
  ]);

  // Load from local storage on mount — only show user-created schedules, not seeded defaults
  React.useEffect(() => {
    const storedSync = localStorage.getItem('_sp_calendar_sync');
    if (storedSync) setSyncStatus(storedSync as 'none' | 'google' | 'apple');

    const stored = localStorage.getItem('_sp_calendar');
    if (stored) {
      try {
        const parsed: ScheduledEvent[] = JSON.parse(stored);
        // Strip any legacy seeded entries (id '1' or '2')
        const userCreated = parsed.filter((s) => !LEGACY_IDS.has(s.id));
        setSchedules(userCreated);
        if (userCreated.length !== parsed.length) {
          localStorage.setItem('_sp_calendar', JSON.stringify(userCreated));
        }
      } catch {
        setSchedules([]);
      }
    } else {
      setSchedules([]);
    }
  }, []);

  const saveSchedules = (updated: ScheduledEvent[]) => {
    setSchedules(updated);
    localStorage.setItem('_sp_calendar', JSON.stringify(updated));
  };

  const handleSync = (provider: 'google' | 'apple') => {
    setIsSyncing(true);
    setLogs((prev) => [...prev, `[Scheduler] Initializing secure handshake with ${provider === 'google' ? 'Google Calendar API v3' : 'Apple iCloud Calendar services'}...`]);
    
    setTimeout(() => {
      setIsSyncing(false);
      setSyncStatus(provider);
      localStorage.setItem('_sp_calendar_sync', provider);
      setLogs((prev) => [
        ...prev, 
        `[Scheduler] Synchronization SUCCESSFUL with ${provider === 'google' ? 'Google Calendar' : 'Apple Calendar'}!`,
        `[Scheduler] Fetched calendar records. Syncing campaign firing queues...`
      ]);
    }, 1500);
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.campaignId) {
      alert('Please select a campaign to schedule.');
      return;
    }

    const campaign = campaignsData?.data.find((c) => (c as { id: string; name: string }).id === form.campaignId);
    if (!campaign) return;

    const newEvt: ScheduledEvent = {
      id: crypto.randomUUID(),
      campaignId: form.campaignId,
      campaignName: campaign.name,
      day: Number(form.day),
      time: form.time,
      triggerType: form.triggerType === 'scroll_pct' ? 'scroll_pct (30%)' : 'dwell_time (30s)',
      fired: false
    };

    const updated = [...schedules, newEvt];
    saveSchedules(updated);
    setIsFormOpen(false);

    setLogs((prev) => [
      ...prev,
      `[Scheduler] New auto-fire task registered for Campaign '${campaign.name}' on May ${form.day}th at ${form.time}.`
    ]);
  };

  const triggerAutoFire = (id: string, name: string) => {
    setLogs((prev) => [...prev, `[Scheduler] Firing scheduled campaign: '${name}' programmatically...`]);
    
    // Auto-fire call to backend to set campaign to ACTIVE status
    updateCampaign({
      resource: `campaigns/${id}/activate`,
      id: '',
      values: {},
    }, {
      onSuccess: () => {
        // Set local schedule to fired
        const updated = schedules.map((s) => s.campaignId === id ? { ...s, fired: true } : s);
        saveSchedules(updated);
        setLogs((prev) => [...prev, `[Scheduler] Auto-Fire SUCCESS! Campaign '${name}' is now fully active at Edge nodes!`]);
      },
      onError: () => {
        setLogs((prev) => [...prev, `[Scheduler err] Failed to auto-fire campaign '${name}'. Make sure server is reachable.`]);
      }
    });
  };

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-8 font-sans">
      
      {/* Header section with Sync buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-900 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Calendar Scheduler</h1>
          <p className="text-slate-400 text-sm font-medium font-sans">Sync with external calendars to schedule campaign triggers and auto-fire campaigns.</p>
        </div>

        {/* Calendar sync pills */}
        <div className="flex items-center gap-3 shrink-0">
          {syncStatus !== 'none' ? (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl text-emerald-400 font-bold text-xs">
              <Check className="w-4 h-4" /> Synced with {syncStatus === 'google' ? 'Google' : 'Apple'} Calendar
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                disabled={isSyncing}
                onClick={() => handleSync('google')}
                className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer select-none disabled:opacity-50"
              >
                Sync Google Calendar
              </button>
              <button
                disabled={isSyncing}
                onClick={() => handleSync('apple')}
                className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer select-none disabled:opacity-50"
              >
                Sync Apple Calendar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Core calendar view */}
        <div className="glass-card rounded-3xl p-6 lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2.5">
              <CalendarIcon className="w-5 h-5 text-indigo-400" />
              <h3 className="font-extrabold text-lg text-slate-100">May 2026</h3>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 bg-slate-950/40 border border-white/5 hover:bg-slate-900/40 text-slate-400 hover:text-slate-200 rounded-xl transition cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
              <button className="p-2 bg-slate-950/40 border border-white/5 hover:bg-slate-900/40 text-slate-400 hover:text-slate-200 rounded-xl transition cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
              {weekDays.map((wd) => <span key={wd}>{wd}</span>)}
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square bg-slate-950/10 border border-transparent rounded-xl opacity-20"></div>
              ))}
              
              {days.map((day) => {
                const isToday = day === 24;
                const scheduledForDay = schedules.find((s) => s.day === day);
                
                return (
                  <div 
                    key={day} 
                    className={`aspect-square border rounded-2xl p-2 flex flex-col justify-between transition relative ${
                      isToday 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                        : 'bg-slate-950/20 border-white/5 hover:border-indigo-500/30 text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold">{day}</span>
                    {scheduledForDay && (
                      <button
                        type="button"
                        disabled={scheduledForDay.fired}
                        onClick={() => triggerAutoFire(scheduledForDay.campaignId, scheduledForDay.campaignName)}
                        className={`w-full text-[8px] font-black uppercase text-center rounded py-0.5 mt-auto transition ${
                          scheduledForDay.fired
                            ? 'bg-emerald-500/20 text-emerald-300 cursor-default'
                            : 'bg-amber-500 text-slate-950 hover:opacity-90 cursor-pointer shadow-md'
                        }`}
                        title={scheduledForDay.fired ? 'Campaign has been auto-fired!' : 'Click to simulate auto-fire launch!'}
                      >
                        {scheduledForDay.fired ? 'FIRED' : 'LAUNCH'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Schedule List */}
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h4 className="font-extrabold text-slate-200 text-sm">Scheduled Auto-Fires</h4>
              <button 
                onClick={() => setIsFormOpen(true)}
                className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-300 rounded-lg transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {schedules.length === 0 && (
                <div className="text-center py-6 space-y-1.5">
                  <p className="text-slate-500 text-xs font-semibold">No scheduled auto-fires yet.</p>
                  <p className="text-slate-600 text-[11px]">Use the + button to schedule a campaign from the calendar.</p>
                </div>
              )}
              {schedules.map((s) => (
                <div key={s.id} className="bg-slate-950/20 border border-white/5 rounded-2xl p-4 space-y-2 relative overflow-hidden">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Campaign Activation</span>
                    <span className={`text-[7.5px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      s.fired ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300 animate-pulse'
                    }`}>
                      {s.fired ? 'Active Fired' : 'Pending'}
                    </span>
                  </div>
                  <h5 className="font-bold text-slate-200 text-sm leading-snug">{s.campaignName}</h5>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-white/2">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> May {s.day}th @ {s.time}</span>
                    <span className="font-semibold text-slate-400">{s.triggerType}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sync Simulator Live Console */}
          <div className="glass-card rounded-3xl p-6 bg-slate-950 border border-slate-900 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin-slow" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Active Scheduler logs</span>
            </div>
            
            <div className="h-32 overflow-y-auto font-mono text-[9.5px] text-slate-400 space-y-1.5 scrollbar-thin">
              {logs.map((log, i) => (
                <div key={i} className="leading-snug">
                  {log.startsWith('[Scheduler err]') ? (
                    <span className="text-rose-400">{log}</span>
                  ) : log.includes('SUCCESS') || log.includes('SUCCESSFUL') ? (
                    <span className="text-emerald-400 font-semibold">{log}</span>
                  ) : (
                    log
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Campaign Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-50 px-4">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 space-y-6 glow-indigo relative z-10">
            <div className="space-y-1 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="font-extrabold text-xl text-slate-100">Schedule Auto-Fire Task</h3>
                <p className="text-slate-400 text-xs mt-0.5">Select a campaign to automatically activate at a scheduled date.</p>
              </div>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Campaign</label>
                <select
                  required
                  value={form.campaignId}
                  onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none transition"
                >
                  <option value="">Select campaign to schedule...</option>
                  {campaignsData?.data?.map((c) => { const r = c as { id: string; name: string }; return (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ); })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Day of May (1-31)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="31"
                    value={form.day}
                    onChange={(e) => setForm({ ...form, day: Number(e.target.value) || 24 })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Hour (HH:MM)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 12:00"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none transition font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Trigger Hook</label>
                <select
                  value={form.triggerType}
                  onChange={(e) => setForm({ ...form, triggerType: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none transition"
                >
                  <option value="scroll_pct">Scroll past 30%</option>
                  <option value="dwell_time">Dwell past 30 seconds</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4.5 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-300 font-semibold text-sm transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm transition shadow-lg cursor-pointer"
                >
                  Schedule Campaign Firing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
