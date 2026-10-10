// QA-074: a wide batch of fields on this screen had a visible label sitting
// right next to the input, but no htmlFor/id wiring - so a screen reader
// announced them as unlabeled. A minority (the tag number/address cells)
// have no usable nearby text at all, and need an aria-label instead.
// getByLabelText only passes if the association is real.
import { render, screen, waitFor } from '@testing-library/react';
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
      getTurtles: vi.fn().mockResolvedValue([]),
      getObservers: vi.fn().mockResolvedValue([
        { id: 1, first_name: 'Sofia', last_name: 'Manthou', role: 'Project Coordinator', is_active: true, station: 'Lixouri' },
      ]),
      getSettings: vi.fn().mockResolvedValue(actual.DatabaseConnection.defaultSettings()),
      createTurtleWithEvent: vi.fn(),
    },
  };
});

const beaches = [{ id: 1, name: 'Loggos 2', code: 'LG2', station: 'Lixouri', survey_area: 'Lixouri' } as any];

beforeEach(() => vi.clearAllMocks());

describe('TaggingEntry accessibility labels (QA-074)', () => {
  it('associates Turtle Name, Species, Observer and SCL Max with a real <label>', async () => {
    render(<TaggingEntry onBack={vi.fn()} beaches={beaches} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Turtle Name')).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/^Species/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Observer/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^SCL Max/)).toBeInTheDocument();
  });

  it('gives the per-tag number and address inputs an accessible name', async () => {
    render(<TaggingEntry onBack={vi.fn()} beaches={beaches} />);

    await waitFor(() => {
      expect(screen.getByLabelText('FL tag number')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('FL tag address')).toBeInTheDocument();
  });
});
