// QA-126: the Dashboard's "Turtle Records" card counted every row from
// GET /turtles, archived included, while Turtle Records' own "Active
// Turtles" list - what the card links to - excludes them (Archived Turtles
// is its own tab). An evaluator comparing the two saw a mismatch (17 vs 16)
// for no reason the app explained. The card now counts the same way the
// list it leads to does.
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
      getTurtles: vi.fn().mockResolvedValue([
        { id: 1, name: 'Calypso', health_condition: 'Healthy', is_archived: false },
        { id: 2, name: 'Iris', health_condition: 'Healthy', is_archived: false },
        { id: 3, name: 'Jeff', health_condition: 'Deceased', is_archived: true },
      ]),
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

describe('Dashboard Turtle Records card (QA-126)', () => {
  it('counts only active (non-archived) turtles, matching the list it links to', async () => {
    render(<Dashboard {...baseProps} user={{ id: '1', firstName: 'A', lastName: 'B', role: 'Field Leader', avatar: '', email: 'a@b.com' } as any} />);

    const label = await waitFor(() => screen.getByText('Turtle Records'));
    const card = label.parentElement!;
    expect(card.querySelector('h3')?.textContent).toBe('2');
  });
});
