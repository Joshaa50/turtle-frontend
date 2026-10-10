// QA-083: Project Settings > Form fields lists "Notes" as a recommended
// field for Nest Entry, but there was no UI field bound to it - the save
// handler only ever built notes from auto-generated relocation metadata, so
// a plain (non-relocated) nest always sent notes: null no matter what the
// observer typed anywhere else. This exercises the free-text Notes field on
// the nest path and confirms it reaches DatabaseConnection.createNest.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import NestEntry from '../screens/NestEntry';

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getSettings: vi.fn().mockResolvedValue(actual.DatabaseConnection.defaultSettings()),
      getNests: vi.fn().mockResolvedValue([]),
      createNest: vi.fn().mockResolvedValue({}),
    },
  };
});

import { DatabaseConnection } from '../services/Database';

const beaches = [
  { id: 1, name: 'Loggos 2', code: 'LG2', station: 'Lixouri', survey_area: 'Lixouri' },
] as any;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('NestEntry: nest-path Notes field (QA-083)', () => {
  it('sends the typed free-text notes to createNest for a non-relocated nest', async () => {
    render(<NestEntry onBack={vi.fn()} beaches={beaches} initialIsNest />);

    // Required fields for a plain (non-relocated) nest under default field
    // requirements: depth (h), distance to sea (S), and GPS.
    fireEvent.change(screen.getByLabelText('h (Depth top)', { exact: false }), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('S (Dist to sea)', { exact: false }), { target: { value: '20' } });
    fireEvent.change(document.getElementById('original-lat') as HTMLInputElement, { target: { value: '38.15900' } });
    fireEvent.change(document.getElementById('original-lng') as HTMLInputElement, { target: { value: '20.59900' } });

    fireEvent.change(screen.getByPlaceholderText('Any other observations about this nest...'), {
      target: { value: 'Nest found just above the tideline, marked with bamboo stakes.' },
    });

    fireEvent.click(screen.getByText('SAVE ENTRY'));

    await waitFor(() => {
      expect(DatabaseConnection.createNest).toHaveBeenCalled();
    });

    const payload = (DatabaseConnection.createNest as any).mock.calls[0][0];
    expect(payload.notes).toBe('Nest found just above the tideline, marked with bamboo stakes.');
  });
});
