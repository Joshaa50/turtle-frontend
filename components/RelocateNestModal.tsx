import React, { useState, useId, useRef } from 'react';
import { Minus, Plus, Camera, X, Upload, RefreshCw, AlertCircle } from 'lucide-react';
import { NestData, DatabaseConnection } from '../services/Database';
import { formatTimeInput } from '../lib/utils';

interface RelocateNestModalProps {
  nest: NestData;
  onClose: () => void;
  onSave: () => void;
}

const MetricInput: React.FC<{
  label: React.ReactNode;
  unit: string;
  placeholder?: string;
  value: string | number;
  onChange: (val: string) => void;
  decimalPlaces?: number;
}> = ({ label, unit, placeholder = "0.0", value, onChange, decimalPlaces = 2 }) => {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1 text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <div className="relative group">
        <input 
          id={id}          
          className="w-full border rounded-lg h-12 pl-4 pr-12 outline-none transition-all font-mono text-sm focus:ring-primary focus:border-primary bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
          placeholder={placeholder}
          type="number"
          step={1 / Math.pow(10, decimalPlaces)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="absolute right-3 top-0 bottom-0 flex items-center pointer-events-none">
          <span className="text-[9px] font-mono font-bold uppercase text-slate-400 dark:text-slate-500">{unit}</span>
        </div>
      </div>
    </div>
  );
};

