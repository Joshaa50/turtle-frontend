
import React, { useState, useEffect } from 'react';
import { DatabaseConnection } from '../services/Database';

const DataManagement: React.FC = () => {
  const [dbStatus, setDbStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('CONNECTING');

  useEffect(() => {
    // Initialize DB connection on mount
    const connectDB = async () => {
      setDbStatus('CONNECTING');
      await DatabaseConnection.init();
      setDbStatus('CONNECTED');
    };
    connectDB();
  }, []);

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark font-display">
      <header className="h-20 border-b border-white/10 flex items-center justify-between pl-16 pr-10 lg:pl-10 bg-background-dark/50 backdrop-blur-md sticky top-0 z-50 transition-all">
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center bg-white/5 rounded-lg px-3 py-2 border border-white/10 focus-within:border-primary/50 transition-all">
            <span className="material-symbols-outlined text-slate-500 text-sm">search</span>
            <input className="bg-transparent border-none focus:ring-0 text-sm w-96 placeholder:text-slate-500 text-white" placeholder="Search Tag ID or Nest ID..." type="text" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Database Status Indicator */}
          <div className={`hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg border transition-all ${dbStatus === 'CONNECTED' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-slate-800 border-slate-700'}`}>
            <div className={`size-2 rounded-full ${dbStatus === 'CONNECTED' ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]' : 'bg-slate-500 animate-pulse'}`}></div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-500 uppercase leading-none tracking-wider mb-0.5">Database</span>
              <span className={`text-[10px] font-bold uppercase tracking-widest leading-none ${dbStatus === 'CONNECTED' ? 'text-blue-400' : 'text-slate-400'}`}>
                {dbStatus === 'CONNECTED' ? 'SQL8.FREESQL' : 'CONNECTING...'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Live Sync</span>
          </div>
          <button className="p-2 text-slate-400 hover:text-primary transition-colors relative">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background-dark"></span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="text-4xl font-black tracking-tight text-white uppercase">Data Management</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Registry of coastal monitoring activities and biological assessments.</p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/5 text-white rounded-lg font-bold text-sm border border-white/10 hover:bg-white/10 transition-all">
              <span className="material-symbols-outlined text-lg font-bold">upload_file</span>
              Import
            </button>
            <button className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest">
              <span className="material-symbols-outlined text-lg font-bold">add</span>
              New Record
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10">
            <div className="flex w-full sm:w-auto">
              <button className="flex items-center justify-center gap-2 px-8 py-4 text-[10px] font-black tracking-widest uppercase border-b-2 border-primary text-primary bg-primary/5 transition-all">
                <img src="https://img.icons8.com/fluency/96/turtle.png" className="size-5 object-contain" alt="" />
                Turtle Record
              </button>
              <button className="flex items-center justify-center gap-2 px-8 py-4 text-[10px] font-black tracking-widest uppercase border-b-2 border-transparent text-slate-500 hover:text-white transition-all">
                <img src="https://img.icons8.com/fluency/96/beach.png" className="size-5 object-contain" alt="" />
                Nest Record
              </button>
            </div>
            <div className="pb-3 flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white border border-white/10 rounded-lg text-xs font-bold hover:border-primary/50 transition-all shadow-sm">
                <span className="material-symbols-outlined text-sm">download</span>
                Export to CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest ml-1">Date Range</label>
              <button className="flex items-center justify-between px-4 h-12 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:border-primary/50 transition-colors shadow-sm uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-primary">calendar_today</span>
                  Season 2024
                </div>
                <span className="material-symbols-outlined text-lg text-slate-500">expand_more</span>
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest ml-1">Beach/Sector</label>
              <button className="flex items-center justify-between px-4 h-12 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:border-primary/50 transition-colors shadow-sm uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-primary">location_on</span>
                  All Locations
                </div>
                <span className="material-symbols-outlined text-lg text-slate-500">expand_more</span>
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest ml-1">Species</label>
              <button className="flex items-center justify-between px-4 h-12 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:border-primary/50 transition-colors shadow-sm uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-primary">category</span>
                  Loggerhead
                </div>
                <span className="material-symbols-outlined text-lg text-slate-500">expand_more</span>
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest ml-1">Health Status</label>
              <button className="flex items-center justify-between px-4 h-12 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:border-primary/50 transition-colors shadow-sm uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-primary">health_and_safety</span>
                  Any Status
                </div>
                <span className="material-symbols-outlined text-lg text-slate-500">expand_more</span>
              </button>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/10">
                    <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest">Tag ID</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest">Species</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Weight</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest">Health Status</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="hover:bg-primary/5 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="font-mono text-sm text-primary font-black">#GR-{1000 + i}-B</div>
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest">Registry Entry #{i * 102}</p>
                      </td>
                      <td className="px-6 py-5">
                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-tight ring-1 ring-primary/20">Loggerhead</span>
                      </td>
                      <td className="px-6 py-5 text-sm font-black text-white text-center">{(40 + i * 2.5).toFixed(1)} kg</td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${i % 3 === 0 ? 'bg-amber-400' : i % 4 === 0 ? 'bg-red-500' : 'bg-green-500'}`}></span>
                          <span className="text-sm font-bold text-white uppercase tracking-tight">{i % 3 === 0 ? 'Recovering' : i % 4 === 0 ? 'Critical' : 'Healthy'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 hover:bg-primary/20 rounded-lg text-slate-400 hover:text-primary transition-all"><span className="material-symbols-outlined text-xl">visibility</span></button>
                          <button className="p-2 hover:bg-primary/20 rounded-lg text-slate-400 hover:text-primary transition-all"><span className="material-symbols-outlined text-xl">edit</span></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-5 bg-white/[0.02] border-t border-white/10 flex items-center justify-between">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Showing <span className="text-white">1 - 25</span> of <span className="text-white">842</span> turtle records
              </div>
              <div className="flex items-center gap-1">
                <button className="w-8 h-8 rounded bg-primary text-white text-xs font-black">1</button>
                <button className="w-8 h-8 rounded hover:bg-white/10 text-white text-xs font-black transition-colors">2</button>
                <button className="w-8 h-8 rounded hover:bg-white/10 text-white text-xs font-black transition-colors">3</button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl shadow-xl hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Total Tagged</span>
                <span className="material-symbols-outlined text-primary text-xl">tag</span>
              </div>
              <div className="text-3xl font-black text-white">1,429</div>
              <div className="text-[10px] text-green-400 font-bold mt-2 flex items-center gap-1 uppercase tracking-widest">
                <span className="material-symbols-outlined text-xs">trending_up</span> +5% this season
              </div>
            </div>
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl shadow-xl hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Health Index</span>
                <span className="material-symbols-outlined text-primary text-xl">favorite</span>
              </div>
              <div className="text-3xl font-black text-white">82.4%</div>
              <div className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-widest">Population stability</div>
            </div>
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl shadow-xl hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Active Sensors</span>
                <span className="material-symbols-outlined text-primary text-xl">satellite_alt</span>
              </div>
              <div className="text-3xl font-black text-white">124</div>
              <div className="text-[10px] text-blue-400 font-bold mt-2 flex items-center gap-1 uppercase tracking-widest">
                <span className="material-symbols-outlined text-xs">check_circle</span> Live telemetry
              </div>
            </div>
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl shadow-xl hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Verification</span>
                <span className="material-symbols-outlined text-primary text-xl">fact_check</span>
              </div>
              <div className="text-3xl font-black text-white">99.2%</div>
              <div className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-widest">Field audited records</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DataManagement;
