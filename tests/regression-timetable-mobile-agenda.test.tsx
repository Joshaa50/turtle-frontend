import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TimeTable from '../screens/TimeTable';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

// Regression (QA-068, re-opened): a prior column-tightening pass got
// Morning+Afternoon to fit at 390px, but Night was still hidden behind the
// horizontal swipe - same structural problem as Nest Records' QA-053. jsdom
// can't evaluate Tailwind breakpoints, so this proves the fix a unit test
// CAN prove: a `data-testid="timetable-agenda"` stacked layout exists in the
// DOM, carrying all three shift types (Morning/Afternoon/Night) and their
// assignments, for the mobile agenda (`sm:hidden`) to render without needing
// a sideways swipe.

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

describe('TimeTable mobile agenda layout', () => {
  beforeEach(() => {
    localStorage.clear();

    vi.spyOn(DatabaseConnection, 'getShifts').mockResolvedValue([
      { shift_id: 1, shift_name: 'Loggos Beach Survey', shift_type: 'Morning' },
      { shift_id: 2, shift_name: 'Sand Sifting', shift_type: 'Afternoon' },
      { shift_id: 3, shift_name: 'Hatchling Watch', shift_type: 'Night' },
    ] as any);

    vi.spyOn(DatabaseConnection, 'getUsers').mockResolvedValue([] as any);

    // All three shifts land on the same day so the agenda's day card has to
    // carry all three shift-type sections at once.
    vi.spyOn(DatabaseConnection, 'getWeeklyTimetable').mockImplementation(async (monday: string) => {
      const workDate = `${monday}T00:00:00.000Z`;
      return [
        {
          assignment_id: 1,
          work_date: workDate,
          first_name: 'Maria',
          last_name: 'Karydi',
          shift_name: 'Loggos Beach Survey',
          shift_type: 'Morning',
        },
        {
          assignment_id: 2,
          work_date: workDate,
          first_name: 'Nikos',
          last_name: 'Papas',
          shift_name: 'Sand Sifting',
          shift_type: 'Afternoon',
        },
        {
          assignment_id: 3,
          work_date: workDate,
          first_name: 'Elena',
          last_name: 'Vasou',
          shift_name: 'Hatchling Watch',
          shift_type: 'Night',
        },
      ] as any;
    });
  });

  it('renders Morning, Afternoon, and Night assignments inside the mobile agenda', async () => {
    render(<TimeTable user={leader} {...props} />);

    await waitFor(() => {
      expect(DatabaseConnection.getWeeklyTimetable).toHaveBeenCalled();
    });

    const agenda = await screen.findByTestId('timetable-agenda');

    expect(agenda.textContent).toContain('Morning');
    expect(agenda.textContent).toContain('Afternoon');
    expect(agenda.textContent).toContain('Night');

    expect(agenda.textContent).toContain('Loggos Beach Survey');
    expect(agenda.textContent).toContain('Sand Sifting');
    expect(agenda.textContent).toContain('Hatchling Watch');

    expect(agenda.textContent).toContain('Maria Karydi');
    expect(agenda.textContent).toContain('Nikos Papas');
    expect(agenda.textContent).toContain('Elena Vasou');

    expect(within(agenda).getAllByText('Morning').length).toBeGreaterThan(0);
  });
});
