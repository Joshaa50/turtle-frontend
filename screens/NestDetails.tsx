
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
  relocationReason?: string;
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
  startTime: string;
  endTime: string;
  totalEggs: number;
  hatched: number;
  hatchedDetails: StageDetails;
  eggsReburied: number;
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

const formatCoord = (val: any) => {
  if (val === undefined || val === null || val === '') return '—';
  const str = String(val);
  const match = str.match(/-?\d+\.\d+/);
  if (match) {
    return parseFloat(match[0]).toFixed(5);
  }
  return str;
};

const NestDetails: React.FC<NestDetailsProps> = ({ id, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [nest, setNest] = useState<NestData | null>(null);
  const [events, setEvents] = useState<NestEventData[]>([]);
  const [selectedReport, setSelectedReport] = useState<InventoryRecord | null>(null);
  const [selectedEmergence, setSelectedEmergence] = useState<NestEventData | null>(null);
  const [isEditingEmergence, setIsEditingEmergence] = useState(false);
  const [emergenceEditForm, setEmergenceEditForm] = useState<Partial<NestEventData>>({});
  const [isSavingEmergence, setIsSavingEmergence] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<NestData>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingInventory, setIsEditingInventory] = useState(false);
  const [inventoryEditForm, setInventoryEditForm] = useState<Partial<NestEventData>>({});
  const [isSavingInventory, setIsSavingInventory] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const nestResponse = await DatabaseConnection.getNest(id);
        const eventsResponse = await DatabaseConnection.getNestEvents(id);
        
        if (nestResponse && nestResponse.nest) {
          setNest(nestResponse.nest);
          setEditForm(nestResponse.nest);
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

  const handleSaveEdit = async () => {
    if (!nest || !nest.id) {
      console.error("Cannot update nest: Missing nest ID");
      return;
    }
    setIsSaving(true);
    try {
      await DatabaseConnection.updateNest(nest.id, editForm);
      const nestResponse = await DatabaseConnection.getNest(nest.nest_code);
      if (nestResponse && nestResponse.nest) {
        setNest(nestResponse.nest);
        setEditForm(nestResponse.nest);
      }
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating nest:", error);
      alert("Failed to update nest details.");
    } finally {
      setIsSaving(false);
    }
  };

  // Transform Data for View
  const viewData = useMemo(() => {
    if (!nest) return null;

    const discoveryDate = new Date(nest.date_found);
    const discoveryDateStr = discoveryDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // 1. Determine Site Data (Current)
    // The 'nest' object holds the CURRENT data (whether relocated or not).
    
    let relocationReason: string | undefined;
    if (nest.relocated && nest.notes) {
        const match = nest.notes.match(/Relocation Reason: (.*?)(?:\.|$)/);
        relocationReason = match ? match[1] : nest.notes;
    }

    const siteDetails: SiteData = {
        date: discoveryDateStr,
        gps: `${formatCoord(nest.gps_lat)}, ${formatCoord(nest.gps_long)}`,
        depth_h: `${nest.depth_top_egg_h || '?'}cm`,
        depth_H: nest.depth_bottom_chamber_h ? `${nest.depth_bottom_chamber_h}cm` : '—',
        width_w: nest.width_w ? `${nest.width_w}cm` : '—',
        distToSea_S: `${Math.round(nest.distance_to_sea_s)}m`,
        landmark: nest.beach || 'Unknown',
        relocationReason
    };

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
            const emerged = (e.tracks_to_sea || 0) + (e.tracks_lost || 0);
            desc = `${emerged} hatchling${emerged !== 1 ? 's' : ''} emerged.`;
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
    const today = new Date();
    const incubationDays = nest.status === 'hatched' && timeline.length > 1 
      ? timeline[timeline.length - 1].dayCount 
      : Math.floor((today.getTime() - discoveryDate.getTime()) / (1000 * 60 * 60 * 24));

    // 4. Triangulation
    const triangulationPoints: TriangulationPoint[] = [];
    if (nest.tri_tl_lat) {
        triangulationPoints.push({
            desc: nest.tri_tl_desc || 'Point A',
            dist: `${nest.tri_tl_distance}m`,
            lat: formatCoord(nest.tri_tl_lat),
            lng: formatCoord(nest.tri_tl_long)
        });
    }
    if (nest.tri_tr_lat) {
        triangulationPoints.push({
            desc: nest.tri_tr_desc || 'Point B',
            dist: `${nest.tri_tr_distance}m`,
            lat: formatCoord(nest.tri_tr_lat),
            lng: formatCoord(nest.tri_tr_long)
        });
    }

    return {
        siteDetails,
        timeline,
        stats: { totalEggs, incubationDays },
        triangulation: triangulationPoints
    };
  }, [nest, events]);

  // Helper to map DB event to Inventory Record for Modal
  const mapEventToInventory = (e: NestEventData): InventoryRecord => {
    const formatTime = (timeStr: string | undefined) => {
      if (!timeStr) return '—';
      return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    return {
        id: String(e.id || 'N/A'),
        date: e.start_time ? new Date(e.start_time).toLocaleDateString() : 'N/A',
        type: e.event_type,
        excavator: e.observer || 'Unknown',
        startTime: formatTime(e.start_time),
        endTime: formatTime(e.end_time),
        totalEggs: e.total_eggs ?? ((e.hatched_count || 0) + (e.non_viable_count || 0) + (e.eye_spot_count || 0) + (e.early_count || 0) + (e.middle_count || 0) + (e.late_count || 0) + (e.piped_dead_count || 0) + (e.piped_alive_count || 0)),
        hatched: e.hatched_count || 0,
        hatchedDetails: { count: e.hatched_count || 0, black: e.hatched_black_fungus_count || 0, pink: e.hatched_pink_bacteria_count || 0, green: e.hatched_green_bacteria_count || 0 },
        eggsReburied: e.eggs_reburied || 0,
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
    if (event.rawEvent) {
      if (event.type.includes('INVENTORY') || event.type === 'TOP_EGG') {
        setSelectedReport(mapEventToInventory(event.rawEvent));
        setInventoryEditForm(event.rawEvent);
        setIsEditingInventory(false);
      } else if (event.type === 'EMERGENCE' || event.type === 'HATCHING') {
        setSelectedEmergence(event.rawEvent);
        setEmergenceEditForm(event.rawEvent);
        setIsEditingEmergence(false);
      }
    }
  };

  const handleSaveEmergence = async () => {
    if (!selectedEmergence || selectedEmergence.id === undefined || !nest || nest.id === undefined) return;
    setIsSavingEmergence(true);
    try {
      const payload = { 
        ...emergenceEditForm, 
        nest_id: nest.id 
      };
      await DatabaseConnection.updateNestEvent(selectedEmergence.id, payload);
      
      // Refresh both events and nest data
      // Note: 'id' from useParams is the nest_code
      const [eventsResponse, nestResponse] = await Promise.all([
        DatabaseConnection.getNestEvents(id),
        DatabaseConnection.getNest(nest.nest_code)
      ]);

      if (Array.isArray(eventsResponse)) {
        setEvents(eventsResponse);
        const updatedEvent = eventsResponse.find(e => e.id === selectedEmergence.id);
        if (updatedEvent) {
          setSelectedEmergence(updatedEvent);
          setEmergenceEditForm(updatedEvent);
        }
      }

      if (nestResponse && nestResponse.nest) {
        setNest(nestResponse.nest);
        setEditForm(nestResponse.nest);
      }

      setIsEditingEmergence(false);
    } catch (error) {
      console.error("Error updating emergence event:", error);
      alert("Failed to update emergence data.");
    } finally {
      setIsSavingEmergence(false);
    }
  };

  const getInventoryValidationErrors = (form: Partial<NestEventData>, report: InventoryRecord | null): string[] => {
    if (!report) return [];
    const errors: string[] = [];

    // Validate Total Eggs
    const totalEggs = form.total_eggs ?? report.totalEggs;
    const hatched = form.hatched_count ?? 0;
    const reburied = form.eggs_reburied ?? 0;
    
    const opened = (form.non_viable_count || 0) + 
                   (form.eye_spot_count || 0) + 
                   (form.early_count || 0) + 
                   (form.middle_count || 0) + 
                   (form.late_count || 0) + 
                   (form.piped_dead_count || 0);

    const calculatedTotal = hatched + opened + reburied;

    if (totalEggs !== calculatedTotal) {
      errors.push(`Total Eggs (${totalEggs}) must equal Hatched (${hatched}) + Opened (${opened}) + Reburied (${reburied}). Current sum: ${calculatedTotal}`);
    }

    // Validate Fungus/Bacteria Counts
    const stages = [
      { name: 'Hatched', count: form.hatched_count, black: form.hatched_black_fungus_count, pink: form.hatched_pink_bacteria_count, green: form.hatched_green_bacteria_count },
      { name: 'No Visible', count: form.non_viable_count, black: form.non_viable_black_fungus_count, pink: form.non_viable_pink_bacteria_count, green: form.non_viable_green_bacteria_count },
      { name: 'Eye Spot', count: form.eye_spot_count, black: form.eye_spot_black_fungus_count, pink: form.eye_spot_pink_bacteria_count, green: form.eye_spot_green_bacteria_count },
      { name: 'Early', count: form.early_count, black: form.early_black_fungus_count, pink: form.early_pink_bacteria_count, green: form.early_green_bacteria_count },
      { name: 'Middle', count: form.middle_count, black: form.middle_black_fungus_count, pink: form.middle_pink_bacteria_count, green: form.middle_green_bacteria_count },
      { name: 'Late', count: form.late_count, black: form.late_black_fungus_count, pink: form.late_pink_bacteria_count, green: form.late_green_bacteria_count },
      { name: 'Pipped Dead', count: form.piped_dead_count, black: form.piped_dead_black_fungus_count, pink: form.piped_dead_pink_bacteria_count, green: form.piped_dead_green_bacteria_count },
    ];

    for (const stage of stages) {
      const count = stage.count || 0;
      if ((stage.black || 0) > count) {
        errors.push(`${stage.name}: Black Fungus (${stage.black}) > Count (${count})`);
      }
      if ((stage.pink || 0) > count) {
        errors.push(`${stage.name}: Pink Bacteria (${stage.pink}) > Count (${count})`);
      }
      if ((stage.green || 0) > count) {
        errors.push(`${stage.name}: Green Bacteria (${stage.green}) > Count (${count})`);
      }
    }

    return errors;
  };

  const handleSaveInventory = async () => {
    if (!selectedReport || !selectedReport.id || !nest || !nest.id) return;

    const errors = getInventoryValidationErrors(inventoryEditForm, selectedReport);
    if (errors.length > 0) {
      alert(`Validation Errors:\n- ${errors.join('\n- ')}`);
      return;
    }

    setIsSavingInventory(true);
    try {
      const payload = {
        ...inventoryEditForm,
        nest_id: nest.id,
      };
      await DatabaseConnection.updateNestEvent(parseInt(selectedReport.id), payload);
      
      // Construct the updated event object from our form data
      const updatedEvent: NestEventData = {
        ...inventoryEditForm,
        ...payload,
        id: parseInt(selectedReport.id)
      };

      // Update local events list immediately
      setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
      
      // Update the selected report view with new data
      setSelectedReport(mapEventToInventory(updatedEvent));
      setInventoryEditForm(updatedEvent);
      
      setIsEditingInventory(false);

      // Background refresh to ensure consistency, but don't overwrite selectedReport
      // to avoid reverting to stale data if the API read is lagged
      const [eventsResponse, nestResponse] = await Promise.all([
        DatabaseConnection.getNestEvents(id),
        DatabaseConnection.getNest(nest.nest_code)
      ]);

      if (Array.isArray(eventsResponse)) {
        setEvents(eventsResponse);
      }

      if (nestResponse && nestResponse.nest) {
        setNest(nestResponse.nest);
        setEditForm(nestResponse.nest);
      }

    } catch (error) {
      console.error("Error updating inventory event:", error);
      alert("Failed to update inventory data.");
    } finally {
      setIsSavingInventory(false);
    }
  };

  const handleInventoryInputChange = (field: keyof NestEventData, value: string) => {
    const numValue = parseInt(value, 10);
    const newForm = {
      ...inventoryEditForm,
      [field]: isNaN(numValue) ? undefined : numValue
    };
    setInventoryEditForm(newForm);
    setValidationErrors(getInventoryValidationErrors(newForm, selectedReport));
  };

  const handleNestInputChange = (field: keyof NestData, value: string, isInt: boolean = false) => {
    const numValue = isInt ? parseInt(value, 10) : parseFloat(value);
    setEditForm(prev => ({
      ...prev,
      [field]: isNaN(numValue) ? undefined : numValue
    }));
  };

  const handleEmergenceInputChange = (field: keyof NestEventData, value: string, isNumeric: boolean = false) => {
    if (isNumeric) {
      const numValue = parseInt(value, 10);
      setEmergenceEditForm(prev => ({
        ...prev,
        [field]: isNaN(numValue) ? undefined : numValue
      }));
    } else {
      setEmergenceEditForm(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleTriangulationInputChange = (field: keyof NestData, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatDisplayValue = (value: any, unit: string = '') => {
    if (value === null || value === undefined || value === '' || isNaN(value)) {
      return '—';
    }
    return `${value}${unit}`;
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
      return <div className="p-10 text-slate-900 dark:text-white">Nest not found.</div>;
  }

  const successRate = selectedReport ? ((selectedReport.hatched / selectedReport.totalEggs) * 100).toFixed(1) : (nest.current_num_eggs && nest.total_num_eggs && nest.total_num_eggs > 0 ? (((nest.total_num_eggs - nest.current_num_eggs)/nest.total_num_eggs)*100).toFixed(1) : 'N/A');

  return (
    <div className="flex flex-col min-h-screen font-display text-slate-900 dark:text-white bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-white/10 bg-background-light dark:bg-[#111418] sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto pl-16 pr-6 lg:pl-8 h-16 flex items-center justify-between relative">
          <div className="flex items-center gap-4">
            {/* Left side empty or for other elements */}
          </div>
          
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <h1 className="text-lg font-black tracking-tighter uppercase leading-none text-slate-900 dark:text-white">{nest.nest_code}</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 text-white text-[10px] font-black rounded uppercase tracking-widest shadow-lg ${nest.status === 'hatched' ? 'bg-emerald-500 shadow-emerald-500/20' : nest.status === 'hatching' ? 'bg-amber-500 shadow-amber-500/20' : 'bg-primary shadow-primary/20'}`}>
              {nest.status}
            </span>
          </div>
        </div>
      </header>

      {/* Hero Summary Bar */}
      <div className="bg-white dark:bg-[#111418] border-b border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex flex-wrap items-center justify-start gap-x-12 gap-y-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">monitoring</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Success Rate</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">{successRate}{successRate !== 'N/A' && '%'}</span>
              </div>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">egg</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Total Eggs</span>
                {isEditing ? (
                  <input 
                    type="number"
                    value={isNaN(editForm.total_num_eggs) ? "" : editForm.total_num_eggs ?? ""}
                    onChange={(e) => handleNestInputChange('total_num_eggs', e.target.value, true)}
                    className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm font-bold w-20 outline-none focus:ring-1 focus:ring-primary"
                  />
                ) : (
                  <span className="text-xl font-black text-slate-900 dark:text-white">{viewData.stats.totalEggs || '—'}</span>
                )}
              </div>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">timer</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Incubation</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">{viewData.stats.incubationDays || '—'} <span className="text-xs text-slate-500 font-bold">Days</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-6 lg:gap-x-12">
          
          {/* Main Content Area */}
          <div className="lg:col-span-8">
            


          </div>

          {/* Right Column: Site Records & Timeline */}
          <div className="lg:col-span-4">
            
            {/* Lifecycle History */}
            <section className="space-y-1 mb-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">event_note</span> Lifecycle History
              </h3>
              <div className="relative pl-8 space-y-10 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-white/10">
                {viewData.timeline.map((event, idx) => (
                  <div 
                    key={idx} 
                    className={`relative group transition-all duration-200 ${event.rawEvent ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 p-3 -m-3 rounded-2xl' : ''}`} 
                    onClick={() => openInventoryModal(event)}
                  >
                    <div className={`absolute -left-[21px] top-4 size-3 rounded-full ring-4 ring-background-light dark:ring-background-dark border-2 border-background-light dark:border-background-dark ${
                      event.type === 'DISCOVERY' ? 'bg-primary' : 
                      event.type.includes('INVENTORY') ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}></div>
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{event.date}</span>
                        {event.dayCount > 0 && <span className="text-[8px] font-black bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-slate-400">Day {event.dayCount}</span>}
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-slate-200 mt-0.5 uppercase tracking-tighter">{event.label}</span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-medium">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Site Data Cards (Original & Relocated) */}
            <div className="space-y-8">
              {/* Nest Details */}
              <section className="bg-white dark:bg-[#1a232e] border border-slate-200 dark:border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nest Details</h3>
                  {nest.relocated && (
                    <span className="text-[8px] font-black text-slate-900 dark:text-white px-2 py-0.5 bg-amber-500 rounded uppercase">Relocated</span>
                  )}
                </div>
                <div className="p-8 space-y-8">
                  {viewData.siteDetails.relocationReason && (
                    <div className="pb-6 border-b border-slate-100 dark:border-white/5">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-2">Reason for Relocation</p>
                      <p className="text-xs text-amber-500 font-medium italic leading-relaxed">"{viewData.siteDetails.relocationReason}"</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                    <DataBit 
                      label="Depth (h)" 
                      value={isEditing ? (
                        <input 
                          type="number"
                          value={isNaN(editForm.depth_top_egg_h) ? "" : editForm.depth_top_egg_h ?? ""}
                          onChange={(e) => handleNestInputChange('depth_top_egg_h', e.target.value)}
                          className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm font-bold w-full outline-none focus:ring-1 focus:ring-primary"
                        />
                      ) : viewData.siteDetails.depth_h} 
                    />
                    <DataBit 
                      label="Depth (H)" 
                      value={isEditing ? (
                        <input 
                          type="number"
                          value={isNaN(editForm.depth_bottom_chamber_h) ? "" : editForm.depth_bottom_chamber_h ?? ""}
                          onChange={(e) => handleNestInputChange('depth_bottom_chamber_h', e.target.value)}
                          className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm font-bold w-full outline-none focus:ring-1 focus:ring-primary"
                        />
                      ) : viewData.siteDetails.depth_H} 
                    />
                    <DataBit 
                      label="Width (w)" 
                      value={isEditing ? (
                        <input 
                          type="number"
                          value={isNaN(editForm.width_w) ? "" : editForm.width_w ?? ""}
                          onChange={(e) => handleNestInputChange('width_w', e.target.value)}
                          className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm font-bold w-full outline-none focus:ring-1 focus:ring-primary"
                        />
                      ) : viewData.siteDetails.width_w} 
                    />
                    <DataBit 
                      label="To Sea (S)" 
                      value={isEditing ? (
                        <input 
                          type="number"
                          value={isNaN(editForm.distance_to_sea_s) ? "" : editForm.distance_to_sea_s ?? ""}
                          onChange={(e) => handleNestInputChange('distance_to_sea_s', e.target.value)}
                          className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm font-bold w-full outline-none focus:ring-1 focus:ring-primary"
                        />
                      ) : viewData.siteDetails.distToSea_S} 
                    />
                  </div>
                  <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-2">GPS Location</p>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={isNaN(editForm.gps_lat) ? "" : editForm.gps_lat ?? ""}
                          onChange={(e) => handleNestInputChange('gps_lat', e.target.value)}
                          placeholder="Lat"
                          className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm font-mono font-bold w-full outline-none focus:ring-1 focus:ring-primary"
                        />
                        <input 
                          type="text"
                          value={isNaN(editForm.gps_long) ? "" : editForm.gps_long ?? ""}
                          onChange={(e) => handleNestInputChange('gps_long', e.target.value)}
                          placeholder="Lng"
                          className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm font-mono font-bold w-full outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    ) : (
                      <p className="text-base font-mono font-bold text-primary">{viewData.siteDetails.gps}</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Triangulation Verification Section - Moved to Right Column */}
              <section className="bg-white dark:bg-[#1a232e] border border-slate-200 dark:border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Triangulation Points</h3>
                  <span className="material-symbols-outlined text-slate-500 text-sm">explore</span>
                </div>
                <div className="p-6 space-y-8">
                  {viewData.triangulation.length > 0 ? viewData.triangulation.map((point, idx) => (
                    <div key={idx} className="pb-8 border-b border-slate-100 dark:border-white/5 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center mb-4">
                        <span className="px-2 py-1 bg-primary/10 text-primary text-[9px] font-black uppercase rounded tracking-widest">Point 0{idx+1}</span>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-xs text-primary">straighten</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input 
                                type="number"
                                step="0.01"
                                value={isNaN(editForm[idx === 0 ? 'tri_tl_distance' : 'tri_tr_distance']) ? "" : editForm[idx === 0 ? 'tri_tl_distance' : 'tri_tr_distance'] ?? ""}
                                onChange={(e) => handleNestInputChange(idx === 0 ? 'tri_tl_distance' : 'tri_tr_distance', e.target.value)}
                                className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-2 py-0.5 text-[10px] font-bold w-16 outline-none focus:ring-1 focus:ring-primary"
                              />
                              <span className="text-[10px] text-slate-500">m</span>
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest">Distance: <span className="text-slate-900 dark:text-white text-xs">{point.dist}</span></p>
                          )}
                        </div>
                      </div>
                      
                      {isEditing ? (
                        <input 
                          type="text"
                          value={editForm[idx === 0 ? 'tri_tl_desc' : 'tri_tr_desc'] || ''}
                          onChange={(e) => handleTriangulationInputChange(idx === 0 ? 'tri_tl_desc' : 'tri_tr_desc', e.target.value)}
                          placeholder="Point Description"
                          className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-3 py-2 text-sm font-black w-full outline-none focus:ring-1 focus:ring-primary mb-4"
                        />
                      ) : (
                        <h4 className="text-sm font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                          <span className="size-1.5 bg-primary rounded-full"></span>
                          {point.desc}
                        </h4>
                      )}

                      <div className="grid grid-cols-1 gap-3">
                        <div className="bg-slate-50 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-100 dark:border-white/5">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Latitude</p>
                          {isEditing ? (
                            <input 
                              type="text"
                              value={isNaN(editForm[idx === 0 ? 'tri_tl_lat' : 'tri_tr_lat']) ? "" : editForm[idx === 0 ? 'tri_tl_lat' : 'tri_tr_lat'] ?? ""}
                              onChange={(e) => handleNestInputChange(idx === 0 ? 'tri_tl_lat' : 'tri_tr_lat', e.target.value)}
                              className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm font-mono font-bold w-full outline-none focus:ring-1 focus:ring-primary"
                            />
                          ) : (
                            <p className="text-lg font-mono font-black text-primary tracking-tight">{point.lat}</p>
                          )}
                        </div>
                        <div className="bg-slate-50 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-100 dark:border-white/5">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Longitude</p>
                          {isEditing ? (
                            <input 
                              type="text"
                              value={isNaN(editForm[idx === 0 ? 'tri_tl_long' : 'tri_tr_long']) ? "" : editForm[idx === 0 ? 'tri_tl_long' : 'tri_tr_long'] ?? ""}
                              onChange={(e) => handleNestInputChange(idx === 0 ? 'tri_tl_long' : 'tri_tr_long', e.target.value)}
                              className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm font-mono font-bold w-full outline-none focus:ring-1 focus:ring-primary"
                            />
                          ) : (
                            <p className="text-lg font-mono font-black text-primary tracking-tight">{point.lng}</p>
                          )}
                        </div>
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

      {/* Fixed Bottom Action Bar */}
      <footer className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white/80 dark:bg-[#111418]/80 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 p-4 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <button onClick={onBack} className="p-3 bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all flex items-center gap-2">
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-4">
            {isEditing ? (
              <>
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm(nest);
                  }}
                  className="px-6 py-3 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-8 py-3 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2 min-w-[140px] justify-center"
                >
                  {isSaving ? (
                    <>
                      <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">save</span>
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-8 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Edit Nest Details
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Report View Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !isEditingInventory && setSelectedReport(null)}></div>
          <div className="relative bg-white dark:bg-[#111c26] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <header className="p-8 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex items-center justify-between">
              <div>
                <h3 className="font-black text-xl uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-3xl">analytics</span> 
                  {isEditingInventory ? 'Edit Inventory Data' : `${nest?.nest_code} : ${selectedReport.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(' Inventory', '')}`}
                </h3>
                <div className="flex items-center gap-6 mt-2">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">DATE: <span className="text-slate-800 dark:text-slate-300">{selectedReport.date}</span></div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OBSERVER: <span className="text-slate-800 dark:text-slate-300">{selectedReport.excavator}</span></div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">START: <span className="text-slate-800 dark:text-slate-300">{selectedReport.startTime}</span></div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">END: <span className="text-slate-800 dark:text-slate-300">{selectedReport.endTime}</span></div>
                </div>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
              {/* Main Stats */}
              {/* Top Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {/* Total Eggs */}
                <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-6 text-center border border-slate-200 dark:border-white/10">
                  <p className="text-4xl font-black text-slate-900 dark:text-white">
                    {selectedReport.totalEggs}
                  </p>
                  <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mt-2">Total Eggs</p>
                </div>

                {/* Hatched */}
                <div className="bg-primary/5 rounded-2xl p-6 text-center border border-primary/20">
                  {isEditingInventory ? (
                    <input type="number" value={isNaN(inventoryEditForm.hatched_count) ? "" : inventoryEditForm.hatched_count ?? ''} onChange={(e) => handleInventoryInputChange('hatched_count', e.target.value)} className="bg-transparent text-4xl font-black text-primary w-full text-center outline-none ring-1 ring-primary/20 rounded-lg" />
                  ) : (
                    <p className="text-4xl font-black text-primary">{selectedReport.hatched}</p>
                  )}
                  <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mt-2">Hatched</p>
                </div>

                {/* Opened */}
                <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-6 text-center border border-slate-200 dark:border-white/10">
                  <p className="text-4xl font-black text-slate-900 dark:text-white">
                    {(selectedReport.noVisible.count || 0) + (selectedReport.eyeSpot.count || 0) + (selectedReport.early.count || 0) + (selectedReport.middle.count || 0) + (selectedReport.late.count || 0) + (selectedReport.pippedDead.count || 0)}
                  </p>
                  <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mt-2">Opened</p>
                </div>

                {/* Reburied */}
                <div className="bg-amber-500/5 rounded-2xl p-6 text-center border border-amber-500/20">
                  <div className="flex flex-col items-center justify-center">
                    {isEditingInventory ? (
                       <input type="number" value={isNaN(inventoryEditForm.eggs_reburied) ? "" : inventoryEditForm.eggs_reburied ?? ''} onChange={(e) => handleInventoryInputChange('eggs_reburied', e.target.value)} className="bg-transparent text-4xl font-black text-amber-500 w-24 text-center outline-none ring-1 ring-amber-500/20 rounded-lg" />
                    ) : (
                      <p className="text-4xl font-black text-amber-500">{selectedReport.eggsReburied}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                        ({isEditingInventory ? (
                          <input type="number" value={isNaN(inventoryEditForm.piped_alive_count) ? "" : inventoryEditForm.piped_alive_count ?? ''} onChange={(e) => handleInventoryInputChange('piped_alive_count', e.target.value)} className="bg-transparent text-xs font-bold text-amber-600 dark:text-amber-400 w-8 text-center outline-none ring-1 ring-amber-500/20 rounded-lg" />
                        ) : (
                          selectedReport.pippedAlive
                        )} Pipped Alive)
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mt-2">Reburied</p>
                </div>
              </div>

              {/* Embryonic Stages Breakdown Table */}
              <section className="space-y-6">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-8 h-px bg-slate-300 dark:bg-slate-800"></span> Embryonic Breakdown
                </h4>
                <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm w-full">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/5">
                        <tr>
                          <th className="px-0.5 py-2 w-16 text-[9px] font-black uppercase text-slate-500 tracking-widest sticky left-0 z-20 bg-slate-50 dark:bg-[#111c26] text-center">Stage</th>
                          <th className="px-0.5 py-2 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Count</th>
                          <th className="px-0.5 py-2 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Black<br/>Fungus</th>
                          <th className="px-0.5 py-2 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Pink<br/>Bact.</th>
                          <th className="px-0.5 py-2 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Green<br/>Bact.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {[
                          { label: "Hatched", key: 'hatched', data: selectedReport.hatchedDetails },
                          { label: <>No<br/>Visible</>, key: 'non_viable', data: selectedReport.noVisible },
                          { label: <>Eye<br/>Spot</>, key: 'eye_spot', data: selectedReport.eyeSpot },
                          { label: "Early", key: 'early', data: selectedReport.early },
                          { label: "Middle", key: 'middle', data: selectedReport.middle },
                          { label: "Late", key: 'late', data: selectedReport.late },
                          { label: <>Pipped<br/>(Dead)</>, key: 'piped_dead', data: selectedReport.pippedDead }
                        ].map((stage, idx) => (
                          <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-primary/5 transition-colors">
                            <td className="px-0.5 py-2 w-16 sticky left-0 z-10 bg-white dark:bg-[#111c26] group-hover:bg-slate-50 dark:group-hover:bg-slate-800 text-center">
                              <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 capitalize leading-tight">{stage.label}</p>
                            </td>
                            <td className="px-0.5 py-2 text-center">
                              {isEditingInventory ? (
                                <input type="number" value={isNaN(inventoryEditForm[`${stage.key}_count`]) ? "" : inventoryEditForm[`${stage.key}_count`] ?? ''} onChange={(e) => handleInventoryInputChange(`${stage.key}_count` as keyof NestEventData, e.target.value)} className="bg-transparent text-sm font-mono font-bold text-slate-600 dark:text-slate-300 w-12 text-center outline-none ring-1 ring-slate-500/20 rounded-lg" />
                              ) : (
                                <span className="text-sm font-mono font-bold text-slate-600 dark:text-slate-300">{stage.data.count}</span>
                              )}
                            </td>
                            <td className="px-0.5 py-2 text-center">
                              {isEditingInventory ? (
                                <input type="number" value={isNaN(inventoryEditForm[`${stage.key}_black_fungus_count`]) ? "" : inventoryEditForm[`${stage.key}_black_fungus_count`] ?? ''} onChange={(e) => handleInventoryInputChange(`${stage.key}_black_fungus_count` as keyof NestEventData, e.target.value)} className="bg-transparent text-xs font-bold text-zinc-600 dark:text-zinc-400 w-12 text-center outline-none ring-1 ring-zinc-500/20 rounded-lg" />
                              ) : (
                                <span className={`text-xs font-bold ${stage.data.black > 0 ? 'text-zinc-600 dark:text-zinc-400' : 'text-slate-400 dark:text-slate-600 opacity-30'}`}>
                                  {stage.data.black}
                                </span>
                              )}
                            </td>
                            <td className="px-0.5 py-2 text-center">
                              {isEditingInventory ? (
                                <input type="number" value={isNaN(inventoryEditForm[`${stage.key}_pink_bacteria_count`]) ? "" : inventoryEditForm[`${stage.key}_pink_bacteria_count`] ?? ''} onChange={(e) => handleInventoryInputChange(`${stage.key}_pink_bacteria_count` as keyof NestEventData, e.target.value)} className="bg-transparent text-xs font-bold text-rose-500 dark:text-rose-400 w-12 text-center outline-none ring-1 ring-rose-500/20 rounded-lg" />
                              ) : (
                                <span className={`text-xs font-bold ${stage.data.pink > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-600 opacity-30'}`}>
                                  {stage.data.pink}
                                </span>
                              )}
                            </td>
                            <td className="px-0.5 py-2 text-center">
                              {isEditingInventory ? (
                                <input type="number" value={isNaN(inventoryEditForm[`${stage.key}_green_bacteria_count`]) ? "" : inventoryEditForm[`${stage.key}_green_bacteria_count`] ?? ''} onChange={(e) => handleInventoryInputChange(`${stage.key}_green_bacteria_count` as keyof NestEventData, e.target.value)} className="bg-transparent text-xs font-bold text-emerald-500 dark:text-emerald-400 w-12 text-center outline-none ring-1 ring-emerald-500/20 rounded-lg" />
                              ) : (
                                <span className={`text-xs font-bold ${stage.data.green > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-600 opacity-30'}`}>
                                  {stage.data.green}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* Hatchling Status (Alive & Dead) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Alive */}
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
                  <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">Hatchling Status (Alive)</p>
                  <div className="flex justify-around">
                    <div className="text-center">
                      {isEditingInventory ? (
                        <input type="number" value={isNaN(inventoryEditForm.alive_above) ? "" : inventoryEditForm.alive_above ?? ''} onChange={(e) => handleInventoryInputChange('alive_above', e.target.value)} className="bg-transparent text-4xl font-black text-emerald-500 w-24 text-center outline-none ring-1 ring-emerald-500/20 rounded-lg" />
                      ) : (
                        <p className="text-4xl font-black text-emerald-500">{selectedReport.aliveAbove}</p>
                      )}
                      <p className="text-[8px] uppercase font-black text-slate-500 tracking-widest mt-1">Above</p>
                    </div>
                    <div className="text-center">
                      {isEditingInventory ? (
                        <input type="number" value={isNaN(inventoryEditForm.alive_within) ? "" : inventoryEditForm.alive_within ?? ''} onChange={(e) => handleInventoryInputChange('alive_within', e.target.value)} className="bg-transparent text-4xl font-black text-emerald-500 w-24 text-center outline-none ring-1 ring-emerald-500/20 rounded-lg" />
                      ) : (
                        <p className="text-4xl font-black text-emerald-500">{selectedReport.aliveWithin}</p>
                      )}
                      <p className="text-[8px] uppercase font-black text-slate-500 tracking-widest mt-1">Within</p>
                    </div>
                  </div>
                </div>

                {/* Dead */}
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6">
                  <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-4">Hatchling Status (Dead)</p>
                  <div className="flex justify-around">
                    <div className="text-center">
                      {isEditingInventory ? (
                        <input type="number" value={isNaN(inventoryEditForm.dead_above) ? "" : inventoryEditForm.dead_above ?? ''} onChange={(e) => handleInventoryInputChange('dead_above', e.target.value)} className="bg-transparent text-4xl font-black text-rose-500 w-24 text-center outline-none ring-1 ring-rose-500/20 rounded-lg" />
                      ) : (
                        <p className="text-4xl font-black text-rose-500">{selectedReport.deadAbove}</p>
                      )}
                      <p className="text-[8px] uppercase font-black text-slate-500 tracking-widest mt-1">Above</p>
                    </div>
                    <div className="text-center">
                      {isEditingInventory ? (
                        <input type="number" value={isNaN(inventoryEditForm.dead_within) ? "" : inventoryEditForm.dead_within ?? ''} onChange={(e) => handleInventoryInputChange('dead_within', e.target.value)} className="bg-transparent text-4xl font-black text-rose-500 w-24 text-center outline-none ring-1 ring-rose-500/20 rounded-lg" />
                      ) : (
                        <p className="text-4xl font-black text-rose-500">{selectedReport.deadWithin}</p>
                      )}
                      <p className="text-[8px] uppercase font-black text-slate-500 tracking-widest mt-1">Within</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <footer className="p-6 bg-slate-50 dark:bg-white/5 border-t border-slate-200 dark:border-white/5 flex flex-col gap-4">
              {validationErrors.length > 0 && (
                <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl p-4">
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    Validation Errors
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {validationErrors.map((err, idx) => (
                      <li key={idx} className="text-xs text-rose-600 dark:text-rose-400 font-medium">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end gap-3">
              {isEditingInventory ? (
                <>
                  <button 
                    onClick={() => {
                      setIsEditingInventory(false);
                      setValidationErrors([]);
                    }}
                    disabled={isSavingInventory}
                    className="px-6 py-3 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveInventory}
                    disabled={isSavingInventory || validationErrors.length > 0}
                    className={`px-8 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2 min-w-[120px] justify-center ${validationErrors.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isSavingInventory ? (
                      <>
                        <span className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">save</span>
                        <span>Save</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setIsEditingInventory(true)}
                    className="px-6 py-3 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    Edit
                  </button>
                  <button 
                    onClick={() => setSelectedReport(null)} 
                    className="px-8 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    Close Report
                  </button>
                </>
              )}
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Emergence View Modal */}
      {selectedEmergence && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => { if (!isSavingEmergence) setSelectedEmergence(null); }}></div>
          <div className="relative bg-white dark:bg-[#111c26] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <header className="p-6 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">waves</span> 
                  {isEditingEmergence ? 'Edit Emergence Data' : 'Emergence Data'}
                </h3>
                <p className="text-[10px] font-black text-slate-500 uppercase mt-1 tracking-widest">
                  {selectedEmergence.event_type.replace('_', ' ')} • {selectedEmergence.start_time ? new Date(selectedEmergence.start_time).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <button 
                onClick={() => { if (!isSavingEmergence) setSelectedEmergence(null); }} 
                className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex flex-col items-center text-center">
                  <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2 leading-tight">Tracks to Sea</p>
                  {isEditingEmergence ? (
                    <input 
                      type="number"
                      value={isNaN(emergenceEditForm.tracks_to_sea) ? "" : emergenceEditForm.tracks_to_sea ?? ""}
                      onChange={(e) => handleEmergenceInputChange('tracks_to_sea', e.target.value, true)}
                      className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-3 py-2 text-2xl font-black text-emerald-500 w-full text-center outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <p className="text-4xl font-black text-emerald-500">{selectedEmergence.tracks_to_sea || 0}</p>
                  )}
                </div>
                <div className="p-6 bg-rose-500/5 border border-rose-500/20 rounded-2xl flex flex-col items-center text-center">
                  <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2 leading-tight">Tracks Lost</p>
                  {isEditingEmergence ? (
                    <input 
                      type="number"
                      value={isNaN(emergenceEditForm.tracks_lost) ? "" : emergenceEditForm.tracks_lost ?? ""}
                      onChange={(e) => handleEmergenceInputChange('tracks_lost', e.target.value, true)}
                      className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-3 py-2 text-2xl font-black text-rose-500 w-full text-center outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <p className="text-4xl font-black text-rose-500">{selectedEmergence.tracks_lost || 0}</p>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-xl">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Field Notes</p>
                {isEditingEmergence ? (
                  <textarea 
                    value={emergenceEditForm.notes || ''}
                    onChange={(e) => handleEmergenceInputChange('notes', e.target.value)}
                    className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-3 py-2 text-xs text-slate-600 dark:text-slate-300 w-full h-24 outline-none focus:ring-1 focus:ring-primary resize-none"
                    placeholder="Enter notes..."
                  />
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
                    {selectedEmergence.notes ? `"${selectedEmergence.notes}"` : 'No notes recorded.'}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <span>Observer</span>
                  <span className="text-slate-900 dark:text-white">{selectedEmergence.observer || 'Unknown'}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <span>Time</span>
                  <span className="text-slate-900 dark:text-white">
                    {selectedEmergence.start_time ? new Date(selectedEmergence.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </div>
              </div>
            </div>
            <footer className="p-6 bg-slate-50 dark:bg-white/5 border-t border-slate-200 dark:border-white/5 flex justify-end gap-3">
              {isEditingEmergence ? (
                <>
                  <button 
                    onClick={() => {
                      setIsEditingEmergence(false);
                      setEmergenceEditForm(selectedEmergence);
                    }}
                    disabled={isSavingEmergence}
                    className="px-6 py-3 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveEmergence}
                    disabled={isSavingEmergence}
                    className="px-8 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2 min-w-[120px] justify-center"
                  >
                    {isSavingEmergence ? (
                      <>
                        <span className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">save</span>
                        <span>Save</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setIsEditingEmergence(true)}
                    className="px-6 py-3 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    Edit
                  </button>
                  <button 
                    onClick={() => setSelectedEmergence(null)} 
                    className="px-8 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    Close
                  </button>
                </>
              )}
            </footer>
          </div>
        </div>
      )}

    </div>
  );
};

// Internal components
const DataBit: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-[8px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">{label}</p>
    <div className="text-base font-bold text-slate-900 dark:text-white leading-none">{value}</div>
  </div>
);

const SummaryStat: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="p-6 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl flex flex-col items-center text-center">
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 leading-tight">{label}</p>
    <p className={`text-4xl font-black ${color}`}>{value}</p>
  </div>
);

export default NestDetails;
