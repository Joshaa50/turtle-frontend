// Nest/Emergence Entry is one of the longest forms in the app - GPS,
// measurements, triangulation points and photos - and until it's saved it
// lives only in NestEntry's React state (QA-005). A refresh, an accidental
// Back, or a phone locking mid-entry silently threw all of it away with no
// warning. This mirrors the in-progress form to localStorage as it's typed
// and restores it on the next load, the same trick surveyDraft.ts already
// uses for Morning Survey.

const STORAGE_KEY = 'turtle_nest_entry_draft';

// A session left open this long is from an earlier visit, not one still in
// progress - restoring it would surprise rather than help.
const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1000;

interface Coords { lat: string; lng: string }
interface Metrics { h: string; H: string; w: string; S: string }
interface TriPoint { desc: string; dist: string; lat: string; lng: string; photo: string | null }

export interface NestEntryFormState {
  nestId: string;
  relocated: boolean;
  relocationReason: string;
  eggsTakenOut: string;
  eggsPutBackIn: string;
  startTime: string;
  endTime: string;
}

export interface NestEntryDraft {
  savedAt: string;
  isNest: boolean;
  formData: NestEntryFormState;
  metrics: Metrics;
  coords: Coords;
  relocatedMetrics: Metrics;
  relocatedCoords: Coords;
  triangulation: TriPoint[];
  capturedSketch: string | null;
}

export const hasNestEntryContent = (d: Pick<NestEntryDraft,
  'formData' | 'metrics' | 'coords' | 'relocatedMetrics' | 'relocatedCoords' | 'triangulation' | 'capturedSketch'
>): boolean => {
  const { formData, metrics, coords, relocatedMetrics, relocatedCoords, triangulation, capturedSketch } = d;
  return (
    !!formData.nestId || formData.relocated || !!formData.relocationReason ||
    !!formData.eggsTakenOut || !!formData.eggsPutBackIn || !!formData.startTime || !!formData.endTime ||
    !!coords.lat || !!coords.lng ||
    !!metrics.h || !!metrics.H || !!metrics.w || !!metrics.S ||
    !!relocatedCoords.lat || !!relocatedCoords.lng ||
    !!relocatedMetrics.h || !!relocatedMetrics.H || !!relocatedMetrics.w || !!relocatedMetrics.S ||
    !!capturedSketch ||
    triangulation.some((p) => !!p.desc || !!p.dist || !!p.lat || !!p.lng || !!p.photo)
  );
};

export const clearNestEntryDraft = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable - nothing to clear.
  }
};

export const saveNestEntryDraft = (draft: Omit<NestEntryDraft, 'savedAt'>): void => {
  if (!hasNestEntryContent(draft)) {
    clearNestEntryDraft();
    return;
  }
  try {
    const entry: NestEntryDraft = { ...draft, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch (err) {
    // Quota (a sketch or triangulation photo is base64) or private mode.
    console.warn('Could not save the nest entry draft; a refresh would lose this entry.', err);
  }
};

export const loadNestEntryDraft = (): NestEntryDraft | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const draft = JSON.parse(raw) as NestEntryDraft;
    if (!draft || !hasNestEntryContent(draft)) {
      clearNestEntryDraft();
      return null;
    }

    const age = Date.now() - new Date(draft.savedAt).getTime();
    if (!isFinite(age) || age > MAX_DRAFT_AGE_MS) {
      clearNestEntryDraft();
      return null;
    }

    return draft;
  } catch {
    return null;
  }
};
