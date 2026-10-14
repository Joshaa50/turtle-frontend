// QA-100: a nest position kilometres from its beach (even in the sea) saved
// with no confirmation on Nest Entry - the "This position is about X km from
// <beach>" warning shown live under the GPS fields was purely cosmetic.
// Edit Nest Details already confirms this case live; Nest Entry now requires
// the same explicit "save anyway" before SAVE ENTRY goes through.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// A beach with a reference point, so a nest kilometres away actually triggers
// the distance warning (an unchecked beach has nothing to compare against).
const beaches = [
  { id: 1, name: 'Loggos 4', code: 'LG4', station: 'Lixouri', survey_area: 'Lixouri', gps_lat: 38.18412, gps_long: 20.43978 },
] as any;

const fillRequiredFields = (lat: string, lng: string) => {
  fireEvent.change(screen.getByLabelText('h (Depth top)', { exact: false }), { target: { value: '30' } });
  fireEvent.change(screen.getByLabelText('S (Dist to sea)', { exact: false }), { target: { value: '20' } });
  fireEvent.change(document.getElementById('original-lat') as HTMLInputElement, { target: { value: lat } });
  fireEvent.change(document.getElementById('original-lng') as HTMLInputElement, { target: { value: lng } });
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // jsdom has no layout engine and doesn't implement scrollIntoView; the
  // declined-warning path below calls it on the lat field via scrollToField.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('NestEntry: beach-distance save confirmation (QA-100)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('warns and blocks the save when the position is km from the beach and the warning is declined', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<NestEntry onBack={vi.fn()} beaches={beaches} initialIsNest />);
    fillRequiredFields('38.05000', '20.44031'); // ~11km from Loggos 4's reference point

    fireEvent.click(await screen.findByText('SAVE ENTRY'));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(confirmSpy.mock.calls[0][0]).toMatch(/km from loggos 4/i);
    expect(DatabaseConnection.createNest).not.toHaveBeenCalled();
  });

  it('saves anyway once the distance warning is confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<NestEntry onBack={vi.fn()} beaches={beaches} initialIsNest />);
    fillRequiredFields('38.05000', '20.44031');

    fireEvent.click(await screen.findByText('SAVE ENTRY'));

    await waitFor(() => expect(DatabaseConnection.createNest).toHaveBeenCalled());
  });

  it('does not warn for a position within range of the beach', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<NestEntry onBack={vi.fn()} beaches={beaches} initialIsNest />);
    fillRequiredFields('38.18420', '20.43980'); // a few metres from Loggos 4's reference point

    fireEvent.click(await screen.findByText('SAVE ENTRY'));

    await waitFor(() => expect(DatabaseConnection.createNest).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
