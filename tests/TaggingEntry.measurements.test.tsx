// Regression: a blank measurement used to be silently sent to the API as 0,
// which is indistinguishable from a turtle that really was measured at 0cm,
// and always satisfied the backend's "measurements are required" check
// regardless of what a coordinator had configured.
//
// What these cases pin down:
//   - with measurements required (the default) a blank one blocks the save
//     before any request is made
//   - once a coordinator marks measurements recommended, a blank one saves,
//     and is sent as null - never a substituted 0
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import TaggingEntry from '../screens/TaggingEntry';
import { defaultFieldRequirements } from '../lib/fieldRequirements';

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      defaultSettings: actual.DatabaseConnection.defaultSettings,
      getTurtles: vi.fn().mockResolvedValue([]),
      getUsers: vi.fn().mockResolvedValue([
        { id: 1, first_name: 'Sofia', last_name: 'Manthou', role: 'Project Coordinator', is_active: true, station: 'Lixouri' },
      ]),
      getSettings: vi.fn(),
      createTurtleWithEvent: vi.fn().mockResolvedValue({ turtle: { id: 99 }, event: { id: 1 } }),
    },
  };
});

import { DatabaseConnection } from '../services/Database';

const beaches = [{ id: 1, name: 'Loggos 2', code: 'LG2', station: 'Lixouri', survey_area: 'Lixouri' } as any];

const settingsWith = (measurementLevel: 'required' | 'recommended') => {
  const levels = defaultFieldRequirements();
  levels.turtle.measurements = measurementLevel;
  return {
    seasons: { seasons: [], current: null },
    review_rules: (DatabaseConnection as any).defaultSettings().review_rules,
    lists: (DatabaseConnection as any).defaultSettings().lists,
    alerts: (DatabaseConnection as any).defaultSettings().alerts,
    field_requirements: levels,
  };
};

const fillMinimumFields = async () => {
  const name = await waitFor(() => document.getElementById('turtle-name') as HTMLInputElement);
  fireEvent.change(name, { target: { value: 'QA Turtle' } });
  const observer = document.getElementById('observer') as HTMLSelectElement;
  fireEvent.change(observer, { target: { value: 'Sofia Manthou' } });
};

beforeEach(() => vi.clearAllMocks());

describe('TaggingEntry measurements', () => {
  it('blocks the save when a measurement is blank and measurements are required (the default)', async () => {
    (DatabaseConnection.getSettings as any).mockResolvedValue(settingsWith('required'));
    render(<TaggingEntry onBack={vi.fn()} beaches={beaches} />);
    await fillMinimumFields();

    fireEvent.click(await screen.findByRole('button', { name: /save record/i }));

    await waitFor(() => expect(screen.getByText(/measurement is required/i)).toBeTruthy());
    expect(DatabaseConnection.createTurtleWithEvent).not.toHaveBeenCalled();
  });

  it('saves with null, not 0, once measurements are made recommended', async () => {
    (DatabaseConnection.getSettings as any).mockResolvedValue(settingsWith('recommended'));
    render(<TaggingEntry onBack={vi.fn()} beaches={beaches} />);
    await fillMinimumFields();
    // Wait for the recommended setting to actually take effect before saving.
    await waitFor(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /save record/i }));
      expect(DatabaseConnection.createTurtleWithEvent).toHaveBeenCalled();
    });

    const payload = (DatabaseConnection.createTurtleWithEvent as any).mock.calls[0][0];
    expect(payload.scl_max).toBeNull();
    expect(payload.total_tail_length).toBeNull();
  });
});
