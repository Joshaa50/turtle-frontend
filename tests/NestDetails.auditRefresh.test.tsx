// QA-144: saving an edit added a new audit row on the server, but
// Lifecycle History only ever fetched the audit trail on mount, so the new
// entry was invisible until the whole page was reloaded.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import NestDetails from '../screens/NestDetails';

const { NEST } = vi.hoisted(() => ({
  NEST: {
    id: 55, nest_code: 'QA-144', beach: 'Agios Ioannis', status: 'incubating',
    total_num_eggs: 100, current_num_eggs: 100, is_archived: false,
    depth_top_egg_h: '40', depth_bottom_chamber_h: '60', width_w: '25',
    distance_to_sea_s: 20, gps_lat: '38.1', gps_long: '20.5', date_laid: '2026-06-01',
    notes: 'Found during morning patrol.',
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
      updateNest: vi.fn().mockResolvedValue({ message: 'Nest updated' }),
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
        id="QA-144"
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

describe('NestDetails: Lifecycle History refreshes after a save (QA-144)', () => {
  it('re-fetches the audit trail and shows the new entry without a remount', async () => {
    (DatabaseConnection.getAudit as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 1,
          action: 'updated',
          summary: 'Beach Agios Ioannis → Loggos 2',
          occurred_at: '2026-10-24T00:00:00.000Z',
        },
      ]);

    render(<Harness onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /edit nest details/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(DatabaseConnection.updateNest).toHaveBeenCalled();
    });

    // Called once on mount, once more after the save resolved.
    await waitFor(() => {
      expect((DatabaseConnection.getAudit as any).mock.calls.length).toBe(2);
    });

    expect(await screen.findByText(/Beach Agios Ioannis → Loggos 2/i)).toBeTruthy();
  });
});
