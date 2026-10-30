import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Records from '../screens/Records';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

// Regression (QA-152 follow-on): the Delete Emergence button (desktop table
// and mobile card) was gated with `user.role !== 'Field Volunteer'`, which
// lets a Field Assistant through - that role !== 'Field Volunteer' so the
// check passes, rendering a button whose only possible outcome is a 403
// (DELETE /emergences/:id is Field Leader/Coordinator only, QA-064). Same
// class of bug as the turtle Archive gate fixed for QA-152 in this file;
// now matches the Delete Turtle Record gate used in TurtleDetails.tsx.

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

const baseEmergence = {
  id: 174,
  event_date: '2026-10-15',
  beach: 'Xi',
  emergence_type: 'False crawl',
  nest_code: null,
};

const props = {
  type: 'nest' as const,
  onNavigate: vi.fn(),
  onSelectNest: vi.fn(),
  onInventoryNest: vi.fn(),
  onSelectTurtle: vi.fn(),
  theme: 'light' as const,
  isSidebarOpen: false,
  onToggleSidebar: vi.fn(),
};

describe('Records (emergence) Delete permission', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(DatabaseConnection, 'getNests').mockResolvedValue([] as any);
    vi.spyOn(DatabaseConnection, 'getEmergences').mockResolvedValue([baseEmergence] as any);
  });

  it('does not render a Delete Emergence control for a Field Assistant', async () => {
    render(<Records {...props} user={fieldAssistant} />);

    fireEvent.click(await screen.findByText('Emergences'));

    await waitFor(() => {
      expect(DatabaseConnection.getEmergences).toHaveBeenCalled();
    });
    await screen.findByTestId('emergence-cards');

    expect(screen.queryAllByTitle('Delete Emergence')).toHaveLength(0);
  });

  it('renders a Delete Emergence control for a Field Leader', async () => {
    render(<Records {...props} user={fieldLeader} />);

    fireEvent.click(await screen.findByText('Emergences'));

    await waitFor(() => {
      expect(DatabaseConnection.getEmergences).toHaveBeenCalled();
    });
    await screen.findByTestId('emergence-cards');

    expect(screen.queryAllByTitle('Delete Emergence').length).toBeGreaterThan(0);
  });
});
