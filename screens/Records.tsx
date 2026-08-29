
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Plus, 
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
  AlertTriangle,
  CheckCircle2,
  Menu,
  Filter,
  RefreshCw,
  Download,
  Trash2,
  Pencil
} from 'lucide-react';
import { AppView, NestRecord, TurtleRecord, User, EmergenceRecord } from '../types';
import { DatabaseConnection, NestEventData, apiFetch } from '../services/Database';
import { API_URL } from '../services/Database';
import { getCommonSpeciesName, downloadCsv, daysBetween } from '../lib/utils';
import { saveCache, loadCache } from '../lib/offlineCache';
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
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null;
type TabType = 'active' | 'archived' | 'emergence';

// The offline cache stores the RAW API payloads (not these mapped shapes) so
// that every screen reading the same endpoint - Dashboard, Nest Map, the
// Tagging Entry turtle picker - can fall back on a cache warmed by any of the
// others. That means mapping has to run on the cache-fallback path too, hence
// these live at module scope rather than inline in fetchData.
const mapNests = (rawNests: any[]): NestRecord[] => rawNests.map((n: any) => {
    const laidDate = new Date(n.date_laid || n.date_found);
    const diffDays = Math.max(0, daysBetween(laidDate, new Date()) ?? 0);

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

const mapTurtles = (rawTurtles: any[]): TurtleRecord[] => rawTurtles.map((t: any) => ({
    id: t.id,
    tagId: t.front_left_tag || t.front_right_tag || t.rear_left_tag || t.rear_right_tag || `ID-${t.id}`,
    name: t.name || 'Unnamed',
    species: t.species,
    // Use updated_at or created_at for Last Seen date
    lastSeen: new Date(t.updated_at || t.created_at).toLocaleDateString(),
    location: '', // DB doesn't provide location in get endpoint
    weight: 0
}));

const Records: React.FC<RecordsProps> = ({ type, onNavigate, onSelectNest, onInventoryNest, onSelectTurtle, theme = 'light', user, isSidebarOpen, onToggleSidebar }) => {
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
  const [statusFilterModal, setStatusFilterModal] = useState({ isOpen: false });
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateFilterModal, setDateFilterModal] = useState({ isOpen: false });
  const [dateRange, setDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });
  
  useEffect(() => {
    apiFetch(`${API_URL}/beaches`)
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
  const [loadError, setLoadError] = useState<string | null>(null);
  // Set when the list on screen came from the offline cache instead of a
  // fresh fetch, so the UI can say so instead of pretending it's live.
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  // Guards against a slower, stale request (e.g. from rapid navigation away
  // and back) resolving after a newer one and clobbering fresh state with
  // old data or an unrelated error.
  const fetchIdRef = useRef(0);

  // The phone-width "swipe for more" hint used to sit there permanently, still
  // pointing right after the last column was already on screen. It now tracks
  // the actual horizontal scroll position and hides once there is nothing left
  // to reveal.
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [hasHiddenColumns, setHasHiddenColumns] = useState(false);

  const [hatchlingModal, setHatchlingModal] = useState<{ isOpen: boolean, nestId: string | null }>({
    isOpen: false,
    nestId: null
  });
  const [isSubmittingHatchling, setIsSubmittingHatchling] = useState(false);
  const [hatchlingSuccess, setHatchlingSuccess] = useState(false);
  const [hatchlingError, setHatchlingError] = useState<string | null>(null);
  const [emergenceDetailsModal, setEmergenceDetailsModal] = useState<{ isOpen: boolean, emergence: EmergenceRecord | null }>({
    isOpen: false,
    emergence: null
  });
  // An emergence filed straight from a Morning Survey isn't attached to a nest,
  // so the nest detail page - the only other place one can be corrected - never
  // shows it. Without this the record is read-only for good, and a fat-fingered
  // distance or beach can only be fixed in the database.
  const [emergenceEditForm, setEmergenceEditForm] = useState<Record<string, string>>({});
  const [isEditingEmergence, setIsEditingEmergence] = useState(false);
  const [isSavingEmergence, setIsSavingEmergence] = useState(false);
  const [emergenceEditError, setEmergenceEditError] = useState<string | null>(null);
  // Deleting is permanent and hits the live season's data, so it goes through a
  // confirmation naming the exact record rather than a bare icon click.
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    kind: 'turtle' | 'emergence';
    id: string;
    label: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hatchlingData, setHatchlingData] = useState({ 
    toSea: '', 
    notMadeIt: '', 
    date: new Date().toISOString().split('T')[0] 
  });
  const seedEmergenceEditForm = (emergence: EmergenceRecord) => {
    setEmergenceEditForm({
      // The date input wants yyyy-mm-dd; the API returns a full timestamp.
      event_date: emergence.event_date ? new Date(emergence.event_date).toISOString().split('T')[0] : '',
      beach: emergence.beach ?? '',
      distance_to_sea_s: emergence.distance_to_sea_s?.toString() ?? '',
      gps_lat: emergence.gps_lat?.toString() ?? '',
      gps_long: emergence.gps_long?.toString() ?? '',
    });
  };

  const closeEmergenceDetails = () => {
    if (isSavingEmergence) return;
    setEmergenceDetailsModal({ isOpen: false, emergence: null });
    setIsEditingEmergence(false);
    setEmergenceEditError(null);
  };

  const handleViewEmergenceDetails = async (item: any) => {
    try {
      const response = await apiFetch(`${API_URL}/emergences/${item.id}`);
      if (!response.ok) throw new Error('Failed to fetch emergence details');
      const data = await response.json();
      setEmergenceDetailsModal({ isOpen: true, emergence: data.emergence });
      seedEmergenceEditForm(data.emergence);
      setIsEditingEmergence(false);
      setEmergenceEditError(null);
    } catch (err) {
      console.error("Error fetching emergence details:", err);
    }
  };

  const handleSaveEmergence = async () => {
    const emergence = emergenceDetailsModal.emergence;
    if (!emergence) return;

    const asNumber = (value: string) => {
      const trimmed = value.trim();
      if (trimmed === '') return null;
      const parsed = Number(trimmed);
      return isNaN(parsed) ? null : parsed;
    };

    setIsSavingEmergence(true);
    setEmergenceEditError(null);
    try {
      const updates = {
        event_date: emergenceEditForm.event_date || null,
        beach: emergenceEditForm.beach?.trim() || null,
        distance_to_sea_s: asNumber(emergenceEditForm.distance_to_sea_s || ''),
        gps_lat: asNumber(emergenceEditForm.gps_lat || ''),
        gps_long: asNumber(emergenceEditForm.gps_long || ''),
      };

      const response = await DatabaseConnection.updateEmergence(emergence.id, updates);
      const saved = { ...emergence, ...(response.emergence || updates) } as EmergenceRecord;

      setEmergenceDetailsModal({ isOpen: true, emergence: saved });
      seedEmergenceEditForm(saved);
      setIsEditingEmergence(false);
      // Keep the row behind the modal in step with what was just saved.
      setEmergences(prev => prev.map(e => (e.id === saved.id ? { ...e, ...saved } : e)));
    } catch (err: any) {
      setEmergenceEditError(err?.message || 'Failed to save changes.');
    } finally {
      setIsSavingEmergence(false);
    }
  };

  // Fetch Data
  const fetchData = React.useCallback(async () => {
    const requestId = ++fetchIdRef.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      if (type === 'nest') {
          const rawNests = await DatabaseConnection.getNests();
          const rawEmergences = await DatabaseConnection.getEmergences();
          if (requestId !== fetchIdRef.current) return; // a newer request has since started
          setNests(mapNests(rawNests));
          setEmergences(rawEmergences);
          setCachedAt(null);
          saveCache('nests_raw', rawNests);
          saveCache('emergences', rawEmergences);
      } else if (type === 'turtle') {
          const rawTurtles = await DatabaseConnection.getTurtles();
          if (requestId !== fetchIdRef.current) return;
          setTurtles(mapTurtles(rawTurtles));
          setCachedAt(null);
          saveCache('turtles_raw', rawTurtles);
      } else if (type === 'emergence') {
          const rawEmergences = await DatabaseConnection.getEmergences();
          if (requestId !== fetchIdRef.current) return;
          setEmergences(rawEmergences);
          setCachedAt(null);
          saveCache('emergences', rawEmergences);
      }
    } catch (err) {
      console.error("Failed to load records", err);
      if (requestId !== fetchIdRef.current) return;

      // Offline (or the backend is unreachable) - fall back to whatever was
      // last successfully loaded rather than showing an empty, dead-end error.
      const noCache = () => {
        setLoadError("Failed to load records. Please check your connection and try again.");
        setCachedAt(null);
      };

      if (type === 'nest') {
        const cachedNests = loadCache<any[]>('nests_raw');
        const cachedEmergences = loadCache<EmergenceRecord[]>('emergences');
        if (cachedNests) {
          setNests(mapNests(cachedNests.data));
          if (cachedEmergences) setEmergences(cachedEmergences.data);
          setLoadError(null);
          setCachedAt(cachedNests.cachedAt);
        } else {
          noCache();
        }
      } else if (type === 'turtle') {
        const cachedTurtles = loadCache<any[]>('turtles_raw');
        if (cachedTurtles) {
          setTurtles(mapTurtles(cachedTurtles.data));
          setLoadError(null);
          setCachedAt(cachedTurtles.cachedAt);
        } else {
          noCache();
        }
      } else {
        const cachedEmergences = loadCache<EmergenceRecord[]>('emergences');
        if (cachedEmergences) {
          setEmergences(cachedEmergences.data);
          setLoadError(null);
          setCachedAt(cachedEmergences.cachedAt);
        } else {
          noCache();
        }
      }
    } finally {
      if (requestId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [type]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      if (deleteModal.kind === 'turtle') {
        await DatabaseConnection.deleteTurtle(deleteModal.id);
        setTurtles(prev => prev.filter(t => String(t.id) !== deleteModal.id));
      } else {
        await DatabaseConnection.deleteEmergence(deleteModal.id);
        setEmergences(prev => prev.filter(em => String(em.id) !== deleteModal.id));
      }
      setDeleteModal(null);
    } catch (err: any) {
      // Kept open so the reason stays on screen — most often the backend
      // refusing because the emergence still belongs to a nest.
      setDeleteError(err?.message || 'Failed to delete record.');
    } finally {
      setIsDeleting(false);
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

  const allStatuses = useMemo(() => {
    if (type !== 'nest') return [];
    const statuses = new Set(nests.map(n => n.status).filter(Boolean));
    return Array.from(statuses).sort();
  }, [nests, type]);

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
                // Species is matched on the common name shown in the table
                // ("Loggerhead"), not the stored scientific name - typing what
                // is on screen used to return nothing, which read as a bug.
                const commonSpecies = item.species ? getCommonSpeciesName(item.species).toLowerCase() : '';
                return (item.tagId && item.tagId.toLowerCase().includes(lowerTerm)) ||
                       (item.name && item.name.toLowerCase().includes(lowerTerm)) ||
                       (item.id && String(item.id).includes(lowerTerm)) ||
                       commonSpecies.includes(lowerTerm) ||
                       (item.species && String(item.species).toLowerCase().includes(lowerTerm));
            } else {
                return (item.beach && item.beach.toLowerCase().includes(lowerTerm)) ||
                       (String(item.id).includes(lowerTerm));
            }
        });
    }

    // Filter by beach
    if (type === 'nest' && selectedBeaches.length > 0) {
        if (activeTab === 'emergence') {
            data = data.filter((item: any) => selectedBeaches.includes(item.beach));
        } else {
            data = data.filter((item: any) => selectedBeaches.includes(item.location));
        }
    }

    // Filter by status
    if (type === 'nest' && activeTab !== 'emergence' && selectedStatuses.length > 0) {
        data = data.filter((item: any) => selectedStatuses.includes(item.status));
    }

    // Filter by date
    if (dateRange.start || dateRange.end) {
        const start = dateRange.start ? new Date(dateRange.start).getTime() : 0;
        const end = dateRange.end ? new Date(dateRange.end).getTime() + 86400000 - 1 : Infinity; // End of the selected day

        data = data.filter((item: any) => {
            let itemDate = 0;
            if (type === 'nest') {
                if (activeTab === 'emergence') {
                    itemDate = new Date(item.event_date).getTime();
                } else {
                    itemDate = item.laidTimestamp;
                }
            } else if (type === 'turtle') {
                itemDate = new Date(item.lastSeen).getTime();
            }
            return itemDate >= start && itemDate <= end;
        });
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
  }, [type, sortConfig, activeTab, nests, turtles, searchTerm, selectedBeaches, selectedStatuses, dateRange]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;

    const update = () => {
      // A pixel of slack: sub-pixel column widths mean scrollLeft never lands
      // exactly on the maximum, which would keep the hint up forever.
      setHasHiddenColumns(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [sortedData.length, type, activeTab, isLoading]);

  const handleExportCsv = () => {
    if (sortedData.length === 0) return;
    const dateStamp = new Date().toISOString().split('T')[0];

    let rows: Record<string, any>[];
    let filename: string;

    if (type === 'nest' && activeTab === 'emergence') {
      rows = (sortedData as any[]).map((e) => ({
        emergence_id: e.id,
        beach: e.beach,
        event_date: e.event_date,
        gps_lat: e.gps_lat,
        gps_long: e.gps_long,
        distance_to_sea_s: e.distance_to_sea_s,
      }));
      filename = `emergences_${dateStamp}.csv`;
    } else if (type === 'nest') {
      rows = (sortedData as any[]).map((n) => ({
        nest_id: n.id,
        beach: n.location,
        date_laid: new Date(n.laidTimestamp).toISOString().split('T')[0],
        incubation_days: n.incubationDays,
        species: getCommonSpeciesName(n.species),
        status: n.status,
        archived: !!n.isArchived,
      }));
      filename = `nests_${activeTab}_${dateStamp}.csv`;
    } else {
      rows = (sortedData as any[]).map((t) => ({
        turtle_id: t.id,
        name: t.name,
        tag_id: t.tagId,
        species: getCommonSpeciesName(t.species),
        last_seen: t.lastSeen,
      }));
      filename = `turtles_${dateStamp}.csv`;
    }

    downloadCsv(filename, rows);
  };

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
    setHatchlingSuccess(false);
    setHatchlingError(null);
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
      
      setHatchlingSuccess(true);
      setTimeout(() => {
        handleCloseHatchlingModal();
      }, 1500);
    } catch (err: any) {
      console.error("Failed to save hatchling data:", err);
      setHatchlingError(err.message || "Unknown error");
    } finally {
      setIsSubmittingHatchling(false);
    }
  };

  const handleAddInventory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onInventoryNest) onInventoryNest(id);
  };

  const isHatchlingDataValid = hatchlingData.date && (hatchlingData.toSea.trim() !== '' || hatchlingData.notMadeIt.trim() !== '');

  return (
    <div className={`flex flex-col min-h-full relative ${theme === 'dark' ? 'bg-background-dark' : 'bg-background-light'}`}>
      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col gap-4">
          {/* Volunteers have read-only access to records: creating and exporting
              are hidden for them rather than shown disabled. */}
          {user.role !== 'Field Volunteer' && (
            <div className="flex justify-start items-center gap-3">
              {type === 'nest' ? (
                  <Button
                    onClick={() => onNavigate(AppView.NEST_ENTRY)}
                    icon={<Plus className="size-4" />}
                  >
                    New Nest
                  </Button>
              ) : (
                  <Button
                    onClick={() => onNavigate(AppView.TAGGING_ENTRY)}
                    icon={<Plus className="size-4" />}
                  >
                    New Turtle
                  </Button>
              )}
              <Button
                variant="outline"
                onClick={handleExportCsv}
                disabled={sortedData.length === 0}
                icon={<Download className="size-4" />}
                title="Export the currently filtered rows as CSV"
              >
                Export CSV
              </Button>
            </div>
          )}
          
          {/* Search Input */}
          <div className="w-full md:w-96">
            <Input
              placeholder={type === 'nest' ? "Search Nest ID or Location..." : "Search Tag ID, Name, Species..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="size-4" />}
            />
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

        {cachedAt && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 text-xs font-bold">
            <AlertCircle className="size-4 shrink-0" />
            <span>Offline — showing saved data from {new Date(cachedAt).toLocaleString()}.</span>
            <Button variant="outline" size="sm" onClick={() => fetchData()} icon={<RefreshCw className="size-3" />} className="ml-auto shrink-0">
              Retry
            </Button>
          </div>
        )}

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {hasHiddenColumns && (
              <div className={`md:hidden flex items-center justify-end gap-1 px-4 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Swipe for more <ChevronRight className="size-3" />
              </div>
            )}
            <div ref={tableScrollRef} className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[900px] text-left border-collapse">
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
                    <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('date')}>
                          Date Laid <SortIcon column="date" />
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDateFilterModal({ isOpen: true }); }}
                          className={`p-1.5 rounded transition-colors ${dateRange.start || dateRange.end ? 'bg-primary text-white shadow-sm' : theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 bg-slate-800/50' : 'hover:bg-slate-200 text-slate-500 bg-slate-100'}`}
                          title="Filter by Date"
                        >
                          <Filter className="size-3" />
                        </button>
                      </div>
                    </th>
                  ) : type === 'nest' && activeTab === 'emergence' ? (
                    <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('event_date')}>
                          Date <SortIcon column="event_date" />
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDateFilterModal({ isOpen: true }); }}
                          className={`p-1.5 rounded transition-colors ${dateRange.start || dateRange.end ? 'bg-primary text-white shadow-sm' : theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 bg-slate-800/50' : 'hover:bg-slate-200 text-slate-500 bg-slate-100'}`}
                          title="Filter by Date"
                        >
                          <Filter className="size-3" />
                        </button>
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
                  <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => handleSort(type === 'nest' && activeTab !== 'emergence' ? 'location' : type === 'nest' && activeTab === 'emergence' ? 'beach' : 'lastSeen')}
                      >
                        {type === 'nest' ? 'Beach' : 'Last Seen'}
                        <SortIcon column={type === 'nest' && activeTab !== 'emergence' ? 'location' : type === 'nest' && activeTab === 'emergence' ? 'beach' : 'lastSeen'} />
                      </div>
                      {type === 'nest' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setBeachFilterModal({ isOpen: true }); }}
                          className={`p-1.5 rounded transition-colors ${selectedBeaches.length > 0 ? 'bg-primary text-white shadow-sm' : theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 bg-slate-800/50' : 'hover:bg-slate-200 text-slate-500 bg-slate-100'}`}
                          title="Filter by Beach"
                        >
                          <Filter className="size-3" />
                        </button>
                      )}
                    </div>
                  </th>
                  {type === 'nest' && activeTab !== 'emergence' && (
                    <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('status')}>
                          Status <SortIcon column="status" />
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setStatusFilterModal({ isOpen: true }); }}
                          className={`p-1.5 rounded transition-colors ${selectedStatuses.length > 0 ? 'bg-primary text-white shadow-sm' : theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 bg-slate-800/50' : 'hover:bg-slate-200 text-slate-500 bg-slate-100'}`}
                          title="Filter by Status"
                        >
                          <Filter className="size-3" />
                        </button>
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
                      <div
                        className="font-bold text-sm text-primary cursor-pointer hover:underline w-fit"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (type === 'turtle') onSelectTurtle?.(String(item.id));
                          else if (activeTab === 'emergence') handleViewEmergenceDetails(item);
                          else onSelectNest?.(String(item.id));
                        }}
                      >
                        {item.id}
                      </div>
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
                          (getCommonSpeciesName(item.species) === 'Green')
                            ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-500 ring-amber-500/20'
                        }`}>
                          {getCommonSpeciesName(item.species)}
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
                                    className="bg-green-500/10 hover:bg-green-500/20"
                                    title="Log Emerging Hatchlings"
                                  >
                                    <Baby className="size-5 text-green-600 dark:text-green-400" />
                                  </Button>
                                )}
                                {item.status !== 'HATCHED' && user.role !== 'Field Volunteer' && (
                                  <Button 
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => handleAddInventory(e, item.id)}
                                    className="bg-orange-500/10 hover:bg-orange-500/20"
                                    title="Nest Inventory Entry"
                                  >
                                    <Package className="size-5 text-orange-600 dark:text-orange-400" />
                                  </Button>
                                )}
                                {item.status === 'HATCHED' && user.role !== 'Field Volunteer' && (
                                  <Button 
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => handleArchive(e, item.id)}
                                    className="bg-primary/10 text-primary hover:bg-primary/20"
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
                                className="bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                                title="Unarchive Nest"
                                disabled={user.role === 'Field Volunteer'}
                              >
                                <ArchiveRestore className="size-5" />
                              </Button>
                            )}
                            <Button 
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); onSelectNest?.(String(item.id)); }}
                              icon={<History className="size-3" />}
                              className="bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 whitespace-nowrap shrink-0"
                            >
                              Details
                            </Button>
                          </>
                        ) : type === 'nest' && activeTab === 'emergence' ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); handleViewEmergenceDetails(item); }}
                              icon={<History className="size-3" />}
                              className="bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 whitespace-nowrap shrink-0"
                            >
                              Details
                            </Button>
                            {user.role !== 'Field Volunteer' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteError(null);
                                  setDeleteModal({
                                    isOpen: true,
                                    kind: 'emergence',
                                    id: String(item.id),
                                    label: `Emergence #${item.id}${item.beach ? ` — ${item.beach}` : ''}`
                                  });
                                }}
                                className="bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 shrink-0"
                                title="Delete Emergence"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); onSelectTurtle?.(String(item.id)); }}
                              icon={<History className="size-3" />}
                              className="bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 whitespace-nowrap shrink-0"
                            >
                              View Details
                            </Button>
                            {user.role !== 'Field Volunteer' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteError(null);
                                  setDeleteModal({
                                    isOpen: true,
                                    kind: 'turtle',
                                    id: String(item.id),
                                    label: item.name ? `${item.name} (#${item.id})` : `Turtle #${item.id}`
                                  });
                                }}
                                className="bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 shrink-0"
                                title="Delete Turtle Record"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedData.length === 0 && !isLoading && loadError && (
              <div className="py-20 flex flex-col items-center justify-center text-rose-500 gap-3">
                <AlertTriangle className="size-12 opacity-50" />
                <p className="text-sm font-bold uppercase tracking-widest">{loadError}</p>
                <Button variant="outline" size="sm" onClick={() => fetchData()} icon={<RefreshCw className="size-3" />}>
                  Retry
                </Button>
              </div>
            )}
            {sortedData.length === 0 && !isLoading && !loadError && (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
                <FolderOpen className="size-12 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest opacity-50">
                  {searchTerm ? `No records found matching "${searchTerm}"` : 'No records found.'}
                </p>
              </div>
            )}
          </div>
          {/* No pager: the table renders every filtered row on one page. The
              prev/next arrows that used to sit here were never wired to
              anything, so they looked enabled and did nothing. */}
          <div className={`px-6 py-4 border-t ${theme === 'dark' ? 'bg-[#151c26] border-[#283039]' : 'bg-slate-50 border-slate-200'}`}>
            {/* "Showing 0 records" under a loading spinner reads as an empty
                table rather than one that hasn't arrived yet. */}
            <HelperText className="font-bold">
              {isLoading ? 'Loading records…' : `Showing ${sortedData.length} records`}
            </HelperText>
          </div>
        </CardContent>
      </Card>
    </div>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => { if (!isDeleting) { setDeleteModal(null); setDeleteError(null); } }}
        title={deleteModal?.kind === 'turtle' ? 'Delete turtle record?' : 'Delete emergence record?'}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setDeleteModal(null); setDeleteError(null); }} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-rose-500 hover:bg-rose-600 text-white border-transparent"
            >
              {isDeleting ? 'Deleting...' : 'Delete permanently'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <BodyText>
            <span className="font-bold">{deleteModal?.label}</span> will be removed from the
            season's records. This cannot be undone.
          </BodyText>
          {deleteModal?.kind === 'turtle' && (
            <HelperText>
              Any survey events recorded against this turtle are deleted with it.
            </HelperText>
          )}
          {deleteError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span className="text-xs font-bold">{deleteError}</span>
            </div>
          )}
        </div>
      </Modal>

      {/* Hatchling Data Entry Modal */}
      <Modal
        isOpen={hatchlingModal.isOpen}
        onClose={handleCloseHatchlingModal}
        title={`Log Hatchling Tracks: ${hatchlingModal.nestId}`}
        footer={
          <>
            <Button variant="ghost" onClick={handleCloseHatchlingModal} disabled={isSubmittingHatchling}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveHatchlingData}
              disabled={!isHatchlingDataValid || isSubmittingHatchling || hatchlingSuccess}
              className={`w-36 ${hatchlingSuccess ? 'disabled:opacity-100 bg-emerald-500 text-white border-transparent' : ''}`}
            >
              {hatchlingSuccess ? 'Saved!' : 'Submit Records'}
            </Button>
          </>
        }
      >
        <div className="relative space-y-6">
          {isSubmittingHatchling && (
            <div className="absolute inset-0 z-10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-2">
                <div className="size-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                <span className="text-xs font-bold uppercase tracking-widest text-primary">Saving Data...</span>
              </div>
            </div>
          )}
          {hatchlingSuccess && (
            <div className="absolute inset-0 z-10 bg-emerald-50/90 dark:bg-emerald-900/40 backdrop-blur-[1px] flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-2">
                <div className="size-10 bg-emerald-500 text-white rounded-full flex items-center justify-center">
                  <CheckCircle2 className="size-6" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Success!</span>
              </div>
            </div>
          )}
          {hatchlingError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-rose-600">
              <AlertCircle className="size-5 shrink-0" />
              <p className="text-xs font-medium">{hatchlingError}</p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date of Emergence</label>
            <input
              type="date"
              value={hatchlingData.date}
              onChange={e => setHatchlingData({...hatchlingData, date: e.target.value})}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">To Sea</label>
              <input
                type="number"
                value={hatchlingData.toSea}
                onChange={e => setHatchlingData({...hatchlingData, toSea: e.target.value})}
                placeholder="0"
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Lost</label>
              <input
                type="number"
                value={hatchlingData.notMadeIt}
                onChange={e => setHatchlingData({...hatchlingData, notMadeIt: e.target.value})}
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

      {/* Emergence Details Modal */}
      <Modal
        isOpen={emergenceDetailsModal.isOpen && !!emergenceDetailsModal.emergence}
        onClose={closeEmergenceDetails}
        title={`${isEditingEmergence ? 'Edit ' : ''}Emergence ${emergenceDetailsModal.emergence?.id}`}
        footer={
          user.role !== 'Field Volunteer' ? (
            isEditingEmergence ? (
              <>
                <Button
                  variant="ghost"
                  disabled={isSavingEmergence}
                  onClick={() => {
                    if (emergenceDetailsModal.emergence) seedEmergenceEditForm(emergenceDetailsModal.emergence);
                    setIsEditingEmergence(false);
                    setEmergenceEditError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveEmergence} isLoading={isSavingEmergence} disabled={isSavingEmergence}>
                  Save changes
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                icon={<Pencil className="size-4" />}
                onClick={() => setIsEditingEmergence(true)}
              >
                Edit record
              </Button>
            )
          ) : undefined
        }
      >
        {emergenceDetailsModal.emergence && (
          <div className="space-y-6">
            {isEditingEmergence ? (
              /* Only the five fields the update route writes; the track sketch
                 and the survey it came from aren't editable here. */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={emergenceEditForm.event_date || ''}
                    onChange={(e) => setEmergenceEditForm({ ...emergenceEditForm, event_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Beach</Label>
                  <Input
                    value={emergenceEditForm.beach || ''}
                    onChange={(e) => setEmergenceEditForm({ ...emergenceEditForm, beach: e.target.value })}
                    placeholder="Beach name"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Distance to Sea (m)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={emergenceEditForm.distance_to_sea_s || ''}
                    onChange={(e) => setEmergenceEditForm({ ...emergenceEditForm, distance_to_sea_s: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label>GPS Lat</Label>
                  <Input
                    type="number"
                    step="0.00001"
                    value={emergenceEditForm.gps_lat || ''}
                    onChange={(e) => setEmergenceEditForm({ ...emergenceEditForm, gps_lat: e.target.value })}
                    placeholder="38.17500"
                  />
                </div>
                <div className="space-y-1">
                  <Label>GPS Long</Label>
                  <Input
                    type="number"
                    step="0.00001"
                    value={emergenceEditForm.gps_long || ''}
                    onChange={(e) => setEmergenceEditForm({ ...emergenceEditForm, gps_long: e.target.value })}
                    placeholder="20.56900"
                  />
                </div>
              </div>
            ) : (
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
            )}

            {emergenceEditError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span className="text-xs font-bold">{emergenceEditError}</span>
              </div>
            )}

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

      {/* Beach Filter Modal - uses the shared Modal so the dialog stays inside
          the viewport (capped height, body scrolls) on short mobile screens
          instead of growing until its header is pushed off the top. */}
      <Modal
        isOpen={beachFilterModal.isOpen}
        onClose={() => setBeachFilterModal({ isOpen: false })}
        title="Filter by Beach"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelectedBeaches([])}>Clear</Button>
            <Button onClick={() => setBeachFilterModal({ isOpen: false })}>Apply</Button>
          </>
        }
      >
            <div className="space-y-5">
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
      </Modal>

      {/* Status Filter Modal */}
      <Modal
        isOpen={statusFilterModal.isOpen}
        onClose={() => setStatusFilterModal({ isOpen: false })}
        title="Filter by Status"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelectedStatuses([])}>Clear</Button>
            <Button onClick={() => setStatusFilterModal({ isOpen: false })}>Apply</Button>
          </>
        }
      >
            <div className="space-y-5">
              <div className="space-y-2">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Select Statuses</h3>
                <div className={`max-h-60 overflow-y-auto p-2 rounded-xl border ${theme === 'dark' ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                  {allStatuses.map((status: any) => (
                    <label key={status} className="flex items-center gap-3 p-2 rounded-lg hover:bg-primary/5 cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={selectedStatuses.includes(status)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedStatuses([...selectedStatuses, status]);
                          else setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                        }}
                        className="size-5 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <span className={`font-bold text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{status}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
      </Modal>

      {/* Date Filter Modal */}
      <Modal
        isOpen={dateFilterModal.isOpen}
        onClose={() => setDateFilterModal({ isOpen: false })}
        title="Filter by Date"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDateRange({ start: '', end: '' })}>Clear</Button>
            <Button onClick={() => setDateFilterModal({ isOpen: false })}>Apply</Button>
          </>
        }
      >
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Start Date</label>
                <input 
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className={`w-full p-3 rounded-xl border font-bold transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white focus:ring-2 focus:ring-primary/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-2 focus:ring-primary/20'}`}
                />
              </div>
              <div className="space-y-1.5">
                <label className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>End Date</label>
                <input 
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className={`w-full p-3 rounded-xl border font-bold transition-all ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white focus:ring-2 focus:ring-primary/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-2 focus:ring-primary/20'}`}
                />
              </div>
            </div>
      </Modal>
    </div>
  );
};

export default Records;
