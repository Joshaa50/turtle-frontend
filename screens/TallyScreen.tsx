
import React, { useState } from 'react';

const TallyScreen: React.FC = () => {
  const [hatchlings, setHatchlings] = useState(0);
  const [eggs, setEggs] = useState(0);
  const [activeSession, setActiveSession] = useState(false);

  const handleIncrement = (type: 'hatchlings' | 'eggs') => {
    if (type === 'hatchlings') setHatchlings(hatchlings + 1);
    else setEggs(eggs + 1);
    // Vibrate if supported
    if (window.navigator.vibrate) window.navigator.vibrate(50);
  };

  const handleDecrement = (type: 'hatchlings' | 'eggs') => {
    if (type === 'hatchlings') setHatchlings(Math.max(0, hatchlings - 1));
    else setEggs(Math.max(0, eggs - 1));
  };

  return (
    <div className="flex flex-col h-full bg-[#0d131a] select-none">
      <header className="p-6 border-b border-white/5 flex justify-between items-center bg-[#111821]">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Field Tally Tool</h2>
          <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Active Observation Mode</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">GPS Active</span>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-8 content-center max-w-4xl mx-auto w-full">
        {/* Hatchling Counter */}
        <div className="bg-[#1a232e] border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center space-y-6">
          <div className="text-center">
            <span className="material-symbols-outlined text-primary text-4xl mb-2">child_care</span>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Hatchlings</h3>
          </div>
          <div className="text-8xl font-black text-white tabular-nums">{hatchlings}</div>
          <div className="flex gap-4 w-full">
            <button 
              onClick={() => handleDecrement('hatchlings')}
              className="flex-1 h-24 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition-all text-slate-400"
            >
              <span className="material-symbols-outlined text-4xl">remove</span>
            </button>
            <button 
              onClick={() => handleIncrement('hatchlings')}
              className="flex-[2] h-24 bg-primary rounded-2xl flex items-center justify-center active:scale-95 transition-all text-white shadow-lg shadow-primary/20"
            >
              <span className="material-symbols-outlined text-5xl">add</span>
            </button>
          </div>
        </div>

        {/* Egg Counter */}
        <div className="bg-[#1a232e] border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center space-y-6">
          <div className="text-center">
            <span className="material-symbols-outlined text-amber-500 text-4xl mb-2">egg</span>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Total Eggs</h3>
          </div>
          <div className="text-8xl font-black text-white tabular-nums">{eggs}</div>
          <div className="flex gap-4 w-full">
            <button 
              onClick={() => handleDecrement('eggs')}
              className="flex-1 h-24 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition-all text-slate-400"
            >
              <span className="material-symbols-outlined text-4xl">remove</span>
            </button>
            <button 
              onClick={() => handleIncrement('eggs')}
              className="flex-[2] h-24 bg-amber-500 rounded-2xl flex items-center justify-center active:scale-95 transition-all text-white shadow-lg shadow-amber-500/20"
            >
              <span className="material-symbols-outlined text-5xl">add</span>
            </button>
          </div>
        </div>
      </div>

      <footer className="p-8 bg-[#111821] border-t border-white/5">
        <div className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Observation Remark</p>
            <input 
              className="w-full bg-black/30 border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary outline-none" 
              placeholder="e.g. Unusual track width, high tide interaction..."
              type="text" 
            />
          </div>
          <button 
            onClick={() => {
              alert(`Logged: ${hatchlings} hatchlings, ${eggs} eggs.`);
              setHatchlings(0);
              setEggs(0);
            }}
            className="w-full sm:w-auto px-12 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl uppercase tracking-widest shadow-xl shadow-emerald-500/10 transition-all active:scale-95"
          >
            Log Session
          </button>
        </div>
      </footer>
    </div>
  );
};

export default TallyScreen;
