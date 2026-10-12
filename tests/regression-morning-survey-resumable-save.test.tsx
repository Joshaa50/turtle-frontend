// Regression (QA-095, part b): in a multi-beach walk, each beach is POSTed to
// /morning-surveys before that beach's hatchling tracks are posted. If a
// later beach's track is rejected for a genuine (non-network) reason, the
// earlier beaches were already saved and their on-screen data cleared - but
// retrying Complete Morning Survey re-ran validation and the save loop from
// scratch, asking the volunteer to re-fill an already-saved beach and
// re-POSTing a survey row that already exists (a duplicate). This pins that
// a retry: (1) skips an already-saved beach's validation and resubmission,
// and (2) resumes the beach that failed from where it stopped, rather than
// re-creating its /morning-surveys row.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import MorningSurvey from '../screens/MorningSurvey';
import { AppView, SurveyData } from '../types';
import { defaultFieldRequirements } from '../lib/fieldRequirements';

const mocks = vi.hoisted(() => ({
  getNests: vi.fn(),
  getSettings: vi.fn(),
  createMorningSurvey: vi.fn(),
  createNestEvent: vi.fn(),
}));

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getNests: mocks.getNests,
      getSettings: mocks.getSettings,
      createMorningSurvey: mocks.createMorningSurvey,
      createNestEvent: mocks.createNestEvent,
    },
  };
});

const REGION = 'Vatsa';
const BEACH_A = 'Kounopetra';
const BEACH_B = 'Vrakhinari';

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

const beaches = [
  { id: 1, name: BEACH_A, code: 'KN', station: 'Lix', survey_area: REGION } as any,
  { id: 2, name: BEACH_B, code: 'VR', station: 'Lix', survey_area: REGION } as any,
];

const emptySurvey: SurveyData = {
  firstTime: '', lastTime: '', region: '',
  tlGpsLat: '', tlGpsLng: '', trGpsLat: '', trGpsLng: '',
  nestTally: 0, nests: [], tracks: [], notes: '',
};

const Harness: React.FC<{ onNavigate: (v: AppView) => void }> = ({ onNavigate }) => {
  const [surveys, setSurveys] = React.useState<Record<string, SurveyData>>({
    [BEACH_A]: { ...emptySurvey },
    [BEACH_B]: { ...emptySurvey },
  });
  const [currentBeach, setCurrentBeach] = React.useState(BEACH_A);
  const [currentRegion, setCurrentRegion] = React.useState(REGION);
  return (
    <MorningSurvey
      onNavigate={onNavigate}
      onClearNest={vi.fn()}
      surveys={surveys}
      onUpdateSurveys={setSurveys}
      beaches={beaches}
      currentBeach={currentBeach}
      setCurrentBeach={setCurrentBeach}
      currentRegion={currentRegion}
      setCurrentRegion={setCurrentRegion}
      initialDate="2026-10-12"
      onDateChange={vi.fn()}
    />
  );
};

describe('Morning Survey — resumable multi-beach save (QA-095)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getNests.mockResolvedValue([
      // Laid well past the hatchling-track plausibility window, so this
      // isn't blocked by the QA-095 part-a nest-picker fix - the rejection
      // in this test comes from somewhere else entirely.
      { id: 1, nest_code: 'VR-1', beach: BEACH_B, date_laid: isoDaysAgo(60), status: 'incubating' },
    ]);
    mocks.getSettings.mockResolvedValue({ field_requirements: defaultFieldRequirements() });
    let surveyCounter = 0;
    mocks.createMorningSurvey.mockImplementation(async () => ({
      survey: { id: 500 + (surveyCounter += 1) },
    }));
  });

  it('does not re-fill or re-post an already-saved beach when a later beach fails and is retried', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    // First attempt: the track rejects for a genuine reason (not a network
    // error), so it must surface as a real error rather than being queued.
    mocks.createNestEvent
      .mockRejectedValueOnce(new Error('Simulated validation failure'))
      .mockResolvedValue({ event: { id: 999 } });

    render(<Harness onNavigate={onNavigate} />);

    // Fill beach A (Kounopetra), currently selected.
    fireEvent.change(await screen.findByLabelText(/first time/i), { target: { value: '06:00' } });
    fireEvent.change(screen.getByLabelText(/last time/i), { target: { value: '07:00' } });

    // Switch to beach B (Vrakhinari) and fill it too.
    fireEvent.click(screen.getByRole('button', { name: new RegExp(BEACH_B) }));
    fireEvent.change(await screen.findByLabelText(/first time/i), { target: { value: '06:10' } });
    fireEvent.change(screen.getByLabelText(/last time/i), { target: { value: '07:10' } });

    // Add a hatchling track to beach B that the (mocked) server will reject.
    fireEvent.click(screen.getByText(/add.*hatchling.*track/i));
    const nestSelect = await screen.findByLabelText('Select Nest Code');
    await waitFor(() => expect((nestSelect as HTMLSelectElement).options.length).toBeGreaterThan(1));
    await user.selectOptions(nestSelect, 'VR-1');
    fireEvent.change(screen.getByLabelText('Tracks to Sea'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Track' }));

    // First Complete Morning Survey: beach A saves fine, beach B's survey
    // row saves but its track is rejected.
    fireEvent.click(screen.getByRole('button', { name: /complete morning survey/i }));

    await waitFor(() => expect(screen.getByText(/simulated validation failure/i)).toBeInTheDocument());
    expect(mocks.createMorningSurvey).toHaveBeenCalledTimes(2);
    expect(mocks.createNestEvent).toHaveBeenCalledTimes(1);

    // Retry: beach A must not be asked for again (its data was cleared,
    // but it's already saved), and beach B must resume rather than
    // re-creating its /morning-surveys row.
    fireEvent.click(screen.getByRole('button', { name: /complete morning survey/i }));

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(AppView.DASHBOARD));

    expect(screen.queryByText(/please fill in all survey times for kounopetra/i)).toBeNull();
    // Still only 2 createMorningSurvey calls total: no duplicate survey row
    // was created for either beach on the retry.
    expect(mocks.createMorningSurvey).toHaveBeenCalledTimes(2);
    // The track call is retried (1 failed + 1 succeeded), not skipped.
    expect(mocks.createNestEvent).toHaveBeenCalledTimes(2);
  });
});
