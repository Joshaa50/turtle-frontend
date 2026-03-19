
import React, { useState, useEffect, useRef, useId } from 'react';
import { 
  BarChart3, 
  Pencil, 
  Edit, 
  Upload, 
  Ruler, 
  Shield, 
  ArrowUpFromLine, 
  Compass, 
  Camera, 
  X, 
  AlertCircle, 
  Send, 
  AlertTriangle,
  ChevronDown,
  MapPin,
  RefreshCw,
  Minus,
  Plus,
  Trash2,
  Waves,
  Egg,
  History,
  Lock,
  ChevronLeft
} from 'lucide-react';
import { DatabaseConnection, NestData, Beach } from '../services/Database';
import { PageTitle, SectionHeading, BodyText, HelperText, Label } from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardContent } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { MetricInput } from '../components/ui/MetricInput';
import { formatTimeInput } from '../lib/utils';

interface NestEntryProps {
  onBack: () => void;
  onSave?: (nestData: any) => void;
  theme?: 'light' | 'dark';
  beaches: Beach[];
  initialBeach?: string;
  initialDate?: string;
  origin?: 'records' | 'survey';
}

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

const NestEntry: React.FC<NestEntryProps> = ({ onBack, onSave, theme = 'light', beaches, initialBeach, initialDate, origin = 'records' }) => {
  const [existingNests, setExistingNests] = useState<any[]>([]);
  const [isCalculatingId, setIsCalculatingId] = useState(false);

  const [formData, setFormData] = useState({
    beach: initialBeach || (beaches.length > 0 ? beaches[0].name : 'Kyparissia Bay'),
    nestId: '',
    date: initialDate || new Date().toISOString().split('T')[0],
    relocated: false,
    relocationReason: '',
    eggCount: '',
    eggsTakenOut: '',
    eggsPutBackIn: '',
    startTime: '',
    endTime: '',
    isEmergence: false
  });

  const [confirmTime, setConfirmTime] = useState<{ field: 'startTime' | 'endTime', value: string } | null>(null);

  const updateCounter = (field: 'eggsTakenOut' | 'eggsPutBackIn', delta: number) => {
    setFormData(prev => {
      const current = parseInt(prev[field] || '0') || 0;
      return { ...prev, [field]: Math.max(0, current + delta).toString() };
    });
  };

  const setNow = (field: 'startTime' | 'endTime') => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    if (formData[field]) {
      setConfirmTime({ field, value: now });
    } else {
      setFormData(prev => ({ ...prev, [field]: now }));
    }
  };

  useEffect(() => {
    if (initialBeach) {
      setFormData(prev => ({ ...prev, beach: initialBeach }));
    } else if (beaches.length > 0 && !formData.beach) {
      setFormData(prev => ({ ...prev, beach: beaches[0].name }));
    }
  }, [beaches, initialBeach]);

  const [metrics, setMetrics] = useState({ h: '', H: '', w: '', S: '' });
  const [coords, setCoords] = useState({ lat: '', lng: '' });
  
  const [relocatedMetrics, setRelocatedMetrics] = useState({ h: '', H: '', w: '', S: '' });
  const [relocatedCoords, setRelocatedCoords] = useState({ lat: '', lng: '' });

  const [triangulation, setTriangulation] = useState([
    { desc: '', dist: '', lat: '', lng: '', photo: null as string | null },
    { desc: '', dist: '', lat: '', lng: '', photo: null as string | null }
  ]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [capturedSketch, setCapturedSketch] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drawingActive, setDrawingActive] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const startCamera = async (index: number) => {
    setActivePhotoIndex(index);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setCameraStream(stream);
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      // Fallback to file input if getUserMedia fails or is not supported
      fileInputRef.current?.click();
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [isCameraActive, cameraStream]);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setActivePhotoIndex(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && photoCanvasRef.current && activePhotoIndex !== null) {
      const video = videoRef.current;
      const canvas = photoCanvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        updateTriPoint(activePhotoIndex, 'photo', dataUrl);
        stopCamera();
      }
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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
    if (isCalculatingId || formData.isEmergence) return;

    const beach = beaches.find(b => b.name === formData.beach);
    if (beach) {
      const abbr = beach.code;
      
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
  }, [formData.beach, formData.relocated, existingNests, isCalculatingId, formData.isEmergence, beaches]);

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
    metrics: formData.isEmergence ? metrics.S !== '' : (metrics.h !== '' && metrics.S !== ''),
    metricsLogic: formData.isEmergence ? true : isDepthLogicValid(metrics.h, metrics.H),
    nestCoords: isLatValid(coords.lat) && isLngValid(coords.lng),
    relocatedMetrics: formData.isEmergence || !formData.relocated || (relocatedMetrics.h !== '' && relocatedMetrics.H !== '' && relocatedMetrics.w !== '' && relocatedMetrics.S !== ''),
    relocatedMetricsLogic: formData.isEmergence || !formData.relocated || isDepthLogicValid(relocatedMetrics.h, relocatedMetrics.H),
    relocatedCoords: formData.isEmergence || !formData.relocated || (isLatValid(relocatedCoords.lat) && isLngValid(relocatedCoords.lng)),
    relocationReason: formData.isEmergence || !formData.relocated || formData.relocationReason !== '',
    triangulation: formData.isEmergence || triangulation.every(p => 
      p.desc !== '' && p.dist !== '' && isLatValid(p.lat) && isLngValid(p.lng) && p.photo !== null
    ),
  };

  const isFormValid = Object.values(validation).every(Boolean);

  const getErrorInfo = () => {
    if (!validation.beach) return { message: "Beach Required", targetId: "beach-select" };
    if (!validation.date) return { message: "Date Required", targetId: "date-input" };
    
    if (formData.isEmergence) {
      if (metrics.S === '') return { message: "Dist to Sea (S) Required", targetId: "original-metrics" };
      if (!isLatValid(coords.lat)) return { message: "Lat Format: xxx.xxxxx", targetId: "original-coords" };
      if (!isLngValid(coords.lng)) return { message: "Lng Format: xxx.xxxxx", targetId: "original-coords" };
      return null;
    }

    if (metrics.h === '') return { message: "Depth (h) Required", targetId: "original-metrics" };
    if (metrics.S === '') return { message: "Dist to Sea (S) Required", targetId: "original-metrics" };
    if (!validation.metricsLogic) return { message: "Depth Logic: h must be < H", targetId: "original-metrics" };
    if (!isLatValid(coords.lat)) return { message: "Lat Format: xxx.xxxxx", targetId: "original-coords" };
    if (!isLngValid(coords.lng)) return { message: "Lng Format: xxx.xxxxx", targetId: "original-coords" };
    if (formData.relocated && !validation.relocationReason) return { message: "Reason Required", targetId: "relocation-reason-select" };
    if (formData.relocated && !validation.relocatedMetrics) return { message: "Relocated Data Required", targetId: "relocated-metrics" };
    if (formData.relocated && !validation.relocatedMetricsLogic) return { message: "Relocated Logic: h must be < H", targetId: "relocated-metrics" };
    if (formData.relocated && !isLatValid(relocatedCoords.lat)) return { message: "Relocated Lat: xxx.xxxxx", targetId: "relocated-coords" };
    if (formData.relocated && !isLngValid(relocatedCoords.lng)) return { message: "Relocated Lng: xxx.xxxxx", targetId: "relocated-coords" };
    
    const badTriIdx = triangulation.findIndex(p => p.desc === '' || p.dist === '' || !isLatValid(p.lat) || !isLngValid(p.lng) || p.photo === null);
    if (badTriIdx !== -1) {
      if (triangulation[badTriIdx].photo === null) {
        return { message: `Tri Point ${badTriIdx + 1} Photo Required`, targetId: "triangulation-section" };
      }
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
    setSaveError(null);
    if (!isFormValid) {
      setHasAttemptedSave(true);
      if (errorInfo) scrollToField(errorInfo.targetId);
      return;
    }

    setIsSaving(true);
    try {
      // If Emergence is toggled on, we ONLY create an emergence record
      // and skip the nest creation entirely.
      if (formData.isEmergence) {
        const emergencePayload = {
          distance_to_sea_s: Number(metrics.S),
          gps_lat: Number(coords.lat),
          gps_long: Number(coords.lng),
          event_date: formData.date,
          beach: formData.beach,
          track_sketch: capturedSketch
        };
        if (origin === 'records') {
          await DatabaseConnection.createEmergence(emergencePayload);
        } else {
          if (onSave) onSave({ isEmergence: true, entryId: `${Date.now()}-${Math.random()}`, distance_to_sea_s: Number(metrics.S), payload: emergencePayload });
        }
        onBack();
        return; // Exit here to prevent nest creation below
      }

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
        tri_tl_img: triangulation[0].photo || null,

        tri_tr_desc: triangulation[1].desc || null,
        tri_tr_lat: triangulation[1].lat ? Number(triangulation[1].lat) : null,
        tri_tr_long: triangulation[1].lng ? Number(triangulation[1].lng) : null,
        tri_tr_distance: triangulation[1].dist ? Number(triangulation[1].dist) : null,
        tri_tr_img: triangulation[1].photo || null,

        status: 'incubating',
        relocated: formData.relocated,
        date_laid: formData.date,
        date_found: formData.date,
        beach: formData.beach,
        notes: finalNotes || null,
        sketch: capturedSketch,
        is_archived: false
      };

      console.log('Payload:', payload);

      let relocationEventPayload: any = null;
      if (formData.relocated) {
        const createTimestamp = (timeString?: string) => {
          if (!timeString) return undefined;
          const date = new Date(formData.date);
          const [hours, minutes] = timeString.split(':');
          date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
          return date.toISOString();
        };

        relocationEventPayload = {
          event_type: 'RELOCATION',
          nest_code: formData.nestId,
          total_eggs: formData.eggsTakenOut ? parseInt(formData.eggsTakenOut) : undefined,
          eggs_reburied: formData.eggsPutBackIn ? parseInt(formData.eggsPutBackIn) : undefined,
          original_depth_top_egg_h: Number(metrics.h),
          original_depth_bottom_chamber_h: metrics.H ? Number(metrics.H) : undefined,
          original_width_w: metrics.w ? Number(metrics.w) : undefined,
          original_distance_to_sea_s: Number(metrics.S),
          original_gps_lat: Number(coords.lat),
          original_gps_long: Number(coords.lng),
          reburied_gps_lat: Number(relocatedCoords.lat),
          reburied_gps_long: Number(relocatedCoords.lng),
          reburied_depth_top_egg_h: Number(relocatedMetrics.h),
          reburied_depth_bottom_chamber_h: relocatedMetrics.H ? Number(relocatedMetrics.H) : undefined,
          reburied_width_w: relocatedMetrics.w ? Number(relocatedMetrics.w) : undefined,
          reburied_distance_to_sea_s: Number(relocatedMetrics.S),
          start_time: createTimestamp(formData.startTime),
          end_time: createTimestamp(formData.endTime),
          notes: finalNotes || undefined,
        };
      }

      if (origin === 'records') {
        await DatabaseConnection.createNest(payload);
        if (relocationEventPayload) {
          await DatabaseConnection.createNestEvent(relocationEventPayload);
        }
      } else {
        if (onSave) onSave({ ...payload, isEmergence: formData.isEmergence, entryId: `${Date.now()}-${Math.random()}`, payload: payload, relocationEventPayload });
      }
      onBack();
    } catch (e: any) {
      console.error(e);
      setSaveError('Failed to save nest: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Drawing Logic
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Prevent scrolling when drawing on touch devices
    if (e.cancelable) e.preventDefault();
    
    setDrawingActive(true);
    const { x, y } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#451a03'; // Dark brown for turtle track
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Prevent scrolling when drawing on touch devices
    if (e.cancelable) e.preventDefault();
    
    const { x, y } = getCoordinates(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setDrawingActive(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      drawBackground(ctx, rect.width, rect.height);
    }
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw Sea (Bottom)
    ctx.fillStyle = '#e0f2fe'; // Light blue for sea
    ctx.fillRect(0, height * 0.7, width, height * 0.3);
    
    // Draw Shoreline
    ctx.beginPath();
    ctx.moveTo(0, height * 0.7);
    for (let x = 0; x <= width; x += 20) {
      ctx.lineTo(x, height * 0.7 + Math.sin(x * 0.02) * 10);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fillStyle = '#bae6fd'; // Slightly darker blue
    ctx.fill();

    // Draw Beach (Top)
    ctx.fillStyle = '#fef3c7'; // Sand color
    ctx.fillRect(0, 0, width, height * 0.7);

    // Draw Labels
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#0369a1';
    ctx.textAlign = 'center';
    ctx.fillText('SEA / WATER', width / 2, height - 40);

    ctx.fillStyle = '#92400e';
    ctx.fillText('BEACH / NESTING AREA', width / 2, 60);
  };

  useEffect(() => {
    if (isDrawing) {
      // Small delay to ensure canvas is mounted and has dimensions
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          
          // Set internal resolution to match display size * DPR
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Scale context to match CSS pixels
            ctx.scale(dpr, dpr);
            drawBackground(ctx, rect.width, rect.height);
          }
        }
      }, 100);
    }
  }, [isDrawing]);

  const saveSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCapturedSketch(canvas.toDataURL('image/png'));
    setIsDrawing(false);
  };

  return (
    <div className={`flex flex-col min-h-screen font-sans relative ${theme === 'dark' ? 'bg-background-dark text-white' : 'bg-background-light text-slate-900'}`}>
      <header className={`border-b sticky top-0 z-50 transition-all duration-300 ${theme === 'dark' ? 'bg-[#111418] border-primary/10' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between relative">
          <div className="flex items-center gap-4 z-20">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ChevronLeft className="size-5" />
            </Button>
          </div>
          
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <PageTitle className="mb-0 text-lg md:text-lg uppercase tracking-tight">Record new turtle track</PageTitle>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-6 py-8 pb-48 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-8">
            <Card id="primary-info">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6 text-primary">
                  <BarChart3 className="w-5 h-5" />
                  <SectionHeading className="mb-0 uppercase tracking-tight">Primary Information</SectionHeading>
                </div>
                <div className="space-y-6">
                  <div id="beach-select">
                    <Select
                      label="Beach Location"
                      value={formData.beach}
                      onChange={(e) => setFormData({...formData, beach: e.target.value})}
                      disabled={!!initialBeach && origin !== 'records'}
                      options={beaches.map(beach => ({ value: beach.name, label: beach.name }))}
                      required
                    />
                  </div>
                  {!formData.isEmergence && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input
                        label="Nest ID / Code"
                        value={formData.nestId}
                        readOnly
                        placeholder={isCalculatingId ? "Generating..." : "KY1"}
                        icon={isCalculatingId ? <span className="block size-4 border-2 border-slate-600 border-t-primary rounded-full animate-spin"></span> : <Lock className="w-4 h-4" />}
                      />
                      <div id="date-input">
                        <Input
                          label="Observation Date"
                          type="date"
                          value={formData.date}
                          onChange={(e) => setFormData({...formData, date: e.target.value})}
                          readOnly={origin === 'survey'}
                          icon={origin === 'survey' ? <Lock className="w-4 h-4" /> : undefined}
                          required
                        />
                      </div>
                    </div>
                  )}
                  {formData.isEmergence && (
                    <div id="date-input">
                      <Input
                        label="Observation Date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        readOnly={origin === 'survey'}
                        icon={origin === 'survey' ? <Lock className="w-4 h-4" /> : undefined}
                        required
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card id="sketch-info">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6 text-primary">
                  <Pencil className="w-5 h-5" />
                  <SectionHeading className="mb-0 uppercase tracking-tight">Track Sketch</SectionHeading>
                </div>
                <div className="space-y-4">
                  <div className={`relative border-2 border-dashed rounded-xl aspect-[16/9] overflow-hidden group ${
                    theme === 'dark' ? 'border-slate-700 bg-slate-900/30' : 'border-slate-300 bg-slate-50'
                  }`}>
                    {capturedSketch ? (
                      <>
                        <img src={capturedSketch} alt="Captured track sketch" className="w-full h-full object-contain" />
                        <Button 
                          variant="destructive"
                          size="icon"
                          onClick={() => setCapturedSketch(null)}
                          className="absolute top-3 right-3 rounded-full shadow-lg z-10"
                          title="Remove sketch"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <Pencil className="w-10 h-10 text-slate-400" />
                        <BodyText className="font-bold">No sketch captured yet</BodyText>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button variant="outline" onClick={() => setIsDrawing(true)} icon={<Edit className="w-4 h-4" />}>
                      Digital Drawing Area
                    </Button>
                    <Button variant="outline" onClick={() => { setActivePhotoIndex(-1); fileInputRef.current?.click(); }} icon={<Upload className="w-4 h-4" />}>
                      Upload Sketch
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card id="original-metrics">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6 text-primary">
                  <Ruler className="w-5 h-5" />
                  <SectionHeading className="mb-0 uppercase tracking-tight">Original Nest Metrics</SectionHeading>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {!formData.isEmergence && (
                      <>
                        <MetricInput label="h (Depth top)" unit="cm" value={metrics.h} onChange={(v) => setMetrics({...metrics, h: v})} required decimalPlaces={1} theme={theme} />
                        <MetricInput label="H (Depth bottom)" unit="cm" value={metrics.H} onChange={(v) => setMetrics({...metrics, H: v})} required={false} decimalPlaces={1} theme={theme} />
                        <MetricInput label="w (Width)" unit="cm" value={metrics.w} onChange={(v) => setMetrics({...metrics, w: v})} required={false} decimalPlaces={1} theme={theme} />
                      </>
                    )}
                    <MetricInput label="S (Dist to sea)" unit="m" value={metrics.S} onChange={(v) => setMetrics({...metrics, S: v})} required isInteger={true} placeholder="0" theme={theme} />
                  </div>
                  <div className="relative transition-all" id="original-coords">
                    <SectionHeading className="text-sm font-bold uppercase tracking-tight mb-4">Original GPS Coordinates</SectionHeading>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Latitude"
                        value={coords.lat}
                        onChange={(e) => setCoords({...coords, lat: e.target.value})}
                        placeholder="37.xxxxx"
                        required
                      />
                      <Input
                        label="Longitude"
                        value={coords.lng}
                        onChange={(e) => setCoords({...coords, lng: e.target.value})}
                        placeholder="21.xxxxx"
                        required
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card id="management-actions">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6 text-primary">
                  <Shield className="w-5 h-5" />
                  <SectionHeading className="mb-0 uppercase tracking-tight">Management Actions</SectionHeading>
                </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${formData.isEmergence ? (theme === 'dark' ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : 'bg-amber-50/50 border-amber-500/30') : (theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200')}`}>
                      <Label className={`mb-0 ${formData.isEmergence ? 'text-amber-500' : ''}`}>Emergence</Label>
                      <label className="relative inline-flex items-center cursor-pointer group">
                        <input type="checkbox" className="sr-only peer" checked={formData.isEmergence} onChange={(e) => setFormData({...formData, isEmergence: e.target.checked})} />
                        <div className={`w-12 h-6 rounded-full transition-all duration-300 peer-checked:bg-amber-500 relative shadow-inner ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}>
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-500 shadow-md transform ${formData.isEmergence ? 'translate-x-6 rotate-[360deg]' : 'translate-x-0'} flex items-center justify-center`}>
                            <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${formData.isEmergence ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                          </div>
                        </div>
                      </label>
                    </div>

                    {!formData.isEmergence && (
                      <div className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${formData.relocated ? (theme === 'dark' ? 'bg-primary/10 border-primary/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-primary/5 border-primary/30') : (theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200')}`}>
                      <Label className={`mb-0 ${formData.relocated ? 'text-primary' : ''}`}>Relocated</Label>
                      <label className="relative inline-flex items-center cursor-pointer group">
                        <input type="checkbox" className="sr-only peer" checked={formData.relocated} onChange={(e) => setFormData({...formData, relocated: e.target.checked})} />
                        <div className={`w-12 h-6 rounded-full transition-all duration-300 peer-checked:bg-primary relative shadow-inner ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}>
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-500 shadow-md transform ${formData.relocated ? 'translate-x-6 rotate-[360deg]' : 'translate-x-0'} flex items-center justify-center`}>
                            <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${formData.relocated ? 'bg-primary' : 'bg-slate-300'}`}></div>
                          </div>
                        </div>
                      </label>
                    </div>
                    )}
                  </div>
              </CardContent>
            </Card>

            {!formData.isEmergence && formData.relocated && (
              <Card id="relocated-metrics" className="border-amber-500/40 ring-1 ring-amber-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-6 text-amber-500">
                    <ArrowUpFromLine className="w-5 h-5" />
                    <SectionHeading className="mb-0 uppercase tracking-tight">Relocated Nest Metrics</SectionHeading>
                  </div>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Select
                        label="Reason for Relocation"
                        value={formData.relocationReason}
                        onChange={(e) => setFormData({...formData, relocationReason: e.target.value})}
                        options={relocationReasons.map(reason => ({ value: reason, label: reason }))}
                        required
                        placeholder="Select a reason..."
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Eggs Taken Out</Label>
                          <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 w-full">
                            <Button variant="ghost" size="icon" onClick={() => updateCounter('eggsTakenOut', -1)} className="rounded-r-none"><Minus size={16} /></Button>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              value={formData.eggsTakenOut} 
                              onChange={(e) => setFormData({...formData, eggsTakenOut: e.target.value})} 
                              className="w-full bg-transparent p-2 text-sm text-center outline-none font-mono border-none" 
                            />
                            <Button variant="ghost" size="icon" onClick={() => updateCounter('eggsTakenOut', 1)} className="rounded-l-none"><Plus size={16} /></Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Eggs Put Back In</Label>
                          <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 w-full">
                            <Button variant="ghost" size="icon" onClick={() => updateCounter('eggsPutBackIn', -1)} className="rounded-r-none"><Minus size={16} /></Button>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              value={formData.eggsPutBackIn} 
                              onChange={(e) => setFormData({...formData, eggsPutBackIn: e.target.value})} 
                              className="w-full bg-transparent p-2 text-sm text-center outline-none font-mono border-none" 
                            />
                            <Button variant="ghost" size="icon" onClick={() => updateCounter('eggsPutBackIn', 1)} className="rounded-l-none"><Plus size={16} /></Button>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Start Time</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              className="flex-1"
                              placeholder="--:--"
                              value={formData.startTime}
                              onChange={(e) => {
                                setFormData({...formData, startTime: formatTimeInput(e.target.value)});
                              }}
                            />
                            <Button variant="outline" size="sm" onClick={() => setNow('startTime')} className="h-12" icon={<RefreshCw className="w-4 h-4" />}>
                              Now
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>End Time</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              className="flex-1"
                              placeholder="--:--"
                              value={formData.endTime}
                              onChange={(e) => {
                                setFormData({...formData, endTime: formatTimeInput(e.target.value)});
                              }}
                            />
                            <Button variant="outline" size="sm" onClick={() => setNow('endTime')} className="h-12" icon={<RefreshCw className="w-4 h-4" />}>
                              Now
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <MetricInput label="h (Depth top)" unit="cm" value={relocatedMetrics.h} onChange={(v) => setRelocatedMetrics({...relocatedMetrics, h: v})} required={formData.relocated} decimalPlaces={1} theme={theme} />
                      <MetricInput label="H (Depth bottom)" unit="cm" value={relocatedMetrics.H} onChange={(v) => setRelocatedMetrics({...relocatedMetrics, H: v})} required={formData.relocated} decimalPlaces={1} theme={theme} />
                      <MetricInput label="w (Width)" unit="cm" value={relocatedMetrics.w} onChange={(v) => setRelocatedMetrics({...relocatedMetrics, w: v})} required={formData.relocated} decimalPlaces={1} theme={theme} />
                      <MetricInput label="S (Dist to sea)" unit="m" value={relocatedMetrics.S} onChange={(v) => setRelocatedMetrics({...relocatedMetrics, S: v})} required={formData.relocated} isInteger={true} placeholder="0" theme={theme} />
                    </div>
                    <div className="relative transition-all" id="relocated-coords">
                      <SectionHeading className="text-sm font-bold uppercase tracking-tight mb-4 text-amber-500">Relocated GPS Coordinates</SectionHeading>
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Latitude"
                          value={relocatedCoords.lat}
                          onChange={(e) => setRelocatedCoords({...relocatedCoords, lat: e.target.value})}
                          placeholder="37.xxxxx"
                          required={formData.relocated}
                        />
                        <Input
                          label="Longitude"
                          value={relocatedCoords.lng}
                          onChange={(e) => setRelocatedCoords({...relocatedCoords, lng: e.target.value})}
                          placeholder="21.xxxxx"
                          required={formData.relocated}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {!formData.isEmergence && (
          <Card id="triangulation-section" className="mt-8">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6 text-primary">
                <Compass className="w-5 h-5" />
                <SectionHeading className="mb-0 uppercase tracking-tight">Triangulation Points</SectionHeading>
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
                      <Input
                        label="Description"
                        value={point.desc}
                        onChange={(e) => updateTriPoint(idx, 'desc', e.target.value)}
                        placeholder="Bamboo"
                        required
                      />
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
                          <Label>Coordinates</Label>
                          <div className="grid grid-cols-2 gap-4">
                            <Input
                              label="Lat"
                              placeholder="37.xxxxx"
                              value={point.lat}
                              onChange={(e) => updateTriPoint(idx, 'lat', e.target.value)}
                            />
                            <Input
                              label="Lng"
                              placeholder="21.xxxxx"
                              value={point.lng}
                              onChange={(e) => updateTriPoint(idx, 'lng', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2 text-primary">
                          <Camera className="w-4 h-4" />
                          <Label className="mb-0">Point Photo</Label>
                        </div>
                        <div className={`relative border-2 border-dashed rounded-xl aspect-[16/9] overflow-hidden group mb-2 ${
                          theme === 'dark' ? 'border-slate-700 bg-slate-900/30' : 'border-slate-300 bg-slate-50'
                        }`}>
                          {point.photo ? (
                            <>
                              <img src={point.photo} alt={`Triangulation point ${idx + 1}`} className="w-full h-full object-contain" />
                              <Button 
                                variant="destructive"
                                size="icon"
                                onClick={() => updateTriPoint(idx, 'photo', null as any)}
                                className="absolute top-2 right-2 rounded-full shadow-lg z-10"
                                title="Remove photo"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                              <Camera className="w-8 h-8 text-slate-400" />
                              <BodyText className="text-xs font-bold">No photo</BodyText>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Button variant="outline" size="sm" onClick={() => startCamera(idx)} icon={<Camera className="w-3 h-3" />}>
                            {point.photo ? 'Retake' : 'Take Photo'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { setActivePhotoIndex(idx); fileInputRef.current?.click(); }} icon={<Upload className="w-3 h-3" />}>
                            Upload
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => {
        const file = e.target.files?.[0];
        if (file && activePhotoIndex !== null) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            if (activePhotoIndex === -1) {
              setCapturedSketch(base64String);
            } else {
              updateTriPoint(activePhotoIndex, 'photo', base64String);
            }
            setActivePhotoIndex(null);
          };
          reader.readAsDataURL(file);
          // Reset input value so the same file can be selected again
          e.target.value = '';
        }
      }} />

      <canvas ref={photoCanvasRef} className="hidden" />

      {isCameraActive && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black">
          <div className="relative flex-1 flex items-center justify-center overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
            
            {/* Camera Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-12">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={stopCamera} 
                className="w-12 h-12 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30 transition-colors backdrop-blur-md"
              >
                <X className="w-6 h-6" />
              </Button>
              <Button 
                onClick={capturePhoto} 
                className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 shadow-xl flex items-center justify-center hover:scale-105 transition-transform p-0"
              >
                <div className="w-16 h-16 bg-white rounded-full border border-slate-200"></div>
              </Button>
              <div className="w-12 h-12"></div> {/* Spacer for centering */}
            </div>
          </div>
        </div>
      )}

      {isDrawing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsDrawing(false)}></div>
          <div className="relative bg-[#111c26] border border-white/10 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col h-[80vh]">
            <header className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex flex-col">
                <SectionHeading className="mb-0 font-black uppercase tracking-tight text-white">Track Path Drawing</SectionHeading>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={clearCanvas} className="text-slate-400 hover:text-rose-500">Clear</Button>
                <Button variant="ghost" size="icon" onClick={() => setIsDrawing(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></Button>
              </div>
            </header>
            <div className="flex-1 bg-white relative overflow-hidden flex items-center justify-center">
              <canvas ref={canvasRef} className="w-full h-full touch-none cursor-crosshair bg-white" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
            </div>
            <footer className="p-4 bg-white/5 border-t border-white/5 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsDrawing(false)} className="text-slate-400 hover:text-white">Cancel</Button>
              <Button onClick={saveSketch}>Capture Sketch</Button>
            </footer>
          </div>
        </div>
      )}

      {/* Redesigned Footer for Mobile Visibility */}
      <footer className={`fixed bottom-0 left-0 right-0 lg:left-64 backdrop-blur-xl border-t z-50 shadow-[0_-15px_30px_rgba(0,0,0,0.15)] ${
        theme === 'dark' ? 'bg-[#111418]/95 border-slate-800' : 'bg-white/95 border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3">
          {!isFormValid && errorInfo && hasAttemptedSave && (
            <div className="w-full">
              <Button 
                variant="outline"
                className="w-full border-rose-500/30 bg-rose-500/5 text-rose-500 hover:bg-rose-500/10 border-dashed justify-start h-auto py-2"
                onClick={() => scrollToField(errorInfo.targetId)}
                icon={<AlertCircle className="w-5 h-5" />}
              >
                <div className="flex flex-col text-left">
                  <span className="text-[7px] font-black uppercase tracking-[0.1em] opacity-80 leading-tight">Action Required</span>
                  <span className="text-[10px] font-black uppercase tracking-wider leading-tight">{errorInfo.message}</span>
                </div>
              </Button>
            </div>
          )}

          <div className="flex flex-col w-full gap-3">
            {saveError && (
              <div className="w-full bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 rounded-xl flex items-center gap-3 border-dashed">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                <BodyText className="text-rose-500 font-bold text-xs">{saveError}</BodyText>
              </div>
            )}
            <div className="flex items-center justify-between w-full gap-3">
              <div className="flex items-center gap-3 flex-1">
                <Button 
                  className="flex-1 sm:flex-none sm:min-w-[160px]"
                  onClick={handleSave}
                  isLoading={isSaving}
                  disabled={isSaving}
                >
                  SAVE ENTRY
                </Button>
                <Button 
                  variant="outline"
                  className="border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <Modal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        title="Discard Progress?"
      >
        <div className="flex flex-col items-center text-center p-4">
          <BodyText className="mb-8">Unsaved data for the new turtle track will be lost.</BodyText>
          <div className="flex flex-col w-full gap-3">
            <Button variant="destructive" onClick={onBack} className="w-full">Discard Entry</Button>
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)} className="w-full">Continue Recording</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!confirmTime}
        onClose={() => setConfirmTime(null)}
        title="Overwrite Time?"
      >
        <div className="flex flex-col items-center text-center p-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <BodyText className="mb-8">
            You already have a time set. Are you sure you want to overwrite it with the current time?
          </BodyText>
          <div className="flex flex-col w-full gap-3">
            <Button 
              className="w-full bg-amber-500 hover:bg-amber-600 border-none"
              onClick={() => {
                if (confirmTime) {
                  setFormData(prev => ({ ...prev, [confirmTime.field]: confirmTime.value }));
                  setConfirmTime(null);
                }
              }} 
            >
              Yes, Overwrite
            </Button>
            <Button variant="outline" onClick={() => setConfirmTime(null)} className="w-full">Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default NestEntry;
