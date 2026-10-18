// QA-134: the Notes field in both the Review Queue's own "Edit" form and
// the Volunteer's "My Submissions > Edit & send back for review" form (the
// same renderEditField, shared by both flows) rendered as a single-line
// <input type="text">, so a long walk note scrolled off to one side instead
// of wrapping like Morning Survey's own WALK NOTES textarea does.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    updateMorningSurvey: vi.fn(),
    updateEmergence: vi.fn(),
    updateNestEvent: vi.fn(),
    getBeaches: vi.fn().mockResolvedValue([]),
  },
}));

const volunteer: User = {
  id: 51, firstName: 'Maria', lastName: 'Karydi', role: 'Field Volunteer', avatar: '', email: 'maria@example.com',
};

const longNote = 'Cage check on VR-2: raccoon tracks along the fence line, reinforced the ' +
  'north stake and flagged it for the morning crew to re-check before the next high tide.';

const surveyReview: RecordReview = {
  id: 139,
  record_type: 'morning_survey',
  record_id: 156,
  status: 'rejected',
  submitted_by: 51,
  submitted_at: '2026-10-16T03:05:00.000Z',
  reviewed_by: 7,
  reviewed_at: '2026-10-17T06:00:00.000Z',
  review_note: 'Can you say more about the cage check?',
  submitted_by_first_name: 'Maria',
  submitted_by_last_name: 'Karydi',
  reviewed_by_first_name: 'Elena',
  reviewed_by_last_name: 'Papadaki',
  record_label: 'Makris Gialos',
  record_kind: 'Morning survey',
  record_detail: {
    survey_date: '2026-10-15',
    beach: 'Makris Gialos',
    start_time: '06:10:00',
    end_time: '06:30:00',
    notes: longNote,
    protected_nest_count: 0,
    linked_emergences: [],
    linked_tracks: [],
  },
  record_missing: false,
};

describe('ReviewQueue — Notes renders as a multi-line textarea (QA-134)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders notes as a TEXTAREA, not a single-line input', async () => {
    (DatabaseConnection.getMyReviews as any).mockResolvedValue([surveyReview]);

    render(<ReviewQueue user={volunteer} />);

    fireEvent.click(await screen.findByText(/Morning survey · Makris Gialos/));
    fireEvent.click(screen.getByText('Edit & send back for review'));

    const notesField = await screen.findByLabelText('Notes');
    expect(notesField.tagName).toBe('TEXTAREA');
    expect((notesField as HTMLTextAreaElement).value).toBe(longNote);
  });

  it('sends an edited notes value through updateMorningSurvey', async () => {
    (DatabaseConnection.getMyReviews as any).mockResolvedValue([surveyReview]);
    (DatabaseConnection.updateMorningSurvey as any).mockResolvedValue({});
    (DatabaseConnection.resubmitReview as any).mockResolvedValue({ ...surveyReview, status: 'pending' });

    render(<ReviewQueue user={volunteer} />);

    fireEvent.click(await screen.findByText(/Morning survey · Makris Gialos/));
    fireEvent.click(screen.getByText('Edit & send back for review'));

    const notesField = await screen.findByLabelText('Notes');
    fireEvent.change(notesField, { target: { value: longNote + ' Resolved by midday.' } });

    fireEvent.click(screen.getByText('Save & send back for review'));

    await waitFor(() => expect(DatabaseConnection.resubmitReview).toHaveBeenCalled());
    expect(DatabaseConnection.updateMorningSurvey).toHaveBeenCalledWith(
      156,
      expect.objectContaining({ notes: longNote + ' Resolved by midday.' })
    );
  });
});
