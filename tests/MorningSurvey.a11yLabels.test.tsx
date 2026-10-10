import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import MorningSurvey from '../screens/MorningSurvey';
import { SurveyData } from '../types';
import { COORD_LABEL } from '../lib/utils';

// QA-074: several fields on this screen had a visible label sitting right
// next to the input, but no htmlFor/id wiring - so a screen reader announced
// them as unlabeled. getByLabelText only passes if that association is real.

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getNests: vi.fn().mockResolvedValue([]),
      getSettings: vi.fn().mockResolvedValue(actual.DatabaseConnection.defaultSettings()),
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

const Harness: React.FC = () => {
  const [surveys, setSurveys] = React.useState<Record<string, SurveyData>>({
    [BEACH]: { ...emptySurvey },
  });
  return (
    <MorningSurvey
      onNavigate={vi.fn()}
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

describe('Morning Survey accessibility labels (QA-074)', () => {
  it('associates Survey Area, Date, First time and Nest Tally with a real <label>', async () => {
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByLabelText('Survey Area')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText(/First time on/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Total Nest Count')).toBeInTheDocument();
  });

  it('associates the GPS coordinate inputs with a real <label>, not just a nearby span', async () => {
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getAllByLabelText(COORD_LABEL.lat).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByLabelText(COORD_LABEL.lng).length).toBeGreaterThan(0);
  });

  it('gives the nest tally Minus/Plus buttons an accessible name', async () => {
    render(<Harness />);

    expect(await screen.findByRole('button', { name: /decrease nest tally/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /increase nest tally/i })).toBeInTheDocument();
  });
});
