// QA-120: Morning Survey accepted first/last times later than the current
// time on a survey dated today - almost always a typo on the hour, the same
// class of mistake "last time before first time" is already blocked for.
// A survey for an earlier day legitimately has times "in the past" relative
// to now, so the block only applies when the survey's date is today.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import MorningSurvey from '../screens/MorningSurvey';
import { SurveyData } from '../types';
import { defaultFieldRequirements } from '../lib/fieldRequirements';

const mocks = vi.hoisted(() => ({
  getNests: vi.fn(),
  getSettings: vi.fn(),
  createMorningSurvey: vi.fn(),
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
    },
  };
});

const BEACH = 'Vatsa';
const beaches = [{ id: 10, name: BEACH, code: 'VA', station: 'Vatsa', survey_area: 'Vatsa' } as any];

const emptySurvey: SurveyData = {
  firstTime: '', lastTime: '', region: '',
  tlGpsLat: '', tlGpsLng: '', trGpsLat: '', trGpsLng: '',
  nestTally: 0, nests: [], tracks: [], notes: '',
};

const Harness: React.FC<{ initialDate: string }> = ({ initialDate }) => {
  const [surveys, setSurveys] = React.useState<Record<string, SurveyData>>({ [BEACH]: { ...emptySurvey } });
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
      initialDate={initialDate}
      onDateChange={vi.fn()}
    />
  );
};

describe('Morning Survey — times cannot be in the future on today (QA-120)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getNests.mockResolvedValue([]);
    mocks.getSettings.mockResolvedValue({ field_requirements: defaultFieldRequirements() });
    mocks.createMorningSurvey.mockResolvedValue({ survey: { id: 1 } });
    // "Now" is 05:10 local - early morning, same as the real repro. Only the
    // Date mock is needed (not fake timers for setTimeout/etc), which would
    // otherwise starve findBy/waitFor's own polling and time every test out.
    vi.setSystemTime(new Date(2026, 9, 15, 5, 10, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("rejects a first/last time later than now when the survey is dated today", async () => {
    render(<Harness initialDate="2026-10-15" />);

    fireEvent.change(await screen.findByLabelText(/first time/i), { target: { value: '06:05' } });
    fireEvent.change(screen.getByLabelText(/last time/i), { target: { value: '06:24' } });
    fireEvent.click(screen.getByRole('button', { name: /complete morning survey/i }));

    await waitFor(() => expect(screen.getAllByText(/cannot be in the future/i).length).toBeGreaterThan(0));
    expect(mocks.createMorningSurvey).not.toHaveBeenCalled();
  });

  it('still accepts a future-looking time when the survey is dated an earlier day', async () => {
    render(<Harness initialDate="2026-10-10" />);

    fireEvent.change(await screen.findByLabelText(/first time/i), { target: { value: '06:05' } });
    fireEvent.change(screen.getByLabelText(/last time/i), { target: { value: '06:24' } });
    fireEvent.click(screen.getByRole('button', { name: /complete morning survey/i }));

    await waitFor(() => expect(mocks.createMorningSurvey).toHaveBeenCalled());
    expect(screen.queryByText(/cannot be in the future/i)).toBeNull();
  });

  it('accepts times at or before the current time on a survey dated today', async () => {
    render(<Harness initialDate="2026-10-15" />);

    fireEvent.change(await screen.findByLabelText(/first time/i), { target: { value: '04:50' } });
    fireEvent.change(screen.getByLabelText(/last time/i), { target: { value: '05:05' } });
    fireEvent.click(screen.getByRole('button', { name: /complete morning survey/i }));

    await waitFor(() => expect(mocks.createMorningSurvey).toHaveBeenCalled());
    expect(screen.queryByText(/cannot be in the future/i)).toBeNull();
  });
});

// QA-128: the survey date itself could be set to a future day and still
// saved - the per-beach future-time checks above only fire when the date is
// today, so a future date skipped them entirely. Nest Entry already blocks a
// future "Date found" the same way.
describe('Morning Survey — survey date cannot be in the future (QA-128)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getNests.mockResolvedValue([]);
    mocks.getSettings.mockResolvedValue({ field_requirements: defaultFieldRequirements() });
    mocks.createMorningSurvey.mockResolvedValue({ survey: { id: 1 } });
    vi.setSystemTime(new Date(2026, 9, 15, 5, 10, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('rejects a survey dated tomorrow, without saving anything', async () => {
    render(<Harness initialDate="2026-10-16" />);

    fireEvent.change(await screen.findByLabelText(/first time/i), { target: { value: '06:05' } });
    fireEvent.change(screen.getByLabelText(/last time/i), { target: { value: '06:24' } });
    fireEvent.click(screen.getByRole('button', { name: /complete morning survey/i }));

    await waitFor(() => expect(screen.getAllByText(/survey date cannot be in the future/i).length).toBeGreaterThan(0));
    expect(mocks.createMorningSurvey).not.toHaveBeenCalled();
  });

  it('still accepts a survey dated today', async () => {
    render(<Harness initialDate="2026-10-15" />);

    fireEvent.change(await screen.findByLabelText(/first time/i), { target: { value: '04:50' } });
    fireEvent.change(screen.getByLabelText(/last time/i), { target: { value: '05:05' } });
    fireEvent.click(screen.getByRole('button', { name: /complete morning survey/i }));

    await waitFor(() => expect(mocks.createMorningSurvey).toHaveBeenCalled());
    expect(screen.queryByText(/survey date cannot be in the future/i)).toBeNull();
  });
});
