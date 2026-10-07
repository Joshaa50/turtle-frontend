// QA-044: with 2+ stations, nothing pre-selects the Station dropdown (by
// design - see the comment on the stations effect), but the <select> had no
// option whose value matched the empty state, so the browser silently fell
// back to displaying the first real station as chosen. The DOM looked picked;
// the React state - and what actually got submitted - stayed empty, so
// Submit always failed with "including your station" until the user visibly
// changed the dropdown once.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from '../screens/Login';
import { DatabaseConnection } from '../services/Database';

vi.mock('../services/Database', () => ({
  DatabaseConnection: {
    getDemoRoles: vi.fn().mockResolvedValue([]),
    createUser: vi.fn().mockResolvedValue({ message: 'ok' }),
    getPublicStations: vi.fn().mockResolvedValue(['Lix', 'Argo']),
  },
}));

const goToSignUp = () => fireEvent.click(screen.getByText('Request Access'));

describe('Login — sign-up Station select (QA-044)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows an explicit placeholder instead of implying the first station is chosen', async () => {
    render(<Login onLogin={vi.fn()} />);
    goToSignUp();

    const select = await waitFor(() => screen.getByLabelText(/^Station/) as HTMLSelectElement);
    await waitFor(() => expect(select).not.toBeDisabled());

    // Nothing pre-selected with 2+ stations - the placeholder is what's shown.
    expect(select.value).toBe('');
    expect(screen.getByText('Select a station…')).toBeInTheDocument();
  });

  it('submits the station actually picked once the user chooses one', async () => {
    render(<Login onLogin={vi.fn()} />);
    goToSignUp();

    const select = await waitFor(() => screen.getByLabelText(/^Station/) as HTMLSelectElement);
    await waitFor(() => expect(select).not.toBeDisabled());

    fireEvent.change(select, { target: { value: 'Argo' } });
    expect(select.value).toBe('Argo');
    // Placeholder option is gone once a real station is selected.
    expect(screen.queryByText('Select a station…')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^First Name/), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText(/^Last Name/), { target: { value: 'Karydi' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'maria@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'a-strong-password' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password/), { target: { value: 'a-strong-password' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Submit Application'));

    await waitFor(() => expect(DatabaseConnection.createUser).toHaveBeenCalled());
    const call = (DatabaseConnection.createUser as any).mock.calls[0][0];
    expect(call.station).toBe('Argo');
  });
});