const RelocateNestModal: React.FC<RelocateNestModalProps> = ({ nest, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    gps_lat: '',
    gps_long: '',
    depth_top_egg_h: '',
    depth_bottom_chamber_H: '',
    width_w: '',
    distance_to_sea_s: '',
    notes: '',
    relocationReason: '',
    eggsTakenOut: '',
    eggsPutBackIn: '',
    startTime: '',
    endTime: '',
  });

  const updateCounter = (field: 'eggsTakenOut' | 'eggsPutBackIn', delta: number) => {
    setFormData(prev => {
      const current = parseInt(prev[field] || '0') || 0;
      return { ...prev, [field]: Math.max(0, current + delta).toString() };
    });
  };

  const [confirmTime, setConfirmTime] = useState<{ field: 'startTime' | 'endTime', value: string } | null>(null);

  const setNow = (field: 'startTime' | 'endTime') => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    if (formData[field]) {
      setConfirmTime({ field, value: now });
    } else {
      setFormData(prev => ({ ...prev, [field]: now }));
    }
  };

  const [triangulation, setTriangulation] = useState([
    { desc: '', dist: '', lat: '', lng: '', photo: null as string | null },
    { desc: '', dist: '', lat: '', lng: '', photo: null as string | null }
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  const startCamera = (index: number) => {
    setActivePhotoIndex(index);
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  };

  const updateTriPoint = (index: number, field: string, val: string) => {
    const next = [...triangulation];
    next[index] = { ...next[index], [field]: val };
    setTriangulation(next);
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const createTimestamp = (timeString?: string) => {
        if (!timeString) return undefined;
        const date = new Date();
        const [hours, minutes] = timeString.split(':');
        date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        return date.toISOString();
      };

      // Create relocation event
      await DatabaseConnection.createNestEvent({
        event_type: 'RELOCATION',
        nest_code: nest.nest_code,
        total_eggs: formData.eggsTakenOut ? parseInt(formData.eggsTakenOut) : (nest.total_num_eggs || undefined),
        eggs_reburied: formData.eggsPutBackIn ? parseInt(formData.eggsPutBackIn) : (nest.current_num_eggs || undefined),
        original_depth_top_egg_h: nest.depth_top_egg_h,
        original_depth_bottom_chamber_h: nest.depth_bottom_chamber_h || undefined,
        original_width_w: nest.width_w || undefined,
        original_distance_to_sea_s: nest.distance_to_sea_s,
        original_gps_lat: nest.gps_lat,
        original_gps_long: nest.gps_long,
        reburied_gps_lat: formData.gps_lat ? parseFloat(formData.gps_lat) : nest.gps_lat,
        reburied_gps_long: formData.gps_long ? parseFloat(formData.gps_long) : nest.gps_long,
        reburied_depth_top_egg_h: formData.depth_top_egg_h ? parseFloat(formData.depth_top_egg_h) : nest.depth_top_egg_h,
        reburied_depth_bottom_chamber_h: formData.depth_bottom_chamber_H ? parseFloat(formData.depth_bottom_chamber_H) : (nest.depth_bottom_chamber_h || undefined),
        reburied_width_w: formData.width_w ? parseFloat(formData.width_w) : (nest.width_w || undefined),
        reburied_distance_to_sea_s: formData.distance_to_sea_s ? parseFloat(formData.distance_to_sea_s) : nest.distance_to_sea_s,
        start_time: createTimestamp(formData.startTime),
        end_time: createTimestamp(formData.endTime),
        notes: `Reason: ${formData.relocationReason}. Eggs Taken: ${formData.eggsTakenOut}. Eggs Put Back: ${formData.eggsPutBackIn}. Start: ${formData.startTime}. End: ${formData.endTime}.`,
      });
      // Update nest record
      await DatabaseConnection.updateNest(nest.id!, {
        ...nest,
        gps_lat: formData.gps_lat ? parseFloat(formData.gps_lat) : nest.gps_lat,
        gps_long: formData.gps_long ? parseFloat(formData.gps_long) : nest.gps_long,
        depth_top_egg_h: formData.depth_top_egg_h ? parseFloat(formData.depth_top_egg_h) : nest.depth_top_egg_h,
        depth_bottom_chamber_h: formData.depth_bottom_chamber_H ? parseFloat(formData.depth_bottom_chamber_H) : nest.depth_bottom_chamber_h,
        width_w: formData.width_w ? parseFloat(formData.width_w) : nest.width_w,
        distance_to_sea_s: formData.distance_to_sea_s ? parseFloat(formData.distance_to_sea_s) : nest.distance_to_sea_s,
        total_num_eggs: formData.eggsTakenOut ? parseInt(formData.eggsTakenOut) : nest.total_num_eggs,
        current_num_eggs: formData.eggsPutBackIn ? parseInt(formData.eggsPutBackIn) : nest.current_num_eggs,
        relocated: true,
        tri_tl_desc: triangulation[0].desc || nest.tri_tl_desc,
        tri_tl_lat: triangulation[0].lat ? parseFloat(triangulation[0].lat) : nest.tri_tl_lat,
        tri_tl_long: triangulation[0].lng ? parseFloat(triangulation[0].lng) : nest.tri_tl_long,
        tri_tl_distance: triangulation[0].dist ? parseFloat(triangulation[0].dist) : nest.tri_tl_distance,
        tri_tl_img: triangulation[0].photo || nest.tri_tl_img,
        tri_tr_desc: triangulation[1].desc || nest.tri_tr_desc,
        tri_tr_lat: triangulation[1].lat ? parseFloat(triangulation[1].lat) : nest.tri_tr_lat,
        tri_tr_long: triangulation[1].lng ? parseFloat(triangulation[1].lng) : nest.tri_tr_long,
        tri_tr_distance: triangulation[1].dist ? parseFloat(triangulation[1].dist) : nest.tri_tr_distance,
        tri_tr_img: triangulation[1].photo || nest.tri_tr_img,
      });
      onSave();
      onClose();
    } catch (error) {
      console.error('Error relocating nest:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#111418] rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-white/10 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-black uppercase tracking-widest mb-6 text-primary">Relocate Nest</h2>
        
        <div className="space-y-6 mb-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-primary uppercase tracking-widest">Reason for Relocation</label>
            <select 
              value={formData.relocationReason} 
              onChange={(e) => setFormData({...formData, relocationReason: e.target.value})} 
              className="w-full border rounded-lg h-10 px-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none cursor-pointer bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white shadow-sm"
            >
              <option value="">Select Reason</option>
              {relocationReasons.map(reason => <option key={reason} value={reason}>{reason}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-primary uppercase tracking-widest">Eggs Taken Out</label>
              <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 w-full">
                <button type="button" onClick={() => updateCounter('eggsTakenOut', -1)} className="p-2 text-slate-500 hover:text-primary hover:bg-slate-200 dark:hover:bg-white/10 rounded-l-lg transition-colors flex-shrink-0"><Minus size={16} /></button>
                <input type="number" placeholder="0" value={formData.eggsTakenOut} onChange={(e) => setFormData({...formData, eggsTakenOut: e.target.value})} className="w-full bg-transparent p-2 text-sm text-center outline-none font-mono" />
                <button type="button" onClick={() => updateCounter('eggsTakenOut', 1)} className="p-2 text-slate-500 hover:text-primary hover:bg-slate-200 dark:hover:bg-white/10 rounded-r-lg transition-colors flex-shrink-0"><Plus size={16} /></button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-primary uppercase tracking-widest">Eggs Put Back In</label>
              <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 w-full">
                <button type="button" onClick={() => updateCounter('eggsPutBackIn', -1)} className="p-2 text-slate-500 hover:text-primary hover:bg-slate-200 dark:hover:bg-white/10 rounded-l-lg transition-colors flex-shrink-0"><Minus size={16} /></button>
                <input type="number" placeholder="0" value={formData.eggsPutBackIn} onChange={(e) => setFormData({...formData, eggsPutBackIn: e.target.value})} className="w-full bg-transparent p-2 text-sm text-center outline-none font-mono" />
                <button type="button" onClick={() => updateCounter('eggsPutBackIn', 1)} className="p-2 text-slate-500 hover:text-primary hover:bg-slate-200 dark:hover:bg-white/10 rounded-r-lg transition-colors flex-shrink-0"><Plus size={16} /></button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-primary uppercase tracking-widest">Start Time</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-slate-100 dark:bg-white/5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10">
                  <input 
                    type="text" 
                    placeholder="--:--"
                    value={formData.startTime} 
                    onChange={(e) => {
                      setFormData({...formData, startTime: formatTimeInput(e.target.value)});
                    }} 
                    className="w-full bg-transparent text-sm outline-none font-mono" 
                  />
                </div>
                <button type="button" onClick={() => setNow('startTime')} className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest border border-primary/20 hover:bg-primary/20 transition-colors h-full whitespace-nowrap flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 font-bold" />
                  Now
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-primary uppercase tracking-widest">End Time</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-slate-100 dark:bg-white/5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10">
                  <input 
                    type="text" 
                    placeholder="--:--"
                    value={formData.endTime} 
                    onChange={(e) => {
                      setFormData({...formData, endTime: formatTimeInput(e.target.value)});
                    }} 
                    className="w-full bg-transparent text-sm outline-none font-mono" 
                  />
                </div>
                <button type="button" onClick={() => setNow('endTime')} className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest border border-primary/20 hover:bg-primary/20 transition-colors h-full whitespace-nowrap flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 font-bold" />
                  Now
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MetricInput label="h (Depth top)" unit="cm" placeholder={nest.depth_top_egg_h?.toString() || "0.0"} value={formData.depth_top_egg_h} onChange={(v) => setFormData({...formData, depth_top_egg_h: v})} />
            <MetricInput label="h (Depth bottom)" unit="cm" placeholder={nest.depth_bottom_chamber_h?.toString() || "0.0"} value={formData.depth_bottom_chamber_H} onChange={(v) => setFormData({...formData, depth_bottom_chamber_H: v})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MetricInput label="w (Width)" unit="cm" placeholder={nest.width_w?.toString() || "0.0"} value={formData.width_w} onChange={(v) => setFormData({...formData, width_w: v})} />
            <MetricInput label="S (Dist to sea)" unit="m" placeholder={nest.distance_to_sea_s?.toString() || "0.0"} value={formData.distance_to_sea_s} onChange={(v) => setFormData({...formData, distance_to_sea_s: v})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MetricInput label="Latitude" unit="lat" placeholder="38.xxxxx" value={formData.gps_lat} onChange={(v) => setFormData({...formData, gps_lat: v})} decimalPlaces={5} />
            <MetricInput label="Longitude" unit="lng" placeholder="20.xxxxx" value={formData.gps_long} onChange={(v) => setFormData({...formData, gps_long: v})} decimalPlaces={5} />
          </div>
        </div>
        
        <div className="space-y-4 mb-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Triangulation Points</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {triangulation.map((point, idx) => (
              <div key={idx} className="space-y-4 p-4 rounded-xl border bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-black uppercase rounded tracking-widest">Triangulation Point 0{idx + 1}</span>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Description</label>
                    <input 
                      type="text" 
                      value={point.desc}
                      onChange={(e) => updateTriPoint(idx, 'desc', e.target.value)}
                      placeholder={idx === 0 ? (nest.tri_tl_desc || "Bamboo") : (nest.tri_tr_desc || "Rock")}
                      className="w-full border rounded-lg h-10 px-4 text-xs font-bold focus:ring-1 focus:ring-primary outline-none transition-all bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <MetricInput 
                      label="Distance to Nest" 
                      unit="m" 
                      placeholder={idx === 0 ? (nest.tri_tl_distance?.toString() || "0.00") : (nest.tri_tr_distance?.toString() || "0.00")}
                      value={point.dist}
                      onChange={(v) => updateTriPoint(idx, 'dist', v)}
                    />
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Coordinates</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] text-primary font-black uppercase tracking-wider ml-1">Lat</span>
                          <input 
                            type="text" 
                            placeholder={idx === 0 ? (nest.tri_tl_lat?.toString() || "N 037.23543") : (nest.tri_tr_lat?.toString() || "N 037.23543")}
                            value={point.lat}
                            onChange={(e) => updateTriPoint(idx, 'lat', e.target.value)}
                            className="w-full border rounded-lg h-12 px-4 text-[10px] font-mono font-bold outline-none transition-all border-slate-300 focus:ring-1 focus:ring-primary bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" 
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] text-primary font-black uppercase tracking-wider ml-1">Lng</span>
                          <input 
                            type="text" 
                            placeholder={idx === 0 ? (nest.tri_tl_long?.toString() || "E 021.61630") : (nest.tri_tr_long?.toString() || "E 021.61630")}
                            value={point.lng}
                            onChange={(e) => updateTriPoint(idx, 'lng', e.target.value)}
                            className="w-full border rounded-lg h-12 px-4 text-[10px] font-mono font-bold outline-none transition-all border-slate-300 focus:ring-1 focus:ring-primary bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2 text-primary">
                      <Camera className="w-4 h-4" />
                      <h4 className="text-[10px] font-black uppercase tracking-tight">Point Photo</h4>
                    </div>
                    <div className="relative border-2 border-dashed rounded-xl aspect-[16/9] overflow-hidden group mb-2 border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/30">
                      {point.photo ? (
                        <>
                          <img src={point.photo} alt={`Triangulation point ${idx + 1}`} className="w-full h-full object-contain" />
                          <button 
                            onClick={() => updateTriPoint(idx, 'photo', null as any)}
                            className="absolute top-2 right-2 size-8 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-all active:scale-95 z-10"
                            title="Remove photo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <Camera className="w-8 h-8 text-slate-400" />
                          <p className="text-xs font-bold text-slate-500">No photo</p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button onClick={() => startCamera(idx)} className="w-full py-2 border border-primary/50 text-primary rounded-lg font-black uppercase tracking-widest text-[10px] hover:bg-primary/10 transition-all flex items-center justify-center gap-2">
                        <Camera className="w-3 h-3" /> {point.photo ? 'Retake' : 'Take Photo'}
                      </button>
                      <button onClick={() => { setActivePhotoIndex(idx); fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }} className="w-full py-2 border border-slate-400 text-slate-500 rounded-lg font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                        <Upload className="w-3 h-3" /> Upload
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={onClose} className="flex-1 px-6 py-3 bg-slate-100 dark:bg-white/5 rounded-xl text-xs font-black uppercase tracking-widest">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="flex-1 px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest">
            {isSaving ? 'Saving...' : 'Record Relocation'}
          </button>
        </div>
      </div>

      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => {
        const file = e.target.files?.[0];
        if (file && activePhotoIndex !== null) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            updateTriPoint(activePhotoIndex, 'photo', base64String);
          };
          reader.readAsDataURL(file);
        }
        // Reset input so the same file can be selected again if needed
        if (e.target) e.target.value = '';
      }} />

      {confirmTime && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#111418] rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 text-amber-500">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">Overwrite Time?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  A time is already set for this field ({formData[confirmTime.field]}). Are you sure you want to update it to {confirmTime.value}?
                </p>
              </div>
            </div>
            <footer className="p-4 border-t flex gap-3 bg-slate-50 border-slate-100 dark:bg-white/5 dark:border-white/5">
              <button 
                onClick={() => setConfirmTime(null)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setFormData(prev => ({ ...prev, [confirmTime.field]: confirmTime.value }));
                  setConfirmTime(null);
                }}
                className="flex-1 px-4 py-3 rounded-xl font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                Overwrite
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelocateNestModal;
