// QA-129: a sent-back morning survey's correction form (and the reviewer's
// own Edit) had no way to fix survey_date - the layout showed it, but
// editableFieldsFor deliberately excluded it ("the date and beach identify
// which survey this is"). A reviewer could ask for a date fix (see QA-128)
// but nobody could act on it: PATCH /morning-surveys/151 with survey_date
// returned 200 with nothing changed. beach still stays fixed; survey_date is
// now editable like the times already were (QA-031).
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

const surveyReview: RecordReview = {
  id: 139,
  record_type: 'morning_survey',
  record_id: 151,
  status: 'rejected',
  submitted_by: 51,
  submitted_at: '2026-10-16T03:05:00.000Z',
  reviewed_by: 7,
  reviewed_at: '2026-10-17T06:00:00.000Z',
  review_note: 'Wrong date - this was the 15/10 walk. Please correct to 2026-10-15.',
  submitted_by_first_name: 'Maria',
  submitted_by_last_name: 'Karydi',
  reviewed_by_first_name: 'Elena',
  reviewed_by_last_name: 'Papadaki',
  record_label: 'Makris Gialos',
  record_kind: 'Morning survey',
  record_detail: {
    survey_date: '2026-10-20',
    beach: 'Makris Gialos',
    start_time: '06:10:00',
    end_time: '06:30:00',
    protected_nest_count: 0,
    linked_emergences: [],
    linked_tracks: [],
  },
  record_missing: false,
};

describe('ReviewQueue — correcting a morning survey\'s date (QA-129)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders survey_date as an editable date field, not fixed like beach', async () => {
    (DatabaseConnection.getMyReviews as any).mockResolvedValue([surveyReview]);

    render(<ReviewQueue user={volunteer} />);

    fireEvent.click(await screen.findByText(/Morning survey · Makris Gialos/));
    fireEvent.click(screen.getByText('Edit & send back for review'));

    const dateField = await screen.findByLabelText('Survey date');
    expect(dateField.tagName).toBe('INPUT');
    expect((dateField as HTMLInputElement).type).toBe('date');
    expect((dateField as HTMLInputElement).value).toBe('2026-10-20');
    // beach is still not offered as an editable field.
    expect(screen.queryByLabelText('Beach')).toBeNull();
  });

  it('sends the corrected survey_date through updateMorningSurvey', async () => {
    (DatabaseConnection.getMyReviews as any).mockResolvedValue([surveyReview]);
    (DatabaseConnection.updateMorningSurvey as any).mockResolvedValue({});
    (DatabaseConnection.resubmitReview as any).mockResolvedValue({ ...surveyReview, status: 'pending' });

    render(<ReviewQueue user={volunteer} />);

    fireEvent.click(await screen.findByText(/Morning survey · Makris Gialos/));
    fireEvent.click(screen.getByText('Edit & send back for review'));

    const dateField = await screen.findByLabelText('Survey date');
    fireEvent.change(dateField, { target: { value: '2026-10-15' } });

    fireEvent.click(screen.getByText('Save & send back for review'));

    await waitFor(() => expect(DatabaseConnection.resubmitReview).toHaveBeenCalled());
    expect(DatabaseConnection.updateMorningSurvey).toHaveBeenCalledWith(
      151,
      expect.objectContaining({ survey_date: '2026-10-15' })
    );
  });
});
