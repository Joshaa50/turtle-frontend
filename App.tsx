
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { AppView, User, SurveyData } from './types';
import { DatabaseConnection, Beach, decodeProfilePicture, UNAUTHORIZED_EVENT, SESSION_EXPIRED_MESSAGE, getAuthToken, isTokenExpired, tokenExpiresAt, tokenRole } from './services/Database';
import { DEFAULT_AVATAR } from './src/constants/icons';
import Login from './screens/Login';
import PublicStats from './screens/PublicStats';
import { getQueuedSurveys, flushOfflineSurveyQueue } from './lib/offlineSurveyQueue';
import { getQueuedWrites, flushOfflineWriteQueue } from './lib/offlineWriteQueue';
import { saveCache, loadCache, clearCache } from './lib/offlineCache';
import { loadSurveyDraft, saveSurveyDraft, clearSurveyDraft, hasAnySurveyContent } from './lib/surveyDraft';
import { useOnlineStatus } from './lib/useOnlineStatus';
import { pathForRoute, routeForPath, RouteState } from './lib/routing';
import { Modal } from './components/ui/Modal';
import { Button } from './components/ui/Button';
import { CloudOff, WifiOff, RotateCcw } from 'lucide-react';
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
import ReviewQueue from './screens/ReviewQueue';
import Sidebar from './components/Sidebar';

import { Menu, ArrowLeft } from 'lucide-react';
import ProjectSettings from './screens/ProjectSettings';
import AlertsBell from './components/AlertsBell';
import SeasonReport from './screens/SeasonReport';
import { todayLocal } from './lib/utils';

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

// A stored session whose token has already run out. Kept apart from
// readStoredSession so the login screen can say *why* it is showing, instead of
// looking like the app forgot the user for no reason.
const storedSessionHasExpired = (): boolean => {
  try {
    const token = getAuthToken();
    return !!token && isTokenExpired(token) && !!localStorage.getItem(SESSION_KEY);
  } catch {
    return false;
  }
};

