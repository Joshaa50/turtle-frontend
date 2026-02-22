
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
  const isDark = colorClass.includes('dark');
  
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
      className={`p-4 rounded-xl border transition-all duration-300 group ${
        onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-95' : ''
      } ${
        isDark 
          ? 'bg-[#1a232e] border-[#283039] hover:border-primary/40' 
          : 'bg-white border-slate-200 hover:border-primary/30 shadow-sm'
      }`}
      style={{
        background: isDark 
          ? 'linear-gradient(145deg, #1a232e 0%, #141b24 100%)' 
          : undefined
      }}
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
          <p className={`text-[9px] font-bold uppercase tracking-widest leading-none mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
          {loading ? (
              <div className={`h-7 w-20 rounded animate-pulse my-0.5 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
          ) : (
              <h3 className={`text-2xl font-black leading-tight tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</h3>
          )}
      </div>
      <div className={`mt-3 w-full h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
        <div className={`h-full transition-all duration-1000 ${getProgressColor()}`} style={{ width: progressWidth }}></div>
      </div>
    </div>
  );
};

const Dashboard: React.FC<{ onNavigate: (v: AppView) => void; theme: 'light' | 'dark' }> = ({ onNavigate, theme }) => {
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
    <div className={`flex flex-col min-h-full ${theme === 'dark' ? 'bg-background-dark' : 'bg-background-light'}`}>
      <header className={`sticky top-0 z-10 backdrop-blur-md border-b px-8 py-4 flex items-center justify-between transition-all ${
        theme === 'dark' 
          ? 'bg-background-dark/80 border-[#283039]' 
          : 'bg-white/80 border-slate-200'
      }`}>
        <div className="w-10 lg:w-32 flex-shrink-0">
          {/* Left spacer for mobile menu button / balance */}
        </div>

        <div className="flex-1 flex justify-center">
          <h2 className={`text-xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Dashboard</h2>
        </div>

        <div className="flex items-center gap-4 w-10 lg:w-32 justify-end flex-shrink-0">
          <div className="relative hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input 
              className={`pl-9 pr-4 py-2 border-none rounded-lg text-sm focus:ring-1 focus:ring-primary w-48 lg:w-64 transition-all ${
                theme === 'dark' 
                  ? 'bg-[#283039] text-white' 
                  : 'bg-slate-100 text-slate-900'
              }`} 
              placeholder="Search data..." 
              type="text" 
            />
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
            colorClass={theme === 'dark' ? 'bg-blue-500/10 text-blue-400 dark' : 'bg-blue-100 text-blue-600'} 
            progressWidth="75%"
            onClick={() => onNavigate(AppView.NEST_RECORDS)}
          />
          <StatCard 
            icon={<img src="https://img.icons8.com/fluency/96/turtle.png" className="size-5 object-contain" alt="" />}
            label="Turtle Records" 
            value={stats.turtleCount} 
            loading={isLoading}
            trend="Live" 
            colorClass={theme === 'dark' ? 'bg-teal-500/10 text-teal-400 dark' : 'bg-teal-100 text-teal-600'} 
            progressWidth="50%"
            onClick={() => onNavigate(AppView.TURTLE_RECORDS)}
          />
          <StatCard 
            icon="egg" 
            label="Total Eggs" 
            value={stats.eggCount.toLocaleString()} 
            loading={isLoading}
            trend="Season" 
            colorClass={theme === 'dark' ? 'bg-amber-500/10 text-amber-400 dark' : 'bg-amber-100 text-amber-600'} 
            progressWidth="85%" 
          />
          <StatCard 
            icon="move_location" 
            label="Relocated" 
            value={stats.relocatedCount} 
            loading={isLoading}
            trend="Protection" 
            colorClass={theme === 'dark' ? 'bg-orange-500/10 text-orange-400 dark' : 'bg-orange-100 text-orange-600'} 
            progressWidth={`${stats.nestCount ? (stats.relocatedCount/stats.nestCount)*100 : 0}%`} 
          />
          <StatCard 
            icon="pest_control" 
            label="Hatching" 
            value={stats.hatchingCount} 
            loading={isLoading}
            trend="Active" 
            colorClass={theme === 'dark' ? 'bg-purple-500/10 text-purple-400 dark' : 'bg-purple-100 text-purple-600'} 
            progressWidth={`${stats.nestCount ? (stats.hatchingCount/stats.nestCount)*100 : 0}%`} 
          />
           <StatCard 
            icon="medical_services" 
            label="Injured" 
            value={stats.injuredCount} 
            loading={isLoading}
            trend="Medical" 
            colorClass={theme === 'dark' ? 'bg-rose-500/10 text-rose-400 dark' : 'bg-rose-100 text-rose-600'} 
            progressWidth={`${stats.turtleCount ? (stats.injuredCount/stats.turtleCount)*100 : 0}%`} 
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Action Column */}
          <section className="space-y-6">
            <h4 className={`text-lg font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <span className="material-symbols-outlined text-primary">bolt</span>
                Quick Actions
            </h4>
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => onNavigate(AppView.NEST_ENTRY)}
                className={`w-full text-left p-5 border-2 rounded-xl transition-all group shadow-lg ${
                  theme === 'dark'
                    ? 'bg-primary/5 border-primary/20 hover:bg-primary/20 hover:border-primary/60'
                    : 'bg-primary/10 border-primary/30 hover:bg-primary hover:border-primary'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-xl transition-colors flex items-center justify-center ${
                    theme === 'dark' ? 'bg-primary/20 text-primary group-hover:bg-primary group-hover:text-white' : 'bg-primary text-white group-hover:bg-white group-hover:text-primary'
                  }`}>
                    <img src="https://img.icons8.com/fluency/96/beach.png" className={`size-8 object-contain transition-all ${
                      theme === 'dark' ? 'brightness-100 group-hover:brightness-0 group-hover:invert' : 'brightness-0 invert group-hover:brightness-100 group-hover:invert-0'
                    }`} alt="" />
                  </div>
                  <div className={`${theme === 'dark' ? 'text-slate-200 group-hover:text-white' : 'text-slate-900 group-hover:text-white'}`}>
                    <h5 className="font-bold text-base">New Nest Entry</h5>
                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-400 group-hover:text-white/80' : 'text-slate-500 group-hover:text-white/80'}`}>Log discovery of a new nesting site</p>
                  </div>
                </div>
              </button>
              <button 
                onClick={() => onNavigate(AppView.TAGGING_ENTRY)}
                className={`w-full text-left p-5 border-2 rounded-xl transition-all group shadow-lg ${
                  theme === 'dark'
                    ? 'bg-teal-500/5 border-teal-500/20 hover:bg-teal-500/20 hover:border-teal-500/60'
                    : 'bg-teal-500/10 border-teal-500/30 hover:bg-teal-500 hover:border-teal-500'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-xl transition-colors flex items-center justify-center ${
                    theme === 'dark' ? 'bg-teal-500/20 text-teal-500 group-hover:bg-teal-500 group-hover:text-white' : 'bg-teal-500 text-white group-hover:bg-white group-hover:text-teal-500'
                  }`}>
                    <img src="https://img.icons8.com/fluency/96/turtle.png" className={`size-8 object-contain transition-all ${
                      theme === 'dark' ? 'brightness-100 group-hover:brightness-0 group-hover:invert' : 'brightness-0 invert group-hover:brightness-100 group-hover:invert-0'
                    }`} alt="" />
                  </div>
                  <div className={`${theme === 'dark' ? 'text-slate-200 group-hover:text-white' : 'text-slate-900 group-hover:text-white'}`}>
                    <h5 className="font-bold text-base">New Turtle Record</h5>
                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-400 group-hover:text-white/80' : 'text-slate-500 group-hover:text-white/80'}`}>Tag and register a new specimen</p>
                  </div>
                </div>
              </button>
            </div>
          </section>

          {/* Activity Column */}
          <section className="space-y-6">
            <h4 className={`text-lg font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <span className="material-symbols-outlined text-amber-500">history</span>
                Recent Database Activity
            </h4>
            <div className={`border rounded-xl p-6 min-h-[300px] transition-all ${
              theme === 'dark' 
                ? 'bg-[#1a232e] border-[#283039]' 
                : 'bg-slate-100/50 border-slate-200'
            }`}>
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
                        <p className={`text-sm font-bold truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{activity.title}</p>
                        <p className={`text-xs truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{activity.subtitle}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                              theme === 'dark' ? 'text-slate-400 bg-white/5' : 'text-slate-600 bg-slate-200'
                            }`}>{activity.user}</span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
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
