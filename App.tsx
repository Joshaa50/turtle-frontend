
import React, { useState, useCallback } from 'react';
import { AppView, User } from './types';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Records from './screens/Records';
import NestEntry from './screens/NestEntry';
import NestDetails from './screens/NestDetails';
import NestInventory from './screens/NestInventory';
import TaggingEntry from './screens/TaggingEntry';
import TurtleDetails from './screens/TurtleDetails';
import Sidebar from './components/Sidebar';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LOGIN);
  const [user, setUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [selectedNestId, setSelectedNestId] = useState<string | null>(null);
  const [selectedTurtleId, setSelectedTurtleId] = useState<string | null>(null);

  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleLogin = useCallback((userData: { name: string; role: string; email: string }) => {
    setUser({
      name: userData.name || 'Researcher',
      role: userData.role || 'Volunteer',
      avatar: 'https://picsum.photos/seed/turtle/200/200' // Placeholder avatar
    });
    setView(AppView.DASHBOARD);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setView(AppView.LOGIN);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleViewNest = (id: string) => {
    setSelectedNestId(id);
    setView(AppView.NEST_DETAILS);
  };

  const handleInventoryNest = (id: string) => {
    setSelectedNestId(id);
    setView(AppView.NEST_INVENTORY);
  };

  const handleViewTurtle = (id: string) => {
    setSelectedTurtleId(id);
    setView(AppView.TURTLE_DETAILS);
  };

  if (view === AppView.LOGIN) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className={`flex h-screen overflow-hidden ${theme === 'dark' ? 'bg-background-dark text-slate-100' : 'bg-background-light text-slate-900'} font-display relative`}>
      <Sidebar 
        currentView={view} 
        onNavigate={(v) => {
          setView(v);
          setIsSidebarOpen(false);
        }} 
        user={user!} 
        onLogout={handleLogout} 
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      
      <main className={`flex-1 overflow-y-auto bg-background-light dark:bg-background-dark relative transition-all duration-300 ease-in-out`}>
        
        {!isSidebarOpen && (
          <button 
            onClick={toggleSidebar}
            className={`fixed top-4 left-4 z-[60] size-10 rounded-lg flex items-center justify-center shadow-xl transition-all animate-in fade-in slide-in-from-left-4 ${theme === 'dark' ? 'bg-surface-dark border border-border-dark text-primary hover:bg-primary hover:text-white' : 'bg-primary border-transparent text-white hover:bg-primary/90'}`}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        )}

        {view === AppView.DASHBOARD && <Dashboard onNavigate={setView} theme={theme} />}
        {view === AppView.NEST_RECORDS && <Records type="nest" onNavigate={setView} onSelectNest={handleViewNest} onInventoryNest={handleInventoryNest} theme={theme} />}
        {view === AppView.TURTLE_RECORDS && <Records type="turtle" onNavigate={setView} onSelectTurtle={handleViewTurtle} theme={theme} />}
        {view === AppView.NEST_ENTRY && <NestEntry onBack={() => setView(AppView.NEST_RECORDS)} theme={theme} />}
        {view === AppView.NEST_DETAILS && <NestDetails id={selectedNestId || ''} onBack={() => setView(AppView.NEST_RECORDS)} />}
        {view === AppView.NEST_INVENTORY && <NestInventory id={selectedNestId || ''} onBack={() => setView(AppView.NEST_RECORDS)} />}
        {view === AppView.TAGGING_ENTRY && <TaggingEntry onBack={() => setView(AppView.TURTLE_RECORDS)} theme={theme} />}
        {view === AppView.TURTLE_DETAILS && <TurtleDetails id={selectedTurtleId || ''} onBack={() => setView(AppView.TURTLE_RECORDS)} onNavigate={setView} />}
      </main>
    </div>
  );
};

export default App;
