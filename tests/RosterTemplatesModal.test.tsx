import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import RosterTemplatesModal from '../components/RosterTemplatesModal';
import { DatabaseConnection } from '../services/Database';

const shifts = [
  { shift_id: 1, shift_name: 'Loggos Survey', shift_type: 'Morning', start_time: '06:00:00', end_time: '', is_active: true },
  { shift_id: 2, shift_name: 'Retired Patrol', shift_type: 'Afternoon', start_time: '', end_time: '', is_active: false },
] as any;
const volunteers = [{ id: 51, name: 'Maria Karydi' }, { id: 52, name: 'Nikos Floros' }];

const template = (over: any = {}) => ({
  id: 9, name: 'Standard week',
  rows: [{ id: 1, day_of_week: 1, shift_id: 1, user_id: 51, shift_name: 'Loggos Survey', first_name: 'Maria', last_name: 'Karydi' }],
  ...over,
});

beforeEach(() => vi.restoreAllMocks());

const baseProps = {
  theme: 'light' as const,
  shifts,
  volunteers,
  defaultMonday: '2026-10-05',
  onClose: vi.fn(),
  onApplied: vi.fn(),
};

describe('RosterTemplatesModal', () => {
  it('lists existing templates with their row count', async () => {
    vi.spyOn(DatabaseConnection, 'getRosterTemplates').mockResolvedValue([template()]);
    render(<RosterTemplatesModal {...baseProps} />);
    expect(await screen.findByText('Standard week')).toBeTruthy();
    expect(screen.getByText('1 row')).toBeTruthy();
  });

  it('says so when there are none yet', async () => {
    vi.spyOn(DatabaseConnection, 'getRosterTemplates').mockResolvedValue([]);
    render(<RosterTemplatesModal {...baseProps} />);
    expect(await screen.findByText('No templates yet.')).toBeTruthy();
  });

  it('builds a new template and only offers active shifts', async () => {
    vi.spyOn(DatabaseConnection, 'getRosterTemplates').mockResolvedValue([]);
    const create = vi.spyOn(DatabaseConnection, 'createRosterTemplate').mockResolvedValue(template());
    render(<RosterTemplatesModal {...baseProps} />);
    await screen.findByText('No templates yet.');

    fireEvent.click(screen.getByText('New template'));
    expect(screen.queryByText('Retired Patrol')).toBeNull(); // dropped from the shift picker

    fireEvent.change(screen.getByPlaceholderText('Standard week'), { target: { value: 'My Week' } });
    fireEvent.change(screen.getByLabelText('Shift'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Volunteer'), { target: { value: '51' } });
    fireEvent.click(screen.getByText('Save template'));

    await waitFor(() => expect(create).toHaveBeenCalledWith('My Week', [{ day_of_week: 1, shift_id: 1, user_id: 51 }]));
  });

  it('refuses to save an incomplete row', async () => {
    vi.spyOn(DatabaseConnection, 'getRosterTemplates').mockResolvedValue([]);
    const create = vi.spyOn(DatabaseConnection, 'createRosterTemplate');
    render(<RosterTemplatesModal {...baseProps} />);
    await screen.findByText('No templates yet.');
    fireEvent.click(screen.getByText('New template'));
    fireEvent.change(screen.getByPlaceholderText('Standard week'), { target: { value: 'My Week' } });
    fireEvent.click(screen.getByText('Save template'));
    expect(await screen.findByText(/add at least one complete row/i)).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  it('applies a template to the default week and reports what happened', async () => {
    vi.spyOn(DatabaseConnection, 'getRosterTemplates').mockResolvedValue([template()]);
    const apply = vi.spyOn(DatabaseConnection, 'applyRosterTemplate').mockResolvedValue({
      message: 'ok',
      created: [{ user: 'Maria Karydi', date: '2026-10-05', shift: 'Loggos Survey', assignment_id: 1 }],
      skipped: [{ user: 'Nikos Floros', date: '2026-10-08', shift: 'Loggos Survey', reason: 'already has something that day' }],
    });
    render(<RosterTemplatesModal {...baseProps} />);
    fireEvent.click(await screen.findByText('Apply'));
    expect((screen.getByLabelText('Week of') as HTMLInputElement).value).toBe('2026-10-05');
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => expect(apply).toHaveBeenCalledWith(9, '2026-10-05'));
    expect(await screen.findByText('1 shift added.')).toBeTruthy();
    expect(screen.getByText(/1 skipped/)).toBeTruthy();
    await waitFor(() => expect(baseProps.onApplied).toHaveBeenCalled());
  });

  it('does not refresh the caller when nothing was created', async () => {
    const onApplied = vi.fn();
    vi.spyOn(DatabaseConnection, 'getRosterTemplates').mockResolvedValue([template()]);
    vi.spyOn(DatabaseConnection, 'applyRosterTemplate').mockResolvedValue({ message: 'ok', created: [], skipped: [] });
    render(<RosterTemplatesModal {...baseProps} onApplied={onApplied} />);
    fireEvent.click(await screen.findByText('Apply'));
    fireEvent.click(screen.getByText('Confirm'));
    await screen.findByText('0 shifts added.');
    expect(onApplied).not.toHaveBeenCalled();
  });

  it('deletes a template after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(DatabaseConnection, 'getRosterTemplates')
      .mockResolvedValueOnce([template()])
      .mockResolvedValueOnce([]);
    const del = vi.spyOn(DatabaseConnection, 'deleteRosterTemplate').mockResolvedValue(undefined);
    render(<RosterTemplatesModal {...baseProps} />);
    fireEvent.click(await screen.findByLabelText('Delete Standard week'));
    await waitFor(() => expect(del).toHaveBeenCalledWith(9));
    expect(await screen.findByText('No templates yet.')).toBeTruthy();
  });

  it('shows an error and keeps the template when delete fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(DatabaseConnection, 'getRosterTemplates').mockResolvedValue([template()]);
    vi.spyOn(DatabaseConnection, 'deleteRosterTemplate').mockRejectedValue(new Error('nope'));
    render(<RosterTemplatesModal {...baseProps} />);
    fireEvent.click(await screen.findByLabelText('Delete Standard week'));
    expect(await screen.findByText('nope')).toBeTruthy();
    expect(screen.getByText('Standard week')).toBeTruthy();
  });
});
