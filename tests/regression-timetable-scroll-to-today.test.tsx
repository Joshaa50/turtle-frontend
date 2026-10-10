import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TimeTable from '../screens/TimeTable';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

// Regression (QA-080): the Time Table (especially the mobile agenda) always
// opened scrolled to the top of the week (Monday), leaving a volunteer to
// hunt for today's row/card below the fold instead of landing on it
// directly. jsdom has no real layout, so this proves the wiring a unit test
// CAN prove: today's row/card calls scrollIntoView once the week (which
// contains today, since currentWeekStart defaults to this week) has
// rendered.

const leader: User = {
  id: '1',
  firstName: 'Lena',
  lastName: 'Leader',
  role: 'Field Leader',
  avatar: '',
  email: 'lena.leader@turtleguard.demo',
};

const props = {
  theme: 'light' as const,
  isSidebarOpen: false,
  onToggleSidebar: vi.fn(),
  onNavigate: vi.fn(),
};

describe('TimeTable scroll-to-today', () => {
  beforeEach(() => {
    localStorage.clear();

    vi.spyOn(DatabaseConnection, 'getShifts').mockResolvedValue([] as any);
    vi.spyOn(DatabaseConnection, 'getUsers').mockResolvedValue([] as any);
    vi.spyOn(DatabaseConnection, 'getWeeklyTimetable').mockResolvedValue([] as any);
  });

  it('scrolls today into view once the week finishes loading', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    render(<TimeTable user={leader} {...props} />);

    await waitFor(() => {
      expect(DatabaseConnection.getWeeklyTimetable).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });
});
