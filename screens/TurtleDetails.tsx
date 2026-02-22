
import React, { useMemo, useState, useEffect } from 'react';
import { AppView } from '../types';
import { DatabaseConnection } from '../services/Database';

interface TurtleDetailsProps {
  id: string; // This is now the turtle.id (primary key) from Records
  onBack: () => void;
  onNavigate: (view: AppView) => void;
}

interface MeasurementSet {
  sclMax?: number;
  sclMin?: number;
  scw?: number;
  cclMax?: number;
  cclMin?: number;
  ccw?: number;
  tailExtension?: number;
  ventToTip?: number;
  totalTail?: number;
}

interface TagData {
  id: string;
  address?: string;
}

interface TagSet {
  fl_l?: TagData;
  fl_r?: TagData;
  rr_l?: TagData;
  rr_r?: TagData;
  microchip?: {
    number: string;
    location: string;
  };
}

interface TurtleHistoryEvent {
  id: string;
  date: string;
  type: 'TAGGING' | 'NIGHT_SURVEY';
  location: string;
  observer: string;
  measurements: MeasurementSet;
  notes?: string;
  tags?: TagSet;
}

interface TurtleMeta {
  name: string;
  species: string;
  turtle_id: string | number;
  health_condition: string;
  sex?: string;
  measurements?: MeasurementSet;
  tags?: TagSet;
}

