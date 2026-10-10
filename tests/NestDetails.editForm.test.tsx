// QA-045: Cancelling an edit never reset editForm back to the saved nest, so
// reopening "Edit Nest Details" showed the discarded values again, as if
// Cancel had done nothing.
// QA-046: a failed save only ever showed a hardcoded "Failed to update nest
// details.", with the server's actual reason (e.g. a field out of range)
// swallowed into console.error and never shown to the user.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import NestDetails from '../screens/NestDetails';

const { NEST } = vi.hoisted(() => ({
  NEST: {
    id: 55, nest_code: 'QA-45', beach: 'Agios Ioannis', status: 'incubating',
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

import { DatabaseConnection } from '../services/Database';

const user = { role: 'Project Coordinator' } as any;

// setHeaderActions publishes the Cancel/Save/Edit buttons out of the
// component (App.tsx renders them in its own header, not inside NestDetails'
// own tree) - a wrapper with its own state re-renders them in sync with
// NestDetails on every update, instead of freezing a stale snapshot the way
// capturing the node once into a variable would.
const Harness: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [actions, setActions] = React.useState<React.ReactNode>(null);
  return (
    <>
      <div>{actions}</div>
      <NestDetails
        id="QA-45"
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

describe('NestDetails: edit form Cancel and save-failure (QA-045/046)', () => {
  it('discards an in-progress edit on Cancel, instead of reopening with it still there', async () => {
    render(<Harness onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /edit nest details/i }));
    const eggsInput = await screen.findByDisplayValue('100') as HTMLInputElement;
    fireEvent.change(eggsInput, { target: { value: '999' } });
    expect((await screen.findByDisplayValue('999'))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    fireEvent.click(screen.getByRole('button', { name: /edit nest details/i }));
    expect(await screen.findByDisplayValue('100')).toBeTruthy();
    expect(screen.queryByDisplayValue('999')).toBeNull();
  });

  it('shows the real server error on a failed save, not a generic message', async () => {
    (DatabaseConnection.updateNest as any).mockRejectedValue(
      new Error('total_num_eggs must be a number between 0 and 300.')
    );
    render(<Harness onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /edit nest details/i }));
    const eggsInput = await screen.findByDisplayValue('100') as HTMLInputElement;
    fireEvent.change(eggsInput, { target: { value: '999' } });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    // QA-066: the raw column name is translated to the label next to its
    // input - "Total eggs", not "total_num_eggs" - so the banner reads as
    // something a person can act on instead of a database error.
    expect(await screen.findByText(/Total eggs must be a number between 0 and 300/i)).toBeTruthy();
    expect(screen.queryByText(/total_num_eggs/)).toBeNull();
  });

  // QA-074: the edit-mode number inputs had visible label text next to them
  // but no htmlFor/id wiring, so a screen reader announced them as unlabeled.
  // getByLabelText only passes if that association actually exists.
  it('associates every edit-mode field with a real <label>, not just nearby text', async () => {
    render(<Harness onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /edit nest details/i }));

    expect(await screen.findByLabelText('Total Eggs')).toBeInTheDocument();
    expect(screen.getByLabelText('Latitude')).toBeInTheDocument();
    expect(screen.getByLabelText('Longitude')).toBeInTheDocument();
    expect(screen.getByLabelText(/Top Depth \(h\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Chamber Depth \(H\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Width \(w\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/To Sea \(S\)/i)).toBeInTheDocument();
  });

  // QA-083: Notes had no UI field at all on the nest edit screen even though
  // turtle_nests.notes already round-trips through the update API - this
  // checks the read-only display, the edit-mode textarea, and that an edit
  // actually reaches updateNest with the new text.
  it('shows, edits and saves the nest Notes field', async () => {
    // Guards against the previous test's mockRejectedValue leaking in here -
    // vi.clearAllMocks() in beforeEach clears calls, not implementations.
    (DatabaseConnection.updateNest as any).mockResolvedValue({ message: 'Nest updated' });
    render(<Harness onBack={vi.fn()} />);

    expect(await screen.findByText(/Found during morning patrol, close to the dune line\./)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /edit nest details/i }));
    const notesInput = await screen.findByDisplayValue('Found during morning patrol, close to the dune line.') as HTMLTextAreaElement;
    fireEvent.change(notesInput, { target: { value: 'Updated: relocated stakes after storm surge.' } });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(DatabaseConnection.updateNest).toHaveBeenCalled();
    });
    const updateCall = (DatabaseConnection.updateNest as any).mock.calls[0];
    expect(updateCall[1].notes).toBe('Updated: relocated stakes after storm surge.');
  });

  it('shows a "No notes recorded." placeholder when a nest has no notes', async () => {
    const originalNotes = NEST.notes;
    (NEST as any).notes = null;
    try {
      render(<Harness onBack={vi.fn()} />);
      expect(await screen.findByText('No notes recorded.')).toBeTruthy();
    } finally {
      (NEST as any).notes = originalNotes;
    }
  });
});
