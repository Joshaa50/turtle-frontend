import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Records from '../screens/Records';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

// Regression (QA-152): every row in Active Turtles rendered an Archive
// button regardless of role, including Field Assistant - a role the
// server already rejects with a 403 (QA-064). Clicking it also fired the
// PUT immediately with no confirmation, and a failed request had nowhere
// to surface its error. This mirrors the Delete Turtle Record gate
// (`role === 'Field Leader' || role.includes('Coordinator')`, see
// TurtleDetails.tsx) for Archive, adds a confirm step, and asserts a
// failed archive shows an on-screen error instead of failing silently.

const fieldAssistant: User = {
  id: '1',
  firstName: 'Nikos',
  lastName: 'Floros',
  role: 'Field Assistant',
  avatar: '',
  email: 'nikos.floros@turtleguard.demo',
};

const fieldLeader: User = {
  id: '2',
  firstName: 'Lena',
  lastName: 'Leader',
  role: 'Field Leader',
  avatar: '',
  email: 'lena.leader@turtleguard.demo',
};

const baseTurtle = {
  id: 701,
  front_left_tag: 'KF-701',
  name: 'Speedy',
  species: 'Caretta caretta',
  last_seen_at: '2026-05-10',
  sighting_count: 2,
  is_archived: false,
};

const props = {
  type: 'turtle' as const,
  onNavigate: vi.fn(),
  onSelectNest: vi.fn(),
  onInventoryNest: vi.fn(),
  onSelectTurtle: vi.fn(),
  theme: 'light' as const,
  isSidebarOpen: false,
  onToggleSidebar: vi.fn(),
};

describe('Records (turtle) Archive permission and confirmation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(DatabaseConnection, 'getTurtles').mockResolvedValue([baseTurtle] as any);
  });

  it('does not render an Archive control for a Field Assistant', async () => {
    render(<Records {...props} user={fieldAssistant} />);

    await waitFor(() => {
      expect(DatabaseConnection.getTurtles).toHaveBeenCalled();
    });

    await screen.findAllByText('Speedy');

    expect(screen.queryAllByTitle('Archive this turtle — its history is kept')).toHaveLength(0);
  });

  it('shows a confirmation before archiving, and only sends the PUT after confirming', async () => {
    const archiveSpy = vi.spyOn(DatabaseConnection, 'setTurtleArchived').mockResolvedValue({} as any);

    render(<Records {...props} user={fieldLeader} />);

    await waitFor(() => {
      expect(DatabaseConnection.getTurtles).toHaveBeenCalled();
    });
    await screen.findAllByText('Speedy');

    const archiveButtons = screen.getAllByTitle('Archive this turtle — its history is kept');
    fireEvent.click(archiveButtons[0]);

    // Confirmation dialog appears; request has not fired yet.
    const confirmHeading = await screen.findByText('Archive Speedy?');
    expect(confirmHeading).toBeDefined();
    expect(archiveSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByText('Archive', { selector: 'button' }).slice(-1)[0]);

    await waitFor(() => {
      expect(archiveSpy).toHaveBeenCalledWith('701', true);
    });
  });

  it('shows an on-screen error banner if the archive request fails', async () => {
    vi.spyOn(DatabaseConnection, 'setTurtleArchived').mockRejectedValue(
      new Error('Forbidden: insufficient permissions')
    );

    render(<Records {...props} user={fieldLeader} />);

    await waitFor(() => {
      expect(DatabaseConnection.getTurtles).toHaveBeenCalled();
    });
    await screen.findAllByText('Speedy');

    const archiveButtons = screen.getAllByTitle('Archive this turtle — its history is kept');
    fireEvent.click(archiveButtons[0]);

    await screen.findByText('Archive Speedy?');
    fireEvent.click(screen.getAllByText('Archive', { selector: 'button' }).slice(-1)[0]);

    expect(await screen.findByText('Forbidden: insufficient permissions')).toBeDefined();
  });
});
