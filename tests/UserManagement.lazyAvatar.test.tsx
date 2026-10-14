import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserManagement from '../screens/UserManagement';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

// QA-094: GET /users used to embed every user's profile photo as base64,
// inflating the directory response to ~2.8 MB. The bulk list now only
// carries a `has_profile_picture` boolean and each avatar fetches its own
// photo lazily through GET /users/:id.

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

describe('UserManagement lazy avatar loading (QA-094)', () => {
  beforeEach(() => {
    localStorage.clear();

    vi.spyOn(DatabaseConnection, 'getUsers').mockResolvedValue([
      {
        id: 'has-pic-1',
        first_name: 'Arlo',
        last_name: 'Activeson',
        email: 'arlo.activeson@turtleguard.demo',
        role: 'Field Leader',
        station: 'argo',
        is_active: true,
        is_email_verified: true,
        has_profile_picture: true,
        // deliberately no profile_picture blob - bulk route no longer sends one
      },
      {
        id: 'no-pic-1',
        first_name: 'Nina',
        last_name: 'Nopic',
        email: 'nina.nopic@turtleguard.demo',
        role: 'Field Leader',
        station: 'argo',
        is_active: true,
        is_email_verified: true,
        has_profile_picture: false,
      },
    ] as any);

    vi.spyOn(DatabaseConnection, 'getBeachGroupings').mockResolvedValue({ stations: [] } as any);
    vi.spyOn(DatabaseConnection, 'getUser').mockResolvedValue({
      profile_picture: 'data:image/png;base64,ZmFrZQ==',
    } as any);
  });

  it('only calls GET /users/:id for rows that have a profile picture, and renders it', async () => {
    render(<UserManagement user={coordinator} {...props} />);

    await waitFor(() => {
      expect(DatabaseConnection.getUsers).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(DatabaseConnection.getUser).toHaveBeenCalledWith('has-pic-1');
    });
    expect(DatabaseConnection.getUser).not.toHaveBeenCalledWith('no-pic-1');

    await waitFor(() => {
      const img = document.querySelector('img[src="data:image/png;base64,ZmFrZQ=="]');
      expect(img).not.toBeNull();
    });
  });
});
