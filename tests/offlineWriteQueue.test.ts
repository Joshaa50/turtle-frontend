import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  queueWrite,
  queueWriteIfOffline,
  getQueuedWrites,
  flushOfflineWriteQueue,
} from '../lib/offlineWriteQueue';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const jsonResponse = (data: any, ok = true) => ({
  ok,
  json: async () => data,
});

describe('offlineWriteQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockClear();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('queueWrite/getQueuedWrites round-trip through localStorage', () => {
    expect(getQueuedWrites()).toEqual([]);
    queueWrite({ kind: 'emergence', payload: { foo: 'bar' } });
    const queue = getQueuedWrites();
    expect(queue).toHaveLength(1);
    expect(queue[0].kind).toBe('emergence');
    expect(queue[0].id).toBeTruthy();
    expect(queue[0].queuedAt).toBeTruthy();
  });

  it('queueWriteIfOffline only queues on a network-shaped error', () => {
    const realError = new Error('Validation failed');
    expect(queueWriteIfOffline(realError, { kind: 'emergence', payload: {} })).toBe(false);
    expect(getQueuedWrites()).toHaveLength(0);

    const networkError = new TypeError('Failed to fetch');
    expect(queueWriteIfOffline(networkError, { kind: 'emergence', payload: {} })).toBe(true);
    expect(getQueuedWrites()).toHaveLength(1);
  });

  it('queueWriteIfOffline queues when navigator.onLine is false, even for a non-TypeError', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    expect(queueWriteIfOffline(new Error('anything'), { kind: 'emergence', payload: {} })).toBe(true);
    expect(getQueuedWrites()).toHaveLength(1);
  });

  it('flushOfflineWriteQueue replays a queued nest and its relocation event', async () => {
    queueWrite({ kind: 'nest', payload: { nest_code: 'N1' } as any, relocationEventPayload: { event_type: 'RELOCATION' } as any });
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ nest: { id: 1 } })) // createNest
      .mockResolvedValueOnce(jsonResponse({ event: { id: 2 } })); // createNestEvent

    const result = await flushOfflineWriteQueue();

    expect(result).toEqual({ synced: 1, remaining: 0 });
    expect(getQueuedWrites()).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('flushOfflineWriteQueue replays a queued new-turtle entry as one atomic request (QA-027)', async () => {
    queueWrite({
      kind: 'turtle_new',
      turtlePayload: { name: 'Ari' } as any,
      eventPayloadWithoutId: { event_date: '2026-08-13', event_type: 'TAGGING' } as any,
    });
    mockFetch.mockResolvedValueOnce(jsonResponse({ turtle: { id: 42 }, event: { id: 7 } })); // createTurtleWithEvent

    const result = await flushOfflineWriteQueue();

    expect(result).toEqual({ synced: 1, remaining: 0 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // One request carrying both the turtle and event fields - there is no
    // turtle id to substitute client-side anymore, the server assigns one
    // and links the event to it within the same transaction.
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.name).toBe('Ari');
    expect(callBody.event_type).toBe('TAGGING');
  });

  it('flushOfflineWriteQueue leaves an entry queued on a network error and drops it on a real server error', async () => {
    queueWrite({ kind: 'emergence', payload: {} });
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    let result = await flushOfflineWriteQueue();
    expect(result.remaining).toBe(1);

    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Invalid payload' }, false));
    result = await flushOfflineWriteQueue();
    expect(result.remaining).toBe(0);
  });

  it('flushOfflineWriteQueue is a no-op while offline', async () => {
    queueWrite({ kind: 'emergence', payload: {} });
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const result = await flushOfflineWriteQueue();
    expect(result.synced).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
