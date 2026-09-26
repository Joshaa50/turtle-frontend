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
