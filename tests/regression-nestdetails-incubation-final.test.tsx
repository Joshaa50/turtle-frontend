// QA-145: "Incubation (final)" was computed from the LAST fieldwork entry's
// day count, which for a hatched nest is almost always the FULL_INVENTORY
// (excavation) - not the first hatchling emergence. If the team waited days
// after the hatchlings actually emerged before digging the nest up, the
// figure was inflated by exactly that delay. This pins the fix: the stat
// should freeze at the day count of the first EMERGENCE/HATCHING event, not
// whichever fieldwork event happens to be chronologically last.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import NestDetails from '../screens/NestDetails';

const { NEST, EVENTS } = vi.hoisted(() => ({
  NEST: {
    id: 61, nest_code: 'VA-3', beach: 'Vatsa', status: 'hatched',
    total_num_eggs: 100, current_num_eggs: 0, is_archived: false,
    depth_top_egg_h: '40', depth_bottom_chamber_h: '60', width_w: '25',
    distance_to_sea_s: 20, gps_lat: '38.1', gps_long: '20.5',
    date_laid: '2026-07-01', date_found: '2026-07-01',
    notes: '',
  },
  EVENTS: [
    // First emergence 60 days after discovery.
    {
      id: 1, event_type: 'EMERGENCE', nest_code: 'VA-3',
      start_time: '2026-08-30T06:00:00.000Z', created_at: '2026-08-30T06:00:00.000Z',
      tracks_to_sea: 40, tracks_lost: 2, notes: '', observer: 'A. Diver',
    },
    // Excavation happens much later - 90 days after discovery - because the
    // team waited to dig the nest up.
    {
      id: 2, event_type: 'FULL_INVENTORY', nest_code: 'VA-3',
      start_time: '2026-09-29T06:00:00.000Z', created_at: '2026-09-29T06:00:00.000Z',
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
  // vi.useFakeTimers() starves testing-library's findBy/waitFor internal
  // polling (they rely on real setTimeout) - vi.setSystemTime() alone is
  // enough to pin "now" for the day-count math.
  vi.setSystemTime(new Date('2026-10-26T12:00:00'));
});

afterEach(() => vi.useRealTimers());

describe('NestDetails: "Incubation (final)" uses first emergence, not excavation date (QA-145)', () => {
  it('shows the emergence day count (60), not the later inventory day count (90)', async () => {
    render(<NestDetails id="VA-3" onBack={vi.fn()} onNavigate={vi.fn()} user={user} isSidebarOpen={false} onToggleSidebar={vi.fn()} setHeaderActions={vi.fn()} />);

    const label = await screen.findByText('Incubation (final)');
    const value = label.closest('div')?.querySelector('span:nth-of-type(2)');
    expect(value?.textContent).toMatch(/^60\s*Days/);
  });
});
