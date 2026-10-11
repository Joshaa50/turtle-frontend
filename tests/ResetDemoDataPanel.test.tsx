import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResetDemoDataPanel from '../components/ResetDemoDataPanel';
import { DatabaseConnection } from '../services/Database';

describe('ResetDemoDataPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reveals a type-to-confirm panel, keeps the confirm button disabled until the exact phrase is typed, and calls resetDemoData on confirm', async () => {
    const resetSpy = vi.spyOn(DatabaseConnection, 'resetDemoData').mockResolvedValue({
      message: 'Demo data wiped. Regenerating fresh data in the background.',
      deleted: { users: 3 },
    });

    render(<ResetDemoDataPanel />);

    fireEvent.click(screen.getByRole('button', { name: /reset demo data/i }));

    const confirmButton = screen.getByRole('button', { name: /reset permanently/i });
    expect(confirmButton).toBeDisabled();

    const input = screen.getByLabelText(/type.*to confirm/i);
    fireEvent.change(input, { target: { value: 'wrong phrase' } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'RESET DEMO DATA' } });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    await waitFor(() => expect(resetSpy).toHaveBeenCalledWith('RESET DEMO DATA'));
    await waitFor(() => expect(screen.getByText(/regenerating fresh data/i)).toBeTruthy());
  });

  it('shows an error message and keeps the panel open when the reset fails', async () => {
    vi.spyOn(DatabaseConnection, 'resetDemoData').mockRejectedValue(new Error('Server error while resetting. Nothing was changed.'));

    render(<ResetDemoDataPanel />);
    fireEvent.click(screen.getByRole('button', { name: /reset demo data/i }));
    fireEvent.change(screen.getByLabelText(/type.*to confirm/i), { target: { value: 'RESET DEMO DATA' } });
    fireEvent.click(screen.getByRole('button', { name: /reset permanently/i }));

    await waitFor(() => expect(screen.getByText(/nothing was changed/i)).toBeTruthy());
  });

  it('cancel returns to the initial button and clears the typed phrase', () => {
    render(<ResetDemoDataPanel />);
    fireEvent.click(screen.getByRole('button', { name: /reset demo data/i }));
    fireEvent.change(screen.getByLabelText(/type.*to confirm/i), { target: { value: 'RESET DEMO DATA' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByLabelText(/type.*to confirm/i)).toBeNull();
    expect(screen.getByRole('button', { name: /reset demo data/i })).toBeTruthy();
  });
});
