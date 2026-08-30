// Regression: a Morning Survey that fails partway through is replayed from the
// top, so the calls that already succeeded are made again.
//
// submitBeachSurvey() in lib/offlineSurveyQueue.ts is a sequence of independent
// API calls - every hatchling track as a nest event, then each nest's status
// update, then POST /morning-surveys, then each staged nest/emergence. Nothing
// records how far it got. If the connection drops (or the server errors) after
// the track events are in but before the survey row is created,
// flushOfflineSurveyQueue() replays the whole entry, and because
// flushOfflineSurveyQueue only *logs* a non-network failure without removing
// the entry, it does this again on every subsequent 'online' event.
//
// This is the same shape as the mid-request failure seen in the running app:
// on Morning Survey as Field Leader, with POST /morning-surveys stubbed to
// answer 500, submission failed after the earlier calls had already gone out,
// and the beach's data stayed in the form ready to be sent a second time.
//
// The assertion below is the property that should hold: replaying an entry
// must not duplicate work that already landed. It fails today because the
// track event is posted once per attempt.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queueSurvey, getQueuedSurveys, flushOfflineSurveyQueue } from '../lib/offlineSurveyQueue';
import { SurveyData } from '../types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const survey: SurveyData = {
  firstTime: '06:00',
  lastTime: '08:00',
  region: 'Lepeda',
  tlGpsLat: '38.15898', tlGpsLng: '20.55632',
  trGpsLat: '38.15836', trGpsLng: '20.55393',
  nestTally: 2,
  nests: [],
  tracks: [{ nestCode: 'QA-DUP-1', tracksToSea: '5', tracksLost: '1' } as any],
  notes: '',
};

const json = (data: any, ok = true, status = ok ? 200 : 500) => ({
  ok,
  status,
  json: async () => data,
});

// Answers by URL so the sequence doesn't depend on call order: everything
// succeeds except the survey row itself, which is the step that fails.
const routeFetch = (url: string) => {
  if (url.includes('/nest-events/create')) return json({ event: { id: 1 } });
  if (url.includes('/nests/QA-DUP-1')) return json({ nest: { id: 9, status: 'hatched' } });
  if (url.includes('/morning-surveys')) return json({ error: 'QA simulated server error' }, false);
  return json({});
};

describe('flushOfflineSurveyQueue — replay after a partial failure', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => Promise.resolve(routeFetch(String(url))));
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('does not re-post a hatchling track event that already succeeded', async () => {
    queueSurvey({
      beach: { id: 1, name: 'Loggos 2' },
      survey,
      date: '2026-08-30',
      currentRegion: 'Lepeda',
    });

    // First attempt: the track event lands, the survey row fails.
    await flushOfflineSurveyQueue();
    // The entry is kept for another try, which is the intended behaviour.
    expect(getQueuedSurveys()).toHaveLength(1);

    // Second attempt, e.g. the next time the phone reports itself online.
    await flushOfflineSurveyQueue();

    const trackPosts = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes('/nest-events/create'),
    );
    expect(trackPosts).toHaveLength(1);
  });
});
