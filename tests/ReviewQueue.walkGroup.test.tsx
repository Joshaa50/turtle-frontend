// QA-034: a Morning Survey walk across several beaches queues one review per
// beach (e.g. 8 for a Lepeda walk), so a Field Leader used to have to open
// and approve each one individually. These pin down that same-submitter,
// same-date morning surveys are grouped into one "walk" card with a single
// bulk-approve button, while everything else (a lone survey, a nest, an
// emergence) still renders as its own standalone card.
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

const surveyReview = (id: number, beach: string, surveyDate = '2026-10-06'): RecordReview => ({
  id,
  record_type: 'morning_survey',
  record_id: id * 10,
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
  record_label: beach,
  record_kind: 'Morning survey',
  record_detail: { survey_date: surveyDate, beach },
  record_missing: false,
});

const emergenceReview = (id: number): RecordReview => ({
  id,
  record_type: 'emergence',
  record_id: id * 10,
  status: 'pending',
  submitted_by: 51,
  submitted_at: '2026-10-06T03:15:00.000Z',
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
});

describe('ReviewQueue — walk grouping (QA-034)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('groups several same-day, same-submitter morning surveys into one walk card with a bulk-approve button', async () => {
    const reviews = [
      surveyReview(1, 'Loggos 2'),
      surveyReview(2, 'Loggos 3'),
      surveyReview(3, 'Loggos 4'),
      emergenceReview(4),
    ];
    (DatabaseConnection.getReviews as any).mockResolvedValue(reviews);

    render(<ReviewQueue user={leader} />);

    expect(await screen.findByText('Morning survey walk · 3 beaches')).toBeInTheDocument();
    expect(screen.getByText(/Loggos 2, Loggos 3, Loggos 4/)).toBeInTheDocument();
    expect(screen.getByText('Approve all 3')).toBeInTheDocument();
    // The unrelated emergence is unaffected - still its own standalone card.
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && !!el.textContent?.startsWith('Emergence · Agios Ioannis'))
    ).toBeInTheDocument();
  });

  it('does not group a single-beach survey - nothing to batch', async () => {
    const reviews = [surveyReview(1, 'Loggos 2')];
    (DatabaseConnection.getReviews as any).mockResolvedValue(reviews);

    render(<ReviewQueue user={leader} />);

    await screen.findByText('Morning survey · Loggos 2');
    expect(screen.queryByText(/Morning survey walk/)).not.toBeInTheDocument();
  });

  it('does not group surveys from different submitters even on the same date', async () => {
    const reviews = [
      surveyReview(1, 'Loggos 2'),
      { ...surveyReview(2, 'Loggos 3'), submitted_by: 99, submitted_by_first_name: 'Someone', submitted_by_last_name: 'Else' },
    ];
    (DatabaseConnection.getReviews as any).mockResolvedValue(reviews);

    render(<ReviewQueue user={leader} />);

    await screen.findByText('Morning survey · Loggos 2');
    expect(screen.queryByText(/Morning survey walk/)).not.toBeInTheDocument();
  });

  it('"Approve all N" approves every pending beach in the walk in one request', async () => {
    const reviews = [surveyReview(1, 'Loggos 2'), surveyReview(2, 'Loggos 3')];
    (DatabaseConnection.getReviews as any).mockResolvedValue(reviews);
    (DatabaseConnection.bulkApproveReviews as any).mockResolvedValue({
      reviews: [
        { ...reviews[0], status: 'approved', reviewed_by: 7 },
        { ...reviews[1], status: 'approved', reviewed_by: 7 },
      ],
      skippedIds: [],
    });

    render(<ReviewQueue user={leader} />);
    await screen.findByText('Morning survey walk · 2 beaches');

    fireEvent.click(screen.getByText('Approve all 2'));

    await waitFor(() => expect(DatabaseConnection.bulkApproveReviews).toHaveBeenCalledWith([1, 2]));
    expect(await screen.findByText(/2 record\(s\) approved/)).toBeInTheDocument();
    // Both are now approved, so the walk card has nothing left to group.
    await waitFor(() => expect(screen.queryByText(/Morning survey walk/)).not.toBeInTheDocument());
  });

  it('a beach sent back individually drops out of the group, leaving the rest to bulk-approve', async () => {
    const reviews = [surveyReview(1, 'Loggos 2'), surveyReview(2, 'Loggos 3'), surveyReview(3, 'Loggos 4')];
    (DatabaseConnection.getReviews as any).mockResolvedValue(reviews);

    render(<ReviewQueue user={leader} />);
    await screen.findByText('Morning survey walk · 3 beaches');

    // Expand the first beach and send it back with a note.
    fireEvent.click(screen.getByText(/Morning survey · Loggos 2/));
    fireEvent.click(screen.getAllByText('Send back')[0]);
    fireEvent.change(screen.getByLabelText(/What needs correcting/i), { target: { value: 'Times look too short.' } });
    (DatabaseConnection.decideReview as any).mockResolvedValue({ ...reviews[0], status: 'rejected', review_note: 'Times look too short.' });
    const dialog = screen.getByText('Send back for correction').closest('div')!.parentElement!;
    fireEvent.click(within(dialog).getByRole('button', { name: /^Send back$/ }));

    await waitFor(() => expect(DatabaseConnection.decideReview).toHaveBeenCalledWith(1, 'reject', 'Times look too short.'));
    // Only 2 pending beaches left in the walk, so the group shrinks to match.
    expect(await screen.findByText('Morning survey walk · 2 beaches')).toBeInTheDocument();
  });
});
