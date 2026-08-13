import { DatabaseConnection, NestData, NestEventData, TurtleData, TurtleEventData } from '../services/Database';
import { isNetworkError } from './offlineSurveyQueue';

const STORAGE_KEY = 'turtle_offline_write_queue';

// Defined without id/queuedAt baked into each member (rather than
// Omit<QueuedWrite, 'id'|'queuedAt'>) because Omit over a union collapses the
// discriminated members' distinct fields, which would defeat the excess
// property checks queueWrite() relies on.
export type WriteInput =
  | { kind: 'nest'; payload: NestData; relocationEventPayload?: NestEventData }
  | { kind: 'emergence'; payload: any }
  | { kind: 'turtle_new'; turtlePayload: TurtleData; eventPayloadWithoutId: Omit<TurtleEventData, 'turtle_id'> }
  | { kind: 'turtle_existing'; turtleId: string | number; updatePayload: any; eventPayload: TurtleEventData }
  // Turtle create/update already succeeded (before the connection dropped);
  // only the follow-up event call still needs to be replayed.
  | { kind: 'turtle_event'; eventPayload: TurtleEventData };

export type QueuedWrite = WriteInput & { id: string; queuedAt: string };

const readQueue = (): QueuedWrite[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue: QueuedWrite[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent('turtle-offline-write-queue-changed', { detail: { size: queue.length } }));
};

export const getQueuedWrites = (): QueuedWrite[] => readQueue();

export const queueWrite = (entry: WriteInput) => {
  const queue = readQueue();
  queue.push({
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
  });
  writeQueue(queue);
};

const removeQueuedWrite = (id: string) => {
  writeQueue(readQueue().filter((q) => q.id !== id));
};

// Same "queue it if this looks like a dropped connection, otherwise let the
// real error surface" heuristic as lib/offlineSurveyQueue.ts.
export const queueWriteIfOffline = (err: any, entry: WriteInput): boolean => {
  if (!isNetworkError(err)) return false;
  queueWrite(entry);
  return true;
};

let isFlushing = false;

// Replays every queued write against the live API. Called when the app
// detects it's back online. Entries that still fail (still offline, or a
// genuine server error) stay in the queue for the next attempt.
export const flushOfflineWriteQueue = async (): Promise<{ synced: number; remaining: number }> => {
  if (isFlushing || !navigator.onLine) return { synced: 0, remaining: readQueue().length };
  isFlushing = true;
  let synced = 0;
  try {
    for (const entry of readQueue()) {
      try {
        switch (entry.kind) {
          case 'nest': {
            await DatabaseConnection.createNest(entry.payload);
            if (entry.relocationEventPayload) {
              await DatabaseConnection.createNestEvent(entry.relocationEventPayload);
            }
            break;
          }
          case 'emergence': {
            await DatabaseConnection.createEmergence(entry.payload);
            break;
          }
          case 'turtle_new': {
            const turtleResponse = await DatabaseConnection.createTurtle(entry.turtlePayload);
            const turtleId = turtleResponse.turtle?.id || turtleResponse.id || turtleResponse.insertId;
            if (!turtleId) throw new Error('Created turtle but could not retrieve its ID.');
            await DatabaseConnection.createTurtleEvent({ ...entry.eventPayloadWithoutId, turtle_id: Number(turtleId) });
            break;
          }
          case 'turtle_existing': {
            await DatabaseConnection.updateTurtle(entry.turtleId, entry.updatePayload);
            await DatabaseConnection.createTurtleEvent(entry.eventPayload);
            break;
          }
          case 'turtle_event': {
            await DatabaseConnection.createTurtleEvent(entry.eventPayload);
            break;
          }
        }
        removeQueuedWrite(entry.id);
        synced += 1;
      } catch (err) {
        if (!isNetworkError(err)) {
          // A real server-side error on replay - drop it rather than retrying
          // forever, but log it so it isn't silently lost.
          console.error(`Offline write (${entry.kind}, queued ${entry.queuedAt}) failed to sync:`, err);
          removeQueuedWrite(entry.id);
        }
        // Network error: leave it queued for the next 'online' event.
      }
    }
  } finally {
    isFlushing = false;
  }
  return { synced, remaining: readQueue().length };
};
