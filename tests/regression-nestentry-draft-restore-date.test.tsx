// QA-137: after a refresh, the Nest Entry draft restored beach, nest code
// and measurements, but Observation Date always reset to today. Two bugs
// stacked: `date` was missing from NestEntryFormState (so the restore code
// never read it back even though it was always saved), and App.tsx always
// passes a truthy `initialDate` (it defaults surveyDate to today at mount,
// regardless of how this screen was reached) - the same shape of bug
// QA-065 already fixed for `beach`, which only honours initialBeach when
// origin === 'survey'. initialDate is set here (truthy, like App.tsx's
// real default) with no survey origin, to pin down exactly that case.
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import NestEntry from '../screens/NestEntry';
import { saveNestEntryDraft } from '../lib/nestEntryDraft';

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getSettings: vi.fn().mockResolvedValue(actual.DatabaseConnection.defaultSettings()),
      getNests: vi.fn().mockResolvedValue([]),
    },
  };
});

const beaches = [
  { id: 1, name: 'Kounopas', code: 'KO', station: 'Lixouri', survey_area: 'Lixouri' },
] as any;

beforeEach(() => {
  localStorage.clear();
});

describe('NestEntry: draft restore keeps the date it was saved with (QA-137)', () => {
  it('restores Observation Date from the draft instead of defaulting to today', async () => {
    saveNestEntryDraft({
      isNest: true,
      formData: {
        beach: 'Kounopas',
        date: '2026-10-19',
        nestId: 'KO-4',
        relocated: false,
        relocationReason: '',
        eggsTakenOut: '',
        eggsPutBackIn: '',
        startTime: '',
        endTime: '',
        notes: '',
      },
      metrics: { h: '39', H: '57', w: '23', S: '' },
      coords: { lat: '', lng: '' },
      relocatedMetrics: { h: '', H: '', w: '', S: '' },
      relocatedCoords: { lat: '', lng: '' },
      triangulation: [],
      capturedSketch: null,
    });

    render(<NestEntry onBack={vi.fn()} beaches={beaches} initialIsNest initialDate="2026-10-21" />);

    await waitFor(() => {
      const dateInput = document.getElementById('observation-date') as HTMLInputElement;
      expect(dateInput.value).toBe('2026-10-19');
    });
  });
});
