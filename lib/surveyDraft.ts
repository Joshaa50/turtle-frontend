// A Morning Survey is built up over a whole patrol - times, boundary
// coordinates, nest tally, every nest and track added along the way - and until
// it's submitted it lives only in App's React state. A phone locking and being
// killed in the background, a browser refresh, or a flat battery mid-patrol
// therefore lost the morning's work outright.
//
// Submission is already offline-safe (see offlineSurveyQueue.ts): a survey that
// can't reach the API is queued and replayed on reconnect. This covers the
// window *before* that - the in-progress form itself - by mirroring it to
// localStorage as it's filled in and restoring it on the next load.
import { SurveyData } from '../types';

const STORAGE_KEY = 'turtle_survey_draft';

// A patrol is a morning's work; anything older than this is from a previous
// outing and shouldn't reappear under a fresh survey.
const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1000;

export interface SurveyDraft {
  savedAt: string;
  date: string;
  region: string;
  beach: string;
  surveys: Record<string, SurveyData>;
}

// True once anything has actually been entered for a beach. Covers every field
// the researcher can fill, not just staged nests and tracks - a boundary fix or
// a start time typed into an otherwise empty form is still work worth keeping.
export const hasSurveyContent = (survey?: SurveyData | null): boolean => {
  if (!survey) return false;
  return (
    (survey.nests?.length || 0) > 0 ||
    (survey.tracks?.length || 0) > 0 ||
    !!survey.firstTime ||
    !!survey.lastTime ||
    !!survey.tlGpsLat || !!survey.tlGpsLng ||
    !!survey.trGpsLat || !!survey.trGpsLng ||
    (survey.nestTally || 0) > 0 ||
    !!survey.notes?.trim()
  );
};

export const hasAnySurveyContent = (surveys: Record<string, SurveyData>): boolean =>
  Object.values(surveys).some(hasSurveyContent);

export const clearSurveyDraft = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable - nothing to clear.
  }
};

// Only the beaches with something entered are stored: the surveys map holds an
// empty record for every beach in the region, and nest payloads can carry a
// base64 track sketch, so writing the whole map would burn quota on blanks.
export const saveSurveyDraft = (draft: Omit<SurveyDraft, 'savedAt'>): void => {
  const populated = Object.fromEntries(
    Object.entries(draft.surveys).filter(([, survey]) => hasSurveyContent(survey))
  );

  if (Object.keys(populated).length === 0) {
    clearSurveyDraft();
    return;
  }

  try {
    const entry: SurveyDraft = { ...draft, surveys: populated, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch (err) {
    // Quota (a survey carrying several sketches) or private mode. The draft
    // just isn't kept, which is the behaviour before this existed - but say so,
    // because it means a refresh will lose the entry.
    console.warn('Could not save the survey draft; a refresh would lose this entry.', err);
  }
};

export const loadSurveyDraft = (): SurveyDraft | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const draft = JSON.parse(raw) as SurveyDraft;
    if (!draft?.surveys || !hasAnySurveyContent(draft.surveys)) {
      clearSurveyDraft();
      return null;
    }

    const age = Date.now() - new Date(draft.savedAt).getTime();
    if (!isFinite(age) || age > MAX_DRAFT_AGE_MS) {
      clearSurveyDraft();
      return null;
    }

    return draft;
  } catch {
    return null;
  }
};
