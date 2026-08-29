
import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft,
  Tag,
  Fingerprint, 
  Users, 
  Calendar, 
  Eye, 
  MapPin, 
  Heart, 
  Ruler, 
  History, 
  ExternalLink, 
  StickyNote, 
  BarChart3, 
  X,
  Trash2,
  Edit
} from 'lucide-react';
import { User } from '../types';
import {
  getCommonSpeciesName,
  normalizeSpeciesValue,
  SPECIES_OPTIONS,
  parseTagNumber,
  stripTagPrefix,
  TAG_PREFIX,
} from '../lib/utils';
import { DatabaseConnection } from '../services/Database';
import { TurtleSilhouette } from '../components/ui/TurtleSilhouette';

const editInputClass =
  'w-full border rounded-lg px-3 py-2 text-sm font-bold outline-none transition-all ' +
  'focus:ring-2 focus:ring-primary/50 ' +
  'bg-slate-50 dark:bg-background-dark border-slate-200 dark:border-border-dark ' +
  'text-slate-900 dark:text-white';

const editLabelClass =
  'block text-[10px] font-black uppercase tracking-widest text-slate-500';

interface TurtleDetailsProps {
  id: string; // This is now the turtle.id (primary key) from Records
  onBack: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  user: User | null;
}

interface MeasurementSet {
  sclMax?: number;
  sclMin?: number;
  scw?: number;
  cclMax?: number;
  cclMin?: number;
  ccw?: number;
  tailExtension?: number;
  ventToTip?: number;
  totalTail?: number;
}

interface TagData {
  id: string;
  address?: string;
}

interface TagSet {
  fl_l?: TagData;
  fl_r?: TagData;
  rr_l?: TagData;
  rr_r?: TagData;
  microchip?: {
    number: string;
    location: string;
  };
}

interface TurtleHistoryEvent {
  id: string;
  date: string;
  rawDate: string; // ISO-parseable source date, kept alongside the display-formatted `date`
  type: 'TAGGING' | 'NIGHT_SURVEY';
  location: string;
  observer: string;
  measurements: MeasurementSet;
  notes?: string;
  tags?: TagSet;
}

interface TurtleMeta {
  name: string;
  species: string;
  turtle_id: string | number;
  health_condition: string;
  sex?: string;
  measurements?: MeasurementSet;
  tags?: TagSet;
}

