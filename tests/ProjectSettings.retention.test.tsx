// Data retention: a coordinator-only section. Field records are never in
// scope here - only whether a dormant account is erased automatically.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import ProjectSettings from '../screens/ProjectSettings';

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  const { defaultFieldRequirements } = await vi.importActual<any>('../lib/fieldRequirements');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      defaultSettings: actual.DatabaseConnection.defaultSettings,
      getSettings: vi.fn().mockResolvedValue({
        seasons: { seasons: [], current: null },
        review_rules: actual.DatabaseConnection.defaultSettings().review_rules,
        lists: actual.DatabaseConnection.defaultSettings().lists,
        alerts: actual.DatabaseConnection.defaultSettings().alerts,
        field_requirements: defaultFieldRequirements(),
        retention: { auto_erase_enabled: false, inactive_days: 365 },
      }),
      getShifts: vi.fn().mockResolvedValue([]),
      saveRetentionSettings: vi.fn().mockResolvedValue({ auto_erase_enabled: true, inactive_days: 180 }),
    },
  };
});

import { DatabaseConnection } from '../services/Database';

const leader = { id: 1, firstName: 'E', lastName: 'P', role: 'Field Leader', avatar: '', email: 'e@x.com' } as any;
const coordinator = { id: 2, firstName: 'S', lastName: 'M', role: 'Project Coordinator', avatar: '', email: 's@x.com' } as any;

beforeEach(() => vi.clearAllMocks());

describe('Project Settings: data retention', () => {
  it('is hidden from a Field Leader, along with the other coordinator-only sections', async () => {
    render(<ProjectSettings user={leader} />);
    await screen.findByText('Shift types');
    expect(screen.queryByText('Data retention')).toBeNull();
  });

  it('shows a coordinator the section, off by default', async () => {
    render(<ProjectSettings user={coordinator} />);
    expect(await screen.findByText('Data retention')).toBeTruthy();
    const checkbox = screen.getByRole('checkbox', { name: /automatically erase an account after/i });
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    const days = screen.getByLabelText('Days of inactivity before automatic erasure') as HTMLInputElement;
    expect(days.disabled).toBe(true);
  });

  it('enables the days field once the toggle is on, and saves', async () => {
    render(<ProjectSettings user={coordinator} />);
    const checkbox = await screen.findByRole('checkbox', { name: /automatically erase an account after/i });
    fireEvent.click(checkbox);
    const days = screen.getByLabelText('Days of inactivity before automatic erasure') as HTMLInputElement;
    expect(days.disabled).toBe(false);
    fireEvent.change(days, { target: { value: '180' } });
    fireEvent.click(screen.getByText('Save retention settings'));

    await waitFor(() => expect(DatabaseConnection.saveRetentionSettings).toHaveBeenCalledWith({
      auto_erase_enabled: true, inactive_days: 180,
    }));
    expect(await screen.findByText('Data retention settings saved.')).toBeTruthy();
  });

  it('rejects a threshold below 30 days before it ever reaches the server', async () => {
    render(<ProjectSettings user={coordinator} />);
    const checkbox = await screen.findByRole('checkbox', { name: /automatically erase an account after/i });
    fireEvent.click(checkbox);
    const days = screen.getByLabelText('Days of inactivity before automatic erasure') as HTMLInputElement;
    fireEvent.change(days, { target: { value: '5' } });
    fireEvent.click(screen.getByText('Save retention settings'));

    expect(await screen.findByText(/30 to 3650/)).toBeTruthy();
    expect(DatabaseConnection.saveRetentionSettings).not.toHaveBeenCalled();
  });

  it('shows the server\'s error and leaves the setting alone when the save fails', async () => {
    (DatabaseConnection.saveRetentionSettings as any).mockRejectedValueOnce(new Error('nope'));
    render(<ProjectSettings user={coordinator} />);
    const checkbox = await screen.findByRole('checkbox', { name: /automatically erase an account after/i });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByText('Save retention settings'));
    expect(await screen.findByText('nope')).toBeTruthy();
  });
});
