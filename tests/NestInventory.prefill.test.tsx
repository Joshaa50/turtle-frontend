// QA report: the inventory form left depth/distance/GPS blank even though the
// nest record already has them, so staff typed them twice - and the header
// chip read "14 CURRENT" with nothing to say that's eggs still in the nest,
// not the clutch size (136 laid).
//
// What these cases pin down:
//   - the original-measurement fields are pre-filled from the nest record
//   - a pre-filled value is not treated as an unsaved change: Cancel leaves
//     without a "discard changes?" confirmation
//   - typing over a pre-filled value IS treated as a change
//   - the header chip states both numbers and what each one means
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import NestInventory from '../screens/NestInventory';

// vi.mock factories are hoisted above every top-level statement, so the
// fixture has to be hoisted along with it rather than just declared above.
const { NEST } = vi.hoisted(() => ({
  NEST: {
    id: 37, nest_code: 'AI-2', beach: 'Agios Ioannis', status: 'hatching',
    total_num_eggs: 136, current_num_eggs: 14,
    depth_top_egg_h: '39.86', depth_bottom_chamber_h: '63.88', width_w: '27.82',
    distance_to_sea_s: 18, gps_lat: '38.13267', gps_long: '20.56043',
  },
}));

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  const { defaultFieldRequirements } = await vi.importActual<any>('../lib/fieldRequirements');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getUsers: vi.fn().mockResolvedValue([]),
      getBeaches: vi.fn().mockResolvedValue([{ id: 1, name: 'Agios Ioannis', code: 'AI', station: 'Lixouri', survey_area: 'Agios Ioannis' }]),
      getSettings: vi.fn().mockResolvedValue({ field_requirements: defaultFieldRequirements() }),
      getNest: vi.fn().mockResolvedValue({ message: 'Nest found', nest: NEST }),
    },
  };
});

let headerActions: React.ReactNode = null;
const setHeaderActions = (node: React.ReactNode) => { headerActions = node; };
const onBack = vi.fn();

beforeEach(() => { vi.clearAllMocks(); headerActions = null; onBack.mockClear(); });

describe('NestInventory: pre-filling from the nest record', () => {
  it('pre-fills depth, distance and GPS from the nest', async () => {
    render(<NestInventory id="AI-2" onBack={onBack} setHeaderActions={setHeaderActions} />);
    expect(await screen.findByDisplayValue('39.86')).toBeTruthy(); // depth top (h)
    expect(screen.getByDisplayValue('63.88')).toBeTruthy(); // depth bottom (H)
    expect(screen.getByDisplayValue('27.82')).toBeTruthy(); // width (w)
    expect(screen.getByDisplayValue('18')).toBeTruthy(); // distance to sea (S)
    expect(screen.getByDisplayValue('38.13267')).toBeTruthy(); // lat
    expect(screen.getByDisplayValue('20.56043')).toBeTruthy(); // lng
  });

  // Cancel/Save and the egg-count chip are published through setHeaderActions
  // (App.tsx renders them in its own header, not inside this screen's own
  // tree) - so a test that needs them renders the captured node itself,
  // fetched only once the prefill is visible so it isn't a stale snapshot
  // from before the nest loaded.
  const renderHeaderActions = async () => {
    await screen.findByDisplayValue('39.86');
    render(<>{headerActions}</>);
  };

  it('leaves without a discard confirmation when nothing was changed beyond the pre-fill', async () => {
    render(<NestInventory id="AI-2" onBack={onBack} setHeaderActions={setHeaderActions} />);
    await renderHeaderActions();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onBack).toHaveBeenCalled();
    expect(screen.queryByText(/discard progress/i)).toBeNull();
  });

  it('asks to discard once a pre-filled value is actually edited', async () => {
    render(<NestInventory id="AI-2" onBack={onBack} setHeaderActions={setHeaderActions} />);
    const widthInput = await screen.findByDisplayValue('27.82');
    fireEvent.change(widthInput, { target: { value: '30' } });
    await renderHeaderActions();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onBack).not.toHaveBeenCalled();
    expect(await screen.findByText(/discard progress/i)).toBeTruthy();
  });

  it('states the header chip as eggs-in-nest out of eggs-laid, not a bare number', async () => {
    render(<NestInventory id="AI-2" onBack={onBack} setHeaderActions={setHeaderActions} />);
    await renderHeaderActions();
    expect(await screen.findByText((_, el) => el?.textContent === '14 of 136 Currently In Nest')).toBeTruthy();
  });
});
