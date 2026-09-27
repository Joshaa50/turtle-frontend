// Shift types: a Field Leader runs the timetable, so they can also manage the
// shift types it offers - the rest of Project Settings stays a coordinator's.
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
      }),
      getShifts: vi.fn().mockResolvedValue([
        { shift_id: 1, shift_name: 'Loggos Survey', shift_type: 'Morning', start_time: '06:00:00', end_time: null, is_active: true },
        { shift_id: 2, shift_name: 'Old Patrol', shift_type: 'Night', start_time: '21:00:00', end_time: '23:00:00', is_active: false },
      ]),
      createShift: vi.fn().mockResolvedValue({ shift_id: 3, shift_name: 'Night Patrol', shift_type: 'Night', start_time: '21:00:00', end_time: null, is_active: true }),
      updateShift: vi.fn().mockResolvedValue({ shift_id: 1, shift_name: 'Loggos Survey', shift_type: 'Morning', start_time: '06:00:00', end_time: null, is_active: false }),
    },
  };
});

import { DatabaseConnection } from '../services/Database';

const leader = { id: 1, firstName: 'E', lastName: 'P', role: 'Field Leader', avatar: '', email: 'e@x.com' } as any;
const coordinator = { id: 2, firstName: 'S', lastName: 'M', role: 'Project Coordinator', avatar: '', email: 's@x.com' } as any;

beforeEach(() => vi.clearAllMocks());

describe('Project Settings: shift types', () => {
  it('lets a Field Leader see and manage shift types, but not the coordinator-only sections', async () => {
    render(<ProjectSettings user={leader} />);
    expect(await screen.findByText('Shift types')).toBeTruthy();
    await screen.findByDisplayValue('Loggos Survey');
    expect(screen.queryByText('Nesting seasons')).toBeNull();
    expect(screen.queryByText('Review rules')).toBeNull();
    expect(screen.queryByText('Dropdown lists')).toBeNull();
  });

  it('lets a coordinator see everything, including shift types', async () => {
    render(<ProjectSettings user={coordinator} />);
    expect(await screen.findByText('Shift types')).toBeTruthy();
    expect(await screen.findByText('Nesting seasons')).toBeTruthy();
    expect(await screen.findByText('Review rules')).toBeTruthy();
  });

  it('hides a retired shift until asked to show it', async () => {
    render(<ProjectSettings user={leader} />);
    await screen.findByDisplayValue('Loggos Survey');
    expect(screen.queryByDisplayValue('Old Patrol')).toBeNull();
    fireEvent.click(screen.getByText(/show 1 retired/i));
    expect(await screen.findByDisplayValue('Old Patrol')).toBeTruthy();
  });

  it('adds a new shift type', async () => {
    render(<ProjectSettings user={leader} />);
    await screen.findByDisplayValue('Loggos Survey');
    fireEvent.click(screen.getByText('Add a shift type'));
    const nameInputs = screen.getAllByPlaceholderText('Night Patrol');
    fireEvent.change(nameInputs[nameInputs.length - 1], { target: { value: 'Night Patrol' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(DatabaseConnection.createShift).toHaveBeenCalledWith(
      expect.objectContaining({ shift_name: 'Night Patrol', shift_type: 'Morning' })
    ));
    expect(await screen.findByDisplayValue('Night Patrol')).toBeTruthy();
  });

  it('retires a shift without deleting it', async () => {
    render(<ProjectSettings user={leader} />);
    await screen.findByDisplayValue('Loggos Survey');
    fireEvent.click(screen.getByLabelText('Retire Loggos Survey'));

    await waitFor(() => expect(DatabaseConnection.updateShift).toHaveBeenCalledWith(1, { is_active: false }));
    await screen.findByText(/retired. past assignments are unchanged/i);
  });
});
