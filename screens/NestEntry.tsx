
import React, { useState, useEffect, useRef, useId } from 'react';
import { DatabaseConnection, NestData } from '../services/Database';

interface NestEntryProps {
  onBack: () => void;
}

const beachData: Record<string, { abbreviation: string }> = {
  'Kyparissia Bay': { abbreviation: 'KY' },
  'Rethymno, Crete': { abbreviation: 'RE' },
  'Lakonikos Bay': { abbreviation: 'LA' },
  'Zakynthos': { abbreviation: 'ZA' },
};

const relocationReasons = [
  "Risk of inundation (High tide/Storm)",
  "Risk of predation",
  "Human traffic / Heavy disturbance",
  "Light pollution",
  "Erosion / Shoreline instability",
  "Scientific research protocol",
  "Other"
];

// Enforce exact format: up to 3 digits before dot (to allow 0 padding or flexible entry), exactly 5 after.
const LAT_REGEX = /^-?\d{1,3}\.\d{5}$/;
const LNG_REGEX = /^-?\d{1,3}\.\d{5}$/;

const isLatValid = (val: string) => {
  const num = parseFloat(val);
  return !isNaN(num) && num >= -90 && num <= 90 && LAT_REGEX.test(val);
};

const isLngValid = (val: string) => {
  const num = parseFloat(val);
  return !isNaN(num) && num >= -180 && num <= 180 && LNG_REGEX.test(val);
};

