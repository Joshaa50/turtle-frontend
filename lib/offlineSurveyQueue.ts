import { DatabaseConnection, MorningSurveyData } from '../services/Database';
import { Beach } from '../services/Database';
import { NestEventData } from '../services/Database';
import { SurveyData } from '../types';

const STORAGE_KEY = 'turtle_offline_survey_queue';

export interface QueuedSurvey {
  id: string;
  queuedAt: string;
  beach: { id: number; name: string };
  survey: SurveyData;
  date: string;
  currentRegion: string;
}

const readQueue = (): QueuedSurvey[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue: QueuedSurvey[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent('turtle-offline-queue-changed', { detail: { size: queue.length } }));
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
const isNetworkError = (err: any) => !navigator.onLine || (err instanceof TypeError);

// Submits one beach's survey data. This is the same sequence of API calls
// the live form uses, extracted so it can be replayed later for a queued,
// offline-saved entry without needing the original component's state.
export const submitBeachSurvey = async (
  beach: { id: number; name: string },
  survey: SurveyData,
  date: string,
  currentRegion: string
): Promise<void> => {
  const trackPromises = survey.tracks.map(async (track) => {
    const payload: NestEventData = {
      event_type: 'EMERGENCE',
      nest_code: track.nestCode,
      start_time: `${date} 08:00:00`,
      tracks_to_sea: parseInt(track.tracksToSea) || 0,
      tracks_lost: parseInt(track.tracksLost) || 0,
      notes: `Logged via Morning Survey for ${beach.name} (Region: ${currentRegion}). ${survey.notes ? `Survey Notes: ${survey.notes}` : ''}`,
    };
    return DatabaseConnection.createNestEvent(payload);
  });
  await Promise.all(trackPromises);

  const uniqueNestCodes = [...new Set(survey.tracks.map((t) => t.nestCode))];
  await Promise.all(
    uniqueNestCodes.map(async (code) => {
      try {
        const nestResponse = await DatabaseConnection.getNest(code);
        const fullNest = nestResponse?.nest;
        if (fullNest && (fullNest.status === 'incubating' || fullNest.status === 'INCUBATING')) {
          await DatabaseConnection.updateNest(fullNest.id, { ...fullNest, status: 'hatching' });
        }
      } catch (err) {
        console.error(`Failed to update status for nest ${code}:`, err);
      }
    })
  );

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
  const surveyId = surveyResponse.survey.id;

  if (survey.nests && survey.nests.length > 0) {
    for (const nest of survey.nests) {
      if (!nest.payload) continue;
      if (nest.isEmergence) {
        const response = await DatabaseConnection.createEmergence(nest.payload);
        const eventId = response.emergence?.id || response.event?.id || response.id;
        if (eventId) await DatabaseConnection.linkEmergenceToSurvey(surveyId, eventId);
      } else {
        const response = await DatabaseConnection.createNest(nest.payload);
        const nestId = response.nest?.id || response.id;
        if (nestId) await DatabaseConnection.linkNestToSurvey(surveyId, nestId);
        if (nest.relocationEventPayload) {
          await DatabaseConnection.createNestEvent(nest.relocationEventPayload);
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
  currentRegion: string
): boolean => {
  if (!isNetworkError(err)) return false;
  queueSurvey({ beach, survey, date, currentRegion });
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
        await submitBeachSurvey(entry.beach, entry.survey, entry.date, entry.currentRegion);
        removeQueuedSurvey(entry.id);
        synced += 1;
      } catch (err) {
        if (!isNetworkError(err)) {
          // A real server-side error on replay (e.g. duplicate/invalid data) -
          // drop it rather than retrying forever, but log it so it isn't silently lost.
          console.error(`Offline survey for ${entry.beach.name} (queued ${entry.queuedAt}) failed to sync:`, err);
        }
        // Network error: leave it queued for the next 'online' event.
      }
    }
  } finally {
    isFlushing = false;
  }
  return { synced, remaining: readQueue().length };
};
