// QA-033: Request Access used to fail completely silently for a weak or
// mismatched password - no message, no request, no field highlight - because
// a single blanket `if (...) return;` covered every required field
// (including Station, which isn't pre-selected) and ran before the specific
// password checks ever got a chance to show anything. These pin down that
// each failure mode now shows a real message and never reaches the network.
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

const submitForm = () => {
  const submitButton = screen.getByText('Submit Application').closest('button')!;
  fireEvent.submit(submitButton.closest('form')!);
};

describe('Login — sign-up validation (QA-033)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a message and makes no request when Station is left unselected', async () => {
    render(<Login onLogin={vi.fn()} />);
    goToSignUp();
    await waitFor(() => expect(screen.getByLabelText(/^Station/)).not.toBeDisabled());

    fireEvent.change(screen.getByLabelText(/^First Name/), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText(/^Last Name/), { target: { value: 'Karydi' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'maria@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'a-strong-password' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password/), { target: { value: 'a-strong-password' } });
    fireEvent.click(screen.getByRole('checkbox'));
    // Station deliberately left as the default '' - this is the exact gap
    // that made the original bug report's repro look like total silence.
    submitForm();

    expect(await screen.findByText(/including your station/i)).toBeInTheDocument();
    expect(DatabaseConnection.createUser).not.toHaveBeenCalled();
  });

  it('shows a message and makes no request for a password under 8 characters', async () => {
    render(<Login onLogin={vi.fn()} />);
    goToSignUp();
    await waitFor(() => expect(screen.getByLabelText(/^Station/)).not.toBeDisabled());

    fireEvent.change(screen.getByLabelText(/^First Name/), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText(/^Last Name/), { target: { value: 'Karydi' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'maria@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password/), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText(/^Station/), { target: { value: 'Lix' } });
    fireEvent.click(screen.getByRole('checkbox'));
    submitForm();

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(DatabaseConnection.createUser).not.toHaveBeenCalled();
  });

  it('shows a message and makes no request when the passwords do not match', async () => {
    render(<Login onLogin={vi.fn()} />);
    goToSignUp();
    await waitFor(() => expect(screen.getByLabelText(/^Station/)).not.toBeDisabled());

    fireEvent.change(screen.getByLabelText(/^First Name/), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText(/^Last Name/), { target: { value: 'Karydi' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'maria@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'a-strong-password' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password/), { target: { value: 'a-different-one' } });
    fireEvent.change(screen.getByLabelText(/^Station/), { target: { value: 'Lix' } });
    fireEvent.click(screen.getByRole('checkbox'));
    submitForm();

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(DatabaseConnection.createUser).not.toHaveBeenCalled();
  });
});
