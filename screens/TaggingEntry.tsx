
import React, { useState, useEffect } from 'react';
import { DatabaseConnection, TurtleData, TurtleEventData, Beach } from '../services/Database';
import { TurtleRecord } from '../types';
import { TimePicker } from '../components/TimePicker';
import { ArrowLeft, Search, Check, X, Calendar, ClipboardList, Clock, RefreshCw, Ruler, Tag, Cpu, Activity, AlertCircle, Send, Save } from 'lucide-react';

interface TaggingEntryProps {
  onBack: () => void;
  theme?: 'light' | 'dark';
  beaches: Beach[];
}

type EntryMode = 'EXISTING' | 'NEW';

const TaggingEntry: React.FC<TaggingEntryProps> = ({ onBack, theme = 'light', beaches }) => {
  const [injuryPresent, setInjuryPresent] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorTargetId, setErrorTargetId] = useState<string | null>(null);

  // Mode selection state
  const [entryMode, setEntryMode] = useState<EntryMode>('EXISTING');
  const [surveyType, setSurveyType] = useState<'TAGGING' | 'NIGHT_SURVEY'>('TAGGING');
  const [availableTurtles, setAvailableTurtles] = useState<TurtleRecord[]>([]);
  const [selectedTurtleId, setSelectedTurtleId] = useState<string>('');
  const [isLoadingTurtles, setIsLoadingTurtles] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  
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
    location: beaches.length > 0 ? beaches[0].name : 'Kyparissia Bay',
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
    
    microchip_number: '',
    microchip_location: '',
    
    // Night Survey Timings
    time_first_seen: '',
    time_start_egg_laying: '',
    time_covering: '',
    time_start_camouflage: '',
    time_end_camouflage: '',
    time_reach_sea: '',

    notes: ''
  });

  useEffect(() => {
    if (beaches.length > 0 && !formData.location) {
      setFormData(prev => ({ ...prev, location: beaches[0].name }));
    }
  }, [beaches]);

  useEffect(() => {
    // Fetch available turtles on mount for the selection dropdown and tag calculation
    const loadData = async () => {
      setIsLoadingTurtles(true);
      try {
        const [rawTurtles, userList] = await Promise.all([
          DatabaseConnection.getTurtles(),
          DatabaseConnection.getUsers()
        ]);
        
        setUsers(userList);

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
            weight: 0,
            measurements: {
                scl_max: t.scl_max,
                scl_min: t.scl_min,
                scw: t.scw,
                ccl_max: t.ccl_max,
                ccl_min: t.ccl_min,
                ccw: t.ccw,
                tail_extension: t.tail_extension,
                vent_to_tail_tip: t.vent_to_tail_tip,
                total_tail_length: t.total_tail_length,
                microchip_number: t.microchip_number,
                microchip_location: t.microchip_location
            }
        }));
        setAvailableTurtles(mapped);
      } catch (e) {
        console.error("Error loading data", e);
      } finally {
        setIsLoadingTurtles(false);
      }
    };
    loadData();
  }, []);

  // Mode Switch Effect to prefill or clear data
  useEffect(() => {
    if (entryMode === 'NEW') {
        setFormData((prev: any) => ({
            ...prev,
            // Auto-fill tags with next available KF number
            front_left_tag: '',
            front_right_tag: '',
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
  }, [entryMode]);

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
    if (!formData.location) {
        setErrorMessage("Please fill in Location.");
        setErrorTargetId('location');
        return;
    }
    if (!formData.observer) {
        setErrorMessage("Please fill in Observer.");
        setErrorTargetId('observer');
        return;
    }

    if (entryMode === 'NEW') {
        if (!formData.species) {
            setErrorMessage("Species is required for new recruits.");
            setErrorTargetId('species');
            return;
        }
        if (!formData.sex) {
            setErrorMessage("Sex is required for new recruits.");
            setErrorTargetId('sex');
            return;
        }
    }

    if (entryMode === 'EXISTING' && !selectedTurtleId) {
        setErrorMessage("Please select an existing turtle.");
        setErrorTargetId('search-turtle');
        return;
    }

    // DUPLICATE TAG VALIDATION
    const tagsToCheck = [
        { label: 'Front Left', val: formData.front_left_tag, id: 'front_left_tag' },
        { label: 'Front Right', val: formData.front_right_tag, id: 'front_right_tag' },
        { label: 'Rear Left', val: formData.rear_left_tag, id: 'rear_left_tag' },
        { label: 'Rear Right', val: formData.rear_right_tag, id: 'rear_right_tag' }
    ].filter(t => t.val); // Filter out empty tags

    // 1. Check for duplicates within the form itself
    const uniqueFormTags = new Set(tagsToCheck.map(t => t.val));
    if (uniqueFormTags.size !== tagsToCheck.length) {
        setErrorMessage("Duplicate Tag IDs entered in the form.");
        setErrorTargetId(tagsToCheck[0].id); // Just point to the first one
        return;
    }

    // 2. Check against database
    for (const { label, val, id } of tagsToCheck) {
        if (usedTags.has(val)) {
            const ownerId = usedTags.get(val);
            
            // If NEW mode, any existing tag is a conflict.
            // If EXISTING mode, conflict only if tag belongs to a different turtle.
            if (entryMode === 'NEW' || (entryMode === 'EXISTING' && ownerId !== String(selectedTurtleId))) {
                setErrorMessage(`Tag ${val} (${label}) is already assigned to Turtle #${ownerId}.`);
                setErrorTargetId(id);
                return;
            }
        }
    }

    // 3. Check for decreasing measurements (Sense Check)
    if (entryMode === 'EXISTING' && selectedTurtleId) {
        const selectedTurtle = availableTurtles.find(t => String(t.id) === String(selectedTurtleId));
        if (selectedTurtle && selectedTurtle.measurements) {
            const measurementFields = [
                { key: 'scl_max', label: 'SCL Max' },
                { key: 'scl_min', label: 'SCL Min' },
                { key: 'scw', label: 'SCW' },
                { key: 'ccl_max', label: 'CCL Max' },
                { key: 'ccl_min', label: 'CCL Min' },
                { key: 'ccw', label: 'CCW' },
                { key: 'tail_extension', label: 'Tail Extension' },
                { key: 'vent_to_tail_tip', label: 'Vent to Tip' },
                { key: 'total_tail_length', label: 'Total Tail Length' }
            ];

            for (const field of measurementFields) {
                const newValue = Number(formData[field.key]);
                const oldValue = Number((selectedTurtle.measurements as any)[field.key]);
                
                // Only check if both values are present and non-zero
                if (newValue > 0 && oldValue > 0 && newValue < oldValue) {
                    setErrorMessage(`Sense Check Failed: ${field.label} cannot be smaller than previous value (${oldValue}cm). You entered ${newValue}cm.`);
                    setErrorTargetId(field.key);
                    return;
                }
            }
        }
    }

    setIsSaving(true);
    setErrorMessage(null);
    setErrorTargetId(null);

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

            microchip_number: formData.microchip_number,
            microchip_location: formData.microchip_location,

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
            microchip_number: formData.microchip_number,
            microchip_location: formData.microchip_location,
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
        event_type: surveyType,
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

        microchip_number: formData.microchip_number,
        microchip_location: formData.microchip_location,

        // Measurements (Event specific observation)
        ...numericData,

        // Night Survey Timings (only if applicable)
        ...(surveyType === 'NIGHT_SURVEY' ? {
            time_first_seen: formData.time_first_seen,
            time_start_egg_laying: formData.time_start_egg_laying,
            time_covering: formData.time_covering,
            time_start_camouflage: formData.time_start_camouflage,
            time_end_camouflage: formData.time_end_camouflage,
            time_reach_sea: formData.time_reach_sea
        } : {})
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

  useEffect(() => {
    if (selectedTurtleId && selectedTurtle) {
        setFormData((prev: any) => ({
            ...prev,
            microchip_number: selectedTurtle.measurements?.microchip_number || '',
            microchip_location: selectedTurtle.measurements?.microchip_location || ''
        }));
    }
  }, [selectedTurtleId, selectedTurtle]);

  const filteredTurtles = availableTurtles.filter(t => {
    const search = searchTerm.toLowerCase();
    const nameMatch = t.name?.toLowerCase().includes(search);
    const tagMatch = t.tagId?.toLowerCase().includes(search);
    const idMatch = String(t.id).includes(search);
    return nameMatch || tagMatch || idMatch;
  });

  const currentBeach = beaches.find(b => b.name === formData.location);
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

  return (
    <div className={`min-h-screen font-sans relative flex flex-col ${theme === 'dark' ? 'bg-background-dark text-slate-100' : 'bg-background-light text-slate-900'}`}>
      <header className={`sticky top-0 z-40 w-full border-b backdrop-blur-md shadow-sm ${
        theme === 'dark' ? 'border-border-dark bg-[#111418]/90' : 'border-slate-200 bg-white/90'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4 relative">
          {/* Back Navigation */}
          <button 
            onClick={() => setShowCancelConfirm(true)}
            className={`size-9 shrink-0 rounded-lg transition-all flex items-center justify-center active:scale-95 z-20 ${
              theme === 'dark' ? 'hover:bg-surface-dark text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'
            }`}
          >
            <ArrowLeft className="size-5" />
          </button>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <h1 className={`text-base font-black tracking-tight uppercase leading-tight truncate ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                {surveyType === 'TAGGING' ? 'Tagging Event' : 'Night Survey'}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 pb-48 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column */}
          <div className="lg:col-span-4 flex flex-col gap-10">
            
            {/* Survey Type Selection */}
            <section>
              <div className={`border rounded-2xl p-2 shadow-sm mb-6 flex items-center gap-1 ${
                theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'
              }`}>
                  <button 
                      onClick={() => setSurveyType('TAGGING')}
                      className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        surveyType === 'TAGGING' 
                          ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                          : `text-slate-500 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`
                      }`}
                  >
                      Tagging
                  </button>
                  <button 
                      onClick={() => setSurveyType('NIGHT_SURVEY')}
                      className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        surveyType === 'NIGHT_SURVEY' 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                          : `text-slate-500 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`
                      }`}
                  >
                      Night Survey
                  </button>
              </div>
            </section>

            {/* Subject Identification */}
            <section>
              <div className={`border rounded-2xl p-2 shadow-sm mb-6 flex items-center gap-1 ${
                theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'
              }`}>
                  <button 
                      onClick={() => setEntryMode('EXISTING')}
                      className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        entryMode === 'EXISTING' 
                          ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                          : `text-slate-500 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`
                      }`}
                  >
                      Existing Turtle
                  </button>
                  <button 
                      onClick={() => setEntryMode('NEW')}
                      className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        entryMode === 'NEW' 
                          ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' 
                          : `text-slate-500 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`
                      }`}
                  >
                      New Turtle
                  </button>
              </div>

              {entryMode === 'EXISTING' ? (
                <div className={`border rounded-2xl p-7 shadow-sm ${
                  theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'
                }`}>
                   <div className="space-y-4">
                      {isDropdownOpen && (
                        <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                      )}
                      
                      <div className="space-y-2 relative z-50">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Search Turtle <span className="text-rose-500">*</span></label>
                        
                        <div className="relative">
                            <Search className="absolute left-4 top-3.5 text-slate-400 pointer-events-none size-4" />
                            <input 
                                id="search-turtle"
                                type="text"
                                className={`w-full border rounded-xl pl-12 pr-4 py-3.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-bold placeholder:text-slate-400/70 ${
                                  theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                                }`}
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
                                <div className={`absolute top-full left-0 right-0 mt-2 border rounded-xl shadow-2xl z-[60] max-h-60 overflow-y-auto custom-scrollbar ${
                                  theme === 'dark' ? 'bg-[#1a232e] border-[#283039]' : 'bg-white border-slate-200'
                                }`}>
                                    {filteredTurtles.length > 0 ? (
                                        filteredTurtles.slice(0, 3).map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => {
                                                    setSelectedTurtleId(String(t.id));
                                                    setSearchTerm(t.name && t.name !== 'Unnamed' ? `${t.name} (ID: ${t.id})` : `Turtle #${t.id} - ${t.tagId}`);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-3 border-b last:border-0 flex items-center justify-between group transition-colors ${
                                                  theme === 'dark' ? 'hover:bg-white/5 border-white/5' : 'hover:bg-slate-50 border-slate-100'
                                                }`}
                                            >
                                                <div>
                                                    <div className={`font-bold text-sm group-hover:text-primary transition-colors ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{t.name && t.name !== 'Unnamed' ? t.name : 'Unnamed Turtle'}</div>
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
                                  <Check className="size-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                  <h4 className={`text-sm font-black truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{selectedTurtle.name || 'Unnamed'}</h4>
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
                                <X className="size-5" />
                              </button>
                          </div>
                      )}
                   </div>
                </div>
              ) : (
                <section className={`border rounded-2xl p-7 shadow-sm ${
                  theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/10">
                      <Calendar className="size-5" />
                    </div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Turtle Identity</h2>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Turtle Name</label>
                      <input 
                        id="turtle-name"
                        className={`w-full border rounded-xl p-3.5 focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-sm ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`} 
                        type="text" 
                        placeholder="Electra"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Species <span className="text-rose-500">*</span></label>
                      <select 
                        id="species"
                        className={`w-full border rounded-xl p-3.5 focus:ring-2 focus:ring-primary outline-none transition-all select-nice cursor-pointer font-bold text-sm shadow-sm ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
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
                        id="sex"
                        className={`w-full border rounded-xl p-3.5 focus:ring-2 focus:ring-primary outline-none transition-all select-nice cursor-pointer font-bold text-sm shadow-sm ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
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

            <section className={`border rounded-2xl p-7 shadow-sm ${
              theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-teal-500/10 rounded-xl text-teal-500 border border-teal-500/10">
                  <ClipboardList className="size-5" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Event Details</h2>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Event Date <span className="text-rose-500">*</span></label>
                    <input 
                        id="event-date"
                        className={`w-full border rounded-xl p-3.5 focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-sm ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`} 
                        type="date" 
                        value={formData.event_date}
                        onChange={(e) => handleInputChange('event_date', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Health Condition <span className="text-rose-500">*</span></label>
                    <select 
                    id="health-condition"
                    className={`w-full border rounded-xl p-3.5 focus:ring-2 focus:ring-primary outline-none transition-all select-nice cursor-pointer font-bold text-sm shadow-sm ${
                      theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
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
                        id="location"
                        className={`w-full border rounded-xl p-3.5 focus:ring-2 focus:ring-primary outline-none transition-all select-nice cursor-pointer font-bold text-sm shadow-sm ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                    >
                        {beaches.map(beach => (
                          <option key={beach.id} value={beach.name}>{beach.name}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Observer <span className="text-rose-500">*</span></label>
                    <select
                      id="observer"
                      className={`w-full border rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-bold select-nice cursor-pointer shadow-sm ${
                        theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                      value={formData.observer}
                      onChange={(e) => handleInputChange('observer', e.target.value)}
                    >
                      <option value="" disabled>Select Observer</option>
                      {filteredUsers.map((user: any) => (
                        <option key={user.id} value={`${user.first_name} ${user.last_name}`}>
                          {user.first_name} {user.last_name} ({user.role})
                        </option>
                      ))}
                    </select>
                </div>
              </div>
            </section>


            {surveyType === 'NIGHT_SURVEY' && (
                <section className={`border rounded-2xl p-7 shadow-sm ${
                  theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-500 border border-indigo-500/10">
                      <Clock className="size-5" />
                    </div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Night Survey Timings</h2>
                  </div>
                  <div className="space-y-3">
                    {[
                        { label: "First Seen", field: "time_first_seen" },
                        { label: "Start Laying", field: "time_start_egg_laying" },
                        { label: "Start Covering", field: "time_covering" },
                        { label: "Start Camouflage", field: "time_start_camouflage" },
                        { label: "End Camouflage", field: "time_end_camouflage" },
                        { label: "Reached Sea", field: "time_reach_sea" }
                    ].map((item) => (
                        <div key={item.field} className="flex items-center justify-between gap-3 py-1">
                             <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest w-24 leading-tight">{item.label}</label>
                             <div className="flex items-center gap-2 flex-1">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder="00:00"
                                        className={`w-full border rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-primary outline-none transition-all ${
                                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                                        }`}
                                        value={(formData as any)[item.field]}
                                        onChange={(e) => {
                                            const rawValue = e.target.value.replace(/\D/g, '');
                                            let formatted = rawValue;
                                            if (formatted.length > 4) formatted = formatted.slice(0, 4);
                                            if (formatted.length > 2) {
                                                formatted = `${formatted.slice(0, 2)}:${formatted.slice(2)}`;
                                            }
                                            handleInputChange(item.field as keyof TurtleData, formatted);
                                        }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const now = new Date();
                                        const hours = String(now.getHours()).padStart(2, '0');
                                        const minutes = String(now.getMinutes()).padStart(2, '0');
                                        handleInputChange(item.field as keyof TurtleData, `${hours}:${minutes}`);
                                    }}
                                    className={`p-2 rounded-lg transition-colors flex-shrink-0 border ${
                                        theme === 'dark' 
                                        ? 'bg-surface-dark border-border-dark text-indigo-400 hover:bg-indigo-500/20' 
                                        : 'bg-white border-slate-200 text-indigo-600 hover:bg-indigo-50'
                                    }`}
                                    title="Set to current time"
                                >
                                    <RefreshCw className="size-4 font-bold block" />
                                </button>
                             </div>
                        </div>
                    ))}
                  </div>
                </section>
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-8 flex flex-col gap-10">
            <section className={`border rounded-2xl p-7 shadow-sm ${
              theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-teal-500/10 rounded-xl text-teal-500 border border-teal-500/10">
                  <Ruler className="size-5" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Physical Measurements</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] text-teal-500 flex items-center gap-2 border-b pb-2 ${
                    theme === 'dark' ? 'border-border-dark' : 'border-slate-100'
                  }`}>
                    <Ruler className="size-3.5" /> Lengths (cm)
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">SCL Max <span className="text-rose-500">*</span></label>
                        </div>
                        <input 
                            id="scl_max"
                            className={`w-full border rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-primary outline-none ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`} placeholder="0.0" step="0.1" type="number" min="0"
                            value={formData.scl_max} onChange={(e) => handleInputChange('scl_max', e.target.value)} />
                        {selectedTurtle?.measurements?.scl_max && (
                            <div className="text-[8px] font-mono text-slate-400 text-right">Prev: {selectedTurtle.measurements.scl_max}</div>
                        )}
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">SCL Min <span className="text-rose-500">*</span></label>
                        </div>
                        <input 
                            id="scl_min"
                            className={`w-full border rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-primary outline-none ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`} placeholder="e.g. 0.0" step="0.1" type="number" min="0"
                            value={formData.scl_min} onChange={(e) => handleInputChange('scl_min', e.target.value)} />
                        {selectedTurtle?.measurements?.scl_min && (
                            <div className="text-[8px] font-mono text-slate-400 text-right">Prev: {selectedTurtle.measurements.scl_min}</div>
                        )}
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">CCL Max <span className="text-rose-500">*</span></label>
                        </div>
                        <input 
                            id="ccl_max"
                            className={`w-full border rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-primary outline-none ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`} placeholder="e.g. 0.0" step="0.1" type="number" min="0"
                            value={formData.ccl_max} onChange={(e) => handleInputChange('ccl_max', e.target.value)} />
                        {selectedTurtle?.measurements?.ccl_max && (
                            <div className="text-[8px] font-mono text-slate-400 text-right">Prev: {selectedTurtle.measurements.ccl_max}</div>
                        )}
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">CCL Min <span className="text-rose-500">*</span></label>
                        </div>
                        <input 
                            id="ccl_min"
                            className={`w-full border rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-primary outline-none ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`} placeholder="e.g. 0.0" step="0.1" type="number" min="0"
                            value={formData.ccl_min} onChange={(e) => handleInputChange('ccl_min', e.target.value)} />
                        {selectedTurtle?.measurements?.ccl_min && (
                            <div className="text-[8px] font-mono text-slate-400 text-right">Prev: {selectedTurtle.measurements.ccl_min}</div>
                        )}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] text-teal-500 flex items-center gap-2 border-b pb-2 ${
                    theme === 'dark' ? 'border-border-dark' : 'border-slate-100'
                  }`}>
                    <Ruler className="size-3.5 rotate-90" /> Widths (cm)
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">SCW <span className="text-rose-500">*</span></label>
                        </div>
                        <input 
                            id="scw"
                            className={`w-full border rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-primary outline-none ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`} placeholder="e.g. 0.0" step="0.1" type="number" min="0"
                            value={formData.scw} onChange={(e) => handleInputChange('scw', e.target.value)} />
                        {selectedTurtle?.measurements?.scw && (
                            <div className="text-[8px] font-mono text-slate-400 text-right">Prev: {selectedTurtle.measurements.scw}</div>
                        )}
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">CCW <span className="text-rose-500">*</span></label>
                        </div>
                        <input 
                            id="ccw"
                            className={`w-full border rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-primary outline-none ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`} placeholder="e.g. 0.0" step="0.1" type="number" min="0"
                            value={formData.ccw} onChange={(e) => handleInputChange('ccw', e.target.value)} />
                        {selectedTurtle?.measurements?.ccw && (
                            <div className="text-[8px] font-mono text-slate-400 text-right">Prev: {selectedTurtle.measurements.ccw}</div>
                        )}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] text-teal-500 flex items-center gap-2 border-b pb-2 ${
                    theme === 'dark' ? 'border-border-dark' : 'border-slate-100'
                  }`}>
                    <Activity className="size-3.5" /> Tail (cm)
                  </h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Tail Extension <span className="text-rose-500">*</span></label>
                        </div>
                        <input 
                            id="tail_extension"
                            className={`w-full border rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-primary outline-none ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`} placeholder="e.g. 0.0" step="0.1" type="number" min="0"
                            value={formData.tail_extension} onChange={(e) => handleInputChange('tail_extension', e.target.value)} />
                        {selectedTurtle?.measurements?.tail_extension && (
                            <div className="text-[8px] font-mono text-slate-400 text-right">Prev: {selectedTurtle.measurements.tail_extension}</div>
                        )}
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Vent to Tip <span className="text-rose-500">*</span></label>
                        </div>
                        <input 
                            id="vent_to_tail_tip"
                            className={`w-full border rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-primary outline-none ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`} placeholder="e.g. 0.0" step="0.1" type="number" min="0"
                            value={formData.vent_to_tail_tip} onChange={(e) => handleInputChange('vent_to_tail_tip', e.target.value)} />
                        {selectedTurtle?.measurements?.vent_to_tail_tip && (
                            <div className="text-[8px] font-mono text-slate-400 text-right">Prev: {selectedTurtle.measurements.vent_to_tail_tip}</div>
                        )}
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Total Tail Length <span className="text-rose-500">*</span></label>
                        </div>
                        <input 
                            id="total_tail_length"
                            className={`w-full border rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-primary outline-none ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`} placeholder="e.g. 0.0" step="0.1" type="number" min="0"
                            value={formData.total_tail_length} onChange={(e) => handleInputChange('total_tail_length', e.target.value)} />
                        {selectedTurtle?.measurements?.total_tail_length && (
                            <div className="text-[8px] font-mono text-slate-400 text-right">Prev: {selectedTurtle.measurements.total_tail_length}</div>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className={`border rounded-2xl p-7 shadow-sm ${
              theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/10">
                  <Tag className="size-5" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Tagging Identification</h2>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-3 px-1 mb-1">
                    <div className="col-span-2 text-[8px] font-black uppercase tracking-widest text-slate-500 self-end">Loc</div>
                    <div className="col-span-5 text-[8px] font-black uppercase tracking-widest text-slate-500 self-end">Tag ID</div>
                    <div className="col-span-5 text-[8px] font-black uppercase tracking-widest text-slate-500 self-end">Address</div>
                </div>
                {[
                  { label: "FL", prefix: 'front_left' },
                  { label: "FR", prefix: 'front_right' },
                  { label: "RL", prefix: 'rear_left' },
                  { label: "RR", prefix: 'rear_right' }
                ].map((tag, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-2 flex items-center">
                      <span className={`text-[10px] font-black uppercase tracking-widest text-primary`}>{tag.label}</span>
                    </div>
                    <div className="col-span-5">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                                <span className="text-slate-400 font-mono font-bold text-xs">KF-</span>
                            </div>
                            <input 
                                id={`${tag.prefix}_tag`}
                                className={`w-full border rounded-lg text-xs p-2 pl-8 focus:ring-1 focus:ring-primary font-mono font-bold outline-none transition-all ${
                                  theme === 'dark' ? 'bg-background-dark border-border-dark text-white focus:border-primary' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-primary'
                                }`} 
                                placeholder="e.g. 0000" 
                                type="number"
                                value={(formData as any)[`${tag.prefix}_tag`]?.replace(/^KF-/, '') || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    handleInputChange(`${tag.prefix}_tag` as keyof TurtleData, val ? `KF-${val}` : '');
                                }}
                            />
                        </div>
                    </div>
                    <div className="col-span-5">
                        <input 
                             id={`${tag.prefix}_address`}
                             className={`w-full border rounded-lg text-[10px] p-2 focus:ring-1 focus:ring-primary font-bold outline-none transition-all ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white focus:border-primary' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-primary'
                        }`} placeholder="e.g. Address" type="text"
                             value={(formData as any)[`${tag.prefix}_address`]}
                             onChange={(e) => handleInputChange(`${tag.prefix}_address` as keyof TurtleData, e.target.value)}
                        />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={`border rounded-2xl p-7 shadow-sm ${
              theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-teal-500/10 rounded-xl text-teal-500 border border-teal-500/10">
                  <Cpu className="size-5" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Microchip Information</h2>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Microchip Number</label>
                    <input 
                        className={`w-full border rounded-xl p-3.5 focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-sm ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`} 
                        type="text" 
                        placeholder="e.g. 985123456789012"
                        value={formData.microchip_number}
                        onChange={(e) => handleInputChange('microchip_number', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Microchip Location</label>
                    <input 
                        className={`w-full border rounded-xl p-3.5 focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-sm ${
                          theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`} 
                        type="text" 
                        placeholder="e.g. Left flipper"
                        value={formData.microchip_location}
                        onChange={(e) => handleInputChange('microchip_location', e.target.value)}
                    />
                </div>
              </div>
            </section>

            <section className={`border rounded-2xl p-7 shadow-sm ${
              theme === 'dark' ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-teal-500/10 rounded-xl text-teal-500 border border-teal-500/10">
                    <Activity className="size-5" />
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Injury Details</h2>
                </div>
                <label className="inline-flex items-center cursor-pointer group">
                  <span className="mr-4 text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-200 transition-colors">Injury Present?</span>
                  <div className={`relative w-12 h-6.5 rounded-full transition-colors border ${
                    theme === 'dark' ? 'bg-background-dark border-border-dark' : 'bg-slate-200 border-slate-300'
                  }`}>
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
                  <div className={`relative aspect-video border-2 border-dashed rounded-2xl flex items-center justify-center overflow-hidden cursor-crosshair group shadow-inner ${
                    theme === 'dark' ? 'bg-gradient-to-br from-[#1a242f] to-[#151e27] border-[#303d4a]' : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300'
                  }`}>
                    <svg className={`w-3/4 h-3/4 transition-opacity ${theme === 'dark' ? 'opacity-40 group-hover:opacity-60' : 'opacity-20 group-hover:opacity-60'}`} fill="none" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
                      <path className="text-teal-500" d="M100 10C60 10 30 40 30 75C30 90 45 110 100 110C155 110 170 90 170 75C170 40 140 10 100 10Z" stroke="currentColor" strokeWidth="2"></path>
                      <circle className="text-teal-500" cx="100" cy="115" r="10" stroke="currentColor" strokeWidth="2"></circle>
                      <circle className="text-teal-500" cx="100" cy="5" r="12" stroke="currentColor" strokeWidth="2"></circle>
                      <path className="text-teal-500" d="M40 30 L10 20" stroke="currentColor" strokeWidth="2"></path>
                      <path className="text-teal-500" d="M160 30 L190 20" stroke="currentColor" strokeWidth="2"></path>
                      <path className="text-teal-500" d="M40 100 L15 110" stroke="currentColor" strokeWidth="2"></path>
                      <path className="text-teal-500" d="M160 100 L185 110" stroke="currentColor" strokeWidth="2"></path>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className={`text-[10px] text-slate-500 font-black uppercase tracking-widest px-4 py-2 rounded-xl border backdrop-blur-sm ${
                        theme === 'dark' ? 'bg-background-dark/80 border-border-dark' : 'bg-white/80 border-slate-200'
                      }`}>Click diagram to mark injury</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">General Notes & Qualitative Observations</label>
                  <textarea 
                    className={`w-full border rounded-2xl p-5 focus:ring-2 focus:ring-primary outline-none transition-all resize-none shadow-inner text-sm font-medium placeholder:opacity-30 ${
                      theme === 'dark' ? 'bg-background-dark border-border-dark text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`} 
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

      <footer className={`fixed bottom-0 left-0 right-0 lg:left-64 backdrop-blur-xl border-t z-50 shadow-[0_-15px_30px_rgba(0,0,0,0.15)] ${
        theme === 'dark' ? 'bg-[#111418]/95 border-slate-800' : 'bg-white/95 border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3">
          {/* Error Message - Top on Mobile, Middle on Desktop */}
          {errorMessage && (
            <div className="order-1 lg:order-2 w-full">
              <button 
                onClick={() => {
                  if (errorTargetId) {
                    const element = document.getElementById(errorTargetId);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      element.focus();
                    } else {
                       window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="w-full bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 rounded-xl flex items-center gap-3 hover:bg-rose-500/20 active:scale-[0.99] transition-all group border-dashed"
              >
                <AlertCircle className="text-rose-500 size-5 shrink-0 group-hover:animate-bounce" />
                <div className="flex flex-col text-left flex-1">
                  <span className="text-[7px] font-black uppercase tracking-[0.1em] text-rose-400 opacity-80 leading-tight">Action Required</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 leading-tight whitespace-normal break-words">
                    {errorMessage}
                  </span>
                </div>
                <Send className="text-rose-500 size-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="order-2 lg:order-1 flex items-center justify-between w-full gap-3">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="px-4 py-3 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all text-[10px] flex items-center justify-center gap-2 min-w-[140px] ${
                  !isSaving 
                    ? 'bg-primary text-white shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]' 
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                }`}
              >
                {isSaving ? (
                  <>
                     <span className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                     <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    <span>Save Record</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowCancelConfirm(false)}></div>
          <div className="relative bg-white dark:bg-[#111c26] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Discard Progress?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">Unsaved data for the tagging record will be lost.</p>
            <div className="flex flex-col w-full gap-3">
              <button onClick={onBack} className="w-full py-3.5 bg-rose-500 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-500/20 active:scale-95 transition-all">Discard Entry</button>
              <button onClick={() => setShowCancelConfirm(false)} className="w-full py-3.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-xl font-black uppercase tracking-widest text-xs border border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-95 transition-all">Continue Recording</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaggingEntry;
