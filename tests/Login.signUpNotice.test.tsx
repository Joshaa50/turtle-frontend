import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from '../screens/Login';
import { DatabaseConnection } from '../services/Database';

// The sign-up screen only shows a checkbox because the server enforces the
// notice too (see turtle-backend/tests/registration-privacy-notice.test.js) -
// this pins down that the checkbox is actually wired to something, not just
// present. A checkbox nobody can fail to check protects nobody.
vi.mock('../services/Database', () => ({
  DatabaseConnection: {
    getDemoRoles: vi.fn().mockResolvedValue([]),
    createUser: vi.fn().mockResolvedValue({ message: 'ok' }),
  },
}));

const goToSignUp = () => fireEvent.click(screen.getByText('Request Access'));

// Required-field labels render with a trailing "*" in a nested span, so the
// accessible name is "First Name*" rather than an exact "First Name".
const fillRequiredFields = () => {
  fireEvent.change(screen.getByLabelText(/^First Name/), { target: { value: 'Maria' } });
  fireEvent.change(screen.getByLabelText(/^Last Name/), { target: { value: 'Karydi' } });
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'maria@example.com' } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'a-strong-password' } });
  fireEvent.change(screen.getByLabelText(/^Confirm Password/), { target: { value: 'a-strong-password' } });
};

describe('Login — sign-up data notice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('disables Submit Application until the notice is agreed to', async () => {
    render(<Login onLogin={vi.fn()} />);
    goToSignUp();
    fillRequiredFields();

    const submit = await screen.findByText('Submit Application');
    expect(submit.closest('button')).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(submit.closest('button')).not.toBeDisabled();
  });

  it('sends privacyNoticeAccepted: true once agreed and submitted', async () => {
    render(<Login onLogin={vi.fn()} />);
    goToSignUp();
    fillRequiredFields();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Submit Application'));

    await waitFor(() => expect(DatabaseConnection.createUser).toHaveBeenCalled());
    const call = (DatabaseConnection.createUser as any).mock.calls[0][0];
    expect(call.privacyNoticeAccepted).toBe(true);
  });

  it('never calls createUser if the checkbox is somehow unchecked at submit time', async () => {
    render(<Login onLogin={vi.fn()} />);
    goToSignUp();
    fillRequiredFields();
    // The disabled button already stops a normal click - submitting the form
    // directly is how this checks that handleSignUp's own guard refuses too,
    // not just the UI, since disabled is a client-side attribute a form could
    // still be submitted around (e.g. pressing Enter in certain browsers).
    const submitButton = screen.getByText('Submit Application').closest('button')!;
    fireEvent.submit(submitButton.closest('form')!);

    expect(DatabaseConnection.createUser).not.toHaveBeenCalled();
    expect(await screen.findByText(/agree to the data notice/i)).toBeInTheDocument();
  });

  it('opens and closes the full notice text', async () => {
    render(<Login onLogin={vi.fn()} />);
    goToSignUp();

    fireEvent.click(screen.getByText('Read the full notice'));
    expect(await screen.findByText('How we use your information')).toBeInTheDocument();
    expect(screen.getByText(/Google's Gemini API/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    await waitFor(() =>
      expect(screen.queryByText(/Data protection law depends on where/)).not.toBeInTheDocument(),
    );
  });
});
