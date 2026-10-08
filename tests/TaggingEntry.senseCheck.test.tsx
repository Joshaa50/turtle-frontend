// QA-067: the tail-measurement sense check hard-blocked a re-sighting
// whenever a tail figure came in smaller than a previous record - but tail
// measurements genuinely vary a few mm between observers, unlike the
// carapace lengths (which should only grow). Tail fields now ask for
// confirmation instead of blocking outright; carapace fields still block.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import TaggingEntry from '../screens/TaggingEntry';

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      defaultSettings: actual.DatabaseConnection.defaultSettings,
      getTurtles: vi.fn().mockResolvedValue([
        { id: 56, name: 'Amanda', tagId: 'KF-56', species: 'Caretta caretta', front_left_tag: 'KF-56' },
      ]),
      getObservers: vi.fn().mockResolvedValue([
        { id: 1, first_name: 'Nikos', last_name: 'Floros', role: 'Field Assistant', is_active: true, station: 'Lixouri' },
      ]),
      getTurtleSurveyEvents: vi.fn().mockResolvedValue({
        events: [{ event_date: '2026-09-01', tail_extension: 5, scl_max: 80 }],
      }),
      getSettings: vi.fn(),
      updateTurtle: vi.fn().mockResolvedValue({ turtle: { id: 56 } }),
      createTurtleEvent: vi.fn().mockResolvedValue({ event: { id: 2 } }),
    },
  };
});

import { DatabaseConnection } from '../services/Database';
import { defaultFieldRequirements } from '../lib/fieldRequirements';

const beaches = [{ id: 1, name: 'Makris Gialos', code: 'MG', station: 'Lixouri', survey_area: 'Lixouri' } as any];

beforeEach(() => {
  vi.clearAllMocks();
  (DatabaseConnection.getSettings as any).mockResolvedValue({
    seasons: { seasons: [], current: null },
    review_rules: (DatabaseConnection as any).defaultSettings().review_rules,
    lists: (DatabaseConnection as any).defaultSettings().lists,
    alerts: (DatabaseConnection as any).defaultSettings().alerts,
    field_requirements: defaultFieldRequirements(),
  });
});

const selectAmandaAndFillForm = async () => {
  fireEvent.click(await screen.findByText(/existing turtle/i));
  const search = await screen.findByPlaceholderText(/name, tag or id/i);
  fireEvent.change(search, { target: { value: 'Amanda' } });
  fireEvent.click(await screen.findByText('Amanda'));

  const location = document.getElementById('location') as HTMLSelectElement;
  fireEvent.change(location, { target: { value: 'Makris Gialos' } });
  const observer = document.getElementById('observer') as HTMLSelectElement;
  fireEvent.change(observer, { target: { value: 'Nikos Floros' } });

  for (const id of ['scl_max', 'scl_min', 'scw', 'ccl_max', 'ccl_min', 'ccw']) {
    fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value: '80' } });
  }
  fireEvent.change(document.getElementById('tail_extension') as HTMLInputElement, { target: { value: '4.8' } });
};

describe('TaggingEntry sense check (QA-067)', () => {
  it('asks for confirmation on a smaller tail reading instead of blocking it outright', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TaggingEntry onBack={vi.fn()} beaches={beaches} />);
    await selectAmandaAndFillForm();

    fireEvent.click(await screen.findByRole('button', { name: /save record/i }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Tail Extension/);
    await waitFor(() => expect(DatabaseConnection.updateTurtle).toHaveBeenCalled());
    expect(screen.queryByText(/Sense Check Failed/)).toBeNull();
  });

  it('does not save if the observer declines the confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<TaggingEntry onBack={vi.fn()} beaches={beaches} />);
    await selectAmandaAndFillForm();

    fireEvent.click(await screen.findByRole('button', { name: /save record/i }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(DatabaseConnection.updateTurtle).not.toHaveBeenCalled();
  });
});
