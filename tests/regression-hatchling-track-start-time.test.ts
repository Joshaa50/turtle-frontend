// Regression (QA-084): a hatchling track's nest-event start_time was hardcoded
// to "08:00:00" regardless of when the survey actually happened. submitBeachSurvey()
// in lib/offlineSurveyQueue.ts already has the beach's real survey start time on
// survey.firstTime (used for the morning-survey payload itself a few lines later),
// so the hatchling-track loop should use that instead of a fixed time.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queueSurvey, getQueuedSurveys, flushOfflineSurveyQueue } from '../lib/offlineSurveyQueue';
import { SurveyData } from '../types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const baseSurvey = (firstTime: string): SurveyData => ({
  firstTime,
  lastTime: '08:00',
  region: 'Lepeda',
  tlGpsLat: '38.15898', tlGpsLng: '20.55632',
  trGpsLat: '38.15836', trGpsLng: '20.55393',
  nestTally: 2,
  nests: [],
  tracks: [{ nestCode: 'QA-084-1', tracksToSea: '5', tracksLost: '1' } as any],
  notes: '',
});

const json = (data: any, ok = true, status = ok ? 200 : 500) => ({
  ok,
  status,
  json: async () => data,
});

const routeFetch = (url: string) => {
  if (url.includes('/nest-events/create')) return json({ event: { id: 1 } });
  if (url.includes('/morning-surveys')) return json({ survey: { id: 1 } });
  return json({});
};

describe('submitBeachSurvey — hatchling track start_time (QA-084)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => Promise.resolve(routeFetch(String(url))));
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('uses the survey\'s actual start time, not a hardcoded 08:00', async () => {
    const survey = baseSurvey('06:38');
    queueSurvey({
      beach: { id: 1, name: 'Loggos 2' },
      survey,
      date: '2026-08-30',
      currentRegion: 'Lepeda',
    });

    await flushOfflineSurveyQueue();

    const [, requestOptions] = mockFetch.mock.calls.find(([url]) =>
      String(url).includes('/nest-events/create'),
    )!;
    const body = JSON.parse(requestOptions.body as string);

    expect(body.start_time).toBe('2026-08-30 06:38:00');
    expect(body.start_time).not.toMatch(/08:00:00$/);
  });

  it('reflects a different firstTime value, confirming it is not coincidentally matching', async () => {
    const survey = baseSurvey('19:15');
    queueSurvey({
      beach: { id: 1, name: 'Loggos 2' },
      survey,
      date: '2026-08-30',
      currentRegion: 'Lepeda',
    });

    await flushOfflineSurveyQueue();

    const [, requestOptions] = mockFetch.mock.calls.find(([url]) =>
      String(url).includes('/nest-events/create'),
    )!;
    const body = JSON.parse(requestOptions.body as string);

    expect(body.start_time).toBe('2026-08-30 19:15:00');
  });
});
