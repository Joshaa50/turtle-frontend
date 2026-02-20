
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
import DataManagement from './screens/DataManagement';
import TallyScreen from './screens/TallyScreen';
import Sidebar from './components/Sidebar';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LOGIN);
  const [user, setUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedNestId, setSelectedNestId] = useState<string | null>(null);
  const [selectedTurtleId, setSelectedTurtleId] = useState<string | null>(null);

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
    <div className="flex h-screen overflow-hidden bg-background-dark text-slate-100 font-display relative">
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
      />
      
      <main className={`flex-1 overflow-y-auto bg-background-light dark:bg-background-dark custom-scrollbar relative transition-all duration-300 ease-in-out`}>
        
        {!isSidebarOpen && (
          <button 
            onClick={toggleSidebar}
            className="fixed top-4 left-4 z-[60] size-10 bg-surface-dark border border-border-dark rounded-lg flex items-center justify-center text-primary shadow-xl hover:bg-primary hover:text-white transition-all animate-in fade-in slide-in-from-left-4"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        )}

        {view === AppView.DASHBOARD && <Dashboard onNavigate={setView} />}
        {view === AppView.NEST_RECORDS && <Records type="nest" onNavigate={setView} onSelectNest={handleViewNest} onInventoryNest={handleInventoryNest} />}
        {view === AppView.TURTLE_RECORDS && <Records type="turtle" onNavigate={setView} onSelectTurtle={handleViewTurtle} />}
        {view === AppView.DATA_MANAGEMENT && <DataManagement />}
        {view === AppView.NEST_ENTRY && <NestEntry onBack={() => setView(AppView.NEST_RECORDS)} />}
        {view === AppView.NEST_DETAILS && <NestDetails id={selectedNestId || ''} onBack={() => setView(AppView.NEST_RECORDS)} />}
        {view === AppView.NEST_INVENTORY && <NestInventory id={selectedNestId || ''} onBack={() => setView(AppView.NEST_RECORDS)} />}
        {view === AppView.TAGGING_ENTRY && <TaggingEntry onBack={() => setView(AppView.TURTLE_RECORDS)} />}
        {view === AppView.TURTLE_DETAILS && <TurtleDetails id={selectedTurtleId || ''} onBack={() => setView(AppView.TURTLE_RECORDS)} onNavigate={setView} />}
        {view === AppView.TALLY_SCREEN && <TallyScreen />}
      </main>
    </div>
  );
};

export default App;
