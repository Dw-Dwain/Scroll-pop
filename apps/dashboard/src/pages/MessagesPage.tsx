import React from 'react';
import { MessageSquare, Star, Trash, CornerUpLeft } from 'lucide-react';

interface DirectMessage {
  id: string;
  sender: string;
  avatar: string;
  source: string;
  time: string;
  content: string;
  replies?: Array<{ sender: string; time: string; content: string }>;
}

export const MessagesPage: React.FC = () => {
  const [messages] = React.useState<DirectMessage[]>([
    {
      id: '1',
      sender: 'Victoria Campel',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
      source: 'from twitter',
      time: '6 hours ago',
      content: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      replies: [
        { sender: 'Admin', time: '2 hours ago', content: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor.' }
      ]
    },
    {
      id: '2',
      sender: 'Joseph Lewis',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
      source: 'from twitter',
      time: '1 day ago',
      content: 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Duis aute irure dolor in reprehenderit.'
    },
    {
      id: '3',
      sender: 'Robert Smith',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80',
      source: 'from twitter',
      time: '2 days ago',
      content: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'
    }
  ]);

  return (
    <div className="space-y-8 font-sans">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Direct Messages</h1>
        <p className="text-slate-400 text-sm font-medium">Recreation of the Glazzed social message cards with collapsible admin replies.</p>
      </div>

      <div className="glass-card rounded-3xl max-w-4xl mx-auto overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-slate-950/20">
          <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-400" /> Message Logs
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20 uppercase">Social Capture</span>
        </div>

        {/* Message logs */}
        <div className="divide-y divide-white/5">
          {messages.map((msg) => (
            <div key={msg.id} className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <img 
                  src={msg.avatar} 
                  alt={msg.sender} 
                  className="w-10 h-10 rounded-full object-cover border border-white/5"
                />
                
                <div className="space-y-1 flex-1">
                  <div className="flex items-baseline gap-2">
                    <h4 className="font-bold text-slate-200 text-sm">{msg.sender}</h4>
                    <span className="text-[10px] text-slate-500 font-bold tracking-wide">{msg.source}</span>
                    <span className="text-[10px] text-indigo-400 font-bold ml-auto">{msg.time}</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed font-medium">{msg.content}</p>
                </div>
              </div>

              {/* Collapsed reply thread */}
              {msg.replies && msg.replies.map((reply, rIdx) => (
                <div key={rIdx} className="ml-14 bg-slate-950/20 border border-white/5 rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-[10px] text-indigo-300">A</div>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-slate-200">{reply.sender}</span>
                      <span className="text-[9px] text-slate-500 font-semibold">{reply.time}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed font-medium">{reply.content}</p>
                  </div>
                </div>
              ))}

              {/* Action Buttons mimicking the reference message list */}
              <div className="flex gap-2 pl-14 pt-1">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/40 border border-white/5 hover:bg-slate-900/40 text-[10px] font-bold text-slate-400 hover:text-slate-200 rounded-lg transition cursor-pointer">
                  <CornerUpLeft className="w-3.5 h-3.5" /> Reply
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/40 border border-white/5 hover:bg-slate-900/40 text-[10px] font-bold text-slate-400 hover:text-slate-200 rounded-lg transition cursor-pointer">
                  <Star className="w-3.5 h-3.5" /> Favorite
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 text-[10px] font-bold text-rose-400 rounded-lg transition cursor-pointer">
                  <Trash className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
