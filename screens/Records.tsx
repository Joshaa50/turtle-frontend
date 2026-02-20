
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppView, NestRecord, TurtleRecord } from '../types';
import { DatabaseConnection, NestEventData } from '../services/Database';

interface RecordsProps {
  type: 'nest' | 'turtle';
  onNavigate: (v: AppView) => void;
  onSelectNest?: (id: string) => void;
  onInventoryNest?: (id: string) => void;
  onSelectTurtle?: (id: string) => void;
}

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null;
type TabType = 'active' | 'archived';

const Records: React.FC<RecordsProps> = ({ type, onNavigate, onSelectNest, onInventoryNest, onSelectTurtle }) => {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data State
  const [nests, setNests] = useState<NestRecord[]>([]);
  const [turtles, setTurtles] = useState<TurtleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [hatchlingModal, setHatchlingModal] = useState<{ isOpen: boolean, nestId: string | null }>({
    isOpen: false,
    nestId: null
  });
  const [hatchlingData, setHatchlingData] = useState({ 
    toSea: '', 
    notMadeIt: '', 
    date: new Date().toISOString().split('T')[0] 
  });
  const [isSubmittingHatchling, setIsSubmittingHatchling] = useState(false);

  // Fetch Data Effect
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (type === 'nest') {
            const rawNests = await DatabaseConnection.getNests();
            const mappedNests = rawNests.map((n: any) => ({
                id: n.nest_code,
                dbId: n.id,
                location: n.beach,
                date: new Date(n.date_found).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
                species: n.species || 'Loggerhead', // Default as it is not always available in basic nest data
                status: n.status ? n.status.toUpperCase() : 'INCUBATING',
                // Check multiple possible field names for archive status from backend
                isArchived: n.isArchive === 'yes' || n.isArchive === true || n.is_archived === true || n.is_archived === 'yes' || n.is_archived === 1
            }));
            setNests(mappedNests);
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
      data = [...nests];
      data = data.filter(item => activeTab === 'active' ? !item.isArchived : item.isArchived);
    } else {
      data = [...turtles];
    }

    // Filter by search term
    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        data = data.filter((item: any) => {
            if (type === 'nest') {
                return (item.id && item.id.toLowerCase().includes(lowerTerm)) || 
                       (item.location && item.location.toLowerCase().includes(lowerTerm));
            } else {
                // For turtles: check tagId, name, or internal ID
                return (item.tagId && item.tagId.toLowerCase().includes(lowerTerm)) ||
                       (item.name && item.name.toLowerCase().includes(lowerTerm)) ||
                       (item.id && String(item.id).includes(lowerTerm));
            }
        });
    }

    if (!sortConfig) {
      return type === 'turtle' ? data.slice(0, 10) : data;
    }

    const sorted = data.sort((a: any, b: any) => {
      const key = sortConfig.key;
      const aValue = a[key] ? String(a[key]).toLowerCase() : '';
      const bValue = b[key] ? String(b[key]).toLowerCase() : '';
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return type === 'turtle' ? sorted.slice(0, 10) : sorted;
  }, [type, sortConfig, activeTab, nests, turtles, searchTerm]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <span className="material-symbols-outlined text-xs opacity-20">unfold_more</span>;
    return <span className="material-symbols-outlined text-xs text-primary">{sortConfig.direction === 'asc' ? 'expand_less' : 'expand_more'}</span>;
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

  const handleRowClick = (item: any) => {
    if (type === 'nest') {
      onSelectNest?.(item.id);
    } else {
      // Pass the internal numeric ID for turtles
      onSelectTurtle?.(String(item.id));
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark relative">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-[#283039] pl-16 pr-8 lg:pl-8 py-4 flex items-center justify-between transition-all duration-300">
        <div>
          <h2 className="text-xl font-black text-white">{type === 'nest' ? 'Nest Records' : 'Turtle Records'}</h2>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          
          {/* Search Input */}
          <div className="relative w-full md:w-96 order-2 md:order-1">
            <span className="material-symbols-outlined absolute left-3 top-3.5 text-slate-400 text-lg">search</span>
            <input 
                type="text" 
                placeholder={type === 'nest' ? "Search Nest ID or Location..." : "Search Tag ID, Name, or ID..."}
                className="w-full bg-white dark:bg-[#1a232e] border border-slate-200 dark:border-[#283039] rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none font-bold text-slate-700 dark:text-slate-200 transition-all shadow-sm placeholder:font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="order-1 md:order-2 shrink-0">
            {type === 'nest' ? (
                <button 
                onClick={() => onNavigate(AppView.NEST_ENTRY)}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-3 text-sm font-bold flex items-center gap-2 rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-95 whitespace-nowrap"
                >
                <span className="material-symbols-outlined text-lg">add</span>
                New Nest
                </button>
            ) : (
                <button 
                onClick={() => onNavigate(AppView.TAGGING_ENTRY)}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-3 text-sm font-bold flex items-center gap-2 rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-95 whitespace-nowrap"
                >
                <span className="material-symbols-outlined text-lg">add</span>
                New Turtle
                </button>
            )}
          </div>
        </div>

        {type === 'nest' && (
          <div className="flex border-b border-slate-200 dark:border-[#283039]">
            <button 
              onClick={() => setActiveTab('active')}
              className={`px-6 py-3 text-sm font-bold transition-all ${activeTab === 'active' ? 'border-b-2 border-primary text-primary' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Active Nests
            </button>
            <button 
              onClick={() => setActiveTab('archived')}
              className={`px-6 py-3 text-sm font-bold transition-all ${activeTab === 'archived' ? 'border-b-2 border-primary text-primary' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Archived Nests
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-[#1a232e] border border-slate-200 dark:border-[#283039] rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#151c26] border-b border-slate-200 dark:border-[#283039]">
                  <th onClick={() => handleSort('id')} className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors">
                    <div className="flex items-center gap-1">
                      {type === 'nest' ? 'Nest ID' : 'ID'}
                      <SortIcon column="id" />
                    </div>
                  </th>
                  {type === 'turtle' && (
                    <th onClick={() => handleSort('name')} className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors">
                      <div className="flex items-center gap-1">
                        Name <SortIcon column="name" />
                      </div>
                    </th>
                  )}
                  {type === 'nest' ? (
                    <th onClick={() => handleSort('date')} className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors">
                      <div className="flex items-center gap-1">
                        Date Laid <SortIcon column="date" />
                      </div>
                    </th>
                  ) : (
                    <th onClick={() => handleSort('species')} className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors">
                      <div className="flex items-center gap-1">
                        Species <SortIcon column="species" />
                      </div>
                    </th>
                  )}
                  {/* For Turtles, sort by lastSeen instead of location */}
                  <th onClick={() => handleSort(type === 'nest' ? 'location' : 'lastSeen')} className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors">
                    <div className="flex items-center gap-1">
                      {type === 'nest' ? 'Beach & Sector' : 'Last Seen'}
                      <SortIcon column={type === 'nest' ? 'location' : 'lastSeen'} />
                    </div>
                  </th>
                  {type === 'nest' && (
                    <th onClick={() => handleSort('status')} className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center cursor-pointer hover:text-primary transition-colors">
                      <div className="flex items-center justify-center gap-1">
                        Status <SortIcon column="status" />
                      </div>
                    </th>
                  )}
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#283039]">
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
                    onClick={() => handleRowClick(item)}
                    className="hover:bg-slate-50/50 dark:hover:bg-primary/5 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-primary">{item.id}</div>
                      {type === 'turtle' && <p className="text-[10px] text-slate-500">Tag: {item.tagId}</p>}
                    </td>
                    {type === 'turtle' && (
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-100">{item.name}</div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      {type === 'nest' ? (
                        <div className="text-sm text-slate-300 font-semibold">{item.date}</div>
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
                    <td className="px-6 py-4 text-sm font-semibold text-slate-300">
                      {type === 'nest' ? item.location : item.lastSeen}
                    </td>
                    {type === 'nest' && (
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
                        {type === 'nest' ? (
                          <>
                            {activeTab === 'active' ? (
                              <>
                                <button 
                                  onClick={(e) => handleOpenHatchlingModal(e, item.id)}
                                  className="p-2 hover:bg-emerald-500/10 text-emerald-500 rounded-lg transition-all"
                                  title="Log Emerging Hatchlings"
                                >
                                  <span className="material-symbols-outlined text-xl">child_care</span>
                                </button>
                                {item.status !== 'HATCHED' && (
                                  <button 
                                    onClick={(e) => handleAddInventory(e, item.id)}
                                    className="p-2 hover:bg-amber-500/10 text-amber-500 rounded-lg transition-all"
                                    title="Nest Inventory Entry"
                                  >
                                    <span className="material-symbols-outlined text-xl">inventory_2</span>
                                  </button>
                                )}
                                {item.status === 'HATCHED' && (
                                  <button 
                                    onClick={(e) => handleArchive(e, item.id)}
                                    className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-all"
                                    title="Archive Nest"
                                  >
                                    <span className="material-symbols-outlined text-xl">archive</span>
                                  </button>
                                )}
                              </>
                            ) : (
                              <button 
                                onClick={(e) => handleUnarchive(e, item.id)}
                                className="p-2 hover:bg-blue-500/10 text-blue-500 rounded-lg transition-all"
                                title="Unarchive Nest"
                              >
                                <span className="material-symbols-outlined text-xl">unarchive</span>
                              </button>
                            )}
                            <button className="bg-primary/10 hover:bg-primary text-primary hover:text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all border border-primary/20">
                              Details
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onSelectTurtle?.(String(item.id)); }}
                            className="bg-primary/10 hover:bg-primary text-primary hover:text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all border border-primary/20 flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">history</span>
                            View History
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedData.length === 0 && !isLoading && (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
                <span className="material-symbols-outlined text-5xl opacity-20">folder_open</span>
                <p className="text-sm font-bold uppercase tracking-widest opacity-50">No records found matching "{searchTerm}"</p>
              </div>
            )}
          </div>
          <div className="px-6 py-4 bg-slate-50 dark:bg-[#151c26] border-t border-slate-200 dark:border-[#283039] flex items-center justify-between">
            <p className="text-xs text-slate-500 font-bold">Showing {sortedData.length} records</p>
            <div className="flex gap-2">
              <button className="p-1 border border-slate-200 dark:border-[#283039] rounded hover:bg-white dark:hover:bg-[#283039] text-slate-500 disabled:opacity-50">
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <button className="p-1 border border-slate-200 dark:border-[#283039] rounded hover:bg-white dark:hover:bg-[#283039] text-slate-500">
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hatchling Data Entry Modal */}
      {hatchlingModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCloseHatchlingModal}></div>
          <div className="relative bg-[#1a232e] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <header className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3 text-primary">
                <span className="material-symbols-outlined text-2xl">child_care</span>
                <h3 className="font-black uppercase tracking-tight">Log Hatchling Tracks: {hatchlingModal.nestId}</h3>
              </div>
              <button onClick={handleCloseHatchlingModal} className="text-slate-500 hover:text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Date of Emergence</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400 text-lg">calendar_today</span>
                  <input
                    type="date"
                    value={hatchlingData.date}
                    onChange={e => setHatchlingData({...hatchlingData, date: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg h-12 pl-12 pr-4 text-white focus:ring-2 focus:ring-primary outline-none font-bold"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Successful Tracks (To Sea)</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-3 text-emerald-500 text-lg">sailing</span>
                  <input 
                    type="number" 
                    value={hatchlingData.toSea}
                    onChange={e => setHatchlingData({...hatchlingData, toSea: e.target.value})}
                    placeholder="Total tracks reaching water"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg h-12 pl-12 pr-4 text-white focus:ring-2 focus:ring-primary outline-none font-bold"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Unsuccessful / Lost</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-3 text-amber-500 text-lg">warning</span>
                  <input 
                    type="number" 
                    value={hatchlingData.notMadeIt}
                    onChange={e => setHatchlingData({...hatchlingData, notMadeIt: e.target.value})}
                    placeholder="Disoriented or predated"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg h-12 pl-12 pr-4 text-white focus:ring-2 focus:ring-primary outline-none font-bold"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic leading-tight">
                * Emerging data helps calculate the Success Rate of the current nesting season for this specific sector.
              </p>
            </div>
            <footer className="p-4 bg-white/5 border-t border-white/5 flex justify-end gap-3">
              <button 
                onClick={handleCloseHatchlingModal}
                className="px-4 py-2 text-xs font-black uppercase text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveHatchlingData}
                disabled={!hatchlingData.toSea || !hatchlingData.date || isSubmittingHatchling}
                className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-black uppercase shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {isSubmittingHatchling ? 'Saving...' : 'Submit Records'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default Records;
