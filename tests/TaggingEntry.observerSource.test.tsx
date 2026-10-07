// QA-043: Tag a Turtle's Observer dropdown used to populate from getUsers(),
// which is Coordinator/Field Leader only - so a Field Assistant's dropdown
// came back empty and the form couldn't be saved at all. It must come from
// getObservers() (any recording role), not getUsers(), and getUsers() must
// never be called by this screen.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import TaggingEntry from '../screens/TaggingEntry';

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  const { defaultFieldRequirements } = await vi.importActual<any>('../lib/fieldRequirements');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      defaultSettings: actual.DatabaseConnection.defaultSettings,
      getTurtles: vi.fn().mockResolvedValue([]),
      getUsers: vi.fn().mockRejectedValue(new Error('403: should not be called by this screen')),
      getObservers: vi.fn().mockResolvedValue([
        { id: 22, first_name: 'Nikos', last_name: 'Floros', role: 'Field Assistant', is_active: true, station: 'Lixouri' },
      ]),
      getSettings: vi.fn().mockResolvedValue({
        seasons: { seasons: [], current: null },
        review_rules: actual.DatabaseConnection.defaultSettings().review_rules,
        lists: actual.DatabaseConnection.defaultSettings().lists,
        alerts: actual.DatabaseConnection.defaultSettings().alerts,
        field_requirements: defaultFieldRequirements(),
      }),
    },
  };
});

import { DatabaseConnection } from '../services/Database';

const beaches = [{ id: 1, name: 'Loggos 2', code: 'LG2', station: 'Lixouri', survey_area: 'Lixouri' } as any];

describe('TaggingEntry — Observer source (QA-043)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('populates the Observer dropdown from getObservers, and never calls getUsers', async () => {
    render(<TaggingEntry onBack={vi.fn()} beaches={beaches} />);

    await waitFor(() => expect(DatabaseConnection.getObservers).toHaveBeenCalled());
    expect(DatabaseConnection.getUsers).not.toHaveBeenCalled();

    const observer = await waitFor(() => document.getElementById('observer') as HTMLSelectElement);
    await waitFor(() => expect(observer.options.length).toBeGreaterThan(1));
    expect(screen.getByText(/Nikos Floros/)).toBeInTheDocument();
  });
});
