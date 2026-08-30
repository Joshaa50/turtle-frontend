// Regression: Morning Survey's "Total Nest Count" accepts a typed negative.
//
// Observed in the running app as Field Leader on Morning Survey / Loggos 2:
// triple-clicking the tally and typing "-9" leaves the field reading -9. The
// minus button clamps at 0 (Math.max(0, tally - 1)), but the text path is
// `parseInt(e.target.value) || 0`, which has no floor. "Complete Morning
// Survey" then walks straight past the negative tally and reports the *next*
// beach's missing coordinates instead, so nothing ever flags it, and
// lib/offlineSurveyQueue.ts maps it onto the wire as
// `protected_nest_count: survey.nestTally`.
//
// Second, smaller consequence of the same value: surveyDraft's
// hasSurveyContent() tests `(survey.nestTally || 0) > 0`, so a survey whose
// only content is a negative tally is not mirrored to localStorage at all. On
// the live app, after typing -9 and waiting past the 500ms debounce,
// localStorage.getItem('turtle_survey_draft') was still null - a refresh at
// that point loses the entry with no warning.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import MorningSurvey from '../screens/MorningSurvey';
import { SurveyData } from '../types';
import { hasSurveyContent } from '../lib/surveyDraft';

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
      currentRegion="Lepeda"
      setCurrentRegion={vi.fn()}
      initialDate="2026-08-30"
      onDateChange={vi.fn()}
    />
  );
};

const tallyInput = () => document.getElementById('nestTally') as HTMLInputElement;

describe('Morning Survey nest tally — negative input', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not accept a negative nest count typed into the field', async () => {
    render(<Harness />);
    await waitFor(() => expect(tallyInput()).toBeTruthy());

    fireEvent.change(tallyInput(), { target: { value: '-9' } });

    await waitFor(() => {
      expect(Number(tallyInput().value)).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('surveyDraft — a negative tally is work too', () => {
  it('treats a survey carrying only a nest tally as content worth keeping', () => {
    // -9 should never have been storable in the first place, but while it is,
    // it must not make the whole morning invisible to the draft mirror.
    expect(hasSurveyContent({ ...emptySurvey, nestTally: -9 })).toBe(true);
  });
});
