// QA-075: NestInventory's handleSave used to follow a successful
// createNestEvent with a direct PUT to the nest itself (DatabaseConnection.
// updateNest), to flip the nest's status/egg counts. A Volunteer isn't
// permitted to do that directly, so it 403s even though the inventory event
// was already saved correctly - showing a false "failed to save" alert. The
// nest's status transition is now a server-side consequence of the event's
// approval (same fix class as QA-070 for hatchling tracks), so this screen
// must never call updateNest at all.
//
// What these cases pin down:
//   - a successful save calls createNestEvent once and never calls updateNest
//   - the success path still runs (onBack called, success alert shown)
//   - a createNestEvent failure is reported as a failure, and updateNest is
//     still never called - proving the failure alert is now reserved for a
//     genuine createNestEvent error, not a side-effect of the forbidden PUT
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import NestInventory from '../screens/NestInventory';

// vi.mock factories are hoisted above every top-level statement, so the
// fixture has to be hoisted along with it rather than just declared above.
const { NEST, createNestEvent, updateNest } = vi.hoisted(() => ({
  NEST: {
    id: 37, nest_code: 'AI-2', beach: 'Agios Ioannis', status: 'incubating',
    total_num_eggs: 136, current_num_eggs: 14,
    depth_top_egg_h: '39.86', depth_bottom_chamber_h: '63.88', width_w: '27.82',
    distance_to_sea_s: 18, gps_lat: '38.13267', gps_long: '20.56043',
  },
  createNestEvent: vi.fn(),
  updateNest: vi.fn(),
}));

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  const { defaultFieldRequirements } = await vi.importActual<any>('../lib/fieldRequirements');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getObservers: vi.fn().mockResolvedValue([]),
      getBeaches: vi.fn().mockResolvedValue([{ id: 1, name: 'Agios Ioannis', code: 'AI', station: 'Lixouri', survey_area: 'Agios Ioannis' }]),
      getSettings: vi.fn().mockResolvedValue({ field_requirements: defaultFieldRequirements() }),
      getNest: vi.fn().mockResolvedValue({ message: 'Nest found', nest: NEST }),
      createNestEvent,
      updateNest,
    },
  };
});

let headerActions: React.ReactNode = null;
const setHeaderActions = (node: React.ReactNode) => { headerActions = node; };
const onBack = vi.fn();
let alertSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  headerActions = null;
  onBack.mockClear();
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
});

// Mirrors NestInventory.prefill.test.tsx: header actions (Save/Cancel) are
// published through setHeaderActions rather than rendered inline, so a test
// that needs them renders the captured node itself, fetched only once the
// prefill is visible so it isn't a stale snapshot from before the nest loaded.
const renderHeaderActions = async () => {
  await screen.findByDisplayValue('39.86');
  render(<>{headerActions}</>);
};

// Fills in the only fields the prefilled nest doesn't already satisfy
// (depth/distance/GPS come from the nest record itself): a start and end time.
const fillMinimumRequiredFields = () => {
  const timeInputs = screen.getAllByPlaceholderText('--:--');
  fireEvent.change(timeInputs[0], { target: { value: '0800' } });
  fireEvent.change(timeInputs[1], { target: { value: '1000' } });
};

describe('NestInventory save (QA-075)', () => {
  it('saves the event without ever calling updateNest, and runs the success path', async () => {
    createNestEvent.mockResolvedValue({ message: 'Nest event created' });

    render(<NestInventory id="AI-2" onBack={onBack} setHeaderActions={setHeaderActions} />);
    await renderHeaderActions();
    fillMinimumRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(createNestEvent).toHaveBeenCalledTimes(1));
    expect(createNestEvent.mock.calls[0][0]).toMatchObject({ nest_code: 'AI-2' });

    expect(updateNest).not.toHaveBeenCalled();
    await waitFor(() => expect(onBack).toHaveBeenCalled());
    expect(alertSpy).toHaveBeenCalledWith('Inventory saved successfully!');
  });

  it('reports a createNestEvent failure as a failure, and still never calls updateNest', async () => {
    createNestEvent.mockRejectedValue(new Error('Network error'));

    render(<NestInventory id="AI-2" onBack={onBack} setHeaderActions={setHeaderActions} />);
    await renderHeaderActions();
    fillMinimumRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(createNestEvent).toHaveBeenCalledTimes(1));
    expect(updateNest).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Failed to save inventory: Network error')
    );
    expect(onBack).not.toHaveBeenCalled();
  });
});
