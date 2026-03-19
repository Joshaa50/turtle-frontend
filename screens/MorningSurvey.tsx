import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Sun, 
  Info, 
  Clock, 
  RefreshCw, 
  Minus, 
  Plus, 
  MapPin, 
  ClipboardList, 
  PlusCircle, 
  Waves, 
  Egg, 
  Trash2, 
  Home, 
  Footprints, 
  PawPrint, 
  FileText, 
  AlertCircle, 
  Send, 
  Save, 
  X,
  ChevronDown,
  CheckCircle2
} from 'lucide-react';
import { AppView, SurveyData, NestRecord } from '../types';
import { DatabaseConnection, NestEventData, Beach, MorningSurveyData } from '../services/Database';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { PageTitle, SectionHeading, Label, BodyText, HelperText } from '../components/ui/Typography';
import { Modal } from '../components/ui/Modal';
import { Textarea } from '../components/ui/Textarea';
import { formatTimeInput } from '../lib/utils';

interface MorningSurveyProps {
    theme?: 'light' | 'dark';
    onNavigate: (view: AppView, date?: string) => void;
    newNest?: any;
    onClearNest?: () => void;
    surveys: Record<string, SurveyData>;
    onUpdateSurveys: (updateFn: (prev: Record<string, SurveyData>) => Record<string, SurveyData>) => void;
    beaches: Beach[];
    currentBeach: string;
    setCurrentBeach: (beach: string) => void;
    currentRegion: string;
    setCurrentRegion: (region: string) => void;
    initialDate: string;
    onDateChange: (date: string) => void;
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
    setCurrentRegion,
    initialDate,
    onDateChange
}) => {
    const date = initialDate;
    const setDate = onDateChange;
    const lastProcessedId = useRef<string | number | null>(null);

    const [isHatchlingModalOpen, setIsHatchlingModalOpen] = useState(false);
    const [confirmTime, setConfirmTime] = useState<{ field: 'firstTime' | 'lastTime', value: string } | null>(null);
    const [hatchlingData, setHatchlingData] = useState({ nestCode: '', toSea: '', lost: '' });
    const [allNests, setAllNests] = useState<NestRecord[]>([]);

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
                const filtered = mappedNests.filter((n: any) => n.status !== 'HATCHED');
                setAllNests(filtered);
            } catch (err) {
                console.error("Failed to fetch nests:", err);
            }
        };
        fetchNests();
    }, []);

    const availableNests = useMemo(() => {
        return allNests.filter(n => n.location === currentBeach);
    }, [allNests, currentBeach]);

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

    const isBeachValid = (beachName: string) => {
        const survey = surveys[beachName];
        if (!survey) return false;
        
        const isTimesValid = survey.firstTime !== '' && survey.lastTime !== '';
        let isEndTimeAfterStartTime = true;
        if (isTimesValid) {
            const [firstH, firstM] = survey.firstTime.split(':').map(Number);
            const [lastH, lastM] = survey.lastTime.split(':').map(Number);
            if (lastH < firstH || (lastH === firstH && lastM <= firstM)) {
                isEndTimeAfterStartTime = false;
            }
        }

        const isBoundaryValid = 
            survey.tlGpsLat !== '' && isLatValid(survey.tlGpsLat) &&
            survey.tlGpsLng !== '' && isLngValid(survey.tlGpsLng) &&
            survey.trGpsLat !== '' && isLatValid(survey.trGpsLat) &&
            survey.trGpsLng !== '' && isLngValid(survey.trGpsLng);
        
        const beachNests = allNests.filter(n => n.location === beachName);
        const isTallyValid = survey.nestTally === beachNests.length;

        return isTimesValid && isEndTimeAfterStartTime && isBoundaryValid && isTallyValid;
    };

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
        
        // 1. Validation logic for all beaches in the current region
        for (const beach of filteredBeaches) {
            const survey = surveys[beach.name] || defaultSurveyData;
            const isTimesValid = survey.firstTime !== '' && survey.lastTime !== '';
            
            let isEndTimeAfterStartTime = true;
            if (isTimesValid) {
                const [firstH, firstM] = survey.firstTime.split(':').map(Number);
                const [lastH, lastM] = survey.lastTime.split(':').map(Number);
                if (lastH < firstH || (lastH === firstH && lastM <= firstM)) {
                    isEndTimeAfterStartTime = false;
                }
            }

            const isBoundaryValid = 
                survey.tlGpsLat !== '' && isLatValid(survey.tlGpsLat) &&
                survey.tlGpsLng !== '' && isLngValid(survey.tlGpsLng) &&
                survey.trGpsLat !== '' && isLatValid(survey.trGpsLat) &&
                survey.trGpsLng !== '' && isLngValid(survey.trGpsLng);
            
            const beachNests = allNests.filter(n => n.location === beach.name);
            const isTallyValid = survey.nestTally === beachNests.length;

            if (!isTimesValid) {
                setCurrentBeach(beach.name);
                setErrorInfo({ message: `Please fill in all survey times for ${beach.name}.`, targetId: survey.firstTime === '' ? 'firstTime' : 'lastTime' });
                return;
            }
            if (!isEndTimeAfterStartTime) {
                setCurrentBeach(beach.name);
                setErrorInfo({ message: `Last time on ${beach.name} must be after first time on ${beach.name}.`, targetId: 'lastTime' });
                return;
            }
            if (!isBoundaryValid) {
                setCurrentBeach(beach.name);
                const targetId = (survey.tlGpsLat === '' || !isLatValid(survey.tlGpsLat)) ? 'tlGpsLat' :
                                 (survey.tlGpsLng === '' || !isLngValid(survey.tlGpsLng)) ? 'tlGpsLng' :
                                 (survey.trGpsLat === '' || !isLatValid(survey.trGpsLat)) ? 'trGpsLat' : 'trGpsLng';
                setErrorInfo({ message: `Please fill in all boundary coordinates correctly for ${beach.name}.`, targetId });
                return;
            }
            if (!isTallyValid) {
                setCurrentBeach(beach.name);
                setErrorInfo({ message: `Nest count (${survey.nestTally}) must match the number of active nests on ${beach.name} (${beachNests.length}).`, targetId: 'nestTally' });
                return;
            }
        }

        setIsSaving(true);
        try {
            // 2. Save all beaches
            for (const beach of filteredBeaches) {
                const survey = surveys[beach.name] || defaultSurveyData;
                
                // Save Track Data as Nest Events
                const trackPromises = survey.tracks.map(async (track) => {
                    const payload: NestEventData = {
                        event_type: 'EMERGENCE',
                        nest_code: track.nestCode,
                        start_time: `${date} 08:00:00`, // Morning survey time
                        tracks_to_sea: parseInt(track.tracksToSea) || 0,
                        tracks_lost: parseInt(track.tracksLost) || 0,
                        notes: `Logged via Morning Survey for ${beach.name} (Region: ${currentRegion}). ${survey.notes ? `Survey Notes: ${survey.notes}` : ''}`
                    };
                    const response = await DatabaseConnection.createNestEvent(payload);
                    return { track, response };
                });

                const createdTracks = await Promise.all(trackPromises);

                // Update Nest Status for nests with tracks
                const nestIdMap: Record<string, number> = {};
                const uniqueNestCodes = [...new Set(survey.tracks.map(t => t.nestCode))] as string[];
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

                // Save ONE Morning Survey Record
                const baseSurveyPayload: MorningSurveyData = {
                    survey_date: date,
                    start_time: survey.firstTime,
                    end_time: survey.lastTime,
                    beach_id: beach.id,
                    tl_lat: survey.tlGpsLat,
                    tl_long: survey.tlGpsLng,
                    tr_lat: survey.trGpsLat,
                    tr_long: survey.trGpsLng,
                    protected_nest_count: survey.nestTally,
                    notes: survey.notes
                };

                const surveyResponse = await DatabaseConnection.createMorningSurvey(baseSurveyPayload);
                const surveyId = surveyResponse.survey.id;

                const hasNests = survey.nests && survey.nests.length > 0;
                const hasTracks = createdTracks && createdTracks.length > 0;

                if (hasNests) {
                    for (const nest of survey.nests) {
                        let nestId: number | undefined;
                        let eventId: number | undefined;

                        if (nest.payload) {
                            if (nest.isEmergence) {
                                const response = await DatabaseConnection.createEmergence(nest.payload);
                                eventId = response.emergence?.id || response.event?.id || response.id;
                                if (eventId) await DatabaseConnection.linkEmergenceToSurvey(surveyId, eventId);
                            } else {
                                const response = await DatabaseConnection.createNest(nest.payload);
                                nestId = response.nest?.id || response.id;
                                if (nestId) await DatabaseConnection.linkNestToSurvey(surveyId, nestId);
                                if (nest.relocationEventPayload) {
                                    await DatabaseConnection.createNestEvent(nest.relocationEventPayload);
                                }
                            }
                        }
                    }
                }

                // Note: createdTracks creates nest events, which are linked to nests, not emergences.
                // If they need to be linked to the survey, the user didn't provide an endpoint for that.
                // We'll just leave them as nest events.

                // Clear current survey data after successful save
                onUpdateSurveys(prev => ({
                    ...prev,
                    [beach.name]: { ...defaultSurveyData }
                }));
            }
            
            onNavigate(AppView.DASHBOARD);
        } catch (err: any) {
            console.error("Failed to save survey:", err);
            setErrorInfo({ message: "Error saving survey: " + (err.message || "Unknown error"), targetId: '' });
        } finally {
            setIsSaving(false);
        }
    };

    const grabCurrentTime = (field: 'firstTime' | 'lastTime') => {
        const currentValue = currentSurvey[field];
        const now = new Date().toTimeString().slice(0, 5);
        
        if (currentValue && currentValue !== '') {
            setConfirmTime({ field, value: now });
        } else {
            handleInputChange(field, now);
        }
    };

    const addNest = () => {
        onNavigate(AppView.NEST_ENTRY, date);
    };

    const removeNest = (index: number) => {
        handleInputChange('nests', currentSurvey.nests.filter((_, i) => i !== index));
    };

    const addTrack = () => {
        setHatchlingData({ nestCode: '', toSea: '', lost: '' });
        setIsHatchlingModalOpen(true);
    };

    const handleHatchlingSubmit = () => {
        if (!hatchlingData.nestCode || (hatchlingData.toSea.trim() === '' && hatchlingData.lost.trim() === '')) return;
        
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
                <MapPin className="w-5 h-5 text-primary" />
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
                            <Sun className="w-6 h-6 text-white" />
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
                        <Info className="w-5 h-5 text-primary" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Survey Information</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className={labelClass}>Survey Area</label>
                            <div className="relative">
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
                                    className={`${inputClass} appearance-none cursor-pointer`}
                                >
                                    {allRegions.map(region => (
                                        <option key={region} value={region}>{region}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>Date</label>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                        </div>
                    </div>
                </section>

                {/* Beach Selection Tabs */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 px-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Select Beach</h2>
                    </div>
                    <div className={`p-2 rounded-2xl ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-white/50'} backdrop-blur-sm border ${theme === 'dark' ? 'border-white/5' : 'border-slate-200/50'}`}>
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                            {filteredBeaches.length > 0 ? (
                                filteredBeaches.map(beach => (
                                    <button
                                        key={beach.id}
                                        onClick={() => setCurrentBeach(beach.name)}
                                        className={`px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                                            currentBeach === beach.name
                                                ? 'bg-primary text-white shadow-md shadow-primary/20 scale-100'
                                                : theme === 'dark'
                                                    ? 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200 scale-95 hover:scale-100'
                                                    : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 hover:text-slate-700 scale-95 hover:scale-100'
                                        }`}
                                    >
                                        {beach.name}
                                        {isBeachValid(beach.name) && (
                                            <CheckCircle2 className={`w-4 h-4 ${currentBeach === beach.name ? 'text-white' : 'text-emerald-500'}`} />
                                        )}
                                    </button>
                                ))
                            ) : (
                                <div className={`px-6 py-3 rounded-xl text-sm font-bold ${theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                                    No beaches in this area
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Survey Times, Beach Boundaries & Nest Count Card */}
                <section className={`border rounded-3xl p-8 shadow-xl shadow-black/5 backdrop-blur-sm ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-8">
                        <Clock className="w-5 h-5 text-primary" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Survey Timing & Boundaries</h2>
                    </div>
                    
                    <div className="space-y-10">
                        {/* Timing Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className={labelClass}>First time on {currentBeach}</label>
                                <div className="flex gap-2">
                                    <input 
                                        id="firstTime"
                                        type="text" 
                                        placeholder="--:--"
                                        value={currentSurvey.firstTime} 
                                        onChange={(e) => {
                                            handleInputChange('firstTime', formatTimeInput(e.target.value));
                                        }} 
                                        className={`${inputClass} ${
                                            hasAttemptedSave && currentSurvey.firstTime === '' ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
                                        }`} 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => grabCurrentTime('firstTime')} 
                                        className="px-4 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center justify-center gap-2 border border-primary/20"
                                        title="Set to current time"
                                    >
                                        <RefreshCw className="w-4 h-4 font-bold" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Now</span>
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>Last time on {currentBeach}</label>
                                <div className="flex gap-2">
                                    <input 
                                        id="lastTime"
                                        type="text" 
                                        placeholder="--:--"
                                        value={currentSurvey.lastTime} 
                                        onChange={(e) => {
                                            handleInputChange('lastTime', formatTimeInput(e.target.value));
                                        }} 
                                        className={`${inputClass} ${
                                            hasAttemptedSave && currentSurvey.lastTime === '' ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
                                        }`} 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => grabCurrentTime('lastTime')} 
                                        className="px-4 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center justify-center gap-2 border border-primary/20"
                                        title="Set to current time"
                                    >
                                        <RefreshCw className="w-4 h-4 font-bold" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Now</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Nest Count Row */}
                        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-white/5">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-1">
                                    <label className={labelClass}>Total Nest Count</label>
                                    <p className="text-[10px] font-medium text-slate-400">Total number of nests counted during this survey</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button 
                                        type="button" 
                                        onClick={() => handleInputChange('nestTally', Math.max(0, currentSurvey.nestTally - 1))}
                                        className="w-12 h-12 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                                    >
                                        <Minus className="w-5 h-5 font-black" />
                                    </button>
                                    <div className="relative">
                                        <input 
                                            id="nestTally"
                                            type="number" 
                                            value={currentSurvey.nestTally} 
                                            onChange={(e) => handleInputChange('nestTally', parseInt(e.target.value) || 0)}
                                            className="w-24 bg-transparent border-none text-center font-black text-3xl focus:ring-0 outline-none text-slate-900 dark:text-white"
                                        />
                                        {currentSurvey.nestTally !== availableNests.length && (
                                            <div className="absolute -bottom-6 left-0 right-0 text-center">
                                                <span className="text-[8px] font-black text-rose-500 uppercase tracking-tighter">
                                                    Expected: {availableNests.length}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => handleInputChange('nestTally', currentSurvey.nestTally + 1)}
                                        className="w-12 h-12 flex items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                                    >
                                        <Plus className="w-5 h-5 font-black" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* GPS Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {renderGpsInput('GPS TL (Left Edge)', 'tlGpsLat', 'tlGpsLng')}
                            {renderGpsInput('GPS TR (Right Edge)', 'trGpsLat', 'trGpsLng')}
                        </div>
                    </div>
                </section>

                {/* Nest Data Card */}
                <section className={`border rounded-3xl p-8 shadow-xl shadow-black/5 backdrop-blur-sm ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-white border-slate-200'}`}>
                    <div className="mb-10">
                        <div className="flex items-center gap-2 mb-1">
                            <ClipboardList className="w-5 h-5 text-primary" />
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Nest Monitoring ({currentBeach})</h2>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Tally Column */}
                        <div className="lg:col-span-4 space-y-4">
                            <button type="button" onClick={addNest} className="w-full flex items-center justify-center gap-2 bg-primary text-white font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-primary/90 transition-all text-[11px] shadow-lg shadow-primary/20">
                                <PlusCircle className="w-5 h-5" />
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
                                            {nest.isEmergence ? <Waves className="w-6 h-6" /> : <Egg className="w-6 h-6" />}
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
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                            {currentSurvey.nests?.length === 0 && (
                                <div className="h-[140px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl text-slate-400 bg-slate-50/30 dark:bg-transparent">
                                    <Home className="w-10 h-10 opacity-10 mb-2" />
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
                            <Footprints className="w-5 h-5 text-primary" />
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Hatchling Track Data ({currentBeach})</h2>
                        </div>
                        <Button 
                            onClick={addTrack} 
                            className="w-full"
                            size="lg"
                        >
                            <PlusCircle className="w-5 h-5 mr-2" />
                            Add Hatchling Track
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {currentSurvey.tracks?.map((track, index) => (
                            <Card key={index} className="p-4 group hover:shadow-md transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                            <PawPrint className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <Label className="text-primary mb-0">Nest {track.nestCode}</Label>
                                            <BodyText className="font-bold">
                                                {track.tracksToSea} to sea <span className="text-slate-300 mx-1">•</span> {track.tracksLost} lost
                                            </BodyText>
                                        </div>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => removeTrack(index)} 
                                        className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                    >
                                        Remove
                                    </Button>
                                </div>
                            </Card>
                        ))}
                        {currentSurvey.tracks?.length === 0 && (
                            <div className="py-10 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl text-slate-400">
                                <Footprints className="w-10 h-10 opacity-20 mb-2" />
                                <HelperText className="uppercase tracking-widest opacity-50">No tracks recorded yet</HelperText>
                            </div>
                        )}
                    </div>
                </section>

                {/* General Notes Card */}
                <Card className="p-8">
                    <div className="flex items-center gap-2 mb-6">
                        <FileText className="w-5 h-5 text-primary" />
                        <SectionHeading className="mb-0 !text-slate-400">General Notes</SectionHeading>
                    </div>
                    <Textarea 
                        value={currentSurvey.notes} 
                        onChange={(e) => handleInputChange('notes', e.target.value)} 
                        placeholder={`Enter any additional observations, weather conditions, or ${currentBeach} status...`} 
                        className="min-h-[120px]"
                    />
                </Card>

                {errorInfo && (
                    <Button 
                        variant="outline"
                        onClick={() => errorInfo.targetId ? scrollToField(errorInfo.targetId) : null}
                        className="w-full mb-6 !p-4 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20 flex items-center justify-start gap-3 border-dashed"
                    >
                        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                        <div className="flex flex-col overflow-hidden flex-1 text-left">
                            <span className="text-[7px] font-black uppercase tracking-[0.1em] text-rose-400 opacity-80 leading-tight">Action Required</span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 leading-tight">
                                {errorInfo.message}
                            </span>
                        </div>
                        {errorInfo.targetId && (
                            <Send className="w-4 h-4 text-rose-500 shrink-0 opacity-40" />
                        )}
                    </Button>
                )}

                <Button 
                    onClick={handleSaveSurvey}
                    disabled={isSaving}
                    isLoading={isSaving}
                    className="w-full"
                    size="lg"
                >
                    <Save className="w-5 h-5 mr-2" />
                    Complete Morning Survey
                </Button>
            </div>

            {/* Hatchling Data Modal */}
            <Modal
                isOpen={isHatchlingModalOpen}
                onClose={() => setIsHatchlingModalOpen(false)}
                title={`Log Hatchling Tracks (${currentBeach})`}
                footer={
                    <>
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsHatchlingModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleHatchlingSubmit}
                            disabled={!hatchlingData.nestCode || (hatchlingData.toSea.trim() === '' && hatchlingData.lost.trim() === '')}
                        >
                            Add Track
                        </Button>
                    </>
                }
            >
                <div className="space-y-6">
                    <Select 
                        label="Select Nest Code"
                        value={hatchlingData.nestCode}
                        onChange={e => setHatchlingData({...hatchlingData, nestCode: e.target.value})}
                        options={[
                            { label: '-- Select a Nest --', value: '' },
                            ...availableNests.map(nest => ({
                                label: `${nest.id} (${nest.location})`,
                                value: nest.id
                            }))
                        ]}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tracks to Sea</label>
                            <input
                                type="number"
                                value={hatchlingData.toSea}
                                onChange={e => setHatchlingData({...hatchlingData, toSea: e.target.value})}
                                placeholder="0"
                                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tracks Lost</label>
                            <input
                                type="number"
                                value={hatchlingData.lost}
                                onChange={e => setHatchlingData({...hatchlingData, lost: e.target.value})}
                                placeholder="0"
                                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                        </div>
                    </div>
                    <HelperText className="italic leading-tight">
                        * At least one track count is required to submit.
                    </HelperText>
                </div>
            </Modal>

            {/* Time Confirmation Modal */}
            <Modal
                isOpen={!!confirmTime}
                onClose={() => setConfirmTime(null)}
                title="Overwrite Time?"
                footer={
                    <>
                        <Button 
                            variant="outline" 
                            onClick={() => setConfirmTime(null)}
                            className="flex-1"
                        >
                            No, Keep Existing
                        </Button>
                        <Button 
                            onClick={() => {
                                handleInputChange(confirmTime!.field, confirmTime!.value);
                                setConfirmTime(null);
                            }}
                            className="flex-1"
                        >
                            Yes, Update
                        </Button>
                    </>
                }
            >
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <BodyText className="text-center">
                        A time is already set for this field ({confirmTime ? currentSurvey[confirmTime.field] : ''}). Are you sure you want to update it to {confirmTime?.value}?
                    </BodyText>
                </div>
            </Modal>
        </div>
    );
};

export default MorningSurvey;
