// QA-093: a sent-back morning survey's edit/resubmit form only exposed the
// survey's own top-level fields, with no way to correct the false crawl or
// hatchling track records linked to it. This pins down that editing a
// rejected morning survey also renders inputs for each linked emergence
// (false crawl) and nest_event (hatchling track), and that saving sends each
// child's correction through its own update route before the survey itself
// is resubmitted.
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
  id: 1,
  record_type: 'morning_survey',
  record_id: 10,
  status: 'rejected',
  submitted_by: 51,
  submitted_at: '2026-10-06T03:12:00.000Z',
  reviewed_by: 7,
  reviewed_at: '2026-10-06T06:00:00.000Z',
  review_note: 'Fix the false crawl beach and the hatchling track counts.',
  submitted_by_first_name: 'Maria',
  submitted_by_last_name: 'Karydi',
  reviewed_by_first_name: 'Nikos',
  reviewed_by_last_name: 'Floros',
  record_label: 'Loggos 2',
  record_kind: 'Morning survey',
  record_detail: {
    survey_date: '2026-10-06',
    beach: 'Loggos 2',
    start_time: '06:00:00',
    end_time: '07:00:00',
    protected_nest_count: 2,
    linked_emergences: [
      { id: 21, emergence_type: 'False crawl', event_date: '2026-10-06', beach: 'Loggos 2', distance_to_sea_s: 5 },
    ],
    linked_tracks: [
      { id: 31, event_type: 'EMERGENCE', nest_code: 'LG2-9', total_eggs: 90, tracks_to_sea: 40 },
    ],
  },
  record_missing: false,
};

describe('ReviewQueue — correcting a morning survey\'s linked records (QA-093)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders editable fields for the linked false crawl and hatchling track', async () => {
    (DatabaseConnection.getMyReviews as any).mockResolvedValue([surveyReview]);

    render(<ReviewQueue user={volunteer} />);

    fireEvent.click(await screen.findByText(/Morning survey · Loggos 2/));
    fireEvent.click(screen.getByText('Edit & send back for review'));

    expect(await screen.findByText(/False crawl 1/)).toBeInTheDocument();
    expect(screen.getByText(/Hatchling track 1/)).toBeInTheDocument();
    expect(screen.getByLabelText('Distance to sea')).toBeInTheDocument();
    expect(screen.getByLabelText('Total eggs')).toBeInTheDocument();
  });

  it('saves the linked emergence and nest_event corrections before resubmitting the survey', async () => {
    (DatabaseConnection.getMyReviews as any).mockResolvedValue([surveyReview]);
    (DatabaseConnection.updateEmergence as any).mockResolvedValue({});
    (DatabaseConnection.updateNestEvent as any).mockResolvedValue({});
    (DatabaseConnection.updateMorningSurvey as any).mockResolvedValue({});
    (DatabaseConnection.resubmitReview as any).mockResolvedValue({ ...surveyReview, status: 'pending' });

    render(<ReviewQueue user={volunteer} />);

    fireEvent.click(await screen.findByText(/Morning survey · Loggos 2/));
    fireEvent.click(screen.getByText('Edit & send back for review'));

    const distanceInput = await screen.findByLabelText('Distance to sea');
    fireEvent.change(distanceInput, { target: { value: '8' } });
    const totalEggsInput = screen.getByLabelText('Total eggs');
    fireEvent.change(totalEggsInput, { target: { value: '95' } });

    fireEvent.click(screen.getByText('Save & send back for review'));

    await waitFor(() => expect(DatabaseConnection.resubmitReview).toHaveBeenCalled());

    expect(DatabaseConnection.updateEmergence).toHaveBeenCalledWith(21, expect.objectContaining({ distance_to_sea_s: 8 }));
    expect(DatabaseConnection.updateNestEvent).toHaveBeenCalledWith(31, expect.objectContaining({ total_eggs: 95 }));

    // Children are corrected through their own routes before the survey
    // itself is saved and the review resubmitted.
    const emergenceOrder = (DatabaseConnection.updateEmergence as any).mock.invocationCallOrder[0];
    const nestEventOrder = (DatabaseConnection.updateNestEvent as any).mock.invocationCallOrder[0];
    const surveyOrder = (DatabaseConnection.updateMorningSurvey as any).mock.invocationCallOrder[0];
    const resubmitOrder = (DatabaseConnection.resubmitReview as any).mock.invocationCallOrder[0];
    expect(emergenceOrder).toBeLessThan(surveyOrder);
    expect(nestEventOrder).toBeLessThan(surveyOrder);
    expect(surveyOrder).toBeLessThan(resubmitOrder);
  });
});
