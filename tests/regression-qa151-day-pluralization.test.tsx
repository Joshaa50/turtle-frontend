// QA-151: "DAYS SINCE LAID" (and "INCUBATION (FINAL)") always rendered the
// plural "Days" suffix, even when the count was exactly 1 - a nest laid
// yesterday showed "1 Days" instead of "1 Day". Pins singular/plural
// agreement: n === 1 -> "Day", otherwise "Days".
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import NestDetails from '../screens/NestDetails';

const { NEST_ONE_DAY, NEST_FINAL } = vi.hoisted(() => ({
  // Laid yesterday relative to the system time set below - "days since laid"
  // should read exactly 1.
  NEST_ONE_DAY: {
    id: 70, nest_code: 'LG3-6', beach: 'Lagoon', status: 'laid',
    total_num_eggs: 100, current_num_eggs: 100, is_archived: false,
    depth_top_egg_h: '40', depth_bottom_chamber_h: '60', width_w: '25',
    distance_to_sea_s: 20, gps_lat: '38.1', gps_long: '20.5',
    date_laid: '2026-10-27', date_found: '2026-10-27',
    notes: '',
  },
  // Hatched nest whose only fieldwork (excavation) landed exactly 1 day after
  // discovery - exercises the "Incubation (final)" label's pluralization.
  NEST_FINAL: {
    id: 71, nest_code: 'LG3-7', beach: 'Lagoon', status: 'hatched',
    total_num_eggs: 100, current_num_eggs: 0, is_archived: false,
    depth_top_egg_h: '40', depth_bottom_chamber_h: '60', width_w: '25',
    distance_to_sea_s: 20, gps_lat: '38.1', gps_long: '20.5',
    date_laid: '2026-10-27', date_found: '2026-10-27',
    notes: '',
  },
}));

const FINAL_EVENTS = [
  {
    id: 1, event_type: 'FULL_INVENTORY', nest_code: 'LG3-7',
    start_time: '2026-10-28T06:00:00.000Z', created_at: '2026-10-28T06:00:00.000Z',
    hatched_count: 80, notes: '', observer: 'A. Diver',
  },
];

const mockGetNest = vi.fn();
const mockGetNestEvents = vi.fn();

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getNest: (...args: any[]) => mockGetNest(...args),
      getNestEvents: (...args: any[]) => mockGetNestEvents(...args),
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
  vi.setSystemTime(new Date('2026-10-28T12:00:00'));
});

afterEach(() => vi.useRealTimers());

describe('NestDetails: singular "Day" for a count of exactly 1 (QA-151)', () => {
  it('shows "1 Day" (not "1 Days") for "Days since laid" when the nest was laid yesterday', async () => {
    mockGetNest.mockResolvedValue({ message: 'Nest found', nest: NEST_ONE_DAY });
    mockGetNestEvents.mockResolvedValue([]);

    render(<NestDetails id="LG3-6" onBack={vi.fn()} onNavigate={vi.fn()} user={user} isSidebarOpen={false} onToggleSidebar={vi.fn()} setHeaderActions={vi.fn()} />);

    const label = await screen.findByText('Days since laid');
    const value = label.closest('div')?.querySelector('span:nth-of-type(2)');
    expect(value?.textContent?.replace(/\s+/g, ' ').trim()).toBe('1 Day');
  });

  it('shows "1 Day" (not "1 Days") for "Incubation (final)" when excavation landed 1 day after discovery', async () => {
    mockGetNest.mockResolvedValue({ message: 'Nest found', nest: NEST_FINAL });
    mockGetNestEvents.mockResolvedValue(FINAL_EVENTS);

    render(<NestDetails id="LG3-7" onBack={vi.fn()} onNavigate={vi.fn()} user={user} isSidebarOpen={false} onToggleSidebar={vi.fn()} setHeaderActions={vi.fn()} />);

    const label = await screen.findByText('Incubation (final)');
    const value = label.closest('div')?.querySelector('span:nth-of-type(2)');
    expect(value?.textContent?.replace(/\s+/g, ' ').trim()).toBe('1 Day');
  });
});
