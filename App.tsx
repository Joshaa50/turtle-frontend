
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppView, User, SurveyData } from './types';
import { DatabaseConnection, Beach, decodeProfilePicture } from './services/Database';
import { DEFAULT_AVATAR } from './src/constants/icons';
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

import { Menu, ArrowLeft } from 'lucide-react';

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
  const [user, setUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [selectedNestId, setSelectedNestId] = useState<string | null>(null);
  const [selectedTurtleId, setSelectedTurtleId] = useState<string | null>(null);
  const [newNest, setNewNest] = useState<any>(null);
  const [nestEntryOrigin, setNestEntryOrigin] = useState<'records' | 'survey'>('records');
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [surveys, setSurveys] = useState<Record<string, SurveyData>>({});
  const [currentBeach, setCurrentBeach] = useState('');
  const [currentRegion, setCurrentRegion] = useState('');
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().split('T')[0]);
  const mainRef = useRef<HTMLElement>(null);

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
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleLogin = useCallback((userData: { 
    id: string | number; 
    firstName: string; 
    lastName: string; 
    role: string; 
    email: string; 
    station?: string;
    profilePicture?: string;
    isActive?: boolean;
  }) => {
    setUser({
      id: userData.id,
      firstName: userData.firstName || 'Researcher',
      lastName: userData.lastName || '',
      role: userData.role || 'Field Volunteer',
      email: userData.email,
      avatar: decodeProfilePicture(userData.profilePicture) || DEFAULT_AVATAR,
      station: userData.station,
      isActive: userData.isActive,
      profilePicture: userData.profilePicture
    });
    setView(AppView.DASHBOARD);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setView(AppView.LOGIN);
  }, []);

  const navigate = (v: AppView, origin?: 'records' | 'survey', date?: string) => {
    if (v === AppView.NEST_ENTRY) {
      setNestEntryOrigin(origin || 'records');
      if (date) setSurveyDate(date);
    }
    setView(v);
    setIsSidebarOpen(false);
  };

  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  const [headerTitle, setHeaderTitle] = useState<string | null>(null);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
    // Clear header actions on view change
    setHeaderActions(null);
    setHeaderTitle(null);
  }, [view]);
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
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
    <div className={`flex h-screen overflow-hidden ${theme === 'dark' ? 'bg-background-dark text-slate-100' : 'bg-background-light text-slate-900'} font-sans relative`}>
      <Sidebar 
        currentView={view} 
        onNavigate={navigate} 
        user={user!} 
        onLogout={handleLogout} 
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[1500] lg:hidden"
          onClick={toggleSidebar}
        />
      )}
      
      <main ref={mainRef} className={`flex-1 overflow-y-auto bg-background-light dark:bg-background-dark relative transition-all duration-300 ease-in-out`}>
        <header className={`border-b sticky top-0 z-[60] transition-all duration-300 ${theme === 'dark' ? 'bg-[#111418] border-primary/10' : 'bg-white border-slate-200'}`}>
          <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between relative">
            <div className="flex items-center gap-4 z-20">
              <button 
                onClick={toggleSidebar}
                className={`size-10 rounded-lg flex items-center justify-center transition-all ${theme === 'dark' ? 'text-primary hover:bg-white/5' : 'text-primary hover:bg-slate-100'}`}
              >
                <Menu className="size-5" />
              </button>
            </div>
            
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-center">
              <div className="flex flex-col items-center">
                <h1 className="text-lg font-black tracking-tighter uppercase leading-none text-slate-900 dark:text-white">
                  {headerTitle ? headerTitle : (
                    <>
                      {view === AppView.DASHBOARD && 'Dashboard'}
                      {view === AppView.NEST_RECORDS && 'Nest Records'}
                      {view === AppView.TURTLE_RECORDS && 'Turtle Records'}
                      {view === AppView.NEST_ENTRY && 'Nest Entry'}
                      {view === AppView.NEST_DETAILS && 'Nest Details'}
                      {view === AppView.NEST_INVENTORY && 'Nest Inventory'}
                      {view === AppView.MAP_VIEW && 'Nest Map'}
                      {view === AppView.TAGGING_ENTRY && 'Tagging Entry'}
                      {view === AppView.MORNING_SURVEY && 'Morning Survey'}
                      {view === AppView.TURTLE_DETAILS && 'Turtle Details'}
                      {view === AppView.SETTINGS && 'Settings'}
                      {view === AppView.TIME_TABLE && 'Time Table'}
                      {view === AppView.USER_MANAGEMENT && 'User Management'}
                    </>
                  )}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-4 justify-end z-20">
              {headerActions}
            </div>
          </div>
        </header>

        {view === AppView.DASHBOARD && <Dashboard onNavigate={navigate} theme={theme} user={user} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.NEST_RECORDS && <Records type="nest" onNavigate={navigate} onSelectNest={handleViewNest} onInventoryNest={handleInventoryNest} theme={theme} user={user!} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.TURTLE_RECORDS && <Records type="turtle" onNavigate={navigate} onSelectTurtle={handleViewTurtle} theme={theme} user={user!} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.NEST_ENTRY && (
          <NestEntry 
            onBack={() => setView(nestEntryOrigin === 'records' ? AppView.NEST_RECORDS : AppView.MORNING_SURVEY)} 
            onSave={(data) => { setNewNest(data); setView(AppView.MORNING_SURVEY); }} 
            theme={theme} 
            beaches={beaches} 
            initialBeach={currentBeach}
            initialDate={surveyDate}
            origin={nestEntryOrigin}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={toggleSidebar}
            setHeaderActions={setHeaderActions}
            setHeaderTitle={setHeaderTitle}
          />
        )}
        {view === AppView.NEST_DETAILS && (
          <NestDetails 
            id={selectedNestId || ''} 
            onBack={() => setView(AppView.NEST_RECORDS)} 
            user={user!} 
            isSidebarOpen={isSidebarOpen} 
            onToggleSidebar={toggleSidebar} 
            setHeaderActions={setHeaderActions}
          />
        )}
        {view === AppView.NEST_INVENTORY && <NestInventory id={selectedNestId || ''} onBack={() => setView(AppView.NEST_RECORDS)} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.MAP_VIEW && <NestMap onNavigate={navigate} onSelectNest={handleViewNest} theme={theme} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.TAGGING_ENTRY && <TaggingEntry onBack={() => setView(AppView.TURTLE_RECORDS)} theme={theme} beaches={beaches} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.MORNING_SURVEY && (
          <MorningSurvey 
            onNavigate={(v, date) => navigate(v, 'survey', date)} 
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
            initialDate={surveyDate}
            onDateChange={setSurveyDate}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={toggleSidebar}
          />
        )}
        {view === AppView.TURTLE_DETAILS && <TurtleDetails id={selectedTurtleId || ''} onBack={() => setView(AppView.TURTLE_RECORDS)} onNavigate={setView} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.SETTINGS && <Settings user={user!} onUpdateUser={(updates) => setUser(prev => prev ? { ...prev, ...updates } : null)} theme={theme} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.TIME_TABLE && <TimeTable user={user!} theme={theme} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.USER_MANAGEMENT && <UserManagement user={user!} theme={theme} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
      </main>
    </div>
  );
};

export default App;
