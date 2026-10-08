// QA-048: Field Leader used to get a "User Management" quick-action card
// promising to "Manage team access and roles", which led straight to
// UserManagement's own "Only a project coordinator can manage user
// accounts." refusal - a dead end, since that screen's access check is
// Coordinator-only.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import Dashboard from '../screens/Dashboard';

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getNests: vi.fn().mockResolvedValue([]),
      getTurtles: vi.fn().mockResolvedValue([]),
      getEmergences: vi.fn().mockResolvedValue([]),
      getReviews: vi.fn().mockResolvedValue([]),
      getSettings: vi.fn().mockResolvedValue(actual.DatabaseConnection.defaultSettings()),
      getWeeklyTimetable: vi.fn().mockResolvedValue([]),
    },
  };
});

const baseProps = {
  onNavigate: vi.fn(),
  theme: 'dark' as const,
  isSidebarOpen: false,
  onToggleSidebar: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('Dashboard: User Management quick action (QA-048)', () => {
  it('is not offered to a Field Leader', async () => {
    render(<Dashboard {...baseProps} user={{ id: '1', firstName: 'A', lastName: 'B', role: 'Field Leader', avatar: '', email: 'a@b.com' } as any} />);
    await waitFor(() => expect(screen.getByText('Time Table')).toBeInTheDocument());
    expect(screen.queryByText('User Management')).toBeNull();
  });

  it('is offered to a Project Coordinator', async () => {
    render(<Dashboard {...baseProps} user={{ id: '1', firstName: 'A', lastName: 'B', role: 'Project Coordinator', avatar: '', email: 'a@b.com' } as any} />);
    await waitFor(() => expect(screen.getByText('User Management')).toBeInTheDocument());
  });
});
