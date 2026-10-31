// QA-157: Nest Details computed "Incubation (final)" by scanning the raw
// fieldwork list for the first EMERGENCE/HATCHING entry. A stray EMERGENCE
// event seeded BEFORE date_found (dayCount negative) sorted first in that
// list and was picked up as the "first emergence", producing a nonsensical
// negative day count (e.g. -89 for MA-2). The backend already excludes such
// stray pre-discovery events from nest.first_emergence_at (QA-145/56695db,
// now null for MA-2/AG-1) - this screen must respect that instead of
// re-deriving its own answer from the raw events.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import NestDetails from '../screens/NestDetails';

const { NEST, EVENTS } = vi.hoisted(() => ({
  NEST: {
    id: 62, nest_code: 'MA-2', beach: 'Marathonisi', status: 'hatched',
    total_num_eggs: 100, current_num_eggs: 0, is_archived: false,
    depth_top_egg_h: '40', depth_bottom_chamber_h: '60', width_w: '25',
    distance_to_sea_s: 20, gps_lat: '38.1', gps_long: '20.5',
    date_laid: '2026-06-10', date_found: '2026-06-10',
    notes: '',
    // Backend has already nulled this out, having excluded the stray
    // pre-discovery EMERGENCE event below.
    first_emergence_at: null,
  },
  EVENTS: [
    // Stray seed event dated BEFORE the nest was even found.
    {
      id: 1, event_type: 'EMERGENCE', nest_code: 'MA-2',
      start_time: '2026-03-13T06:00:00.000Z', created_at: '2026-03-13T06:00:00.000Z',
      tracks_to_sea: 40, tracks_lost: 2, notes: '', observer: 'A. Diver',
    },
    // The real excavation, 68 days after discovery.
    {
      id: 2, event_type: 'FULL_INVENTORY', nest_code: 'MA-2',
      start_time: '2026-08-17T06:00:00.000Z', created_at: '2026-08-17T06:00:00.000Z',
      hatched_count: 80, notes: '', observer: 'A. Diver',
    },
  ],
}));

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getNest: vi.fn().mockResolvedValue({ message: 'Nest found', nest: NEST }),
      getNestEvents: vi.fn().mockResolvedValue(EVENTS),
      getAudit: vi.fn().mockResolvedValue([]),
      getBeaches: vi.fn().mockResolvedValue([]),
      getNestPhotos: vi.fn().mockResolvedValue([]),
      updateNest: vi.fn(),
    },
  };
});

const user = { role: 'Project Coordinator' } as any;

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(new Date('2026-10-26T12:00:00'));
});

afterEach(() => vi.useRealTimers());

describe('NestDetails: "Incubation (final)" ignores a stray pre-discovery emergence event (QA-157)', () => {
  it('shows 68 days (the excavation date), not a negative figure from the stray March event', async () => {
    render(<NestDetails id="MA-2" onBack={vi.fn()} onNavigate={vi.fn()} user={user} isSidebarOpen={false} onToggleSidebar={vi.fn()} setHeaderActions={vi.fn()} />);

    const label = await screen.findByText('Incubation (final)');
    const value = label.closest('div')?.querySelector('span:nth-of-type(2)');
    expect(value?.textContent).toMatch(/^68\s*Days/);
    expect(value?.textContent).not.toMatch(/^-/);
  });
});
