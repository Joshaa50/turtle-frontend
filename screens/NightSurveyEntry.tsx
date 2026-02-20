
import React, { useState, useEffect } from 'react';
import { DatabaseConnection, TurtleData, TurtleEventData } from '../services/Database';
import { TurtleRecord } from '../types';

interface NightSurveyEntryProps {
  onBack: () => void;
}

type EntryMode = 'EXISTING' | 'NEW';

const NightSurveyEntry: React.FC<NightSurveyEntryProps> = ({ onBack }) => {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Mode selection state
  const [entryMode, setEntryMode] = useState<EntryMode>('EXISTING');
  const [availableTurtles, setAvailableTurtles] = useState<TurtleRecord[]>([]);
  const [selectedTurtleId, setSelectedTurtleId] = useState<string>('');
  const [isLoadingTurtles, setIsLoadingTurtles] = useState(false);
  
  // Map of TagID -> TurtleID for duplicate checking
  const [usedTags, setUsedTags] = useState<Map<string, string>>(new Map());

  const [formData, setFormData] = useState<any>({
    event_date: new Date().toISOString().split('T')[0],
    location: 'Kyparissia - Sector O',
    observer: '',
    
    // Turtle Identity (Used only if entryMode === 'NEW')
    name: '',
    species: 'Loggerhead',
    sex: 'Female', // Defaulting to female for night surveys (nesting) usually
    health_condition: 'Healthy',

    // Time log
    time_first_seen: '',
    time_start_egg_laying: '',
    time_covering: '',
    time_end_camouflage: '',
    time_reach_sea: '',

    // Tags
    front_left_tag: '',
    front_left_address: '',
    front_right_tag: '',
    front_right_address: '',
    rear_left_tag: '',
    rear_left_address: '',
    rear_right_tag: '',
    rear_right_address: '',

    // Measurements
    scl_max: '',
    scl_min: '',
    scw: '',
    ccl_max: '',
    ccl_min: '',
    ccw: '',
    tail_extension: '',
    vent_to_tail_tip: '',
    total_tail_length: '',

    notes: ''
  });

  useEffect(() => {
    // Fetch available turtles on mount for the selection dropdown
    const loadTurtles = async () => {
      setIsLoadingTurtles(true);
      try {
        const rawTurtles = await DatabaseConnection.getTurtles();
        
        // Build usedTags map for duplicate checking
        const tagMap = new Map<string, string>();
        rawTurtles.forEach((t: any) => {
            const tId = String(t.id);
            [t.front_left_tag, t.front_right_tag, t.rear_left_tag, t.rear_right_tag].forEach(tag => {
                if (tag && typeof tag === 'string') {
                    tagMap.set(tag.trim(), tId);
                }
            });
        });
        setUsedTags(tagMap);

        // Map to TurtleRecord interface for UI consistency
        const mapped = rawTurtles.map((t: any) => ({
            id: t.id,
            tagId: t.front_left_tag || t.front_right_tag || t.rear_left_tag || t.rear_right_tag || `ID-${t.id}`,
            name: t.name || 'Unnamed',
            species: t.species,
            lastSeen: new Date(t.updated_at || t.created_at).toLocaleDateString(), 
            location: '',
            weight: 0
        }));
        setAvailableTurtles(mapped);
      } catch (e) {
        console.error("Error loading turtles", e);
      } finally {
        setIsLoadingTurtles(false);
      }
    };
    loadTurtles();
  }, []);

  const handleInputChange = (field: string, value: string | number) => {
    // Prevent negative numbers for measurements
    const measurementFields = [
      'scl_max', 'scl_min', 'scw', 
      'ccl_max', 'ccl_min', 'ccw', 
      'tail_extension', 'vent_to_tail_tip', 'total_tail_length'
    ];

    if (measurementFields.includes(field)) {
      const strValue = String(value);
      if (strValue.includes('-') || (strValue !== '' && Number(strValue) < 0)) {
        return;
      }
    }

    setFormData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const combineDateAndTime = (date: string, time: string) => {
    if (!date || !time) return undefined;
    return `${date} ${time}:00`;
  };

  const handleSave = async () => {
    // Validations
    if (!formData.observer) {
        setErrorMessage("Observer Name is required.");
        return;
    }

    if (entryMode === 'EXISTING' && !selectedTurtleId) {
        setErrorMessage("Please select an existing turtle.");
        return;
    }

    // DUPLICATE TAG VALIDATION
    const tagsToCheck = [
        { label: 'Front Left', val: formData.front_left_tag },
        { label: 'Front Right', val: formData.front_right_tag },
        { label: 'Rear Left', val: formData.rear_left_tag },
        { label: 'Rear Right', val: formData.rear_right_tag }
    ].filter(t => t.val); // Filter out empty tags

    // 1. Check for duplicates within the form itself
    const uniqueFormTags = new Set(tagsToCheck.map(t => t.val));
    if (uniqueFormTags.size !== tagsToCheck.length) {
        setErrorMessage("Duplicate Tag IDs entered in the form.");
        return;
    }

    // 2. Check against database
    for (const { label, val } of tagsToCheck) {
        if (usedTags.has(val)) {
            const ownerId = usedTags.get(val);
            
            // If NEW mode, any existing tag is a conflict.
            // If EXISTING mode, conflict only if tag belongs to a different turtle.
            if (entryMode === 'NEW' || (entryMode === 'EXISTING' && ownerId !== String(selectedTurtleId))) {
                setErrorMessage(`Tag ${val} (${label}) is already assigned to Turtle #${ownerId}.`);
                return;
            }
        }
    }

    setIsSaving(true);
    setErrorMessage(null);

    const numericData = {
        scl_max: formData.scl_max === '' ? 0 : Number(formData.scl_max),
        scl_min: formData.scl_min === '' ? 0 : Number(formData.scl_min),
        scw: formData.scw === '' ? 0 : Number(formData.scw),
        ccl_max: formData.ccl_max === '' ? 0 : Number(formData.ccl_max),
        ccl_min: formData.ccl_min === '' ? 0 : Number(formData.ccl_min),
        ccw: formData.ccw === '' ? 0 : Number(formData.ccw),
        tail_extension: formData.tail_extension === '' ? 0 : Number(formData.tail_extension),
        vent_to_tail_tip: formData.vent_to_tail_tip === '' ? 0 : Number(formData.vent_to_tail_tip),
        total_tail_length: formData.total_tail_length === '' ? 0 : Number(formData.total_tail_length),
    };

    try {
        let finalTurtleId = selectedTurtleId;

        // 1. If NEW Mode, Create Turtle First via /turtles/create
        if (entryMode === 'NEW') {
            console.log("[NightSurveyEntry] Creating NEW turtle...");
            const turtleSubmission: TurtleData = {
                name: formData.name,
                species: formData.species,
                sex: formData.sex.toLowerCase(), // Ensure lowercase as per backend
                health_condition: formData.health_condition,
                
                // For new turtles, the current form tag data is their initial tag data
                front_left_tag: formData.front_left_tag,
                front_left_address: formData.front_left_address,
                front_right_tag: formData.front_right_tag,
                front_right_address: formData.front_right_address,
                rear_left_tag: formData.rear_left_tag,
                rear_left_address: formData.rear_left_address,
                rear_right_tag: formData.rear_right_tag,
                rear_right_address: formData.rear_right_address,

                ...numericData
            };

            const turtleResponse = await DatabaseConnection.createTurtle(turtleSubmission);
            
            // Robust extraction of ID
            finalTurtleId = turtleResponse.turtle?.id || turtleResponse.id || turtleResponse.insertId;
            
            if (!finalTurtleId) {
                console.error("Failed to extract ID from response:", turtleResponse);
                throw new Error("Created turtle but could not retrieve its ID.");
            }
            console.log("[NightSurveyEntry] New turtle created with ID:", finalTurtleId);
        } else {
            console.log("[NightSurveyEntry] Using EXISTING turtle ID for event creation:", finalTurtleId);
            
             // Update the existing turtle with latest stats from this survey
             const updatePayload = {
                health_condition: formData.health_condition,
                front_left_tag: formData.front_left_tag,
                front_left_address: formData.front_left_address,
                front_right_tag: formData.front_right_tag,
                front_right_address: formData.front_right_address,
                rear_left_tag: formData.rear_left_tag,
                rear_left_address: formData.rear_left_address,
                rear_right_tag: formData.rear_right_tag,
                rear_right_address: formData.rear_right_address,
                ...numericData
            };
            await DatabaseConnection.updateTurtle(finalTurtleId, updatePayload);
        }

        // Check if we have a valid ID before creating event
        if (!finalTurtleId) {
             throw new Error("No valid Turtle ID available for this event.");
        }

        // 2. Create Survey Event linked to the Turtle ID via /turtle_survey_events/create
        const eventSubmission: TurtleEventData = {
            event_date: formData.event_date,
            event_type: 'NIGHT_SURVEY',
            location: formData.location,
            turtle_id: Number(finalTurtleId),
            observer: formData.observer,
            health_condition: formData.health_condition, // Current health status observed
            notes: formData.notes,

            // Combine date and time for full timestamp
            time_first_seen: combineDateAndTime(formData.event_date, formData.time_first_seen),
            time_start_egg_laying: combineDateAndTime(formData.event_date, formData.time_start_egg_laying),
            time_covering: combineDateAndTime(formData.event_date, formData.time_covering),
            time_end_camouflage: combineDateAndTime(formData.event_date, formData.time_end_camouflage),
            time_reach_sea: combineDateAndTime(formData.event_date, formData.time_reach_sea),

            front_left_tag: formData.front_left_tag,
            front_left_address: formData.front_left_address,
            front_right_tag: formData.front_right_tag,
            front_right_address: formData.front_right_address,
            rear_left_tag: formData.rear_left_tag,
            rear_left_address: formData.rear_left_address,
            rear_right_tag: formData.rear_right_tag,
            rear_right_address: formData.rear_right_address,

            ...numericData
        };

        console.log("[NightSurveyEntry] Submitting event payload:", eventSubmission);
        await DatabaseConnection.createTurtleEvent(eventSubmission);
        
        alert(`Night Survey saved successfully for Turtle #${finalTurtleId}!`);
        onBack();

    } catch (error: any) {
        console.error("Save Error:", error);
        setErrorMessage(error.message || "Failed to save records.");
    } finally {
        setIsSaving(false);
    }
  };

  const selectedTurtle = availableTurtles.find(t => String(t.id) === String(selectedTurtleId));

  return (
    <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 antialiased font-display">
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#111418]/90 backdrop-blur-md border-b border-slate-200 dark:border-border-dark px-6 lg:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-5">
          <button 
            onClick={() => setShowCancelConfirm(true)}
            className="flex items-center justify-center size-9 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-dark text-slate-500 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="flex items-center gap-4">
            <h2 className="text-base font-black text-slate-800 dark:text-white leading-tight tracking-tight uppercase">Night Survey</h2>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowCancelConfirm(true)} 
            className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-rose-500 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 hover:text-white rounded-lg transition-all active:scale-95 shadow-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-wait"
          >
            {isSaving ? (
                 <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
                <span className="material-symbols-outlined text-sm">save</span>
            )}
            {isSaving ? 'Saving...' : 'Save Record'}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-6 lg:p-10">
        {errorMessage && (
            <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-500">
                <span className="material-symbols-outlined">error</span>
                <span className="text-sm font-bold">{errorMessage}</span>
            </div>
        )}

        <div className="space-y-8">
          {/* Subject Identification */}
          <section>
            <div className="flex items-center gap-2.5 mb-5">
               <span className="material-symbols-outlined text-amber-500 text-xl">search</span>
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Subject Identification</h3>
            </div>
            
            <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-2 shadow-sm mb-6 flex items-center gap-1">
                <button 
                    onClick={() => setEntryMode('EXISTING')}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${entryMode === 'EXISTING' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                    Existing Turtle
                </button>
                <button 
                    onClick={() => setEntryMode('NEW')}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${entryMode === 'NEW' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                    New Recruit
                </button>
            </div>

            {entryMode === 'EXISTING' ? (
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-7 shadow-sm">
                   <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Select Turtle <span className="text-rose-500">*</span></label>
                        <select 
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-bold text-slate-900 dark:text-white appearance-none cursor-pointer"
                            value={selectedTurtleId}
                            onChange={(e) => setSelectedTurtleId(e.target.value)}
                            disabled={isLoadingTurtles}
                        >
                            <option value="" disabled>Search by Tag or Name...</option>
                            {availableTurtles.map(t => (
                                <option key={t.id} value={String(t.id)}>
                                    {t.name ? `${t.name} (${t.tagId})` : t.tagId} - {t.species}
                                </option>
                            ))}
                        </select>
                        {isLoadingTurtles && <p className="text-[10px] text-slate-500 ml-1">Loading database...</p>}
                      </div>

                      {selectedTurtle && (
                          <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-4">
                              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                  <span className="material-symbols-outlined">check</span>
                              </div>
                              <div>
                                  <h4 className="text-sm font-black text-white">{selectedTurtle.name || 'Unnamed'}</h4>
                                  <p className="text-xs text-slate-400">{selectedTurtle.species}</p>
                              </div>
                          </div>
                      )}
                   </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-7 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-teal-500">add_circle</span>
                        <p className="text-xs font-bold text-slate-300">Creating new biological record</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Turtle Name</label>
                            <input 
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all font-bold text-slate-900 dark:text-white" 
                            placeholder="Optional" 
                            type="text" 
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Species</label>
                            <select 
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all font-bold text-slate-900 dark:text-white appearance-none cursor-pointer"
                                value={formData.species}
                                onChange={(e) => handleInputChange('species', e.target.value)}
                            >
                                <option value="Loggerhead">Loggerhead</option>
                                <option value="Green">Green</option>
                                <option value="Leatherback">Leatherback</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Sex</label>
                            <select 
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all font-bold text-slate-900 dark:text-white appearance-none cursor-pointer"
                                value={formData.sex}
                                onChange={(e) => handleInputChange('sex', e.target.value)}
                            >
                                <option value="Female">Female</option>
                                <option value="Male">Male</option>
                                <option value="Unknown">Unknown</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}
          </section>

          {/* Event Details */}
          <section>
            <div className="flex items-center gap-2.5 mb-5">
              <span className="material-symbols-outlined text-primary text-xl">event_note</span>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Event Details</h3>
            </div>
            <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-7 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Survey Date</label>
                  <input 
                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-bold text-slate-900 dark:text-white" 
                    type="date" 
                    value={formData.event_date}
                    onChange={(e) => handleInputChange('event_date', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Beach / Sector</label>
                  <select 
                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-bold text-slate-900 dark:text-white appearance-none cursor-pointer"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                  >
                    <option value="Kyparissia - Sector O">Kyparissia - Sector O</option>
                    <option value="Kyparissia - Sector B">Kyparissia - Sector B</option>
                    <option value="Zakynthos - Sekania">Zakynthos - Sekania</option>
                    <option value="Rethymno - Main">Rethymno - Main</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Observer Name <span className="text-rose-500">*</span></label>
                  <input
                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-bold text-slate-900 dark:text-white"
                    type="text"
                    placeholder="Enter observer name"
                    value={formData.observer}
                    onChange={(e) => handleInputChange('observer', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Health Condition</label>
                    <select 
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-bold text-slate-900 dark:text-white appearance-none cursor-pointer"
                        value={formData.health_condition}
                        onChange={(e) => handleInputChange('health_condition', e.target.value)}
                    >
                        <option value="Healthy">Healthy</option>
                        <option value="Injured">Injured</option>
                        <option value="Lethargic">Lethargic</option>
                        <option value="Dead">Dead</option>
                    </select>
                </div>
              </div>
            </div>
          </section>

          {/* Activity Timeline */}
          <section>
            <div className="flex items-center gap-2.5 mb-5">
              <span className="material-symbols-outlined text-teal-500 text-xl">schedule</span>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Activity Timeline</h3>
            </div>
            <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-7 shadow-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
                {[
                  { label: 'Seen', icon: 'visibility', field: 'time_first_seen' },
                  { label: 'Laying', icon: 'egg', field: 'time_start_egg_laying' },
                  { label: 'Covering', icon: 'layers', field: 'time_covering' },
                  { label: 'Camouflage', icon: 'texture', field: 'time_end_camouflage' },
                  { label: 'To Sea', icon: 'sailing', field: 'time_reach_sea' }
                ].map((act, i) => (
                  <div key={i} className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] opacity-50">{act.icon}</span>
                      {act.label}
                    </label>
                    <input 
                      className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all font-bold text-slate-900 dark:text-white" 
                      type="time"
                      value={formData[act.field]}
                      onChange={(e) => handleInputChange(act.field, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Tagging & Identification */}
          <section>
            <div className="flex items-center gap-2.5 mb-5">
              <span className="material-symbols-outlined text-primary text-xl">fingerprint</span>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Current Tagging Data</h3>
            </div>
            <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-7 shadow-sm space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-5">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] border-b border-slate-100 dark:border-border-dark pb-3">Front Flippers</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">Left Tag ID</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="text-slate-400 font-mono font-bold text-sm">KF-</span>
                        </div>
                        <input 
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all font-mono font-bold text-slate-900 dark:text-white" 
                            placeholder="0000" 
                            type="number"
                            value={formData.front_left_tag?.replace(/^KF-/, '') || ''}
                            onChange={(e) => handleInputChange('front_left_tag', e.target.value ? `KF-${e.target.value}` : '')}
                        />
                      </div>
                      <input 
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-3 text-[10px] focus:ring-1 focus:ring-primary outline-none transition-all font-bold text-slate-400 mt-2" 
                        placeholder="ADDRESS" 
                        type="text"
                        value={formData.front_left_address}
                        onChange={(e) => handleInputChange('front_left_address', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">Right Tag ID</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="text-slate-400 font-mono font-bold text-sm">KF-</span>
                        </div>
                        <input 
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all font-mono font-bold text-slate-900 dark:text-white" 
                            placeholder="0000" 
                            type="number"
                            value={formData.front_right_tag?.replace(/^KF-/, '') || ''}
                            onChange={(e) => handleInputChange('front_right_tag', e.target.value ? `KF-${e.target.value}` : '')}
                        />
                      </div>
                      <input 
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-3 text-[10px] focus:ring-1 focus:ring-primary outline-none transition-all font-bold text-slate-400 mt-2" 
                        placeholder="ADDRESS" 
                        type="text"
                        value={formData.front_right_address}
                        onChange={(e) => handleInputChange('front_right_address', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-5">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] border-b border-slate-100 dark:border-border-dark pb-3">Rear Flippers</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">Left Tag ID</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="text-slate-400 font-mono font-bold text-sm">KF-</span>
                        </div>
                        <input 
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all font-mono font-bold text-slate-900 dark:text-white" 
                            placeholder="0000" 
                            type="number"
                            value={formData.rear_left_tag?.replace(/^KF-/, '') || ''}
                            onChange={(e) => handleInputChange('rear_left_tag', e.target.value ? `KF-${e.target.value}` : '')}
                        />
                      </div>
                      <input 
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-3 text-[10px] focus:ring-1 focus:ring-primary outline-none transition-all font-bold text-slate-400 mt-2" 
                        placeholder="ADDRESS" 
                        type="text"
                        value={formData.rear_left_address}
                        onChange={(e) => handleInputChange('rear_left_address', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">Right Tag ID</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="text-slate-400 font-mono font-bold text-sm">KF-</span>
                        </div>
                        <input 
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all font-mono font-bold text-slate-900 dark:text-white" 
                            placeholder="0000" 
                            type="number"
                            value={formData.rear_right_tag?.replace(/^KF-/, '') || ''}
                            onChange={(e) => handleInputChange('rear_right_tag', e.target.value ? `KF-${e.target.value}` : '')}
                        />
                      </div>
                      <input 
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-3 text-[10px] focus:ring-1 focus:ring-primary outline-none transition-all font-bold text-slate-400 mt-2" 
                        placeholder="ADDRESS" 
                        type="text"
                        value={formData.rear_right_address}
                        onChange={(e) => handleInputChange('rear_right_address', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Morphometrics */}
          <section>
            <div className="flex items-center gap-2.5 mb-5">
              <span className="material-symbols-outlined text-amber-500 text-xl">straighten</span>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Morphometrics</h3>
            </div>
            <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-7 shadow-sm">
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-4 mb-8">
                {[
                  { label: 'SCL max', field: 'scl_max' },
                  { label: 'SCL min', field: 'scl_min' },
                  { label: 'SCW', field: 'scw' },
                  { label: 'CCL max', field: 'ccl_max' },
                  { label: 'CCL min', field: 'ccl_min' },
                  { label: 'CCW', field: 'ccw' },
                  { label: 'Tail Ext.', field: 'tail_extension' },
                  { label: 'Vent-Tip', field: 'vent_to_tail_tip' },
                  { label: 'Tot. Tail', field: 'total_tail_length' }
                ].map((m, i) => (
                  <div key={i} className="space-y-2">
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-tighter text-center">{m.label}</label>
                    <input 
                      className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-2 py-3 text-xs focus:ring-1 focus:ring-amber-500 outline-none transition-all font-bold text-slate-900 dark:text-white text-center" 
                      placeholder="CM" 
                      step="0.1" 
                      type="number"
                      min="0"
                      value={formData[m.field]}
                      onChange={(e) => handleInputChange(m.field, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Observation Notes</label>
                <textarea 
                  className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all font-medium text-slate-900 dark:text-white placeholder:opacity-30" 
                  placeholder="Describe health condition, scars, unusual behavior..." 
                  rows={4}
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                ></textarea>
              </div>
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row items-center gap-4 pt-4">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full md:w-auto flex-1 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-lg shadow-primary/20 transform transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
            >
              {isSaving ? 'Saving Record...' : 'Submit Night Survey'}
            </button>
          </div>
        </div>
      </main>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowCancelConfirm(false)}></div>
          <div className="relative bg-[#111c26] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Discard Progress?</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">Unsaved data for the survey record will be lost.</p>
            <div className="flex flex-col w-full gap-3">
              <button onClick={onBack} className="w-full py-3.5 bg-rose-500 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-500/20 active:scale-95 transition-all">Discard Entry</button>
              <button onClick={() => setShowCancelConfirm(false)} className="w-full py-3.5 bg-white/5 text-slate-300 rounded-xl font-black uppercase tracking-widest text-xs border border-white/5 hover:bg-white/10 active:scale-95 transition-all">Continue Recording</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NightSurveyEntry;
