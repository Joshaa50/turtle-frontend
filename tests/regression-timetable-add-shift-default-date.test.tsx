// QA-136: ADD SHIFT always defaulted its Date field to today, even while a
// later (or earlier) week was on screen - confirming without noticing
// booked volunteers onto today instead of the week actually being planned.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TimeTable from '../screens/TimeTable';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

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

beforeEach(() => {
  localStorage.clear();
  vi.setSystemTime(new Date('2026-10-19T09:00:00')); // a Monday
  vi.spyOn(DatabaseConnection, 'getShifts').mockResolvedValue([
    { shift_id: 1, shift_name: 'Loggos Beach Survey', shift_type: 'Morning', start_time: '06:00:00', end_time: null, is_active: true },
  ] as any);
  vi.spyOn(DatabaseConnection, 'getUsers').mockResolvedValue([] as any);
  vi.spyOn(DatabaseConnection, 'getWeeklyTimetable').mockResolvedValue([] as any);
});

afterEach(() => vi.useRealTimers());

describe('TimeTable: ADD SHIFT defaults its date to the week on screen (QA-136)', () => {
  it('defaults to today when the current week is on screen', async () => {
    render(<TimeTable user={leader} {...props} />);

    fireEvent.click(await screen.findByRole('button', { name: /add shift/i }));

    expect(await screen.findByLabelText('Date')).toHaveValue('2026-10-19');
  });

  it('defaults to that week\'s Monday after navigating to a future week', async () => {
    render(<TimeTable user={leader} {...props} />);

    const nextWeekButton = await screen.findByLabelText('Next Week');
    fireEvent.click(nextWeekButton);
    fireEvent.click(nextWeekButton);
    await waitFor(() => expect(DatabaseConnection.getWeeklyTimetable).toHaveBeenCalledWith('2026-11-02', expect.anything()));

    fireEvent.click(screen.getByRole('button', { name: /add shift/i }));

    expect(await screen.findByLabelText('Date')).toHaveValue('2026-11-02');
  });
});