const TurtleDetails: React.FC<TurtleDetailsProps> = ({ id, onBack, onNavigate }) => {
  const [selectedEvent, setSelectedEvent] = useState<TurtleHistoryEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TurtleHistoryEvent[]>([]);
  const [turtleMeta, setTurtleMeta] = useState<TurtleMeta>({
    name: 'Loading...',
    species: '',
    turtle_id: id,
    health_condition: 'Unknown',
    sex: 'Unknown'
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch both specific turtle info and its event history
        const [turtleResponse, eventsResponse] = await Promise.all([
            DatabaseConnection.getTurtle(id),
            DatabaseConnection.getTurtleSurveyEvents(id)
        ]);
        
        // 1. Set Meta from Turtle Table Source (Endpoint: /turtles/:id)
        if (turtleResponse && turtleResponse.turtle) {
            const t = turtleResponse.turtle;
            setTurtleMeta({
                name: t.name || 'Unnamed Turtle',
                species: t.species || 'Unknown',
                turtle_id: t.id,
                health_condition: t.health_condition || 'Unknown',
                sex: t.sex || 'Unknown',
                measurements: {
                    sclMax: t.scl_max ? Number(t.scl_max) : undefined,
                    sclMin: t.scl_min ? Number(t.scl_min) : undefined,
                    scw: t.scw ? Number(t.scw) : undefined,
                    cclMax: t.ccl_max ? Number(t.ccl_max) : undefined,
                    cclMin: t.ccl_min ? Number(t.ccl_min) : undefined,
                    ccw: t.ccw ? Number(t.ccw) : undefined,
                    tailExtension: t.tail_extension ? Number(t.tail_extension) : undefined,
                    ventToTip: t.vent_to_tail_tip ? Number(t.vent_to_tail_tip) : undefined,
                    totalTail: t.total_tail_length ? Number(t.total_tail_length) : undefined,
                },
                tags: {
                    fl_l: t.front_left_tag ? { id: t.front_left_tag, address: t.front_left_address } : undefined,
                    fl_r: t.front_right_tag ? { id: t.front_right_tag, address: t.front_right_address } : undefined,
                    rr_l: t.rear_left_tag ? { id: t.rear_left_tag, address: t.rear_left_address } : undefined,
                    rr_r: t.rear_right_tag ? { id: t.rear_right_tag, address: t.rear_right_address } : undefined,
                }
            });
        }

        // 2. Set Events History
        if (eventsResponse && eventsResponse.events) {
          // Sort events by date descending (newest first)
          const sortedRawEvents = [...eventsResponse.events].sort((a: any, b: any) => 
            new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
          );

          const mappedEvents: TurtleHistoryEvent[] = sortedRawEvents.map((e: any) => {
            return {
              id: e.id.toString(),
              date: new Date(e.event_date).toLocaleDateString(),
              type: e.event_type || 'TAGGING', 
              location: e.location,
              observer: e.observer,
              measurements: {
                sclMax: e.scl_max ? Number(e.scl_max) : undefined,
                sclMin: e.scl_min ? Number(e.scl_min) : undefined,
                scw: e.scw ? Number(e.scw) : undefined,
                cclMax: e.ccl_max ? Number(e.ccl_max) : undefined,
                cclMin: e.ccl_min ? Number(e.ccl_min) : undefined,
                ccw: e.ccw ? Number(e.ccw) : undefined,
                tailExtension: e.tail_extension ? Number(e.tail_extension) : undefined,
                ventToTip: e.vent_to_tail_tip ? Number(e.vent_to_tail_tip) : undefined,
                totalTail: e.total_tail_length ? Number(e.total_tail_length) : undefined,
              },
              tags: {
                fl_l: e.front_left_tag ? { id: e.front_left_tag, address: e.front_left_address } : undefined,
                fl_r: e.front_right_tag ? { id: e.front_right_tag, address: e.front_right_address } : undefined,
                rr_l: e.rear_left_tag ? { id: e.rear_left_tag, address: e.rear_left_address } : undefined,
                rr_r: e.rear_right_tag ? { id: e.rear_right_tag, address: e.rear_right_address } : undefined,
              },
              notes: e.notes
            };
          });
          setEvents(mappedEvents);
        }
      } catch (err) {
        console.error("Failed to load turtle details", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) loadData();
  }, [id]);

  // Handle common name mapping if database still returns old scientific names, otherwise use direct value
  const commonName = (turtleMeta.species === 'Chelonia mydas' || turtleMeta.species.includes('mydas')) 
    ? 'Green' 
    : ((turtleMeta.species === 'Caretta caretta' || turtleMeta.species.includes('caretta')) 
        ? 'Loggerhead' 
        : ((turtleMeta.species === 'Dermochelys coriacea' || turtleMeta.species.includes('coriacea')) ? 'Leatherback' : turtleMeta.species));

  const totalSightings = events.length;
  // First seen is now the last item in the sorted array (oldest), Last seen is the first item (newest)
  const firstSeenDate = events.length > 0 ? events[events.length - 1].date : 'N/A';
  const lastLocation = events.length > 0 ? events[0].location : 'N/A';
  
  // Find the most recent tag ID used for display title
  const currentTagId = useMemo(() => {
    if (events.length === 0) return `ID: ${id}`;
    const latest = events[0];
    return latest.tags?.fl_l?.id || latest.tags?.fl_r?.id || latest.tags?.rr_l?.id || latest.tags?.rr_r?.id || `Ref: ${id}`;
  }, [events, id]);

  const getHealthColor = (condition: string) => {
    const status = condition?.toLowerCase() || '';
    if (status === 'healthy') return "text-emerald-400";
    if (status === 'injured') return "text-amber-500";
    if (status === 'lethargic') return "text-orange-500";
    if (status === 'dead') return "text-slate-500";
    return "text-slate-400";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center text-slate-900 dark:text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <span className="size-8 border-2 border-slate-300 dark:border-slate-600 border-t-primary rounded-full animate-spin"></span>
          <p className="text-xs font-bold uppercase tracking-widest">Loading Turtle Details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#111418]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#283039] pl-16 pr-4 sm:pr-8 lg:pl-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="group flex items-center gap-2 pr-4 pl-2 py-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <div className="p-1.5 rounded-full bg-slate-100 dark:bg-white/5 group-hover:bg-primary group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </div>
            <span className="text-xs font-black uppercase tracking-widest hidden sm:block">Back to Turtle Records</span>
          </button>
          
          <div className="w-px h-8 bg-slate-200 dark:bg-white/10 mx-2 hidden sm:block"></div>

          <div className="flex flex-col">
            <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">
              Turtle Details: {currentTagId}
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          {/* New Event button removed */}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Profile Summary Card */}
        <section className="bg-white dark:bg-[#1a232e] border border-slate-200 dark:border-[#283039] rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 dark:border-[#283039] pb-8 md:pb-0">
              <div className="size-24 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 ring-4 ring-primary/5">
                <span className="material-symbols-outlined text-5xl">turtle</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white text-center">{turtleMeta.name}</h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">{turtleMeta.species}</p>
            </div>
            
            <div className="md:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-6 content-center">
              <ProfileItem 
                label="Species" 
                value={commonName} 
                icon="category" 
                color={(commonName === 'Green') ? 'text-emerald-400' : 'text-amber-400'} 
              />
              <ProfileItem label="Primary Tag" value={currentTagId} icon="label" />
              <ProfileItem label="System ID" value={String(turtleMeta.turtle_id)} icon="fingerprint" />
              <ProfileItem 
                label="Gender" 
                value={turtleMeta.sex && turtleMeta.sex !== 'Unknown' ? (turtleMeta.sex.charAt(0).toUpperCase() + turtleMeta.sex.slice(1)) : 'Unknown'} 
                icon="wc" 
              /> 
              <ProfileItem label="First Seen" value={firstSeenDate} icon="event" />
              <ProfileItem label="Total Sightings" value={totalSightings.toString()} icon="visibility" />
              <ProfileItem label="Last Location" value={lastLocation} icon="location_on" />
              <ProfileItem 
                label="Health Index" 
                value={turtleMeta.health_condition} 
                icon="favorite" 
                color={getHealthColor(turtleMeta.health_condition)} 
              />
            </div>
          </div>
        </section>

        {/* Current Identification Section */}
        <section className="bg-white dark:bg-[#1a232e] border border-slate-200 dark:border-[#283039] rounded-3xl overflow-hidden shadow-sm p-6 sm:p-8">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-teal-500 text-sm">label</span> Current Identification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <TagItem position="Front Left (FL)" data={turtleMeta.tags?.fl_l} />
                    <TagItem position="Front Right (FR)" data={turtleMeta.tags?.fl_r} />
                </div>
                <div className="space-y-4">
                    <TagItem position="Rear Left (RL)" data={turtleMeta.tags?.rr_l} />
                    <TagItem position="Rear Right (RR)" data={turtleMeta.tags?.rr_r} />
                </div>
            </div>
        </section>

        {/* Latest Measurements Section */}
        <section className="bg-white dark:bg-[#1a232e] border border-slate-200 dark:border-[#283039] rounded-3xl overflow-hidden shadow-sm p-6 sm:p-8">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-teal-500 text-sm">straighten</span> Latest Morphometrics (cm)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
               <SummaryStat label="SCL Max" value={turtleMeta.measurements?.sclMax} color="text-slate-900 dark:text-white" />
               <SummaryStat label="SCL Min" value={turtleMeta.measurements?.sclMin} color="text-slate-400" />
               <SummaryStat label="SC Width" value={turtleMeta.measurements?.scw} color="text-slate-400" />
               <SummaryStat label="CCL Max" value={turtleMeta.measurements?.cclMax} color="text-slate-900 dark:text-white" />
               <SummaryStat label="CCL Min" value={turtleMeta.measurements?.cclMin} color="text-slate-400" />
               <SummaryStat label="CC Width" value={turtleMeta.measurements?.ccw} color="text-slate-400" />
            </div>
            
            {(turtleMeta.measurements?.tailExtension || turtleMeta.measurements?.ventToTip || turtleMeta.measurements?.totalTail) && (
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5 grid grid-cols-3 gap-6">
                    <div className="text-center">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tail Ext.</p>
                        <p className="text-lg font-black text-amber-500">{turtleMeta.measurements?.tailExtension ?? '—'}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Vent to Tip</p>
                        <p className="text-lg font-black text-amber-500">{turtleMeta.measurements?.ventToTip ?? '—'}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Tail</p>
                        <p className="text-lg font-black text-amber-500">{turtleMeta.measurements?.totalTail ?? '—'}</p>
                    </div>
                </div>
            )}
        </section>

        {/* History Table */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span> Event & Measurement History
            </h3>
          </div>
          
          <div className="bg-white dark:bg-[#1a232e] border border-slate-200 dark:border-[#283039] rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#151c26] border-b border-slate-200 dark:border-[#283039]">
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Date / Type</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Location</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Observer</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#283039]">
                  {events.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500 text-xs uppercase font-bold tracking-widest">
                            No events recorded yet.
                        </td>
                    </tr>
                  ) : (
                    events.map((event) => (
                        <tr 
                        key={event.id} 
                        onClick={() => setSelectedEvent(event)}
                        className="hover:bg-slate-50/50 dark:hover:bg-primary/5 transition-colors group cursor-pointer"
                        >
                        <td className="px-6 py-5">
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{event.date}</div>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest bg-teal-500/10 text-teal-500">
                            {event.type.replace('_', ' ')}
                            </span>
                        </td>
                        <td className="px-6 py-5">
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{event.location}</div>
                        </td>
                        <td className="px-6 py-5">
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{event.observer}</div>
                        </td>
                        <td className="px-6 py-5 text-right">
                            <button className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-xl">open_in_new</span>
                            </button>
                        </td>
                        </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Observation Notes Timeline */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="space-y-6">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">notes</span> Qualitative Notes Overview
              </h4>
              <div className="space-y-4">
                {events.filter(e => e.notes).length === 0 ? (
                    <p className="text-slate-500 text-xs italic">No notes available.</p>
                ) : (
                    events.filter(e => e.notes).map((event) => (
                    <div key={event.id} className="p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl">
                        <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">{event.date}</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed italic">"{event.notes}"</p>
                    </div>
                    ))
                )}
              </div>
           </div>
           
           <div className="bg-primary/5 border border-primary/10 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-primary text-5xl mb-4">analytics</span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Population Analytics</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6">Historical growth patterns and reproductive success for individual <span className="text-primary font-bold">{currentTagId}</span> are available in the advanced registry.</p>
              <button className="px-8 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                Export Life-History PDF
              </button>
           </div>
        </section>
      </main>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedEvent(null)}></div>
          <div className="relative bg-white dark:bg-[#111c26] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <header className="p-8 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-black text-xl uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-3xl">label</span> 
                  {selectedEvent.type.replace('_', ' ')} RECORD
                </h3>
                <p className="text-[10px] font-black text-slate-500 uppercase mt-2 tracking-widest">
                  {selectedEvent.date} • {selectedEvent.location} • OBS: {selectedEvent.observer}
                </p>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-3 text-slate-500 hover:text-white hover:bg-white/5 rounded-full transition-all">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
              
              {/* Measurements Section */}
              <section>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-6">
                  <span className="w-6 h-px bg-slate-700"></span> Morphometrics (cm)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                  <SummaryStat label="SCL Max" value={selectedEvent.measurements.sclMax} color="text-slate-900 dark:text-white" />
                  <SummaryStat label="SCL Min" value={selectedEvent.measurements.sclMin} color="text-slate-500 dark:text-slate-300" />
                  <SummaryStat label="SC Width" value={selectedEvent.measurements.scw} color="text-slate-500 dark:text-slate-300" />
                  <SummaryStat label="CCL Max" value={selectedEvent.measurements.cclMax} color="text-slate-900 dark:text-white" />
                  <SummaryStat label="CCL Min" value={selectedEvent.measurements.cclMin} color="text-slate-500 dark:text-slate-300" />
                  <SummaryStat label="CC Width" value={selectedEvent.measurements.ccw} color="text-slate-500 dark:text-slate-300" />
                  <SummaryStat label="Tail Ext." value={selectedEvent.measurements.tailExtension} color="text-amber-400" />
                  <SummaryStat label="Vent-Tip" value={selectedEvent.measurements.ventToTip} color="text-amber-400" />
                  <SummaryStat label="Total Tail" value={selectedEvent.measurements.totalTail} color="text-amber-400" />
                </div>
              </section>

              {/* Tags Section */}
              <section>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-6">
                  <span className="w-6 h-px bg-slate-700"></span> Flipper Tags & Identification
                </h4>
                <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm p-6">
                  {selectedEvent.tags ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <TagItem position="Front Left (FL)" data={selectedEvent.tags.fl_l} />
                          <TagItem position="Front Right (FR)" data={selectedEvent.tags.fl_r} />
                        </div>
                        <div className="space-y-4">
                          <TagItem position="Rear Left (RL)" data={selectedEvent.tags.rr_l} />
                          <TagItem position="Rear Right (RR)" data={selectedEvent.tags.rr_r} />
                        </div>
                      </div>
                      
                      {/* Microchip Section */}
                      {selectedEvent.tags.microchip && (
                         <div className="pt-6 border-t border-slate-200 dark:border-white/10 mt-2">
                           <h5 className="text-[9px] font-black text-primary uppercase tracking-widest mb-4">Microchip (PIT)</h5>
                           <div className="flex gap-8 bg-primary/5 p-4 rounded-xl border border-primary/10">
                              <div>
                                <span className="block text-[8px] uppercase font-black text-slate-500 tracking-widest mb-1">Number</span>
                                <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tracking-wider">{selectedEvent.tags.microchip.number}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] uppercase font-black text-slate-500 tracking-widest mb-1">Location</span>
                                <span className="font-bold text-sm text-slate-900 dark:text-white">{selectedEvent.tags.microchip.location}</span>
                              </div>
                           </div>
                         </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-slate-500 italic">No tag data recorded for this event.</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Notes Section */}
              <section>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <span className="w-6 h-px bg-slate-700"></span> Event Notes
                </h4>
                <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                   <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">"{selectedEvent.notes || 'No notes available.'}"</p>
                </div>
              </section>

            </div>

            <footer className="p-6 bg-slate-50 dark:bg-white/5 border-t border-slate-200 dark:border-white/5 flex justify-end shrink-0">
              <button onClick={() => setSelectedEvent(null)} className="px-8 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                Close Details
              </button>
            </footer>

          </div>
        </div>
      )}

      <footer className="p-8 border-t border-slate-200 dark:border-white/5 flex flex-col items-center justify-center gap-6 bg-background-light dark:bg-background-dark">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 hover:text-primary dark:hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5 group shadow-sm"
        >
          <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
          Return to Records List
        </button>
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Archelon Greek Regional Registry • Data Node {id}</p>
      </footer>
    </div>
  );
};

const ProfileItem: React.FC<{ label: string; value: string; icon: string; color?: string }> = ({ label, value, icon, color = "text-slate-900 dark:text-white" }) => (
  <div className="flex gap-3 items-center">
    <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-lg">{icon}</span>
    <div className="flex flex-col">
      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">{label}</span>
      <span className={`text-sm font-bold ${color} truncate`}>{value}</span>
    </div>
  </div>
);

const SummaryStat: React.FC<{ label: string; value: number | undefined; color: string }> = ({ label, value, color }) => (
  <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl flex flex-col items-center text-center h-full justify-center">
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 leading-tight">{label}</p>
    <p className={`text-xl font-black ${color}`}>{value ?? '—'}</p>
  </div>
);

const TagItem: React.FC<{ position: string; data: TagData | undefined }> = ({ position, data }) => (
  <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-2 last:border-0">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{position}</span>
    <div className="text-right">
       <span className={`block text-sm font-mono font-bold ${data?.id ? 'text-primary' : 'text-slate-600 dark:text-slate-400'}`}>{data?.id || 'N/A'}</span>
       {data?.address && <span className="block text-[8px] font-black text-slate-500 uppercase tracking-wider">{data.address}</span>}
    </div>
  </div>
);

export default TurtleDetails;
