// QA-130: the relocated-nest metric fields (h, H, w, S) reused the original
// fields' auto-derived ids (Input derives one from the label when none is
// given, and both sections use the same labels), so tapping a relocated
// label focused the ORIGINAL box instead - and the Eggs Taken Out / Eggs Put
// Back In / Start Time / End Time inputs had no id/label link at all. Each
// relocated field now has its own id, and every one of those four has a
// working label.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    },
  };
});

const beaches = [
  { id: 1, name: 'Loggos 2', code: 'LG2', station: 'Lixouri', survey_area: 'Lixouri' },
] as any;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('NestEntry: relocated-nest field ids are distinct from the originals (QA-130)', () => {
  it('h/H/w/S each resolve to two distinct inputs once Relocated is on, not the same element twice', async () => {
    render(<NestEntry onBack={vi.fn()} beaches={beaches} initialIsNest />);

    fireEvent.click(screen.getByLabelText('Relocated'));

    for (const label of ['h (Depth top)', 'H (Depth bottom)', 'w (Width)', 'S (Dist to sea)']) {
      const matches = screen.getAllByLabelText(label, { exact: false });
      expect(matches).toHaveLength(2);
      expect(matches[0].id).not.toBe(matches[1].id);
    }
  });

  it('typing into the relocated h box does not touch the original h box', async () => {
    render(<NestEntry onBack={vi.fn()} beaches={beaches} initialIsNest />);

    fireEvent.click(screen.getByLabelText('Relocated'));

    const [originalH, relocatedH] = screen.getAllByLabelText('h (Depth top)', { exact: false });
    fireEvent.change(originalH, { target: { value: '33' } });
    fireEvent.change(relocatedH, { target: { value: '41' } });

    expect((originalH as HTMLInputElement).value).toBe('33');
    expect((relocatedH as HTMLInputElement).value).toBe('41');
  });

  it('gives Eggs Taken Out, Eggs Put Back In, Start Time and End Time a working label', async () => {
    render(<NestEntry onBack={vi.fn()} beaches={beaches} initialIsNest />);

    fireEvent.click(screen.getByLabelText('Relocated'));

    expect(screen.getByLabelText('Eggs Taken Out')).toBeInTheDocument();
    expect(screen.getByLabelText('Eggs Put Back In')).toBeInTheDocument();
    expect(screen.getByLabelText('Start Time')).toBeInTheDocument();
    expect(screen.getByLabelText('End Time')).toBeInTheDocument();
  });
});
