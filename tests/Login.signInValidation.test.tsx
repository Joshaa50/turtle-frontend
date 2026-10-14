// QA-087: pressing Log in with an empty email/password used to do nothing at
// all - no message, no field highlight - because handleSignIn had a single
// blanket `if (!email || !password) return;` guard. These pin down that each
// empty field now shows its own message under its own input, both at once
// when both are empty, and never reaches the network.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from '../screens/Login';
import { DatabaseConnection } from '../services/Database';

vi.mock('../services/Database', () => ({
  DatabaseConnection: {
    getDemoRoles: vi.fn().mockResolvedValue([]),
    getPublicStations: vi.fn().mockResolvedValue(['Lix', 'Argo']),
    loginUser: vi.fn().mockResolvedValue({ user: { id: 1, email: 'a@b.com' } }),
  },
}));

const submitForm = () => {
  const submitButton = screen.getByText('Log in').closest('button')!;
  fireEvent.submit(submitButton.closest('form')!);
};

describe('Login — sign-in validation (QA-087)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows both field messages when email and password are empty', async () => {
    render(<Login onLogin={vi.fn()} />);
    submitForm();

    expect(await screen.findByText('Enter your email')).toBeInTheDocument();
    expect(await screen.findByText('Enter your password')).toBeInTheDocument();
    expect(DatabaseConnection.loginUser).not.toHaveBeenCalled();
  });

  it('shows only the email message when password is filled and email is empty', async () => {
    render(<Login onLogin={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'some-password' } });
    submitForm();

    expect(await screen.findByText('Enter your email')).toBeInTheDocument();
    expect(screen.queryByText('Enter your password')).not.toBeInTheDocument();
    expect(DatabaseConnection.loginUser).not.toHaveBeenCalled();
  });

  it('shows only the password message when email is filled and password is empty', async () => {
    render(<Login onLogin={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^Email Address/), { target: { value: 'a@b.com' } });
    submitForm();

    expect(await screen.findByText('Enter your password')).toBeInTheDocument();
    expect(screen.queryByText('Enter your email')).not.toBeInTheDocument();
    expect(DatabaseConnection.loginUser).not.toHaveBeenCalled();
  });

  it('clears only the email error when typing into the email field, leaving the password error intact', async () => {
    render(<Login onLogin={vi.fn()} />);
    submitForm();

    expect(await screen.findByText('Enter your email')).toBeInTheDocument();
    expect(await screen.findByText('Enter your password')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Email Address/), { target: { value: 'a@b.com' } });

    await waitFor(() => expect(screen.queryByText('Enter your email')).not.toBeInTheDocument());
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
  });
});
