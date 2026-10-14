import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserManagement from '../screens/UserManagement';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

// QA-074: several controls on this screen had visible text or an icon with
// no accessible name wired up at all - search boxes with only a placeholder,
// select-all/per-row checkboxes with no aria-label, and icon-only dismiss/
// close buttons. getByLabelText/getByRole(name:) only pass if the real
// association exists.

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

describe('UserManagement accessibility labels (QA-074)', () => {
  beforeEach(() => {
    localStorage.clear();

    vi.spyOn(DatabaseConnection, 'getUsers').mockResolvedValue([
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

  it('gives the search boxes and checkboxes a real accessible name', async () => {
    render(<UserManagement user={coordinator} {...props} />);

    await waitFor(() => {
      expect(DatabaseConnection.getUsers).toHaveBeenCalled();
    });

    expect(await screen.findByLabelText('Search pending requests')).toBeInTheDocument();
    expect(screen.getByLabelText('Search researchers')).toBeInTheDocument();
    expect(screen.getByLabelText('Select all researchers on this page')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Select Arlo Activeson').length).toBeGreaterThan(0);
  });

  it('gives the error-banner dismiss button an accessible name', async () => {
    (DatabaseConnection.getUsers as any).mockRejectedValueOnce(new Error('Failed to fetch users'));
    render(<UserManagement user={coordinator} {...props} />);

    expect(await screen.findByRole('button', { name: /dismiss error/i })).toBeInTheDocument();
  });

  it('gives the Edit Researcher Details modal close button an accessible name', async () => {
    render(<UserManagement user={coordinator} {...props} />);

    await waitFor(() => {
      expect(DatabaseConnection.getUsers).toHaveBeenCalled();
    });

    const editButtons = await screen.findAllByTitle(/edit/i);
    fireEvent.click(editButtons[0]);

    expect(await screen.findByRole('button', { name: /^close$/i })).toBeInTheDocument();
  });
});
