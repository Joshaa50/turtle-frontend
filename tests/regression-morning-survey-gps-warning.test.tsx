// Regression: a QA pass found a demo morning survey submitted with corner GPS
// in the UK (51.75, -0.34) while the rest of the project's data is on
// Kefalonia. Nest Entry already runs beachLocationWarning against typed
// coordinates; Morning Survey never imported it at all, so nothing in this
// form - live or on save - would have said the position was implausible.
// This pins that the warning now shows, and that it clears once the
// coordinate is back in range.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
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
      getSettings: vi.fn().mockResolvedValue(actual.DatabaseConnection.defaultSettings()),
    },
  };
});

const BEACH = 'Vrakhinari';
// A real reference point on Kefalonia, with a tight radius so a UK coordinate
// is unambiguously outside it.
const beaches = [
  { id: 11, name: BEACH, code: 'VR', station: 'Lix', survey_area: 'Vatsa', gps_lat: 38.16218, gps_long: 20.37755, radius_m: 150 } as any,
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
      currentRegion="Vatsa"
      setCurrentRegion={vi.fn()}
      initialDate="2026-10-01"
      onDateChange={vi.fn()}
    />
  );
};

describe('Morning Survey — corner GPS plausibility', () => {
  it('warns when a corner coordinate lands far from the beach', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.type(container.querySelector('#tlGpsLat')!, '51.75214');
    await user.type(container.querySelector('#tlGpsLng')!, '-0.34275');

    await waitFor(() => {
      expect(screen.getByText(/from Vrakhinari/i)).toBeInTheDocument();
    });
  });

  it('does not warn once the coordinate is close to the beach', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.type(container.querySelector('#tlGpsLat')!, '38.16220');
    await user.type(container.querySelector('#tlGpsLng')!, '20.37760');

    expect(screen.queryByText(/from Vrakhinari/i)).not.toBeInTheDocument();
  });

  it('shows a live format message before Save is ever clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    // Out of range for a latitude - invalid the moment it's typed, not just on save.
    await user.type(container.querySelector('#tlGpsLat')!, '95.5');

    await waitFor(() => {
      expect(screen.getByText(/Latitude must be between -90 and 90/i)).toBeInTheDocument();
    });
  });
});
