// Regression (QA-096): General Notes is shared across every beach in a walk
// by design (QA-039 - a note typed on one beach must reach every beach's
// survey submission, or reviewers lose it entirely). But the old label
// ("General Notes") and a placeholder naming the currently-selected beach
// both read as if the note were beach-specific, so a volunteer writing a
// beach-specific observation there would unknowingly have it copied onto
// every other beach's survey too. This pins that the label and placeholder
// now say plainly that the notes are shared across the whole walk.
import { render, screen } from '@testing-library/react';
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

const BEACH = 'Kounopetra';
const beaches = [
  { id: 1, name: BEACH, code: 'KN', station: 'Lix', survey_area: 'Vatsa' } as any,
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
      initialDate="2026-10-12"
      onDateChange={vi.fn()}
    />
  );
};

describe('Morning Survey — walk notes labeling (QA-096)', () => {
  it('labels the notes box as shared across the walk, not beach-specific', async () => {
    render(<Harness />);

    expect(screen.getByText('Walk Notes')).toBeInTheDocument();
    expect(screen.queryByText('General Notes')).toBeNull();
    expect(await screen.findByText(/saved on every beach in this walk/i)).toBeInTheDocument();

    const textarea = screen.getByLabelText('Walk Notes') as HTMLTextAreaElement;
    expect(textarea.placeholder).not.toMatch(new RegExp(BEACH));
    expect(textarea.placeholder.toLowerCase()).toContain('walk');
  });
});
