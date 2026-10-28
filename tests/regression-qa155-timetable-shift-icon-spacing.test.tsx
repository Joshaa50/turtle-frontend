import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimeTable from '../screens/TimeTable';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

// Regression (QA-155): on a shift card, the Edit Shift and Delete Shift
// icons (28x28 visible) sat only gap-1 (4px) apart, each with a
// before:-inset-2.5 (10px) hit-area extension - two 10px extensions either
// side of a 4px gap overlap by 16px right where a thumb aiming for Edit
// would land, making Delete easy to hit by mistake. The fix pairs a smaller,
// exact-44px extension (before:-inset-2, 8px) with a gap (gap-4, 16px) that
// is at least twice the extension, so the two hit areas meet without
// overlapping.
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

describe('Time Table shift card — Edit/Delete icons have separated hit areas (QA-155)', () => {
  it('extends each icon just to 44px and keeps the extensions from overlapping', async () => {
    vi.spyOn(DatabaseConnection, 'getShifts').mockResolvedValue([
      { shift_id: 1, shift_name: 'Loggos Beach Survey', shift_type: 'Morning' },
    ] as any);
    vi.spyOn(DatabaseConnection, 'getUsers').mockResolvedValue([] as any);
    vi.spyOn(DatabaseConnection, 'getWeeklyTimetable').mockImplementation(async (monday: string) => [
      {
        assignment_id: 1,
        work_date: `${monday}T00:00:00.000Z`,
        first_name: 'Maria',
        last_name: 'Karydi',
        shift_name: 'Loggos Beach Survey',
        shift_type: 'Morning',
      },
    ] as any);

    render(<TimeTable user={leader} {...props} />);

    await waitFor(() => {
      expect(DatabaseConnection.getWeeklyTimetable).toHaveBeenCalled();
    });

    const editButton = await screen.findAllByRole('button', { name: /^edit shift$/i });
    const deleteButton = await screen.findAllByRole('button', { name: /^delete shift$/i });
    expect(editButton.length).toBeGreaterThan(0);
    expect(deleteButton.length).toBeGreaterThan(0);

    for (const btn of [...editButton, ...deleteButton]) {
      const cls = btn.className;
      // 28px visible box (p-1.5 around a size-4 icon) + 2x8px extension = 44px.
      expect(cls).toMatch(/before:absolute/);
      expect(cls).toMatch(/before:-inset-2\b/);
      expect(cls).toMatch(/before:content-\[['"]{2}\]/);
      // Not the old, overlap-prone -inset-2.5 extension.
      expect(cls).not.toMatch(/before:-inset-2\.5/);
    }

    // The two buttons' shared parent must space them widely enough (>= 2x
    // the per-button extension) that the extended hit areas don't overlap.
    const container = editButton[0].parentElement;
    expect(container).toBeTruthy();
    expect(container!.className).toMatch(/gap-4/);
    expect(container!.contains(deleteButton[0])).toBe(true);
  });
});
