import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveSurveyDraft,
  loadSurveyDraft,
  clearSurveyDraft,
  hasSurveyContent,
  hasAnySurveyContent,
} from '../lib/surveyDraft';
import { SurveyData } from '../types';

const emptySurvey = (): SurveyData => ({
  firstTime: '',
  lastTime: '',
  region: '',
  tlGpsLat: '',
  tlGpsLng: '',
  trGpsLat: '',
  trGpsLng: '',
  nestTally: 0,
  nests: [],
  tracks: [],
  notes: '',
});

const draft = (surveys: Record<string, SurveyData>) => ({
  surveys,
  date: '2026-08-15',
  region: 'Lixouri',
  beach: 'Loggos 2',
});

describe('surveyDraft', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when nothing has been drafted', () => {
    expect(loadSurveyDraft()).toBeNull();
  });

  it('round-trips an in-progress survey', () => {
    const survey = { ...emptySurvey(), firstTime: '06:30', nestTally: 2 };
    saveSurveyDraft(draft({ 'Loggos 2': survey }));

    const restored = loadSurveyDraft();
    expect(restored).not.toBeNull();
    expect(restored!.surveys['Loggos 2']).toEqual(survey);
    expect(restored!.date).toBe('2026-08-15');
    expect(restored!.beach).toBe('Loggos 2');
    expect(restored!.region).toBe('Lixouri');
  });

  it('stores only the beaches with something entered', () => {
    saveSurveyDraft(draft({
      'Loggos 2': { ...emptySurvey(), notes: 'calm sea' },
      'Loggos 3': emptySurvey(),
    }));

    expect(Object.keys(loadSurveyDraft()!.surveys)).toEqual(['Loggos 2']);
  });

  it('clears the draft once every beach is back to empty', () => {
    saveSurveyDraft(draft({ 'Loggos 2': { ...emptySurvey(), notes: 'calm sea' } }));
    expect(loadSurveyDraft()).not.toBeNull();

    // What submitting does: each beach is reset to a blank survey.
    saveSurveyDraft(draft({ 'Loggos 2': emptySurvey() }));
    expect(loadSurveyDraft()).toBeNull();
  });

  it('discards a draft older than a day rather than reopening a past patrol', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T06:00:00Z'));
    saveSurveyDraft(draft({ 'Loggos 2': { ...emptySurvey(), firstTime: '06:30' } }));

    vi.setSystemTime(new Date('2026-08-15T22:00:00Z'));
    expect(loadSurveyDraft()).not.toBeNull();

    vi.setSystemTime(new Date('2026-08-16T09:00:00Z'));
    expect(loadSurveyDraft()).toBeNull();
    expect(localStorage.getItem('turtle_survey_draft')).toBeNull();
  });

  it('survives a corrupted entry', () => {
    localStorage.setItem('turtle_survey_draft', '{not json');
    expect(loadSurveyDraft()).toBeNull();
  });

  it('clearSurveyDraft removes a stored draft', () => {
    saveSurveyDraft(draft({ 'Loggos 2': { ...emptySurvey(), notes: 'x' } }));
    clearSurveyDraft();
    expect(loadSurveyDraft()).toBeNull();
  });

  describe('hasSurveyContent', () => {
    it('is false for an untouched survey', () => {
      expect(hasSurveyContent(emptySurvey())).toBe(false);
      expect(hasSurveyContent(undefined)).toBe(false);
    });

    it.each([
      ['a start time', { firstTime: '06:30' }],
      ['an end time', { lastTime: '09:00' }],
      ['a boundary fix', { tlGpsLat: '38.17' }],
      ['a nest tally', { nestTally: 1 }],
      ['notes', { notes: 'rough sea' }],
      ['a staged nest', { nests: [{ nestCode: 'LP-2', newNestDetails: '' }] }],
      ['a track', { tracks: [{ nestCode: 'LP-2', tracksToSea: '3', tracksLost: '0' }] }],
    ])('is true for %s', (_label, partial) => {
      expect(hasSurveyContent({ ...emptySurvey(), ...(partial as Partial<SurveyData>) })).toBe(true);
    });

    it('ignores whitespace-only notes', () => {
      expect(hasSurveyContent({ ...emptySurvey(), notes: '   ' })).toBe(false);
    });
  });

  it('hasAnySurveyContent looks across every beach', () => {
    expect(hasAnySurveyContent({ a: emptySurvey(), b: emptySurvey() })).toBe(false);
    expect(hasAnySurveyContent({ a: emptySurvey(), b: { ...emptySurvey(), nestTally: 1 } })).toBe(true);
  });
});
