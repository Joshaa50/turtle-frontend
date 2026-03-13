import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppView, SurveyData, NestRecord } from '../types';
import { DatabaseConnection, NestEventData, Beach, MorningSurveyData } from '../services/Database';

interface MorningSurveyProps {
    theme?: 'light' | 'dark';
    onNavigate: (view: AppView) => void;
    newNest?: any;
    onClearNest?: () => void;
    surveys: Record<string, SurveyData>;
    onUpdateSurveys: (updateFn: (prev: Record<string, SurveyData>) => Record<string, SurveyData>) => void;
    beaches: Beach[];
    currentBeach: string;
    setCurrentBeach: (beach: string) => void;
    currentRegion: string;
    setCurrentRegion: (region: string) => void;
}

const defaultSurveyData: SurveyData = {
    firstTime: '',
    lastTime: '',
    region: '',
    tlGpsLat: '',
    tlGpsLng: '',
    trGpsLat: '',
    trGpsLng: '',
    nestTally: 0,
    nests: [],
    tracks: [],
    notes: ''
};

const LAT_REGEX = /^-?\d{1,3}(\.\d+)?$/;
const LNG_REGEX = /^-?\d{1,3}(\.\d+)?$/;

const isLatValid = (val: string) => {
  if (!val) return true;
  const num = parseFloat(val);
  return !isNaN(num) && num >= -90 && num <= 90 && LAT_REGEX.test(val);
};

const isLngValid = (val: string) => {
  if (!val) return true;
  const num = parseFloat(val);
  return !isNaN(num) && num >= -180 && num <= 180 && LNG_REGEX.test(val);
};

