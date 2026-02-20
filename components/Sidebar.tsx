
import React from 'react';
import { AppView, User } from '../types';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  user: User;
  onLogout: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, user, onLogout, isOpen, onToggle }) => {
  const menuItems = [
    { view: AppView.DASHBOARD, icon: 'dashboard', label: 'Dashboard', isImage: false, color: 'text-sky-500' },
    { view: AppView.NEST_RECORDS, icon: 'https://img.icons8.com/fluency/96/beach.png', label: 'Nest Records', isImage: true },
    { view: AppView.TURTLE_RECORDS, icon: 'https://img.icons8.com/fluency/96/turtle.png', label: 'Turtle Records', isImage: true },
    { view: AppView.DATA_MANAGEMENT, icon: 'database', label: 'Data Control', isImage: false },
  ];

  return (
    <aside 
      className={`fixed lg:relative z-[70] h-full flex flex-col bg-[#111418] border-r border-slate-200 dark:border-[#283039] transition-all duration-300 ease-in-out ${
        isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:w-0 overflow-hidden'
      }`}
    >
      {/* Header with Toggle */}
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="min-w-0">
            <h1 className="text-sm font-bold leading-tight uppercase tracking-tight truncate">Turtle Guard</h1>
          </div>
        </div>
        <button 
          onClick={onToggle}
          className="p-1 hover:bg-white/5 rounded-lg text-slate-500 hover:text-primary transition-colors"
          title="Collapse Sidebar"
        >
          <span className="material-symbols-outlined">menu_open</span>
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto custom-scrollbar">
        {menuItems.map((item: any) => (
          <button
            key={item.view}
            onClick={() => onNavigate(item.view)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              currentView === item.view 
                ? 'bg-primary/10 text-primary border-l-4 border-primary' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {item.isImage ? (
              <img src={item.icon} alt="" className="size-6 object-contain" />
            ) : (
              <span className={`material-symbols-outlined ${currentView === item.view ? 'font-variation-settings-FILL-1' : ''} ${item.color || ''}`}>
                {item.icon}
              </span>
            )}
            <span className="text-sm font-bold uppercase tracking-wider truncate">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-[#283039] space-y-4">
        <button className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all border border-primary/20">
          <span className="material-symbols-outlined text-sm">sync</span>
          <span className="truncate">Sync Offline Data</span>
        </button>

        <div className="flex items-center gap-3 px-2">
          <div className="size-8 rounded-full bg-slate-700 overflow-hidden ring-1 ring-white/10 flex-shrink-0">
            <img alt="User profile" className="w-full h-full object-cover" src={user.avatar} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{user.name}</p>
            <p className="text-xs text-primary font-medium truncate">{user.role}</p>
          </div>
          <button onClick={onLogout} className="material-symbols-outlined text-slate-400 text-sm hover:text-primary transition-colors flex-shrink-0">logout</button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
