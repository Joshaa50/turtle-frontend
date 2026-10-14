// Regression (QA-095): a volunteer picking a nest laid too recently for a
// hatchling track (an easy wrong-nest mistake) wasn't caught until the server
// rejected POST /nest-events/create - by which point earlier beaches in the
// same multi-beach walk had already been saved via POST /morning-surveys,
// leaving them cleared and required again. This pins that the nest picker
// itself now disables a too-recent nest and that picking a plausible nest
// still works normally.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import MorningSurvey from '../screens/MorningSurvey';
import { SurveyData } from '../types';

const BEACH = 'Vatsa';

// A plain function declaration, since it (along with any other identifier
// the factory below reads) needs to be hoisted along with vi.mock.
function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getNests: vi.fn().mockResolvedValue([
        { id: 1, nest_code: 'VA-4', beach: 'Vatsa', date_laid: isoDaysAgo(5), status: 'incubating' },
        { id: 2, nest_code: 'VA-1', beach: 'Vatsa', date_laid: isoDaysAgo(55), status: 'incubating' },
      ]),
      getSettings: vi.fn().mockResolvedValue(actual.DatabaseConnection.defaultSettings()),
    },
  };
});

const beaches = [
  { id: 1, name: BEACH, code: 'VA', station: 'Lix', survey_area: 'Vatsa' } as any,
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
      newNest={undefined}
      onClearNest={vi.fn()}
      surveys={surveys}
      onUpdateSurveys={setSurveys}
      beaches={beaches}
      currentBeach={BEACH}
      setCurrentBeach={vi.fn()}
      currentRegion="Vatsa"
      setCurrentRegion={vi.fn()}
      initialDate={isoDaysAgo(0)}
      onDateChange={vi.fn()}
    />
  );
};

describe('Hatchling track nest picker (QA-095)', () => {
  it('disables a nest laid too recently for a hatchling track, with an explanatory label', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByText(/add.*hatchling.*track/i));

    const select = await screen.findByLabelText('Select Nest Code') as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBeGreaterThan(1));

    const tooRecentOption = Array.from(select.options).find(o => o.value === 'VA-4')!;
    expect(tooRecentOption.disabled).toBe(true);
    expect(tooRecentOption.label).toMatch(/too recent/i);

    const plausibleOption = Array.from(select.options).find(o => o.value === 'VA-1')!;
    expect(plausibleOption.disabled).toBe(false);
  });

  it('lets a plausible nest be picked and submitted normally', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByText(/add.*hatchling.*track/i));

    const select = await screen.findByLabelText('Select Nest Code');
    await waitFor(() => expect((select as HTMLSelectElement).options.length).toBeGreaterThan(1));

    await userEvent.selectOptions(select, 'VA-1');
    fireEvent.change(screen.getByLabelText('Tracks to Sea'), { target: { value: '12' } });

    expect(screen.queryByText(/too recent for a hatchling track/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Add Track' })).not.toBeDisabled();
  });
});
