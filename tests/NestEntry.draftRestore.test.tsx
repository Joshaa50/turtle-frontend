// QA-065: after a refresh, the Nest Entry draft restored the measurements
// and GPS but reset Beach Location to whichever beach loads first - the
// draft's own beach field was never read back, even though it was always
// saved. The nest code is generated from the beach, so this filed the
// record on the wrong beach with the wrong code.
//
// The real trigger: App.tsx passes its own Morning-Survey-in-progress beach
// state down as initialBeach unconditionally, including on a plain "Record
// a Nest" visit that has nothing to do with any survey - it defaults to
// "Loggos 2" the moment beaches load, which clobbered a just-restored draft
// beach a beat after mount. initialBeach is set here (truthy, like that
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
  { id: 1, name: 'Loggos 2', code: 'LG2', station: 'Lixouri', survey_area: 'Lixouri' },
  { id: 2, name: 'Megas Lakkos', code: 'MA', station: 'Lixouri', survey_area: 'Lixouri' },
] as any;

beforeEach(() => {
  localStorage.clear();
});

describe('NestEntry: draft restore keeps the beach it was saved with (QA-065)', () => {
  it('restores Beach Location from the draft instead of defaulting to the first beach', async () => {
    saveNestEntryDraft({
      isNest: true,
      formData: {
        beach: 'Megas Lakkos',
        nestId: 'MA-4',
        relocated: false,
        relocationReason: '',
        eggsTakenOut: '',
        eggsPutBackIn: '',
        startTime: '',
        endTime: '',
      },
      metrics: { h: '38', H: '', w: '', S: '17' },
      coords: { lat: '38.16112', lng: '20.42476' },
      relocatedMetrics: { h: '', H: '', w: '', S: '' },
      relocatedCoords: { lat: '', lng: '' },
      triangulation: [],
      capturedSketch: null,
    });

    render(<NestEntry onBack={vi.fn()} beaches={beaches} initialBeach="Loggos 2" />);

    await waitFor(() => {
      const select = document.getElementById('beach-location') as HTMLSelectElement;
      expect(select.value).toBe('Megas Lakkos');
    });
  });
});
