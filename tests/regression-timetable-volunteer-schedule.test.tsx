import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TimeTable from '../screens/TimeTable';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

// Regression: TimeTable now fetches the user directory only for Field
// Leader/Coordinator, because GET /users is a privileged endpoint. But the
// non-leader view filters the week down to "my shifts" by comparing the signed
// in user's email against the names on each assignment - and that email is only
// ever populated FROM the directory. With the directory skipped, every
// assignment carries email: '', nothing matches, and a Field Volunteer or Field
// Assistant sees "No assignments" for a week in which they are in fact rostered.
//
// Observed in the running app: Maria Karydi (Field Volunteer) was assigned
// "Loggos Beach Survey" on Wed 26 Aug 2026 - GET /timetable/week returns that
// row with her name - and her Time Table showed NO ASSIGNMENTS on every day.

const volunteer: User = {
  id: '51',
  firstName: 'Maria',
  lastName: 'Karydi',
  role: 'Field Volunteer',
  avatar: '',
  email: 'maria.karydi@turtleguard.demo',
};

const props = {
  theme: 'light' as const,
  isSidebarOpen: false,
  onToggleSidebar: vi.fn(),
  onNavigate: vi.fn(),
};

describe('TimeTable — a non-leader still sees their own rostered shift', () => {
  beforeEach(() => {
    localStorage.clear();

    vi.spyOn(DatabaseConnection, 'getShifts').mockResolvedValue([
      { shift_id: 1, shift_name: 'Loggos Beach Survey', shift_type: 'Morning',
        start_time: '06:00:00', end_time: '10:00:00' },
    ] as any);

    // The week carries its own names, which is exactly why the fix considered
    // the directory unnecessary here.
    vi.spyOn(DatabaseConnection, 'getWeeklyTimetable').mockImplementation(async (monday: string) => [
      {
        assignment_id: 2105,
        // Wednesday of whichever week the component asked for.
        work_date: `${new Date(`${monday}T00:00:00Z`).toISOString().slice(0, 10)}T00:00:00.000Z`,
        status: 'Scheduled',
        first_name: 'Maria',
        last_name: 'Karydi',
        shift_name: 'Loggos Beach Survey',
        shift_type: 'Morning',
        start_time: '06:00:00',
        end_time: '10:00:00',
      },
    ] as any);

    // What the server now does for a Field Volunteer.
    vi.spyOn(DatabaseConnection, 'getUsers').mockRejectedValue(
      new Error('You do not have permission to do that.')
    );
  });

  it('shows the volunteer the shift they are rostered on', async () => {
    render(<TimeTable user={volunteer} {...props} />);

    await waitFor(() => {
      expect(DatabaseConnection.getWeeklyTimetable).toHaveBeenCalled();
    });

    // The volunteer is on this shift; it must appear on their week. It now
    // renders twice - once in the desktop table, once in the QA-068 mobile
    // agenda, both present in the DOM at once since jsdom doesn't evaluate
    // the `sm:` breakpoint that hides one of them visually.
    await waitFor(() => {
      expect(screen.getAllByText('Loggos Beach Survey').length).toBeGreaterThan(0);
    });
  });

  it('does not request the privileged user directory', async () => {
    render(<TimeTable user={volunteer} {...props} />);

    await waitFor(() => {
      expect(DatabaseConnection.getWeeklyTimetable).toHaveBeenCalled();
    });

    expect(DatabaseConnection.getUsers).not.toHaveBeenCalled();
  });
});

