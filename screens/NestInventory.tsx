
import React, { useState, useRef, useEffect } from 'react';
import { DatabaseConnection, NestEventData, Beach } from '../services/Database';
import { GoogleGenAI, Type } from "@google/genai";
import { Egg, BarChart3, ClipboardList, ChevronDown, Copy, Minus, Plus, Info, Square, Mic, AlertCircle, Send, Save, Clock, Upload, Trash2, X, RefreshCw, Menu, ChevronLeft } from 'lucide-react';
import { PageTitle, SectionHeading, BodyText, HelperText, Label } from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardContent } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { MetricInput } from '../components/ui/MetricInput';
import { formatTimeInput } from '../lib/utils';

interface NestInventoryProps {
  id: string;
  onBack: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  setHeaderActions?: (actions: React.ReactNode) => void;
}

// Enforce exact format: 3 digits before dot, exactly 5 after.
const LAT_REGEX = /^-?\d{3}\.\d{5}$/;
const LNG_REGEX = /^-?\d{1,3}\.\d{5}$/;

const isLatValid = (val: string) => {
  const num = parseFloat(val);
  return !isNaN(num) && num >= -90 && num <= 90 && LAT_REGEX.test(val);
};

const isLngValid = (val: string) => {
  const num = parseFloat(val);
  return !isNaN(num) && num >= -180 && num <= 180 && LNG_REGEX.test(val);
};

