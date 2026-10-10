// Regression: a Morning Survey that fails partway through is replayed from the
// top, so the calls that already succeeded are made again.
//
// submitBeachSurvey() in lib/offlineSurveyQueue.ts is a sequence of independent
// API calls - the morning survey row first (QA-072: it has to exist before a
// hatchling track can carry its survey_id), then every hatchling track as a
// nest event, then each staged nest/emergence. Nothing records how far it got.
// If the connection drops (or the server errors) partway through,
// flushOfflineSurveyQueue() replays the whole entry, and because
// flushOfflineSurveyQueue only *logs* a non-network failure without removing
// the entry, it does this again on every subsequent 'online' event.
//
// This is the same shape as the mid-request failure seen in the running app:
// on Morning Survey as Field Leader, with a later call stubbed to answer 500,
// submission failed after the earlier calls had already gone out, and the
// beach's data stayed in the form ready to be sent a second time.
//
// The assertion below is the property that should hold: replaying an entry
// must not duplicate work that already landed.
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
  tracks: [
    { nestCode: 'QA-DUP-1', tracksToSea: '5', tracksLost: '1' } as any,
    { nestCode: 'QA-DUP-2', tracksToSea: '3', tracksLost: '0' } as any,
  ],
  notes: '',
};

const json = (data: any, ok = true, status = ok ? 200 : 500) => ({
  ok,
  status,
  json: async () => data,
});

// The survey row always lands; the first track lands too, and the second
// track fails exactly once - simulating the connection dropping mid-walk,
// after some but not all of the tracks are in.
let trackCallCount = 0;
const routeFetch = (url: string) => {
  if (url.includes('/morning-surveys')) return json({ survey: { id: 42 } });
  if (url.includes('/nest-events/create')) {
    trackCallCount += 1;
    if (trackCallCount === 2) return json({ error: 'QA simulated server error' }, false);
    return json({ event: { id: 1 } });
  }
  return json({});
};

describe('flushOfflineSurveyQueue — replay after a partial failure', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    trackCallCount = 0;
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

    // First attempt: the survey row and the first track land, the second
    // track fails.
    await flushOfflineSurveyQueue();
    // The entry is kept for another try, which is the intended behaviour.
    expect(getQueuedSurveys()).toHaveLength(1);

    // Second attempt, e.g. the next time the phone reports itself online.
    await flushOfflineSurveyQueue();

    const surveyPosts = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes('/morning-surveys') && !String(url).includes('/nests') && !String(url).includes('/emergences'),
    );
    expect(surveyPosts).toHaveLength(1);

    const trackPosts = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes('/nest-events/create'),
    );
    // The first track posts once, the second posts twice (the failed attempt
    // plus the retry that lands) - three calls total, never a fourth.
    expect(trackPosts).toHaveLength(3);
  });

  // QA-070: a Volunteer is forbidden from flipping a nest's status directly
  // (403) - that transition happens server-side, only once a Field Leader
  // approves the reviewed nest_event. submitBeachSurvey must never attempt it.
  it('never PUTs a nest status update for a hatchling track, only posts the nest event', async () => {
    queueSurvey({
      beach: { id: 1, name: 'Loggos 2' },
      survey,
      date: '2026-08-30',
      currentRegion: 'Lepeda',
    });

    await flushOfflineSurveyQueue();
    await flushOfflineSurveyQueue();

    const nestUpdateCalls = mockFetch.mock.calls.filter(([url]) =>
      /\/nests\/.*\/update/.test(String(url)),
    );
    expect(nestUpdateCalls).toHaveLength(0);
  });

  // QA-072: the morning-survey row must exist before any hatchling track is
  // posted, so each track can carry the survey_id that folds it into the
  // survey's review - and a resumed/replayed submission must still send it.
  it('creates the survey before any track, and every track carries survey_id - including on replay', async () => {
    queueSurvey({
      beach: { id: 1, name: 'Loggos 2' },
      survey,
      date: '2026-08-30',
      currentRegion: 'Lepeda',
    });

    await flushOfflineSurveyQueue();
    await flushOfflineSurveyQueue();

    const calls = mockFetch.mock.calls.map(([url, init]) => ({ url: String(url), init }));
    const surveyIndex = calls.findIndex((c) => c.url.includes('/morning-surveys') && !c.url.includes('/nests') && !c.url.includes('/emergences'));
    const firstTrackIndex = calls.findIndex((c) => c.url.includes('/nest-events/create'));

    expect(surveyIndex).toBeGreaterThanOrEqual(0);
    expect(firstTrackIndex).toBeGreaterThan(surveyIndex);

    const trackBodies = calls
      .filter((c) => c.url.includes('/nest-events/create'))
      .map((c) => JSON.parse(c.init.body));
    expect(trackBodies.length).toBeGreaterThan(0);
    trackBodies.forEach((body) => expect(body.survey_id).toBe(42));
  });
});
