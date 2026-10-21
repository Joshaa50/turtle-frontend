// QA-141: a nest already "hatching" was still flagged "DUE TO HATCH" (and
// counted on the dashboard as "N due to hatch") because the day-threshold
// check in nestAttention() never looked at status - "due to hatch soon"
// read as nothing had happened yet, directly contradicting the HATCHING
// status pill right next to it. nestAttention() itself is covered in
// tests/coordinatorQaPass.test.ts; this covers NestDetails' own banner,
// which has to keep showing *some* guidance for a hatching nest even once
// nestAttention no longer returns 'due' for it.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import NestDetails from '../screens/NestDetails';

const { NEST } = vi.hoisted(() => ({
  NEST: {
    id: 61, nest_code: 'VA-3', beach: 'Vatsa', status: 'hatching',
    total_num_eggs: 100, current_num_eggs: 100, is_archived: false,
    depth_top_egg_h: '40', depth_bottom_chamber_h: '60', width_w: '25',
    distance_to_sea_s: 20, gps_lat: '38.1', gps_long: '20.5',
    // 2026-09-06 is 50 days before the fixed "now" below - past
    // DUE_TO_HATCH_DAYS (45) but short of OVERDUE_DAYS (70).
    date_laid: '2026-09-06', date_found: '2026-09-06',
    notes: '',
  },
}));

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getNest: vi.fn().mockResolvedValue({ message: 'Nest found', nest: NEST }),
      getNestEvents: vi.fn().mockResolvedValue([]),
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
  // enough to pin "now" for nestAttention's day-count math.
  vi.setSystemTime(new Date('2026-10-26T12:00:00'));
});

afterEach(() => vi.useRealTimers());

describe('NestDetails: a hatching nest never shows "due to hatch soon" (QA-141)', () => {
  it('shows the hatching-specific message, not "due to hatch soon", past DUE_TO_HATCH_DAYS', async () => {
    render(<NestDetails id="VA-3" onBack={vi.fn()} onNavigate={vi.fn()} user={user} isSidebarOpen={false} onToggleSidebar={vi.fn()} setHeaderActions={vi.fn()} />);

    expect(await screen.findByText(/This nest is hatching/i)).toBeInTheDocument();
    expect(screen.queryByText(/due to hatch soon/i)).not.toBeInTheDocument();
  });

  it('switches to the close-out message once past OVERDUE_DAYS', async () => {
    (NEST as any).date_laid = '2026-08-12';
    (NEST as any).date_found = '2026-08-12'; // 75 days before the fixed "now"
    render(<NestDetails id="VA-3" onBack={vi.fn()} onNavigate={vi.fn()} user={user} isSidebarOpen={false} onToggleSidebar={vi.fn()} setHeaderActions={vi.fn()} />);

    expect(await screen.findByText(/record the final inventory to close it out/i)).toBeInTheDocument();
    expect(screen.queryByText(/due to hatch soon/i)).not.toBeInTheDocument();
  });
});
