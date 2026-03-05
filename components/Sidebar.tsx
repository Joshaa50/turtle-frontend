
import React from 'react';
import { AppView, User } from '../types';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  user: User;
  onLogout: () => void;
  isOpen: boolean;
  onToggle: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, user, onLogout, isOpen, onToggle, theme, onToggleTheme }) => {
  const menuItems = [
    { view: AppView.DASHBOARD, icon: 'dashboard', label: 'Dashboard', isImage: false, color: 'text-sky-500' },
    { view: AppView.MAP_VIEW, icon: 'map', label: 'Nest Map', isImage: false, color: 'text-emerald-500' },
    { view: AppView.TIME_TABLE, icon: 'calendar_month', label: 'Time Table', isImage: false, color: 'text-amber-500' },
    { view: AppView.NEST_RECORDS, icon: 'https://img.icons8.com/fluency/96/beach.png', label: 'Nest Records', isImage: true },
    { view: AppView.TURTLE_RECORDS, icon: 'https://img.icons8.com/fluency/96/turtle.png', label: 'Turtle Records', isImage: true },
  ];

  const adminItems = (user.role === 'Field Leader' || user.role.includes('Coordinator')) ? [
    { view: AppView.USER_MANAGEMENT, icon: 'manage_accounts', label: 'User Management', isImage: false, color: 'text-rose-500' },
  ] : [];

  const allMenuItems = [...menuItems, ...adminItems];

  return (
    <aside 
      className={`fixed lg:relative z-[70] h-full flex flex-col transition-all duration-300 ease-in-out ${
        theme === 'dark' 
          ? 'bg-[#111418] border-r border-[#283039]' 
          : 'bg-white border-r border-slate-200'
      } ${
        isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:w-0 overflow-hidden'
      }`}
    >
      {/* Header with Toggle */}
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="min-w-0">
            <h1 className={`text-sm font-bold leading-tight uppercase tracking-tight truncate ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>Turtle Guard</h1>
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
        {allMenuItems.map((item: any) => (
          <button
            key={item.view}
            onClick={() => onNavigate(item.view)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              currentView === item.view 
                ? 'bg-primary/10 text-primary border-l-4 border-primary' 
                : theme === 'dark'
                  ? 'text-slate-400 hover:bg-white/5 hover:text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
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

      <div className={`p-4 border-t space-y-4 ${
        theme === 'dark' ? 'border-[#283039]' : 'border-slate-200'
      }`}>
        {/* Theme Toggle */}
        <button 
          onClick={onToggleTheme}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
            theme === 'dark' 
              ? 'bg-white/5 text-slate-400 hover:text-primary' 
              : 'bg-slate-100 text-slate-600 hover:text-primary'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">
              {theme === 'dark' ? 'dark_mode' : 'light_mode'}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest">
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>
          <div className={`w-8 h-4 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-slate-300'}`}>
            <div className={`absolute top-0.5 size-3 bg-white rounded-full transition-all ${theme === 'dark' ? 'left-4.5' : 'left-0.5'}`}></div>
          </div>
        </button>

        <button 
          onClick={() => onNavigate(AppView.SETTINGS)}
          className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl transition-all group ${
            currentView === AppView.SETTINGS 
              ? 'bg-primary/10 ring-1 ring-primary/30' 
              : theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100'
          }`}
        >
          <div className="size-8 rounded-full bg-slate-700 overflow-hidden ring-1 ring-white/10 flex-shrink-0 group-hover:ring-primary/50 transition-all">
            <img alt="User profile" className="w-full h-full object-cover" src={user.avatar} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className={`text-xs font-bold truncate group-hover:text-primary transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>{user.name}</p>
            <p className="text-[10px] text-slate-500 truncate uppercase tracking-widest font-black">{user.role}</p>
          </div>
          <span className="material-symbols-outlined text-slate-500 text-sm group-hover:text-primary transition-colors">settings</span>
        </button>
        <div className="flex justify-end px-2">
          <button onClick={onLogout} className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-rose-500 transition-colors">
            <span className="material-symbols-outlined text-sm">logout</span>
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
