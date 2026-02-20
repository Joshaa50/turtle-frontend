
import React, { useEffect, useState } from 'react';
import { AppView } from '../types';
import { DatabaseConnection } from '../services/Database';

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
  // Determine progress bar color based on the colorClass prop
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
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-[#1a232e] p-4 rounded-xl border border-slate-200 dark:border-[#283039] shadow-sm group hover:border-primary/30 transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-95' : ''}`}
    >
      <div className="flex justify-between items-start mb-2">
        {typeof icon === 'string' ? (
          <span className={`p-1.5 rounded-lg material-symbols-outlined text-lg ${colorClass}`}>{icon}</span>
        ) : (
          <div className={`p-1.5 rounded-lg ${colorClass}`}>{icon}</div>
        )}
        <span className="text-[10px] font-bold text-green-500 flex items-center gap-1 bg-green-500/10 px-1.5 py-0.5 rounded-full">
          <span className="material-symbols-outlined text-[10px]">trending_up</span> {trend}
        </span>
      </div>
      <div>
          <p className="text-slate-500 dark:text-slate-400 text-[9px] font-bold uppercase tracking-widest leading-none mb-1">{label}</p>
          {loading ? (
              <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse my-0.5"></div>
          ) : (
              <h3 className="text-2xl font-black text-white leading-tight">{value}</h3>
          )}
      </div>
      <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-1000 ${getProgressColor()}`} style={{ width: progressWidth }}></div>
      </div>
    </div>
  );
};

const Dashboard: React.FC<{ onNavigate: (v: AppView) => void }> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    nestCount: 0,
    turtleCount: 0,
    eggCount: 0,
    relocatedCount: 0,
    hatchingCount: 0,
    injuredCount: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
        try {
            const [nestsData, turtlesData] = await Promise.all([
                DatabaseConnection.getNests(),
                DatabaseConnection.getTurtles()
            ]);

            // Calculate Stats
            const totalEggs = nestsData.reduce((acc: number, nest: any) => acc + (nest.total_num_eggs || 0), 0);
            const relocated = nestsData.filter((n: any) => n.relocated).length;
            const hatching = nestsData.filter((n: any) => n.status?.toLowerCase() === 'hatching').length;
            const injured = turtlesData.filter((t: any) => t.health_condition === 'Injured' || t.health_condition === 'Sick' || t.health_condition === 'Critical').length;
            
            setStats({
                nestCount: nestsData.length,
                turtleCount: turtlesData.length,
                eggCount: totalEggs,
                relocatedCount: relocated,
                hatchingCount: hatching,
                injuredCount: injured
            });

            // Process Recent Activity (Combine Nests and Turtles)
            const recentNests = nestsData.map((n: any) => ({
                type: 'NEST',
                title: `Nest ${n.nest_code} recorded`,
                subtitle: n.beach || 'Unknown Beach',
                date: new Date(n.date_found),
                id: n.id,
                user: 'Field Team'
            }));
            
            const recentTurtles = turtlesData.map((t: any) => ({
                type: 'TURTLE',
                title: `Turtle ${t.name || t.id} identified`,
                subtitle: t.species,
                // Fallback to current date if created_at is missing from lightweight turtle object
                date: t.created_at ? new Date(t.created_at) : new Date(), 
                id: t.id,
                user: 'Research Unit'
            }));

            const combined = [...recentNests, ...recentTurtles]
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .slice(0, 5);

            setRecentActivity(combined);

        } catch (error) {
            console.error("Dashboard data load failed", error);
        } finally {
            setIsLoading(false);
        }
    }
    loadDashboardData();
  }, []);

  // Time ago formatter
  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return "Just now";
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-[#283039] pl-16 pr-8 lg:pl-8 py-4 flex items-center justify-between transition-all">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white">Dashboard</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-[#283039] border-none rounded-lg text-sm focus:ring-1 focus:ring-primary w-64 text-white" placeholder="Search data..." type="text" />
          </div>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Statistics Grid */}
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard 
            icon={<img src="https://img.icons8.com/fluency/96/beach.png" className="size-5 object-contain" alt="" />}
            label="Active Nests" 
            value={stats.nestCount} 
            loading={isLoading}
            trend="Live" 
            colorClass="bg-blue-100 dark:bg-blue-900/30 text-blue-600" 
            progressWidth="75%"
            onClick={() => onNavigate(AppView.NEST_RECORDS)}
          />
          <StatCard 
            icon={<img src="https://img.icons8.com/fluency/96/turtle.png" className="size-5 object-contain" alt="" />}
            label="Turtle Records" 
            value={stats.turtleCount} 
            loading={isLoading}
            trend="Live" 
            colorClass="bg-teal-100 dark:bg-teal-900/30 text-teal-600" 
            progressWidth="50%"
            onClick={() => onNavigate(AppView.TURTLE_RECORDS)}
          />
          <StatCard 
            icon="egg" 
            label="Total Eggs" 
            value={stats.eggCount.toLocaleString()} 
            loading={isLoading}
            trend="Season" 
            colorClass="bg-amber-100 dark:bg-amber-900/30 text-amber-600" 
            progressWidth="85%" 
          />
          <StatCard 
            icon="move_location" 
            label="Relocated" 
            value={stats.relocatedCount} 
            loading={isLoading}
            trend="Protection" 
            colorClass="bg-orange-100 dark:bg-orange-900/30 text-orange-600" 
            progressWidth={`${stats.nestCount ? (stats.relocatedCount/stats.nestCount)*100 : 0}%`} 
          />
          <StatCard 
            icon="pest_control" 
            label="Hatching" 
            value={stats.hatchingCount} 
            loading={isLoading}
            trend="Active" 
            colorClass="bg-purple-100 dark:bg-purple-900/30 text-purple-600" 
            progressWidth={`${stats.nestCount ? (stats.hatchingCount/stats.nestCount)*100 : 0}%`} 
          />
           <StatCard 
            icon="medical_services" 
            label="Injured" 
            value={stats.injuredCount} 
            loading={isLoading}
            trend="Medical" 
            colorClass="bg-rose-100 dark:bg-rose-900/30 text-rose-600" 
            progressWidth={`${stats.turtleCount ? (stats.injuredCount/stats.turtleCount)*100 : 0}%`} 
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Action Column */}
          <section className="space-y-6">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">bolt</span>
                Quick Actions
            </h4>
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => onNavigate(AppView.NEST_ENTRY)}
                className="w-full text-left p-5 bg-primary/10 border-2 border-primary/30 dark:bg-primary/20 dark:border-primary/40 rounded-xl hover:bg-primary hover:border-primary transition-all group shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-primary text-white rounded-xl group-hover:bg-white group-hover:text-primary transition-colors flex items-center justify-center">
                    <img src="https://img.icons8.com/fluency/96/beach.png" className="size-8 object-contain brightness-0 invert group-hover:brightness-100 group-hover:invert-0" alt="" />
                  </div>
                  <div className="group-hover:text-white">
                    <h5 className="font-bold text-base">New Nest Entry</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/80">Log discovery of a new nesting site</p>
                  </div>
                </div>
              </button>
              <button 
                onClick={() => onNavigate(AppView.TAGGING_ENTRY)}
                className="w-full text-left p-5 bg-teal-500/10 border-2 border-teal-500/30 dark:bg-teal-500/20 dark:border-teal-500/40 rounded-xl hover:bg-teal-500 hover:border-teal-500 transition-all group shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-teal-500 text-white rounded-xl group-hover:bg-white group-hover:text-teal-500 transition-colors flex items-center justify-center">
                    <img src="https://img.icons8.com/fluency/96/turtle.png" className="size-8 object-contain brightness-0 invert group-hover:brightness-100 group-hover:invert-0" alt="" />
                  </div>
                  <div className="group-hover:text-white">
                    <h5 className="font-bold text-base">New Turtle Record</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/80">Tag and register a new specimen</p>
                  </div>
                </div>
              </button>
            </div>
          </section>

          {/* Activity Column */}
          <section className="space-y-6">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">history</span>
                Recent Database Activity
            </h4>
            <div className="bg-slate-100/50 dark:bg-[#1a232e] border border-slate-200 dark:border-[#283039] rounded-xl p-6 min-h-[300px]">
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
                      <span className="material-symbols-outlined text-4xl">inbox</span>
                      <p className="text-xs font-bold uppercase tracking-widest">No recent activity found</p>
                  </div>
              ) : (
                <div className="space-y-6">
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} className="flex gap-4 group">
                      <div className={`mt-1 flex items-center justify-center size-8 rounded-full shrink-0 ring-4 ring-background-dark ${activity.type === 'NEST' ? 'bg-blue-500/20 text-blue-500' : 'bg-teal-500/20 text-teal-500'}`}>
                        <span className="material-symbols-outlined text-sm">{activity.type === 'NEST' ? 'egg' : 'pets'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-200 truncate">{activity.title}</p>
                        <p className="text-xs text-slate-500 truncate">{activity.subtitle}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{activity.user}</span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[10px]">schedule</span> {timeAgo(activity.date)}
                            </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
