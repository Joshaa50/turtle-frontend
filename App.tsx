
import React, { useState, useCallback } from 'react';
import { AppView, User, SurveyData } from './types';
import { DatabaseConnection, Beach } from './services/Database';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Records from './screens/Records';
import NestEntry from './screens/NestEntry';
import NestDetails from './screens/NestDetails';
import NestInventory from './screens/NestInventory';
import NestMap from './screens/NestMap';
import TimeTable from './screens/TimeTable';
import TaggingEntry from './screens/TaggingEntry';
import MorningSurvey from './screens/MorningSurvey';
import TurtleDetails from './screens/TurtleDetails';
import Settings from './screens/Settings';
import UserManagement from './screens/UserManagement';
import Sidebar from './components/Sidebar';

const defaultSurveyData: SurveyData = {
  firstTime: '',
  lastTime: '',
  region: '',
  tlGpsLat: '',
  tlGpsLng: '',
  trGpsLat: '',
  trGpsLng: '',
  nestTally: 0,
  nests: [],
  tracks: [],
  notes: ''
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LOGIN);
  const [previousView, setPreviousView] = useState<AppView>(AppView.LOGIN);
  const [user, setUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [selectedNestId, setSelectedNestId] = useState<string | null>(null);
  const [selectedTurtleId, setSelectedTurtleId] = useState<string | null>(null);
  const [newNest, setNewNest] = useState<any>(null);
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [surveys, setSurveys] = useState<Record<string, SurveyData>>({});
  const [currentBeach, setCurrentBeach] = useState('');
  const [currentRegion, setCurrentRegion] = useState('');

  const handleNavigate = useCallback((newView: AppView) => {
    setPreviousView(prev => {
      // Only update previous view if we are actually changing views
      if (view !== newView) {
        return view;
      }
      return prev;
    });
    setView(newView);
  }, [view]);

  React.useEffect(() => {
    const fetchBeaches = async () => {
      try {
        const fetchedBeaches = await DatabaseConnection.getBeaches();
        const sortedBeaches = fetchedBeaches.sort((a, b) => a.id - b.id);
        setBeaches(sortedBeaches);
        
        if (sortedBeaches.length > 0) {
          if (!currentRegion) {
            const firstRegion = sortedBeaches[0].survey_area;
            setCurrentRegion(firstRegion);
            
            if (!currentBeach) {
              const regionBeaches = sortedBeaches
                .filter(b => b.survey_area === firstRegion)
                .sort((a, b) => {
                  if (a.name === 'Loggos 2') return -1;
                  if (b.name === 'Loggos 2') return 1;
                  return a.id - b.id;
                });
              if (regionBeaches.length > 0) {
                setCurrentBeach(regionBeaches[0].name);
              }
            }
          }
        }
        
        // Initialize surveys for each beach if not already present
        setSurveys(prev => {
          const newSurveys = { ...prev };
          sortedBeaches.forEach(beach => {
            if (!newSurveys[beach.name]) {
              newSurveys[beach.name] = { ...defaultSurveyData };
            }
          });
          return newSurveys;
        });
      } catch (err) {
        console.error("Failed to fetch beaches:", err);
      }
    };
    fetchBeaches();
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      if (isSidebarOpen && sidebar && !sidebar.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleLogin = useCallback((userData: { name: string; role: string; email: string; station?: string }) => {
    setUser({
      name: userData.name || 'Researcher',
      role: userData.role || 'Field Volunteer',
      email: userData.email,
      avatar: 'https://picsum.photos/seed/turtle/200/200', // Placeholder avatar
      station: userData.station
    });
    handleNavigate(AppView.DASHBOARD);
  }, [handleNavigate]);

  const handleLogout = useCallback(() => {
    setUser(null);
    handleNavigate(AppView.LOGIN);
  }, [handleNavigate]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleViewNest = (id: string) => {
    setSelectedNestId(id);
    handleNavigate(AppView.NEST_DETAILS);
  };

  const handleInventoryNest = (id: string) => {
    setSelectedNestId(id);
    handleNavigate(AppView.NEST_INVENTORY);
  };

  const handleViewTurtle = (id: string) => {
    setSelectedTurtleId(id);
    handleNavigate(AppView.TURTLE_DETAILS);
  };

  if (view === AppView.LOGIN) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className={`flex h-screen overflow-hidden ${theme === 'dark' ? 'bg-background-dark text-slate-100' : 'bg-background-light text-slate-900'} font-sans relative`}>
      <Sidebar 
        currentView={view} 
        onNavigate={(v) => {
          handleNavigate(v);
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

        {view === AppView.DASHBOARD && <Dashboard onNavigate={handleNavigate} theme={theme} user={user} />}
        {view === AppView.NEST_RECORDS && <Records type="nest" onNavigate={handleNavigate} onSelectNest={handleViewNest} onInventoryNest={handleInventoryNest} theme={theme} user={user!} />}
        {view === AppView.TURTLE_RECORDS && <Records type="turtle" onNavigate={handleNavigate} onSelectTurtle={handleViewTurtle} theme={theme} user={user!} />}
        {view === AppView.NEST_ENTRY && (
          <NestEntry 
            onBack={() => handleNavigate(previousView)} 
            onSave={async (data) => { 
              if (previousView !== AppView.MORNING_SURVEY) {
                try {
                  if (data.isEmergence) {
                    await DatabaseConnection.createEmergence({
                      ...data.payload,
                      event_date: data.payload.date_laid
                    });
                  } else {
                    await DatabaseConnection.createNest(data.payload);
                  }
                  handleNavigate(previousView);
                } catch (e) {
                  console.error(e);
                  throw new Error('Failed to save to database');
                }
              } else {
                setNewNest(data); 
                handleNavigate(AppView.MORNING_SURVEY); 
              }
            }} 
            theme={theme} 
            beaches={beaches} 
            initialBeach={currentBeach}
          />
        )}
        {view === AppView.NEST_DETAILS && <NestDetails id={selectedNestId || ''} onBack={() => handleNavigate(AppView.NEST_RECORDS)} user={user!} />}
        {view === AppView.NEST_INVENTORY && <NestInventory id={selectedNestId || ''} onBack={() => handleNavigate(AppView.NEST_RECORDS)} />}
        {view === AppView.MAP_VIEW && <NestMap onNavigate={handleNavigate} onSelectNest={handleViewNest} theme={theme} />}
        {view === AppView.TAGGING_ENTRY && <TaggingEntry onBack={() => handleNavigate(AppView.TURTLE_RECORDS)} theme={theme} beaches={beaches} />}
        {view === AppView.MORNING_SURVEY && (
          <MorningSurvey 
            onNavigate={handleNavigate} 
            newNest={newNest} 
            onClearNest={() => setNewNest(null)} 
            theme={theme} 
            surveys={surveys}
            onUpdateSurveys={setSurveys}
            beaches={beaches}
            currentBeach={currentBeach}
            setCurrentBeach={setCurrentBeach}
            currentRegion={currentRegion}
            setCurrentRegion={setCurrentRegion}
          />
        )}
        {view === AppView.TURTLE_DETAILS && <TurtleDetails id={selectedTurtleId || ''} onBack={() => handleNavigate(AppView.TURTLE_RECORDS)} onNavigate={handleNavigate} />}
        {view === AppView.SETTINGS && <Settings user={user!} onUpdateUser={(updates) => setUser(prev => prev ? { ...prev, ...updates } : null)} theme={theme} />}
        {view === AppView.TIME_TABLE && <TimeTable user={user!} theme={theme} />}
        {view === AppView.USER_MANAGEMENT && <UserManagement user={user!} theme={theme} />}
      </main>
    </div>
  );
};

export default App;
