// QA-074 (continuing): the "Notes" textarea in the Edit Nest Details form
// had a visible <p> heading next to it but no htmlFor/id wiring, so a screen
// reader announced it as unlabeled.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import NestDetails from '../screens/NestDetails';

const { NEST } = vi.hoisted(() => ({
  NEST: {
    id: 55, nest_code: 'QA-74', beach: 'Agios Ioannis', status: 'incubating',
    total_num_eggs: 100, current_num_eggs: 100, is_archived: false,
    depth_top_egg_h: '40', depth_bottom_chamber_h: '60', width_w: '25',
    distance_to_sea_s: 20, gps_lat: '38.1', gps_long: '20.5', date_laid: '2026-06-01',
    notes: 'Found during morning patrol, close to the dune line.',
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

// setHeaderActions publishes the Edit/Cancel/Save buttons out of the
// component (App.tsx renders them in its own header, not inside NestDetails'
// own tree) - mirrors the harness in NestDetails.editForm.test.tsx.
const onBack = vi.fn();

const Harness: React.FC = () => {
  const [actions, setActions] = React.useState<React.ReactNode>(null);
  return (
    <>
      <div>{actions}</div>
      <NestDetails
        id="QA-74"
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

describe('NestDetails notes textarea labeling (QA-074)', () => {
  it('associates the Edit Nest Details "Notes" textarea with a real <label>', async () => {
    render(<Harness />);

    expect(await screen.findByText(/Found during morning patrol, close to the dune line\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /edit nest details/i }));

    const notesTextarea = await screen.findByDisplayValue('Found during morning patrol, close to the dune line.');
    expect(screen.getByLabelText('Notes')).toBe(notesTextarea);
  });
});
