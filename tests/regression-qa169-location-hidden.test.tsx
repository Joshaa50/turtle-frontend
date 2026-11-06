// Regression (QA-169): GD-003's restricted location mode nulls a nest's
// GPS/triangulation fields and 403s its photo routes for a Field Volunteer,
// but the backend's own location_hidden:true flag on the nest was never
// read here - the screen showed "No triangulation points recorded" and GPS
// "—, —" exactly as if the nest genuinely had none, and still called the
// photos endpoint it isn't allowed to use. Both should instead say the
// location is hidden, and the photos endpoint should never be called.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import NestDetails from '../screens/NestDetails';

const { RESTRICTED_NEST } = vi.hoisted(() => ({
  RESTRICTED_NEST: {
    id: 158, nest_code: 'CG-4', beach: 'Cape', status: 'incubating',
    total_num_eggs: 100, current_num_eggs: 100, is_archived: false,
    depth_top_egg_h: '40', depth_bottom_chamber_h: '60', width_w: '25',
    distance_to_sea_s: 20, gps_lat: null, gps_long: null, date_laid: '2026-06-01',
    notes: '', tri_tl_desc: null, tri_tl_lat: null, tri_tl_long: null, tri_tl_distance: null,
    tri_tr_desc: null, tri_tr_lat: null, tri_tr_long: null, tri_tr_distance: null,
    location_hidden: true,
  },
}));

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getNest: vi.fn().mockResolvedValue({ message: 'Nest found', nest: RESTRICTED_NEST }),
      getNestEvents: vi.fn().mockResolvedValue([]),
      getAudit: vi.fn().mockResolvedValue([]),
      getBeaches: vi.fn().mockResolvedValue([]),
      getNestPhotos: vi.fn().mockResolvedValue([]),
      updateNest: vi.fn(),
    },
  };
});

import { DatabaseConnection } from '../services/Database';

const volunteer = { role: 'Field Volunteer' } as any;

const Harness: React.FC = () => (
  <NestDetails
    id="CG-4"
    onBack={vi.fn()}
    onNavigate={vi.fn()}
    user={volunteer}
    isSidebarOpen={false}
    onToggleSidebar={vi.fn()}
    setHeaderActions={vi.fn()}
  />
);

beforeEach(() => { vi.clearAllMocks(); });

describe('NestDetails: location_hidden (QA-169)', () => {
  it('says the location is hidden instead of showing empty GPS/triangulation, and never calls the photos route', async () => {
    render(<Harness />);

    await waitFor(() =>
      expect(screen.getAllByText(/Location hidden/i).length).toBeGreaterThanOrEqual(2)
    );

    expect(screen.queryByText(/—, —/)).not.toBeInTheDocument();
    expect(screen.queryByText('No triangulation points recorded.')).not.toBeInTheDocument();
    expect(screen.queryByText(/No photographs of this nest yet/i)).not.toBeInTheDocument();
    expect(DatabaseConnection.getNestPhotos).not.toHaveBeenCalled();
  });
});