const NestInventory: React.FC<NestInventoryProps> = ({ id, onBack, isSidebarOpen, onToggleSidebar, setHeaderActions }) => {
  const originalMetricsRef = useRef<HTMLElement>(null);
  const reburiedMetricsRef = useRef<HTMLElement>(null);
  const embryoTableRef = useRef<HTMLElement>(null);
  const logisticsRef = useRef<HTMLElement>(null);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [confirmTimeModal, setConfirmTimeModal] = useState<{ isOpen: boolean, field: 'startTime' | 'endTime' | null }>({ isOpen: false, field: null });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // eggCount now represents the fetched Current Number of Eggs in the nest (expected).
  const [eggCount, setEggCount] = useState<string | number>('?');
  const [nestRecord, setNestRecord] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTopEggCheck, setIsTopEggCheck] = useState(false);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [beaches, setBeaches] = useState<Beach[]>([]);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userList, beachList] = await Promise.all([
          DatabaseConnection.getUsers(),
          DatabaseConnection.getBeaches()
        ]);
        setUsers(userList);
        setBeaches(beachList);
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };
    fetchData();
  }, []);

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

  const [tally, setTally] = useState({ eggsReburied: 0, aliveAbove: 0, aliveWithin: 0, deadAbove: 0, deadWithin: 0 });
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

  const totalTally: number = Object.values(stages).reduce<number>((acc, stage: any) => acc + Number(stage.count || 0), 0);
  const currentTotal = totalTally + Number(tally.eggsReburied || 0);
  
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
    metrics: metrics.original.h !== '' && metrics.original.S !== '',
    metricsInteger: metrics.original.S === '' || Number.isInteger(Number(metrics.original.S)),
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
    countCheck: true // Always allow save, bypassing count match as per user request
  };

  const isReadyForSubmission = Object.values(validation).every(Boolean);

  const getErrorInfo = () => {
    // 1. Logistics (Top Section)
    if (!validation.dateRequired) return { message: "Date Required", targetId: "logistics-section" };
    if (!validation.observer) return { message: "Observer Required", targetId: "logistics-section" };
    if (!validation.timeRequired) return { message: "Times Required", targetId: "logistics-section" };
    if (!validation.timeOrder) return { message: "End Time must be after Start", targetId: "logistics-section" };

    // 2. Original Metrics (Middle Section)
    if (metrics.original.h === '') return { message: "Depth (h) Required", targetId: "original-metrics" };
    if (metrics.original.S === '') return { message: "Dist to Sea (S) Required", targetId: "original-metrics" };
    if (!validation.metricsInteger) return { message: "Dist to Sea (S) must be integer", targetId: "original-metrics" };
    if (!validation.metricsLogic) return { message: "Original: h must be < H", targetId: "original-metrics" };
    if (!validation.gpsValid) return { message: "Original GPS Required", targetId: "original-metrics" };

    // 3. Reburied Metrics (Conditional Section)
    if (!validation.reburiedMetrics) return { message: "Metrics missing", targetId: "reburied-metrics" };
    if (!validation.reburiedMetricsLogic) return { message: "Reburied: h must be < H", targetId: "reburied-metrics" };
    if (!validation.reburiedGpsValid) return { message: "Reburied GPS Required", targetId: "reburied-metrics" };

    // 4. Embryo Analysis (Bottom Section)
    // Removed count mismatch error as per user request
    
    return null;
  };

  const errorInfo = getErrorInfo();

  const scrollToField = (id: string) => {
    let el: HTMLElement | null = null;
    
    switch(id) {
        case 'logistics-section': el = logisticsRef.current; break;
        case 'original-metrics': el = originalMetricsRef.current; break;
        case 'reburied-metrics': el = reburiedMetricsRef.current; break;
        case 'embryo-analysis': el = embryoTableRef.current; break;
    }

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

  const setStageValue = (key: keyof typeof stages, field: string, value: string) => {
    // Allow any numeric input during typing
    setStages(prev => {
      const stage = { ...prev[key] };
      (stage as any)[field] = value;
      return { ...prev, [key]: stage };
    });
  };

  const setTallyValue = (field: keyof typeof tally, value: string) => {
    // Allow any numeric input during typing
    setTally(prev => ({ ...prev, [field]: value as any }));
  };

  const handleStageBlur = (key: keyof typeof stages, field: string) => {
    if ((stages[key] as any)[field] === '') {
      setStageValue(key, field, '0');
    }
  };

  const handleTallyBlur = (field: keyof typeof tally) => {
    if (tally[field] === '' as any) {
      setTallyValue(field, '0');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await analyzeAudio(audioBlob);
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const analyzeAudio = async (audioBlob: Blob) => {
    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "audio/webm",
                  data: base64Audio,
                },
              },
              {
                text: `You are an assistant for a turtle nest inventory. Listen to the audio and identify all embryonic stage categories and infection sub-categories mentioned.
                Categories: hatched, noVisible, eyeSpot, early, middle, late, pippedDead, pippedAlive.
                Infection Sub-Categories: black (black fungus), pink (pink bacteria), green (green bacteria).
                The user may say multiple items in a list, like 'hatched, hatched black, hatched'.
                The user may also mention multiple infections for a single item, like 'hatched black and green'.
                Return a JSON object with a 'results' array. Each item in the array should have 'category', 'subCategories' (an array of strings), and 'count'.
                Example: 'hatched black and green' -> results: [{"category": "hatched", "subCategories": ["black", "green"], "count": 1}]
                Example: 'hatched, hatched black, hatched' -> results: [{"category": "hatched", "subCategories": [], "count": 1}, {"category": "hatched", "subCategories": ["black"], "count": 1}, {"category": "hatched", "subCategories": [], "count": 1}]
                Return ONLY the JSON object.`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              results: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING, nullable: true },
                    subCategories: { 
                      type: Type.ARRAY, 
                      items: { type: Type.STRING } 
                    },
                    count: { type: Type.NUMBER },
                  },
                  required: ["category", "subCategories", "count"],
                }
              }
            },
            required: ["results"],
          },
        },
      });

      const data = JSON.parse(response.text || "{}");
      if (data.results && Array.isArray(data.results)) {
        setStages(prev => {
          const newStages = { ...prev };
          
          for (const result of data.results) {
            if (result.category && result.count > 0) {
              const category = result.category as keyof typeof stages;
              if (newStages[category]) {
                const stage = { ...newStages[category] };
                const countToAdd = result.count;
                
                // Increment main count
                stage.count = (stage.count || 0) + countToAdd;
                
                // Increment each sub-category if present and valid
                if (result.subCategories && Array.isArray(result.subCategories)) {
                  for (const subCat of result.subCategories) {
                    if (subCat in stage) {
                      (stage as any)[subCat] = ((stage as any)[subCat] || 0) + countToAdd;
                    }
                  }
                }
                
                newStages[category] = stage;
              }
            }
          }
          
          return newStages;
        });
      }
    } catch (err) {
      console.error("Failed to analyze audio", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!isReadyForSubmission) {
      setHasAttemptedSave(true);
      if (errorInfo) scrollToField(errorInfo.targetId);
      return;
    }

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
        helped_to_sea: Number(tally.aliveAbove || 0) + Number(tally.aliveWithin || 0),
        eggs_reburied: Number(tally.eggsReburied || 0),

        // Stages Breakdown
        hatched_count: Number(stages.hatched.count || 0),
        hatched_black_fungus_count: Number(stages.hatched.black || 0),
        hatched_pink_bacteria_count: Number(stages.hatched.pink || 0),
        hatched_green_bacteria_count: Number(stages.hatched.green || 0),

        // 'noVisible' maps to 'non_viable' in backend schema
        non_viable_count: Number(stages.noVisible.count || 0),
        non_viable_black_fungus_count: Number(stages.noVisible.black || 0),
        non_viable_pink_bacteria_count: Number(stages.noVisible.pink || 0),
        non_viable_green_bacteria_count: Number(stages.noVisible.green || 0),

        eye_spot_count: Number(stages.eyeSpot.count || 0),
        eye_spot_black_fungus_count: Number(stages.eyeSpot.black || 0),
        eye_spot_pink_bacteria_count: Number(stages.eyeSpot.pink || 0),
        eye_spot_green_bacteria_count: Number(stages.eyeSpot.green || 0),

        early_count: Number(stages.early.count || 0),
        early_black_fungus_count: Number(stages.early.black || 0),
        early_pink_bacteria_count: Number(stages.early.pink || 0),
        early_green_bacteria_count: Number(stages.early.green || 0),

        middle_count: Number(stages.middle.count || 0),
        middle_black_fungus_count: Number(stages.middle.black || 0),
        middle_green_bacteria_count: Number(stages.middle.green || 0),
        middle_pink_bacteria_count: Number(stages.middle.pink || 0),

        late_count: Number(stages.late.count || 0),
        late_black_fungus_count: Number(stages.late.black || 0),
        late_pink_bacteria_count: Number(stages.late.pink || 0),
        late_green_bacteria_count: Number(stages.late.green || 0),

        // 'pippedDead' maps to 'piped_dead'
        piped_dead_count: Number(stages.pippedDead.count || 0),
        piped_dead_black_fungus_count: Number(stages.pippedDead.black || 0),
        piped_dead_green_bacteria_count: Number(stages.pippedDead.green || 0),
        piped_dead_pink_bacteria_count: Number(stages.pippedDead.pink || 0),

        // 'pippedAlive' maps to 'piped_alive'
        piped_alive_count: Number(stages.pippedAlive.count || 0),

        // Hatchling Status Counts
        alive_within: Number(tally.aliveWithin || 0),
        dead_within: Number(tally.deadWithin || 0),
        alive_above: Number(tally.aliveAbove || 0),
        dead_above: Number(tally.deadAbove || 0),

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
            date_laid: nestRecord.date_laid || (nestRecord as any).date_found,
            date_found: nestRecord.date_found || nestRecord.date_laid,
            beach: nestRecord.beach,
            depth_top_egg_h: nestRecord.depth_top_egg_h,
            distance_to_sea_s: nestRecord.distance_to_sea_s,
            gps_long: nestRecord.gps_long,
            gps_lat: nestRecord.gps_lat,
            is_archived: nestRecord.is_archived ?? false
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

  const currentBeach = beaches.find(b => b.name === nestRecord?.beach);
  const currentStation = currentBeach?.station;

  const filteredUsers = users.filter((user: any) => {
    if (user.role === 'Project Coordinator') {
      return true;
    }
    if (user.role === 'Field Leader' || user.role === 'Field Assistant') {
      return user.station === currentStation;
    }
    return false;
  });

  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });

  useEffect(() => {
    if (setHeaderActions) {
      setHeaderActions(
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4">
             <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full w-fit">
                <Egg className="size-2.5 text-amber-500" />
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest hidden sm:inline">
                  {eggCount} Current
                </span>
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest sm:hidden">
                  {eggCount}
                </span>
             </div>
             <div className={`flex items-center gap-1.5 px-2 py-0.5 border rounded-full w-fit transition-colors ${
                isTopEggCheck ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
             }`}>
                <BarChart3 className="size-2.5" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
                  {isTopEggCheck ? 'Check OK' : `${currentTotal} Accounted`}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest sm:hidden">
                  {isTopEggCheck ? 'OK' : `${currentTotal}`}
                </span>
             </div>
          </div>
          <Button 
            variant="outline"
            className="border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white"
            onClick={() => setShowCancelConfirm(true)}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => handleSaveRef.current()}
            isLoading={isSaving}
            disabled={isSaving}
          >
            SAVE INVENTORY
          </Button>
        </div>
      );
    }
  }, [setHeaderActions, isSaving, eggCount, isTopEggCheck, currentTotal]);

  return (
    <div className="flex flex-col min-h-full relative bg-background-light dark:bg-background-dark font-sans text-slate-900 dark:text-white">
      <div className="flex-1 overflow-y-auto p-8 no-scrollbar space-y-8 bg-background-light dark:bg-background-dark pb-48">
        
        {/* Logistics & Timing Section */}
        <Card ref={logisticsRef} id="logistics-section">
          <CardContent className="p-6">
            <SectionHeading icon={ClipboardList}>Session Logistics & Timing</SectionHeading>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <Label required>Date</Label>
                   <Input 
                     type="date"
                     value={inventoryMeta.date || new Date().toISOString().split('T')[0]}
                     onChange={(e) => setInventoryMeta({...inventoryMeta, date: e.target.value})}
                     onBlur={() => setTouched({...touched, date: true})}
                     error={touched.date && !inventoryMeta.date ? "Date is required" : undefined}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label required>Observer</Label>
                   <Select
                      value={inventoryMeta.observer}
                      onChange={(e) => setInventoryMeta({...inventoryMeta, observer: e.target.value})}
                      onBlur={() => setTouched({...touched, observer: true})}
                      error={touched.observer && !inventoryMeta.observer ? "Observer is required" : undefined}
                      options={[
                        { value: "", label: "Select observer", disabled: true },
                        ...filteredUsers.map((user: any) => ({
                          value: `${user.first_name} ${user.last_name}`,
                          label: `${user.first_name} ${user.last_name} (${user.role})`
                        }))
                      ]}
                   />
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <Label required>Start Time</Label>
                   <div className="flex gap-2">
                     <Input 
                       type="text"
                       placeholder="--:--"
                       value={inventoryMeta.startTime}
                       onChange={(e) => {
                          setInventoryMeta({...inventoryMeta, startTime: formatTimeInput(e.target.value)});
                        }}
                       onBlur={() => setTouched({...touched, startTime: true})}
                       error={touched.startTime && !inventoryMeta.startTime ? "Start time is required" : undefined}
                     />
                     <Button 
                       variant="outline"
                       size="md"
                       onClick={() => {
                          if (inventoryMeta.startTime) {
                            setConfirmTimeModal({ isOpen: true, field: 'startTime' });
                          } else {
                            const now = new Date();
                            const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
                            setInventoryMeta({...inventoryMeta, startTime: time});
                          }
                       }}
                       className="h-[42px] px-4"
                     >
                       Now
                     </Button>
                   </div>
                 </div>
                 <div className="space-y-2">
                   <Label required>End Time</Label>
                   <div className="flex gap-2">
                     <Input 
                       type="text"
                       placeholder="--:--"
                       value={inventoryMeta.endTime}
                       onChange={(e) => {
                          setInventoryMeta({...inventoryMeta, endTime: formatTimeInput(e.target.value)});
                        }}
                       onBlur={() => setTouched({...touched, endTime: true})}
                       error={touched.endTime && (!inventoryMeta.endTime ? "End time is required" : !isTimeValid ? "End time must be after start time" : undefined)}
                     />
                     <Button 
                       variant="outline"
                       size="md"
                       onClick={() => {
                          if (inventoryMeta.endTime) {
                            setConfirmTimeModal({ isOpen: true, field: 'endTime' });
                          } else {
                            const now = new Date();
                            const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
                            setInventoryMeta({...inventoryMeta, endTime: time});
                          }
                       }}
                       className="h-[42px] px-4"
                     >
                       Now
                     </Button>
                   </div>
                 </div>
              </div>

              <div className="space-y-2">
                  <Label>Field Notes</Label>
                  <textarea 
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 rounded-xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all font-medium text-slate-900 dark:text-white placeholder:opacity-30" 
                    placeholder="Describe nest conditions, unusual findings, or environmental factors..." 
                    rows={3}
                    value={inventoryMeta.notes}
                    onChange={(e) => setInventoryMeta({...inventoryMeta, notes: e.target.value})}
                  ></textarea>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Original Metrics - Full Width */}
        <Card ref={originalMetricsRef} id="original-metrics">
          <CardContent className="p-6">
            <SectionHeading icon={BarChart3}>Original Nest Details</SectionHeading>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <MetricInput label={<><span className="lowercase">h</span> (Depth top)</>} unit="cm" value={metrics.original.h} onChange={(v) => handleMetricChange('original', 'h', v)} required step={0.5} />
                <MetricInput label="S (Dist to sea)" unit="m" value={metrics.original.S} onChange={(v) => handleMetricChange('original', 'S', v)} required={true} isInteger={true} placeholder="0" />
                {!isTopEggCheck && (
                  <>
                    <MetricInput label="H (Depth bottom)" unit="cm" value={metrics.original.H} onChange={(v) => handleMetricChange('original', 'H', v)} required={false} step={0.5} />
                    <MetricInput label="w (Width)" unit="cm" value={metrics.original.w} onChange={(v) => handleMetricChange('original', 'w', v)} required={false} step={0.5} />
                  </>
                )}
              </div>
              
              <div className="relative transition-all" id="original-coords">
                 <Label required>Original GPS Coordinates</Label>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="flex flex-col gap-1.5">
                     <span className="text-[9px] text-primary font-black uppercase tracking-wider ml-1">Lat</span>
                     <Input 
                       className="font-mono text-xs"
                       placeholder="38.xxxxx" 
                       value={metrics.original.lat}
                       onChange={(e) => handleMetricChange('original', 'lat', e.target.value)}
                       error={touched.lat && metrics.original.lat !== '' && !isLatValid(metrics.original.lat) ? "Format: xxx.xxxxx" : undefined}
                     />
                   </div>
                   <div className="flex flex-col gap-1.5">
                     <span className="text-[9px] text-primary font-black uppercase tracking-wider ml-1">Lng</span>
                     <Input 
                       className="font-mono text-xs"
                       placeholder="20.xxxxx" 
                       value={metrics.original.lng}
                       onChange={(e) => handleMetricChange('original', 'lng', e.target.value)}
                       error={touched.lng && metrics.original.lng !== '' && !isLngValid(metrics.original.lng) ? "Format: xxx.xxxxx" : undefined}
                        onBlur={() => setTouched({...touched, lng: true})}
                     />
                   </div>
                 </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {!isTopEggCheck && (
            <div className="xl:col-span-1 space-y-8">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3 text-slate-900 dark:text-white">
                    <h3 className="text-xs font-black uppercase tracking-tight">Relocation Assistance</h3>
                  </div>
                  
                  <div className="mb-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <Label className="cursor-pointer mb-0" htmlFor="topEggCheck">
                        Top Egg Check
                    </Label>
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
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 border-b-2 border-amber-500 text-slate-900 dark:text-white flex items-center justify-between">
                      <div>
                        <h4 className="text-[8px] font-black uppercase tracking-widest text-slate-500">Eggs Reburied</h4>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setTallyValue('eggsReburied', (Number(tally.eggsReburied || 0) - 1).toString())} className="w-12 h-12 text-amber-500 hover:bg-amber-500/10" type="button"><Minus className="size-5" /></Button>
                        <Input 
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="w-20 h-12 text-center font-black text-lg"
                          value={tally.eggsReburied === 0 ? '0' : tally.eggsReburied}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^[0-9]*$/.test(val)) {
                              setTallyValue('eggsReburied', val);
                            }
                          }}
                          onBlur={() => handleTallyBlur('eggsReburied')}
                        />
                        <Button variant="ghost" size="sm" onClick={() => setTallyValue('eggsReburied', (Number(tally.eggsReburied || 0) + 1).toString())} className="w-12 h-12 text-amber-500 hover:bg-amber-500/10" type="button"><Plus className="size-5" /></Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {tally.eggsReburied > 0 && (
                <Card ref={reburiedMetricsRef} id="reburied-metrics" className="border-amber-500/40 ring-1 ring-amber-500/20">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                          <h3 className="text-lg font-black uppercase tracking-tight text-amber-500">Reburied details</h3>
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={copyOriginalToReburied}
                            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg border border-amber-500/20 transition-all active:scale-95 group"
                            title="Copy Dist. to Sea & GPS from Original Details"
                          >
                            <Copy className="size-4 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Copy Original</span>
                          </Button>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <MetricInput label={<><span className="lowercase">h</span> (New Depth)</>} unit="cm" value={metrics.reburied.h} onChange={(v) => handleMetricChange('reburied', 'h', v)} color="amber" required={tally.eggsReburied > 0} step={0.5} />
                        <MetricInput label="H (New Bottom)" unit="cm" value={metrics.reburied.H} onChange={(v) => handleMetricChange('reburied', 'H', v)} color="amber" required={false} step={0.5} />
                        <MetricInput label="w (New Width)" unit="cm" value={metrics.reburied.w} onChange={(v) => handleMetricChange('reburied', 'w', v)} color="amber" required={false} step={0.5} />
                        <MetricInput label="S (Dist to sea)" unit="m" value={metrics.reburied.S} onChange={(v) => handleMetricChange('reburied', 'S', v)} color="amber" required={tally.eggsReburied > 0} isInteger={true} placeholder="e.g. 0" />
                      </div>
                      
                      <div className="relative transition-all" id="reburied-coords">
                        <Label required className="text-amber-500">Reburied GPS Coordinates</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] text-amber-500 font-black uppercase tracking-wider ml-1">Lat</span>
                            <Input 
                              className="font-mono text-xs"
                              type="number"
                        step="0.00001"
                        placeholder="38.xxxxx" 
                              value={metrics.reburied.lat}
                              onChange={(e) => handleMetricChange('reburied', 'lat', e.target.value)}
                              error={metrics.reburied.lat !== '' && !isLatValid(metrics.reburied.lat) ? "Invalid" : undefined}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] text-amber-500 font-black uppercase tracking-wider ml-1">Lng</span>
                            <Input 
                              className="font-mono text-xs"
                              type="number"
                        step="0.00001"
                        placeholder="20.xxxxx" 
                              value={metrics.reburied.lng}
                              onChange={(e) => handleMetricChange('reburied', 'lng', e.target.value)}
                              error={metrics.reburied.lng !== '' && !isLngValid(metrics.reburied.lng) ? "Invalid" : undefined}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3 text-slate-900 dark:text-white">
                      <h3 className="text-xs font-black uppercase tracking-tight text-slate-500">Hatchling Findings</h3>
                  </div>
                  <div className="space-y-3">
                      {/* Alive */}
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-2.5 border-l-4 border-emerald-500 text-slate-900 dark:text-white flex items-center justify-between">
                          <div>
                              <h4 className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Alive (Surface)</h4>
                          </div>
                          <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setTallyValue('aliveAbove', (Number(tally.aliveAbove || 0) - 1).toString())} className="w-12 h-12 text-emerald-500 hover:bg-emerald-500/10" type="button"><Minus className="size-5" /></Button>
                              <Input 
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="w-16 h-12 text-center font-black text-lg"
                                value={tally.aliveAbove === 0 ? '0' : tally.aliveAbove}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || /^[0-9]*$/.test(val)) {
                                    setTallyValue('aliveAbove', val);
                                  }
                                }}
                                onBlur={() => handleTallyBlur('aliveAbove')}
                              />
                              <Button variant="ghost" size="sm" onClick={() => setTallyValue('aliveAbove', (Number(tally.aliveAbove || 0) + 1).toString())} className="w-12 h-12 text-emerald-500 hover:bg-emerald-500/10" type="button"><Plus className="size-5" /></Button>
                          </div>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-2.5 border-l-4 border-emerald-500 text-slate-900 dark:text-white flex items-center justify-between">
                          <div>
                              <h4 className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Alive (In Nest)</h4>
                          </div>
                          <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setTallyValue('aliveWithin', (Number(tally.aliveWithin || 0) - 1).toString())} className="w-12 h-12 text-emerald-500 hover:bg-emerald-500/10" type="button"><Minus className="size-5" /></Button>
                              <Input 
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="w-16 h-12 text-center font-black text-lg"
                                value={tally.aliveWithin === 0 ? '0' : tally.aliveWithin}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || /^[0-9]*$/.test(val)) {
                                    setTallyValue('aliveWithin', val);
                                  }
                                }}
                                onBlur={() => handleTallyBlur('aliveWithin')}
                              />
                              <Button variant="ghost" size="sm" onClick={() => setTallyValue('aliveWithin', (Number(tally.aliveWithin || 0) + 1).toString())} className="w-12 h-12 text-emerald-500 hover:bg-emerald-500/10" type="button"><Plus className="size-5" /></Button>
                          </div>
                      </div>
                      
                      {/* Dead */}
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-2.5 border-l-4 border-rose-500 text-slate-900 dark:text-white flex items-center justify-between">
                          <div>
                              <h4 className="text-[8px] font-black uppercase tracking-widest text-rose-500">Dead (Surface)</h4>
                          </div>
                          <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setTallyValue('deadAbove', (Number(tally.deadAbove || 0) - 1).toString())} className="w-12 h-12 text-rose-500 hover:bg-rose-500/10" type="button"><Minus className="size-5" /></Button>
                              <Input 
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="w-16 h-12 text-center font-black text-lg"
                                value={tally.deadAbove === 0 ? '0' : tally.deadAbove}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || /^[0-9]*$/.test(val)) {
                                    setTallyValue('deadAbove', val);
                                  }
                                }}
                                onBlur={() => handleTallyBlur('deadAbove')}
                              />
                              <Button variant="ghost" size="sm" onClick={() => setTallyValue('deadAbove', (Number(tally.deadAbove || 0) + 1).toString())} className="w-12 h-12 text-rose-500 hover:bg-rose-500/10" type="button"><Plus className="size-5" /></Button>
                          </div>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-2.5 border-l-4 border-rose-500 text-slate-900 dark:text-white flex items-center justify-between">
                          <div>
                              <h4 className="text-[8px] font-black uppercase tracking-widest text-rose-500">Dead (In Nest)</h4>
                          </div>
                          <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setTallyValue('deadWithin', (Number(tally.deadWithin || 0) - 1).toString())} className="w-12 h-12 text-rose-500 hover:bg-rose-500/10" type="button"><Minus className="size-5" /></Button>
                              <Input 
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="w-16 h-12 text-center font-black text-lg"
                                value={tally.deadWithin === 0 ? '0' : tally.deadWithin}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || /^[0-9]*$/.test(val)) {
                                    setTallyValue('deadWithin', val);
                                  }
                                }}
                                onBlur={() => handleTallyBlur('deadWithin')}
                              />
                              <Button variant="ghost" size="sm" onClick={() => setTallyValue('deadWithin', (Number(tally.deadWithin || 0) + 1).toString())} className="w-12 h-12 text-rose-500 hover:bg-rose-500/10" type="button"><Plus className="size-5" /></Button>
                          </div>
                      </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className={isTopEggCheck ? "xl:col-span-3" : "xl:col-span-2"}>
            {isTopEggCheck ? (
              <div className="mb-8 bg-white dark:bg-[#1c2127] p-6 rounded-2xl border border-blue-500/30 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Info className="size-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Top Egg Check Mode</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Only recording top egg depth. Inventory analysis is hidden.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsTopEggCheck(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Switch to Full Inventory
                </button>
              </div>
            ) : null}
            
            {!isTopEggCheck && (
              <Card ref={embryoTableRef} id="embryo-analysis">
                <CardContent className="p-0">
                  <div className="p-6 border-b border-primary/5 flex justify-between items-center text-slate-900 dark:text-white">
                    <div className="flex items-center gap-4">
                      <SectionHeading className="mb-0">Embryonic Stage Analysis</SectionHeading>
                      <Button 
                        variant={isRecording ? "destructive" : "outline"}
                        size="sm"
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isAnalyzing}
                        className={isRecording ? 'animate-pulse' : ''}
                      >
                        {isRecording ? <Square className="size-3.5 mr-2" /> : (isAnalyzing ? <RefreshCw className="size-3.5 mr-2 animate-spin" /> : <Mic className="size-3.5 mr-2" />)}
                        {isRecording ? 'Stop Recording' : (isAnalyzing ? 'Analyzing...' : 'Record Audio')}
                      </Button>
                    </div>
                    {isTopEggCheck && (
                        <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">Check Override</span>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr>
                          <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 px-2 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Stage</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Count</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Black Fungus</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Pink Bacteria</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Green Bacteria</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(Object.keys(stages) as Array<keyof typeof stages>).map((key) => (
                          <tr key={key} className="group hover:bg-slate-50/50 dark:hover:bg-primary/5 transition-colors text-slate-900 dark:text-white">
                            <td className="sticky left-0 z-10 bg-white dark:bg-[#1c2127] group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-2 py-4 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                               <p className="text-xs font-black uppercase tracking-tight">{String(key).replace(/([A-Z])/g, ' $1').trim()}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                               <div className="flex items-center justify-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-white/5 mx-auto w-fit">
                                   <Button 
                                     variant="ghost" 
                                     size="sm" 
                                     onClick={() => {
                                       const current = Number(stages[key].count || 0);
                                       setStageValue(key, 'count', Math.max(0, current - 1).toString());
                                     }}
                                     className="w-8 h-8 text-slate-400 hover:text-primary"
                                     type="button"
                                     disabled={Number(stages[key].count || 0) === 0}
                                   >
                                     <Minus className="size-3" />
                                   </Button>
                                  <input 
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="w-14 h-8 text-center font-bold text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-0 focus:border-primary"
                                    value={String(stages[key].count || '0')}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '' || /^[0-9]*$/.test(val)) {
                                        setStageValue(key, 'count', val);
                                      }
                                    }}
                                    onBlur={() => handleStageBlur(key, 'count')}
                                  />
                                   <Button 
                                     variant="ghost" 
                                     size="sm" 
                                     onClick={() => {
                                       const current = Number(stages[key].count || 0);
                                       setStageValue(key, 'count', (current + 1).toString());
                                     }}
                                     className="w-8 h-8 text-slate-400 hover:text-primary"
                                     type="button"
                                   >
                                     <Plus className="size-3" />
                                   </Button>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-center">{key !== 'pippedAlive' && (
                               <div className="flex items-center justify-center gap-1 bg-zinc-900 rounded-lg p-1 border border-white/10 mx-auto w-fit">
                                   <Button 
                                     variant="ghost" 
                                     size="sm" 
                                     onClick={() => {
                                       const current = Number((stages[key] as any).black || 0);
                                       setStageValue(key, 'black', Math.max(0, current - 1).toString());
                                     }}
                                     className="w-8 h-8 text-white/50 hover:text-white"
                                     type="button"
                                     disabled={Number((stages[key] as any).black || 0) === 0}
                                   >
                                     <Minus className="size-3" />
                                   </Button>
                                  <input 
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="w-14 h-8 text-center text-white font-bold text-sm bg-zinc-800 border border-zinc-700 rounded focus:ring-0 focus:border-white"
                                    value={String((stages[key] as any).black || '0')}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '' || /^[0-9]*$/.test(val)) {
                                        setStageValue(key, 'black', val);
                                      }
                                    }}
                                    onBlur={() => handleStageBlur(key, 'black')}
                                  />
                                   <Button 
                                     variant="ghost" 
                                     size="sm" 
                                     onClick={() => {
                                       const current = Number((stages[key] as any).black || 0);
                                       setStageValue(key, 'black', (current + 1).toString());
                                     }}
                                     className="w-8 h-8 text-white/50 hover:text-white"
                                     type="button"
                                   >
                                     <Plus className="size-3" />
                                   </Button>
                               </div>
                            )}</td>
                            <td className="px-6 py-4 text-center">{key !== 'pippedAlive' && (
                               <div className="flex items-center justify-center gap-1 bg-rose-900 rounded-lg p-1 border border-white/10 mx-auto w-fit">
                                   <Button 
                                     variant="ghost" 
                                     size="sm" 
                                     onClick={() => {
                                       const current = Number((stages[key] as any).pink || 0);
                                       setStageValue(key, 'pink', Math.max(0, current - 1).toString());
                                     }}
                                     className="w-8 h-8 text-white/50 hover:text-white"
                                     type="button"
                                     disabled={Number((stages[key] as any).pink || 0) === 0}
                                   >
                                     <Minus className="size-3" />
                                   </Button>
                                  <input 
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="w-14 h-8 text-center text-white font-bold text-sm bg-rose-950 border border-rose-800 rounded focus:ring-0 focus:border-white"
                                    value={String((stages[key] as any).pink || '0')}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '' || /^[0-9]*$/.test(val)) {
                                        setStageValue(key, 'pink', val);
                                      }
                                    }}
                                    onBlur={() => handleStageBlur(key, 'pink')}
                                  />
                                   <Button 
                                     variant="ghost" 
                                     size="sm" 
                                     onClick={() => {
                                       const current = Number((stages[key] as any).pink || 0);
                                       setStageValue(key, 'pink', (current + 1).toString());
                                     }}
                                     className="w-8 h-8 text-white/50 hover:text-white"
                                     type="button"
                                   >
                                     <Plus className="size-3" />
                                   </Button>
                               </div>
                            )}</td>
                            <td className="px-6 py-4 text-center">{key !== 'pippedAlive' && (
                               <div className="flex items-center justify-center gap-1 bg-emerald-900 rounded-lg p-1 border border-white/10 mx-auto w-fit">
                                   <Button 
                                     variant="ghost" 
                                     size="sm" 
                                     onClick={() => {
                                       const current = Number((stages[key] as any).green || 0);
                                       setStageValue(key, 'green', Math.max(0, current - 1).toString());
                                     }}
                                     className="w-8 h-8 text-white/50 hover:text-white"
                                     type="button"
                                     disabled={Number((stages[key] as any).green || 0) === 0}
                                   >
                                     <Minus className="size-3" />
                                   </Button>
                                  <input 
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="w-14 h-8 text-center text-white font-bold text-sm bg-emerald-950 border border-emerald-800 rounded focus:ring-0 focus:border-white"
                                    value={String((stages[key] as any).green || '0')}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '' || /^[0-9]*$/.test(val)) {
                                        setStageValue(key, 'green', val);
                                      }
                                    }}
                                    onBlur={() => handleStageBlur(key, 'green')}
                                  />
                                   <Button 
                                     variant="ghost" 
                                     size="sm" 
                                     onClick={() => {
                                       const current = Number((stages[key] as any).green || 0);
                                       setStageValue(key, 'green', (current + 1).toString());
                                     }}
                                     className="w-8 h-8 text-white/50 hover:text-white"
                                     type="button"
                                   >
                                     <Plus className="size-3" />
                                   </Button>
                               </div>
                            )}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Banner Layout Optimized for Vertical Mobile with WORD 'SAVE' */}
      <footer className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white/95 dark:bg-[#111418]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-4 py-3 z-50 shadow-[0_-15px_30px_rgba(0,0,0,0.15)] flex flex-col gap-3">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 w-full">
          {/* Error Message - Top on Mobile, Middle on Desktop */}
          {!isReadyForSubmission && errorInfo && hasAttemptedSave && (
            <div className="order-1 lg:order-2 w-full">
              <button 
                onClick={() => scrollToField(errorInfo.targetId)}
                className="w-full bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 rounded-xl flex items-center gap-3 hover:bg-rose-500/20 active:scale-[0.99] transition-all group border-dashed"
              >
                <AlertCircle className="text-rose-500 size-5 shrink-0 group-hover:animate-bounce" />
                <div className="flex flex-col text-left overflow-hidden flex-1">
                  <span className="text-[7px] font-black uppercase tracking-[0.1em] text-rose-400 opacity-80 leading-tight">Action Required</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 leading-tight">
                    {errorInfo.message}
                  </span>
                </div>
                <Send className="text-rose-500 size-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          )}
        </div>
      </footer>

      {showCancelConfirm && (
        <Modal isOpen={showCancelConfirm} onClose={() => setShowCancelConfirm(false)} title="Discard Progress?">
          <div className="flex flex-col items-center text-center">
            <p className="text-slate-400 text-sm leading-relaxed mb-8">Unsaved analysis for {id} will be lost.</p>
            <div className="flex flex-col w-full gap-3">
              <Button variant="destructive" size="lg" onClick={onBack} className="w-full">Discard Changes</Button>
              <Button variant="outline" size="lg" onClick={() => setShowCancelConfirm(false)} className="w-full">Continue Editing</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Time Overwrite Confirmation Modal */}
      <Modal
        isOpen={confirmTimeModal.isOpen}
        onClose={() => setConfirmTimeModal({ isOpen: false, field: null })}
        title="Confirm Overwrite"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmTimeModal({ isOpen: false, field: null })}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                const now = new Date();
                const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
                if (confirmTimeModal.field === 'startTime') {
                  setInventoryMeta({...inventoryMeta, startTime: time});
                } else if (confirmTimeModal.field === 'endTime') {
                  setInventoryMeta({...inventoryMeta, endTime: time});
                }
                setConfirmTimeModal({ isOpen: false, field: null });
              }}
            >
              Overwrite
            </Button>
          </>
        }
      >
        <BodyText>
          Are you sure you want to overwrite the existing {confirmTimeModal.field === 'startTime' ? 'start' : 'end'} time 
          ({confirmTimeModal.field ? inventoryMeta[confirmTimeModal.field] : ''}) 
          with the current time ({new Date().getHours().toString().padStart(2, '0') + ':' + new Date().getMinutes().toString().padStart(2, '0')})?
        </BodyText>
      </Modal>
    </div>
  );
};

export default NestInventory;
