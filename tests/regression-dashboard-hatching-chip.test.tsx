// Regression (QA-099): the "Active Nests" chip read "N hatchling(s) seen",
// but N was actually a count of NESTS whose status is "hatching" - not an
// observed hatchling headcount - and that wording regularly overflowed the
// chip's fixed-width pill (QA-069's max-w-[9rem] truncation), so desktop
// showed "4 hatchling..." and mobile showed "3 hatchlin...". This pins that
// the chip now says "nest(s) hatching", which is both accurate and short
// enough to fit without being clipped.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import Dashboard from '../screens/Dashboard';

function today() {
  return new Date().toISOString().split('T')[0];
}

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getNests: vi.fn().mockResolvedValue([
        { id: 1, nest_code: 'LG2-5', date_found: today(), status: 'hatching', is_archived: false },
        { id: 2, nest_code: 'VR-1R', date_found: today(), status: 'hatching', is_archived: false },
        { id: 3, nest_code: 'VA-4', date_found: today(), status: 'hatching', is_archived: false },
        { id: 4, nest_code: 'CG-1', date_found: today(), status: 'incubating', is_archived: false },
      ]),
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

describe('Dashboard Active Nests chip (QA-099)', () => {
  it('describes the count as nests hatching, not hatchlings seen', async () => {
    render(<Dashboard {...baseProps} user={{ id: '1', firstName: 'A', lastName: 'B', role: 'Field Leader', avatar: '', email: 'a@b.com' } as any} />);

    await waitFor(() => expect(screen.getByText('3 nests hatching')).toBeInTheDocument());
    expect(screen.queryByText(/hatchling.*seen/i)).toBeNull();
  });
});
