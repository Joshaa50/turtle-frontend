import { DatabaseConnection, MorningSurveyData } from '../services/Database';
import { Beach } from '../services/Database';
import { NestEventData } from '../services/Database';
import { SurveyData } from '../types';

const STORAGE_KEY = 'turtle_offline_survey_queue';

// How far a submission got. Submitting one beach is a sequence of independent
// API calls, and none of them can be taken back, so replaying an entry from the
// top posted the calls that had already landed a second time - one duplicate
// hatchling-track event per reconnect. This is the record of what has already
// reached the server, kept with the queued entry so a retry resumes instead of
// restarting.
export interface SurveyProgress {
  /** Indices into survey.tracks whose nest event has been created. */
  tracks: number[];
  /** Nest codes whose status has already been brought up to date. */
  statuses: string[];
  /** The morning survey row itself, once it exists. */
  surveyId?: number | string;
  /** Staged nests/emergences by index, with what has landed for each. */
  staged: Record<string, { id?: number | string | null; linked?: boolean; relocationLogged?: boolean }>;
}

export const emptyProgress = (): SurveyProgress => ({ tracks: [], statuses: [], staged: {} });

// Tolerates entries queued before progress was recorded, and anything a partly
// written localStorage value might be missing.
const normalizeProgress = (progress?: Partial<SurveyProgress> | null): SurveyProgress => ({
  tracks: Array.isArray(progress?.tracks) ? [...progress!.tracks] : [],
  statuses: Array.isArray(progress?.statuses) ? [...progress!.statuses] : [],
  surveyId: progress?.surveyId,
  staged: progress?.staged && typeof progress.staged === 'object' ? { ...progress.staged } : {},
});

export interface QueuedSurvey {
  id: string;
  queuedAt: string;
  beach: { id: number; name: string };
  survey: SurveyData;
  date: string;
  currentRegion: string;
  progress?: SurveyProgress;
  /** Replay attempts that failed for a reason retrying will not fix. */
  attempts?: number;
}

// A queued survey that fails for a non-network reason is kept for another try -
// a 500 is often the server, not the data - but not forever: after this many
// attempts it is dropped with a loud log rather than retried on every reconnect
// for the rest of the season.
const MAX_REPLAY_ATTEMPTS = 5;

