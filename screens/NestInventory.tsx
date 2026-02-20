
import React, { useState, useRef, useEffect } from 'react';
import { DatabaseConnection, NestEventData } from '../services/Database';

interface NestInventoryProps {
  id: string;
  onBack: () => void;
}

// Enforce exact format: up to 2/3 digits before dot, exactly 5 after.
const LAT_REGEX = /^-?\d{1,2}\.\d{5}$/;
const LNG_REGEX = /^-?\d{1,3}\.\d{5}$/;

const isLatValid = (val: string) => {
  const num = parseFloat(val);
  return !isNaN(num) && num >= -90 && num <= 90 && LAT_REGEX.test(val);
};

const isLngValid = (val: string) => {
  const num = parseFloat(val);
  return !isNaN(num) && num >= -180 && num <= 180 && LNG_REGEX.test(val);
};

const InventoryMetric: React.FC<{
  label: React.ReactNode;
  unit: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  color?: 'primary' | 'amber';
  isValid?: boolean; // Optional prop for custom validation styling
  showStepper?: boolean;
}> = ({ label, unit, value, onChange, required = false, color = 'primary', isValid = true, showStepper = true }) => {
  const step = (delta: number) => {
    const current = parseFloat(value) || 0;
    const next = Math.max(0, current + delta);
    onChange(next.toFixed(2));
  };

  const ringColor = color === 'primary' ? 'focus:ring-primary' : 'focus:ring-amber-500';
  const buttonColor = color === 'primary' ? 'text-primary' : 'text-amber-500';
  
  // Determine border/ring style based on required status and custom validity
  const borderStyle = (!isValid || (required && value === '')) 
    ? 'border-rose-500/30 ring-1 ring-rose-500/20' 
    : 'border-transparent';

  return (
    <div className="min-w-0">
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 truncate">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative">
        <input 
          className={`w-full bg-slate-100 dark:bg-slate-800 border focus:ring-1 ${ringColor} text-xs p-2.5 pl-3 ${showStepper ? 'pr-20' : 'pr-8'} text-white font-bold transition-all outline-none ${borderStyle}`} 
          placeholder={unit === "°" ? "00.00000" : "0.0"}
          type="number" // Note: Lat/Lng might need text input if we want to enforce strict regex typing patterns, but number is usually fine. Using number for now to match others, but regex validation handles string format.
          step={unit === "°" ? "0.00001" : "0.01"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className={`absolute ${showStepper ? 'right-10' : 'right-3'} top-0 bottom-0 flex items-center pointer-events-none`}>
          <span className="text-slate-500 text-[9px] font-black uppercase font-mono">{unit}</span>
        </div>
        {showStepper && (
          <div className="absolute right-1 top-1 bottom-1 flex flex-col gap-0.5">
            <button 
              type="button"
              onClick={() => step(unit === "°" ? 0.00001 : 0.1)}
              className={`flex-1 px-1.5 bg-slate-200 dark:bg-slate-900 rounded-t flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors ${buttonColor}`}
            >
              <span className="material-symbols-outlined text-[10px] font-bold">add</span>
            </button>
            <button 
              type="button"
              onClick={() => step(unit === "°" ? -0.00001 : -0.1)}
              className={`flex-1 px-1.5 bg-slate-200 dark:bg-slate-900 rounded-b flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors ${buttonColor}`}
            >
              <span className="material-symbols-outlined text-[10px] font-bold">remove</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const NestInventory: React.FC<NestInventoryProps> = ({ id, onBack }) => {
  const originalMetricsRef = useRef<HTMLElement>(null);
  const reburiedMetricsRef = useRef<HTMLElement>(null);
  const embryoTableRef = useRef<HTMLElement>(null);
  const logisticsRef = useRef<HTMLElement>(null);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  // eggCount now represents the fetched Current Number of Eggs in the nest (expected).
  const [eggCount, setEggCount] = useState<string | number>('?');
  const [nestRecord, setNestRecord] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTopEggCheck, setIsTopEggCheck] = useState(false);

  useEffect(() => {
    const fetchNestDetails = async () => {
      if (id) {
        try {
          const response = await DatabaseConnection.getNest(id);
          setNestRecord(response.nest);
          
          // Use current_num_eggs for display and validation checks
          const currentVal = response.nest?.current_num_eggs;
          const totalVal = response.nest?.total_num_eggs;

          if (currentVal !== null && currentVal !== undefined && currentVal !== '') {
            setEggCount(currentVal);
          } else if (totalVal !== null && totalVal !== undefined && totalVal !== '') {
            // Fallback to total if current is not set (e.g. first inventory)
            setEggCount(totalVal);
          } else {
            setEggCount('?');
          }
        } catch (e) {
          console.error(e);
          setEggCount('?');
        }
      }
    };
    fetchNestDetails();
  }, [id]);

  // Logistics State
  const [inventoryMeta, setInventoryMeta] = useState({
    observer: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    notes: ''
  });

  const [metrics, setMetrics] = useState({
    original: { h: '', H: '', w: '', S: '', lat: '', lng: '' },
    reburied: { h: '', H: '', w: '', S: '', lat: '', lng: '' }
  });

  const [tally, setTally] = useState({ eggsReburied: 0, assistedToSea: 0, aliveAbove: 0, aliveWithin: 0, deadAbove: 0, deadWithin: 0 });
  const [stages, setStages] = useState({
    hatched: { count: 0, black: 0, pink: 0, green: 0 },
    noVisible: { count: 0, black: 0, pink: 0, green: 0 },
    eyeSpot: { count: 0, black: 0, pink: 0, green: 0 },
    early: { count: 0, black: 0, pink: 0, green: 0 },
    middle: { count: 0, black: 0, pink: 0, green: 0 },
    late: { count: 0, black: 0, pink: 0, green: 0 },
    pippedDead: { count: 0, black: 0, pink: 0, green: 0 },
    pippedAlive: { count: 0 }
  });

  const totalTally = Object.values(stages).reduce((acc, stage) => acc + (stage as any).count, 0);
  const currentTotal = totalTally + tally.eggsReburied;
  
  const numericEggCount = typeof eggCount === 'number' ? eggCount : parseInt(eggCount as string);
  const isEggCountKnown = !isNaN(numericEggCount) && eggCount !== '?';
  const isCountMatching = !isEggCountKnown || currentTotal === numericEggCount;
  
  const isTimeValid = inventoryMeta.startTime && inventoryMeta.endTime ? inventoryMeta.endTime > inventoryMeta.startTime : false;

  // Logic check: h must be < H if both are present
  const isDepthLogicValid = (h: string, H: string) => {
    if (h && H) {
      return parseFloat(h) < parseFloat(H);
    }
    return true; // Valid if one or both are missing
  };

  const validation = {
    metrics: metrics.original.h !== '',
    metricsLogic: isDepthLogicValid(metrics.original.h, metrics.original.H),
    
    // GPS Validation: strictly required now
    gpsValid: isLatValid(metrics.original.lat) && isLngValid(metrics.original.lng),

    reburiedMetrics: tally.eggsReburied === 0 || (metrics.reburied.h !== '' && metrics.reburied.H !== '' && metrics.reburied.w !== '' && metrics.reburied.S !== ''),
    reburiedMetricsLogic: tally.eggsReburied === 0 || isDepthLogicValid(metrics.reburied.h, metrics.reburied.H),
    // Reburied GPS Validation: required if reburied
    reburiedGpsValid: tally.eggsReburied === 0 || (isLatValid(metrics.reburied.lat) && isLngValid(metrics.reburied.lng)),

    tallyMatch: true, // Placeholder if strict check is needed later
    observer: inventoryMeta.observer.trim() !== '',
    dateRequired: inventoryMeta.date !== '',
    timeRequired: inventoryMeta.startTime !== '' && inventoryMeta.endTime !== '',
    timeOrder: isTimeValid,
    countCheck: isCountMatching || isTopEggCheck // Allow save if Top Egg Check is active, bypassing count match
  };

  const isReadyForSubmission = Object.values(validation).every(Boolean);

  const getErrorInfo = () => {
    if (!validation.countCheck) return { message: `Count Mismatch (${currentTotal}/${numericEggCount})`, targetId: "embryo-analysis" };
    if (!validation.metrics) return { message: "Depth (h) req", targetId: "original-metrics" };
    if (!validation.metricsLogic) return { message: "Original: h must be < H", targetId: "original-metrics" };
    if (!validation.gpsValid) return { message: "Original GPS Required", targetId: "original-metrics" };
    if (!validation.reburiedMetrics) return { message: "Metrics missing", targetId: "reburied-metrics" };
    if (!validation.reburiedMetricsLogic) return { message: "Reburied: h must be < H", targetId: "reburied-metrics" };
    if (!validation.reburiedGpsValid) return { message: "Reburied GPS Required", targetId: "reburied-metrics" };
    if (!validation.observer) return { message: "Observer Required", targetId: "logistics-section" };
    if (!validation.dateRequired) return { message: "Date Required", targetId: "logistics-section" };
    if (!validation.timeRequired) return { message: "Times Required", targetId: "logistics-section" };
    if (!validation.timeOrder) return { message: "End Time must be after Start", targetId: "logistics-section" };
    
    return null;
  };

  const errorInfo = getErrorInfo();

  const scrollToField = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-rose-500/50', 'ring-offset-8', 'ring-offset-background-dark');
      setTimeout(() => el.classList.remove('ring-4', 'ring-rose-500/50', 'ring-offset-8', 'ring-offset-background-dark'), 3000);
    }
  };

  const handleMetricChange = (section: 'original' | 'reburied', field: string, value: string) => {
    setMetrics(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  const copyOriginalToReburied = () => {
    setMetrics(prev => ({
      ...prev,
      reburied: {
        ...prev.reburied,
        S: prev.original.S,
        lat: prev.original.lat,
        lng: prev.original.lng
      }
    }));
  };

  const updateStage = (key: keyof typeof stages, field: string, delta: number) => {
    setStages(prev => {
      const stage = { ...prev[key] };
      const currentValue = (stage as any)[field] || 0;
      const newValue = Math.max(0, currentValue + delta);

      if (field === 'count') {
        (stage as any).count = newValue;
        // Clamp infection counts if they exceed the new total count
        if ('black' in stage && (stage as any).black > newValue) (stage as any).black = newValue;
        if ('pink' in stage && (stage as any).pink > newValue) (stage as any).pink = newValue;
        if ('green' in stage && (stage as any).green > newValue) (stage as any).green = newValue;
      } else {
        // Prevent sub-values from exceeding the count
        if (newValue <= stage.count) {
          (stage as any)[field] = newValue;
        } else {
          return prev; // Ignore update
        }
      }
      return { ...prev, [key]: stage };
    });
  };

  const updateTally = (field: keyof typeof tally, delta: number) => {
    setTally(prev => ({ ...prev, [field]: Math.max(0, prev[field] + delta) }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Determine Event Type based on rules
      let eventType = 'FULL_INVENTORY';
      const isReburied = tally.eggsReburied > 0;
      // "Top egg if only the top egg measurement of the original nest metics is filled out"
      // metrics.original.h is required, so we check if H, w, S are empty.
      const isTopEggOnly = metrics.original.H === '' && metrics.original.w === '' && metrics.original.S === '';

      if (isTopEggCheck) {
        eventType = 'TOP_EGG';
      } else if (isReburied) {
        eventType = 'PARTIAL_INVENTORY';
      } else if (isTopEggOnly) {
        eventType = 'TOP_EGG';
      } else {
        eventType = 'FULL_INVENTORY';
      }

      // Helper to combine date and time for backend timestamp
      const formatTimestamp = (dateStr: string, timeStr: string) => {
        if (!dateStr || !timeStr) return undefined;
        return `${dateStr} ${timeStr}:00`;
      };

      const payload: NestEventData = {
        event_type: eventType,
        nest_code: id,
        
        // Original Metrics
        original_depth_top_egg_h: metrics.original.h ? Number(metrics.original.h) : undefined,
        original_depth_bottom_chamber_h: metrics.original.H ? Number(metrics.original.H) : undefined,
        original_width_w: metrics.original.w ? Number(metrics.original.w) : undefined,
        original_distance_to_sea_s: metrics.original.S ? Number(metrics.original.S) : undefined,
        original_gps_lat: metrics.original.lat ? Number(metrics.original.lat) : undefined,
        original_gps_long: metrics.original.lng ? Number(metrics.original.lng) : undefined,
        
        total_eggs: isEggCountKnown ? Number(numericEggCount) : undefined,
        helped_to_sea: tally.assistedToSea,
        eggs_reburied: tally.eggsReburied,

        // Stages Breakdown
        hatched_count: stages.hatched.count,
        hatched_black_fungus_count: stages.hatched.black,
        hatched_pink_bacteria_count: stages.hatched.pink,
        hatched_green_bacteria_count: stages.hatched.green,

        // 'noVisible' maps to 'non_viable' in backend schema
        non_viable_count: stages.noVisible.count,
        non_viable_black_fungus_count: stages.noVisible.black,
        non_viable_pink_bacteria_count: stages.noVisible.pink,
        non_viable_green_bacteria_count: stages.noVisible.green,

        eye_spot_count: stages.eyeSpot.count,
        eye_spot_black_fungus_count: stages.eyeSpot.black,
        eye_spot_pink_bacteria_count: stages.eyeSpot.pink,
        eye_spot_green_bacteria_count: stages.eyeSpot.green,

        early_count: stages.early.count,
        early_black_fungus_count: stages.early.black,
        early_pink_bacteria_count: stages.early.pink,
        early_green_bacteria_count: stages.early.green,

        middle_count: stages.middle.count,
        middle_black_fungus_count: stages.middle.black,
        middle_green_bacteria_count: stages.middle.green,
        middle_pink_bacteria_count: stages.middle.pink,

        late_count: stages.late.count,
        late_black_fungus_count: stages.late.black,
        late_pink_bacteria_count: stages.late.pink,
        late_green_bacteria_count: stages.late.green,

        // 'pippedDead' maps to 'piped_dead'
        piped_dead_count: stages.pippedDead.count,
        piped_dead_black_fungus_count: stages.pippedDead.black,
        piped_dead_green_bacteria_count: stages.pippedDead.green,
        piped_dead_pink_bacteria_count: stages.pippedDead.pink,

        // 'pippedAlive' maps to 'piped_alive'
        piped_alive_count: stages.pippedAlive.count,

        // Hatchling Status Counts
        alive_within: tally.aliveWithin,
        dead_within: tally.deadWithin,
        alive_above: tally.aliveAbove,
        dead_above: tally.deadAbove,

        // Reburied Metrics (if applicable)
        reburied_depth_top_egg_h: metrics.reburied.h ? Number(metrics.reburied.h) : undefined,
        reburied_depth_bottom_chamber_h: metrics.reburied.H ? Number(metrics.reburied.H) : undefined,
        reburied_width_w: metrics.reburied.w ? Number(metrics.reburied.w) : undefined,
        reburied_distance_to_sea_s: metrics.reburied.S ? Number(metrics.reburied.S) : undefined,
        reburied_gps_lat: metrics.reburied.lat ? Number(metrics.reburied.lat) : undefined,
        reburied_gps_long: metrics.reburied.lng ? Number(metrics.reburied.lng) : undefined,

        // Metadata
        notes: inventoryMeta.notes + (isTopEggCheck ? ' [Top Egg Check: Enabled]' : ''),
        start_time: formatTimestamp(inventoryMeta.date, inventoryMeta.startTime),
        end_time: formatTimestamp(inventoryMeta.date, inventoryMeta.endTime),
        observer: inventoryMeta.observer
      };

      // 1. Create Event Record
      await DatabaseConnection.createNestEvent(payload);

      // 2. Update Parent Nest Record
      if (nestRecord && nestRecord.id) {
        // Resolve Total Eggs
        const existingTotal = nestRecord.total_num_eggs;
        // If total is not set or 0, this inventory establishes the total.
        // Otherwise, the total remains fixed.
        const newTotal = (existingTotal && existingTotal > 0) ? existingTotal : currentTotal;
        
        // Resolve Current Eggs (Remaining in nest)
        // If Top Egg Check is enabled, we DO NOT update the current egg count (preserve existing).
        const newCurrent = isTopEggCheck ? nestRecord.current_num_eggs : tally.eggsReburied; 

        // Determine Status based on current vs total
        // If Top Egg Check is enabled, preserve existing status.
        let newStatus = nestRecord.status || 'incubating';
        
        if (!isTopEggCheck) {
            if (newCurrent === 0) {
                newStatus = 'hatched';
            } else if (newCurrent < newTotal) {
                newStatus = 'hatching';
            } else {
                newStatus = 'incubating';
            }
        }

        await DatabaseConnection.updateNest(nestRecord.id, {
            ...nestRecord,
            total_num_eggs: newTotal,
            current_num_eggs: newCurrent,
            status: newStatus,
            // Ensure mandatory fields from original record are passed back if needed by backend validation
            nest_code: nestRecord.nest_code,
            date_found: nestRecord.date_found,
            beach: nestRecord.beach,
            depth_top_egg_h: nestRecord.depth_top_egg_h,
            distance_to_sea_s: nestRecord.distance_to_sea_s,
            gps_long: nestRecord.gps_long,
            gps_lat: nestRecord.gps_lat
        });
      }

      alert('Inventory saved successfully!');
      onBack();
    } catch (e: any) {
      console.error(e);
      alert('Failed to save inventory: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative bg-background-light dark:bg-background-dark font-display text-white">
      <header className="bg-white dark:bg-[#111418] border-b border-primary/10 pl-16 pr-8 lg:pl-8 py-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-baseline gap-2 sm:gap-3 truncate">
            Inventory : <span className="text-primary font-mono uppercase">{id || 'XP-9'}</span>
          </h2>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full w-fit">
                <span className="material-symbols-outlined text-amber-500 text-xs">egg</span>
                <span className="text-xs font-black text-amber-500 uppercase tracking-widest">
                  {eggCount} Current
                </span>
             </div>
             <div className={`flex items-center gap-2 px-3 py-1 border rounded-full w-fit transition-colors ${
                isCountMatching ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : (isTopEggCheck ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500')
             }`}>
                <span className="material-symbols-outlined text-xs">analytics</span>
                <span className="text-xs font-black uppercase tracking-widest">
                  {isTopEggCheck ? 'Check OK (Bypassed)' : `${currentTotal} Accounted`}
                </span>
             </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 no-scrollbar space-y-8 bg-background-light dark:bg-background-dark pb-48">
        
        {/* Logistics Section - Moved to Top */}
        <section ref={logisticsRef} id="logistics-section" className="bg-white dark:bg-[#1c2127] p-6 rounded-2xl border border-primary/10 shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-6 text-white">
            <span className="material-symbols-outlined text-primary">assignment_ind</span>
            <h3 className="text-lg font-black uppercase tracking-tight">Session Logistics & Notes</h3>
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               <div className="space-y-2">
                 <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Date <span className="text-rose-500">*</span></label>
                 <input 
                   className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-slate-900 dark:text-white" 
                   type="date"
                   value={inventoryMeta.date}
                   onChange={(e) => setInventoryMeta({...inventoryMeta, date: e.target.value})}
                 />
               </div>
               <div className="space-y-2">
                 <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Observer <span className="text-rose-500">*</span></label>
                 <input
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-slate-900 dark:text-white"
                    type="text"
                    placeholder="Enter observer name"
                    value={inventoryMeta.observer}
                    onChange={(e) => setInventoryMeta({...inventoryMeta, observer: e.target.value})}
                 />
               </div>
               <div className="space-y-2">
                 <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Start Time <span className="text-rose-500">*</span></label>
                 <input 
                   className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-slate-900 dark:text-white" 
                   type="time"
                   value={inventoryMeta.startTime}
                   onChange={(e) => setInventoryMeta({...inventoryMeta, startTime: e.target.value})}
                 />
               </div>
               <div className="space-y-2">
                 <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">End Time <span className="text-rose-500">*</span></label>
                 <input 
                   className={`w-full bg-slate-100 dark:bg-slate-800 border rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-slate-900 dark:text-white ${inventoryMeta.endTime && !isTimeValid ? 'border-rose-500 focus:ring-rose-500' : 'border-transparent dark:border-slate-700'}`} 
                   type="time"
                   value={inventoryMeta.endTime}
                   onChange={(e) => setInventoryMeta({...inventoryMeta, endTime: e.target.value})}
                 />
                 {inventoryMeta.endTime && !isTimeValid && (
                    <p className="text-[9px] font-bold text-rose-500 uppercase tracking-wide">Must be after Start Time</p>
                 )}
               </div>
            </div>
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Field Notes</label>
                <textarea 
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 rounded-xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all font-medium text-slate-900 dark:text-white placeholder:opacity-30" 
                  placeholder="Describe nest conditions, unusual findings, or environmental factors..." 
                  rows={3}
                  value={inventoryMeta.notes}
                  onChange={(e) => setInventoryMeta({...inventoryMeta, notes: e.target.value})}
                ></textarea>
            </div>
          </div>
        </section>

        {/* Original Metrics - Full Width */}
        <section ref={originalMetricsRef} id="original-metrics" className="bg-white dark:bg-[#1c2127] p-6 rounded-2xl border border-primary/10 shadow-sm transition-all">
          <h3 className="text-lg font-black uppercase tracking-tight mb-6">Original Nest Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <InventoryMetric label={<><span className="lowercase">h</span> (Depth top)</>} unit="cm" value={metrics.original.h} onChange={(v) => handleMetricChange('original', 'h', v)} required />
            <InventoryMetric label="H (Depth bottom)" unit="cm" value={metrics.original.H} onChange={(v) => handleMetricChange('original', 'H', v)} required={false} />
            <InventoryMetric label="w (Width)" unit="cm" value={metrics.original.w} onChange={(v) => handleMetricChange('original', 'w', v)} required={false} />
            <InventoryMetric label="S (Dist to sea)" unit="m" value={metrics.original.S} onChange={(v) => handleMetricChange('original', 'S', v)} required={false} />
            
            {/* GPS Inputs - No Stepper */}
            <InventoryMetric 
              label="GPS Lat" 
              unit="°" 
              value={metrics.original.lat} 
              onChange={(v) => handleMetricChange('original', 'lat', v)} 
              required={true}
              isValid={isLatValid(metrics.original.lat)}
              showStepper={false}
            />
            <InventoryMetric 
              label="GPS Lng" 
              unit="°" 
              value={metrics.original.lng} 
              onChange={(v) => handleMetricChange('original', 'lng', v)} 
              required={true}
              isValid={isLngValid(metrics.original.lng)}
              showStepper={false}
            />
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-1 space-y-8">
            <section className="bg-white dark:bg-[#1c2127] p-4 rounded-2xl border border-primary/10 shadow-sm">
              <div className="flex items-center justify-between mb-3 text-white">
                <h3 className="text-xs font-black uppercase tracking-tight">Relocation Assistance</h3>
              </div>
              
              <div className="mb-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer" htmlFor="topEggCheck">
                    Top Egg Check
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        id="topEggCheck" 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={isTopEggCheck} 
                        onChange={(e) => setIsTopEggCheck(e.target.checked)} 
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 border-b-2 border-primary text-white flex items-center justify-between">
                  <div>
                    <h4 className="text-[8px] font-black uppercase tracking-widest text-slate-500">Assisted to Sea</h4>
                    <p className="text-2xl font-black">{tally.assistedToSea}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateTally('assistedToSea', -1)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-[#111418] rounded shadow-sm active:scale-90 transition-all text-slate-400 hover:text-white"><span className="material-symbols-outlined text-sm">remove</span></button>
                    <button onClick={() => updateTally('assistedToSea', 1)} className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded shadow-md active:scale-95 transition-all"><span className="material-symbols-outlined text-sm">add</span></button>
                  </div>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 border-b-2 border-amber-500 text-white flex items-center justify-between">
                  <div>
                    <h4 className="text-[8px] font-black uppercase tracking-widest text-slate-500">Eggs Reburied</h4>
                    <p className="text-2xl font-black">{tally.eggsReburied}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateTally('eggsReburied', -1)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-[#111418] rounded shadow-sm active:scale-90 transition-all text-slate-400 hover:text-white"><span className="material-symbols-outlined text-sm">remove</span></button>
                    <button onClick={() => updateTally('eggsReburied', 1)} className="w-8 h-8 flex items-center justify-center bg-amber-500 text-white rounded shadow-md active:scale-95 transition-all"><span className="material-symbols-outlined text-sm">add</span></button>
                  </div>
                </div>
              </div>
            </section>

            {tally.eggsReburied > 0 && (
              <section ref={reburiedMetricsRef} id="reburied-metrics" className={`bg-white dark:bg-[#1c2127] p-6 rounded-2xl border transition-all duration-300 border-amber-500/40 ring-1 ring-amber-500/20 shadow-sm`}>
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-3">
                       <h3 className="text-lg font-black uppercase tracking-tight text-amber-500">Reburied metrics</h3>
                       <button 
                         onClick={copyOriginalToReburied}
                         className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg border border-amber-500/20 transition-all active:scale-95 group"
                         title="Copy Dist. to Sea & GPS from Original Metrics"
                       >
                         <span className="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">content_copy</span>
                         <span className="text-[9px] font-black uppercase tracking-widest">Copy Original</span>
                       </button>
                   </div>
                   <span className="text-[10px] font-black bg-amber-500/20 text-amber-500 px-2 py-1 rounded uppercase tracking-widest">Required</span>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-4">
                    <InventoryMetric label={<><span className="lowercase">h</span> (New Depth)</>} unit="cm" value={metrics.reburied.h} onChange={(v) => handleMetricChange('reburied', 'h', v)} color="amber" required={tally.eggsReburied > 0} />
                    <InventoryMetric label="H (New Bottom)" unit="cm" value={metrics.reburied.H} onChange={(v) => handleMetricChange('reburied', 'H', v)} color="amber" required={tally.eggsReburied > 0} />
                    <InventoryMetric label="w (New Width)" unit="cm" value={metrics.reburied.w} onChange={(v) => handleMetricChange('reburied', 'w', v)} color="amber" required={tally.eggsReburied > 0} />
                    <InventoryMetric label="S (Dist to sea)" unit="m" value={metrics.reburied.S} onChange={(v) => handleMetricChange('reburied', 'S', v)} color="amber" required={tally.eggsReburied > 0} />
                    
                    {/* Reburied GPS Inputs - No Stepper */}
                    <InventoryMetric 
                      label="GPS Lat" 
                      unit="°" 
                      value={metrics.reburied.lat} 
                      onChange={(v) => handleMetricChange('reburied', 'lat', v)} 
                      required={tally.eggsReburied > 0}
                      color="amber"
                      isValid={tally.eggsReburied === 0 || isLatValid(metrics.reburied.lat)}
                      showStepper={false}
                    />
                    <InventoryMetric 
                      label="GPS Lng" 
                      unit="°" 
                      value={metrics.reburied.lng} 
                      onChange={(v) => handleMetricChange('reburied', 'lng', v)} 
                      required={tally.eggsReburied > 0}
                      color="amber"
                      isValid={tally.eggsReburied === 0 || isLngValid(metrics.reburied.lng)}
                      showStepper={false}
                    />
                  </div>
                </div>
              </section>
            )}

            <section className="bg-white dark:bg-[#1c2127] p-4 rounded-2xl border border-primary/10 shadow-sm">
                <div className="flex items-center justify-between mb-3 text-white">
                    <h3 className="text-xs font-black uppercase tracking-tight text-slate-500">Hatchling Findings</h3>
                </div>
                <div className="space-y-3">
                    {/* Alive */}
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-2.5 border-l-4 border-emerald-500 text-white flex items-center justify-between">
                        <div>
                            <h4 className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Alive (Surface)</h4>
                            <p className="text-lg font-black">{tally.aliveAbove}</p>
                        </div>
                        <div className="flex gap-1.5">
                            <button onClick={() => updateTally('aliveAbove', -1)} className="w-7 h-7 flex items-center justify-center bg-white dark:bg-[#111418] rounded shadow-sm active:scale-90 transition-all text-slate-400 hover:text-white"><span className="material-symbols-outlined text-xs">remove</span></button>
                            <button onClick={() => updateTally('aliveAbove', 1)} className="w-7 h-7 flex items-center justify-center bg-emerald-600 text-white rounded shadow-md active:scale-95 transition-all"><span className="material-symbols-outlined text-xs">add</span></button>
                        </div>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-2.5 border-l-4 border-emerald-500 text-white flex items-center justify-between">
                        <div>
                            <h4 className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Alive (In Nest)</h4>
                            <p className="text-lg font-black">{tally.aliveWithin}</p>
                        </div>
                        <div className="flex gap-1.5">
                            <button onClick={() => updateTally('aliveWithin', -1)} className="w-7 h-7 flex items-center justify-center bg-white dark:bg-[#111418] rounded shadow-sm active:scale-90 transition-all text-slate-400 hover:text-white"><span className="material-symbols-outlined text-xs">remove</span></button>
                            <button onClick={() => updateTally('aliveWithin', 1)} className="w-7 h-7 flex items-center justify-center bg-emerald-600 text-white rounded shadow-md active:scale-95 transition-all"><span className="material-symbols-outlined text-xs">add</span></button>
                        </div>
                    </div>
                    
                    {/* Dead */}
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-2.5 border-l-4 border-rose-500 text-white flex items-center justify-between">
                        <div>
                            <h4 className="text-[8px] font-black uppercase tracking-widest text-rose-500">Dead (Surface)</h4>
                            <p className="text-lg font-black">{tally.deadAbove}</p>
                        </div>
                        <div className="flex gap-1.5">
                            <button onClick={() => updateTally('deadAbove', -1)} className="w-7 h-7 flex items-center justify-center bg-white dark:bg-[#111418] rounded shadow-sm active:scale-90 transition-all text-slate-400 hover:text-white"><span className="material-symbols-outlined text-xs">remove</span></button>
                            <button onClick={() => updateTally('deadAbove', 1)} className="w-7 h-7 flex items-center justify-center bg-rose-600 text-white rounded shadow-md active:scale-95 transition-all"><span className="material-symbols-outlined text-xs">add</span></button>
                        </div>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-2.5 border-l-4 border-rose-500 text-white flex items-center justify-between">
                        <div>
                            <h4 className="text-[8px] font-black uppercase tracking-widest text-rose-500">Dead (In Nest)</h4>
                            <p className="text-lg font-black">{tally.deadWithin}</p>
                        </div>
                        <div className="flex gap-1.5">
                            <button onClick={() => updateTally('deadWithin', -1)} className="w-7 h-7 flex items-center justify-center bg-white dark:bg-[#111418] rounded shadow-sm active:scale-90 transition-all text-slate-400 hover:text-white"><span className="material-symbols-outlined text-xs">remove</span></button>
                            <button onClick={() => updateTally('deadWithin', 1)} className="w-7 h-7 flex items-center justify-center bg-rose-600 text-white rounded shadow-md active:scale-95 transition-all"><span className="material-symbols-outlined text-xs">add</span></button>
                        </div>
                    </div>
                </div>
            </section>
          </div>

          <div className="xl:col-span-2">
            <section ref={embryoTableRef} id="embryo-analysis" className={`bg-white dark:bg-[#1c2127] rounded-2xl border overflow-hidden shadow-sm transition-all ${!isCountMatching && !isTopEggCheck ? 'border-rose-500/50 ring-1 ring-rose-500/20' : 'border-primary/10'}`}>
              <div className="p-6 border-b border-primary/5 flex justify-between items-center text-white">
                <h3 className="text-lg font-black uppercase tracking-tight">Embryonic Stage Analysis</h3>
                {!isCountMatching && !isTopEggCheck && (
                    <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">Count Mismatch</span>
                )}
                {isTopEggCheck && (
                    <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">Check Override</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest">Stage</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Count</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Black Fungus</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Pink Bacteria</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Green Bacteria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(Object.keys(stages) as Array<keyof typeof stages>).map((key) => (
                      <tr key={key} className="hover:bg-slate-50/50 dark:hover:bg-primary/5 transition-colors text-white">
                        <td className="px-6 py-4"><p className="text-xs font-black uppercase tracking-tight">{String(key).replace(/([A-Z])/g, ' $1').trim()}</p></td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-white/5 mx-auto w-fit">
                            <button onClick={() => updateStage(key, 'count', -1)} className="p-1 text-slate-500 hover:text-white transition-colors"><span className="material-symbols-outlined text-[14px]">remove</span></button>
                            <span className="text-lg font-black min-w-[2rem] text-center">{stages[key].count}</span>
                            <button onClick={() => updateStage(key, 'count', 1)} className="p-1 text-slate-500 hover:text-white transition-colors"><span className="material-symbols-outlined text-[14px]">add</span></button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">{key !== 'pippedAlive' && (
                          <div className="flex items-center justify-center gap-1 bg-zinc-900 rounded-lg p-1 border border-white/10 mx-auto w-fit">
                            <button onClick={() => updateStage(key, 'black', -1)} className="p-1 text-white/40"><span className="material-symbols-outlined text-[14px]">remove</span></button>
                            <span className="text-sm text-white font-bold min-w-4 text-center">{(stages[key] as any).black}</span>
                            <button onClick={() => updateStage(key, 'black', 1)} className="p-1 text-white/40"><span className="material-symbols-outlined text-[14px]">add</span></button>
                          </div>
                        )}</td>
                        <td className="px-6 py-4 text-center">{key !== 'pippedAlive' && (
                          <div className="flex items-center justify-center gap-1 bg-rose-600 rounded-lg p-1 border border-white/10 mx-auto w-fit">
                            <button onClick={() => updateStage(key, 'pink', -1)} className="p-1 text-white/60"><span className="material-symbols-outlined text-[14px]">remove</span></button>
                            <span className="text-sm text-white font-bold min-w-4 text-center">{(stages[key] as any).pink}</span>
                            <button onClick={() => updateStage(key, 'pink', 1)} className="p-1 text-white/60"><span className="material-symbols-outlined text-[14px]">add</span></button>
                          </div>
                        )}</td>
                        <td className="px-6 py-4 text-center">{key !== 'pippedAlive' && (
                          <div className="flex items-center justify-center gap-1 bg-emerald-600 rounded-lg p-1 border border-white/10 mx-auto w-fit">
                            <button onClick={() => updateStage(key, 'green', -1)} className="p-1 text-white/60"><span className="material-symbols-outlined text-[14px]">remove</span></button>
                            <span className="text-sm text-white font-bold min-w-4 text-center">{(stages[key] as any).green}</span>
                            <button onClick={() => updateStage(key, 'green', 1)} className="p-1 text-white/60"><span className="material-symbols-outlined text-[14px]">add</span></button>
                          </div>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Banner Layout Optimized for Vertical Mobile with WORD 'SAVE' */}
      <footer className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white/95 dark:bg-[#111418]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-4 py-3 z-50 shadow-[0_-15px_30px_rgba(0,0,0,0.15)] flex flex-col sm:flex-row items-center justify-between min-h-[5.5rem] gap-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between w-full gap-2 sm:gap-8">
          <div className="flex items-center gap-2 shrink-0">
            <button 
              disabled={!isReadyForSubmission || isSaving}
              onClick={handleSave}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 min-w-[90px] sm:min-w-[150px] rounded-xl font-black uppercase tracking-widest shadow-xl transition-all text-xs flex items-center justify-center ${isReadyForSubmission && !isSaving ? 'bg-primary text-white shadow-primary/30 hover:scale-[1.03] active:scale-[0.97]' : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'}`}
            >
              {isSaving ? (
                <>
                   <span className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>
                   SAVING
                </>
              ) : 'SAVE'}
            </button>
            <button 
              onClick={() => setShowCancelConfirm(true)} 
              className="px-3 sm:px-5 py-2.5 sm:py-3 bg-rose-600/10 text-rose-500 border border-rose-500/20 rounded-xl font-black uppercase tracking-widest text-[9px] sm:text-[10px] hover:bg-rose-600 hover:text-white transition-all whitespace-nowrap"
            >
              Cancel
            </button>
          </div>

          <div className="flex-grow flex justify-center overflow-hidden text-center">
            {!isReadyForSubmission && errorInfo && (
              <button 
                onClick={() => scrollToField(errorInfo.targetId)}
                className="bg-rose-500/10 border border-rose-500/50 px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 animate-in slide-in-from-bottom-2 duration-300 w-full max-w-full hover:bg-rose-500/20 active:scale-[0.98] transition-all group border-dashed"
              >
                <span className="material-symbols-outlined text-rose-500 text-lg sm:text-xl shrink-0">report_problem</span>
                <div className="flex flex-col text-left overflow-hidden">
                  <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-[0.1em] text-rose-400 opacity-80 leading-tight">Data Check</span>
                  <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-rose-500 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {errorInfo.message}
                  </span>
                </div>
                <div className="h-6 sm:h-8 w-px bg-rose-500/20 mx-0.5 sm:mx-1 hidden xs:block"></div>
                <span className="material-symbols-outlined text-rose-500 text-xs sm:text-base shrink-0 opacity-40 group-hover:opacity-100 transition-opacity hidden sm:block">near_me</span>
              </button>
            )}
          </div>

          <div className="hidden lg:block w-[120px] shrink-0"></div>
        </div>
      </footer>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowCancelConfirm(false)}></div>
          <div className="relative bg-[#111c26] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-8 flex flex-col items-center text-center">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Discard Progress?</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">Unsaved analysis for {id} will be lost.</p>
            <div className="flex flex-col w-full gap-3">
              <button onClick={onBack} className="w-full py-3.5 bg-rose-500 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-500/20">Discard Changes</button>
              <button onClick={() => setShowCancelConfirm(false)} className="w-full py-3.5 bg-white/5 text-slate-300 rounded-xl font-black uppercase tracking-widest text-xs border border-white/5">Continue Editing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NestInventory;
