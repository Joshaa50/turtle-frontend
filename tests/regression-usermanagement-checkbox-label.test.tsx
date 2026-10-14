import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserManagement from '../screens/UserManagement';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

// Regression (QA-054 follow-up): the row-select checkboxes' hit-area wrapper
// was a <span>, which does not natively forward clicks to the <input> it
// wraps. Because the wrapper's ::before (used to pad the tap target) is
// position:absolute, it also sits above the input in hit-testing, so real
// clicks landed on the wrapper and never reached the checkbox at all - even
// dead-center clicks. A <label> wrapping an <input> natively forwards clicks
// to it, fixing this without pointer-events hacks. This test locks in that
// the wrapper is a <label> and that clicking it (not the input directly)
// actually toggles the checkbox.

const coordinator: User = {
  id: '1',
  firstName: 'Cara',
  lastName: 'Coordinator',
  role: 'Project Coordinator',
  avatar: '',
  email: 'cara.coordinator@turtleguard.demo',
};

const props = {
  theme: 'light' as const,
  isSidebarOpen: false,
  onToggleSidebar: vi.fn(),
  onNavigate: vi.fn(),
};

describe('UserManagement checkbox tap-target wrapper', () => {
  beforeEach(() => {
    localStorage.clear();

    vi.spyOn(DatabaseConnection, 'getUsers').mockResolvedValue([
      {
        id: 'active-1',
        first_name: 'Arlo',
        last_name: 'Activeson',
        email: 'arlo.activeson@turtleguard.demo',
        role: 'Field Leader',
        station: 'argo',
        is_active: true,
        is_email_verified: true,
      },
    ] as any);

    vi.spyOn(DatabaseConnection, 'getBeachGroupings').mockResolvedValue({ stations: [] } as any);
  });

  it('wraps each checkbox in a <label> that forwards clicks to it', async () => {
    render(<UserManagement user={coordinator} {...props} />);

    await waitFor(() => {
      expect(DatabaseConnection.getUsers).toHaveBeenCalled();
    });

    const checkboxes = await screen.findAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);

    checkboxes.forEach((checkbox) => {
      expect(checkbox.parentElement?.tagName).toBe('LABEL');
    });

    const rowCheckbox = checkboxes.find((cb) => !(cb as HTMLInputElement).checked) as HTMLInputElement;
    expect(rowCheckbox).toBeTruthy();
    const wrapperLabel = rowCheckbox.parentElement as HTMLLabelElement;

    expect(rowCheckbox.checked).toBe(false);
    fireEvent.click(wrapperLabel);
    expect(rowCheckbox.checked).toBe(true);
  });
});
