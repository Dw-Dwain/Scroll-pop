import React from 'react';
import { Send, Clock } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: string;
  avatar: string;
  role: 'user' | 'admin' | 'bot';
  content: string;
  time: string;
}

export const SupportChat: React.FC = () => {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    { id: '1', sender: 'Paul Robert Smith', role: 'user', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80', content: 'Hey, I placed the ScrollPop script inside my landing page, but the slide-in popups are loading over 1 second late. Is there an async delay parameter I can adjust?', time: '10:24 AM' },
    { id: '2', sender: 'Marian Lewis', role: 'admin', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80', content: 'Hi Paul! By default, the script waits for requestIdleCallback or DOMContentLoaded so it does not block your LCP. You can set the dwell_time trigger directly inside the dashboard builder to adjust display timings.', time: '10:28 AM' },
    { id: '3', sender: 'Paul Robert Smith', role: 'user', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80', content: 'That makes perfect sense! Let me adjust my trigger parameters right away.', time: '10:30 AM' }
  ]);

  const [newMsgText, setNewMsgText] = React.useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsgText.trim()) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'Marian Lewis',
      role: 'admin',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
      content: newMsgText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages([...messages, newMsg]);
    setNewMsgText('');
  };

  return (
    <div className="space-y-8 font-sans">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Support Chat</h1>
        <p className="text-slate-400 text-sm font-medium">Recreation of the Glazzed support system card with fully functional instant messaging simulator.</p>
      </div>

      <div className="glass-card rounded-3xl max-w-4xl mx-auto flex flex-col h-[600px] overflow-hidden">
        {/* Chat Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5 bg-slate-950/20">
          <div className="relative">
            <img 
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80" 
              alt="Marian" 
              className="w-10 h-10 rounded-full object-cover border border-indigo-500/30"
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border border-slate-950"></div>
          </div>
          <div className="space-y-0.5">
            <h3 className="font-bold text-slate-100 text-sm">Customer Support Desk</h3>
            <span className="text-[10px] text-indigo-400 font-bold tracking-wider uppercase flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> Active Session
            </span>
          </div>
        </div>

        {/* Scrollable Message Logs */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => {
            const isAdmin = msg.role === 'admin';
            return (
              <div key={msg.id} className={`flex items-start gap-4 max-w-xl ${isAdmin ? 'ml-auto flex-row-reverse' : ''}`}>
                <img 
                  src={msg.avatar} 
                  alt={msg.sender} 
                  className="w-9 h-9 rounded-full object-cover shrink-0 border border-white/5"
                />
                
                <div className="space-y-1.5">
                  <div className={`flex items-baseline gap-2 ${isAdmin ? 'justify-end flex-row-reverse' : ''}`}>
                    <span className="text-xs font-bold text-slate-200">{msg.sender}</span>
                    <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" /> {msg.time}
                    </span>
                  </div>
                  
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    isAdmin 
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-500/10' 
                      : 'bg-slate-900/40 border border-white/5 text-slate-300 rounded-tl-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input Footer */}
        <form onSubmit={handleSend} className="p-4 border-t border-white/5 bg-slate-950/20 flex gap-2 items-center">
          <input
            type="text"
            placeholder="Type a support reply..."
            value={newMsgText}
            onChange={(e) => setNewMsgText(e.target.value)}
            className="flex-1 bg-slate-950 border border-white/5 focus:border-indigo-500 text-slate-200 rounded-xl px-4 py-3 text-xs focus:outline-none transition"
          />
          <button
            type="submit"
            className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition cursor-pointer flex items-center justify-center shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
