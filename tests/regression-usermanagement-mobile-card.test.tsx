import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserManagement from '../screens/UserManagement';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

// Regression (QA-086): the Pending Requests and Active Researchers tables
// are ~862px wide (Researcher/Role/Station/Actions columns) and overflow a
// 390px viewport with no scroll hint, clipping Role and making
// Station/Actions unreachable - same structural problem as Nest Records'
// QA-053 and TimeTable's QA-068. jsdom can't evaluate Tailwind breakpoints
// (`hidden sm:block` / `sm:hidden` both stay in the DOM), so this test can't
// prove the table is visually hidden below `sm`. What it CAN prove: the
// `sm:hidden` stacked card markup exists, reads the exact same user data and
// the same getRoleBadge/stationLabel helpers as the table, and exposes the
// same actions - so the two views can't drift apart.

const coordinator: User = {
  id: '1',
  firstName: 'Cara',
  lastName: 'Coordinator',
  role: 'Project Coordinator',
  avatar: '',
  email: 'cara.coordinator@turtleguard.demo',
};

const props = {
  theme: 'light' as const,
  isSidebarOpen: false,
  onToggleSidebar: vi.fn(),
  onNavigate: vi.fn(),
};

describe('UserManagement mobile card layout', () => {
  beforeEach(() => {
    localStorage.clear();

    vi.spyOn(DatabaseConnection, 'getUsers').mockResolvedValue([
      {
        id: 'pending-1',
        first_name: 'Petra',
        last_name: 'Pendington',
        email: 'petra.pendington@turtleguard.demo',
        role: 'Field Volunteer',
        station: 'lix',
        // Pending means "signed up, not yet email-verified" - the component
        // filters out is_active === false entirely (that's rejected, not
        // pending), so a pending row must be is_active: true here.
        is_active: true,
        is_email_verified: false,
      },
      {
        id: 'active-1',
        first_name: 'Arlo',
        last_name: 'Activeson',
        email: 'arlo.activeson@turtleguard.demo',
        role: 'Field Leader',
        station: 'argo',
        is_active: true,
        is_email_verified: true,
      },
    ] as any);

    vi.spyOn(DatabaseConnection, 'getBeachGroupings').mockResolvedValue({ stations: [] } as any);
  });

  it('renders the pending request and active researcher in their mobile card lists', async () => {
    render(<UserManagement user={coordinator} {...props} />);

    await waitFor(() => {
      expect(DatabaseConnection.getUsers).toHaveBeenCalled();
    });

    const pendingCards = await screen.findByTestId('pending-requests-cards');
    expect(pendingCards.textContent).toContain('Petra Pendington');
    expect(pendingCards.textContent).toContain('petra.pendington@turtleguard.demo');
    expect(pendingCards.textContent).toContain('Field Volunteer');
    expect(pendingCards.textContent).toContain('Lixouri (lix)');
    within(pendingCards).getByText('Reject');
    within(pendingCards).getByText('Verify User');

    const activeCards = screen.getByTestId('active-researchers-cards');
    expect(activeCards.textContent).toContain('Arlo Activeson');
    expect(activeCards.textContent).toContain('arlo.activeson@turtleguard.demo');
    expect(activeCards.textContent).toContain('Field Leader');
    expect(activeCards.textContent).toContain('Argostoli (argo)');
    within(activeCards).getByText('Deactivate');
  });
});
