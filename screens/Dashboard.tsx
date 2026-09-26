
import React, { useEffect, useState } from 'react';
import { AppView, User } from '../types';
import { DatabaseConnection } from '../services/Database';
import { saveCache, loadCache } from '../lib/offlineCache';
import { currentSeason, seasonOf, seasonLabel, type SeasonDef } from '../lib/seasonReport';
import { isConcerning } from '../lib/lists';
import type { ListSettings } from '../types';
import { isOpenNest, nestAttention, incubationDays, isHatchedNest } from '../lib/nestLifecycle';
import { timeAgo } from '../lib/timeAgo';
import { surveyAreaTaskLabel } from '../lib/surveyAreas';
import { formatDateTime } from '../lib/utils';
import { 
  TrendingUp, 
  Search, 
  Egg, 
  MapPin, 
  ShieldCheck, 
  Activity, 
  Zap, 
  Map, 
  Calendar, 
  UserCog, 
  History, 
  Inbox, 
  PawPrint, 
  Clock,
  Menu,
  Home,
  AlertCircle,
  ClipboardCheck,
  Hourglass,
  ChevronRight
} from 'lucide-react';
import { PageTitle, SectionHeading, BodyText, HelperText } from '../components/ui/Typography';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface StatCardProps {
  icon: string | React.ReactNode;
  label: string;
  value: string | number;
  trend: string;
  colorClass: string;
  progressWidth: string;
  loading?: boolean;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, trend, colorClass, progressWidth, loading, onClick }) => {
  const isDark = colorClass.includes('dark');
  
  const getProgressColor = () => {
    if (colorClass.includes('blue')) return 'bg-blue-500';
    if (colorClass.includes('teal')) return 'bg-teal-500';
    if (colorClass.includes('amber')) return 'bg-amber-500';
    if (colorClass.includes('orange')) return 'bg-orange-500';
    if (colorClass.includes('purple')) return 'bg-purple-500';
    if (colorClass.includes('rose')) return 'bg-rose-500';
    return 'bg-primary';
  };

  return (
    <Card 
      onClick={onClick}
      className={`p-4 group cursor-pointer transition-all ${isDark ? 'hover:border-primary/40' : 'hover:border-primary/30'}`}
    >
      <div className="flex justify-between items-start mb-2">
        {typeof icon === 'string' ? (
          <div className={`p-1.5 rounded-lg ${colorClass}`}>
            {icon === 'egg' && <Egg className="size-5" />}
            {icon === 'move_location' && <MapPin className="size-5" />}
            {icon === 'pest_control' && <ShieldCheck className="size-5" />}
            {icon === 'medical_services' && <Activity className="size-5" />}
          </div>
        ) : (
          <div className={`p-1.5 rounded-lg ${colorClass}`}>{icon}</div>
        )}
        <span className="text-[10px] font-bold text-green-500 flex items-center gap-1 bg-green-500/10 px-1.5 py-0.5 rounded-full">
          <TrendingUp className="size-2.5" /> {trend}
        </span>
      </div>
      {/* The label reserves two lines' height whether or not it wraps. At phone
          width "Turtle Records" wraps while "Active Nests" doesn't, which pushed
          the figures in adjacent cards onto different baselines. */}
      <div>
          <HelperText className="font-bold uppercase tracking-widest leading-tight mb-1 block min-h-[2.5em]">{label}</HelperText>
          {loading ? (
              <div className={`h-7 w-20 rounded animate-pulse my-0.5 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
          ) : (
              <h3 className={`text-2xl font-black leading-tight tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</h3>
          )}
      </div>
      <div className={`mt-3 w-full h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
        <div className={`h-full transition-all duration-1000 ${getProgressColor()}`} style={{ width: progressWidth }}></div>
      </div>
    </Card>
  );
};

const Dashboard: React.FC<{ 
  onNavigate: (v: AppView) => void; 
  theme: 'light' | 'dark'; 
  user: User | null;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}> = ({ onNavigate, theme, user, isSidebarOpen, onToggleSidebar }) => {
  const [stats, setStats] = useState({
    season: null as string | null,
    seasonNests: 0,
    openNests: 0,
    hatchingCount: 0,
    turtleCount: 0,
    eggCount: 0,
    relocatedCount: 0,
    injuredCount: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  // What wants a coordinator's attention today, as opposed to what happened
  // lately. Filled from the same loads as everything else.
  const [attention, setAttention] = useState<{
    // undefined = still loading; null = tried and could not.
    pendingReviews: number | null | undefined;
    dueNests: string[];
    overdueNests: string[];
    shiftsToday: { task: string; names: string[] }[] | null | undefined;
  }>({ pendingReviews: undefined, dueNests: [], overdueNests: [], shiftsToday: undefined });
  const [isLoading, setIsLoading] = useState(true);
  // Set when the figures on screen came from the offline cache, so the tiles
  // aren't mistaken for live counts.
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  // Set when nothing could be loaded at all and there was no cache to fall back
  // on - zeros on the tiles would read as real figures.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const isReviewer = user?.role === 'Field Leader' || !!user?.role?.includes('Coordinator');

  useEffect(() => {
    const applyData = (
      nestsData: any[],
      turtlesData: any[],
      emergencesData: any[],
      reviewsData: any[] | null,
      seasonCfg: { seasons: SeasonDef[]; current: string | null } = { seasons: [], current: null },
      lists: ListSettings = DatabaseConnection.defaultSettings().lists
    ) => {
      // Scoped to one season, the same one the Season Report uses, so the two
      // never quote different totals. "Active" is a nest still being watched -
      // not archived and not yet hatched - which a hatched-but-unarchived nest
      // is not.
      const season = currentSeason(nestsData, new Date(), seasonCfg.seasons, seasonCfg.current);
      const seasonNests = nestsData.filter((n: any) => seasonOf(n, seasonCfg.seasons) === season);
      const open = seasonNests.filter((n: any) => isOpenNest(n));

      const injured = turtlesData.filter((t: any) => isConcerning(lists, t.health_condition)).length;

      setStats({
        season: season === null ? null : seasonLabel(season, seasonCfg.seasons),
        seasonNests: seasonNests.length,
        openNests: open.length,
        hatchingCount: open.filter((n: any) => String(n.status || '').toLowerCase() === 'hatching').length,
        turtleCount: turtlesData.length,
        eggCount: seasonNests.reduce((acc: number, nest: any) => acc + (Number(nest.total_num_eggs) || 0), 0),
        relocatedCount: seasonNests.filter((n: any) => n.relocated).length,
        injuredCount: injured
      });

      // Nests that want a visit. Any season: a nest left open from a past year is
      // exactly the sort of thing this panel is for.
      const codes = (list: any[]) => list.map((n: any) => n.nest_code);
      const due = nestsData.filter((n: any) => nestAttention(n) === 'due');
      const overdue = nestsData.filter((n: any) => nestAttention(n) === 'overdue');
      setAttention(prev => ({
        ...prev,
        pendingReviews: reviewsData ? reviewsData.length : null,
        dueNests: codes(due),
        overdueNests: codes(overdue)
      }));

      // Every kind of record, newest first, by when it was ENTERED - not the
      // date it describes. A nest laid a month ago and logged this morning is
      // this morning's activity.
      const stamp = (v: any) => (v ? new Date(v) : null);
      const feed: any[] = [];
      nestsData.forEach((n: any) => {
        const at = stamp(n.created_at || n.date_found);
        if (at) feed.push({ type: 'NEST', title: `Nest ${n.nest_code} recorded`, subtitle: n.beach || 'Unknown beach', date: at });
      });
      emergencesData.forEach((e: any) => {
        const at = stamp(e.created_at || e.event_date);
        if (!at) return;
        feed.push({
          type: 'EMERGENCE',
          title: `${e.emergence_type === 'Nesting' ? 'Nesting emergence' : 'Emergence'} logged${e.nest_code ? ` (${e.nest_code})` : ''}`,
          subtitle: e.beach || 'Unknown beach',
          date: at
        });
      });
      turtlesData.forEach((t: any) => {
        const at = stamp(t.created_at);
        if (at) feed.push({ type: 'TURTLE', title: `Turtle ${t.name || t.id} identified`, subtitle: t.species, date: at });
      });
      (reviewsData || []).forEach((r: any) => {
        const at = stamp(r.submitted_at);
        if (at) feed.push({
          type: 'REVIEW',
          title: `${r.record_kind}${r.record_label ? ` ${r.record_label}` : ''} submitted for review`,
          subtitle: [r.submitted_by_first_name, r.submitted_by_last_name].filter(Boolean).join(' ') || 'Field team',
          date: at
        });
      });

      setRecentActivity(feed.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6));
    };

    const loadShiftsToday = async () => {
      try {
        const now = new Date();
        const day = now.getDay();
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1));
        const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const week = await DatabaseConnection.getWeeklyTimetable(ymd(monday), { strict: true });
        const today = ymd(now);
        // A plain object, not a Map: this file imports lucide's `Map` icon, which
        // shadows the global constructor.
        const byTask: Record<string, string[]> = {};
        week
          .filter((a: any) => String(a.work_date).split('T')[0] === today)
          .forEach((a: any) => {
            (byTask[a.shift_name] ||= []).push(`${a.first_name} ${a.last_name}`.trim());
          });
        setAttention(prev => ({
          ...prev,
          shiftsToday: Object.entries(byTask).map(([task, names]) => ({ task, names }))
        }));
      } catch (err) {
        console.error("Dashboard: could not load today's shifts", err);
        // null, not empty: the panel says it could not check, rather than "no shifts".
        setAttention(prev => ({ ...prev, shiftsToday: null }));
      }
    };

    const loadDashboardData = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [nestsData, turtlesData, emergencesData, reviewsData, settings] = await Promise.all([
          DatabaseConnection.getNests(),
          DatabaseConnection.getTurtles(),
          DatabaseConnection.getEmergences().catch(() => [] as any[]),
          isReviewer ? DatabaseConnection.getReviews('pending') : Promise.resolve(null),
          DatabaseConnection.getSettings()
        ]);
        applyData(nestsData, turtlesData, emergencesData, reviewsData, settings.seasons, settings.lists);
        setCachedAt(null);
        saveCache('nests_raw', nestsData);
        saveCache('turtles_raw', turtlesData);
        saveCache('emergences', emergencesData);
        loadShiftsToday();
      } catch (error) {
        console.error("Dashboard data load failed", error);
        // Offline: show the last-known figures, clearly labelled as stale,
        // rather than a wall of zeroes that reads like real data.
        const cachedNests = loadCache<any[]>('nests_raw');
        const cachedTurtles = loadCache<any[]>('turtles_raw');
        if (cachedNests || cachedTurtles) {
          applyData(cachedNests?.data || [], cachedTurtles?.data || [], loadCache<any[]>('emergences')?.data || [], null);
          setCachedAt(cachedNests?.cachedAt || cachedTurtles!.cachedAt);
        } else {
          setLoadError('The dashboard could not be loaded. Check your connection and try again.');
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboardData();
  }, [reloadKey, isReviewer]);

  const isAdmin = user?.role === 'Field Leader' || user?.role?.includes('Coordinator');

  return (
    <div className={`flex flex-col min-h-full ${theme === 'dark' ? 'bg-background-dark' : 'bg-background-light'}`}>
      <div className="p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {cachedAt && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 text-xs font-bold">
            <AlertCircle className="size-4 shrink-0" />
            <span>Offline — these figures are from {formatDateTime(cachedAt)}, not live.</span>
          </div>
        )}

        {loadError && (
          <div role="alert" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold">
            <AlertCircle className="size-4 shrink-0" />
            <span className="flex-1">{loadError}</span>
            <button onClick={() => setReloadKey(k => k + 1)} className="underline shrink-0">Try again</button>
          </div>
        )}

        {/* Statistics Grid. Season-scoped, and labelled as such, so these agree
            with the Season Report rather than counting every year on record. */}
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard 
            icon={<img src="https://img.icons8.com/fluency/96/beach.png" className="size-5 object-contain" alt="" />}
            label={`Nests ${stats.season ?? ''}`.trim()} 
            value={loadError ? '—' : stats.seasonNests} 
            loading={isLoading}
            trend="Season" 
            colorClass={theme === 'dark' ? 'bg-blue-500/10 text-blue-400 dark' : 'bg-blue-100 text-blue-600'} 
            progressWidth="75%"
            onClick={() => onNavigate(AppView.NEST_RECORDS)}
          />
          <StatCard 
            icon="pest_control" 
            label="Active Nests" 
            value={loadError ? '—' : stats.openNests} 
            loading={isLoading}
            trend={`${stats.hatchingCount} hatching`}
            colorClass={theme === 'dark' ? 'bg-purple-500/10 text-purple-400 dark' : 'bg-purple-100 text-purple-600'} 
            progressWidth={`${stats.seasonNests ? (stats.openNests/stats.seasonNests)*100 : 0}%`} 
            onClick={() => onNavigate(AppView.NEST_RECORDS)}
          />
          <StatCard 
            icon="egg" 
            label={`Total Eggs ${stats.season ?? ''}`.trim()} 
            value={loadError ? '—' : stats.eggCount.toLocaleString()} 
            loading={isLoading}
            trend="Season" 
            colorClass={theme === 'dark' ? 'bg-amber-500/10 text-amber-400 dark' : 'bg-amber-100 text-amber-600'} 
            progressWidth="85%" 
          />
          <StatCard 
            icon="move_location" 
            label="Relocated" 
            value={loadError ? '—' : stats.relocatedCount} 
            loading={isLoading}
            trend="Protection" 
            colorClass={theme === 'dark' ? 'bg-orange-500/10 text-orange-400 dark' : 'bg-orange-100 text-orange-600'} 
            progressWidth={`${stats.seasonNests ? (stats.relocatedCount/stats.seasonNests)*100 : 0}%`} 
          />
          <StatCard 
            icon={<img src="https://img.icons8.com/fluency/96/turtle.png" className="size-5 object-contain" alt="" />}
            label="Turtle Records" 
            value={loadError ? '—' : stats.turtleCount} 
            loading={isLoading}
            trend="All time" 
            colorClass={theme === 'dark' ? 'bg-teal-500/10 text-teal-400 dark' : 'bg-teal-100 text-teal-600'} 
            progressWidth="50%"
            onClick={() => onNavigate(AppView.TURTLE_RECORDS)}
          />
           <StatCard 
            icon="medical_services" 
            label="Injured" 
            value={loadError ? '—' : stats.injuredCount} 
            loading={isLoading}
            trend="Medical" 
            colorClass={theme === 'dark' ? 'bg-rose-500/10 text-rose-400 dark' : 'bg-rose-100 text-rose-600'} 
            progressWidth={`${stats.turtleCount ? (stats.injuredCount/stats.turtleCount)*100 : 0}%`} 
          />
        </section>

        {/* Needs attention: what to act on today. Placed above the quick actions
            because it is the answer to "what should I do first?". */}
        <section className="space-y-4">
          <SectionHeading className="flex items-center gap-2">
            <AlertCircle className="size-5 text-rose-500" />
            Needs Attention
          </SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isReviewer && (
              <Card
                onClick={() => onNavigate(AppView.REVIEW_QUEUE)}
                className="p-4 cursor-pointer hover:border-primary/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary"><ClipboardCheck className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Reviews waiting</p>
                    <p className="text-xs text-slate-500">
                      {attention.pendingReviews === undefined ? 'Checking…'
                        : attention.pendingReviews === null ? 'Could not check'
                        : attention.pendingReviews === 0 ? 'Nothing to review'
                        : `${attention.pendingReviews} record${attention.pendingReviews === 1 ? '' : 's'} to approve`}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-slate-400" />
                </div>
              </Card>
            )}
            <Card
              onClick={() => onNavigate(AppView.NEST_RECORDS)}
              className="p-4 cursor-pointer hover:border-primary/40 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${attention.overdueNests.length ? 'bg-rose-500/10 text-rose-500' : 'bg-purple-500/10 text-purple-500'}`}><Hourglass className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Nests to check</p>
                  {attention.overdueNests.length === 0 && attention.dueNests.length === 0 ? (
                    <p className="text-xs text-slate-500">None due or overdue</p>
                  ) : (
                    <>
                      {attention.overdueNests.length > 0 && (
                        <p className="text-xs text-rose-500 font-bold truncate" title={attention.overdueNests.join(', ')}>
                          {attention.overdueNests.length} overdue – excavate: {attention.overdueNests.slice(0, 3).join(', ')}{attention.overdueNests.length > 3 ? '…' : ''}
                        </p>
                      )}
                      {attention.dueNests.length > 0 && (
                        <p className="text-xs text-amber-500 font-bold truncate" title={attention.dueNests.join(', ')}>
                          {attention.dueNests.length} due to hatch: {attention.dueNests.slice(0, 3).join(', ')}{attention.dueNests.length > 3 ? '…' : ''}
                        </p>
                      )}
                    </>
                  )}
                </div>
                <ChevronRight className="size-4 text-slate-400 mt-1" />
              </div>
            </Card>
            <Card
              onClick={() => onNavigate(AppView.TIME_TABLE)}
              className="p-4 cursor-pointer hover:border-primary/40 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500"><Calendar className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Today's shifts</p>
                  {attention.shiftsToday === undefined ? (
                    <p className="text-xs text-slate-500">Checking…</p>
                  ) : attention.shiftsToday === null ? (
                    <p className="text-xs text-slate-500">Could not check</p>
                  ) : attention.shiftsToday.length === 0 ? (
                    <p className="text-xs text-slate-500">No shifts rostered today</p>
                  ) : (
                    attention.shiftsToday.slice(0, 3).map(sh => (
                      <p key={sh.task} className="text-xs text-slate-500 truncate">
                        <span className="font-bold">{surveyAreaTaskLabel(sh.task, loadCache<{ name: string; survey_area: string }[]>('beaches')?.data ?? [])}</span> · {sh.names.length} rostered
                      </p>
                    ))
                  )}
                </div>
                <ChevronRight className="size-4 text-slate-400 mt-1" />
              </div>
            </Card>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Action Column */}
          <section className="space-y-6">
            <SectionHeading className="flex items-center gap-2">
                <Zap className="size-5 text-primary" />
                Quick Actions
            </SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {user?.role !== 'Field Volunteer' && (
                <>
                  <Card 
                    onClick={() => onNavigate(AppView.NEST_ENTRY)}
                    className={`p-5 border-2 transition-all group shadow-lg ${
                      theme === 'dark'
                        ? 'bg-primary/5 border-primary/20 hover:bg-primary/20 hover:border-primary/60'
                        : 'bg-primary/10 border-primary/30 hover:bg-primary hover:border-primary'
                    }`}
                  >
                    <div className="flex flex-col gap-3">
                      <div className={`p-3 rounded-xl transition-colors w-fit flex items-center justify-center ${
                        theme === 'dark' ? 'bg-primary/20 text-primary group-hover:bg-primary group-hover:text-white' : 'bg-primary text-white group-hover:bg-white group-hover:text-primary'
                      }`}>
                        <img src="https://img.icons8.com/fluency/96/beach.png" className={`size-6 object-contain transition-all ${
                          theme === 'dark' ? 'brightness-100 group-hover:brightness-0 group-hover:invert' : 'brightness-0 invert group-hover:brightness-100 group-hover:invert-0'
                        }`} alt="" />
                      </div>
                      <div className={`${theme === 'dark' ? 'text-slate-200 group-hover:text-white' : 'text-slate-900 group-hover:text-white'}`}>
                        <h5 className="font-bold text-sm">Record a Nest or Emergence</h5>
                        <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-slate-400 group-hover:text-white/80' : 'text-slate-500 group-hover:text-white/80'}`}>Log a nest or a false crawl</p>
                      </div>
                    </div>
                  </Card>

                  <Card 
                    onClick={() => onNavigate(AppView.TAGGING_ENTRY)}
                    className={`p-5 border-2 transition-all group shadow-lg ${
                      theme === 'dark'
                        ? 'bg-teal-500/5 border-teal-500/20 hover:bg-teal-500/20 hover:border-teal-500/60'
                        : 'bg-teal-500/10 border-teal-500/30 hover:bg-teal-500 hover:border-teal-500'
                    }`}
                  >
                    <div className="flex flex-col gap-3">
                      <div className={`p-3 rounded-xl transition-colors w-fit flex items-center justify-center ${
                        theme === 'dark' ? 'bg-teal-500/20 text-teal-500 group-hover:bg-teal-500 group-hover:text-white' : 'bg-teal-500 text-white group-hover:bg-white group-hover:text-teal-500'
                      }`}>
                        <img src="https://img.icons8.com/fluency/96/turtle.png" className={`size-6 object-contain transition-all ${
                          theme === 'dark' ? 'brightness-100 group-hover:brightness-0 group-hover:invert' : 'brightness-0 invert group-hover:brightness-100 group-hover:invert-0'
                        }`} alt="" />
                      </div>
                      <div className={`${theme === 'dark' ? 'text-slate-200 group-hover:text-white' : 'text-slate-900 group-hover:text-white'}`}>
                        <h5 className="font-bold text-sm">Tag a Turtle</h5>
                        <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-slate-400 group-hover:text-white/80' : 'text-slate-500 group-hover:text-white/80'}`}>Record a tagged animal</p>
                      </div>
                    </div>
                  </Card>
                </>
              )}

              <Card 
                onClick={() => onNavigate(AppView.MAP_VIEW)}
                className={`p-5 border-2 transition-all group shadow-lg ${
                  theme === 'dark'
                    ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/60'
                    : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500 hover:border-emerald-500'
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className={`p-3 rounded-xl transition-colors w-fit flex items-center justify-center ${
                    theme === 'dark' ? 'bg-emerald-500/20 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white' : 'bg-emerald-500 text-white group-hover:bg-white group-hover:text-emerald-500'
                  }`}>
                    <Map className="size-6" />
                  </div>
                  <div className={`${theme === 'dark' ? 'text-slate-200 group-hover:text-white' : 'text-slate-900 group-hover:text-white'}`}>
                    <h5 className="font-bold text-sm">Nest Map</h5>
                    <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-slate-400 group-hover:text-white/80' : 'text-slate-500 group-hover:text-white/80'}`}>Visualise locations</p>
                  </div>
                </div>
              </Card>

              <Card 
                onClick={() => onNavigate(AppView.TIME_TABLE)}
                className={`p-5 border-2 transition-all group shadow-lg ${
                  theme === 'dark'
                    ? 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/60'
                    : 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500 hover:border-amber-500'
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className={`p-3 rounded-xl transition-colors w-fit flex items-center justify-center ${
                    theme === 'dark' ? 'bg-amber-500/20 text-amber-500 group-hover:bg-amber-500 group-hover:text-white' : 'bg-amber-500 text-white group-hover:bg-white group-hover:text-amber-500'
                  }`}>
                    <Calendar className="size-6" />
                  </div>
                  <div className={`${theme === 'dark' ? 'text-slate-200 group-hover:text-white' : 'text-slate-900 group-hover:text-white'}`}>
                    <h5 className="font-bold text-sm">Time Table</h5>
                    <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-slate-400 group-hover:text-white/80' : 'text-slate-500 group-hover:text-white/80'}`}>Check shifts</p>
                  </div>
                </div>
              </Card>

              {isAdmin && (
                <Card 
                  onClick={() => onNavigate(AppView.USER_MANAGEMENT)}
                  className={`p-5 border-2 transition-all group shadow-lg col-span-1 sm:col-span-2 ${
                    theme === 'dark'
                      ? 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/60'
                      : 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500 hover:border-rose-500'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl transition-colors w-fit flex items-center justify-center ${
                      theme === 'dark' ? 'bg-rose-500/20 text-rose-500 group-hover:bg-rose-500 group-hover:text-white' : 'bg-rose-500 text-white group-hover:bg-white group-hover:text-rose-500'
                    }`}>
                      <UserCog className="size-6" />
                    </div>
                    <div className={`${theme === 'dark' ? 'text-slate-200 group-hover:text-white' : 'text-slate-900 group-hover:text-white'}`}>
                      <h5 className="font-bold text-sm">User Management</h5>
                      <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-slate-400 group-hover:text-white/80' : 'text-slate-500 group-hover:text-white/80'}`}>Manage team access and roles</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </section>

          {/* Activity Column */}
          <section className="space-y-6">
            <SectionHeading className="flex items-center gap-2">
                <History className="size-5 text-amber-500" />
                Recent Activity
            </SectionHeading>
            <Card className="p-6 min-h-[300px]">
              {isLoading ? (
                  <div className="space-y-4">
                      {[1, 2, 3].map(i => (
                          <div key={i} className="flex gap-4 animate-pulse">
                              <div className="size-8 rounded-full bg-slate-700"></div>
                              <div className="space-y-2 flex-1">
                                  <div className="h-3 bg-slate-700 rounded w-3/4"></div>
                                  <div className="h-2 bg-slate-700 rounded w-1/2"></div>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : recentActivity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2 opacity-60">
                      <Inbox className="size-10" />
                      <p className="text-xs font-bold uppercase tracking-widest">No recent activity found</p>
                  </div>
              ) : (
                <div className="space-y-6">
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} className="flex gap-4 group">
                      <div className={`mt-1 flex items-center justify-center size-8 rounded-full shrink-0 ring-4 ring-background-dark ${
                        activity.type === 'NEST' ? 'bg-blue-500/20 text-blue-500'
                        : activity.type === 'EMERGENCE' ? 'bg-emerald-500/20 text-emerald-500'
                        : activity.type === 'REVIEW' ? 'bg-amber-500/20 text-amber-500'
                        : 'bg-teal-500/20 text-teal-500'}`}>
                        {activity.type === 'NEST' ? <Egg className="size-4" />
                          : activity.type === 'EMERGENCE' ? <MapPin className="size-4" />
                          : activity.type === 'REVIEW' ? <ClipboardCheck className="size-4" />
                          : <PawPrint className="size-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{activity.title}</p>
                        <p className={`text-xs truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{activity.subtitle}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                                <Clock className="size-2.5" /> {timeAgo(activity.date)}
                            </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
