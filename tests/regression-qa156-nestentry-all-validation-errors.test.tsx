// QA-156: the "CANNOT SAVE YET" box on Nest Entry used to be driven by an
// if-else-if chain that returned on the first failing check, so a form with
// several things wrong only ever showed one of them - fixing it revealed a
// new one. This asserts that with multiple simultaneous failures, every
// failing check is listed at once.
import { render, screen, fireEvent } from '@testing-library/react';
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

const beaches = [
  { id: 1, name: 'Loggos 4', code: 'LG4', station: 'Lixouri', survey_area: 'Lixouri', gps_lat: 38.18412, gps_long: 20.43978 },
] as any;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('NestEntry: all validation errors shown at once (QA-156)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists every failing check, not just the first, when the form is left blank', async () => {
    render(<NestEntry onBack={vi.fn()} beaches={beaches} initialIsNest />);

    fireEvent.click(await screen.findByText('SAVE ENTRY'));

    // Depth (h) is the first check in the chain and was the only one shown
    // before this fix; S is required further down the same chain and must
    // now show up alongside it rather than waiting for h to be fixed first.
    expect(await screen.findByText(/Depth \(h\) Required/)).toBeTruthy();
    expect(await screen.findByText(/Dist to Sea \(S\) Required/)).toBeTruthy();
  });

  it('shows the depth-logic error together with other unresolved checks once a prior one is fixed', async () => {
    render(<NestEntry onBack={vi.fn()} beaches={beaches} initialIsNest />);

    fireEvent.change(screen.getByLabelText('h (Depth top)', { exact: false }), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('H (Depth bottom)', { exact: false }), { target: { value: '10' } }); // h > H: invalid logic
    // S is still left blank, same as Depth logic - both should surface together.

    fireEvent.click(await screen.findByText('SAVE ENTRY'));

    expect(await screen.findByText(/Depth logic : need h < H/)).toBeTruthy();
    expect(await screen.findByText(/Dist to Sea \(S\) Required/)).toBeTruthy();
  });
});
