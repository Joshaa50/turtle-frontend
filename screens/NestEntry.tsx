
import React, { useState, useEffect, useRef, useId } from 'react';
import { DatabaseConnection, NestData } from '../services/Database';

interface NestEntryProps {
  onBack: () => void;
  theme?: 'light' | 'dark';
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
  theme?: 'light' | 'dark';
}> = ({ label, unit, placeholder = "0.0", required = false, color = 'primary', value, onChange, isInteger = false, step: customStep, decimalPlaces, theme = 'light' }) => {
  const id = useId();
  const decimals = isInteger ? 0 : (decimalPlaces !== undefined ? decimalPlaces : 2);
  const stepVal = customStep !== undefined ? customStep : (isInteger ? 1 : 0.1);
  
  const colorClasses = color === 'primary' ? 'focus:ring-primary focus:border-primary' : 'focus:ring-amber-500 focus:border-amber-500';

  return (
    <div className="min-w-0">
      <label htmlFor={id} className={`block text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
        {label} {required && <span className="text-rose-500 font-bold">*</span>}
      </label>
      <div className="relative group">
        <input 
          id={id}          
          className={`w-full border rounded-lg h-12 pl-4 pr-12 outline-none transition-all font-mono text-sm ${colorClasses} ${
            theme === 'dark' 
              ? 'bg-slate-900 border-slate-700 text-white' 
              : 'bg-slate-50 border-slate-300 text-slate-900'
          }`}
          placeholder={isInteger ? "0" : (decimals === 1 ? "0.0" : placeholder)}
          type="number"
          step={isInteger ? "1" : (customStep ? customStep.toString() : (decimals === 1 ? "0.1" : "0.01"))}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="absolute right-3 top-0 bottom-0 flex items-center pointer-events-none">
          <span className={`text-[9px] font-mono font-bold uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{unit}</span>
        </div>
      </div>
    </div>
  );
};

const NestEntry: React.FC<NestEntryProps> = ({ onBack, theme = 'light' }) => {
  const [existingNests, setExistingNests] = useState<any[]>([]);
  const [isCalculatingId, setIsCalculatingId] = useState(false);

  const [formData, setFormData] = useState({
    beach: 'Kyparissia Bay',
    nestId: '',
    date: new Date().toISOString().split('T')[0],
    relocated: false,
    relocationReason: '',
    caged: true,
    eggCount: '',
    eggsTakenOut: '',
    eggsPutBackIn: ''
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

      let newId = `${abbr}-${nextNum}`;
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
        if (formData.eggsTakenOut) finalNotes += `Eggs Taken Out: ${formData.eggsTakenOut}. `;
        if (formData.eggsPutBackIn) finalNotes += `Eggs Put Back In: ${formData.eggsPutBackIn}. `;
        finalNotes += `Original Location: ${coords.lat}, ${coords.lng}. `;
        finalNotes += `Original Metrics: h=${metrics.h}, H=${metrics.H}, w=${metrics.w}, S=${metrics.S}. `;
      }
      
      const payload: NestData = {
        nest_code: formData.nestId,
        // Map form eggCount to total_num_eggs.
        // Backend handles copying total to current if current is missing.
        total_num_eggs: formData.relocated && formData.eggsTakenOut ? parseInt(formData.eggsTakenOut) : null,
        current_num_eggs: formData.relocated && formData.eggsPutBackIn ? parseInt(formData.eggsPutBackIn) : null,
        
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
    <div className={`flex flex-col min-h-screen font-display relative ${theme === 'dark' ? 'bg-background-dark text-white' : 'bg-background-light text-slate-900'}`}>
      <header className={`border-b sticky top-0 z-50 transition-all duration-300 ${theme === 'dark' ? 'bg-[#111418] border-primary/10' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="w-10 lg:w-32 flex-shrink-0">
            {/* Left spacer for mobile menu button / balance */}
          </div>
          <div className="flex-1 flex justify-center">
            <h1 className={`text-lg font-black tracking-tight uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>New Nest Entry</h1>
          </div>
          <div className="w-10 lg:w-32 flex-shrink-0">
            {/* Right spacer for balance */}
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-6 py-8 pb-48 overflow-y-auto space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-8">
            <div className={`border rounded-xl p-6 shadow-xl transition-all ${theme === 'dark' ? 'bg-[#1a232e] border-[#283039]' : 'bg-white border-slate-200'}`} id="primary-info">
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
                    className={`w-full border rounded-lg h-12 px-4 text-lg font-bold focus:ring-2 focus:ring-primary outline-none appearance-none cursor-pointer ${
                      theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
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
                        className={`w-full border rounded-lg h-12 px-4 text-lg font-mono font-bold focus:ring-2 focus:ring-primary outline-none ${
                          theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`} 
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
                    <input 
                      className={`w-full border rounded-lg h-12 px-4 text-lg font-bold ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`} 
                      type="date" 
                      value={formData.date} 
                      onChange={(e) => setFormData({...formData, date: e.target.value})} 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={`border rounded-xl p-6 shadow-xl transition-all ${theme === 'dark' ? 'bg-[#1a232e] border-[#283039]' : 'bg-white border-slate-200'}`} id="sketch-info">
              <div className="flex items-center gap-2 mb-6 text-primary">
                <span className="material-symbols-outlined">draw</span>
                <h3 className="text-lg font-black uppercase tracking-tight">Track Sketch</h3>
              </div>
              <div className="space-y-4">
                <div className={`relative border-2 border-dashed rounded-xl aspect-[16/9] overflow-hidden group ${
                  theme === 'dark' ? 'border-slate-700 bg-slate-900/30' : 'border-slate-300 bg-slate-50'
                }`}>
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
            <div className={`border rounded-xl p-6 shadow-xl transition-all ${theme === 'dark' ? 'bg-[#1a232e] border-[#283039]' : 'bg-white border-slate-200'}`} id="original-metrics">
              <div className="flex items-center gap-2 mb-6 text-primary">
                <span className="material-symbols-outlined">architecture</span>
                <h3 className="text-lg font-black uppercase tracking-tight">Original Nest Metrics</h3>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <MetricInput label={<><span className="lowercase">h</span> (Depth top)</>} unit="cm" value={metrics.h} onChange={(v) => setMetrics({...metrics, h: v})} required step={0.5} decimalPlaces={1} theme={theme} />
                  <MetricInput label="H (Depth bottom)" unit="cm" value={metrics.H} onChange={(v) => setMetrics({...metrics, H: v})} required={false} step={0.5} decimalPlaces={1} theme={theme} />
                  <MetricInput label="w (Width)" unit="cm" value={metrics.w} onChange={(v) => setMetrics({...metrics, w: v})} required={false} step={0.5} decimalPlaces={1} theme={theme} />
                  <MetricInput label="S (Dist to sea)" unit="m" value={metrics.S} onChange={(v) => setMetrics({...metrics, S: v})} required={false} isInteger={true} placeholder="0" theme={theme} />
                </div>
                <div className="relative transition-all" id="original-coords">
                  <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    Original GPS Coordinates <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] text-primary font-black uppercase tracking-wider ml-1">Lat</span>
                      <input 
                        className={`w-full border rounded-lg h-12 px-4 outline-none transition-all font-mono text-xs ${
                          coords.lat !== '' && !isLatValid(coords.lat) 
                            ? 'border-rose-500 ring-1 ring-rose-500' 
                            : (theme === 'dark' ? 'border-slate-700 focus:ring-2 focus:ring-primary' : 'border-slate-300 focus:ring-2 focus:ring-primary')
                        } ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`} 
                        placeholder="N 037.44670" 
                        value={coords.lat}
                        onChange={(e) => setCoords({...coords, lat: e.target.value})}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] text-primary font-black uppercase tracking-wider ml-1">Lng</span>
                      <input 
                        className={`w-full border rounded-lg h-12 px-4 outline-none transition-all font-mono text-xs ${
                          coords.lng !== '' && !isLngValid(coords.lng) 
                            ? 'border-rose-500 ring-1 ring-rose-500' 
                            : (theme === 'dark' ? 'border-slate-700 focus:ring-2 focus:ring-primary' : 'border-slate-300 focus:ring-2 focus:ring-primary')
                        } ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`} 
                        placeholder="E 021.61630" 
                        value={coords.lng}
                        onChange={(e) => setCoords({...coords, lng: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`border rounded-xl p-6 shadow-xl transition-all ${theme === 'dark' ? 'bg-[#1a232e] border-[#283039]' : 'bg-white border-slate-200'}`} id="management-actions">
              <div className="flex items-center gap-2 mb-6 text-primary">
                <span className="material-symbols-outlined">security</span>
                <h3 className="text-lg font-black uppercase tracking-tight">Management Actions</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
                  formData.relocated 
                    ? (theme === 'dark' ? 'bg-primary/10 border-primary/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-primary/5 border-primary/30')
                    : (theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200')
                }`}>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${formData.relocated ? 'text-primary' : (theme === 'dark' ? 'text-slate-400' : 'text-slate-500')}`}>Relocated</span>
                  <label className="relative inline-flex items-center cursor-pointer group">
                    <input type="checkbox" className="sr-only peer" checked={formData.relocated} onChange={(e) => setFormData({...formData, relocated: e.target.checked})} />
                    <div className={`w-12 h-6 rounded-full transition-all duration-300 peer-checked:bg-primary relative shadow-inner ${
                      theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'
                    }`}>
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-500 shadow-md transform ${
                        formData.relocated ? 'translate-x-6 rotate-[360deg]' : 'translate-x-0'
                      } flex items-center justify-center`}>
                        <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${formData.relocated ? 'bg-primary' : 'bg-slate-300'}`}></div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {formData.relocated && (
              <div className={`border rounded-xl p-6 shadow-xl transition-all duration-500 border-amber-500/40 ring-1 ring-amber-500/20 ${
                theme === 'dark' ? 'bg-[#1a232e]' : 'bg-white'
              }`} id="relocated-metrics">
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
                          className={`w-full border rounded-lg h-12 px-4 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none appearance-none cursor-pointer ${
                            formData.relocated && formData.relocationReason === '' 
                              ? 'border-rose-500/50' 
                              : (theme === 'dark' ? 'border-slate-700' : 'border-slate-300')
                          } ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}
                        >
                          <option value="" disabled>Select a reason...</option>
                          {relocationReasons.map(reason => (
                            <option key={reason} value={reason}>{reason}</option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-4 top-3 text-slate-500 pointer-events-none">expand_more</span>
                      </div>
                    </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-amber-500 uppercase tracking-widest">Eggs Taken Out</label>
                            <input 
                               type="number"
                               className={`w-full border rounded-lg h-12 px-4 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none ${
                                 theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                               }`}
                               value={formData.eggsTakenOut}
                               onChange={(e) => setFormData({...formData, eggsTakenOut: e.target.value})}
                               placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-amber-500 uppercase tracking-widest">Eggs Put Back In</label>
                            <input 
                               type="number"
                               className={`w-full border rounded-lg h-12 px-4 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none ${
                                 theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                               }`}
                               value={formData.eggsPutBackIn}
                               onChange={(e) => setFormData({...formData, eggsPutBackIn: e.target.value})}
                               placeholder="0"
                            />
                        </div>
                      </div>
                    </div>
                  <div className="grid grid-cols-2 gap-4">
                    <MetricInput 
                      label={<><span className="lowercase">h</span> (Depth top)</>} 
                      unit="cm" 
                      color="amber" 
                      value={relocatedMetrics.h} 
                      onChange={(v) => setRelocatedMetrics({...relocatedMetrics, h: v})}
                      required={formData.relocated}
                      theme={theme}
                    />
                    <MetricInput 
                      label="H (Depth bottom)" 
                      unit="cm" 
                      color="amber" 
                      value={relocatedMetrics.H} 
                      onChange={(v) => setRelocatedMetrics({...relocatedMetrics, H: v})}
                      required={formData.relocated}
                      theme={theme}
                    />
                    <MetricInput 
                      label="w (Width)" 
                      unit="cm" 
                      color="amber" 
                      value={relocatedMetrics.w} 
                      onChange={(v) => setRelocatedMetrics({...relocatedMetrics, w: v})}
                      required={formData.relocated}
                      theme={theme}
                    />
                    <MetricInput 
                      label="S (Dist to sea)" 
                      unit="m" 
                      color="amber" 
                      value={relocatedMetrics.S} 
                      onChange={(v) => setRelocatedMetrics({...relocatedMetrics, S: v})}
                      required={formData.relocated}
                      isInteger={true}
                      placeholder="0"
                      theme={theme}
                    />
                  </div>
                  <div className="relative transition-all" id="relocated-coords">
                    <label className="block text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                      Relocated GPS Coordinates <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] text-amber-500 font-black uppercase tracking-wider ml-1">Lat</span>
                        <input 
                          className={`w-full border rounded-lg h-12 px-4 outline-none transition-all font-mono text-xs ${
                            relocatedCoords.lat !== '' && !isLatValid(relocatedCoords.lat) 
                              ? 'border-rose-500 ring-1 ring-rose-500' 
                              : (theme === 'dark' ? 'border-slate-700 focus:ring-2 focus:ring-amber-500' : 'border-slate-300 focus:ring-2 focus:ring-amber-500')
                          } ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`} 
                          placeholder="N 37.44670" 
                          value={relocatedCoords.lat}
                          onChange={(e) => setRelocatedCoords({...relocatedCoords, lat: e.target.value})}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] text-amber-500 font-black uppercase tracking-wider ml-1">Lng</span>
                        <input 
                          className={`w-full border rounded-lg h-12 px-4 outline-none transition-all font-mono text-xs ${
                            relocatedCoords.lng !== '' && !isLngValid(relocatedCoords.lng) 
                              ? 'border-rose-500 ring-1 ring-rose-500' 
                              : (theme === 'dark' ? 'border-slate-700 focus:ring-2 focus:ring-amber-500' : 'border-slate-300 focus:ring-2 focus:ring-amber-500')
                          } ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`} 
                          placeholder="E 021.61630" 
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

        <div className={`border rounded-xl p-6 shadow-xl transition-all ${theme === 'dark' ? 'bg-[#1a232e] border-[#283039]' : 'bg-white border-slate-200'}`} id="triangulation-section">
          <div className="flex items-center gap-2 mb-6 text-primary">
            <span className="material-symbols-outlined">explore</span>
            <h3 className="text-lg font-black uppercase tracking-tight">Triangulation Points</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {triangulation.map((point, idx) => (
              <div key={idx} className={`space-y-4 p-4 rounded-xl border ${
                theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-black uppercase rounded tracking-widest">Triangulation Point 0{idx + 1}</span>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Description <span className="text-rose-500">*</span></label>
                    <input 
                      type="text" 
                      value={point.desc}
                      onChange={(e) => updateTriPoint(idx, 'desc', e.target.value)}
                      placeholder="e.g Bamboo"
                      className={`w-full border rounded-lg h-10 px-4 text-xs font-bold focus:ring-1 focus:ring-primary outline-none transition-all ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
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
                      theme={theme}
                    />
                    <div className="space-y-2">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Coordinates <span className="text-rose-500">*</span></label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] text-primary font-black uppercase tracking-wider ml-1">Lat</span>
                          <input 
                            type="text" 
                            placeholder="N 037.23543" 
                            value={point.lat}
                            onChange={(e) => updateTriPoint(idx, 'lat', e.target.value)}
                            className={`w-full border rounded-lg h-12 px-4 text-[10px] font-mono font-bold outline-none transition-all ${
                              point.lat !== '' && !isLatValid(point.lat) 
                                ? 'border-rose-500 ring-1 ring-rose-500' 
                                : (theme === 'dark' ? 'border-slate-700 focus:ring-1 focus:ring-primary' : 'border-slate-300 focus:ring-1 focus:ring-primary')
                            } ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`} 
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] text-primary font-black uppercase tracking-wider ml-1">Lng</span>
                          <input 
                            type="text" 
                            placeholder="E 021.61630" 
                            value={point.lng}
                            onChange={(e) => updateTriPoint(idx, 'lng', e.target.value)}
                            className={`w-full border rounded-lg h-12 px-4 text-[10px] font-mono font-bold outline-none transition-all ${
                              point.lng !== '' && !isLngValid(point.lng) 
                                ? 'border-rose-500 ring-1 ring-rose-500' 
                                : (theme === 'dark' ? 'border-slate-700 focus:ring-1 focus:ring-primary' : 'border-slate-300 focus:ring-1 focus:ring-primary')
                            } ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`} 
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

      {/* Redesigned Footer for Mobile Visibility */}
      <footer className={`fixed bottom-0 left-0 right-0 lg:left-64 backdrop-blur-xl border-t z-50 shadow-[0_-15px_30px_rgba(0,0,0,0.15)] ${
        theme === 'dark' ? 'bg-[#111418]/95 border-slate-800' : 'bg-white/95 border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3">
          {/* Error Message - Top on Mobile, Middle on Desktop */}
          {!isFormValid && errorInfo && (
            <div className="order-1 lg:order-2 w-full">
              <button 
                onClick={() => scrollToField(errorInfo.targetId)}
                className="w-full bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 rounded-xl flex items-center gap-3 hover:bg-rose-500/20 active:scale-[0.99] transition-all group border-dashed"
              >
                <span className="material-symbols-outlined text-rose-500 text-lg shrink-0 group-hover:animate-bounce">priority_high</span>
                <div className="flex flex-col text-left overflow-hidden flex-1">
                  <span className="text-[7px] font-black uppercase tracking-[0.1em] text-rose-400 opacity-80 leading-tight">Action Required</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 leading-tight truncate">
                    {errorInfo.message}
                  </span>
                </div>
                <span className="material-symbols-outlined text-rose-500 text-sm shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">near_me</span>
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="order-2 lg:order-1 flex items-center justify-between w-full gap-3">
            <div className="flex items-center gap-3 flex-1">
              <button 
                disabled={!isFormValid || isSaving}
                onClick={handleSave}
                className={`flex-1 sm:flex-none sm:min-w-[160px] py-3.5 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all text-xs flex items-center justify-center gap-2 ${isFormValid && !isSaving ? 'bg-primary text-white shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]' : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'}`}
              >
                {isSaving ? (
                  <>
                    <span className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>SAVING...</span>
                  </>
                ) : 'SAVE ENTRY'}
              </button>
              <button 
                onClick={() => setShowCancelConfirm(true)} 
                className="px-6 py-3.5 bg-rose-600/10 text-rose-500 border border-rose-500/20 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-rose-600 hover:text-white transition-all whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
            <div className="hidden lg:block w-[120px]"></div>
          </div>
        </div>
      </footer>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowCancelConfirm(false)}></div>
          <div className={`relative border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-8 flex flex-col items-center text-center ${
            theme === 'dark' ? 'bg-[#111c26] border-white/10' : 'bg-white border-slate-200'
          }`}>
            <h3 className={`text-xl font-black uppercase tracking-tight mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Discard Progress?</h3>
            <p className={`text-sm leading-relaxed mb-8 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Unsaved data for the new nest entry will be lost.</p>
            <div className="flex flex-col w-full gap-3">
              <button onClick={onBack} className="w-full py-3.5 bg-rose-500 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-500/20">Discard Entry</button>
              <button onClick={() => setShowCancelConfirm(false)} className={`w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-xs border ${
                theme === 'dark' ? 'bg-white/5 text-slate-300 border-white/5 hover:bg-white/10' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}>Continue Recording</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NestEntry;
