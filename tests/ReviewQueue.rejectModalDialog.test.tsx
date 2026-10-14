// QA-074 (continuing): the hand-rolled "Send back for correction" modal
// never exposed role="dialog"/aria-modal to assistive tech, so a screen
// reader had no way to know focus had moved into an overlay.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReviewQueue from '../screens/ReviewQueue';
import { DatabaseConnection } from '../services/Database';
import { RecordReview, User } from '../types';

vi.mock('../services/Database', () => ({
  DatabaseConnection: {
    getReviews: vi.fn(),
    getMyReviews: vi.fn(),
    decideReview: vi.fn(),
    bulkApproveReviews: vi.fn(),
    dismissReview: vi.fn(),
    resubmitReview: vi.fn(),
    getBeaches: vi.fn().mockResolvedValue([]),
  },
}));

const leader: User = {
  id: 7, firstName: 'Nikos', lastName: 'Floros', role: 'Field Leader', avatar: '', email: 'nikos@example.com',
};

const pendingReview: RecordReview = {
  id: 1,
  record_type: 'emergence',
  record_id: 10,
  status: 'pending',
  submitted_by: 51,
  submitted_at: '2026-10-06T03:12:00.000Z',
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  submitted_by_first_name: 'Maria',
  submitted_by_last_name: 'Karydi',
  reviewed_by_first_name: null,
  reviewed_by_last_name: null,
  record_label: 'Agios Ioannis',
  record_kind: 'Emergence',
  record_detail: { event_date: '2026-10-06', emergence_type: 'False crawl' },
  record_missing: false,
} as any;

beforeEach(() => vi.clearAllMocks());

describe('ReviewQueue — "Send back for correction" dialog semantics (QA-074)', () => {
  it('exposes the rejection panel as a role="dialog" with an accessible name', async () => {
    (DatabaseConnection.getReviews as any).mockResolvedValue([pendingReview]);

    render(<ReviewQueue user={leader} />);

    await screen.findByText(/Emergence · Agios Ioannis/);
    fireEvent.click(screen.getByRole('button', { name: /show record details/i }));

    fireEvent.click(await screen.findByRole('button', { name: /^send back$/i }));

    const dialog = await screen.findByRole('dialog', { name: 'Send back for correction' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
