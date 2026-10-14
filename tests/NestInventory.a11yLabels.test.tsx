// QA-074 (continuing): most of NestInventory's inputs had a visible
// <Label>/<h4> next to them with no htmlFor/id wiring, so a screen reader
// announced them as unlabeled. The embryonic-stage count table is worse:
// the same visible text (row name, column header) is shared across four
// different inputs, so each bare <input> gets its own aria-label instead.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import NestInventory from '../screens/NestInventory';

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
      getObservers: vi.fn().mockResolvedValue([]),
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

describe('NestInventory input labeling (QA-074)', () => {
  it('associates the logistics and tally fields with real labels', async () => {
    render(<NestInventory id="AI-2" onBack={onBack} setHeaderActions={setHeaderActions} />);

    await screen.findByLabelText('Date', { exact: false });
    expect(screen.getByLabelText('Observer')).toBeInTheDocument();
    expect(screen.getByLabelText('Start Time', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('End Time', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Field Notes')).toBeInTheDocument();
    expect(screen.getByLabelText('Eggs Reburied')).toBeInTheDocument();
    expect(screen.getByLabelText('Alive (Surface)')).toBeInTheDocument();
    expect(screen.getByLabelText('Alive (In Nest)')).toBeInTheDocument();
    expect(screen.getByLabelText('Dead (Surface)')).toBeInTheDocument();
    expect(screen.getByLabelText('Dead (In Nest)')).toBeInTheDocument();
  });

  it('gives each embryonic-stage count input its own accessible name', async () => {
    render(<NestInventory id="AI-2" onBack={onBack} setHeaderActions={setHeaderActions} />);

    await screen.findByLabelText('Date', { exact: false });
    // "hatched" is one of the stage rows rendered from the `stages` map; the
    // label text is the raw key (lowercase, no camelCase boundary to split).
    expect(screen.getByLabelText('hatched count')).toBeInTheDocument();
    expect(screen.getByLabelText('hatched pink bacteria count')).toBeInTheDocument();
    expect(screen.getByLabelText('hatched green bacteria count')).toBeInTheDocument();
  });
});
