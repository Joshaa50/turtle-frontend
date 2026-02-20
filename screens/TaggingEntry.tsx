
import React, { useState, useEffect } from 'react';
import { DatabaseConnection, TurtleData, TurtleEventData } from '../services/Database';
import { TurtleRecord } from '../types';

interface TaggingEntryProps {
  onBack: () => void;
}

type EntryMode = 'EXISTING' | 'NEW';

const TaggingEntry: React.FC<TaggingEntryProps> = ({ onBack }) => {
  const [injuryPresent, setInjuryPresent] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mode selection state
  const [entryMode, setEntryMode] = useState<EntryMode>('EXISTING');
  const [availableTurtles, setAvailableTurtles] = useState<TurtleRecord[]>([]);
  const [selectedTurtleId, setSelectedTurtleId] = useState<string>('');
  const [isLoadingTurtles, setIsLoadingTurtles] = useState(false);
  
  // Auto-calculation for KF tags
  const [nextKfNumber, setNextKfNumber] = useState<number>(2000);
  // Map of TagID -> TurtleID for duplicate checking
  const [usedTags, setUsedTags] = useState<Map<string, string>>(new Map());

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // State for all form fields.
  const [formData, setFormData] = useState<any>({
    event_date: new Date().toISOString().split('T')[0],
    
    // Identity fields (used if NEW)
    name: '',
    species: 'Loggerhead',
    sex: 'Unknown',

    // Event fields
    health_condition: 'Healthy',
    location: 'Kyparissia Bay',
    observer: '',
    
    front_left_tag: '',
    front_left_address: '',
    front_right_tag: '',
    front_right_address: '',
    rear_left_tag: '',
    rear_left_address: '',
    rear_right_tag: '',
    rear_right_address: '',

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
    // Fetch available turtles on mount for the selection dropdown and tag calculation
    const loadTurtles = async () => {
      setIsLoadingTurtles(true);
      try {
        const rawTurtles = await DatabaseConnection.getTurtles();
        
        // Calculate max KF tag and populate usedTags map
        let maxKf = 0;
        const tagMap = new Map<string, string>();

        rawTurtles.forEach((t: any) => {
            const tId = String(t.id);
            const tags = [t.front_left_tag, t.front_right_tag, t.rear_left_tag, t.rear_right_tag];
            
            tags.forEach(tag => {
                if (tag && typeof tag === 'string') {
                    const cleanTag = tag.trim();
                    // Add to map
                    tagMap.set(cleanTag, tId);

                    // Match "KF-" or "KF" followed by digits for auto-increment logic
                    const match = cleanTag.match(/KF-?(\d+)/i);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (!isNaN(num) && num > maxKf) maxKf = num;
                    }
                }
            });
        });
        
        setNextKfNumber(maxKf > 0 ? maxKf + 1 : 2000);
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

  // Mode Switch Effect to prefill or clear data
  useEffect(() => {
    if (entryMode === 'NEW') {
        setFormData((prev: any) => ({
            ...prev,
            // Auto-fill tags with next available KF number
            front_left_tag: `KF-${nextKfNumber}`,
            front_right_tag: `KF-${nextKfNumber + 1}`,
            rear_left_tag: '',
            rear_right_tag: '',
            // Clear specific fields
            name: '',
            sex: 'Unknown'
        }));
    } else {
        // Reset when switching back to existing to avoid confusion
        setFormData((prev: any) => ({
            ...prev,
            front_left_tag: '',
            front_right_tag: '',
            rear_left_tag: '',
            rear_right_tag: ''
        }));
        setSelectedTurtleId('');
        setSearchTerm('');
    }
  }, [entryMode, nextKfNumber]);

  const handleInputChange = (field: string, value: string | number) => {
    // Prevent negative numbers for measurement fields
    const measurementFields = [
      'scl_max', 'scl_min', 'scw', 
      'ccl_max', 'ccl_min', 'ccw', 
      'tail_extension', 'vent_to_tail_tip', 'total_tail_length'
    ];

    if (measurementFields.includes(field)) {
      const strValue = String(value);
      // Prevent entering negative sign or values less than 0
      if (strValue.includes('-') || (strValue !== '' && Number(strValue) < 0)) {
        return;
      }
    }

    setFormData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    // Basic validation
    if (!formData.location || !formData.observer) {
        setErrorMessage("Please fill in Location and Observer.");
        return;
    }

    if (entryMode === 'NEW' && (!formData.species || !formData.sex)) {
        setErrorMessage("Species and Sex are required for new recruits.");
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

    // Prepare numeric values
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

      // 1. Create or Update the Turtle Record
      if (entryMode === 'NEW') {
          console.log("[TaggingEntry] Creating NEW turtle...");
          const turtleSubmission: TurtleData = {
            name: formData.name,
            species: formData.species,
            sex: formData.sex.toLowerCase(), // Ensure lowercase as per backend constraint
            health_condition: formData.health_condition,

            // Initial tags
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
          
          // Robust ID extraction
          finalTurtleId = turtleResponse.turtle?.id || turtleResponse.id || turtleResponse.insertId;
          
          if (!finalTurtleId) {
                console.error("Failed to extract ID from response:", turtleResponse);
                throw new Error("Created turtle but could not retrieve its ID.");
          }
          console.log("[TaggingEntry] New turtle created with ID:", finalTurtleId);
      } else {
          console.log("[TaggingEntry] Updating EXISTING turtle ID:", finalTurtleId);
          // Update the existing turtle with new measurements, tags, and health condition
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

      // 2. Create the Survey Event Record
      const eventSubmission: TurtleEventData = {
        event_date: formData.event_date,
        event_type: 'TAGGING',
        location: formData.location,
        turtle_id: Number(finalTurtleId), // Link to the turtle (new or existing)
        observer: formData.observer,
        health_condition: formData.health_condition,
        notes: formData.notes,
        
        // Tags (Event specific observation)
        front_left_tag: formData.front_left_tag,
        front_left_address: formData.front_left_address,
        front_right_tag: formData.front_right_tag,
        front_right_address: formData.front_right_address,
        rear_left_tag: formData.rear_left_tag,
        rear_left_address: formData.rear_left_address,
        rear_right_tag: formData.rear_right_tag,
        rear_right_address: formData.rear_right_address,

        // Measurements (Event specific observation)
        ...numericData
      };

      console.log("[TaggingEntry] Submitting event payload:", eventSubmission);
      await DatabaseConnection.createTurtleEvent(eventSubmission);

      alert(`Tagging Event saved successfully for Turtle #${finalTurtleId}!`);
      onBack();
    } catch (error: any) {
      console.error("Save Error:", error);
      setErrorMessage(error.message || "Failed to save record.");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedTurtle = availableTurtles.find(t => String(t.id) === String(selectedTurtleId));

  const filteredTurtles = availableTurtles.filter(t => {
    const search = searchTerm.toLowerCase();
    const nameMatch = t.name?.toLowerCase().includes(search);
    const tagMatch = t.tagId?.toLowerCase().includes(search);
    const idMatch = String(t.id).includes(search);
    return nameMatch || tagMatch || idMatch;
  });

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen font-display relative flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-border-dark bg-white/90 dark:bg-[#111418]/90 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          {/* Back Navigation */}
          <button 
            onClick={() => setShowCancelConfirm(true)}
            className="size-9 shrink-0 hover:bg-slate-100 dark:hover:bg-surface-dark rounded-lg transition-all flex items-center justify-center text-slate-400 hover:text-white active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>

          <div className="min-w-0">
            <h1 className="text-base font-black tracking-tight text-slate-800 dark:text-white uppercase leading-tight truncate">
                Tagging Event
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 pb-48 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column */}
          <div className="lg:col-span-4 flex flex-col gap-10">
            
            {/* Subject Identification */}
            <section>
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
                      New Turtle
                  </button>
              </div>

              {entryMode === 'EXISTING' ? (
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-7 shadow-sm">
                   <div className="space-y-4">
                      {isDropdownOpen && (
                        <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                      )}
                      
                      <div className="space-y-2 relative z-50">
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Search Turtle <span className="text-rose-500">*</span></label>
                        
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-3.5 text-slate-400 pointer-events-none">search</span>
                            <input 
                                type="text"
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl pl-12 pr-4 py-3.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400/70"
                                placeholder="Name, Tag or ID..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setIsDropdownOpen(true);
                                    if (selectedTurtleId) {
                                        setSelectedTurtleId(''); 
                                    }
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                            />
                            
                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a232e] border border-slate-200 dark:border-[#283039] rounded-xl shadow-2xl z-[60] max-h-60 overflow-y-auto custom-scrollbar">
                                    {filteredTurtles.length > 0 ? (
                                        filteredTurtles.slice(0, 3).map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => {
                                                    setSelectedTurtleId(String(t.id));
                                                    setSearchTerm(t.name && t.name !== 'Unnamed' ? `${t.name} (ID: ${t.id})` : `Turtle #${t.id} - ${t.tagId}`);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-white/5 last:border-0 flex items-center justify-between group transition-colors"
                                            >
                                                <div>
                                                    <div className="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover:text-primary transition-colors">{t.name && t.name !== 'Unnamed' ? t.name : 'Unnamed Turtle'}</div>
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t.species} • ID: {t.id}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded inline-block">{t.tagId}</div>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-slate-500 text-xs font-bold uppercase tracking-wide">
                                            No turtles found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {isLoadingTurtles && <p className="text-[10px] text-slate-500 ml-1">Loading database...</p>}
                      </div>
                      
                      {selectedTurtle && !isDropdownOpen && (
                          <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                  <span className="material-symbols-outlined">check</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-black text-white truncate">{selectedTurtle.name || 'Unnamed'}</h4>
                                  <p className="text-xs text-slate-400 truncate">{selectedTurtle.species}</p>
                                  <div className="flex gap-2 mt-1">
                                    <span className="text-[9px] font-black text-primary bg-primary/10 px-1.5 rounded">ID: {selectedTurtle.id}</span>
                                    <span className="text-[9px] font-black text-slate-500 bg-slate-500/10 px-1.5 rounded truncate">Tag: {selectedTurtle.tagId}</span>
                                  </div>
                              </div>
                              <button 
                                onClick={() => {
                                    setSelectedTurtleId('');
                                    setSearchTerm('');
                                    setIsDropdownOpen(true);
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                              >
                                <span className="material-symbols-outlined">close</span>
                              </button>
                          </div>
                      )}
                   </div>
                </div>
              ) : (
                <section className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-7 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/10">
                      <span className="material-symbols-outlined text-xl">event</span>
                    </div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Turtle Identity</h2>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Turtle Name</label>
                      <input 
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-3.5 focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-sm" 
                        type="text" 
                        placeholder="e.g. Electra"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Species <span className="text-rose-500">*</span></label>
                      <select 
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-3.5 focus:ring-2 focus:ring-primary outline-none transition-all appearance-none cursor-pointer font-bold text-sm"
                        value={formData.species}
                        onChange={(e) => handleInputChange('species', e.target.value)}
                      >
                        <option value="Loggerhead">Loggerhead</option>
                        <option value="Green">Green</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Sex <span className="text-rose-500">*</span></label>
                      <select 
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-3.5 focus:ring-2 focus:ring-primary outline-none transition-all appearance-none cursor-pointer font-bold text-sm"
                        value={formData.sex}
                        onChange={(e) => handleInputChange('sex', e.target.value)}
                      >
                        <option value="Unknown">Unknown</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                      </select>
                    </div>
                  </div>
                </section>
              )}
            </section>

            <section className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-7 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-teal-500/10 rounded-xl text-teal-500 border border-teal-500/10">
                  <span className="material-symbols-outlined text-xl">event_note</span>
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Event Details</h2>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Event Date <span className="text-rose-500">*</span></label>
                    <input 
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-3.5 focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-sm" 
                        type="date" 
                        value={formData.event_date}
                        onChange={(e) => handleInputChange('event_date', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Health Condition <span className="text-rose-500">*</span></label>
                    <select 
                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-3.5 focus:ring-2 focus:ring-primary outline-none transition-all appearance-none cursor-pointer font-bold text-sm"
                    value={formData.health_condition}
                    onChange={(e) => handleInputChange('health_condition', e.target.value)}
                    >
                    <option value="Healthy">Healthy</option>
                    <option value="Injured">Injured</option>
                    <option value="Lethargic">Lethargic</option>
                    <option value="Dead">Dead</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Capture Location <span className="text-rose-500">*</span></label>
                    <select 
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-3.5 focus:ring-2 focus:ring-primary outline-none transition-all appearance-none cursor-pointer font-bold text-sm"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                    >
                        <option value="Kyparissia Bay">Kyparissia Bay</option>
                        <option value="Zakynthos">Zakynthos</option>
                        <option value="Rethymno">Rethymno</option>
                        <option value="Lakonikos Bay">Lakonikos Bay</option>
                        <option value="Koroni">Koroni</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Observer <span className="text-rose-500">*</span></label>
                    <input
                      className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-bold text-slate-900 dark:text-white"
                      type="text"
                      placeholder="Enter observer name"
                      value={formData.observer}
                      onChange={(e) => handleInputChange('observer', e.target.value)}
                    />
                </div>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-8 flex flex-col gap-10">
            <section className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-7 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-teal-500/10 rounded-xl text-teal-500 border border-teal-500/10">
                  <span className="material-symbols-outlined text-xl">straighten</span>
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Physical Measurements</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-500 flex items-center gap-2 border-b border-slate-100 dark:border-border-dark pb-2.5">
                    <span className="material-symbols-outlined text-[16px]">height</span> Lengths (cm)
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">SCL Max <span className="text-rose-500">*</span></label>
                        <input className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-2.5 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" placeholder="0.0" step="0.1" type="number" min="0"
                            value={formData.scl_max} onChange={(e) => handleInputChange('scl_max', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">SCL Min <span className="text-rose-500">*</span></label>
                        <input className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-2.5 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" placeholder="0.0" step="0.1" type="number" min="0"
                            value={formData.scl_min} onChange={(e) => handleInputChange('scl_min', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">CCL Max <span className="text-rose-500">*</span></label>
                        <input className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-2.5 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" placeholder="0.0" step="0.1" type="number" min="0"
                            value={formData.ccl_max} onChange={(e) => handleInputChange('ccl_max', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">CCL Min <span className="text-rose-500">*</span></label>
                        <input className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-2.5 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" placeholder="0.0" step="0.1" type="number" min="0"
                            value={formData.ccl_min} onChange={(e) => handleInputChange('ccl_min', e.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-500 flex items-center gap-2 border-b border-slate-100 dark:border-border-dark pb-2.5">
                    <span className="material-symbols-outlined text-[16px]">width</span> Widths (cm)
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">SCW <span className="text-rose-500">*</span></label>
                        <input className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-2.5 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" placeholder="0.0" step="0.1" type="number" min="0"
                            value={formData.scw} onChange={(e) => handleInputChange('scw', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">CCW <span className="text-rose-500">*</span></label>
                        <input className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-2.5 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" placeholder="0.0" step="0.1" type="number" min="0"
                            value={formData.ccw} onChange={(e) => handleInputChange('ccw', e.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-500 flex items-center gap-2 border-b border-slate-100 dark:border-border-dark pb-2.5">
                    <span className="material-symbols-outlined text-[16px]">show_chart</span> Tail (cm)
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Tail Extension <span className="text-rose-500">*</span></label>
                        <input className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-2.5 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" placeholder="0.0" step="0.1" type="number" min="0"
                            value={formData.tail_extension} onChange={(e) => handleInputChange('tail_extension', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Vent to Tip <span className="text-rose-500">*</span></label>
                        <input className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-2.5 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" placeholder="0.0" step="0.1" type="number" min="0"
                            value={formData.vent_to_tail_tip} onChange={(e) => handleInputChange('vent_to_tail_tip', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Total Tail Length <span className="text-rose-500">*</span></label>
                        <input className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl text-slate-900 dark:text-white p-2.5 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" placeholder="0.0" step="0.1" type="number" min="0"
                            value={formData.total_tail_length} onChange={(e) => handleInputChange('total_tail_length', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-7 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/10">
                  <span className="material-symbols-outlined text-xl">label</span>
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Tagging Identification</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  { label: "Front Left (FL)", prefix: 'front_left', color: "text-primary" },
                  { label: "Front Right (FR)", prefix: 'front_right', color: "text-primary" },
                  { label: "Rear Left (RL)", prefix: 'rear_left', color: "text-primary" },
                  { label: "Rear Right (RR)", prefix: 'rear_right', color: "text-primary" }
                ].map((tag, idx) => (
                  <div key={idx} className="space-y-4 p-5 bg-slate-50 dark:bg-background-dark/50 rounded-2xl border border-slate-200 dark:border-border-dark">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${tag.color}`}>{tag.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-slate-500 ml-1">Tag ID</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <span className="text-slate-400 font-mono font-bold text-sm">KF-</span>
                            </div>
                            <input 
                                className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm p-3 pl-10 focus:ring-1 focus:ring-primary text-slate-900 dark:text-white font-mono font-bold" 
                                placeholder="0000" 
                                type="number"
                                value={(formData as any)[`${tag.prefix}_tag`]?.replace(/^KF-/, '') || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    handleInputChange(`${tag.prefix}_tag` as keyof TurtleData, val ? `KF-${val}` : '');
                                }}
                            />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-slate-500 ml-1">Address</label>
                        <input className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-[10px] p-3 focus:ring-1 focus:ring-primary text-slate-900 dark:text-white font-bold" placeholder="ADDR" type="text"
                             value={(formData as any)[`${tag.prefix}_address`]}
                             onChange={(e) => handleInputChange(`${tag.prefix}_address` as keyof TurtleData, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-7 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-teal-500/10 rounded-xl text-teal-500 border border-teal-500/10">
                    <span className="material-symbols-outlined text-xl">medical_services</span>
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Injury Details</h2>
                </div>
                <label className="inline-flex items-center cursor-pointer group">
                  <span className="mr-4 text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-200 transition-colors">Injury Present?</span>
                  <div className="relative w-12 h-6.5 bg-slate-200 dark:bg-background-dark rounded-full transition-colors border border-slate-300 dark:border-border-dark">
                    <input 
                      className="sr-only peer" 
                      type="checkbox" 
                      checked={injuryPresent}
                      onChange={() => setInjuryPresent(!injuryPresent)}
                    />
                    <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5.5 w-5.5 shadow-sm transition-all ${injuryPresent ? 'translate-x-[22px] bg-primary' : ''}`}></div>
                  </div>
                </label>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Injury Marking Tool</label>
                  <div className="relative aspect-video bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#1a242f] dark:to-[#151e27] border-2 border-dashed border-slate-300 dark:border-[#303d4a] rounded-2xl flex items-center justify-center overflow-hidden cursor-crosshair group shadow-inner">
                    <svg className="w-3/4 h-3/4 opacity-20 dark:opacity-40 group-hover:opacity-60 transition-opacity" fill="none" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
                      <path className="text-teal-500" d="M100 10C60 10 30 40 30 75C30 90 45 110 100 110C155 110 170 90 170 75C170 40 140 10 100 10Z" stroke="currentColor" strokeWidth="2"></path>
                      <circle className="text-teal-500" cx="100" cy="115" r="10" stroke="currentColor" strokeWidth="2"></circle>
                      <circle className="text-teal-500" cx="100" cy="5" r="12" stroke="currentColor" strokeWidth="2"></circle>
                      <path className="text-teal-500" d="M40 30 L10 20" stroke="currentColor" strokeWidth="2"></path>
                      <path className="text-teal-500" d="M160 30 L190 20" stroke="currentColor" strokeWidth="2"></path>
                      <path className="text-teal-500" d="M40 100 L15 110" stroke="currentColor" strokeWidth="2"></path>
                      <path className="text-teal-500" d="M160 100 L185 110" stroke="currentColor" strokeWidth="2"></path>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest bg-white/80 dark:bg-background-dark/80 px-4 py-2 rounded-xl border border-slate-200 dark:border-border-dark backdrop-blur-sm">Click diagram to mark injury</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">General Notes & Qualitative Observations</label>
                  <textarea 
                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-2xl text-slate-900 dark:text-white p-5 focus:ring-2 focus:ring-primary outline-none transition-all resize-none shadow-inner text-sm font-medium placeholder:opacity-30" 
                    placeholder="Enter detailed qualitative observations, behavior..." 
                    rows={5}
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                  ></textarea>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white/95 dark:bg-[#111418]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-4 py-3 z-50 shadow-[0_-15px_30px_rgba(0,0,0,0.15)] flex flex-col sm:flex-row items-center justify-between min-h-[5.5rem] gap-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between w-full gap-2 sm:gap-8">
          {/* Action Group */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 min-w-[90px] sm:min-w-[140px] rounded-xl font-black uppercase tracking-widest shadow-xl transition-all text-xs flex items-center justify-center gap-2 ${!isSaving ? 'bg-primary text-white shadow-primary/30 hover:scale-[1.03] active:scale-[0.97]' : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'}`}
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

          {/* Error Message Display styled like NestEntry "Review Field" */}
          <div className="flex-grow flex justify-center overflow-hidden">
            {errorMessage && (
              <div
                className="bg-rose-500/10 border border-rose-500/50 px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 animate-in slide-in-from-bottom-2 duration-300 w-full max-w-full border-dashed group cursor-pointer hover:bg-rose-500/20 transition-all"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                <span className="material-symbols-outlined text-rose-500 text-lg sm:text-xl shrink-0 group-hover:animate-bounce">priority_high</span>
                <div className="flex flex-col text-left overflow-hidden">
                  <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-[0.1em] text-rose-400 opacity-80 leading-tight">Error</span>
                  <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-rose-500 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {errorMessage}
                  </span>
                </div>
                <div className="h-6 sm:h-8 w-px bg-rose-500/20 mx-0.5 sm:mx-1 hidden xs:block"></div>
                <span className="material-symbols-outlined text-rose-500 text-xs sm:text-base shrink-0 opacity-40 group-hover:opacity-100 transition-opacity hidden sm:block">near_me</span>
              </div>
            )}
          </div>

          <div className="hidden lg:block w-[120px] shrink-0"></div>
        </div>
      </footer>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowCancelConfirm(false)}></div>
          <div className="relative bg-[#111c26] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Discard Progress?</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">Unsaved data for the tagging record will be lost.</p>
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

export default TaggingEntry;
