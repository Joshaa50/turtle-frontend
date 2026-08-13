import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import MorningSurvey from '../screens/MorningSurvey';
import { SurveyData } from '../types';

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getNests: vi.fn().mockResolvedValue([]),
    },
  };
});

const BEACH = 'Loggos 3';

const beaches = [
  { id: 1, name: BEACH, code: 'LG3', station: 'Lix', survey_area: 'Lepeda' } as any,
];

const emptySurvey: SurveyData = {
  firstTime: '', lastTime: '', region: '',
  tlGpsLat: '', tlGpsLng: '', trGpsLat: '', trGpsLng: '',
  nestTally: 0, nests: [], tracks: [], notes: '',
};

// Renders MorningSurvey with the surveys record held in real state, so the
// component's own updates are reflected back the way App.tsx wires them.
const Harness: React.FC<{ newNest?: any }> = ({ newNest }) => {
  const [surveys, setSurveys] = React.useState<Record<string, SurveyData>>({
    [BEACH]: { ...emptySurvey },
  });
  return (
    <MorningSurvey
      onNavigate={vi.fn()}
      newNest={newNest}
      onClearNest={vi.fn()}
      surveys={surveys}
      onUpdateSurveys={setSurveys}
      beaches={beaches}
      currentBeach={BEACH}
      setCurrentBeach={vi.fn()}
      currentRegion="Lepeda"
      setCurrentRegion={vi.fn()}
      initialDate="2026-08-12"
      onDateChange={vi.fn()}
    />
  );
};

const tallyValue = () =>
  Number((document.getElementById('nestTally') as HTMLInputElement).value);

describe('Morning Survey nest tally', () => {
  beforeEach(() => vi.clearAllMocks());

  it('increments when a nest is added', async () => {
    render(<Harness newNest={{
      entryId: 'e1', isEmergence: false, nest_code: 'LG3-3',
      distance_to_sea_s: 6, payload: {},
    }} />);

    await waitFor(() => expect(tallyValue()).toBe(1));
  });

  it('does not increment for an emergence', async () => {
    render(<Harness newNest={{
      entryId: 'e2', isEmergence: true, distance_to_sea_s: 9, payload: {},
    }} />);

    await waitFor(() => expect(screen.getByText('Emergence')).toBeDefined());
    expect(tallyValue()).toBe(0);
  });

  it('decrements again when the nest is removed', async () => {
    render(<Harness newNest={{
      entryId: 'e3', isEmergence: false, nest_code: 'LG3-3',
      distance_to_sea_s: 6, payload: {},
    }} />);

    await waitFor(() => expect(tallyValue()).toBe(1));

    fireEvent.click(screen.getByTitle('Remove record'));
    // Deletion is confirmed through a modal rather than applied immediately.
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(tallyValue()).toBe(0));
  });

  it('marks staged records as pending', async () => {
    render(<Harness newNest={{
      entryId: 'e4', isEmergence: false, nest_code: 'LG3-3',
      distance_to_sea_s: 6, payload: {},
    }} />);

    await waitFor(() => expect(screen.getByText('Pending')).toBeDefined());
  });
});
