// Regression (QA-054, continued): a handful of mobile tap targets were still
// genuinely missing the hit-area-extension pattern used throughout this app
// (an invisible ::before with a negative inset, so the clickable area clears
// 44x44px without growing the visible button) - Time Table's Add Shift/Auto
// Assign/Volunteer Hours/Roster Templates buttons (py-2, ~32px tall) and
// Project Settings' shift Retire/Restore button (p-2 around a size-4 icon,
// 32x32) had no before: class at all. This pins that they now do.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import TimeTable from '../screens/TimeTable';

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
    },
  };
});

const hasHitAreaExtension = (el: Element | null) => {
  if (!el) return false;
  const cls = el.className || '';
  return /before:absolute/.test(cls) && /before:-inset/.test(cls) && /before:content-\[['"]{2}\]/.test(cls);
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
});
