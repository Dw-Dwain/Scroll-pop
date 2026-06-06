import React from 'react';
import { Table as TableIcon, Edit3, Trash2 } from 'lucide-react';

interface MediaItem {
  id: string;
  title: string;
  desc: string;
  date: string;
  info: string;
}

export const TablesPage: React.FC = () => {
  const [items, setItems] = React.useState<MediaItem[]>([
    { id: '1', title: 'Gravity Psd B-Cards', desc: 'A classic approach...', date: '26 Feb, 2014 15:20', info: 'A classic approach to our gravity series of psd business cards mockup which can be used for both vertical...' },
    { id: '2', title: 'Psd Foil Sticker', desc: 'A set of shiny...', date: '20 Feb, 2014 11:05', info: 'A set of shiny psd foil stickers to decorate your designs. Easily change the color and content to create a nifty...' },
    { id: '3', title: 'Wood Burning Logo', desc: 'A fresh looking...', date: '19 Jan, 2014 19:53', info: 'A fresh looking wood burning logo mockup with a pyrogravure art style to create burn marks of your...' }
  ]);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this media item?')) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  return (
    <div className="space-y-8 font-sans">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Media Tables</h1>
        <p className="text-slate-400 text-sm font-medium">Visual recreation of the "Media Table" widget showcasing file mockups and date stamps.</p>
      </div>

      <div className="glass-card rounded-3xl max-w-5xl mx-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-slate-950/20">
          <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
            <TableIcon className="w-5 h-5 text-indigo-400" /> Media Files Registry
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20 uppercase">Assets</span>
        </div>

        {/* Table layout */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-950/10">
                <th className="p-4 pl-6">Post Description</th>
                <th className="p-4">Date</th>
                <th className="p-4">Post Info</th>
                <th className="p-4 text-center pr-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-slate-300 font-semibold">
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/2 transition">
                    <td className="p-4 pl-6 space-y-1">
                      <span className="font-bold text-slate-200 block">{item.title}</span>
                      <span className="text-[10px] text-slate-500 font-medium block">{item.desc}</span>
                    </td>
                    <td className="p-4 text-slate-400 font-mono font-medium">{item.date}</td>
                    <td className="p-4 text-slate-400 font-medium max-w-sm truncate leading-relaxed" title={item.info}>
                      {item.info}
                    </td>
                    <td className="p-4 text-center pr-6 flex items-center justify-center gap-2">
                      <button className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-lg transition cursor-pointer flex items-center gap-1 text-[10px] font-bold">
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition cursor-pointer flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-500 font-semibold">
                    🏜️ No media items registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