const readQueue = (): QueuedSurvey[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const storeQueue = (queue: QueuedSurvey[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

const writeQueue = (queue: QueuedSurvey[]) => {
  storeQueue(queue);
  window.dispatchEvent(new CustomEvent('turtle-offline-queue-changed', { detail: { size: queue.length } }));
};

// Bookkeeping about an entry that is still queued: the number of entries hasn't
// changed, so this deliberately doesn't announce a queue change.
const updateQueuedSurvey = (id: string, patch: Partial<QueuedSurvey>) => {
  storeQueue(readQueue().map((q) => (q.id === id ? { ...q, ...patch } : q)));
};

export const getQueuedSurveys = (): QueuedSurvey[] => readQueue();

export const queueSurvey = (entry: Omit<QueuedSurvey, 'id' | 'queuedAt'>) => {
  const queue = readQueue();
  queue.push({
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
  });
  writeQueue(queue);
};

const removeQueuedSurvey = (id: string) => {
  writeQueue(readQueue().filter((q) => q.id !== id));
};

// Network-error detection: browsers throw a generic TypeError ("Failed to
// fetch" / "NetworkError...") when a request can't reach the server at all,
// as opposed to the server responding with a 4xx/5xx (a real API error that
// should surface normally, not be silently swallowed into the offline queue).
export const isNetworkError = (err: any) => !navigator.onLine || (err instanceof TypeError);

// Submits one beach's survey data. This is the same sequence of API calls
// the live form uses, extracted so it can be replayed later for a queued,
// offline-saved entry without needing the original component's state.
//
// Every call reports itself through `onProgress` as it lands. None of them can
// be undone, so a retry has to know what already happened: without that, a
// survey that failed at the last call re-posted the first ones on every
// attempt. Pass the recorded progress back in to resume where it stopped.
export const submitBeachSurvey = async (
  beach: { id: number; name: string },
  survey: SurveyData,
  date: string,
  currentRegion: string,
  options: {
    progress?: Partial<SurveyProgress> | null;
    onProgress?: (progress: SurveyProgress) => void;
  } = {}
): Promise<void> => {
  const progress = normalizeProgress(options.progress);
  const done = () => options.onProgress?.(progress);
  // Announce the starting point, so a caller that only ever sees a failure
  // still has whatever was already recorded to queue alongside it.
  done();

  // Sequential rather than in parallel: each track event has to be marked as
  // landed before the next is attempted, or a failure halfway through leaves no
  // way to tell which of them got through.
  for (const [index, track] of survey.tracks.entries()) {
    if (progress.tracks.includes(index)) continue;

    const payload: NestEventData = {
      event_type: 'EMERGENCE',
      nest_code: track.nestCode,
      start_time: `${date} 08:00:00`,
      tracks_to_sea: parseInt(track.tracksToSea) || 0,
      tracks_lost: parseInt(track.tracksLost) || 0,
      notes: `Logged via Morning Survey for ${beach.name} (Region: ${currentRegion}). ${survey.notes ? `Survey Notes: ${survey.notes}` : ''}`,
    };
    await DatabaseConnection.createNestEvent(payload);
    progress.tracks.push(index);
    done();
  }

  const uniqueNestCodes = [...new Set(survey.tracks.map((t) => t.nestCode))];
  for (const code of uniqueNestCodes) {
    if (progress.statuses.includes(code)) continue;
    try {
      const nestResponse = await DatabaseConnection.getNest(code);
      const fullNest = nestResponse?.nest;
      if (fullNest && (fullNest.status === 'incubating' || fullNest.status === 'INCUBATING')) {
        await DatabaseConnection.updateNest(fullNest.id, { ...fullNest, status: 'hatching' });
      }
      progress.statuses.push(code);
      done();
    } catch (err) {
      // A status that couldn't be updated doesn't invalidate the survey, so this
      // carries on as it always has - and stays unmarked, so a retry tries again.
      console.error(`Failed to update status for nest ${code}:`, err);
    }
  }

  if (progress.surveyId === undefined) {
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
      notes: survey.notes,
    };
    const surveyResponse = await DatabaseConnection.createMorningSurvey(baseSurveyPayload);
    progress.surveyId = surveyResponse.survey.id;
    done();
  }
  const surveyId = progress.surveyId;

  if (survey.nests && survey.nests.length > 0) {
    for (const [index, nest] of survey.nests.entries()) {
      if (!nest.payload) continue;
      const key = String(index);
      const staged = progress.staged[key] || {};
      progress.staged[key] = staged;

      if (nest.isEmergence) {
        if (staged.id === undefined) {
          const response = await DatabaseConnection.createEmergence(nest.payload);
          staged.id = response.emergence?.id || response.event?.id || response.id || null;
          done();
        }
        if (staged.id && !staged.linked) {
          await DatabaseConnection.linkEmergenceToSurvey(surveyId!, staged.id);
          staged.linked = true;
          done();
        }
      } else {
        if (staged.id === undefined) {
          const response = await DatabaseConnection.createNest(nest.payload);
          staged.id = response.nest?.id || response.id || null;
          done();
        }
        if (staged.id && !staged.linked) {
          await DatabaseConnection.linkNestToSurvey(surveyId!, staged.id);
          staged.linked = true;
          done();
        }
        if (nest.relocationEventPayload && !staged.relocationLogged) {
          await DatabaseConnection.createNestEvent(nest.relocationEventPayload);
          staged.relocationLogged = true;
          done();
        }
      }
    }
  }
};

// Saves a beach's survey for later instead of losing it, when the failure
// looks like "no signal" rather than a real validation/server error.
export const queueSurveyIfOffline = (
  err: any,
  beach: { id: number; name: string },
  survey: SurveyData,
  date: string,
  currentRegion: string,
  // Whatever the failed attempt already got through, so the replay doesn't
  // repeat it.
  progress?: Partial<SurveyProgress> | null
): boolean => {
  if (!isNetworkError(err)) return false;
  queueSurvey({ beach, survey, date, currentRegion, progress: normalizeProgress(progress) });
  return true;
};

let isFlushing = false;

// Replays every queued survey against the live API. Called when the app
// detects it's back online. Entries that still fail (still offline, or a
// genuine server error) stay in the queue for the next attempt.
export const flushOfflineSurveyQueue = async (): Promise<{ synced: number; remaining: number }> => {
  if (isFlushing || !navigator.onLine) return { synced: 0, remaining: readQueue().length };
  isFlushing = true;
  let synced = 0;
  try {
    for (const entry of readQueue()) {
      try {
        await submitBeachSurvey(entry.beach, entry.survey, entry.date, entry.currentRegion, {
          progress: entry.progress,
          // Written down as each call lands, so the next attempt - which may be
          // days and a browser restart away - resumes rather than repeats.
          onProgress: (progress) => updateQueuedSurvey(entry.id, { progress }),
        });
        removeQueuedSurvey(entry.id);
        synced += 1;
      } catch (err) {
        if (!isNetworkError(err)) {
          // A real server-side error on replay. Worth another try - a 500 is
          // often the server rather than the data, and the work is real - but
          // not indefinitely.
          const attempts = (entry.attempts || 0) + 1;
          if (attempts >= MAX_REPLAY_ATTEMPTS) {
            console.error(
              `Offline survey for ${entry.beach.name} (queued ${entry.queuedAt}) failed to sync ${attempts} times; giving up on it:`,
              err
            );
            removeQueuedSurvey(entry.id);
          } else {
            console.error(
              `Offline survey for ${entry.beach.name} (queued ${entry.queuedAt}) failed to sync (attempt ${attempts}):`,
              err
            );
            updateQueuedSurvey(entry.id, { attempts });
          }
        }
        // Network error: leave it queued for the next 'online' event.
      }
    }
  } finally {
    isFlushing = false;
  }
  return { synced, remaining: readQueue().length };
};
