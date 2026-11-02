// GD-002: voice recordings from "Record Audio" are sent to Google for
// transcription. Nothing on screen said so before this fix - a volunteer
// could record without knowing the audio leaves this app. This pins down
// that a one-line notice appears the first time recording starts, reusing
// the same banner mechanism NestInventory already uses for the
// AI_NOT_CONFIGURED error (see NestInventory.tsx's voiceError banner).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import NestInventory from '../screens/NestInventory';

const { NEST } = vi.hoisted(() => ({
  NEST: {
    id: 37, nest_code: 'AI-2', beach: 'Agios Ioannis', status: 'incubating',
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
      getObservers: vi.fn().mockResolvedValue([]),
      getBeaches: vi.fn().mockResolvedValue([{ id: 1, name: 'Agios Ioannis', code: 'AI', station: 'Lixouri', survey_area: 'Agios Ioannis' }]),
      getSettings: vi.fn().mockResolvedValue({ field_requirements: defaultFieldRequirements() }),
      getNest: vi.fn().mockResolvedValue({ message: 'Nest found', nest: NEST }),
      createNestEvent: vi.fn(),
      updateNest: vi.fn(),
    },
  };
});

const onBack = vi.fn();
const setHeaderActions = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // getUserMedia never resolves within the test - we only care that the
  // notice appears as soon as recording is requested, not that recording
  // completes.
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockReturnValue(new Promise(() => {})) },
    configurable: true,
  });
});

describe('NestInventory voice notice (GD-002)', () => {
  it('shows a notice that audio is sent to Google before the first recording', async () => {
    render(<NestInventory id="AI-2" onBack={onBack} setHeaderActions={setHeaderActions} />);
    await screen.findByDisplayValue('39.86');

    expect(screen.queryByText(/sent to Google/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /record audio/i }));

    await waitFor(() =>
      expect(screen.getByText(/sent to Google for transcription and is not stored by this app/i)).toBeInTheDocument(),
    );
  });
});