const TurtleDetails: React.FC<TurtleDetailsProps> = ({ id, onBack, isSidebarOpen, onToggleSidebar, user }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // Bumped after a save so the loader re-runs and the page shows stored values
  // rather than what was typed — the backend is the authority on what landed.
  const [refreshKey, setRefreshKey] = useState(0);

  // The nine morphometrics the update route treats as required, in the order
  // they are recorded on the tagging form.
  const MEASUREMENT_FIELDS: { key: string; label: string }[] = [
    { key: 'scl_max', label: 'SCL Max' },
    { key: 'scl_min', label: 'SCL Min' },
    { key: 'scw', label: 'SCW' },
    { key: 'ccl_max', label: 'CCL Max' },
    { key: 'ccl_min', label: 'CCL Min' },
    { key: 'ccw', label: 'CCW' },
    { key: 'tail_extension', label: 'Tail Extension' },
    { key: 'vent_to_tail_tip', label: 'Vent to Tip' },
    { key: 'total_tail_length', label: 'Total Tail' },
  ];

  const TAG_FIELDS: { prefix: string; label: string }[] = [
    { prefix: 'front_left', label: 'Front Left' },
    { prefix: 'front_right', label: 'Front Right' },
    { prefix: 'rear_left', label: 'Rear Left' },
    { prefix: 'rear_right', label: 'Rear Right' },
  ];

  const openEditModal = async () => {
    setEditError(null);
    setShowEditModal(true);
    try {
      // Seed from the stored record rather than from turtleMeta: the page keeps a
      // display-shaped view (camelCase measurements, tags nested), while the
      // update route wants the raw column names back.
      const res = await DatabaseConnection.getTurtle(id);
      const t = res?.turtle || {};
      const seeded: Record<string, any> = {
        name: t.name ?? '',
        species: normalizeSpeciesValue(t.species),
        sex: t.sex ?? '',
        health_condition: t.health_condition || 'Healthy',
      };
      MEASUREMENT_FIELDS.forEach(({ key }) => {
        seeded[key] = t[key] ?? '';
      });
      TAG_FIELDS.forEach(({ prefix }) => {
        seeded[`${prefix}_tag`] = t[`${prefix}_tag`] ?? '';
        seeded[`${prefix}_address`] = t[`${prefix}_address`] ?? '';
      });
      setEditForm(seeded);
    } catch (err: any) {
      setEditError(err?.message || 'Could not load this record for editing.');
    }
  };

  const handleSaveEdit = async () => {
    const missing = MEASUREMENT_FIELDS.filter(
      ({ key }) => editForm[key] === '' || editForm[key] === null || editForm[key] === undefined
    );
    if (missing.length > 0) {
      // The route rejects a partial measurement set outright, so say which ones
      // rather than letting it come back as a generic 400.
      setEditError(`Every measurement is required. Missing: ${missing.map(m => m.label).join(', ')}.`);
      return;
    }

    setIsSaving(true);
    setEditError(null);
    try {
      const payload: Record<string, any> = {
        name: editForm.name?.trim() || null,
        species: editForm.species,
        sex: editForm.sex || null,
        health_condition: editForm.health_condition,
      };
      MEASUREMENT_FIELDS.forEach(({ key }) => {
        payload[key] = Number(editForm[key]);
      });
      TAG_FIELDS.forEach(({ prefix }) => {
        const digits = parseTagNumber(String(editForm[`${prefix}_tag`] ?? ''));
        payload[`${prefix}_tag`] = digits ? `${TAG_PREFIX}${digits}` : null;
        payload[`${prefix}_address`] = editForm[`${prefix}_address`]?.trim() || null;
      });

      await DatabaseConnection.updateTurtle(id, payload);
      setShowEditModal(false);
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await DatabaseConnection.deleteTurtle(id);
      onBack();
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete turtle record.');
    } finally {
      setIsDeleting(false);
    }
  };

  const [selectedEvent, setSelectedEvent] = useState<TurtleHistoryEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TurtleHistoryEvent[]>([]);
  const [turtleMeta, setTurtleMeta] = useState<TurtleMeta>({
    name: 'Loading...',
    species: '',
    turtle_id: id,
    health_condition: 'Unknown',
    sex: 'Unknown'
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch both specific turtle info and its event history
        const [turtleResponse, eventsResponse] = await Promise.all([
            DatabaseConnection.getTurtle(id),
            DatabaseConnection.getTurtleSurveyEvents(id)
        ]);
        
        // 1. Set Meta from Turtle Table Source (Endpoint: /turtles/:id)
        if (turtleResponse && turtleResponse.turtle) {
            const t = turtleResponse.turtle;
            setTurtleMeta({
                name: t.name || 'Unnamed Turtle',
                species: t.species || 'Unknown',
                turtle_id: t.id,
                health_condition: t.health_condition || 'Unknown',
                sex: t.sex || 'Unknown',
                measurements: {
                    sclMax: t.scl_max ? Number(t.scl_max) : undefined,
                    sclMin: t.scl_min ? Number(t.scl_min) : undefined,
                    scw: t.scw ? Number(t.scw) : undefined,
                    cclMax: t.ccl_max ? Number(t.ccl_max) : undefined,
                    cclMin: t.ccl_min ? Number(t.ccl_min) : undefined,
                    ccw: t.ccw ? Number(t.ccw) : undefined,
                    tailExtension: t.tail_extension ? Number(t.tail_extension) : undefined,
                    ventToTip: t.vent_to_tail_tip ? Number(t.vent_to_tail_tip) : undefined,
                    totalTail: t.total_tail_length ? Number(t.total_tail_length) : undefined,
                },
                tags: {
                    fl_l: t.front_left_tag ? { id: t.front_left_tag, address: t.front_left_address } : undefined,
                    fl_r: t.front_right_tag ? { id: t.front_right_tag, address: t.front_right_address } : undefined,
                    rr_l: t.rear_left_tag ? { id: t.rear_left_tag, address: t.rear_left_address } : undefined,
                    rr_r: t.rear_right_tag ? { id: t.rear_right_tag, address: t.rear_right_address } : undefined,
                }
            });
        }

        // 2. Set Events History
        if (eventsResponse && eventsResponse.events) {
          // Sort events by date descending (newest first)
          const sortedRawEvents = [...eventsResponse.events].sort((a: any, b: any) => 
            new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
          );

          const mappedEvents: TurtleHistoryEvent[] = sortedRawEvents.map((e: any) => {
            return {
              id: e.id.toString(),
              date: new Date(e.event_date).toLocaleDateString(),
              rawDate: e.event_date,
              type: e.event_type || 'TAGGING',
              location: e.location,
              observer: e.observer,
              measurements: {
                sclMax: e.scl_max ? Number(e.scl_max) : undefined,
                sclMin: e.scl_min ? Number(e.scl_min) : undefined,
                scw: e.scw ? Number(e.scw) : undefined,
                cclMax: e.ccl_max ? Number(e.ccl_max) : undefined,
                cclMin: e.ccl_min ? Number(e.ccl_min) : undefined,
                ccw: e.ccw ? Number(e.ccw) : undefined,
                tailExtension: e.tail_extension ? Number(e.tail_extension) : undefined,
                ventToTip: e.vent_to_tail_tip ? Number(e.vent_to_tail_tip) : undefined,
                totalTail: e.total_tail_length ? Number(e.total_tail_length) : undefined,
              },
              tags: {
                fl_l: e.front_left_tag ? { id: e.front_left_tag, address: e.front_left_address } : undefined,
                fl_r: e.front_right_tag ? { id: e.front_right_tag, address: e.front_right_address } : undefined,
                rr_l: e.rear_left_tag ? { id: e.rear_left_tag, address: e.rear_left_address } : undefined,
                rr_r: e.rear_right_tag ? { id: e.rear_right_tag, address: e.rear_right_address } : undefined,
              },
              notes: e.notes
            };
          });
          setEvents(mappedEvents);
        }
      } catch (err) {
        console.error("Failed to load turtle details", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) loadData();
  }, [id, refreshKey]);

  // Normalizes both scientific and legacy common-name records (any casing) to a display name.
  const commonName = getCommonSpeciesName(turtleMeta.species);

  const totalSightings = events.length;
  const notedEvents = useMemo(() => events.filter(e => e.notes), [events]);
  // First seen is now the last item in the sorted array (oldest), Last seen is the first item (newest)
  const firstSeenDate = events.length > 0 ? events[events.length - 1].date : 'N/A';
  const lastLocation = events.length > 0 ? events[0].location : 'N/A';
  
  // Find the most recent tag ID used for display title
  const currentTagId = useMemo(() => {
    if (events.length === 0) return `ID: ${id}`;
    const latest = events[0];
    return latest.tags?.fl_l?.id || latest.tags?.fl_r?.id || latest.tags?.rr_l?.id || latest.tags?.rr_r?.id || `Ref: ${id}`;
  }, [events, id]);

  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  // Real growth-and-remigration analytics derived from this turtle's actual
  // survey/tagging events, replacing the previous hardcoded placeholder stats.
  const analytics = useMemo(() => {
    const chronological = [...events]
      .filter(e => e.rawDate && !isNaN(new Date(e.rawDate).getTime()))
      .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());

    // Growth: straight carapace length is the standard field-metric; curved
    // carapace length is used as a fallback when SCL wasn't recorded.
    const growthPoints = chronological
      .map(e => {
        const length = e.measurements.sclMax ?? e.measurements.cclMax;
        return length !== undefined
          ? { date: e.date, ts: new Date(e.rawDate).getTime(), length }
          : null;
      })
      .filter((p): p is { date: string; ts: number; length: number } => p !== null);

    let growthRatePerYear: number | null = null;
    if (growthPoints.length >= 2) {
      const first = growthPoints[0];
      const last = growthPoints[growthPoints.length - 1];
      const years = (last.ts - first.ts) / (1000 * 60 * 60 * 24 * 365.25);
      if (years > 0) {
        growthRatePerYear = (last.length - first.length) / years;
      }
    }

    // Remigration: average gap between distinct sighting dates.
    const distinctDates = Array.from(new Set(chronological.map(e => e.rawDate)))
      .map(d => new Date(d).getTime())
      .sort((a, b) => a - b);

    let avgRemigrationYears: number | null = null;
    if (distinctDates.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < distinctDates.length; i++) {
        gaps.push((distinctDates[i] - distinctDates[i - 1]) / (1000 * 60 * 60 * 24 * 365.25));
      }
      avgRemigrationYears = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
    }

    return {
      growthPoints,
      growthRatePerYear,
      avgRemigrationYears,
      totalSightings: chronological.length,
      firstSighting: chronological[0]?.date ?? null,
      lastSighting: chronological[chronological.length - 1]?.date ?? null,
    };
  }, [events]);

  const getHealthColor = (condition: string) => {
    const status = condition?.toLowerCase() || '';
    if (status === 'healthy') return "text-emerald-400";
    if (status === 'injured') return "text-amber-500";
    if (status === 'lethargic') return "text-orange-500";
    if (status === 'dead') return "text-slate-500";
    return "text-slate-400";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center text-slate-900 dark:text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <span className="size-8 border-2 border-slate-300 dark:border-slate-600 border-t-primary rounded-full animate-spin"></span>
          <p className="text-xs font-bold uppercase tracking-widest">Loading Turtle Details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white">
      {/* Header */}
      {/* Stacks below the app-wide header (h-16) instead of sharing its top-0
          offset — both being pinned to the same spot caused this bar to land
          on top of whatever section had scrolled underneath it. */}
      {/* The action icons on the right must never be pushed off-screen: the
          left block is allowed to shrink and truncate (min-w-0), and the right
          block is pinned (shrink-0) with tighter spacing at phone widths. */}
      <header className="sticky top-16 z-50 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-3 sm:px-8 h-20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          {/* The app-wide header already renders a sidebar toggle; this
              screen used to render a second, redundant one on top of it. */}
          <button
            onClick={onBack}
            className={`p-2 rounded-xl transition-all border flex items-center gap-2 shrink-0 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 dark:text-white bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600`}
            title="Back to Turtle Records"
          >
            <ArrowLeft className="size-5" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Back</span>
          </button>
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="truncate">{currentTagId}</span>
              <span className={`text-[10px] px-2 py-1 rounded-md border shrink-0 ${getHealthColor(turtleMeta.health_condition).replace('text-', 'border-').replace('text-', 'text-')} bg-current/5 font-black tracking-widest`}>
                {turtleMeta.health_condition}
              </span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-0.5 sm:gap-4 shrink-0">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-center hidden lg:block">
            <div className="flex flex-col items-center">
              {/* Removed Conservation Portal label */}
              <h1 className="text-xs font-black tracking-widest uppercase text-slate-400">Turtle Details</h1>
            </div>
          </div>
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Last Sighting</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">{events[0]?.date || 'N/A'}</span>
          </div>
          <div className="w-px h-8 bg-slate-200 dark:bg-white/10 mx-2 hidden md:block"></div>
          {user && user.role !== 'Field Volunteer' && (
            <>
              <button
                onClick={openEditModal}
                className="p-2 sm:p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl text-slate-400 hover:text-primary transition-all"
                title="Edit Turtle Record"
              >
                <Edit className="size-5" />
              </button>
              <button
                onClick={() => { setDeleteError(null); setShowDeleteConfirm(true); }}
                className="p-2 sm:p-3 hover:bg-rose-500/10 rounded-2xl text-slate-400 hover:text-rose-500 transition-all"
                title="Delete Turtle Record"
              >
                <Trash2 className="size-5" />
              </button>
            </>
          )}
        </div>
      </header>

      {showEditModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111111] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#111111]">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Edit turtle record</h2>
              <button
                onClick={() => setShowEditModal(false)}
                disabled={isSaving}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all disabled:opacity-50"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-8">
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Identity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="space-y-1.5 block">
                    <span className={editLabelClass}>Name</span>
                    <input
                      className={editInputClass}
                      value={editForm.name ?? ''}
                      placeholder="Unnamed"
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1.5 block">
                    <span className={editLabelClass}>Species</span>
                    <select
                      className={editInputClass}
                      value={editForm.species ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, species: e.target.value })}
                    >
                      {SPECIES_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5 block">
                    <span className={editLabelClass}>Sex</span>
                    <select
                      className={editInputClass}
                      value={editForm.sex ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, sex: e.target.value })}
                    >
                      <option value="">Unknown</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                    </select>
                  </label>
                  <label className="space-y-1.5 block">
                    <span className={editLabelClass}>Health <span className="text-rose-500">*</span></span>
                    <select
                      className={editInputClass}
                      value={editForm.health_condition ?? 'Healthy'}
                      onChange={(e) => setEditForm({ ...editForm, health_condition: e.target.value })}
                    >
                      <option value="Healthy">Healthy</option>
                      <option value="Lethargic">Lethargic</option>
                      <option value="Injured">Injured</option>
                      <option value="Deceased">Deceased</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Flipper Tags</h3>
                <div className="space-y-3">
                  {TAG_FIELDS.map(({ prefix, label }) => (
                    <div key={prefix} className="grid grid-cols-12 gap-3 items-center">
                      <span className="col-span-3 text-[10px] font-black uppercase tracking-widest text-primary">{label}</span>
                      <div className="col-span-5 relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 font-mono font-bold text-xs">
                          {TAG_PREFIX}
                        </span>
                        <input
                          className={`${editInputClass} pl-9 font-mono`}
                          inputMode="numeric"
                          placeholder="0000"
                          value={stripTagPrefix(editForm[`${prefix}_tag`])}
                          onChange={(e) => setEditForm({ ...editForm, [`${prefix}_tag`]: parseTagNumber(e.target.value) })}
                        />
                      </div>
                      <input
                        className={`${editInputClass} col-span-4`}
                        placeholder="Address"
                        value={editForm[`${prefix}_address`] ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, [`${prefix}_address`]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Morphometrics (cm) <span className="text-rose-500">*</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {MEASUREMENT_FIELDS.map(({ key, label }) => (
                    <label key={key} className="space-y-1.5 block">
                      <span className={editLabelClass}>{label}</span>
                      <input
                        className={editInputClass}
                        type="number"
                        step="0.1"
                        min="0"
                        value={editForm[key] ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                      />
                    </label>
                  ))}
                </div>
              </section>

              {editError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                  {editError}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#111111]">
              <button
                onClick={() => setShowEditModal(false)}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111111] p-6 shadow-2xl">
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">Delete turtle record?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-bold">{turtleMeta.name || currentTagId}</span> (#{id}) will be removed
              from the season's records. This cannot be undone.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Any survey events recorded against this turtle are deleted with it.
            </p>
            {deleteError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-rose-500 text-white hover:bg-rose-600 transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Hero Section: Metadata & Visual Identity */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 flex flex-col items-center justify-center bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <TurtleSilhouette className="size-48 -rotate-12" />
            </div>

            <div
              className="size-32 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6 ring-8 ring-primary/5 relative z-10"
              title="No photo on record for this turtle"
            >
              <TurtleSilhouette className="size-16" />
            </div>
            
            <div className="text-center relative z-10">
              <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">{turtleMeta.name}</h2>
              <div className="flex items-center justify-center gap-2">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">{turtleMeta.species}</span>
              </div>
              
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                <span className="px-4 py-1.5 bg-slate-100 dark:bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                  {commonName}
                </span>
                <span className="px-4 py-1.5 bg-slate-100 dark:bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                  {turtleMeta.sex || 'Unknown Sex'}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="Total Sightings" value={totalSightings.toString()} icon={<Eye className="size-5" />} trend="+1 this season" />
            <StatCard label="First Observed" value={firstSeenDate} icon={<Calendar className="size-5" />} />
            <StatCard label="Last Location" value={lastLocation} icon={<MapPin className="size-5" />} />
            <StatCard label="System ID" value={String(turtleMeta.turtle_id)} icon={<Fingerprint className="size-5" />} />
            <StatCard label="Health Status" value={turtleMeta.health_condition} icon={<Heart className="size-5" />} color={getHealthColor(turtleMeta.health_condition)} />
            <StatCard label="Primary Tag" value={currentTagId} icon={<Tag className="size-5" />} />
          </div>
        </section>

        {/* Identification & Morphometrics Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Tags */}
          <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 sm:p-10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                <div className="size-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-500">
                  <Tag className="size-4" />
                </div>
                Active Identification
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8">
              <div className="space-y-6">
                <TagDisplay position="Front Left" data={turtleMeta.tags?.fl_l} />
                <TagDisplay position="Front Right" data={turtleMeta.tags?.fl_r} />
              </div>
              <div className="space-y-6">
                <TagDisplay position="Rear Left" data={turtleMeta.tags?.rr_l} />
                <TagDisplay position="Rear Right" data={turtleMeta.tags?.rr_r} />
              </div>
            </div>
            
            <div className="mt-10 pt-8 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-white/[0.02] p-5 rounded-2xl border border-slate-200 dark:border-white/5">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Fingerprint className="size-5" />
                </div>
                <div>
                  <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Microchip (PIT)</span>
                  <span className="text-sm font-mono font-bold text-slate-900 dark:text-white tracking-wider">
                    {turtleMeta.tags?.microchip?.number || 'NO CHIP DETECTED'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Measurements */}
          <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 sm:p-10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                <div className="size-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Ruler className="size-4" />
                </div>
                Latest Morphometrics
              </h3>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Units: Centimeters (cm)</span>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <MeasurementBox label="SCL Max" value={turtleMeta.measurements?.sclMax} />
              <MeasurementBox label="SCL Min" value={turtleMeta.measurements?.sclMin} />
              <MeasurementBox label="SC Width" value={turtleMeta.measurements?.scw} />
              <MeasurementBox label="CCL Max" value={turtleMeta.measurements?.cclMax} />
              <MeasurementBox label="CCL Min" value={turtleMeta.measurements?.cclMin} />
              <MeasurementBox label="CC Width" value={turtleMeta.measurements?.ccw} />
            </div>
            
            <div className="mt-8 grid grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 text-center">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Tail Ext.</span>
                <span className="text-lg font-black text-amber-500">{turtleMeta.measurements?.tailExtension ?? '—'}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 text-center">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Vent-Tip</span>
                <span className="text-lg font-black text-amber-500">{turtleMeta.measurements?.ventToTip ?? '—'}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 text-center">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Tail</span>
                <span className="text-lg font-black text-amber-500">{turtleMeta.measurements?.totalTail ?? '—'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Event History Table */}
        <section className="space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <History className="size-6 text-primary" /> 
              Sighting & Event History
            </h3>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Registry Sync</span>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5">
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Date / Type</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Location</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Observer</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-12 text-center text-slate-400 text-xs uppercase font-bold tracking-widest">
                        No events recorded in the registry.
                      </td>
                    </tr>
                  ) : (
                    events.map((event) => (
                      <tr 
                        key={event.id} 
                        onClick={() => setSelectedEvent(event)}
                        className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      >
                        <td className="px-8 py-6">
                          <div className="text-sm font-black text-slate-900 dark:text-white mb-1">{event.date}</div>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                            event.type === 'TAGGING' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'
                          }`}>
                            {event.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                            <MapPin className="size-3 text-slate-400" />
                            {event.location}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-500 flex items-center gap-2">
                            <Users className="size-3" />
                            {event.observer}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="inline-flex items-center justify-center size-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                            <ArrowLeft className="size-4 rotate-180" />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Qualitative Notes */}
        {/* Full width, not a column beside the analytics card: the two had no
            relation to each other's length, so whichever ran short left a tall
            block of bare background that read as a failed render. The notes
            wrap into their own responsive grid instead, and analytics follows
            as a banner below. */}
        <section className="space-y-6">
          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
            <StickyNote className="size-4 text-primary" />
            Qualitative Observation Timeline
          </h4>
          {/* Column count follows the number of notes, so a single note fills
              the row instead of sitting in a third of it with two empty thirds
              beside it. */}
          <div className={`grid grid-cols-1 gap-4 ${notedEvents.length >= 2 ? 'md:grid-cols-2' : ''} ${notedEvents.length >= 3 ? 'xl:grid-cols-3' : ''}`}>
            {notedEvents.length === 0 ? (
              <div className="p-8 bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/10 rounded-[2rem] text-center">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No qualitative notes recorded.</p>
              </div>
            ) : (
              notedEvents.map((event) => (
                <div key={event.id} className="p-6 bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm">
                  <div className="flex justify-between items-center gap-3 mb-4">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">{event.date}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{event.location}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed italic">
                    "{event.notes}"
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Population Analytics */}
        <section className="bg-primary/5 border border-primary/10 rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-20"></div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            {/* lg:min-w-[18rem] rather than min-w-0: the stat tiles beside this
                are lg:shrink-0, so with min-w-0 the flex row was free to crush
                this column to nothing and the paragraph wrapped one word per
                line. Below lg the parent is flex-col, so this column is full
                width and the floor never binds. */}
            <div className="flex items-start gap-5 flex-1 lg:min-w-[18rem]">
              <div className="size-16 shrink-0 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary">
                <BarChart3 className="size-8" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Population Analytics</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Individual <span className="text-primary font-bold">{currentTagId}</span>'s growth trajectory and reproductive success metrics are compiled in the regional life-history database.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:items-stretch gap-4 lg:shrink-0">
              <div className="grid grid-cols-2 gap-4 sm:w-80">
                <div className="p-4 bg-white dark:bg-white/5 rounded-2xl border border-primary/10">
                  <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Growth Rate</span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {analytics.growthRatePerYear !== null
                      ? `${analytics.growthRatePerYear >= 0 ? '+' : ''}${analytics.growthRatePerYear.toFixed(1)}cm/yr`
                      : '—'}
                  </span>
                  {analytics.growthRatePerYear === null && (
                    <span className="block text-[8px] font-bold text-slate-400 normal-case mt-1 leading-tight">Needs 2+ measured sightings</span>
                  )}
                </div>
                <div className="p-4 bg-white dark:bg-white/5 rounded-2xl border border-primary/10">
                  <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Remigration</span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {analytics.avgRemigrationYears !== null
                      ? `${analytics.avgRemigrationYears.toFixed(1)} Years`
                      : '—'}
                  </span>
                  {analytics.avgRemigrationYears === null && (
                    <span className="block text-[8px] font-bold text-slate-400 normal-case mt-1 leading-tight">Needs 2+ nesting seasons</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowAnalyticsModal(true)}
                className="px-8 py-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <ExternalLink className="size-4" />
                Full Analytics
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setSelectedEvent(null)}></div>
          <div className="relative bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 rounded-[3rem] w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            
            {/* Modal Header */}
            <header className="p-8 sm:p-10 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary">
                  <History className="size-8" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">{selectedEvent.date}</span>
                    <span className="text-[10px] font-black text-slate-300 dark:text-white/20">•</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedEvent.location}</span>
                  </div>
                  <h3 className="font-black text-2xl sm:text-3xl uppercase tracking-tighter text-slate-900 dark:text-white">
                    {selectedEvent.type.replace('_', ' ')} RECORD
                  </h3>
                </div>
              </div>
              <button 
                onClick={() => setSelectedEvent(null)} 
                className="size-12 flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all"
              >
                <X className="size-6" />
              </button>
            </header>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-12 custom-scrollbar">
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                {/* Left Column: Measurements */}
                <div className="lg:col-span-7 space-y-10">
                  <section>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3 mb-8">
                      <div className="w-8 h-px bg-slate-200 dark:bg-white/10"></div>
                      Morphometric Data
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <MeasurementBox label="SCL Max" value={selectedEvent.measurements.sclMax} variant="modal" />
                      <MeasurementBox label="SCL Min" value={selectedEvent.measurements.sclMin} variant="modal" />
                      <MeasurementBox label="SC Width" value={selectedEvent.measurements.scw} variant="modal" />
                      <MeasurementBox label="CCL Max" value={selectedEvent.measurements.cclMax} variant="modal" />
                      <MeasurementBox label="CCL Min" value={selectedEvent.measurements.cclMin} variant="modal" />
                      <MeasurementBox label="CC Width" value={selectedEvent.measurements.ccw} variant="modal" />
                    </div>
                    
                    <div className="mt-6 grid grid-cols-3 gap-4">
                      <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-center">
                        <span className="block text-[9px] font-black text-amber-500/60 uppercase tracking-widest mb-1">Tail Ext.</span>
                        <span className="text-xl font-black text-amber-500">{selectedEvent.measurements.tailExtension ?? '—'}</span>
                      </div>
                      <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-center">
                        <span className="block text-[9px] font-black text-amber-500/60 uppercase tracking-widest mb-1">Vent-Tip</span>
                        <span className="text-xl font-black text-amber-500">{selectedEvent.measurements.ventToTip ?? '—'}</span>
                      </div>
                      <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-center">
                        <span className="block text-[9px] font-black text-amber-500/60 uppercase tracking-widest mb-1">Total Tail</span>
                        <span className="text-xl font-black text-amber-500">{selectedEvent.measurements.totalTail ?? '—'}</span>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3 mb-6">
                      <div className="w-8 h-px bg-slate-200 dark:bg-white/10"></div>
                      Observer Notes
                    </h4>
                    <div className="p-8 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-[2rem]">
                      <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed italic font-medium">
                        "{selectedEvent.notes || 'No qualitative notes recorded for this event.'}"
                      </p>
                    </div>
                  </section>
                </div>

                {/* Right Column: Tags & Meta */}
                <div className="lg:col-span-5 space-y-10">
                  <section>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3 mb-8">
                      <div className="w-8 h-px bg-slate-200 dark:bg-white/10"></div>
                      Identification
                    </h4>
                    <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-[2rem] p-8 space-y-8">
                      <div className="space-y-6">
                        <TagDisplay position="Front Left" data={selectedEvent.tags?.fl_l} />
                        <TagDisplay position="Front Right" data={selectedEvent.tags?.fl_r} />
                        <TagDisplay position="Rear Left" data={selectedEvent.tags?.rr_l} />
                        <TagDisplay position="Rear Right" data={selectedEvent.tags?.rr_r} />
                      </div>
                      
                      <div className="pt-8 border-t border-slate-200 dark:border-white/10">
                        <div className="flex items-center gap-4">
                          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Fingerprint className="size-5" />
                          </div>
                          <div>
                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Microchip (PIT)</span>
                            <span className="text-sm font-mono font-bold text-slate-900 dark:text-white tracking-wider">
                              {selectedEvent.tags?.microchip?.number || 'NOT RECORDED'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="p-8 bg-primary/5 border border-primary/10 rounded-[2rem]">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Users className="size-5" />
                      </div>
                      <div>
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Primary Observer</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">{selectedEvent.observer}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <MapPin className="size-5" />
                      </div>
                      <div>
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Event Location</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">{selectedEvent.location}</span>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

            </div>

            <footer className="p-8 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-200 dark:border-white/5 flex justify-end shrink-0">
              <button 
                onClick={() => setSelectedEvent(null)} 
                className="px-10 py-4 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Dismiss Record
              </button>
            </footer>

          </div>
        </div>
      )}

      {/* Analytics Node Modal */}
      {showAnalyticsModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setShowAnalyticsModal(false)}></div>
          <div className="relative bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 rounded-[3rem] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <header className="p-8 sm:p-10 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary">
                  <BarChart3 className="size-8" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">{currentTagId}</span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Population Analytics Node</h3>
                </div>
              </div>
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="size-6" />
              </button>
            </header>

            <div className="p-8 sm:p-10 space-y-8 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                  <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Growth Rate</span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {analytics.growthRatePerYear !== null
                      ? `${analytics.growthRatePerYear >= 0 ? '+' : ''}${analytics.growthRatePerYear.toFixed(1)}cm/yr`
                      : '—'}
                  </span>
                  {analytics.growthRatePerYear === null && (
                    <span className="block text-[8px] font-bold text-slate-400 normal-case mt-1 leading-tight">Needs 2+ measured sightings</span>
                  )}
                </div>
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                  <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Remigration</span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {analytics.avgRemigrationYears !== null ? `${analytics.avgRemigrationYears.toFixed(1)} Yrs` : 'N/A'}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                  <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sightings</span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">{analytics.totalSightings}</span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                  <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Date Range</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white leading-tight block">
                    {analytics.firstSighting && analytics.lastSighting
                      ? (analytics.firstSighting === analytics.lastSighting
                          ? analytics.firstSighting
                          : `${analytics.firstSighting} – ${analytics.lastSighting}`)
                      : 'N/A'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3 mb-4">
                  <Ruler className="size-4 text-primary" />
                  Carapace Length Over Time
                </h4>
                {analytics.growthPoints.length >= 2 ? (
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.growthPoints} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-white/10" />
                        <XAxis dataKey="date" stroke="currentColor" className="text-slate-400" tick={{ fontSize: 10 }} />
                        <YAxis stroke="currentColor" className="text-slate-400" tick={{ fontSize: 10 }} unit="cm" />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#1a232e', border: 'none', borderRadius: '0.75rem', fontSize: '11px' }}
                          labelStyle={{ color: '#f1f5f9' }}
                          formatter={(value: number) => [`${value}cm`, 'Length']}
                        />
                        <Line type="monotone" dataKey="length" stroke="#137fec" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="p-8 bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/10 rounded-[2rem] text-center">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                      Not enough recorded measurements yet to plot a growth trend.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <footer className="p-8 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-200 dark:border-white/5 flex justify-end shrink-0">
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="px-10 py-4 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}

      <footer className="p-12 border-t border-slate-200 dark:border-white/5 flex flex-col items-center justify-center gap-8 bg-background-light dark:bg-background-dark">
        <button 
          onClick={onBack}
          className="flex items-center gap-3 px-8 py-4 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 hover:text-primary dark:hover:text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all border border-slate-200 dark:border-white/5 group shadow-sm"
        >
          <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
          Return to Registry
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.4em] mb-2">Turtle Greek Regional Registry</p>
          <p className="text-[9px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest">Data Node: {id} • Protocol v3.1</p>
        </div>
      </footer>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode; color?: string; trend?: string }> = ({ label, value, icon, color = "text-slate-900 dark:text-white", trend }) => (
  <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between group hover:border-primary/30 transition-colors">
    <div className="flex items-center justify-between mb-4">
      <div className="size-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
        {icon}
      </div>
      {trend && <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">{trend}</span>}
    </div>
    <div>
      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block leading-none">{label}</span>
      <span className={`text-lg font-black tracking-tight truncate block ${color}`}>{value}</span>
    </div>
  </div>
);

const MeasurementBox: React.FC<{ label: string; value: number | undefined; variant?: 'default' | 'modal' }> = ({ label, value, variant = 'default' }) => (
  <div className={`p-4 rounded-2xl flex flex-col items-center text-center h-full justify-center ${
    variant === 'modal' 
      ? 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10' 
      : 'bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5'
  }`}>
    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-tight">{label}</span>
    <span className="text-lg font-black text-slate-900 dark:text-white">{value ?? '—'}</span>
  </div>
);

const TagDisplay: React.FC<{ position: string; data: TagData | undefined }> = ({ position, data }) => (
  <div className="flex justify-between items-start">
    <div>
      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{position}</span>
      <span className={`text-sm font-mono font-bold tracking-wider ${data?.id ? 'text-primary' : 'text-slate-400'}`}>
        {data?.id || 'NOT TAGGED'}
      </span>
    </div>
    {data?.address && (
      <div className="text-right">
        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Address</span>
        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{data.address}</span>
      </div>
    )}
  </div>
);

export default TurtleDetails;