const MetricInput: React.FC<{
  label: React.ReactNode;
  unit: string;
  placeholder?: string;
  required?: boolean;
  color?: 'primary' | 'amber';
  value: string;
  onChange: (val: string) => void;
  isInteger?: boolean;
  step?: number;
  decimalPlaces?: number;
}> = ({ label, unit, placeholder = "0.0", required = false, color = 'primary', value, onChange, isInteger = false, step: customStep, decimalPlaces }) => {
  const id = useId();
  const decimals = isInteger ? 0 : (decimalPlaces !== undefined ? decimalPlaces : 2);
  const stepVal = customStep !== undefined ? customStep : (isInteger ? 1 : 0.1);
  
  const step = (delta: number) => {
    const current = parseFloat(value) || 0;
    const next = Math.max(0, current + delta);
    onChange(next.toFixed(decimals));
  };

  const colorClasses = color === 'primary' ? 'focus:ring-primary focus:border-primary' : 'focus:ring-amber-500 focus:border-amber-500';
  const buttonColor = color === 'primary' ? 'text-primary' : 'text-amber-500';

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
        {label} {required && <span className="text-rose-500 font-bold">*</span>}
      </label>
      <div className="relative group">
        <input 
          id={id}          className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-12 pl-4 pr-20 outline-none transition-all font-mono text-white text-sm ${colorClasses}`}
          placeholder={isInteger ? "0" : (decimals === 1 ? "0.0" : placeholder)}
          type="number"
          step={isInteger ? "1" : (customStep ? customStep.toString() : (decimals === 1 ? "0.1" : "0.01"))}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="absolute right-10 top-0 bottom-0 flex items-center pr-2 pointer-events-none">
          <span className="text-slate-500 text-[9px] font-mono font-bold uppercase">{unit}</span>
        </div>
        <div className="absolute right-1.5 top-1.5 bottom-1.5 flex flex-col gap-0.5">
          <button 
            type="button"
            onClick={() => step(stepVal)}
            className={`flex-1 px-1.5 bg-slate-200 dark:bg-slate-800 rounded-t flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors ${buttonColor}`}
          >
            <span className="material-symbols-outlined text-xs font-bold">add</span>
          </button>
          <button 
            type="button"
            onClick={() => step(-stepVal)}
            className={`flex-1 px-1.5 bg-slate-200 dark:bg-slate-800 rounded-b flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors ${buttonColor}`}
          >
            <span className="material-symbols-outlined text-xs font-bold">remove</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const NestEntry: React.FC<NestEntryProps> = ({ onBack }) => {
  const [existingNests, setExistingNests] = useState<any[]>([]);
  const [isCalculatingId, setIsCalculatingId] = useState(false);

  const [formData, setFormData] = useState({
    beach: 'Kyparissia Bay',
    nestId: '',
    date: new Date().toISOString().split('T')[0],
    relocated: false,
    relocationReason: '',
    caged: true,
    eggCount: ''
  });

  const [metrics, setMetrics] = useState({ h: '', H: '', w: '', S: '' });
  const [coords, setCoords] = useState({ lat: '', lng: '' });
  
  const [relocatedMetrics, setRelocatedMetrics] = useState({ h: '', H: '', w: '', S: '' });
  const [relocatedCoords, setRelocatedCoords] = useState({ lat: '', lng: '' });

  const [triangulation, setTriangulation] = useState([
    { desc: '', dist: '', lat: '', lng: '' },
    { desc: '', dist: '', lat: '', lng: '' }
  ]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [capturedSketch, setCapturedSketch] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawingActive, setDrawingActive] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all nests on mount to calculate IDs
  useEffect(() => {
    const fetchNests = async () => {
      try {
        setIsCalculatingId(true);
        const data = await DatabaseConnection.getNests();
        setExistingNests(data || []);
      } catch (err) {
        console.error("Failed to fetch existing nests for ID calculation", err);
      } finally {
        setIsCalculatingId(false);
      }
    };
    fetchNests();
  }, []);

  // Recalculate ID when beach, relocated status or existingNests changes
  useEffect(() => {
    if (isCalculatingId) return;

    const data = beachData[formData.beach];
    if (data) {
      const abbr = data.abbreviation;
      
      // 1. Extract all existing numbers for this beach
      const existingNumbers = existingNests
        .filter((n: any) => n.nest_code && n.nest_code.startsWith(abbr))
        .map((n: any) => {
          let suffix = n.nest_code.substring(abbr.length);
          // Handle old format with hyphen if present
          if (suffix.startsWith('-')) suffix = suffix.substring(1);
          
          // Extract leading digits (ignore 'R' suffix)
          const match = suffix.match(/^(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n: number) => n > 0)
        .sort((a: number, b: number) => a - b); // Ascending sort

      // 2. Find the lowest missing number starting from 1
      let nextNum = 1;
      for (const num of existingNumbers) {
        if (num === nextNum) {
          nextNum++;
        } else if (num > nextNum) {
          // Found a gap
          break;
        }
      }

      let newId = `${abbr}${nextNum}`;
      if (formData.relocated) {
          newId += 'R';
      }

      setFormData(prev => ({ ...prev, nestId: newId }));
    }
  }, [formData.beach, formData.relocated, existingNests, isCalculatingId]);

  const updateTriPoint = (index: number, field: string, val: string) => {
    const next = [...triangulation];
    next[index] = { ...next[index], [field]: val };
    setTriangulation(next);
  };

  // Logic check: h must be < H if both are present
  const isDepthLogicValid = (h: string, H: string) => {
    if (h && H) {
      return parseFloat(h) < parseFloat(H);
    }
    return true; // Valid if one or both are missing (assuming required checks handle missing values)
  };

  const validation = {
    beach: formData.beach !== '',
    date: formData.date !== '',
    metrics: metrics.h !== '',
    metricsLogic: isDepthLogicValid(metrics.h, metrics.H),
    nestCoords: isLatValid(coords.lat) && isLngValid(coords.lng),
    relocatedMetrics: !formData.relocated || (relocatedMetrics.h !== '' && relocatedMetrics.H !== '' && relocatedMetrics.w !== '' && relocatedMetrics.S !== ''),
    relocatedMetricsLogic: !formData.relocated || isDepthLogicValid(relocatedMetrics.h, relocatedMetrics.H),
    relocatedCoords: !formData.relocated || (isLatValid(relocatedCoords.lat) && isLngValid(relocatedCoords.lng)),
    relocationReason: !formData.relocated || formData.relocationReason !== '',
    triangulation: triangulation.every(p => 
      p.desc !== '' && p.dist !== '' && isLatValid(p.lat) && isLngValid(p.lng)
    ),
  };

  const isFormValid = Object.values(validation).every(Boolean);

  const getErrorInfo = () => {
    if (!validation.beach) return { message: "Beach Required", targetId: "beach-select" };
    if (!validation.date) return { message: "Date Required", targetId: "date-input" };
    if (!validation.metrics) return { message: "Depth (h) Required", targetId: "original-metrics" };
    if (!validation.metricsLogic) return { message: "Depth Logic: h must be < H", targetId: "original-metrics" };
    if (!isLatValid(coords.lat)) return { message: "Lat Format: xxx.xxxxx", targetId: "original-coords" };
    if (!isLngValid(coords.lng)) return { message: "Lng Format: xxx.xxxxx", targetId: "original-coords" };
    if (formData.relocated && !validation.relocationReason) return { message: "Reason Required", targetId: "relocation-reason-select" };
    if (formData.relocated && !validation.relocatedMetrics) return { message: "Relocated Data Required", targetId: "relocated-metrics" };
    if (formData.relocated && !validation.relocatedMetricsLogic) return { message: "Relocated Logic: h must be < H", targetId: "relocated-metrics" };
    if (formData.relocated && !isLatValid(relocatedCoords.lat)) return { message: "Relocated Lat: xxx.xxxxx", targetId: "relocated-coords" };
    if (formData.relocated && !isLngValid(relocatedCoords.lng)) return { message: "Relocated Lng: xxx.xxxxx", targetId: "relocated-coords" };
    
    const badTriIdx = triangulation.findIndex(p => p.desc === '' || p.dist === '' || !isLatValid(p.lat) || !isLngValid(p.lng));
    if (badTriIdx !== -1) {
      return { message: `Tri Point ${badTriIdx + 1} Format Error (5 decimals)`, targetId: "triangulation-section" };
    }
    
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const activeMetrics = formData.relocated ? relocatedMetrics : metrics;
      const activeCoords = formData.relocated ? relocatedCoords : coords;
      
      let finalNotes = "";
      if (formData.relocated) {
        finalNotes += `Relocation Reason: ${formData.relocationReason}. `;
        if (formData.eggCount) finalNotes += `Eggs Moved: ${formData.eggCount}. `;
        finalNotes += `Original Location: ${coords.lat}, ${coords.lng}. `;
        finalNotes += `Original Metrics: h=${metrics.h}, H=${metrics.H}, w=${metrics.w}, S=${metrics.S}. `;
      }
      
      const payload: NestData = {
        nest_code: formData.nestId,
        // Map form eggCount to total_num_eggs.
        // Backend handles copying total to current if current is missing.
        total_num_eggs: formData.relocated && formData.eggCount ? parseInt(formData.eggCount) : null,
        
        depth_top_egg_h: Number(activeMetrics.h),
        depth_bottom_chamber_h: activeMetrics.H ? Number(activeMetrics.H) : null,
        distance_to_sea_s: Number(activeMetrics.S),
        width_w: activeMetrics.w ? Number(activeMetrics.w) : null,
        gps_lat: Number(activeCoords.lat),
        gps_long: Number(activeCoords.lng),

        tri_tl_desc: triangulation[0].desc || null,
        tri_tl_lat: triangulation[0].lat ? Number(triangulation[0].lat) : null,
        tri_tl_long: triangulation[0].lng ? Number(triangulation[0].lng) : null,
        tri_tl_distance: triangulation[0].dist ? Number(triangulation[0].dist) : null,

        tri_tr_desc: triangulation[1].desc || null,
        tri_tr_lat: triangulation[1].lat ? Number(triangulation[1].lat) : null,
        tri_tr_long: triangulation[1].lng ? Number(triangulation[1].lng) : null,
        tri_tr_distance: triangulation[1].dist ? Number(triangulation[1].dist) : null,

        status: 'incubating',
        relocated: formData.relocated,
        date_found: formData.date,
        beach: formData.beach,
        notes: finalNotes || null
      };

      await DatabaseConnection.createNest(payload);
      alert('Nest entry saved successfully to database.');
      onBack();
    } catch (e: any) {
      console.error(e);
      alert('Failed to save nest: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Drawing Logic
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setDrawingActive(true);
    const { x, y } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#137fec';
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setDrawingActive(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCapturedSketch(canvas.toDataURL('image/png'));
    setIsDrawing(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark font-display text-white relative">
      <header className="border-b border-primary/10 bg-background-light dark:bg-[#111418] sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto pl-16 pr-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-black tracking-tight text-white uppercase">New Nest Entry</h1>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-6 py-8 pb-48 overflow-y-auto space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-8">
            <div className="bg-white dark:bg-[#111c26] border border-slate-200 dark:border-primary/20 rounded-xl p-6 shadow-xl transition-all" id="primary-info">
              <div className="flex items-center gap-2 mb-6 text-primary">
                <span className="material-symbols-outlined">analytics</span>
                <h3 className="text-lg font-black uppercase tracking-tight">Primary Information</h3>
              </div>
              <div className="space-y-6">
                <div className="space-y-2" id="beach-select">
                  <label className="block text-[10px] font-black text-primary uppercase tracking-widest">Beach Location</label>
                  <select 
                    value={formData.beach}
                    onChange={(e) => setFormData({...formData, beach: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-12 px-4 text-lg font-bold focus:ring-2 focus:ring-primary outline-none text-white appearance-none cursor-pointer"
                  >
                    {Object.keys(beachData).map(beach => (
                      <option key={beach} value={beach}>{beach}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-primary uppercase tracking-widest">Nest ID / Code</label>
                    <div className="relative">
                      <input 
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-12 px-4 text-lg font-mono font-bold text-white focus:ring-2 focus:ring-primary outline-none" 
                        value={formData.nestId} 
                        readOnly={!isCalculatingId} 
                        // Allow manual override if needed but primarily readOnly
                        onChange={(e) => setFormData({...formData, nestId: e.target.value})}
                        placeholder={isCalculatingId ? "Generating..." : "e.g. KY1"}
                      />
                      {isCalculatingId && (
                        <div className="absolute right-3 top-3.5">
                          <span className="block size-4 border-2 border-slate-600 border-t-primary rounded-full animate-spin"></span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Auto-assigned: Lowest available number for selected beach.</p>
                  </div>
                  <div className="space-y-2" id="date-input">
                    <label className="block text-[10px] font-black text-primary uppercase tracking-widest">Observation Date</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-12 px-4 text-lg font-bold text-white" type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111c26] border border-slate-200 dark:border-primary/10 rounded-xl p-6 shadow-xl" id="sketch-info">
              <div className="flex items-center gap-2 mb-6 text-primary">
                <span className="material-symbols-outlined">draw</span>
                <h3 className="text-lg font-black uppercase tracking-tight">Track Sketch</h3>
              </div>
              <div className="space-y-4">
                <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl aspect-[16/9] overflow-hidden bg-slate-50 dark:bg-slate-900/30 group">
                  {capturedSketch ? (
                    <img src={capturedSketch} alt="Captured track sketch" className="w-full h-full object-contain" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <span className="material-symbols-outlined text-4xl text-slate-400">gesture</span>
                      <p className="text-sm font-bold text-slate-500">No sketch captured yet</p>
                    </div>
                  )}
                </div>
                <button onClick={() => setIsDrawing(true)} className="w-full py-3 border border-primary/50 text-primary rounded-lg font-black uppercase tracking-widest text-xs hover:bg-primary/10 transition-all flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">edit</span> Digital Drawing Area
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white dark:bg-[#111c26] border border-slate-200 dark:border-primary/10 rounded-xl p-6 shadow-xl transition-all" id="original-metrics">
              <div className="flex items-center gap-2 mb-6 text-primary">
                <span className="material-symbols-outlined">architecture</span>
                <h3 className="text-lg font-black uppercase tracking-tight">Original Nest Metrics</h3>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <MetricInput label={<><span className="lowercase">h</span> (Depth top)</>} unit="cm" value={metrics.h} onChange={(v) => setMetrics({...metrics, h: v})} required step={0.5} decimalPlaces={1} />
                  <MetricInput label="H (Depth bottom)" unit="cm" value={metrics.H} onChange={(v) => setMetrics({...metrics, H: v})} required={false} step={0.5} decimalPlaces={1} />
                  <MetricInput label="w (Width)" unit="cm" value={metrics.w} onChange={(v) => setMetrics({...metrics, w: v})} required={false} step={0.5} decimalPlaces={1} />
                  <MetricInput label="S (Dist to sea)" unit="m" value={metrics.S} onChange={(v) => setMetrics({...metrics, S: v})} required={false} isInteger={true} placeholder="0" />
                </div>
                <div className="relative transition-all" id="original-coords">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    Original GPS Coordinates <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <span className="absolute left-2.5 top-3.5 text-[9px] text-primary font-black uppercase">N</span>
                      <input 
                        className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-lg h-12 pl-10 pr-2 outline-none transition-all font-mono text-white text-xs ${coords.lat !== '' && !isLatValid(coords.lat) ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-primary'}`} 
                        placeholder="037.44670" 
                        value={coords.lat}
                        onChange={(e) => setCoords({...coords, lat: e.target.value})}
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-3.5 text-[9px] text-primary font-black uppercase">Lng</span>
                      <input 
                        className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-lg h-12 pl-10 pr-2 outline-none transition-all font-mono text-white text-xs ${coords.lng !== '' && !isLngValid(coords.lng) ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-primary'}`} 
                        placeholder="021.61630" 
                        value={coords.lng}
                        onChange={(e) => setCoords({...coords, lng: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111c26] border border-slate-200 dark:border-primary/10 rounded-xl p-6 shadow-xl" id="management-actions">
              <div className="flex items-center gap-2 mb-6 text-primary">
                <span className="material-symbols-outlined">security</span>
                <h3 className="text-lg font-black uppercase tracking-tight">Management Actions</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Relocated</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={formData.relocated} onChange={(e) => setFormData({...formData, relocated: e.target.checked})} />
                    <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>
              </div>
            </div>

            {formData.relocated && (
              <div className="bg-white dark:bg-[#111c26] border rounded-xl p-6 shadow-xl transition-all duration-500 border-amber-500/40 ring-1 ring-amber-500/20" id="relocated-metrics">
                <div className="flex items-center gap-2 mb-6 text-amber-500">
                  <span className="material-symbols-outlined">move_up</span>
                  <h3 className="text-lg font-black uppercase tracking-tight">Relocated Nest Metrics</h3>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2" id="relocation-reason-select">
                      <label className="block text-[10px] font-black text-amber-500 uppercase tracking-widest">Reason for Relocation <span className="text-rose-500">*</span></label>
                      <div className="relative">
                        <select 
                          value={formData.relocationReason}
                          onChange={(e) => setFormData({...formData, relocationReason: e.target.value})}
                          className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-lg h-12 px-4 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none text-white appearance-none cursor-pointer ${formData.relocated && formData.relocationReason === '' ? 'border-rose-500/50' : 'border-slate-300 dark:border-slate-700'}`}
                        >
                          <option value="" disabled>Select a reason...</option>
                          {relocationReasons.map(reason => (
                            <option key={reason} value={reason}>{reason}</option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-4 top-3 text-slate-500 pointer-events-none">expand_more</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-amber-500 uppercase tracking-widest">Number of Eggs Translocated</label>
                        <input 
                           type="number"
                           className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-12 px-4 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none text-white placeholder:text-slate-500"
                           value={formData.eggCount}
                           onChange={(e) => setFormData({...formData, eggCount: e.target.value})}
                           placeholder="0"
                        />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <MetricInput 
                      label={<><span className="lowercase">h</span> (New Depth top)</>} 
                      unit="cm" 
                      color="amber" 
                      value={relocatedMetrics.h} 
                      onChange={(v) => setRelocatedMetrics({...relocatedMetrics, h: v})}
                      required={formData.relocated}
                    />
                    <MetricInput 
                      label="H (New Depth bottom)" 
                      unit="cm" 
                      color="amber" 
                      value={relocatedMetrics.H} 
                      onChange={(v) => setRelocatedMetrics({...relocatedMetrics, H: v})}
                      required={formData.relocated}
                    />
                    <MetricInput 
                      label="w (New Width)" 
                      unit="cm" 
                      color="amber" 
                      value={relocatedMetrics.w} 
                      onChange={(v) => setRelocatedMetrics({...relocatedMetrics, w: v})}
                      required={formData.relocated}
                    />
                    <MetricInput 
                      label="S (New Dist to sea)" 
                      unit="m" 
                      color="amber" 
                      value={relocatedMetrics.S} 
                      onChange={(v) => setRelocatedMetrics({...relocatedMetrics, S: v})}
                      required={formData.relocated}
                      isInteger={true}
                      placeholder="0"
                    />
                  </div>
                  <div className="relative transition-all" id="relocated-coords">
                    <label className="block text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                      Relocated GPS Coordinates <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <span className="absolute left-2.5 top-3.5 text-[9px] text-amber-500 font-black uppercase">Lat</span>
                        <input 
                          className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-lg h-12 pl-10 pr-2 outline-none transition-all font-mono text-white text-xs ${relocatedCoords.lat !== '' && !isLatValid(relocatedCoords.lat) ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-amber-500'}`} 
                          placeholder="37.44670" 
                          value={relocatedCoords.lat}
                          onChange={(e) => setRelocatedCoords({...relocatedCoords, lat: e.target.value})}
                        />
                      </div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-3.5 text-[9px] text-amber-500 font-black uppercase">Lng</span>
                        <input 
                          className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-lg h-12 pl-10 pr-2 outline-none transition-all font-mono text-white text-xs ${relocatedCoords.lng !== '' && !isLngValid(relocatedCoords.lng) ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-amber-500'}`} 
                          placeholder="021.61630" 
                          value={relocatedCoords.lng}
                          onChange={(e) => setRelocatedCoords({...relocatedCoords, lng: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#111c26] border border-slate-200 dark:border-primary/10 rounded-xl p-6 shadow-xl transition-all" id="triangulation-section">
          <div className="flex items-center gap-2 mb-6 text-primary">
            <span className="material-symbols-outlined">explore</span>
            <h3 className="text-lg font-black uppercase tracking-tight">Triangulation Points</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {triangulation.map((point, idx) => (
              <div key={idx} className="space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-black uppercase rounded tracking-widest">Triangulation Point 0{idx + 1}</span>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description <span className="text-rose-500">*</span></label>
                    <input 
                      type="text" 
                      value={point.desc}
                      onChange={(e) => updateTriPoint(idx, 'desc', e.target.value)}
                      placeholder="e.g. Blue Stake #4 or Landmark tree"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg h-10 px-4 text-xs font-bold text-white focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <MetricInput 
                      label="Distance to Nest" 
                      unit="m" 
                      placeholder="0.00"
                      value={point.dist}
                      onChange={(v) => updateTriPoint(idx, 'dist', v)}
                      required
                    />
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Coordinates <span className="text-rose-500">*</span></label>
                      <div className="grid grid-cols-2 gap-2 min-w-0">
                        <div className="relative">
                          <span className="absolute left-2.5 top-3.5 text-[9px] text-primary/60 font-black uppercase">Lat</span>
                          <input 
                            type="text" 
                            placeholder="37.44670" 
                            value={point.lat}
                            onChange={(e) => updateTriPoint(idx, 'lat', e.target.value)}
                            className={`w-full bg-white dark:bg-slate-800 border rounded-lg h-12 pl-10 pr-2 text-[10px] font-mono font-bold text-white outline-none transition-all ${point.lat !== '' && !isLatValid(point.lat) ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-primary'}`} 
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-3.5 text-[9px] text-primary/60 font-black uppercase">Lng</span>
                          <input 
                            type="text" 
                            placeholder="021.61630" 
                            value={point.lng}
                            onChange={(e) => updateTriPoint(idx, 'lng', e.target.value)}
                            className={`w-full bg-white dark:bg-slate-800 border rounded-lg h-12 pl-10 pr-2 text-[10px] font-mono font-bold text-white outline-none transition-all ${point.lng !== '' && !isLngValid(point.lng) ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-1 focus:ring-primary'}`} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {isDrawing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsDrawing(false)}></div>
          <div className="relative bg-[#111c26] border border-white/10 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col h-[80vh]">
            <header className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <h3 className="font-black uppercase tracking-tight text-white">Track Path Drawing</h3>
              <div className="flex gap-2">
                <button onClick={clearCanvas} className="px-4 py-2 text-xs font-black uppercase text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1">Clear</button>
                <button onClick={() => setIsDrawing(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><span className="material-symbols-outlined">close</span></button>
              </div>
            </header>
            <div className="flex-1 bg-white relative overflow-hidden flex items-center justify-center">
              <canvas ref={canvasRef} width={1200} height={675} className="w-full h-full object-contain touch-none cursor-crosshair bg-white" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
            </div>
            <footer className="p-4 bg-white/5 border-t border-white/5 flex justify-end gap-3">
              <button onClick={() => setIsDrawing(false)} className="px-6 py-2.5 text-xs font-black uppercase text-slate-400 hover:text-white">Cancel</button>
              <button onClick={saveSketch} className="px-8 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-black uppercase shadow-lg shadow-primary/20 transition-all flex items-center gap-2">Capture Sketch</button>
            </footer>
          </div>
        </div>
      )}

      {/* Banner Layout Optimized for Vertical Mobile with WORD 'SAVE' */}
      <footer className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white/95 dark:bg-[#111418]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-4 py-3 z-50 shadow-[0_-15px_30px_rgba(0,0,0,0.15)] flex flex-col sm:flex-row items-center justify-between min-h-[5.5rem] gap-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between w-full gap-2 sm:gap-8">
          {/* Action Group: Word 'SAVE' visible on all devices */}
          <div className="flex items-center gap-2 shrink-0">
            <button 
              disabled={!isFormValid || isSaving}
              onClick={handleSave}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 min-w-[90px] sm:min-w-[140px] rounded-xl font-black uppercase tracking-widest shadow-xl transition-all text-xs flex items-center justify-center gap-2 ${isFormValid && !isSaving ? 'bg-primary text-white shadow-primary/30 hover:scale-[1.03] active:scale-[0.97]' : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'}`}
            >
              {isSaving ? (
                <>
                   <span className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                   <span>SAVING...</span>
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

          <div className="flex-grow flex justify-center overflow-hidden">
            {!isFormValid && errorInfo && (
              <button 
                onClick={() => scrollToField(errorInfo.targetId)}
                className="bg-rose-500/10 border border-rose-500/50 px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 animate-in slide-in-from-bottom-2 duration-300 w-full max-w-full hover:bg-rose-500/20 active:scale-[0.98] transition-all group border-dashed"
              >
                <span className="material-symbols-outlined text-rose-500 text-lg sm:text-xl shrink-0 group-hover:animate-bounce">priority_high</span>
                <div className="flex flex-col text-left overflow-hidden">
                  <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-[0.1em] text-rose-400 opacity-80 leading-tight">Review Field</span>
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

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowCancelConfirm(false)}></div>
          <div className="relative bg-[#111c26] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-8 flex flex-col items-center text-center">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Discard Progress?</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">Unsaved data for the new nest entry will be lost.</p>
            <div className="flex flex-col w-full gap-3">
              <button onClick={onBack} className="w-full py-3.5 bg-rose-500 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-500/20">Discard Entry</button>
              <button onClick={() => setShowCancelConfirm(false)} className="w-full py-3.5 bg-white/5 text-slate-300 rounded-xl font-black uppercase tracking-widest text-xs border border-white/5">Continue Recording</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NestEntry;
