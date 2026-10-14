// QA-111: an email with no '@' used to be sent to the server, which answered
// "Invalid email or password." and implied the password was wrong. These pin
// down that a malformed address is caught on the client, before any request.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from '../screens/Login';
import { DatabaseConnection } from '../services/Database';

vi.mock('../services/Database', () => ({
  DatabaseConnection: {
    getDemoRoles: vi.fn(),
    getPublicStations: vi.fn(),
    loginUser: vi.fn(),
    getUser: vi.fn(),
    requestPasswordReset: vi.fn(),
    createUser: vi.fn(),
  },
}));

const INVALID_MESSAGE = 'Enter a valid email address.';

describe('Login — email format check (QA-111)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DatabaseConnection.getDemoRoles).mockResolvedValue([]);
    vi.mocked(DatabaseConnection.getPublicStations).mockResolvedValue(['Lix', 'Argo']);
    vi.mocked(DatabaseConnection.loginUser).mockResolvedValue({ user: { id: 1, email: 'maria@example.com' } } as any);
    vi.mocked(DatabaseConnection.requestPasswordReset).mockResolvedValue({} as any);
    vi.mocked(DatabaseConnection.createUser).mockResolvedValue({ message: 'ok' } as any);
  });

  it('sign-in: shows the format message and makes no request for an address without @', async () => {
    render(<Login onLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^Email Address/), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'whatever-password' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Log in' }).closest('form')!);

    expect(await screen.findByText(INVALID_MESSAGE)).toBeInTheDocument();
    expect(DatabaseConnection.loginUser).not.toHaveBeenCalled();
    expect(screen.queryByText('Invalid email or password.')).not.toBeInTheDocument();
  });

  it('sign-in: rejects a domain without a dot and an address containing spaces', async () => {
    render(<Login onLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'whatever-password' } });
    for (const bad of ['maria@example', 'ma ria@example.com']) {
      fireEvent.change(screen.getByLabelText(/^Email Address/), { target: { value: bad } });
      fireEvent.submit(screen.getByRole('button', { name: 'Log in' }).closest('form')!);
      expect(await screen.findByText(INVALID_MESSAGE)).toBeInTheDocument();
    }
    expect(DatabaseConnection.loginUser).not.toHaveBeenCalled();
  });

  it('sign-in: a well-formed address still goes to the server', async () => {
    render(<Login onLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^Email Address/), { target: { value: 'Maria@Example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'whatever-password' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Log in' }).closest('form')!);

    await waitFor(() => expect(DatabaseConnection.loginUser).toHaveBeenCalledWith('maria@example.com', 'whatever-password'));
    expect(screen.queryByText(INVALID_MESSAGE)).not.toBeInTheDocument();
  });

  it('forgot password: shows the format message and makes no request', async () => {
    render(<Login onLogin={vi.fn()} />);

    fireEvent.click(screen.getByText('Forgot Password?'));
    fireEvent.change(screen.getByLabelText(/^Email Address/), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request Reset' }));

    expect(await screen.findByText(INVALID_MESSAGE)).toBeInTheDocument();
    expect(DatabaseConnection.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('request access: shows the format message and makes no request', async () => {
    render(<Login onLogin={vi.fn()} />);

    fireEvent.click(screen.getByText('Request Access'));
    await waitFor(() => expect(screen.getByLabelText(/^Station/)).not.toBeDisabled());

    fireEvent.change(screen.getByLabelText(/^First Name/), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText(/^Last Name/), { target: { value: 'Karydi' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'a-strong-password' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password/), { target: { value: 'a-strong-password' } });
    fireEvent.change(screen.getByLabelText(/^Station/), { target: { value: 'Lix' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(screen.getByText('Submit Application').closest('form')!);

    expect(await screen.findByText(INVALID_MESSAGE)).toBeInTheDocument();
    expect(DatabaseConnection.createUser).not.toHaveBeenCalled();
  });
});
