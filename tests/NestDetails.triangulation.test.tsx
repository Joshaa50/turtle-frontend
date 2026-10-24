// QA-148: a triangulation point with only a description and tape-measure
// distance (no GPS, the standard fallback when GPS is poor) was dropped
// entirely from the view model because the builder only checked tri_tl_lat/
// tri_tr_lat, so the screen showed "No triangulation points recorded." even
// though the point genuinely had data.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import NestDetails from '../screens/NestDetails';

const { NEST_LANDMARK_ONLY, NEST_NO_TRIANGULATION } = vi.hoisted(() => ({
  NEST_LANDMARK_ONLY: {
    id: 56, nest_code: 'QA-148', beach: 'Agios Ioannis', status: 'incubating',
    total_num_eggs: 100, current_num_eggs: 100, is_archived: false,
    depth_top_egg_h: '40', depth_bottom_chamber_h: '60', width_w: '25',
    distance_to_sea_s: 20, gps_lat: '38.1', gps_long: '20.5', date_laid: '2026-06-01',
    notes: '',
    tri_tl_desc: 'Big dead palm tree', tri_tl_distance: '12',
    tri_tl_lat: null, tri_tl_long: null,
  },
  NEST_NO_TRIANGULATION: {
    id: 57, nest_code: 'QA-148B', beach: 'Agios Ioannis', status: 'incubating',
    total_num_eggs: 100, current_num_eggs: 100, is_archived: false,
    depth_top_egg_h: '40', depth_bottom_chamber_h: '60', width_w: '25',
    distance_to_sea_s: 20, gps_lat: '38.1', gps_long: '20.5', date_laid: '2026-06-01',
    notes: '',
  },
}));

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getNest: vi.fn(),
      getNestEvents: vi.fn().mockResolvedValue([]),
      getAudit: vi.fn().mockResolvedValue([]),
      getBeaches: vi.fn().mockResolvedValue([]),
      getNestPhotos: vi.fn().mockResolvedValue([]),
      updateNest: vi.fn(),
    },
  };
});

import { DatabaseConnection } from '../services/Database';

const user = { role: 'Project Coordinator' } as any;

const Harness: React.FC<{ id: string }> = ({ id }) => (
  <NestDetails
    id={id}
    onBack={vi.fn()}
    onNavigate={vi.fn()}
    user={user}
    isSidebarOpen={false}
    onToggleSidebar={vi.fn()}
    setHeaderActions={vi.fn()}
  />
);

beforeEach(() => { vi.clearAllMocks(); });

describe('NestDetails: triangulation points without GPS (QA-148)', () => {
  it('shows a landmark-only triangulation point instead of hiding it', async () => {
    (DatabaseConnection.getNest as any).mockResolvedValue({ message: 'Nest found', nest: NEST_LANDMARK_ONLY });

    render(<Harness id="QA-148" />);

    expect(await screen.findByText('Big dead palm tree')).toBeTruthy();
    expect(screen.getByText('12m')).toBeTruthy();
    expect(screen.queryByText(/no triangulation points recorded/i)).toBeNull();
  });

  it('still shows "No triangulation points recorded." when there is really no data', async () => {
    (DatabaseConnection.getNest as any).mockResolvedValue({ message: 'Nest found', nest: NEST_NO_TRIANGULATION });

    render(<Harness id="QA-148B" />);

    expect(await screen.findByText(/no triangulation points recorded/i)).toBeTruthy();
  });
});
