
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { AppView, User, SurveyData } from './types';
import { DatabaseConnection, Beach, decodeProfilePicture } from './services/Database';
import { DEFAULT_AVATAR } from './src/constants/icons';
import Login from './screens/Login';
import PublicStats from './screens/PublicStats';
import { getQueuedSurveys, flushOfflineSurveyQueue } from './lib/offlineSurveyQueue';
import { getQueuedWrites, flushOfflineWriteQueue } from './lib/offlineWriteQueue';
import { saveCache, loadCache } from './lib/offlineCache';
import { useOnlineStatus } from './lib/useOnlineStatus';
import { Modal } from './components/ui/Modal';
import { Button } from './components/ui/Button';
import { CloudOff, WifiOff } from 'lucide-react';
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

// Keeps the signed-in user across a page refresh, so a hard reload mid-flow
// doesn't drop the researcher back at the login screen. Only the display fields
// already held in component state are stored - never a password or token.
const SESSION_KEY = 'turtle_session_user';

const readStoredSession = (): User | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};

const persistSession = (user: User | null) => {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable (private mode, quota) - the session just won't survive
    // a refresh, which is the pre-existing behaviour.
  }
};

const App: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [user, setUser] = useState<User | null>(readStoredSession);
  const [view, setView] = useState<AppView>(() => (readStoredSession() ? AppView.DASHBOARD : AppView.LOGIN));
  // Below the lg breakpoint the sidebar renders as a fixed overlay (see
  // Sidebar.tsx's `fixed lg:relative`), so defaulting it open there covers
  // page content instead of pushing it aside like it does at lg+.
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024
  );
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

  // Nest/emergence records added on the Morning Survey are held in local state
  // until the whole survey is submitted (see lib/offlineSurveyQueue.ts), so a
  // refresh or tab close would silently discard them. Warn before that happens.
  const hasUnsavedSurveyWork = useMemo(
    () => Object.values<SurveyData>(surveys).some(
      s => (s.nests?.length || 0) > 0 || (s.tracks?.length || 0) > 0
    ),
    [surveys]
  );

  useEffect(() => {
    if (!hasUnsavedSurveyWork) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Browsers show their own generic wording; returnValue just opts in.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedSurveyWork]);

  // Codes already claimed by staged nests, so NestEntry doesn't hand out a
  // duplicate for a second nest added to the same survey session.
  const stagedNestCodes = useMemo(
    () => Object.values<SurveyData>(surveys).flatMap(
      s => (s.nests || []).map(n => n.nestCode).filter(Boolean)
    ),
    [surveys]
  );

  React.useEffect(() => {
    const fetchBeaches = async () => {
      try {
        const fetchedBeaches = await DatabaseConnection.getBeaches();
        let sortedBeaches = fetchedBeaches.sort((a, b) => a.id - b.id);
        if (sortedBeaches.length > 0) {
          saveCache('beaches', sortedBeaches);
        } else {
          // getBeaches() swallows network errors internally and resolves to
          // [] either way, so an empty result offline is indistinguishable
          // from a genuinely empty backend - fall back to the last cached
          // list rather than leaving every beach-dependent screen blank.
          const cached = loadCache<Beach[]>('beaches');
          if (cached) sortedBeaches = cached.data;
        }
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
    const loggedIn: User = {
      id: userData.id,
      firstName: userData.firstName || 'Researcher',
      lastName: userData.lastName || '',
      role: userData.role || 'Field Volunteer',
      email: userData.email,
      avatar: decodeProfilePicture(userData.profilePicture) || DEFAULT_AVATAR,
      station: userData.station,
      isActive: userData.isActive,
      profilePicture: userData.profilePicture
    };
    setUser(loggedIn);
    persistSession(loggedIn);
    setView(AppView.DASHBOARD);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    persistSession(null);
    setView(AppView.LOGIN);
  }, []);

  const [pendingNav, setPendingNav] = useState<{ v: AppView; origin?: 'records' | 'survey'; date?: string } | null>(null);

  const performNavigate = (v: AppView, origin?: 'records' | 'survey', date?: string) => {
    if (v === AppView.NEST_ENTRY) {
      setNestEntryOrigin(origin || 'records');
      if (date) setSurveyDate(date);
    }
    setView(v);
    // Only below lg, where the sidebar is a fixed overlay covering the page and
    // has to get out of the way. At lg+ it sits in the layout beside the
    // content, so closing it on every click just made the user reopen it.
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  // NestEntry/TaggingEntry only ever leave via their own onBack/onSave (which
  // call setView directly, bypassing this function) - so this only ever
  // intercepts a sidebar/header navigation away from an open, unsaved form.
  const navigate = (v: AppView, origin?: 'records' | 'survey', date?: string) => {
    if (view === AppView.NEST_ENTRY || view === AppView.TAGGING_ENTRY) {
      setPendingNav({ v, origin, date });
      return;
    }
    performNavigate(v, origin, date);
  };

  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  const [headerTitle, setHeaderTitle] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Offline queues (morning-survey submissions + direct nest/turtle writes):
  // reflect their combined size in the header, and flush both whenever the
  // browser regains connectivity (plus once on load, in case entries were
  // queued in a previous offline session).
  useEffect(() => {
    const recomputePending = () => setPendingSyncCount(getQueuedSurveys().length + getQueuedWrites().length);
    recomputePending();

    const onOnline = () => {
      flushOfflineSurveyQueue().then(recomputePending);
      flushOfflineWriteQueue().then(recomputePending);
    };

    window.addEventListener('turtle-offline-queue-changed', recomputePending);
    window.addEventListener('turtle-offline-write-queue-changed', recomputePending);
    window.addEventListener('online', onOnline);
    if (navigator.onLine) onOnline();

    return () => {
      window.removeEventListener('turtle-offline-queue-changed', recomputePending);
      window.removeEventListener('turtle-offline-write-queue-changed', recomputePending);
      window.removeEventListener('online', onOnline);
    };
  }, []);

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

  if (view === AppView.PUBLIC_STATS) {
    return <PublicStats onBack={() => setView(AppView.LOGIN)} />;
  }

  if (view === AppView.LOGIN) {
    return <Login onLogin={handleLogin} onViewPublicStats={() => setView(AppView.PUBLIC_STATS)} />;
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

      <Modal
        isOpen={!!pendingNav}
        onClose={() => setPendingNav(null)}
        title="Leave without saving?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingNav(null)}>Stay</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingNav) performNavigate(pendingNav.v, pendingNav.origin, pendingNav.date);
                setPendingNav(null);
              }}
            >
              Discard &amp; Leave
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          This entry hasn't been saved. Leaving now will discard it.
        </p>
      </Modal>

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
              {!isOnline && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500"
                  title="No connection - saved data will sync automatically once you're back online"
                >
                  <WifiOff className="size-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Offline</span>
                </div>
              )}
              {pendingSyncCount > 0 && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500"
                  title={`${pendingSyncCount} record${pendingSyncCount !== 1 ? 's' : ''} saved offline, waiting to sync`}
                >
                  <CloudOff className="size-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{pendingSyncCount} Pending</span>
                </div>
              )}
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
            stagedNestCodes={stagedNestCodes}
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
        {view === AppView.NEST_INVENTORY && <NestInventory id={selectedNestId || ''} onBack={() => setView(AppView.NEST_RECORDS)} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} setHeaderActions={setHeaderActions} />}
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
        {view === AppView.TURTLE_DETAILS && <TurtleDetails id={selectedTurtleId || ''} onBack={() => setView(AppView.TURTLE_RECORDS)} onNavigate={setView} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} user={user} />}
        {view === AppView.SETTINGS && <Settings user={user!} onUpdateUser={(updates) => setUser(prev => prev ? { ...prev, ...updates } : null)} theme={theme} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.TIME_TABLE && <TimeTable user={user!} theme={theme} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.USER_MANAGEMENT && <UserManagement user={user!} theme={theme} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
      </main>
    </div>
  );
};

export default App;
