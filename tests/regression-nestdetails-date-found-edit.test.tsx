// QA-132: a nest's date_found could not be corrected anywhere in the app -
// Edit Nest Details offered total eggs, h/H/w/S, GPS, notes and
// triangulation, but no date field, even though PUT /nests/:id/update
// already accepts and saves date_found. A nest entered a day out (e.g. a
// night patrol logged after midnight) showed the wrong "days since laid"
// for the whole season with no way to fix it.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import NestDetails from '../screens/NestDetails';
import { todayLocal } from '../lib/utils';

const { NEST } = vi.hoisted(() => ({
  NEST: {
    id: 55, nest_code: 'QA-132', beach: 'Agios Ioannis', status: 'incubating',
    total_num_eggs: 100, current_num_eggs: 100, is_archived: false,
    depth_top_egg_h: '40', depth_bottom_chamber_h: '60', width_w: '25',
    distance_to_sea_s: 20, gps_lat: '38.1', gps_long: '20.5',
    date_laid: '2026-10-18', date_found: '2026-10-18',
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

import { DatabaseConnection } from '../services/Database';

const user = { role: 'Project Coordinator' } as any;

const Harness: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [actions, setActions] = React.useState<React.ReactNode>(null);
  return (
    <>
      <div>{actions}</div>
      <NestDetails
        id="QA-132"
        onBack={onBack}
        onNavigate={vi.fn()}
        user={user}
        isSidebarOpen={false}
        onToggleSidebar={vi.fn()}
        setHeaderActions={setActions}
      />
    </>
  );
};

beforeEach(() => { vi.clearAllMocks(); });

describe('NestDetails: Date Found is editable (QA-132)', () => {
  it('shows a Date Found field, pre-filled with the stored date, with max=today', async () => {
    render(<Harness onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /edit nest details/i }));

    const dateField = await screen.findByLabelText('Date Found') as HTMLInputElement;
    expect(dateField.type).toBe('date');
    expect(dateField.value).toBe('2026-10-18');
    expect(dateField.max).toBe(todayLocal());
  });

  it('sends a corrected date_found through updateNest', async () => {
    (DatabaseConnection.updateNest as any).mockResolvedValue({ message: 'Nest updated' });
    render(<Harness onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /edit nest details/i }));

    const dateField = await screen.findByLabelText('Date Found');
    fireEvent.change(dateField, { target: { value: '2026-10-17' } });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(DatabaseConnection.updateNest).toHaveBeenCalled());
    const updateCall = (DatabaseConnection.updateNest as any).mock.calls[0];
    expect(updateCall[1].date_found).toBe('2026-10-17');
  });
});
