// QA-135: Morning Survey's "N nests are on record - USE N" hint filtered
// only by beach, never by the survey's own date - so a back-dated survey
// (typed up a day or more after the walk) got a count that included nests
// found AFTER the date being entered. Reported case: Xi showed "4 nests are
// on record - USE 4" for a 05/10 survey, when none of Xi's nests existed
// until the 14th.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import MorningSurvey from '../screens/MorningSurvey';
import { DatabaseConnection } from '../services/Database';
import { SurveyData } from '../types';

const BEACH = 'Xi';

const beaches = [
  { id: 1, name: BEACH, code: 'XI', station: 'Lix', survey_area: 'Lixouri' } as any,
];

const emptySurvey: SurveyData = {
  firstTime: '', lastTime: '', region: '',
  tlGpsLat: '', tlGpsLng: '', trGpsLat: '', trGpsLng: '',
  nestTally: 0, nests: [], tracks: [], notes: '',
};

const Harness: React.FC<{ initialDate: string }> = ({ initialDate }) => {
  const [surveys, setSurveys] = React.useState<Record<string, SurveyData>>({
    [BEACH]: { ...emptySurvey },
  });
  return (
    <MorningSurvey
      onNavigate={vi.fn()}
      newNest={null}
      onClearNest={vi.fn()}
      surveys={surveys}
      onUpdateSurveys={setSurveys}
      beaches={beaches}
      currentBeach={BEACH}
      setCurrentBeach={vi.fn()}
      currentRegion="Lixouri"
      setCurrentRegion={vi.fn()}
      initialDate={initialDate}
      onDateChange={vi.fn()}
    />
  );
};

describe('Morning Survey: the nest-count hint respects the survey date, not just the beach (QA-135)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(DatabaseConnection, 'getSettings').mockResolvedValue(DatabaseConnection.defaultSettings());
    vi.spyOn(DatabaseConnection, 'getNests').mockResolvedValue([
      { id: 1, nest_code: 'XI-4', beach: BEACH, status: 'incubating', date_laid: '2026-10-14' },
      { id: 2, nest_code: 'XI-5', beach: BEACH, status: 'incubating', date_laid: '2026-10-14' },
      { id: 3, nest_code: 'XI-6', beach: BEACH, status: 'incubating', date_laid: '2026-10-19' },
      { id: 4, nest_code: 'XI-7', beach: BEACH, status: 'incubating', date_laid: '2026-10-19' },
    ] as any);
  });

  it('counts zero nests for a survey dated before any of the beach\'s nests were found', async () => {
    render(<Harness initialDate="2026-10-05" />);

    await waitFor(() => expect(DatabaseConnection.getNests).toHaveBeenCalled());
    expect(screen.queryByText(/nests? (is|are) on record for this beach/i)).not.toBeInTheDocument();
  });

  it('counts only the nests found on or before the survey date, not every nest on the beach', async () => {
    render(<Harness initialDate="2026-10-14" />);

    await waitFor(() => expect(DatabaseConnection.getNests).toHaveBeenCalled());
    expect(await screen.findByText(/2 nests are on record for this beach/i)).toBeInTheDocument();
    expect(screen.queryByText(/4 nests are on record for this beach/i)).not.toBeInTheDocument();
  });

  it('counts every nest once the survey date reaches the most recent one', async () => {
    render(<Harness initialDate="2026-10-19" />);

    await waitFor(() => expect(DatabaseConnection.getNests).toHaveBeenCalled());
    expect(await screen.findByText(/4 nests are on record for this beach/i)).toBeInTheDocument();
  });
});