const readStoredSession = (): User | null => {
  try {
    // No token, no session. Requiring the token here just stops a forged or
    // leftover entry from flashing up a dashboard that cannot load anything.
    const token = getAuthToken();
    if (!token) return null;
    // Nor is a token the server is certain to refuse worth resuming with.
    if (isTokenExpired(token)) return null;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as User;
    // The role every menu/page gate in this app reads off `user.role` - so it
    // must come from the signed token, not this plain localStorage copy,
    // which DevTools can edit to anything and used to unlock Coordinator-only
    // screens that way (empty of data, since every request still carries the
    // real token and the server enforces its real role, but the menus
    // themselves should never have appeared).
    const signedRole = tokenRole(token);
    if (signedRole && stored.role !== signedRole) return null;
    return stored;
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

// What screen (and, for a nest or turtle, which record) a fresh load should
// land on - read from the URL so a refresh or a shared link stays put
// instead of always dropping to the Dashboard. Falls back to the previous
// fixed behaviour (Dashboard if signed in, Login otherwise) whenever the URL
// names no known screen, or names one that needs a session that isn't there.
const initialRoute = (): RouteState => {
  const hasSession = !!readStoredSession();
  const fallback: RouteState = { view: hasSession ? AppView.DASHBOARD : AppView.LOGIN };
  if (typeof window === 'undefined') return fallback;
  const parsed = routeForPath(window.location.pathname, window.location.search);
  if (!parsed) return fallback;
  if (parsed.view === AppView.PUBLIC_STATS) return parsed;
  if (!hasSession) return fallback;
  if (parsed.view === AppView.LOGIN) return { view: AppView.DASHBOARD };
  return parsed;
};

const App: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [user, setUser] = useState<User | null>(readStoredSession);
  // Set when the session ended without the person choosing to sign out.
  const [sessionNotice, setSessionNotice] = useState<string | null>(
    () => (storedSessionHasExpired() ? SESSION_EXPIRED_MESSAGE : null)
  );
  // Computed once: which screen (and record) the URL names, so a refresh or
  // a shared link lands back where it was instead of always on the Dashboard.
  const initial = useMemo(() => initialRoute(), []);
  const [view, setView] = useState<AppView>(initial.view);
  // Below the lg breakpoint the sidebar renders as a fixed overlay (see
  // Sidebar.tsx's `fixed lg:relative`), so defaulting it open there covers
  // page content instead of pushing it aside like it does at lg+.
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('turtle_theme') : null;
    return stored === 'light' || stored === 'dark' ? stored : 'dark';
  });
  const [selectedNestId, setSelectedNestId] = useState<string | null>(initial.nestId ?? null);
  const [selectedTurtleId, setSelectedTurtleId] = useState<string | null>(initial.turtleId ?? null);
  const [newNest, setNewNest] = useState<any>(null);
  const [nestEntryOrigin, setNestEntryOrigin] = useState<'records' | 'survey'>(initial.nestEntryOrigin ?? 'records');
  // Whether the next NEST_ENTRY visit should open with the Nest toggle already
  // on - set when the user's own click already said "nest" (Records' "New
  // Nest" button), left off for the ambiguous "Record a Nest or Emergence"
  // entry points, which default to Emergence as before.
  const [nestEntryInitialIsNest, setNestEntryInitialIsNest] = useState(false);
  const [beaches, setBeaches] = useState<Beach[]>([]);
  // Drives the count on the Review Queue nav item, so a leader can see there
  // is fieldwork waiting on them without opening the screen to find out.
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  // Bumped whenever refreshPendingReviews runs, so AlertsBell's refreshKey
  // changes after a Review Queue mutation and not just on navigation. Kept
  // as a number (composed into a string below) rather than a fresh
  // object/array, since AlertsBell's effect dependency does identity
  // comparison on refreshKey - a non-primitive would refetch every render.
  const [alertsVersion, setAlertsVersion] = useState(0);
  // An unsubmitted survey is mirrored to localStorage (see lib/surveyDraft.ts),
  // so a phone locking, a refresh or a flat battery mid-patrol doesn't take the
  // morning's work with it.
  const restoredDraft = useMemo(() => loadSurveyDraft(), []);
  const [surveys, setSurveys] = useState<Record<string, SurveyData>>(() => restoredDraft?.surveys || {});
  const [currentBeach, setCurrentBeach] = useState(() => restoredDraft?.beach || '');
  const [currentRegion, setCurrentRegion] = useState(() => restoredDraft?.region || '');
  const [surveyDate, setSurveyDate] = useState(
    () => restoredDraft?.date || todayLocal()
  );
  const [draftNoticeDismissed, setDraftNoticeDismissed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const hasUnsavedSurveyWork = useMemo(() => hasAnySurveyContent(surveys), [surveys]);

  // Mirror the in-progress survey after a short pause in typing, rather than on
  // every keystroke - a staged nest can carry a base64 track sketch, so these
  // writes aren't free.
  useEffect(() => {
    const timer = setTimeout(() => {
      saveSurveyDraft({ surveys, date: surveyDate, region: currentRegion, beach: currentBeach });
    }, 500);
    return () => clearTimeout(timer);
  }, [surveys, surveyDate, currentRegion, currentBeach]);

  // The draft makes a refresh survivable, but it isn't a submitted survey -
  // still warn, so nobody closes the tab believing the morning is filed.
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

  const refreshBeaches = useCallback(async () => {
    if (!user) return;
    const fetched = await DatabaseConnection.getBeaches();
    if (fetched.length > 0) {
      const sorted = [...fetched].sort((a, b) => a.id - b.id);
      saveCache('beaches', sorted);
      setBeaches(sorted);
    }
  }, [user]);

  React.useEffect(() => {
    // /beaches is an authenticated route, so this must wait for a session.
    // Running it on mount alone fired it on the login screen, where the 401
    // was swallowed into an empty list that then never refilled - leaving
    // Morning Survey with no beaches and Nest Entry's required Beach field
    // empty until the user happened to reload.
    if (!user) return;
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
  }, [user]);

  // A reviewer counts everything still pending; a volunteer counts only their
  // own submissions still awaiting a decision, which is what their version of
  // the screen shows them.
  const refreshPendingReviews = useCallback(async () => {
    setAlertsVersion((v) => v + 1);
    if (!user) { setPendingReviewCount(0); return; }
    const isReviewer = user.role === 'Field Leader' || user.role.includes('Coordinator');
    // Review rules can hold an Assistant's records too, so anyone who is not a
    // reviewer sees their own submissions; the list is empty when none are held.
    const isVolunteer = user.role === 'Field Volunteer' || user.role === 'Field Assistant';
    if (!isReviewer && !isVolunteer) { setPendingReviewCount(0); return; }
    try {
      const rows = isReviewer
        ? await DatabaseConnection.getReviews('pending')
        : (await DatabaseConnection.getMyReviews()).filter((r: any) => r.status === 'pending');
      setPendingReviewCount(rows.length);
    } catch {
      // The badge is an affordance, not a record - a failed count should never
      // be louder than the screen it points at.
      setPendingReviewCount(0);
    }
  }, [user]);

  // Re-counted on every navigation, so approving something and leaving the
  // screen is reflected without a refresh.
  React.useEffect(() => { refreshPendingReviews(); }, [refreshPendingReviews, view]);

  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('turtle_theme', theme);
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
    setSessionNotice(null);
    setUser(loggedIn);
    persistSession(loggedIn);
    setView(AppView.DASHBOARD);
  }, []);

  const handleLogout = useCallback(() => {
    setSessionNotice(null);
    setUser(null);
    persistSession(null);
    DatabaseConnection.logout();
    // Don't hand the next person to sign in on this device a half-finished
    // survey belonging to whoever was here before.
    setSurveys({});
    clearSurveyDraft();
    // Nor the cached copy of what the last researcher could see. These snapshots
    // hold nest GPS positions and colleagues' details, and field devices get
    // passed around. The offline *write* queues are left alone on purpose:
    // they hold work not yet sent to the server, and dropping a survey someone
    // recorded out of signal would be a far worse failure than this one.
    clearCache();
    try {
      localStorage.removeItem('turtle_timetable');
    } catch {
      // Storage unavailable - nothing was stored to clear.
    }
    setView(AppView.LOGIN);
  }, []);

  // The stored session is only a convenience - the server decides whether it is
  // still good. When it says no (expired token, or a secret rotated under us),
  // stop showing a signed-in UI that can no longer load or save anything.
  //
  // The person is told why they are back at sign-in. Without that, an expired
  // session showed up as screens that spun or showed stale figures, with the
  // real reason visible only in the browser console.
  const userRef = useRef(user);
  userRef.current = user;

  const endSession = useCallback(() => {
    if (!userRef.current) return;
    persistSession(null);
    setSessionNotice(SESSION_EXPIRED_MESSAGE);
    setUser(null);
    setView(AppView.LOGIN);
  }, []);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, endSession);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, endSession);
  }, [endSession]);

  // Notice a token running out while the tab sits open, or when a phone wakes
  // up hours later, rather than waiting for the next request to fail.
  useEffect(() => {
    if (!user) return;
    const check = () => {
      if (isTokenExpired(getAuthToken())) endSession();
    };
    const at = tokenExpiresAt(getAuthToken());
    // setTimeout tops out near 24.8 days; a session is hours, but be safe.
    const timer = at !== null ? setTimeout(check, Math.min(Math.max(at - Date.now(), 0) + 500, 2 ** 31 - 1)) : null;
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, [user, endSession]);

  const [pendingNav, setPendingNav] = useState<{ v: AppView; origin?: 'records' | 'survey'; date?: string; initialIsNest?: boolean } | null>(null);

  const performNavigate = (v: AppView, origin?: 'records' | 'survey', date?: string, initialIsNest?: boolean) => {
    if (v === AppView.NEST_ENTRY) {
      setNestEntryOrigin(origin || 'records');
      if (date) setSurveyDate(date);
      setNestEntryInitialIsNest(!!initialIsNest);
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
  const navigate = (v: AppView, origin?: 'records' | 'survey', date?: string, initialIsNest?: boolean) => {
    if (view === AppView.NEST_ENTRY || view === AppView.TAGGING_ENTRY) {
      setPendingNav({ v, origin, date, initialIsNest });
      return;
    }
    performNavigate(v, origin, date, initialIsNest);
  };

  // True for the one render that follows a Back/Forward press, so the sync
  // effect below knows the URL already matches this state and must not push
  // a new entry on top of it - that would turn one Back press into two.
  const fromPopStateRef = useRef(false);
  // The very first sync establishes the canonical URL for the page that was
  // already showing (from the server/deep link), not a navigation to a new
  // one - replacing it keeps that initial load a single history entry
  // instead of two, which would otherwise make Back bounce in place once
  // before it actually leaves the current screen.
  const hasSyncedOnceRef = useRef(false);

  // Keeps the URL in step with the current screen, so the browser actually
  // has history entries to go back through (QA-004) instead of the whole app
  // being one entry that Back exits straight out of. Skips the push when
  // nothing actually changed (the computed path already matches the bar) so
  // a route-driven re-render doesn't itself create an entry.
  useEffect(() => {
    if (fromPopStateRef.current) {
      fromPopStateRef.current = false;
      return;
    }
    if (!user && view !== AppView.LOGIN && view !== AppView.PUBLIC_STATS) return;
    const path = pathForRoute({
      view,
      nestId: selectedNestId ?? undefined,
      turtleId: selectedTurtleId ?? undefined,
      nestEntryOrigin,
      preferMySubmissionsAlias:
        view === AppView.REVIEW_QUEUE &&
        (user?.role === 'Field Volunteer' || user?.role === 'Field Assistant'),
    });
    if (path !== window.location.pathname + window.location.search) {
      if (hasSyncedOnceRef.current) {
        window.history.pushState(null, '', path);
      } else {
        window.history.replaceState(null, '', path);
      }
    }
    hasSyncedOnceRef.current = true;
  }, [view, selectedNestId, selectedTurtleId, nestEntryOrigin, user]);

  // Back/Forward moves the browser's history pointer on its own; this just
  // reads where it landed and brings the app's own state in line. Goes
  // straight to the screens rather than through navigate()'s unsaved-form
  // prompt - the same tradeoff the browser's own Back already makes on any
  // other site with an open form.
  useEffect(() => {
    const onPopState = () => {
      const parsed = routeForPath(window.location.pathname, window.location.search);
      const hasSession = !!user;
      const next = !parsed
        ? { view: hasSession ? AppView.DASHBOARD : AppView.LOGIN }
        : parsed.view === AppView.PUBLIC_STATS
          ? parsed
          : !hasSession
            ? { view: AppView.LOGIN }
            : parsed.view === AppView.LOGIN
              ? { view: AppView.DASHBOARD }
              : parsed;
      fromPopStateRef.current = true;
      setView(next.view);
      if ('nestId' in next) setSelectedNestId(next.nestId ?? null);
      if ('turtleId' in next) setSelectedTurtleId(next.turtleId ?? null);
      if ('nestEntryOrigin' in next && next.nestEntryOrigin) setNestEntryOrigin(next.nestEntryOrigin);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [user]);

  // Screens publish their own header buttons and title. What they publish is
  // stored tagged with the view that published it.
  //
  // The tag is what makes this reliable. React flushes a child's effects before
  // its parent's, so on arriving at a screen the incoming screen sets its
  // buttons and *then* the view-change effect below used to clear them - the
  // header came up empty, and the buttons only appeared if something later
  // happened to re-render App (which hands the screen a fresh inline `onBack`,
  // re-running its effect). Collapsing the sidebar is one such re-render, which
  // is why that appeared to fix it. Tagging means a publish from the screen
  // being left is ignored rather than having to be cleared in a race with the
  // one arriving.
  const [headerActionsSlot, setHeaderActionsSlot] = useState<{ view: AppView; node: React.ReactNode } | null>(null);
  const [headerTitleSlot, setHeaderTitleSlot] = useState<{ view: AppView; title: string } | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const setHeaderActions = useCallback(
    (node: React.ReactNode) => setHeaderActionsSlot(node == null ? null : { view, node }),
    [view]
  );
  const setHeaderTitle = useCallback(
    (title: string | null) => setHeaderTitleSlot(title == null ? null : { view, title }),
    [view]
  );

  const headerActions = headerActionsSlot?.view === view ? headerActionsSlot.node : null;
  const headerTitle = headerTitleSlot?.view === view ? headerTitleSlot.title : null;

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
    // Header actions and title are not cleared here: the view tag on each slot
    // already retires whatever the previous screen published.
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

  // Stable identities. Screens that publish header actions list onBack in the
  // dependencies of the effect that publishes them, so an inline arrow here
  // re-ran that effect on every single App render - harmless churn most of the
  // time, and the accident that used to paper over the clearing bug above.
  const backToNestRecords = useCallback(() => setView(AppView.NEST_RECORDS), []);
  const backToNestDetails = useCallback(() => setView(AppView.NEST_DETAILS), []);
  const backToTurtleRecords = useCallback(() => setView(AppView.TURTLE_RECORDS), []);
  const backFromNestEntry = useCallback(
    () => setView(nestEntryOrigin === 'records' ? AppView.NEST_RECORDS : AppView.MORNING_SURVEY),
    [nestEntryOrigin]
  );
  const saveNestEntry = useCallback((data: any) => {
    setNewNest(data);
    setView(AppView.MORNING_SURVEY);
  }, []);

  if (view === AppView.PUBLIC_STATS) {
    return <PublicStats onBack={() => setView(AppView.LOGIN)} />;
  }

  if (view === AppView.LOGIN) {
    return <Login onLogin={handleLogin} onViewPublicStats={() => setView(AppView.PUBLIC_STATS)} notice={sessionNotice} />;
  }

  // sidebar-open drives --content-left (see src/index.css), which the entry
  // forms' fixed bottom bars position themselves from so they don't slide under
  // the navigation panel.
  return (
    <div className={`flex h-screen overflow-hidden ${isSidebarOpen ? 'sidebar-open' : ''} ${theme === 'dark' ? 'bg-background-dark text-slate-100' : 'bg-background-light text-slate-900'} font-sans relative`}>
      <Sidebar 
        currentView={view} 
        onNavigate={navigate} 
        user={user!} 
        onLogout={handleLogout} 
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        theme={theme}
        onToggleTheme={toggleTheme}
        pendingReviewCount={pendingReviewCount}
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
                if (pendingNav) performNavigate(pendingNav.v, pendingNav.origin, pendingNav.date, pendingNav.initialIsNest);
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
          {/* Three columns in the flow, not a title absolutely centred under the
              action group: screens that publish wide header actions (Nest
              Inventory's egg tallies plus Cancel/Save) drew their pills straight
              over the page title. The title now takes the space that's left and
              truncates into it. */}
          <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center gap-3">
            {/* Only one sidebar control is on screen at a time: this opens it
                while it's closed, and the panel's own collapse button closes it
                while it's open. */}
            <div className="flex items-center gap-4 shrink-0">
              {!isSidebarOpen && (
                <button
                  onClick={toggleSidebar}
                  title="Open navigation"
                  aria-label="Open navigation"
                  className={`relative before:absolute before:-inset-0.5 before:content-[''] size-10 rounded-lg flex items-center justify-center transition-all ${theme === 'dark' ? 'text-primary hover:bg-white/5' : 'text-primary hover:bg-slate-100'}`}
                >
                  <Menu className="size-5" />
                </button>
              )}
            </div>

            {/* A screen publishing header actions fills a phone-width bar on its
                own, leaving the title as a one-letter stub. Its own content
                names the screen, so drop it there rather than truncate it. */}
            <h1 className={`flex-1 min-w-0 text-center text-base sm:text-lg font-black tracking-tighter uppercase leading-none text-slate-900 dark:text-white truncate ${
              headerActions ? 'hidden sm:block' : ''
            }`}>
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
                  {view === AppView.REVIEW_QUEUE && (user?.role === 'Field Volunteer' || user?.role === 'Field Assistant' ? 'My Submissions' : 'Review Queue')}
                  {view === AppView.SEASON_REPORT && 'Season Report'}
                  {view === AppView.PROJECT_SETTINGS && 'Project Settings'}
                </>
              )}
            </h1>

            <div className="flex items-center gap-2 sm:gap-4 justify-end shrink-0">
              {/* Say why the survey came back pre-filled, rather than leaving
                  the researcher to wonder whether it's stale data. */}
              {restoredDraft && !draftNoticeDismissed && hasUnsavedSurveyWork && (
                <button
                  onClick={() => setDraftNoticeDismissed(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
                  title={`Unsubmitted survey work from ${new Date(restoredDraft.savedAt).toLocaleString()} was restored. It still needs submitting. Click to dismiss.`}
                >
                  <RotateCcw className="size-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Draft Restored</span>
                </button>
              )}
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
              {/* Anyone signed in can have something to act on, so the bell is not
                  gated by role - the server decides what each person sees. */}
              {user && <AlertsBell refreshKey={`${view}:${alertsVersion}`} onOpenReviews={() => navigate(AppView.REVIEW_QUEUE)} onOpenSettings={() => navigate(AppView.PROJECT_SETTINGS)} onOpenNests={() => navigate(AppView.NEST_RECORDS)} />}
            </div>
          </div>
        </header>

        {view === AppView.DASHBOARD && <Dashboard onNavigate={navigate} theme={theme} user={user} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.NEST_RECORDS && <Records type="nest" onNavigate={navigate} onSelectNest={handleViewNest} onInventoryNest={handleInventoryNest} theme={theme} user={user!} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.TURTLE_RECORDS && <Records type="turtle" onNavigate={navigate} onSelectTurtle={handleViewTurtle} theme={theme} user={user!} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.NEST_ENTRY && (
          <NestEntry 
            onBack={backFromNestEntry}
            onSave={saveNestEntry}
            theme={theme} 
            beaches={beaches} 
            initialBeach={currentBeach}
            initialDate={surveyDate}
            origin={nestEntryOrigin}
            initialIsNest={nestEntryInitialIsNest}
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
            onBack={backToNestRecords}
            onInventory={handleInventoryNest}
            user={user!} 
            isSidebarOpen={isSidebarOpen} 
            onToggleSidebar={toggleSidebar} 
            setHeaderActions={setHeaderActions}
            setHeaderTitle={setHeaderTitle}
          />
        )}
        {view === AppView.NEST_INVENTORY && <NestInventory id={selectedNestId || ''} onBack={backToNestDetails} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} setHeaderActions={setHeaderActions} />}
        {view === AppView.MAP_VIEW && <NestMap onNavigate={navigate} onSelectNest={handleViewNest} theme={theme} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.TAGGING_ENTRY && <TaggingEntry onBack={backToTurtleRecords} theme={theme} beaches={beaches} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
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
        {view === AppView.TURTLE_DETAILS && <TurtleDetails id={selectedTurtleId || ''} onBack={backToTurtleRecords} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} user={user} />}
        {view === AppView.SETTINGS && <Settings user={user!} onLogout={handleLogout} onUpdateUser={(updates) => setUser(prev => prev ? { ...prev, ...updates } : null)} theme={theme} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.TIME_TABLE && <TimeTable user={user!} theme={theme} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.USER_MANAGEMENT && <UserManagement user={user!} theme={theme} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />}
        {view === AppView.REVIEW_QUEUE && <ReviewQueue user={user!} theme={theme} onQueueChange={refreshPendingReviews} onOpenNest={handleViewNest} />}
        {view === AppView.SEASON_REPORT && (
          // Imported nests land in the same lists everything else does, so the
          // cached copies this screen's siblings read have to be refreshed.
          <SeasonReport theme={theme} user={user!} onImported={refreshBeaches} />
        )}
        {view === AppView.PROJECT_SETTINGS && (
          <ProjectSettings user={user!} theme={theme} onSettingsChanged={refreshPendingReviews} onBeachesChanged={refreshBeaches} />
        )}
      </main>
    </div>
  );
};

export default App;
