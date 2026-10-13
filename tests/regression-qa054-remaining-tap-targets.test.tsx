// Regression (QA-054, continued): a handful of mobile tap targets were still
// genuinely missing the hit-area-extension pattern used throughout this app
// (an invisible ::before with a negative inset, so the clickable area clears
// 44x44px without growing the visible button) - Time Table's Add Shift/Auto
// Assign/Volunteer Hours/Roster Templates buttons (py-2, ~32px tall) and
// Project Settings' shift Retire/Restore button (p-2 around a size-4 icon,
// 32x32) had no before: class at all. This pins that they now do.
//
// QA-054 (run 2): that fix alone wasn't enough. before:-inset-y-* only sets
// top/bottom, leaving left/right at their default `auto` - so the ::before's
// computed width was 0px (confirmed live: getComputedStyle gave "0px" for
// Add Shift/Auto Assign/Volunteer Hours/Roster Templates/Today, and for
// Nest Records' Details button), meaning the "extension" had no actual hit
// area at all. before:inset-x-0 makes it stretch to the button's own width
// as well, so the box genuinely exists. hasHitAreaExtension now requires
// that too, not just an inset-y class.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import TimeTable from '../screens/TimeTable';
import Records from '../screens/Records';

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getShifts: vi.fn().mockResolvedValue([]),
      getUsers: vi.fn().mockResolvedValue([]),
      getWeeklyTimetable: vi.fn().mockResolvedValue([]),
      getBeaches: vi.fn().mockResolvedValue([]),
      getSettings: vi.fn().mockResolvedValue(actual.DatabaseConnection.defaultSettings()),
      getNests: vi.fn().mockResolvedValue([
        { id: 501, nest_code: 'LG2-9', beach: 'Loggos 2', date_laid: '2026-09-01', status: 'incubating', is_archived: false },
      ]),
      getEmergences: vi.fn().mockResolvedValue([]),
    },
  };
});

import { DatabaseConnection } from '../services/Database';

const hasHitAreaExtension = (el: Element | null) => {
  if (!el) return false;
  const cls = el.className || '';
  return (
    /before:absolute/.test(cls) &&
    /before:-inset-y/.test(cls) &&
    /before:inset-x-0/.test(cls) &&
    /before:content-\[['"]{2}\]/.test(cls)
  );
};

describe('Time Table — remaining tap targets get a real hit area (QA-054)', () => {
  it('Add Shift, Auto Assign and Volunteer Hours buttons have a hit-area extension', async () => {
    render(
      <TimeTable
        user={{ id: 7, firstName: 'Elena', lastName: 'Papadaki', role: 'Field Leader', avatar: '', email: 'elena@turtleguard.demo' } as any}
        theme="light"
        onNavigate={vi.fn()}
        isSidebarOpen={false}
        onToggleSidebar={vi.fn()}
      />
    );

    const addShift = await screen.findByRole('button', { name: /add shift/i });
    expect(hasHitAreaExtension(addShift)).toBe(true);

    const autoAssign = screen.getByRole('button', { name: /auto assign/i });
    expect(hasHitAreaExtension(autoAssign)).toBe(true);

    const hours = screen.getByRole('button', { name: /volunteer hours/i });
    expect(hasHitAreaExtension(hours)).toBe(true);
  });

  it('Roster Templates (Coordinator-only) has a real hit area extension', async () => {
    render(
      <TimeTable
        user={{ id: 48, firstName: 'Sofia', lastName: 'Manthou', role: 'Project Coordinator', avatar: '', email: 'sofia@turtleguard.demo' } as any}
        theme="light"
        onNavigate={vi.fn()}
        isSidebarOpen={false}
        onToggleSidebar={vi.fn()}
      />
    );

    const roster = await screen.findByRole('button', { name: /roster templates/i });
    expect(hasHitAreaExtension(roster)).toBe(true);
  });

  it('the Today button has a real hit area extension', async () => {
    render(
      <TimeTable
        user={{ id: 7, firstName: 'Elena', lastName: 'Papadaki', role: 'Field Leader', avatar: '', email: 'elena@turtleguard.demo' } as any}
        theme="light"
        onNavigate={vi.fn()}
        isSidebarOpen={false}
        onToggleSidebar={vi.fn()}
      />
    );

    const today = await screen.findByRole('button', { name: /^today$/i });
    expect(hasHitAreaExtension(today)).toBe(true);
  });
});

describe('Nest Records — Details button gets a real hit area (QA-054)', () => {
  it('has a hit-area extension that actually has a width (inset-x-0, not just inset-y)', async () => {
    render(
      <Records
        type="nest"
        onNavigate={vi.fn()}
        onSelectNest={vi.fn()}
        onInventoryNest={vi.fn()}
        onSelectTurtle={vi.fn()}
        theme="light"
        user={{ id: 7, firstName: 'Elena', lastName: 'Papadaki', role: 'Field Leader', avatar: '', email: 'elena@turtleguard.demo' } as any}
        isSidebarOpen={false}
        onToggleSidebar={vi.fn()}
      />
    );

    await waitFor(() => expect(DatabaseConnection.getNests).toHaveBeenCalled());
    const detailsButtons = await screen.findAllByRole('button', { name: /details/i });
    expect(detailsButtons.length).toBeGreaterThan(0);
    for (const btn of detailsButtons) {
      expect(hasHitAreaExtension(btn)).toBe(true);
    }
  });
});
