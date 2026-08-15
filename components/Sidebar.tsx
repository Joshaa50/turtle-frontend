
import React, { useEffect, useRef, useState } from 'react';
import { AppView, User } from '../types';
import {
  LayoutDashboard,
  Calendar,
  Sun,
  Map,
  UserCog,
  Moon,
  Settings,
  LogOut,
  ChevronDown,
  PanelLeftClose
} from 'lucide-react';

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
    { view: AppView.DASHBOARD, icon: <LayoutDashboard className="size-5" />, label: 'Dashboard', isImage: false, color: 'text-sky-500' },
    { view: AppView.TIME_TABLE, icon: <Calendar className="size-5" />, label: 'Time Table', isImage: false, color: 'text-amber-500' },
    { view: AppView.MORNING_SURVEY, icon: <Sun className="size-5" />, label: 'Morning Survey', isImage: false, color: 'text-yellow-500' },
    { view: AppView.NEST_RECORDS, icon: 'https://img.icons8.com/fluency/96/beach.png', label: 'Nest Records', isImage: true },
    { view: AppView.TURTLE_RECORDS, icon: 'https://img.icons8.com/fluency/96/turtle.png', label: 'Turtle Records', isImage: true },
    { view: AppView.MAP_VIEW, icon: <Map className="size-5" />, label: 'Nest Map', isImage: false, color: 'text-emerald-500' },
  ];

  const adminItems = (user.role === 'Field Leader' || user.role.includes('Coordinator')) ? [
    { view: AppView.USER_MANAGEMENT, icon: <UserCog className="size-5" />, label: 'User Management', isImage: false, color: 'text-rose-500' },
  ] : [];

  const allMenuItems = [...menuItems, ...adminItems];

  // On a short viewport the last entries (User Management for admins) fall
  // below the fold of the nav's own scroll area with nothing to say so. Track
  // whether anything is still hidden below and show a fade + chevron while it
  // is.
  const navRef = useRef<HTMLElement>(null);
  const [hasItemsBelowFold, setHasItemsBelowFold] = useState(false);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const update = () => setHasItemsBelowFold(el.scrollHeight - el.clientHeight - el.scrollTop > 1);

    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [allMenuItems.length, isOpen]);

  return (
    <aside 
      id="sidebar"
      className={`fixed lg:relative z-[2000] h-full flex flex-col transition-all duration-300 ease-in-out ${
        theme === 'dark' 
          ? 'bg-[#111418] border-r border-[#283039]' 
          : 'bg-white border-r border-slate-200'
      } ${
        isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:w-0 overflow-hidden'
      }`}
    >
      {/* Fixed-width inner shell. Without it the nav labels reflow as the aside
          animates to w-0, so mid-transition they clip to single letters; pinned
          at w-64 the content slides out intact, and the opacity fade (shorter
          than the 300ms width tween) clears it before the edge reaches it. */}
      <div
        className={`flex flex-col h-full w-64 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0'
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
          <PanelLeftClose className="size-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 mt-4 relative">
      <nav ref={navRef} className="h-full px-4 pb-6 space-y-1 overflow-y-auto custom-scrollbar">
        {allMenuItems.map((item: any) => (
          <button
            key={item.view}
            onClick={() => onNavigate(item.view)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
              currentView === item.view 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : theme === 'dark'
                  ? 'text-slate-400 hover:bg-white/5 hover:text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.isImage ? (
              <img src={item.icon} alt="" className={`size-5 object-contain transition-transform group-hover:scale-110 ${currentView === item.view ? 'brightness-0 invert' : ''}`} />
            ) : (
              <div className={`${currentView === item.view ? 'text-white' : (item.color || '')} transition-colors`}>
                {item.icon}
              </div>
            )}
            <span className="text-xs font-black uppercase tracking-widest truncate">{item.label}</span>
          </button>
        ))}
      </nav>
      {hasItemsBelowFold && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 flex items-end justify-center bg-gradient-to-t to-transparent ${
            theme === 'dark' ? 'from-[#111418]' : 'from-white'
          }`}
        >
          <ChevronDown className="size-4 text-slate-400 animate-bounce" />
        </div>
      )}
      </div>

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
            {theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
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
            <img 
              alt="User profile" 
              className="w-full h-full object-cover" 
              src={user.avatar} 
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className={`text-sm font-bold truncate group-hover:text-primary transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>{user.firstName} {user.lastName}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">{user.role}</p>
          </div>
          <Settings className="size-4 text-slate-500 group-hover:text-primary transition-colors" />
        </button>
        <div className="flex justify-end px-2">
          <button onClick={onLogout} className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-rose-500 transition-colors">
            <LogOut className="size-3.5" />
            Logout
          </button>
        </div>
      </div>
      </div>
    </aside>
  );
};

export default Sidebar;
