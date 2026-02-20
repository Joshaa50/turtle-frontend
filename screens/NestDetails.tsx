
import React, { useState, useEffect, useMemo } from 'react';
import { DatabaseConnection, NestData, NestEventData } from '../services/Database';

interface NestDetailsProps {
  id: string;
  onBack: () => void;
}

// Event Types for the Nest Timeline
type NestEvent = {
  date: string;
  type: string;
  label: string;
  description: string;
  dayCount: number; // Days since discovery
  sortVal: number; // For chronological sorting
  rawEvent?: NestEventData; // Store original event for modal details
};

interface TriangulationPoint {
  desc: string;
  dist: string;
  lat: string;
  lng: string;
}

interface SiteData {
  date: string;
  gps: string;
  depth_h: string;
  depth_H: string;
  width_w: string;
  distToSea_S: string;
  landmark: string;
}

interface StageDetails {
  count: number;
  black: number;
  pink: number;
  green: number;
}

interface InventoryRecord {
  id: string;
  date: string;
  type: string;
  excavator: string;
  totalEggs: number;
  hatched: number;
  noVisible: StageDetails;
  eyeSpot: StageDetails;
  early: StageDetails;
  middle: StageDetails;
  late: StageDetails;
  pippedDead: StageDetails;
  pippedAlive: number;
  aliveWithin: number;
  deadWithin: number;
  aliveAbove: number;
  deadAbove: number;
}