const MorningSurvey: React.FC<MorningSurveyProps> = ({ 
    theme = 'light', 
    onNavigate, 
    newNest, 
    onClearNest, 
    surveys, 
    onUpdateSurveys, 
    beaches,
    currentBeach,
    setCurrentBeach,
    currentRegion,
    setCurrentRegion
}) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const lastProcessedId = useRef<string | number | null>(null);

    const [isHatchlingModalOpen, setIsHatchlingModalOpen] = useState(false);
    const [hatchlingData, setHatchlingData] = useState({ nestCode: '', toSea: '', lost: '' });
    const [availableNests, setAvailableNests] = useState<NestRecord[]>([]);

    useEffect(() => {
        if (beaches.length > 0 && !currentRegion) {
            const firstRegion = beaches[0].survey_area;
            setCurrentRegion(firstRegion);
            
            const regionBeaches = beaches
                .filter(b => b.survey_area === firstRegion)
                .sort((a, b) => {
                    if (a.name === 'Loggos 2') return -1;
                    if (b.name === 'Loggos 2') return 1;
                    return a.id - b.id;
                });
                
            if (regionBeaches.length > 0) {
                setCurrentBeach(regionBeaches[0].name);
            }
        }
    }, [beaches, currentRegion, setCurrentRegion, setCurrentBeach]);

    useEffect(() => {
        if (!currentBeach) return;
        const fetchNests = async () => {
            try {
                const nests = await DatabaseConnection.getNests();
                const mappedNests: NestRecord[] = nests.map((n: any) => ({
                    id: n.nest_code,
                    dbId: n.id,
                    location: n.beach,
                    date: n.date_laid,
                    species: n.species || 'Loggerhead',
                    status: n.status ? n.status.toUpperCase() : 'INCUBATING',
                }));
                const filtered = mappedNests.filter((n: any) => n.location === currentBeach && n.status !== 'HATCHED');
                setAvailableNests(filtered);
            } catch (err) {
                console.error("Failed to fetch nests:", err);
            }
        };
        fetchNests();
    }, [currentBeach]);

    useEffect(() => {
        if (newNest && onClearNest && newNest.entryId !== lastProcessedId.current) {
            lastProcessedId.current = newNest.entryId;
            onUpdateSurveys(prev => {
                const beachData = prev[currentBeach] || defaultSurveyData;
                return {
                    ...prev,
                    [currentBeach]: {
                        ...beachData,
                        nests: [...beachData.nests, {
                            nestCode: newNest.isEmergence ? '' : newNest.nest_code,
                            newNestDetails: newNest.isEmergence 
                                ? `Emergence (S: ${newNest.distance_to_sea_s}m)` 
                                : `New nest: ${newNest.nest_code} (S: ${newNest.distance_to_sea_s}m)`,
                            isEmergence: newNest.isEmergence,
                            entryId: newNest.entryId,
                            payload: newNest.payload
                        }]
                    }
                };
            });
            onClearNest();
        }
    }, [newNest, onClearNest, currentBeach, onUpdateSurveys]);

    useEffect(() => {
        if (!surveys[currentBeach]) {
            onUpdateSurveys(prev => {
                if (prev[currentBeach]) return prev;
                return {
                    ...prev,
                    [currentBeach]: { ...defaultSurveyData }
                };
            });
        }
    }, [currentBeach, surveys, onUpdateSurveys]);

    const currentSurvey = surveys[currentBeach] || defaultSurveyData;

    const allRegions = useMemo(() => {
        const regions = Array.from(new Set(beaches.map(b => b.survey_area))).filter(Boolean);
        return regions.length > 0 ? regions : ['Default Area'];
    }, [beaches]);

    const filteredBeaches = useMemo(() => {
        return beaches
            .filter(b => b.survey_area === currentRegion)
            .sort((a, b) => {
                if (a.name === 'Loggos 2') return -1;
                if (b.name === 'Loggos 2') return 1;
                return a.id - b.id;
            });
    }, [beaches, currentRegion]);

    const selectedBeach = useMemo(() => beaches.find(b => b.name === currentBeach), [beaches, currentBeach]);

    const handleInputChange = (field: keyof SurveyData, value: any) => {
        onUpdateSurveys(prev => ({
            ...prev,
            [currentBeach]: {
                ...prev[currentBeach],
                [field]: value
            }
        }));
    };

    const [isSaving, setIsSaving] = useState(false);
    const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
    const [errorInfo, setErrorInfo] = useState<{ message: string; targetId: string } | null>(null);

    const scrollToField = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.focus();
        }
    };

    const handleSaveSurvey = async () => {
        setHasAttemptedSave(true);
        setErrorInfo(null);
        // Validation logic
        const isTimesValid = currentSurvey.firstTime !== '' && currentSurvey.lastTime !== '';
        const isBoundaryValid = 
            currentSurvey.tlGpsLat !== '' && isLatValid(currentSurvey.tlGpsLat) &&
            currentSurvey.tlGpsLng !== '' && isLngValid(currentSurvey.tlGpsLng) &&
            currentSurvey.trGpsLat !== '' && isLatValid(currentSurvey.trGpsLat) &&
            currentSurvey.trGpsLng !== '' && isLngValid(currentSurvey.trGpsLng);
        const isTallyValid = currentSurvey.nestTally === availableNests.length;

        if (!isTimesValid) {
            setErrorInfo({ message: "Please fill in all survey times.", targetId: currentSurvey.firstTime === '' ? 'firstTime' : 'lastTime' });
            return;
        }
        if (!isBoundaryValid) {
            const targetId = (currentSurvey.tlGpsLat === '' || !isLatValid(currentSurvey.tlGpsLat)) ? 'tlGpsLat' :
                             (currentSurvey.tlGpsLng === '' || !isLngValid(currentSurvey.tlGpsLng)) ? 'tlGpsLng' :
                             (currentSurvey.trGpsLat === '' || !isLatValid(currentSurvey.trGpsLat)) ? 'trGpsLat' : 'trGpsLng';
            setErrorInfo({ message: "Please fill in all beach boundary coordinates correctly.", targetId });
            return;
        }
        if (!isTallyValid) {
            setErrorInfo({ message: `Nest count (${currentSurvey.nestTally}) must match the number of active nests on this beach (${availableNests.length}).`, targetId: 'nestTally' });
            return;
        }

        if (currentSurvey.tracks.length === 0 && currentSurvey.nests.length === 0 && !currentSurvey.notes) {
            // We still allow saving if validation passes even if no tracks/nests were added, 
            // as the user might just be confirming the tally and boundaries.
            // But let's keep the original check if it was intended to prevent "empty" surveys.
            // Actually, if they filled times and boundaries and tally matches, it's a valid survey.
        }

        setIsSaving(true);
        try {
            // 1. Save Track Data as Nest Events
            const trackPromises = currentSurvey.tracks.map(async (track) => {
                const payload: NestEventData = {
                    event_type: 'EMERGENCE',
                    nest_code: track.nestCode,
                    start_time: `${date} 08:00:00`, // Morning survey time
                    tracks_to_sea: parseInt(track.tracksToSea) || 0,
                    tracks_lost: parseInt(track.tracksLost) || 0,
                    notes: `Logged via Morning Survey for ${currentBeach} (Region: ${currentSurvey.region}). ${currentSurvey.notes ? `Survey Notes: ${currentSurvey.notes}` : ''}`
                };
                const response = await DatabaseConnection.createNestEvent(payload);
                return { track, response };
            });

            const createdTracks = await Promise.all(trackPromises);

            // 2. Update Nest Status for nests with tracks
            const nestIdMap: Record<string, number> = {};
            const uniqueNestCodes = [...new Set(currentSurvey.tracks.map(t => t.nestCode))] as string[];
            const statusPromises = uniqueNestCodes.map(async (code) => {
                try {
                    const nestResponse = await DatabaseConnection.getNest(code);
                    if (nestResponse && nestResponse.nest) {
                        const fullNest = nestResponse.nest;
                        nestIdMap[code] = fullNest.id;
                        if (fullNest.status === 'incubating' || fullNest.status === 'INCUBATING') {
                            return DatabaseConnection.updateNest(fullNest.id, {
                                ...fullNest,
                                status: 'hatching'
                            });
                        }
                    }
                } catch (err) {
                    console.error(`Failed to update status for nest ${code}:`, err);
                }
            });

            await Promise.all(statusPromises);

            // 3. Save Morning Survey Record(s) and Nests
            const beach = beaches.find(b => b.name === currentBeach);
            if (beach) {
                const baseSurveyPayload: MorningSurveyData = {
                    survey_date: date,
                    start_time: currentSurvey.firstTime,
                    end_time: currentSurvey.lastTime,
                    beach_id: beach.id,
                    tl_lat: currentSurvey.tlGpsLat,
                    tl_long: currentSurvey.tlGpsLng,
                    tr_lat: currentSurvey.trGpsLat,
                    tr_long: currentSurvey.trGpsLng,
                    protected_nest_count: currentSurvey.nestTally,
                    notes: currentSurvey.notes
                };

                const hasNests = currentSurvey.nests && currentSurvey.nests.length > 0;
                const hasTracks = createdTracks && createdTracks.length > 0;

                if (hasNests || hasTracks) {
                    // Create a morning survey record for each nest/emergence
                    if (hasNests) {
                        for (const nest of currentSurvey.nests) {
                            let nestId: number | undefined;
                            let eventId: number | undefined;

                            if (nest.payload) {
                                if (nest.isEmergence) {
                                    const response = await DatabaseConnection.createEmergence(nest.payload);
                                    eventId = response.emergence?.id || response.event?.id || response.id;
                                } else {
                                    const response = await DatabaseConnection.createNest(nest.payload);
                                    nestId = response.nest?.id || response.id;
                                }
                            }

                            await DatabaseConnection.createMorningSurvey({
                                ...baseSurveyPayload,
                                nest_id: nestId,
                                event_id: eventId
                            });
                        }
                    }

                    if (hasTracks) {
                        for (const { track, response } of createdTracks) {
                            let eventId: number | undefined;
                            eventId = response.event?.id || response.id;
                            let nestId: number | undefined = nestIdMap[track.nestCode];

                            await DatabaseConnection.createMorningSurvey({
                                ...baseSurveyPayload,
                                nest_id: nestId,
                                event_id: eventId
                            });
                        }
                    }
                } else {
                    // No nests or tracks, just create one survey record
                    await DatabaseConnection.createMorningSurvey(baseSurveyPayload);
                }
            }

            // Clear current survey data after successful save
            onUpdateSurveys(prev => ({
                ...prev,
                [currentBeach]: { ...defaultSurveyData }
            }));
            
            onNavigate(AppView.DASHBOARD);
        } catch (err: any) {
            console.error("Failed to save survey:", err);
            setErrorInfo({ message: "Error saving survey: " + (err.message || "Unknown error"), targetId: '' });
        } finally {
            setIsSaving(false);
        }
    };

    const grabCurrentTime = (field: 'firstTime' | 'lastTime') => {
        const now = new Date().toTimeString().slice(0, 5);
        handleInputChange(field, now);
    };

    const addNest = () => {
        onNavigate(AppView.NEST_ENTRY);
    };

    const removeNest = (index: number) => {
        handleInputChange('nests', currentSurvey.nests.filter((_, i) => i !== index));
    };

    const addTrack = () => {
        setHatchlingData({ nestCode: '', toSea: '', lost: '' });
        setIsHatchlingModalOpen(true);
    };

    const handleHatchlingSubmit = () => {
        if (!hatchlingData.nestCode || !hatchlingData.toSea) return;
        
        handleInputChange('tracks', [
            ...(currentSurvey.tracks || []), 
            { 
                nestCode: hatchlingData.nestCode, 
                tracksToSea: hatchlingData.toSea, 
                tracksLost: hatchlingData.lost || '0' 
            }
        ]);
        setIsHatchlingModalOpen(false);
    };

    const removeTrack = (index: number) => {
        handleInputChange('tracks', currentSurvey.tracks.filter((_, i) => i !== index));
    };

    const inputClass = `w-full border rounded-xl p-3.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-sm ${
        theme === 'dark' ? 'bg-slate-900/50 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
    }`;

    const labelClass = "block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5";
    const buttonClass = "bg-primary text-white font-black uppercase tracking-widest px-4 py-2 rounded-lg hover:bg-primary/90 transition-all text-[10px] shadow-sm shadow-primary/20";

    const renderGpsInput = (label: string, latField: 'tlGpsLat' | 'trGpsLat', lngField: 'tlGpsLng' | 'trGpsLng') => (
        <div className="relative group">
            <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-lg">location_on</span>
                <label className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {label}
                </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider ml-1">Latitude</span>
                    <input 
                        id={latField}
                        className={`w-full border rounded-xl h-11 px-3 outline-none transition-all font-mono text-[10px] ${
                            (hasAttemptedSave && currentSurvey[latField] === '') || (currentSurvey[latField] !== '' && !isLatValid(currentSurvey[latField]))
                            ? 'border-rose-500 ring-2 ring-rose-500/20' 
                            : (theme === 'dark' ? 'border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/10' : 'border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10')
                        } ${theme === 'dark' ? 'bg-slate-900/50 text-white' : 'bg-white text-slate-900'}`} 
                        placeholder="37.44670" 
                        value={currentSurvey[latField]}
                        onChange={(e) => handleInputChange(latField, e.target.value)}
                    />
                </div>
                <div className="space-y-1.5">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider ml-1">Longitude</span>
                    <input 
                        id={lngField}
                        className={`w-full border rounded-xl h-11 px-3 outline-none transition-all font-mono text-[10px] ${
                            (hasAttemptedSave && currentSurvey[lngField] === '') || (currentSurvey[lngField] !== '' && !isLngValid(currentSurvey[lngField]))
                            ? 'border-rose-500 ring-2 ring-rose-500/20' 
                            : (theme === 'dark' ? 'border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/10' : 'border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10')
                        } ${theme === 'dark' ? 'bg-slate-900/50 text-white' : 'bg-white text-slate-900'}`} 
                        placeholder="21.61630" 
                        value={currentSurvey[lngField]}
                        onChange={(e) => handleInputChange(lngField, e.target.value)}
                    />
                </div>
            </div>
        </div>
    );

    return (
        <div className={`min-h-screen pb-20 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-slate-50 text-slate-900'}`}>
            {/* Header Section */}
            <div className="bg-primary pt-12 pb-20 px-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-24 -mb-24 blur-2xl"></div>
                
                <div className="max-w-4xl mx-auto relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                            <span className="material-symbols-outlined text-white text-2xl">wb_sunny</span>
                        </div>
                        <span className="text-white/70 text-xs font-black uppercase tracking-[0.2em]">Conservation Portal</span>
                    </div>
                    <h1 className="text-4xl font-black text-white uppercase tracking-tight">Morning Survey</h1>
                    <p className="text-white/60 text-sm mt-2 font-medium">Daily beach monitoring and turtle activity logging</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 -mt-10 space-y-6">
                {/* Survey Information Card */}
                <section className={`border rounded-3xl p-8 shadow-xl shadow-black/5 backdrop-blur-sm ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-8">
                        <span className="material-symbols-outlined text-primary">info</span>
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Survey Information</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className={labelClass}>Survey Area</label>
                            <select 
                                value={currentRegion} 
                                onChange={(e) => {
                                    const newRegion = e.target.value;
                                    setCurrentRegion(newRegion);
                                    
                                    const regionBeaches = beaches
                                        .filter(b => b.survey_area === newRegion)
                                        .sort((a, b) => {
                                            if (a.name === 'Loggos 2') return -1;
                                            if (b.name === 'Loggos 2') return 1;
                                            return a.id - b.id;
                                        });
                                        
                                    if (regionBeaches.length > 0) {
                                        setCurrentBeach(regionBeaches[0].name);
                                    }
                                }} 
                                className={`${inputClass} appearance-none bg-[url('https://api.iconify.design/material-symbols/expand-more.svg?color=%2394a3b8')] bg-[length:1.5rem_1.5rem] bg-[right_0.75rem_center] bg-no-repeat`}
                            >
                                {allRegions.map(region => (
                                    <option key={region} value={region}>{region}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>Beach Name</label>
                            <select value={currentBeach} onChange={(e) => setCurrentBeach(e.target.value)} className={`${inputClass} appearance-none bg-[url('https://api.iconify.design/material-symbols/expand-more.svg?color=%2394a3b8')] bg-[length:1.5rem_1.5rem] bg-[right_0.75rem_center] bg-no-repeat`}>
                                {filteredBeaches.length > 0 ? (
                                    filteredBeaches.map(beach => <option key={beach.id} value={beach.name}>{beach.name}</option>)
                                ) : (
                                    <option value="">No beaches in this area</option>
                                )}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>Date</label>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                        </div>
                    </div>
                </section>

                {/* Survey Times, Beach Boundaries & Nest Count Card */}
                <section className={`border rounded-3xl p-8 shadow-xl shadow-black/5 backdrop-blur-sm ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-8">
                        <span className="material-symbols-outlined text-primary">schedule</span>
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Survey Times, Boundaries & Nest Count</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        <div className="space-y-2">
                            <label className={labelClass}>First time on beach</label>
                            <div className="relative">
                                <input 
                                    id="firstTime"
                                    type="text" 
                                    placeholder="00:00"
                                    value={currentSurvey.firstTime} 
                                    onChange={(e) => {
                                        const rawValue = e.target.value.replace(/\D/g, '');
                                        let formatted = rawValue;
                                        if (formatted.length > 4) formatted = formatted.slice(0, 4);
                                        if (formatted.length > 2) {
                                            formatted = `${formatted.slice(0, 2)}:${formatted.slice(2)}`;
                                        }
                                        handleInputChange('firstTime', formatted);
                                    }} 
                                    className={`${inputClass} pr-12 ${
                                        hasAttemptedSave && currentSurvey.firstTime === '' ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
                                    }`} 
                                />
                                <button 
                                    type="button" 
                                    onClick={() => grabCurrentTime('firstTime')} 
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                                    title="Set to current time"
                                >
                                    <span className="material-symbols-outlined text-[18px] font-bold">update</span>
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>Last time on beach</label>
                            <div className="relative">
                                <input 
                                    id="lastTime"
                                    type="text" 
                                    placeholder="00:00"
                                    value={currentSurvey.lastTime} 
                                    onChange={(e) => {
                                        const rawValue = e.target.value.replace(/\D/g, '');
                                        let formatted = rawValue;
                                        if (formatted.length > 4) formatted = formatted.slice(0, 4);
                                        if (formatted.length > 2) {
                                            formatted = `${formatted.slice(0, 2)}:${formatted.slice(2)}`;
                                        }
                                        handleInputChange('lastTime', formatted);
                                    }} 
                                    className={`${inputClass} pr-12 ${
                                        hasAttemptedSave && currentSurvey.lastTime === '' ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
                                    }`} 
                                />
                                <button 
                                    type="button" 
                                    onClick={() => grabCurrentTime('lastTime')} 
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                                    title="Set to current time"
                                >
                                    <span className="material-symbols-outlined text-[18px] font-bold">update</span>
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>Total Nest Count</label>
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => handleInputChange('nestTally', Math.max(0, currentSurvey.nestTally - 1))}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                                >
                                    <span className="material-symbols-outlined text-sm font-black">remove</span>
                                </button>
                                <input 
                                    id="nestTally"
                                    type="number" 
                                    value={currentSurvey.nestTally} 
                                    onChange={(e) => handleInputChange('nestTally', parseInt(e.target.value) || 0)}
                                    className={`${inputClass} text-center font-black text-xl ${
                                        currentSurvey.nestTally !== availableNests.length ? 'text-rose-500' : ''
                                    }`}
                                />
                                {currentSurvey.nestTally !== availableNests.length && (
                                    <span className="text-[8px] font-black text-rose-500 uppercase tracking-tighter mt-1">
                                        Expected: {availableNests.length}
                                    </span>
                                )}
                                <button 
                                    type="button" 
                                    onClick={() => handleInputChange('nestTally', currentSurvey.nestTally + 1)}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/90 transition-all"
                                >
                                    <span className="material-symbols-outlined text-sm font-black">add</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {renderGpsInput('GPS TL (Left Edge)', 'tlGpsLat', 'tlGpsLng')}
                        {renderGpsInput('GPS TR (Right Edge)', 'trGpsLat', 'trGpsLng')}
                    </div>
                </section>

                {/* Nest Data Card */}
                <section className={`border rounded-3xl p-8 shadow-xl shadow-black/5 backdrop-blur-sm ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-white border-slate-200'}`}>
                    <div className="mb-10">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-primary">assignment</span>
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Nest Monitoring</h2>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-7">Log new activities</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Tally Column */}
                        <div className="lg:col-span-4 space-y-4">
                            <button type="button" onClick={addNest} className="w-full flex items-center justify-center gap-2 bg-primary text-white font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-primary/90 transition-all text-[11px] shadow-lg shadow-primary/20">
                                <span className="material-symbols-outlined text-lg">add_circle</span>
                                Add Nest / Emergence
                            </button>
                        </div>

                        {/* Detailed Records Column */}
                        <div className="lg:col-span-8 space-y-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Detailed Records</span>
                            {currentSurvey.nests?.map((nest, index) => (
                                <div key={index} className={`group p-4 border rounded-2xl flex items-center justify-between transition-all hover:shadow-md ${
                                    theme === 'dark' ? 'bg-slate-900/40 border-white/5 hover:bg-slate-900/60' : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:border-slate-200'
                                }`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                                            nest.isEmergence ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                                        }`}>
                                            <span className="material-symbols-outlined text-2xl">
                                                {nest.isEmergence ? 'waves' : 'egg'}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                                                    nest.isEmergence ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                                                }`}>
                                                    {nest.isEmergence ? 'Emergence' : 'New Nest'}
                                                </span>
                                                {nest.nestCode && (
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">#{nest.nestCode}</span>
                                                )}
                                            </div>
                                            <p className="font-bold text-sm mt-0.5">{nest.newNestDetails}</p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => removeNest(index)} 
                                        className="opacity-0 group-hover:opacity-100 transition-all text-rose-500 hover:bg-rose-500/10 p-2 rounded-xl"
                                        title="Remove record"
                                    >
                                        <span className="material-symbols-outlined text-lg">delete</span>
                                    </button>
                                </div>
                            ))}
                            {currentSurvey.nests?.length === 0 && (
                                <div className="h-[140px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl text-slate-400 bg-slate-50/30 dark:bg-transparent">
                                    <span className="material-symbols-outlined text-4xl opacity-10 mb-2">nest_eco</span>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-30">No detailed records added</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Track Data Card */}
                <section className={`border rounded-3xl p-8 shadow-xl shadow-black/5 backdrop-blur-sm ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-white border-slate-200'}`}>
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-primary">footprint</span>
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Hatchling Track Data</h2>
                        </div>
                        <button type="button" onClick={addTrack} className="w-full flex items-center justify-center gap-2 bg-primary text-white font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-primary/90 transition-all text-[11px] shadow-lg shadow-primary/20">
                            <span className="material-symbols-outlined text-lg">add_circle</span>
                            Add Hatchling Track
                        </button>
                    </div>

                    <div className="space-y-3">
                        {currentSurvey.tracks?.map((track, index) => (
                            <div key={index} className={`group p-4 border rounded-2xl flex items-center justify-between transition-all hover:shadow-md ${
                                theme === 'dark' ? 'bg-slate-900/40 border-white/5 hover:bg-slate-900/60' : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:border-slate-200'
                            }`}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                        <span className="material-symbols-outlined">pets</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Nest {track.nestCode}</span>
                                        <p className="font-bold text-sm">
                                            {track.tracksToSea} to sea <span className="text-slate-300 mx-1">•</span> {track.tracksLost} lost
                                        </p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => removeTrack(index)} className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 text-[10px] font-black uppercase hover:underline p-2">Remove</button>
                            </div>
                        ))}
                        {currentSurvey.tracks?.length === 0 && (
                            <div className="py-10 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl text-slate-400">
                                <span className="material-symbols-outlined text-4xl opacity-20 mb-2">footprint</span>
                                <p className="text-xs font-bold uppercase tracking-widest opacity-50">No tracks recorded yet</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* General Notes Card */}
                <section className={`border rounded-3xl p-8 shadow-xl shadow-black/5 backdrop-blur-sm ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-6">
                        <span className="material-symbols-outlined text-primary">description</span>
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">General Notes</h2>
                    </div>
                    <textarea 
                        value={currentSurvey.notes} 
                        onChange={(e) => handleInputChange('notes', e.target.value)} 
                        className={`${inputClass} resize-none min-h-[120px]`} 
                        placeholder="Enter any additional observations, weather conditions, or beach status..." 
                    />
                </section>

                {errorInfo && (
                    <button 
                        onClick={() => errorInfo.targetId ? scrollToField(errorInfo.targetId) : null}
                        className="w-full mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 hover:bg-rose-500/20 active:scale-[0.99] transition-all group border-dashed text-left"
                    >
                        <span className="material-symbols-outlined text-rose-500 text-lg shrink-0 group-hover:animate-bounce">priority_high</span>
                        <div className="flex flex-col overflow-hidden flex-1">
                            <span className="text-[7px] font-black uppercase tracking-[0.1em] text-rose-400 opacity-80 leading-tight">Action Required</span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 leading-tight truncate">
                                {errorInfo.message}
                            </span>
                        </div>
                        {errorInfo.targetId && (
                            <span className="material-symbols-outlined text-rose-500 text-sm shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">near_me</span>
                        )}
                    </button>
                )}

                <button 
                    onClick={handleSaveSurvey}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-white font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-primary/90 transition-all text-[11px] shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? (
                        <>
                            <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            Saving...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-lg">save</span>
                            Complete Morning Survey
                        </>
                    )}
                </button>
            </div>

            {/* Hatchling Data Modal */}
            {isHatchlingModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsHatchlingModalOpen(false)}></div>
                    <div className={`relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 ${
                        theme === 'dark' ? 'bg-[#1a232e] border border-white/10' : 'bg-white'
                    }`}>
                        <header className="p-6 border-b border-white/5 flex items-center justify-between bg-primary text-white">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined">egg</span>
                                <h3 className="font-black uppercase tracking-tight">Log Hatchling Tracks</h3>
                            </div>
                            <button onClick={() => setIsHatchlingModalOpen(false)} className="hover:bg-white/20 rounded-full p-1 transition-colors">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </header>
                        
                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label className={labelClass}>Select Nest Code</label>
                                <select 
                                    value={hatchlingData.nestCode}
                                    onChange={e => setHatchlingData({...hatchlingData, nestCode: e.target.value})}
                                    className={inputClass}
                                >
                                    <option value="">-- Select a Nest --</option>
                                    {availableNests.map(nest => (
                                        <option key={nest.id} value={nest.id}>{nest.id} ({nest.location})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>Tracks to Sea</label>
                                    <input 
                                        type="number" 
                                        value={hatchlingData.toSea}
                                        onChange={e => setHatchlingData({...hatchlingData, toSea: e.target.value})}
                                        placeholder="0"
                                        className={inputClass}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>Tracks Lost</label>
                                    <input 
                                        type="number" 
                                        value={hatchlingData.lost}
                                        onChange={e => setHatchlingData({...hatchlingData, lost: e.target.value})}
                                        placeholder="0"
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </div>

                        <footer className={`p-4 border-t flex justify-end gap-3 ${
                            theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'
                        }`}>
                            <button 
                                onClick={() => setIsHatchlingModalOpen(false)}
                                className={`px-4 py-2 text-xs font-black uppercase transition-colors ${
                                    theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleHatchlingSubmit}
                                disabled={!hatchlingData.nestCode || !hatchlingData.toSea}
                                className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-black uppercase shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Add Track
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MorningSurvey;
