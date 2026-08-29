
import React, { useEffect, useState } from 'react';
import { Egg, MapPin, Waves, ArrowLeft, Loader2 } from 'lucide-react';
import { DatabaseConnection } from '../services/Database';

interface PublicStatsProps {
  onBack: () => void;
}

interface SeasonTotals {
  totalNests: number;
  totalEggs: number;
  hatchlingsReleased: number;
  nestsHatched: number;
}

const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: string | number }> = ({ icon, label, value }) => (
  <div className="flex flex-col items-center text-center gap-3 p-8 bg-slate-900/60 border border-white/10 rounded-2xl backdrop-blur-md">
    <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
      {icon}
    </div>
    <span className="text-4xl font-black text-white tracking-tight">{value}</span>
    <span className="text-xs font-black uppercase tracking-widest text-primary/80">{label}</span>
  </div>
);

const PublicStats: React.FC<PublicStatsProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState<SeasonTotals | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      setError(null);
      try {
        // One aggregate call. This page is shown to anyone, signed in or not,
        // and it used to read the whole nest table to add the numbers up in the
        // browser - which meant handing every nest's GPS position to the public.
        const stats = await DatabaseConnection.getPublicStats();

        const totalNests = stats.total_nests ?? 0;
        const totalEggs = stats.total_eggs ?? 0;
        const nestsHatched = stats.nests_hatched ?? 0;
        const hatchlingsReleased = stats.hatchlings_released ?? 0;

        setTotals({ totalNests, totalEggs, hatchlingsReleased, nestsHatched });
      } catch (err) {
        console.error('Failed to load public stats:', err);
        setError('Unable to load conservation stats right now. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="dark h-screen flex justify-center relative overflow-y-auto font-sans bg-background-dark">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-overlay dark:bg-overlay z-10"></div>
        <img
          className="w-full h-full object-cover blur-[2px]"
          alt="Greek beach background"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBty1eUB4C63fzQDx8hpKAej_4lcC3BiEWs-3TdmDaChK9monlP7vLeB-OtstaQMrlNlPxoHkyyrBm1vanxr7GvnLkC6-dV_yrb5A6Yq8WAquX6rujRBIS_RgDAguKJVzwZ2W4bYKuVcLniTR2D9WpjyrA35_n5IV0zlrdAYQqy48HYW-LPE0zH3Ecf_p35CAey-rxCt3ZJSGrT_Acvy070R1m1SQLnkkAZG2WebGXxmOaMMhf9JIMHTm6O7syHKpPugW_t1cbB78c"
        />
      </div>

      <div className="relative z-20 w-full max-w-3xl px-6 py-12">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-primary text-sm font-bold hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to Log in
        </button>

        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4 mx-auto shadow-[0_0_20px_rgba(19,127,236,0.3)]">
            <Egg className="text-primary w-8 h-8" fill="currentColor" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Season at a Glance</h1>
          <p className="text-primary/80 text-sm font-medium">Public conservation stats — updated live from the field</p>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 text-slate-400 py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest">Loading season stats...</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-center text-rose-400 text-sm font-bold">
            {error}
          </div>
        )}

        {!loading && !error && totals && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatTile icon={<MapPin className="size-6" />} label="Nests Recorded" value={totals.totalNests} />
            <StatTile icon={<Egg className="size-6" />} label="Eggs Recorded" value={totals.totalEggs} />
            <StatTile icon={<Waves className="size-6" />} label="Hatchlings Released" value={totals.hatchlingsReleased} />
            <StatTile icon={<Egg className="size-6" />} label="Nests Hatched" value={totals.nestsHatched} />
          </div>
        )}

        <p className="text-center text-[10px] text-slate-500 font-bold mt-10 max-w-md mx-auto leading-relaxed">
          These numbers reflect ongoing field data collected by our researchers and volunteers this season and update automatically.
        </p>
      </div>
    </div>
  );
};

export default PublicStats;
