// QA-074 (run 2): the Add Shift dialog's Date input, Shift select, Task
// select and close (X) button all had a visible label or icon next to them
// but no accessible name wired up - the Date/Shift/Task labels were plain
// text with no htmlFor/id, and the close button was icon-only with no
// aria-label. getByLabelText/getByRole(name:) only pass if the association
// is real, not just visually adjacent.
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  vi.spyOn(DatabaseConnection, 'getShifts').mockResolvedValue([
    { shift_id: 1, shift_name: 'Loggos Beach Survey', shift_type: 'Morning', start_time: '06:00:00', end_time: null, is_active: true },
  ] as any);
  vi.spyOn(DatabaseConnection, 'getUsers').mockResolvedValue([
    { id: 10, first_name: 'Sarah', last_name: 'Johnson', email: 'sarah@turtleguard.demo', role: 'Field Volunteer', is_active: true },
  ] as any);
  vi.spyOn(DatabaseConnection, 'getWeeklyTimetable').mockResolvedValue([] as any);
});

describe('TimeTable Add Shift dialog accessibility (QA-074)', () => {
  it('associates Date, Shift and Task with a real label, and names the close button', async () => {
    render(<TimeTable user={leader} {...props} />);

    fireEvent.click(await screen.findByRole('button', { name: /add shift/i }));

    expect(await screen.findByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Shift')).toBeInTheDocument();
    expect(screen.getByLabelText('Task')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
