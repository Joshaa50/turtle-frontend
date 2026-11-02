import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from '../screens/Login';
import { DatabaseConnection } from '../services/Database';

// The sign-up screen only shows the checkboxes because the server enforces
// both too (see turtle-backend/tests/registration-privacy-notice.test.js) -
// this pins down that they're actually wired to something, not just present.
// A checkbox nobody can fail to check protects nobody.
vi.mock('../services/Database', () => ({
  DatabaseConnection: {
    getDemoRoles: vi.fn().mockResolvedValue([]),
    createUser: vi.fn().mockResolvedValue({ message: 'ok' }),
    // The station picker is fed from the coordinator's beach configuration.
    // Two stations, so nothing is preselected and the field still has to be
    // chosen - which is what these tests fill in.
    getPublicStations: vi.fn().mockResolvedValue(['Lix', 'Argo']),
    // Org name and retention are fetched rather than hard-coded (GD-006) -
    // mocked here so the notice renders deployment-specific text instead of
    // whatever the real deployed backend happens to have configured.
    getPublicConfig: vi.fn().mockResolvedValue({
      org_name: 'Kefalonia Turtle Watch',
      privacy_contact_email: 'privacy@example.org',
      operator_contact_email: 'support@example.org',
      retention: { auto_erase_enabled: true, inactive_days: 730 },
    }),
  },
}));

const goToSignUp = () => fireEvent.click(screen.getByText('Request Access'));

// Required-field labels render with a trailing "*" in a nested span, so the
// accessible name is "First Name*" rather than an exact "First Name".
const fillRequiredFields = async () => {
  // Stations are fetched on mount, so the picker is disabled until they land.
  await waitFor(() => expect(screen.getByLabelText(/^Station/)).not.toBeDisabled());

  fireEvent.change(screen.getByLabelText(/^First Name/), { target: { value: 'Maria' } });
  fireEvent.change(screen.getByLabelText(/^Last Name/), { target: { value: 'Karydi' } });
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'maria@example.com' } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'a-strong-password' } });
  fireEvent.change(screen.getByLabelText(/^Confirm Password/), { target: { value: 'a-strong-password' } });
  // Station is a required choice now that the list comes from the
  // coordinator's configuration rather than defaulting to a hard-coded name.
  fireEvent.change(screen.getByLabelText(/^Station/), { target: { value: 'Lix' } });
};

describe('Login — sign-up data notice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('disables Submit Application until both the notice and age checkboxes are checked', async () => {
    render(<Login onLogin={vi.fn()} />);
    goToSignUp();
    await fillRequiredFields();

    const submit = await screen.findByText('Submit Application');
    const [noticeBox, ageBox] = screen.getAllByRole('checkbox');
    expect(submit.closest('button')).toBeDisabled();

    fireEvent.click(noticeBox);
    expect(submit.closest('button')).toBeDisabled();

    fireEvent.click(ageBox);
    expect(submit.closest('button')).not.toBeDisabled();
  });

  it('disables Submit Application again if either checkbox is unchecked', async () => {
    render(<Login onLogin={vi.fn()} />);
    goToSignUp();
    await fillRequiredFields();

    const submit = await screen.findByText('Submit Application');
    const [noticeBox, ageBox] = screen.getAllByRole('checkbox');
    fireEvent.click(noticeBox);
    fireEvent.click(ageBox);
    expect(submit.closest('button')).not.toBeDisabled();

    fireEvent.click(ageBox); // uncheck the age confirmation
    expect(submit.closest('button')).toBeDisabled();
  });

  it('sends privacyNoticeAccepted: true and ageConfirmed: true once both are checked and submitted', async () => {
    render(<Login onLogin={vi.fn()} />);
    goToSignUp();
    await fillRequiredFields();
    const [noticeBox, ageBox] = screen.getAllByRole('checkbox');
    fireEvent.click(noticeBox);
    fireEvent.click(ageBox);
    fireEvent.click(screen.getByText('Submit Application'));

    await waitFor(() => expect(DatabaseConnection.createUser).toHaveBeenCalled());
    const call = (DatabaseConnection.createUser as any).mock.calls[0][0];
    expect(call.privacyNoticeAccepted).toBe(true);
    expect(call.ageConfirmed).toBe(true);
  });

  it('never calls createUser if either checkbox is somehow unchecked at submit time', async () => {
    render(<Login onLogin={vi.fn()} />);
    goToSignUp();
    await fillRequiredFields();
    // The disabled button already stops a normal click - submitting the form
    // directly is how this checks that handleSignUp's own guard refuses too,
    // not just the UI, since disabled is a client-side attribute a form could
    // still be submitted around (e.g. pressing Enter in certain browsers).
    const submitButton = screen.getByText('Submit Application').closest('button')!;
    fireEvent.submit(submitButton.closest('form')!);

    expect(DatabaseConnection.createUser).not.toHaveBeenCalled();
    expect(await screen.findByText(/you must confirm/i)).toBeInTheDocument();
  });

  it('opens and closes the full notice text, rendering the org name and retention from the fetched config', async () => {
    render(<Login onLogin={vi.fn()} />);
    goToSignUp();

    fireEvent.click(screen.getByText('Read the full notice'));
    expect(await screen.findByText('How we use your information')).toBeInTheDocument();
    expect(screen.getByText(/Kefalonia Turtle Watch/)).toBeInTheDocument();
    // 730 days -> 24 months, from the mocked config, not a hard-coded number.
    expect(screen.getByText(/24 months/)).toBeInTheDocument();
    expect(screen.getByText(/legitimate interests/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    await waitFor(() =>
      expect(screen.queryByText(/legitimate interests/)).not.toBeInTheDocument(),
    );
  });
});
