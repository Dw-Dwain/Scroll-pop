import React from 'react';
import { Sliders, Check, ChevronDown } from 'lucide-react';

export const UIElements: React.FC = () => {
  const [toggle1, setToggle1] = React.useState(true);
  const [toggle2, setToggle2] = React.useState(false);
  const [sliderVal1, setSliderVal1] = React.useState(75);
  const [sliderVal2, setSliderVal2] = React.useState(40);
  const [selectedBtnColor, setSelectedBtnColor] = React.useState('Blue');
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  const colors = ['Blue', 'Green', 'Yellow', 'Red', 'White', 'Dark'];

  return (
    <div className="space-y-8 font-sans">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">UI Elements</h1>
        <p className="text-slate-400 text-sm font-medium">Visual recreation of the interactive controls and buttons from the Glazzed theme.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Card 1: Form Elements / Sliders / Toggles */}
        <div className="glass-card rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" /> UI Control Elements
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20 uppercase">Interactive</span>
          </div>

          {/* Toggle Switches */}
          <div className="space-y-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Custom Switch Toggles</span>
            
            <div className="flex items-center justify-between bg-slate-950/20 border border-white/5 p-4 rounded-2xl">
              <span className="text-sm font-semibold text-slate-200">Email Notifications</span>
              <button 
                onClick={() => setToggle1(!toggle1)}
                className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-300 cursor-pointer ${
                  toggle1 ? 'bg-indigo-500 shadow-lg shadow-indigo-500/30' : 'bg-slate-800'
                }`}
              >
                <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform duration-300 ${
                  toggle1 ? 'translate-x-5.5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-950/20 border border-white/5 p-4 rounded-2xl">
              <span className="text-sm font-semibold text-slate-200">System Telemetry Edge Capture</span>
              <button 
                onClick={() => setToggle2(!toggle2)}
                className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-300 cursor-pointer ${
                  toggle2 ? 'bg-indigo-500 shadow-lg shadow-indigo-500/30' : 'bg-slate-800'
                }`}
              >
                <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform duration-300 ${
                  toggle2 ? 'translate-x-5.5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-4 pt-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Fluid Sliders</span>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-300">
                <span>Overlay Opacity</span>
                <span>{sliderVal1}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={sliderVal1} 
                onChange={(e) => setSliderVal1(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-950 border border-white/5 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-semibold text-slate-300">
                <span>Inactivity Wait Timer</span>
                <span>{sliderVal2}s</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="120" 
                value={sliderVal2} 
                onChange={(e) => setSliderVal2(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-950 border border-white/5 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Buttons Card (Bottom right in SS) */}
        <div className="glass-card rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
              🕹️ Buttons Showcase
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20 uppercase">Interactive</span>
          </div>

          {/* Buttons showcase grid */}
          <div className="space-y-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Interactive Button States</span>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {colors.map((color) => {
                const isSelected = selectedBtnColor === color;
                const colorClasses = {
                  Blue: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/10',
                  Green: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/10',
                  Yellow: 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/10',
                  Red: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/10',
                  White: 'bg-white hover:bg-slate-100 text-slate-900 shadow-white/10',
                  Dark: 'bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-200 shadow-slate-950/10',
                }[color];

                return (
                  <button
                    key={color}
                    onClick={() => setSelectedBtnColor(color)}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${colorClasses} ${
                      isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-950 scale-105' : ''
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    {color}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive dropdown mimic from the Glazzed buttons card */}
          <div className="space-y-4 pt-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Interactive Dropdown Menu</span>
            
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full bg-slate-950 border border-white/5 hover:border-indigo-500/30 text-slate-200 py-3 px-4 rounded-xl font-semibold shadow-sm transition flex items-center justify-between cursor-pointer"
              >
                <span className="text-xs font-semibold">Active Selection: {selectedBtnColor} Theme</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-950 border border-white/5 rounded-xl shadow-2xl overflow-hidden z-20">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setSelectedBtnColor(color);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-slate-100 transition cursor-pointer flex items-center justify-between"
                    >
                      {color} Theme
                      {selectedBtnColor === color && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