// QA-140: a Volunteer's grid only ever showed shifts SHE was personally on -
// an empty slot read "No Assignments" even when colleagues were genuinely
// rostered on it that day (the same data her own Dashboard already shows as
// "today's team shifts"), so she had no way to tell a staffed beach from an
// unstaffed one.
describe('TimeTable: a non-leader sees the whole team\'s roster, not just her own shift (QA-140)', () => {
  beforeEach(() => {
    localStorage.clear();

    vi.spyOn(DatabaseConnection, 'getShifts').mockResolvedValue([
      { shift_id: 1, shift_name: 'Vatsa Beach Survey', shift_type: 'Morning',
        start_time: '06:00:00', end_time: '10:00:00' },
    ] as any);

    vi.spyOn(DatabaseConnection, 'getWeeklyTimetable').mockImplementation(async (monday: string) => {
      const wed = new Date(`${monday}T00:00:00Z`).toISOString().slice(0, 10);
      return [
        {
          assignment_id: 3001, work_date: `${wed}T00:00:00.000Z`, status: 'Scheduled',
          first_name: 'Sarah', last_name: 'Johnson',
          shift_name: 'Vatsa Beach Survey', shift_type: 'Morning', start_time: '06:00:00', end_time: '10:00:00',
        },
        {
          assignment_id: 3002, work_date: `${wed}T00:00:00.000Z`, status: 'Scheduled',
          first_name: 'Michael', last_name: 'Brown',
          shift_name: 'Vatsa Beach Survey', shift_type: 'Morning', start_time: '06:00:00', end_time: '10:00:00',
        },
      ] as any;
    });

    vi.spyOn(DatabaseConnection, 'getUsers').mockRejectedValue(
      new Error('You do not have permission to do that.')
    );
  });

  it('shows a colleague\'s shift even though the volunteer herself is not on it', async () => {
    render(<TimeTable user={volunteer} {...props} />);

    await waitFor(() => expect(DatabaseConnection.getWeeklyTimetable).toHaveBeenCalled());

    await waitFor(() => {
      expect(screen.getAllByText('Sarah Johnson').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Michael Brown').length).toBeGreaterThan(0);
    });
  });

  it('never shows Edit/Delete shift controls to a non-leader', async () => {
    render(<TimeTable user={volunteer} {...props} />);

    await waitFor(() => screen.getAllByText('Sarah Johnson'));

    expect(screen.queryByLabelText('Edit Shift')).toBeNull();
    expect(screen.queryByLabelText('Delete Shift')).toBeNull();
  });
});

// Regression (QA-047): GET /users includes self-registered accounts that are
// active-by-default but not yet email-verified by a Coordinator. The Add
// Shift volunteer picker only checked is_active, so a pending/unverified
// account (like a stray "QA033 Verify" test access request) showed up as a
// selectable volunteer when scheduling a shift - before any Coordinator had
// approved it.
describe('TimeTable Add Shift volunteer picker excludes unverified accounts', () => {
  const leader: User = {
    id: '1',
    firstName: 'Lena',
    lastName: 'Leader',
    role: 'Field Leader',
    avatar: '',
    email: 'lena.leader@turtleguard.demo',
  };

  beforeEach(() => {
    localStorage.clear();

    vi.spyOn(DatabaseConnection, 'getShifts').mockResolvedValue([] as any);
    vi.spyOn(DatabaseConnection, 'getWeeklyTimetable').mockResolvedValue([] as any);

    vi.spyOn(DatabaseConnection, 'getUsers').mockResolvedValue([
      {
        id: 10,
        first_name: 'Active',
        last_name: 'Verified',
        email: 'active.verified@turtleguard.demo',
        role: 'Field Volunteer',
        is_active: true,
        is_email_verified: true,
      },
      {
        id: 11,
        first_name: 'QA033',
        last_name: 'Verify',
        email: 'qa033.verify@turtleguard.demo',
        role: 'Field Volunteer',
        is_active: true,
        is_email_verified: false,
      },
      {
        id: 12,
        first_name: 'Inactive',
        last_name: 'Volunteer',
        email: 'inactive.volunteer@turtleguard.demo',
        role: 'Field Volunteer',
        is_active: false,
        is_email_verified: true,
      },
    ] as any);
  });

  it('only lists the active, email-verified volunteer in the Add Shift picker', async () => {
    render(<TimeTable user={leader} {...props} />);

    await waitFor(() => {
      expect(DatabaseConnection.getUsers).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Add Shift'));

    await waitFor(() => {
      expect(screen.getByText('active.verified@turtleguard.demo')).toBeDefined();
    });

    expect(screen.queryByText('qa033.verify@turtleguard.demo')).toBeNull();
    expect(screen.queryByText('inactive.volunteer@turtleguard.demo')).toBeNull();
  });
});
