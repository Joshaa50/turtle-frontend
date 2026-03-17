
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsUpDown, 
  ChevronUp, 
  ChevronDown, 
  Archive, 
  ArchiveRestore, 
  History, 
  AlertCircle, 
  Baby, 
  Package, 
  FolderOpen, 
  X, 
  Calendar, 
  Ship, 
  AlertTriangle 
} from 'lucide-react';
import { AppView, NestRecord, TurtleRecord, User, EmergenceRecord } from '../types';
import { DatabaseConnection, NestEventData } from '../services/Database';
import { API_URL } from '../services/Database';
import { PageTitle, SectionHeading, BodyText, HelperText, Label } from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';

interface RecordsProps {
  type: 'nest' | 'turtle';
  onNavigate: (v: AppView) => void;
  onSelectNest?: (id: string) => void;
  onInventoryNest?: (id: string) => void;
  onSelectTurtle?: (id: string) => void;
  theme?: 'light' | 'dark';
  user: User;
}

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null;
type TabType = 'active' | 'archived' | 'emergence';

const Records: React.FC<RecordsProps> = ({ type, onNavigate, onSelectNest, onInventoryNest, onSelectTurtle, theme = 'light', user }) => {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [allBeaches, setAllBeaches] = useState<any[]>([]);
  const [stations, setStations] = useState<string[]>([]);
  const [surveyAreas, setSurveyAreas] = useState<string[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [selectedSurveyArea, setSelectedSurveyArea] = useState<string>('');
  const [beachFilterModal, setBeachFilterModal] = useState({ isOpen: false });
  const [selectedBeaches, setSelectedBeaches] = useState<string[]>([]);
  
  useEffect(() => {
    fetch(`${API_URL}/beaches`)
      .then(res => res.json())
      .then(data => {
        console.log("Beaches raw data:", data);
        const beachesData = Array.isArray(data) ? data : (data.beaches || []);
        setAllBeaches(beachesData);
        const uniqueStations = Array.from(new Set(beachesData.map((b: any) => b.station).filter(Boolean)));
        setStations(uniqueStations as string[]);
      })
      .catch(err => console.error("Error fetching beaches:", err));
  }, []);

  useEffect(() => {
    if (selectedStation) {
      const areas = Array.from(new Set(allBeaches.filter(b => b.station === selectedStation).map((b: any) => b.survey_area).filter(Boolean)));
      setSurveyAreas(areas as string[]);
      setSelectedSurveyArea('');
    } else {
      setSurveyAreas([]);
      setSelectedSurveyArea('');
    }
  }, [selectedStation, allBeaches]);
  
  // Data State
  const [nests, setNests] = useState<NestRecord[]>([]);
  const [turtles, setTurtles] = useState<TurtleRecord[]>([]);
  const [emergences, setEmergences] = useState<EmergenceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [hatchlingModal, setHatchlingModal] = useState<{ isOpen: boolean, nestId: string | null }>({
    isOpen: false,
    nestId: null
  });
  const [isSubmittingHatchling, setIsSubmittingHatchling] = useState(false);
  const [emergenceDetailsModal, setEmergenceDetailsModal] = useState<{ isOpen: boolean, emergence: EmergenceRecord | null }>({
    isOpen: false,
    emergence: null
  });
  const [hatchlingData, setHatchlingData] = useState({ 
    toSea: '', 
    notMadeIt: '', 
    date: new Date().toISOString().split('T')[0] 
  });
  const handleViewEmergenceDetails = async (item: any) => {
    try {
      const response = await fetch(`${API_URL}/emergences/${item.id}`);
      if (!response.ok) throw new Error('Failed to fetch emergence details');
      const data = await response.json();
      setEmergenceDetailsModal({ isOpen: true, emergence: data.emergence });
    } catch (err) {
      console.error("Error fetching emergence details:", err);
    }
  };

  // Fetch Data Effect
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (type === 'nest') {
            const rawNests = await DatabaseConnection.getNests();
            const mappedNests = rawNests.map((n: any) => {
                const laidDate = new Date(n.date_laid || n.date_found);
                const today = new Date();
                const diffTime = today.getTime() - laidDate.getTime();
                const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                
                return {
                    id: n.nest_code,
                    dbId: n.id,
                    location: n.beach,
                    date: `${laidDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} (${diffDays}d)`,
                    laidTimestamp: laidDate.getTime(),
                    incubationDays: diffDays,
                    species: n.species || 'Loggerhead', // Default as it is not always available in basic nest data
                    status: n.status ? n.status.toUpperCase() : 'INCUBATING',
                    // Check multiple possible field names for archive status from backend
                    isArchived: n.isArchive === 'yes' || n.isArchive === true || n.is_archived === true || n.is_archived === 'yes' || n.is_archived === 1
                };
            });
            setNests(mappedNests);
            const rawEmergences = await DatabaseConnection.getEmergences();
            setEmergences(rawEmergences);
        } else if (type === 'turtle') {
            const rawTurtles = await DatabaseConnection.getTurtles();
            // Map DB response to TurtleRecord interface
            const mappedTurtles: TurtleRecord[] = rawTurtles.map((t: any) => ({
                id: t.id,
                tagId: t.front_left_tag || t.front_right_tag || t.rear_left_tag || t.rear_right_tag || `ID-${t.id}`,
                name: t.name || 'Unnamed',
                species: t.species,
                // Use updated_at or created_at for Last Seen date
                lastSeen: new Date(t.updated_at || t.created_at).toLocaleDateString(), 
                location: '', // DB doesn't provide location in get endpoint
                weight: 0 
            }));
            setTurtles(mappedTurtles);
        } else if (type === 'emergence') {
            const rawEmergences = await DatabaseConnection.getEmergences();
            setEmergences(rawEmergences);
        }
      } catch (err) {
        console.error("Failed to load records", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [type]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    try {
      // Fetch full nest data first to satisfy backend update requirements (all fields required)
      const data = await DatabaseConnection.getNest(id); // id here is nest_code
      if (data && data.nest) {
        const fullNest = data.nest;
        // Call backend to update
        await DatabaseConnection.updateNest(fullNest.id, {
          ...fullNest,
          is_archived: true
        });
        
        // Optimistic UI update
        setNests(prev => prev.map(n => n.id === id ? { ...n, isArchived: true } : n));
      }
    } catch (err) {
      console.error("Failed to archive nest:", err);
      alert("Failed to archive nest. Please check connection.");
    }
  };

  const handleUnarchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    try {
      // Fetch full nest data first
      const data = await DatabaseConnection.getNest(id);
      if (data && data.nest) {
        const fullNest = data.nest;
        // Call backend to update
        await DatabaseConnection.updateNest(fullNest.id, {
          ...fullNest,
          is_archived: false
        });
        
        // Optimistic UI update
        setNests(prev => prev.map(n => n.id === id ? { ...n, isArchived: false } : n));
      }
    } catch (err) {
      console.error("Failed to unarchive nest:", err);
      alert("Failed to unarchive nest.");
    }
  };

  const sortedData = useMemo(() => {
    let data;
    if (type === 'nest') {
      if (activeTab === 'emergence') {
        data = [...emergences];
      } else {
        data = [...nests];
        data = data.filter(item => activeTab === 'active' ? !item.isArchived : item.isArchived);
      }
    } else {
      data = [...turtles];
    }

    // Filter by search term
    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        data = data.filter((item: any) => {
            if (type === 'nest' && activeTab !== 'emergence') {
                return (item.id && item.id.toLowerCase().includes(lowerTerm)) || 
                       (item.location && item.location.toLowerCase().includes(lowerTerm));
            } else if (type === 'turtle') {
                return (item.tagId && item.tagId.toLowerCase().includes(lowerTerm)) ||
                       (item.name && item.name.toLowerCase().includes(lowerTerm)) ||
                       (item.id && String(item.id).includes(lowerTerm));
            } else {
                return (item.beach && item.beach.toLowerCase().includes(lowerTerm)) ||
                       (String(item.id).includes(lowerTerm));
            }
        });
    }

    // Filter by beach
    if (type === 'nest' && activeTab === 'emergence' && selectedBeaches.length > 0) {
        data = data.filter((item: any) => selectedBeaches.includes(item.beach));
    }

    if (!sortConfig) {
      if (type === 'nest' && activeTab === 'emergence') {
        return [...data].sort((a: any, b: any) => b.id - a.id);
      }
      return data;
    }

    return data.sort((a: any, b: any) => {
      const key = sortConfig.key;
      let aValue = a[key];
      let bValue = b[key];

      // Handle ID sorting (numeric)
      if (key === 'id') {
        aValue = parseInt(aValue, 10);
        bValue = parseInt(bValue, 10);
        if (isNaN(aValue)) aValue = 0;
        if (isNaN(bValue)) bValue = 0;
      }
      // Handle date sorting
      else if (key === 'date') {
        aValue = a.laidTimestamp;
        bValue = b.laidTimestamp;
      } else if (key === 'event_date') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } 
      // Handle numeric sorting
      else if (typeof aValue === 'number' && typeof bValue === 'number') {
        // keep as is
      }
      // Default string sorting
      else {
        aValue = aValue ? String(aValue).toLowerCase() : '';
        bValue = bValue ? String(bValue).toLowerCase() : '';
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [type, sortConfig, activeTab, nests, turtles, searchTerm, selectedBeaches]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ChevronsUpDown className="size-3 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="size-3 text-primary" /> : <ChevronDown className="size-3 text-primary" />;
  };

  const handleOpenHatchlingModal = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHatchlingModal({ isOpen: true, nestId: id });
    setHatchlingData({ 
      toSea: '', 
      notMadeIt: '', 
      date: new Date().toISOString().split('T')[0] 
    });
  };

  const handleCloseHatchlingModal = () => {
    setHatchlingModal({ isOpen: false, nestId: null });
    setHatchlingData({ 
      toSea: '', 
      notMadeIt: '', 
      date: new Date().toISOString().split('T')[0] 
    });
    setIsSubmittingHatchling(false);
  };

  const handleSaveHatchlingData = async () => {
    if (!hatchlingModal.nestId) return;
    setIsSubmittingHatchling(true);

    try {
      // 1. Create Nest Event
      const payload: NestEventData = {
        event_type: 'EMERGENCE',
        nest_code: hatchlingModal.nestId,
        start_time: `${hatchlingData.date} 12:00:00`, // Approximate time since user only provides date
        tracks_to_sea: parseInt(hatchlingData.toSea) || 0,
        tracks_lost: parseInt(hatchlingData.notMadeIt) || 0,
        notes: 'Logged via Quick Hatchling Record'
      };

      await DatabaseConnection.createNestEvent(payload);
      
      // 2. Update Nest Status
      const nestResponse = await DatabaseConnection.getNest(hatchlingModal.nestId);
      if (nestResponse && nestResponse.nest) {
        const fullNest = nestResponse.nest;
        
        // Change status to 'hatching' if it is currently 'incubating'
        if (fullNest.status === 'incubating' || fullNest.status === 'INCUBATING') {
             await DatabaseConnection.updateNest(fullNest.id, {
                ...fullNest,
                status: 'hatching'
            });
            // Update local state
            setNests(prev => prev.map(n => n.id === hatchlingModal.nestId ? { ...n, status: 'HATCHING' } : n));
        }
      }
      
      alert(`Hatchling tracks logged successfully for Nest ${hatchlingModal.nestId}.`);
      handleCloseHatchlingModal();
    } catch (err: any) {
      console.error("Failed to save hatchling data:", err);
      alert("Error saving record: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmittingHatchling(false);
    }
  };

  const handleAddInventory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onInventoryNest) onInventoryNest(id);
  };

  return (
    <div className={`flex flex-col min-h-full relative ${theme === 'dark' ? 'bg-background-dark' : 'bg-background-light'}`}>
      <header className={`sticky top-0 z-10 backdrop-blur-md border-b px-8 h-16 flex items-center justify-between transition-all duration-300 ${
        theme === 'dark' ? 'bg-background-dark/80 border-[#283039]' : 'bg-white/80 border-slate-200'
      }`}>
        <div className="flex items-center gap-4 z-20">
          <div className="w-10 flex-shrink-0">
            {/* Left spacer for menu button */}
          </div>
        </div>
        
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <PageTitle className="mb-0 text-xl md:text-xl">{type === 'nest' ? 'Nest Records' : 'Turtle Records'}</PageTitle>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          
          {/* Search Input */}
          <div className="flex flex-col md:flex-row gap-4 w-full">
            <div className="w-full md:w-96">
              <Input
                placeholder={type === 'nest' ? "Search Nest ID or Location..." : "Search Tag ID, Name, or ID..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<Search className="size-4" />}
              />
            </div>
          </div>

          <div className="order-1 md:order-2 shrink-0">
            {type === 'nest' ? (
                <Button 
                  onClick={() => onNavigate(AppView.NEST_ENTRY)}
                  disabled={user.role === 'Field Volunteer'}
                  icon={<Plus className="size-4" />}
                >
                  New Nest
                </Button>
            ) : (
                <Button 
                  onClick={() => onNavigate(AppView.TAGGING_ENTRY)}
                  disabled={user.role === 'Field Volunteer'}
                  icon={<Plus className="size-4" />}
                >
                  New Turtle
                </Button>
            )}
          </div>
        </div>

        {type === 'nest' && (
          <div className={`flex w-full border-b ${theme === 'dark' ? 'border-[#283039]' : 'border-slate-200'}`}>
            <button 
              onClick={() => setActiveTab('active')}
              className={`flex-1 px-1 sm:px-6 py-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap text-center ${activeTab === 'active' ? 'border-b-2 border-primary text-primary' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Active Nests
            </button>
            <button 
              onClick={() => setActiveTab('archived')}
              className={`flex-1 px-1 sm:px-6 py-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap text-center ${activeTab === 'archived' ? 'border-b-2 border-primary text-primary' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Archived Nests
            </button>
            <button 
              onClick={() => setActiveTab('emergence')}
              className={`flex-1 px-1 sm:px-6 py-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap text-center ${activeTab === 'emergence' ? 'border-b-2 border-primary text-primary' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Emergences
            </button>
          </div>
        )}

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b ${theme === 'dark' ? 'bg-[#151c26] border-[#283039]' : 'bg-slate-50 border-slate-200'}`}>
                  <th onClick={() => handleSort('id')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-primary transition-colors ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    <div className="flex items-center gap-1">
                      {type === 'nest' && activeTab === 'nest' ? 'Nest ID' : 'ID'}
                      <SortIcon column="id" />
                    </div>
                  </th>
                  {type === 'turtle' && (
                    <th onClick={() => handleSort('name')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-primary transition-colors ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      <div className="flex items-center gap-1">
                        Name <SortIcon column="name" />
                      </div>
                    </th>
                  )}
                  {type === 'nest' && activeTab !== 'emergence' ? (
                    <th onClick={() => handleSort('date')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-primary transition-colors ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      <div className="flex items-center gap-1">
                        Date Laid <SortIcon column="date" />
                      </div>
                    </th>
                  ) : type === 'nest' && activeTab === 'emergence' ? (
                    <th onClick={() => handleSort('event_date')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-primary transition-colors ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      <div className="flex items-center gap-1">
                        Date <SortIcon column="event_date" />
                      </div>
                    </th>
                  ) : (
                    <th onClick={() => handleSort('species')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-primary transition-colors ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      <div className="flex items-center gap-1">
                        Species <SortIcon column="species" />
                      </div>
                    </th>
                  )}
                  {/* For Turtles, sort by lastSeen instead of location */}
                  <th 
                    onClick={() => {
                        if (type === 'nest' && activeTab === 'emergence') {
                            setBeachFilterModal({ isOpen: true });
                        } else {
                            handleSort(type === 'nest' && activeTab !== 'emergence' ? 'location' : type === 'nest' && activeTab === 'emergence' ? 'beach' : 'lastSeen');
                        }
                    }}
                    className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-primary transition-colors ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    <div className="flex items-center gap-1">
                      {type === 'nest' && activeTab !== 'emergence' ? 'Beach & Sector' : type === 'nest' && activeTab === 'emergence' ? 'Beach' : 'Last Seen'}
                      <SortIcon column={type === 'nest' && activeTab !== 'emergence' ? 'location' : type === 'nest' && activeTab === 'emergence' ? 'beach' : 'lastSeen'} />
                    </div>
                  </th>
                  {type === 'nest' && activeTab !== 'emergence' && (
                    <th onClick={() => handleSort('status')} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center cursor-pointer hover:text-primary transition-colors ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      <div className="flex items-center justify-center gap-1">
                        Status <SortIcon column="status" />
                      </div>
                    </th>
                  )}
                  <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'dark' ? 'bg-[#1a232e] divide-[#283039]' : 'bg-white divide-slate-100'}`}>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <span className="size-6 border-2 border-slate-600 border-t-primary rounded-full animate-spin"></span>
                        <span className="text-xs uppercase tracking-widest font-bold">Loading Records...</span>
                      </div>
                    </td>
                  </tr>
                ) : sortedData.map((item: any) => (
                  <tr 
                    key={type === 'nest' ? item.id : item.tagId} 
                    className={`transition-colors group ${theme === 'dark' ? 'hover:bg-primary/5' : 'hover:bg-slate-50/50'}`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-primary">{item.id}</div>
                      {type === 'turtle' && <p className="text-[10px] text-slate-500">Tag: {item.tagId}</p>}
                      {type === 'nest' && activeTab !== 'emergence' && item.status !== 'HATCHED' && item.incubationDays >= 45 && (
                        <span className="flex items-center gap-0.5 text-[8px] font-black text-rose-500 uppercase tracking-normal animate-pulse mt-0.5">
                          Due to Hatch
                          <AlertCircle className="size-2.5" />
                        </span>
                      )}
                    </td>
                    {type === 'turtle' && (
                      <td className="px-6 py-4">
                        <div className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{item.name}</div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      {type === 'nest' && activeTab !== 'emergence' ? (
                        <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{item.date}</div>
                      ) : type === 'nest' && activeTab === 'emergence' ? (
                        <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{new Date(item.event_date).toLocaleDateString()}</div>
                      ) : (
                        <span className={`px-2.5 py-1 text-[10px] font-black rounded-full uppercase tracking-tighter ring-1 ${
                          (item.species === 'Green') 
                            ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-500 ring-amber-500/20'
                        }`}>
                          {item.species}
                        </span>
                      )}
                    </td>
                    <td className={`px-6 py-4 text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      {type === 'nest' && activeTab !== 'emergence' ? item.location : type === 'nest' && activeTab === 'emergence' ? item.beach : item.lastSeen}
                    </td>
                    {type === 'nest' && activeTab !== 'emergence' && (
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-widest ${
                          item.status === 'HATCHED' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                          item.status === 'HATCHING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                          'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {type === 'nest' && activeTab !== 'emergence' ? (
                          <>
                            {activeTab === 'active' ? (
                              <>
                                {user.role !== 'Field Volunteer' && (
                                  <Button 
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => handleOpenHatchlingModal(e, item.id)}
                                    className="text-emerald-500 hover:bg-emerald-500/10"
                                    title="Log Emerging Hatchlings"
                                  >
                                    <Baby className="size-5" />
                                  </Button>
                                )}
                                {item.status !== 'HATCHED' && user.role !== 'Field Volunteer' && (
                                  <Button 
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => handleAddInventory(e, item.id)}
                                    className="text-amber-500 hover:bg-amber-500/10"
                                    title="Nest Inventory Entry"
                                  >
                                    <Package className="size-5" />
                                  </Button>
                                )}
                                {item.status === 'HATCHED' && user.role !== 'Field Volunteer' && (
                                  <Button 
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => handleArchive(e, item.id)}
                                    className="text-primary hover:bg-primary/10"
                                    title="Archive Nest"
                                  >
                                    <Archive className="size-5" />
                                  </Button>
                                )}
                              </>
                            ) : (
                              <Button 
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleUnarchive(e, item.id)}
                                className="text-blue-500 hover:bg-blue-500/10"
                                title="Unarchive Nest"
                                disabled={user.role === 'Field Volunteer'}
                              >
                                <ArchiveRestore className="size-5" />
                              </Button>
                            )}
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); onSelectNest?.(String(item.id)); }}
                              icon={<History className="size-3" />}
                            >
                              Details
                            </Button>
                          </>
                        ) : type === 'nest' && activeTab === 'emergence' ? (
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); handleViewEmergenceDetails(item); }}
                            icon={<History className="size-3" />}
                          >
                            Details
                          </Button>
                        ) : (
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); onSelectTurtle?.(String(item.id)); }}
                            icon={<History className="size-3" />}
                          >
                            View Details
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedData.length === 0 && !isLoading && (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
                <FolderOpen className="size-12 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest opacity-50">No records found matching "{searchTerm}"</p>
              </div>
            )}
          </div>
          <div className={`px-6 py-4 border-t flex items-center justify-between ${theme === 'dark' ? 'bg-[#151c26] border-[#283039]' : 'bg-slate-50 border-slate-200'}`}>
            <HelperText className="font-bold">Showing {sortedData.length} records</HelperText>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

      {/* Hatchling Data Entry Modal */}
      <Modal
        isOpen={hatchlingModal.isOpen}
        onClose={handleCloseHatchlingModal}
        title={`Log Hatchling Tracks: ${hatchlingModal.nestId}`}
        footer={
          <>
            <Button variant="ghost" onClick={handleCloseHatchlingModal}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveHatchlingData}
              disabled={!hatchlingData.toSea || !hatchlingData.date || isSubmittingHatchling}
              isLoading={isSubmittingHatchling}
            >
              Submit Records
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <Input
            label="Date of Emergence"
            type="date"
            value={hatchlingData.date}
            onChange={e => setHatchlingData({...hatchlingData, date: e.target.value})}
            icon={<Calendar className="size-4" />}
            required
          />
          <Input
            label="Successful Tracks (To Sea)"
            type="number"
            value={hatchlingData.toSea}
            onChange={e => setHatchlingData({...hatchlingData, toSea: e.target.value})}
            placeholder="Total tracks reaching water"
            icon={<Ship className="size-4 text-emerald-500" />}
            required
          />
          <Input
            label="Unsuccessful / Lost"
            type="number"
            value={hatchlingData.notMadeIt}
            onChange={e => setHatchlingData({...hatchlingData, notMadeIt: e.target.value})}
            placeholder="Disoriented or predated"
            icon={<AlertTriangle className="size-4 text-amber-500" />}
          />
          <HelperText className="italic leading-tight">
            * Emerging data helps calculate the Success Rate of the current nesting season for this specific sector.
          </HelperText>
        </div>
      </Modal>

      {/* Emergence Details Modal */}
      <Modal
        isOpen={emergenceDetailsModal.isOpen && !!emergenceDetailsModal.emergence}
        onClose={() => setEmergenceDetailsModal({ isOpen: false, emergence: null })}
        title={`Emergence ${emergenceDetailsModal.emergence?.id}`}
      >
        {emergenceDetailsModal.emergence && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Date</Label>
                <BodyText className="font-bold">
                  {new Date(emergenceDetailsModal.emergence.event_date).toLocaleDateString()}
                </BodyText>
              </div>
              <div className="space-y-1">
                <Label>Beach</Label>
                <BodyText className="font-bold">
                  {emergenceDetailsModal.emergence.beach}
                </BodyText>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Distance to Sea</Label>
                <BodyText className="font-bold">
                  {emergenceDetailsModal.emergence.distance_to_sea_s} m
                </BodyText>
              </div>
              <div className="space-y-1">
                <Label>GPS Lat</Label>
                <BodyText className="font-bold">
                  {emergenceDetailsModal.emergence.gps_lat}
                </BodyText>
              </div>
              <div className="space-y-1">
                <Label>GPS Long</Label>
                <BodyText className="font-bold">
                  {emergenceDetailsModal.emergence.gps_long}
                </BodyText>
              </div>
            </div>
            {emergenceDetailsModal.emergence.track_sketch && (
              <div className="space-y-2">
                <Label>Track Sketch</Label>
                <img 
                  src={`data:image/jpeg;base64,${emergenceDetailsModal.emergence.track_sketch}`} 
                  alt="Track Sketch" 
                  className="w-full rounded-lg border border-slate-200"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Beach Filter Modal */}
      {beachFilterModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
            <header className={`p-6 border-b flex justify-between items-center ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
              <h2 className={`text-lg font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Filter by Beach
              </h2>
              <button onClick={() => setBeachFilterModal({ isOpen: false })} className="text-slate-400 hover:text-slate-500">
                <X className="size-6" />
              </button>
            </header>
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Station Area</label>
                <select 
                  value={selectedStation} 
                  onChange={(e) => {
                    setSelectedStation(e.target.value);
                    setSelectedSurveyArea('');
                  }}
                  className={`w-full p-3 rounded-xl border font-bold transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white focus:ring-2 focus:ring-primary/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-2 focus:ring-primary/20'}`}
                >
                  <option value="">All Stations</option>
                  {stations.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Survey Area</label>
                <select 
                  value={selectedSurveyArea} 
                  onChange={(e) => setSelectedSurveyArea(e.target.value)}
                  disabled={!selectedStation}
                  className={`w-full p-3 rounded-xl border font-bold transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white focus:ring-2 focus:ring-primary/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-2 focus:ring-primary/20'} ${!selectedStation ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="">All Survey Areas</option>
                  {surveyAreas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div className="space-y-2 mt-6">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Select Beaches</h3>
                <div className={`max-h-60 overflow-y-auto p-2 rounded-xl border ${theme === 'dark' ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                  {allBeaches
                    .filter(b => (!selectedStation || b.station === selectedStation) && (!selectedSurveyArea || b.survey_area === selectedSurveyArea))
                    .map(beach => (
                      <label key={beach.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-primary/5 cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedBeaches.includes(beach.name)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedBeaches([...selectedBeaches, beach.name]);
                            else setSelectedBeaches(selectedBeaches.filter(b => b !== beach.name));
                          }}
                          className="size-5 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className={`font-bold text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{beach.name}</span>
                      </label>
                    ))}
                </div>
              </div>
            </div>
            <footer className={`p-4 border-t flex justify-end gap-3 ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              <button 
                onClick={() => setSelectedBeaches([])}
                className={`px-4 py-2 text-xs font-black uppercase transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Clear
              </button>
              <button 
                onClick={() => setBeachFilterModal({ isOpen: false })}
                className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-black uppercase shadow-lg shadow-primary/20 transition-all"
              >
                Apply
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default Records;
