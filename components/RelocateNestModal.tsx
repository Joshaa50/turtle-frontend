import React, { useState, useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { NestData, DatabaseConnection } from '../services/Database';

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
  theme?: 'light' | 'dark';
}> = ({ label, unit, placeholder = "0.0", value, onChange, theme = 'light' }) => {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={`block text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </label>
      <div className="relative group">
        <input 
          id={id}          
          className={`w-full border rounded-lg h-12 pl-4 pr-12 outline-none transition-all font-mono text-sm focus:ring-primary focus:border-primary ${
            theme === 'dark' 
              ? 'bg-slate-900 border-slate-700 text-white' 
              : 'bg-slate-50 border-slate-300 text-slate-900'
          }`}
          placeholder={placeholder}
          type="number"
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

  const setNow = (field: 'startTime' | 'endTime') => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    setFormData(prev => ({ ...prev, [field]: now }));
  };

  const [triangulation, setTriangulation] = useState([
    { desc: nest.tri_tl_desc || '', dist: nest.tri_tl_distance?.toString() || '', lat: nest.tri_tl_lat?.toString() || '', lng: nest.tri_tl_long?.toString() || '' },
    { desc: nest.tri_tr_desc || '', dist: nest.tri_tr_distance?.toString() || '', lat: nest.tri_tr_lat?.toString() || '', lng: nest.tri_tr_long?.toString() || '' }
  ]);

  const [isSaving, setIsSaving] = useState(false);

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
      // Create relocation event
      await DatabaseConnection.createNestEvent({
        event_type: 'RELOCATION',
        nest_code: nest.nest_code,
        reburied_gps_lat: parseFloat(formData.gps_lat),
        reburied_gps_long: parseFloat(formData.gps_long),
        reburied_depth_top_egg_h: parseFloat(formData.depth_top_egg_h),
        reburied_distance_to_sea_s: parseFloat(formData.distance_to_sea_s),
        notes: `Reason: ${formData.relocationReason}. Eggs Taken: ${formData.eggsTakenOut}. Eggs Put Back: ${formData.eggsPutBackIn}. Start: ${formData.startTime}. End: ${formData.endTime}. Notes: ${formData.notes}`,
      });
      // Update nest record
      await DatabaseConnection.updateNest(nest.id!, {
        gps_lat: parseFloat(formData.gps_lat),
        gps_long: parseFloat(formData.gps_long),
        depth_top_egg_h: parseFloat(formData.depth_top_egg_h),
        depth_bottom_chamber_h: formData.depth_bottom_chamber_H ? parseFloat(formData.depth_bottom_chamber_H) : null,
        width_w: formData.width_w ? parseFloat(formData.width_w) : null,
        distance_to_sea_s: parseFloat(formData.distance_to_sea_s),
        total_num_eggs: formData.eggsTakenOut ? parseInt(formData.eggsTakenOut) : nest.total_num_eggs,
        current_num_eggs: formData.eggsPutBackIn ? parseInt(formData.eggsPutBackIn) : nest.current_num_eggs,
        relocated: true,
        tri_tl_desc: triangulation[0].desc || null,
        tri_tl_lat: triangulation[0].lat ? parseFloat(triangulation[0].lat) : null,
        tri_tl_long: triangulation[0].lng ? parseFloat(triangulation[0].lng) : null,
        tri_tl_distance: triangulation[0].dist ? parseFloat(triangulation[0].dist) : null,
        tri_tr_desc: triangulation[1].desc || null,
        tri_tr_lat: triangulation[1].lat ? parseFloat(triangulation[1].lat) : null,
        tri_tr_long: triangulation[1].lng ? parseFloat(triangulation[1].lng) : null,
        tri_tr_distance: triangulation[1].dist ? parseFloat(triangulation[1].dist) : null,
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
                <button onClick={() => updateCounter('eggsTakenOut', -1)} className="p-2 text-slate-500 hover:text-primary hover:bg-slate-200 dark:hover:bg-white/10 rounded-l-lg transition-colors flex-shrink-0"><Minus size={16} /></button>
                <input type="number" placeholder="0" value={formData.eggsTakenOut} onChange={(e) => setFormData({...formData, eggsTakenOut: e.target.value})} className="w-full bg-transparent p-2 text-sm text-center outline-none font-mono" />
                <button onClick={() => updateCounter('eggsTakenOut', 1)} className="p-2 text-slate-500 hover:text-primary hover:bg-slate-200 dark:hover:bg-white/10 rounded-r-lg transition-colors flex-shrink-0"><Plus size={16} /></button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-primary uppercase tracking-widest">Eggs Put Back In</label>
              <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 w-full">
                <button onClick={() => updateCounter('eggsPutBackIn', -1)} className="p-2 text-slate-500 hover:text-primary hover:bg-slate-200 dark:hover:bg-white/10 rounded-l-lg transition-colors flex-shrink-0"><Minus size={16} /></button>
                <input type="number" placeholder="0" value={formData.eggsPutBackIn} onChange={(e) => setFormData({...formData, eggsPutBackIn: e.target.value})} className="w-full bg-transparent p-2 text-sm text-center outline-none font-mono" />
                <button onClick={() => updateCounter('eggsPutBackIn', 1)} className="p-2 text-slate-500 hover:text-primary hover:bg-slate-200 dark:hover:bg-white/10 rounded-r-lg transition-colors flex-shrink-0"><Plus size={16} /></button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-primary uppercase tracking-widest">Start Time</label>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 p-2 rounded-lg border border-slate-200 dark:border-white/10">
                <input type="time" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} className="w-full bg-transparent p-1 text-sm outline-none font-mono min-w-[80px]" />
                <button onClick={() => setNow('startTime')} className="flex-shrink-0 px-2 py-1 bg-primary/10 text-primary rounded text-[10px] font-black uppercase border border-primary/20">Now</button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-primary uppercase tracking-widest">End Time</label>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 p-2 rounded-lg border border-slate-200 dark:border-white/10">
                <input type="time" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} className="w-full bg-transparent p-1 text-sm outline-none font-mono min-w-[80px]" />
                <button onClick={() => setNow('endTime')} className="flex-shrink-0 px-2 py-1 bg-primary/10 text-primary rounded text-[10px] font-black uppercase border border-primary/20">Now</button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MetricInput label="h (Depth top)" unit="cm" placeholder="0.0" value={formData.depth_top_egg_h} onChange={(v) => setFormData({...formData, depth_top_egg_h: v})} />
            <MetricInput label="H (Depth bottom)" unit="cm" placeholder="0.0" value={formData.depth_bottom_chamber_H} onChange={(v) => setFormData({...formData, depth_bottom_chamber_H: v})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MetricInput label="w (Width)" unit="cm" placeholder="0.0" value={formData.width_w} onChange={(v) => setFormData({...formData, width_w: v})} />
            <MetricInput label="S (Dist to sea)" unit="m" placeholder="0.0" value={formData.distance_to_sea_s} onChange={(v) => setFormData({...formData, distance_to_sea_s: v})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MetricInput label="Latitude" unit="lat" placeholder="0.0000" value={formData.gps_lat} onChange={(v) => setFormData({...formData, gps_lat: v})} />
            <MetricInput label="Longitude" unit="lng" placeholder="0.0000" value={formData.gps_long} onChange={(v) => setFormData({...formData, gps_long: v})} />
          </div>
        </div>

        <textarea placeholder="Notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="bg-slate-100 dark:bg-white/5 p-3 rounded-xl text-sm w-full mb-6 border border-slate-200 dark:border-white/10 outline-none" rows={4} />
        
        <div className="space-y-4 mb-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Triangulation Points</h3>
          {triangulation.map((point, index) => (
            <div key={index} className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-white/5">
              <input placeholder={`Point ${index + 1} Description`} value={point.desc} onChange={(e) => updateTriPoint(index, 'desc', e.target.value)} className="col-span-2 bg-transparent border-b border-slate-300 dark:border-white/10 p-2 text-sm outline-none" />
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dist (m)</label>
                <input type="number" value={point.dist} onChange={(e) => updateTriPoint(index, 'dist', e.target.value)} className="bg-transparent border-b border-slate-300 dark:border-white/10 p-2 text-sm outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Lat</label>
                <input type="number" value={point.lat} onChange={(e) => updateTriPoint(index, 'lat', e.target.value)} className="bg-transparent border-b border-slate-300 dark:border-white/10 p-2 text-sm outline-none" />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Lng</label>
                <input type="number" value={point.lng} onChange={(e) => updateTriPoint(index, 'lng', e.target.value)} className="bg-transparent border-b border-slate-300 dark:border-white/10 p-2 text-sm outline-none" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <button onClick={onClose} className="flex-1 px-6 py-3 bg-slate-100 dark:bg-white/5 rounded-xl text-xs font-black uppercase tracking-widest">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="flex-1 px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest">
            {isSaving ? 'Saving...' : 'Record Relocation'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RelocateNestModal;
