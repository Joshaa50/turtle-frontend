import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AlertsBell from '../components/AlertsBell';
import { DatabaseConnection } from '../services/Database';
import type { AppAlert } from '../types';

const alert = (over: Partial<AppAlert> = {}): AppAlert => ({
  id: 'review-5', review_id: 5, kind: 'review_rejected', title: 'Needs correction',
  message: 'Nest LG2-9 was sent back: Wrong marker', at: new Date().toISOString(), can_acknowledge: true, ...over,
});

beforeEach(() => vi.restoreAllMocks());

const open = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /^Alerts/ }));
};

describe('AlertsBell', () => {
  it('shows the count of things needing attention', async () => {
    vi.spyOn(DatabaseConnection, 'getAlerts').mockResolvedValue([alert(), alert({ id: 'review-6', review_id: 6 })]);
    render(<AlertsBell onOpenReviews={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Alerts, 2 need attention' })).toBeTruthy();
  });

  it('says so when there is nothing to do', async () => {
    vi.spyOn(DatabaseConnection, 'getAlerts').mockResolvedValue([]);
    render(<AlertsBell onOpenReviews={vi.fn()} />);
    await open();
    expect(await screen.findByText("You're all caught up.")).toBeTruthy();
  });

  it('shows what was sent back and why', async () => {
    vi.spyOn(DatabaseConnection, 'getAlerts').mockResolvedValue([alert()]);
    render(<AlertsBell onOpenReviews={vi.fn()} />);
    await open();
    expect(await screen.findByText(/Wrong marker/)).toBeTruthy();
    expect(screen.getByText('Needs correction')).toBeTruthy();
  });

  it('clears an acknowledged alert', async () => {
    vi.spyOn(DatabaseConnection, 'getAlerts').mockResolvedValue([alert()]);
    const ack = vi.spyOn(DatabaseConnection, 'acknowledgeAlert').mockResolvedValue(undefined);
    render(<AlertsBell onOpenReviews={vi.fn()} />);
    await open();
    fireEvent.click(await screen.findByRole('button', { name: /Got it/ }));
    await waitFor(() => expect(ack).toHaveBeenCalledWith('review-5'));
    expect(await screen.findByText("You're all caught up.")).toBeTruthy();
  });

  it('offers no "Got it" on a pending review, which clears by being decided', async () => {
    vi.spyOn(DatabaseConnection, 'getAlerts').mockResolvedValue([
      alert({ kind: 'review_pending', title: 'Waiting for your review', message: 'Nest X from Maria', can_acknowledge: false }),
    ]);
    render(<AlertsBell onOpenReviews={vi.fn()} />);
    await open();
    expect(await screen.findByText('Waiting for your review')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Got it/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Review it' })).toBeTruthy();
  });

  it('keeps the alert and says why when acknowledging fails', async () => {
    vi.spyOn(DatabaseConnection, 'getAlerts').mockResolvedValue([alert()]);
    vi.spyOn(DatabaseConnection, 'acknowledgeAlert').mockRejectedValue(new Error('Already cleared'));
    render(<AlertsBell onOpenReviews={vi.fn()} />);
    await open();
    fireEvent.click(await screen.findByRole('button', { name: /Got it/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Already cleared')).toBeTruthy();
  });

  it('opens the review screen from an alert', async () => {
    vi.spyOn(DatabaseConnection, 'getAlerts').mockResolvedValue([alert()]);
    const onOpenReviews = vi.fn();
    render(<AlertsBell onOpenReviews={onOpenReviews} />);
    await open();
    fireEvent.click(await screen.findByRole('button', { name: 'View' }));
    expect(onOpenReviews).toHaveBeenCalled();
  });
});

describe('AlertsBell: retention warnings', () => {
  const retentionAlert = alert({
    id: 'retention-21', review_id: undefined, kind: 'retention_warning',
    title: 'Account due for automatic erasure',
    message: "Liam O'Connor (Field Volunteer) has been inactive since 2025-03-01 and will be erased on 2025-09-01 unless they sign in.",
    can_acknowledge: false,
  });

  it('shows a retention warning with no "Got it" - it clears on its own', async () => {
    vi.spyOn(DatabaseConnection, 'getAlerts').mockResolvedValue([retentionAlert]);
    render(<AlertsBell onOpenReviews={vi.fn()} onOpenSettings={vi.fn()} />);
    await open();
    expect(await screen.findByText('Account due for automatic erasure')).toBeTruthy();
    expect(screen.getByText(/Liam O'Connor/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Got it/ })).toBeNull();
  });

  it('opens Project Settings from a retention warning, not the review queue', async () => {
    vi.spyOn(DatabaseConnection, 'getAlerts').mockResolvedValue([retentionAlert]);
    const onOpenReviews = vi.fn();
    const onOpenSettings = vi.fn();
    render(<AlertsBell onOpenReviews={onOpenReviews} onOpenSettings={onOpenSettings} />);
    await open();
    fireEvent.click(await screen.findByText('Open settings'));
    expect(onOpenSettings).toHaveBeenCalled();
    expect(onOpenReviews).not.toHaveBeenCalled();
  });

  it('offers no action for a retention warning when no settings callback is given', async () => {
    vi.spyOn(DatabaseConnection, 'getAlerts').mockResolvedValue([retentionAlert]);
    render(<AlertsBell onOpenReviews={vi.fn()} />);
    await open();
    await screen.findByText('Account due for automatic erasure');
    expect(screen.queryByText('Open settings')).toBeNull();
  });
});

describe('AlertsBell: overdue nests', () => {
  const overdueAlert = alert({
    id: 'nest-overdue-AI-2', review_id: undefined, kind: 'nest_overdue',
    title: 'Nest overdue for excavation',
    message: 'AI-2 on Agios Ioannis was found 82 days ago and still has no inventory recorded.',
    can_acknowledge: false,
  });

  it('shows an overdue-nest alert with no "Got it" - it clears when the nest is excavated', async () => {
    vi.spyOn(DatabaseConnection, 'getAlerts').mockResolvedValue([overdueAlert]);
    render(<AlertsBell onOpenReviews={vi.fn()} onOpenNests={vi.fn()} />);
    await open();
    expect(await screen.findByText('Nest overdue for excavation')).toBeTruthy();
    expect(screen.getByText(/AI-2/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Got it/ })).toBeNull();
  });

  it('opens Nest Records from an overdue-nest alert, not the review queue', async () => {
    vi.spyOn(DatabaseConnection, 'getAlerts').mockResolvedValue([overdueAlert]);
    const onOpenReviews = vi.fn();
    const onOpenNests = vi.fn();
    render(<AlertsBell onOpenReviews={onOpenReviews} onOpenNests={onOpenNests} />);
    await open();
    fireEvent.click(await screen.findByText('View nests'));
    expect(onOpenNests).toHaveBeenCalled();
    expect(onOpenReviews).not.toHaveBeenCalled();
  });

  it('offers no action for an overdue-nest alert when no nests callback is given', async () => {
    vi.spyOn(DatabaseConnection, 'getAlerts').mockResolvedValue([overdueAlert]);
    render(<AlertsBell onOpenReviews={vi.fn()} />);
    await open();
    await screen.findByText('Nest overdue for excavation');
    expect(screen.queryByText('View nests')).toBeNull();
  });
});
