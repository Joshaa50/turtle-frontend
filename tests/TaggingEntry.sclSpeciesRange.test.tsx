// QA-102: SCL > CCL is now blocked, but there was still no plausibility
// check against the species itself - SCL Max 118cm for a loggerhead (whose
// real range on Kefalonia runs roughly 55-100cm) saved with no warning at
// all. Unlike SCL > CCL, which is geometrically impossible, an unusually
// large or small turtle can be real, so this is a confirmable warning (the
// same window.confirm pattern already used for the tail-measurement sense
// check), not a hard block.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
      getObservers: vi.fn().mockResolvedValue([
        { id: 1, first_name: 'Sofia', last_name: 'Manthou', role: 'Project Coordinator', is_active: true, station: 'Lixouri' },
      ]),
      getTurtleSurveyEvents: vi.fn().mockResolvedValue({ events: [] }),
      getSettings: vi.fn(),
      createTurtleWithEvent: vi.fn().mockResolvedValue({ turtle: { id: 99 }, event: { id: 1 } }),
    },
  };
});

import { DatabaseConnection } from '../services/Database';

const beaches = [{ id: 1, name: 'Loggos 3', code: 'LG3', station: 'Lixouri', survey_area: 'Lixouri' } as any];

const baseSettings = () => ({
  seasons: { seasons: [], current: null },
  review_rules: (DatabaseConnection as any).defaultSettings().review_rules,
  lists: (DatabaseConnection as any).defaultSettings().lists,
  alerts: (DatabaseConnection as any).defaultSettings().alerts,
  field_requirements: defaultFieldRequirements(),
});

const fillForm = async (scl: string) => {
  fireEvent.change(await waitFor(() => document.getElementById('turtle-name') as HTMLInputElement), { target: { value: 'QA Turtle' } });
  fireEvent.change(document.getElementById('observer') as HTMLSelectElement, { target: { value: 'Sofia Manthou' } });
  for (const id of ['scl_min', 'scw', 'ccl_max', 'ccl_min', 'ccw']) {
    fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value: '120' } });
  }
  fireEvent.change(document.getElementById('scl_max') as HTMLInputElement, { target: { value: scl } });
};

beforeEach(() => vi.clearAllMocks());

describe('TaggingEntry SCL species-range warning (QA-102)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('warns and blocks the save when SCL Max is outside the species range and the warning is declined', async () => {
    (DatabaseConnection.getSettings as any).mockResolvedValue(baseSettings());
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<TaggingEntry onBack={vi.fn()} beaches={beaches} />);
    await fillForm('118'); // loggerhead (default species) range is 55-100cm

    fireEvent.click(await screen.findByRole('button', { name: /save record/i }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(confirmSpy.mock.calls[0][0]).toMatch(/outside the usual 55-100cm range/i);
    expect(DatabaseConnection.createTurtleWithEvent).not.toHaveBeenCalled();
  });

  it('saves anyway once the warning is confirmed', async () => {
    (DatabaseConnection.getSettings as any).mockResolvedValue(baseSettings());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TaggingEntry onBack={vi.fn()} beaches={beaches} />);
    await fillForm('118');

    fireEvent.click(await screen.findByRole('button', { name: /save record/i }));

    await waitFor(() => expect(DatabaseConnection.createTurtleWithEvent).toHaveBeenCalled());
  });

  it('does not warn for an SCL Max inside the species range', async () => {
    (DatabaseConnection.getSettings as any).mockResolvedValue(baseSettings());
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<TaggingEntry onBack={vi.fn()} beaches={beaches} />);
    await fillForm('80');

    fireEvent.click(await screen.findByRole('button', { name: /save record/i }));

    await waitFor(() => expect(DatabaseConnection.createTurtleWithEvent).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
