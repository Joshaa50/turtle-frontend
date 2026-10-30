// QA-159: a future Observation Date triggered both the blocking "Date found
// cannot be in the future" error and the "outside every nesting season...
// you can still save it" hint at the same time - the two contradict each
// other, since a future date in fact cannot be saved. This asserts the
// out-of-season hint is suppressed for a future date (where it's misleading)
// while still showing up, as before, for a past date outside every
// configured season (where it's correct: the save is actually allowed).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import NestEntry from '../screens/NestEntry';

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  const seasons = [
    { id: 's1', name: '2026 Nesting Season', start: '2026-05-01', end: '2026-10-31' },
  ];
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getSettings: vi.fn().mockResolvedValue({
        ...actual.DatabaseConnection.defaultSettings(),
        seasons: { seasons, current: null },
      }),
      getNests: vi.fn().mockResolvedValue([]),
      createNest: vi.fn().mockResolvedValue({}),
    },
  };
});

const beaches = [
  { id: 1, name: 'Loggos 4', code: 'LG4', station: 'Lixouri', survey_area: 'Lixouri', gps_lat: 38.18412, gps_long: 20.43978 },
] as any;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('NestEntry: out-of-season hint suppressed for a future date (QA-159)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows only the future-date error, not the out-of-season hint, for a future date', async () => {
    render(<NestEntry onBack={vi.fn()} beaches={beaches} initialIsNest />);

    const dateInput = await screen.findByLabelText('Observation Date', { exact: false });
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    fireEvent.click(await screen.findByText('SAVE ENTRY'));

    expect(await screen.findByText(/Date found cannot be in the future\./)).toBeTruthy();
    expect(screen.queryByText(/You can still save it/)).toBeNull();
  });

  it('still shows the out-of-season hint for a past date outside every configured season', async () => {
    render(<NestEntry onBack={vi.fn()} beaches={beaches} initialIsNest />);

    const dateInput = await screen.findByLabelText('Observation Date', { exact: false });
    fireEvent.change(dateInput, { target: { value: '2024-01-15' } });

    expect(await screen.findByText(/You can still save it/)).toBeTruthy();
  });
});