const NestDetails: React.FC<NestDetailsProps> = ({ id, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [nest, setNest] = useState<NestData | null>(null);
  const [events, setEvents] = useState<NestEventData[]>([]);
  const [selectedReport, setSelectedReport] = useState<InventoryRecord | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const nestResponse = await DatabaseConnection.getNest(id);
        const eventsResponse = await DatabaseConnection.getNestEvents(id);
        
        if (nestResponse && nestResponse.nest) {
          setNest(nestResponse.nest);
        }
        if (Array.isArray(eventsResponse)) {
          setEvents(eventsResponse);
        }
      } catch (error) {
        console.error("Error loading nest details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Transform Data for View
  const viewData = useMemo(() => {
    if (!nest) return null;

    const discoveryDate = new Date(nest.date_found);
    const discoveryDateStr = discoveryDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // 1. Determine Site Data (Original vs Relocated)
    // If relocated, the 'nest' object holds the CURRENT (relocated) data.
    // We try to find original data from an event if possible, or fallback.
    let originalSite: SiteData = {
        date: discoveryDateStr,
        gps: `${nest.gps_lat}, ${nest.gps_long}`,
        depth_h: `${nest.depth_top_egg_h || '?'}cm`,
        depth_H: nest.depth_bottom_chamber_h ? `${nest.depth_bottom_chamber_h}cm` : '—',
        width_w: nest.width_w ? `${nest.width_w}cm` : '—',
        distToSea_S: `${nest.distance_to_sea_s}m`,
        landmark: nest.beach || 'Unknown',
    };

    let relocatedSite: SiteData | null = null;

    if (nest.relocated) {
        // If relocated, 'nest' record is the NEW location.
        relocatedSite = { ...originalSite, landmark: `Relocated: ${nest.notes || ''}` };
        
        // Try to find original data from an inventory event or similar if available
        // Assuming events might store original_* fields. 
        // We scan events for original_gps_lat to populate the "Discovery" card correctly.
        const originalEvent = events.find(e => e.original_gps_lat != null);
        if (originalEvent) {
            originalSite = {
                date: discoveryDateStr,
                gps: `${originalEvent.original_gps_lat}, ${originalEvent.original_gps_long}`,
                depth_h: originalEvent.original_depth_top_egg_h ? `${originalEvent.original_depth_top_egg_h}cm` : '—',
                depth_H: originalEvent.original_depth_bottom_chamber_h ? `${originalEvent.original_depth_bottom_chamber_h}cm` : '—',
                width_w: originalEvent.original_width_w ? `${originalEvent.original_width_w}cm` : '—',
                distToSea_S: originalEvent.original_distance_to_sea_s ? `${originalEvent.original_distance_to_sea_s}m` : '—',
                landmark: 'Original Location'
            };
        } else {
            // Fallback if we can't find original data
            originalSite = {
                date: discoveryDateStr,
                gps: 'See Logs',
                depth_h: '—',
                depth_H: '—',
                width_w: '—',
                distToSea_S: '—',
                landmark: 'Original Data Archived'
            };
        }
    }

    // 2. Timeline Construction
    const timeline: NestEvent[] = [];
    
    // Discovery Event
    timeline.push({
        date: discoveryDateStr,
        type: 'DISCOVERY',
        label: 'Nest Discovered',
        description: `Found at ${nest.beach}. Status: ${nest.relocated ? 'Relocated' : 'In Situ'}.`,
        dayCount: 0,
        sortVal: discoveryDate.getTime()
    });

    // Process DB Events
    events.forEach(e => {
        const eDate = e.start_time ? new Date(e.start_time) : (e.created_at ? new Date(e.created_at) : new Date());
        const dayCount = Math.floor((eDate.getTime() - discoveryDate.getTime()) / (1000 * 60 * 60 * 24));
        const dateStr = eDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        
        let label = e.event_type.replace(/_/g, ' ');
        let desc = e.notes || 'No notes.';

        if (e.event_type.includes('INVENTORY')) {
            desc = `Excavator: ${e.observer || 'Unknown'}. Hatched: ${e.hatched_count || 0}.`;
        } else if (e.event_type === 'EMERGENCE' || e.event_type === 'HATCHING') {
            const emerged = e.tracks_to_sea || 0;
            desc = `${emerged} hatchlings emerged to sea.`;
            if (e.tracks_lost && e.tracks_lost > 0) {
                desc += ` (${e.tracks_lost} lost)`;
            }
        } else if (e.event_type === 'TOP_EGG') {
            desc = `Top egg check performed.`;
        }

        timeline.push({
            date: dateStr,
            type: e.event_type,
            label: label,
            description: desc,
            dayCount: dayCount,
            sortVal: eDate.getTime(),
            rawEvent: e
        });
    });

    timeline.sort((a, b) => a.sortVal - b.sortVal);

    // 3. Stats
    const totalEggs = nest.total_num_eggs || 0;
    const incubationDays = timeline.length > 1 ? timeline[timeline.length - 1].dayCount : 0; // Rough estimate based on last event

    // 4. Triangulation
    const triangulationPoints: TriangulationPoint[] = [];
    if (nest.tri_tl_lat) {
        triangulationPoints.push({
            desc: nest.tri_tl_desc || 'Point A',
            dist: `${nest.tri_tl_distance}m`,
            lat: String(nest.tri_tl_lat),
            lng: String(nest.tri_tl_long)
        });
    }
    if (nest.tri_tr_lat) {
        triangulationPoints.push({
            desc: nest.tri_tr_desc || 'Point B',
            dist: `${nest.tri_tr_distance}m`,
            lat: String(nest.tri_tr_lat),
            lng: String(nest.tri_tr_long)
        });
    }

    return {
        originalSite,
        relocatedSite,
        timeline,
        stats: { totalEggs, incubationDays },
        triangulation: triangulationPoints
    };
  }, [nest, events]);

  // Helper to map DB event to Inventory Record for Modal
  const mapEventToInventory = (e: NestEventData): InventoryRecord => {
    return {
        id: String(e.id || 'N/A'),
        date: e.start_time ? new Date(e.start_time).toLocaleDateString() : 'N/A',
        type: e.event_type,
        excavator: e.observer || 'Unknown',
        totalEggs: (e.hatched_count || 0) + (e.non_viable_count || 0) + (e.eye_spot_count || 0) + (e.early_count || 0) + (e.middle_count || 0) + (e.late_count || 0) + (e.piped_dead_count || 0) + (e.piped_alive_count || 0), // Calculate sum as check, or use e.total_eggs if reliable
        hatched: e.hatched_count || 0,
        noVisible: { count: e.non_viable_count || 0, black: e.non_viable_black_fungus_count || 0, pink: e.non_viable_pink_bacteria_count || 0, green: e.non_viable_green_bacteria_count || 0 },
        eyeSpot: { count: e.eye_spot_count || 0, black: e.eye_spot_black_fungus_count || 0, pink: e.eye_spot_pink_bacteria_count || 0, green: e.eye_spot_green_bacteria_count || 0 },
        early: { count: e.early_count || 0, black: e.early_black_fungus_count || 0, pink: e.early_pink_bacteria_count || 0, green: e.early_green_bacteria_count || 0 },
        middle: { count: e.middle_count || 0, black: e.middle_black_fungus_count || 0, pink: e.middle_pink_bacteria_count || 0, green: e.middle_green_bacteria_count || 0 },
        late: { count: e.late_count || 0, black: e.late_black_fungus_count || 0, pink: e.late_pink_bacteria_count || 0, green: e.late_green_bacteria_count || 0 },
        pippedDead: { count: e.piped_dead_count || 0, black: e.piped_dead_black_fungus_count || 0, pink: e.piped_dead_pink_bacteria_count || 0, green: e.piped_dead_green_bacteria_count || 0 },
        pippedAlive: e.piped_alive_count || 0,
        aliveWithin: e.alive_within || 0,
        deadWithin: e.dead_within || 0,
        aliveAbove: e.alive_above || 0,
        deadAbove: e.dead_above || 0
    };
  };

  const openInventoryModal = (event: NestEvent) => {
    if (event.rawEvent && (event.type.includes('INVENTORY') || event.type === 'TOP_EGG')) {
        setSelectedReport(mapEventToInventory(event.rawEvent));
    }
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-background-dark flex items-center justify-center text-slate-400">
            <div className="flex flex-col items-center gap-4">
            <span className="size-8 border-2 border-slate-600 border-t-primary rounded-full animate-spin"></span>
            <p className="text-xs font-bold uppercase tracking-widest">Loading Nest Data...</p>
            </div>
        </div>
    );
  }

  if (!nest || !viewData) {
      return <div className="p-10 text-white">Nest not found.</div>;
  }

  const successRate = selectedReport ? ((selectedReport.hatched / selectedReport.totalEggs) * 100).toFixed(1) : (nest.current_num_eggs && nest.total_num_eggs && nest.total_num_eggs > 0 ? (((nest.total_num_eggs - nest.current_num_eggs)/nest.total_num_eggs)*100).toFixed(1) : 'N/A');

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark font-display text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-background-light dark:bg-[#111418] sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto pl-16 pr-6 lg:pl-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tighter uppercase leading-none">{nest.nest_code}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 text-white text-[10px] font-black rounded uppercase tracking-widest shadow-lg ${nest.status === 'hatched' ? 'bg-emerald-500 shadow-emerald-500/20' : nest.status === 'hatching' ? 'bg-amber-500 shadow-amber-500/20' : 'bg-primary shadow-primary/20'}`}>
              {nest.status}
            </span>
            <button className="p-2 hover:bg-white/5 rounded-lg text-slate-400"><span className="material-symbols-outlined">more_vert</span></button>
          </div>
        </div>
      </header>

      {/* Hero Summary Bar */}
      <div className="bg-[#111418] border-b border-white/5 shadow-inner">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex flex-wrap items-center justify-start gap-x-12 gap-y-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">monitoring</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Success Rate</span>
                <span className="text-xl font-black text-white">{successRate}{successRate !== 'N/A' && '%'}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">egg</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Total Eggs</span>
                <span className="text-xl font-black text-white">{viewData.stats.totalEggs || '—'}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">timer</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Incubation</span>
                <span className="text-xl font-black text-white">{viewData.stats.incubationDays || '—'} <span className="text-xs text-slate-500 font-bold">Days</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-10 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* Scientific Inventory History */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">history_edu</span> Scientific Inventory
                </h3>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[500px] border-collapse">
                    <thead>
                      <tr className="bg-white/[0.03] border-b border-white/5">
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Date</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Type</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Hatched</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Excavator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {viewData.timeline.filter(e => e.type.includes('INVENTORY') || e.type === 'TOP_EGG').map((inv, idx) => (
                        <tr key={idx} className="hover:bg-primary/5 transition-colors group cursor-pointer" onClick={() => openInventoryModal(inv)}>
                          <td className="px-6 py-4 whitespace-nowrap"><span className="text-xs font-bold text-slate-200">{inv.date}</span></td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ring-1 ${inv.type === 'FULL_INVENTORY' ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20' : 'bg-amber-500/10 text-amber-500 ring-amber-500/20'}`}>
                              {inv.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-mono text-xs text-primary">{inv.rawEvent?.hatched_count || 0}</td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-400">{inv.rawEvent?.observer || 'Unknown'}</td>
                        </tr>
                      ))}
                      {viewData.timeline.filter(e => e.type.includes('INVENTORY') || e.type === 'TOP_EGG').length === 0 && (
                          <tr><td colSpan={4} className="px-6 py-4 text-xs text-slate-500 italic text-center">No inventory records found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

          </div>

          {/* Right Column: Site Records & Timeline */}
          <div className="lg:col-span-4 space-y-10">
            
            {/* Lifecycle History */}
            <section className="space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">event_note</span> Lifecycle History
              </h3>
              <div className="relative pl-8 space-y-10 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-white/10">
                {viewData.timeline.map((event, idx) => (
                  <div key={idx} className="relative group cursor-pointer" onClick={() => openInventoryModal(event)}>
                    <div className={`absolute -left-[21px] top-1 size-3 rounded-full ring-4 ring-background-dark border-2 border-background-dark ${
                      event.type === 'DISCOVERY' ? 'bg-primary' : 
                      event.type.includes('INVENTORY') ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}></div>
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{event.date}</span>
                        {event.dayCount > 0 && <span className="text-[8px] font-black bg-white/5 px-1.5 py-0.5 rounded text-slate-400">Day {event.dayCount}</span>}
                      </div>
                      <span className="text-xs font-black text-slate-200 mt-0.5 uppercase tracking-tighter">{event.label}</span>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-medium">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Site Data Cards (Original & Relocated) */}
            <div className="space-y-8">
              {/* Discovery Snapshot */}
              <section className="bg-white dark:bg-[#1a232e] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Discovery Site Data</h3>
                  <span className="text-[8px] font-black text-primary px-2 py-0.5 bg-primary/10 rounded uppercase">Original</span>
                </div>
                <div className="p-8 space-y-8">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                    <DataBit label="Depth (h)" value={viewData.originalSite.depth_h} />
                    <DataBit label="Depth (H)" value={viewData.originalSite.depth_H} />
                    <DataBit label="Width (w)" value={viewData.originalSite.width_w} />
                    <DataBit label="To Sea (S)" value={viewData.originalSite.distToSea_S} />
                  </div>
                  <div className="pt-6 border-t border-white/5">
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-2">GPS Location</p>
                    <p className="text-base font-mono font-bold text-primary">{viewData.originalSite.gps}</p>
                  </div>
                </div>
              </section>

              {/* Relocation Snapshot */}
              {viewData.relocatedSite && (
                <section className="bg-white dark:bg-[#1a232e] border border-amber-500/20 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-amber-500/10">
                  <div className="p-6 border-b border-white/5 bg-amber-500/5 flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Relocated Site Data</h3>
                    <span className="text-[8px] font-black text-white px-2 py-0.5 bg-amber-500 rounded uppercase">Relocated</span>
                  </div>
                  <div className="p-8 space-y-8">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                      <DataBit label="Depth (h)" value={viewData.relocatedSite.depth_h} />
                      <DataBit label="Depth (H)" value={viewData.relocatedSite.depth_H} />
                      <DataBit label="Width (w)" value={viewData.relocatedSite.width_w} />
                      <DataBit label="To Sea (S)" value={viewData.relocatedSite.distToSea_S} />
                    </div>
                    <div className="pt-6 border-t border-white/5">
                      <p className="text-[8px] font-black text-amber-500 uppercase mb-2">New GPS Location</p>
                      <p className="text-base font-mono font-bold text-white">{viewData.relocatedSite.gps}</p>
                    </div>
                    <div className="pt-6 border-t border-white/5">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-2">Reason</p>
                      <p className="text-xs text-amber-400 font-medium italic leading-relaxed">"{viewData.relocatedSite.landmark}"</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Triangulation Verification Section - Moved to Right Column */}
              <section className="bg-white dark:bg-[#1a232e] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Triangulation Points</h3>
                  <span className="material-symbols-outlined text-slate-500 text-sm">explore</span>
                </div>
                <div className="p-6 space-y-6">
                  {viewData.triangulation.length > 0 ? viewData.triangulation.map((point, idx) => (
                    <div key={idx} className="pb-6 border-b border-white/5 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center mb-3">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-black uppercase rounded tracking-widest">Point 0{idx+1}</span>
                        <span className="text-[9px] font-mono text-slate-500">{point.lat}, {point.lng}</span>
                      </div>
                      <h4 className="text-xs font-black text-white mb-2">{point.desc}</h4>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-xs text-primary">straighten</span>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Distance: <span className="text-white text-xs">{point.dist}</span></p>
                      </div>
                    </div>
                  )) : (
                      <div className="text-center text-slate-500 text-xs italic py-4">No triangulation points recorded.</div>
                  )}
                </div>
              </section>
            </div>

          </div>
        </div>
      </main>

      {/* Report View Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedReport(null)}></div>
          <div className="relative bg-[#111c26] border border-white/10 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <header className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div>
                <h3 className="font-black text-xl uppercase tracking-tight text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-3xl">analytics</span> 
                  {selectedReport.type.replace('_', ' ')} Analysis
                </h3>
                <p className="text-[10px] font-black text-slate-500 uppercase mt-2 tracking-widest">
                  EXCAVATION • {selectedReport.date} • EXCAVATOR: {selectedReport.excavator}
                </p>
              </div>
              <button onClick={() => setSelectedReport(null)} className="p-3 text-slate-500 hover:text-white hover:bg-white/5 rounded-full transition-all">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <SummaryStat label="Hatched Shells" value={selectedReport.hatched} color="text-primary" />
                <SummaryStat label="Pipped Alive" value={selectedReport.pippedAlive} color="text-emerald-500" />
                <SummaryStat label="Unhatched Eggs" value={selectedReport.totalEggs - selectedReport.hatched} color="text-amber-500" />
                <SummaryStat label="Total Sample" value={selectedReport.totalEggs} color="text-slate-400" />
              </div>

              {/* Hatchling Findings */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-900/50 rounded-2xl border border-white/5">
                 <div className="text-center">
                    <p className="text-[8px] uppercase font-black text-slate-500 tracking-widest">Alive (In Nest)</p>
                    <p className="text-xl font-black text-emerald-400">{selectedReport.aliveWithin}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-[8px] uppercase font-black text-slate-500 tracking-widest">Alive (Surface)</p>
                    <p className="text-xl font-black text-emerald-400">{selectedReport.aliveAbove}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-[8px] uppercase font-black text-slate-500 tracking-widest">Dead (In Nest)</p>
                    <p className="text-xl font-black text-rose-500">{selectedReport.deadWithin}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-[8px] uppercase font-black text-slate-500 tracking-widest">Dead (Surface)</p>
                    <p className="text-xl font-black text-rose-500">{selectedReport.deadAbove}</p>
                 </div>
              </div>
              
              {/* Embryonic Stages Breakdown Table */}
              <section className="space-y-6">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-8 h-px bg-slate-800"></span> Embryonic Breakdown
                </h4>
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[700px]">
                      <thead className="bg-white/[0.03] border-b border-white/5">
                        <tr>
                          <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest">Stage</th>
                          <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Count</th>
                          <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Percentage</th>
                          <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Black Fungus</th>
                          <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Pink Bact.</th>
                          <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Green Bact.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {[
                          { label: "No Visible Embryo", data: selectedReport.noVisible },
                          { label: "Eye Spot Stage", data: selectedReport.eyeSpot },
                          { label: "Early Development", data: selectedReport.early },
                          { label: "Middle Development", data: selectedReport.middle },
                          { label: "Late Development", data: selectedReport.late },
                          { label: "Pipped Dead", data: selectedReport.pippedDead }
                        ].map((stage, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-4">
                              <span className="text-xs font-bold text-slate-200 uppercase">{stage.label}</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-sm font-black text-white">{stage.data.count}</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-[10px] font-mono text-slate-500">
                                {selectedReport.totalEggs > 0 ? ((stage.data.count / selectedReport.totalEggs) * 100).toFixed(1) : '0.0'}%
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`text-xs font-bold ${stage.data.black > 0 ? 'text-zinc-400' : 'text-slate-600 opacity-30'}`}>
                                {stage.data.black}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`text-xs font-bold ${stage.data.pink > 0 ? 'text-rose-400' : 'text-slate-600 opacity-30'}`}>
                                {stage.data.pink}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`text-xs font-bold ${stage.data.green > 0 ? 'text-emerald-400' : 'text-slate-600 opacity-30'}`}>
                                {stage.data.green}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
            <footer className="p-6 bg-white/5 border-t border-white/5 flex justify-end">
              <button onClick={() => setSelectedReport(null)} className="px-8 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">Close Report</button>
            </footer>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-40">
        <button className="size-16 bg-primary hover:bg-primary/90 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 group">
          <span className="material-symbols-outlined text-3xl">edit</span>
        </button>
      </div>
    </div>
  );
};

// Internal components
const DataBit: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[8px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">{label}</p>
    <p className="text-base font-bold text-white leading-none">{value}</p>
  </div>
);

const SummaryStat: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col items-center text-center">
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 leading-tight">{label}</p>
    <p className={`text-4xl font-black ${color}`}>{value}</p>
  </div>
);

export default NestDetails;
