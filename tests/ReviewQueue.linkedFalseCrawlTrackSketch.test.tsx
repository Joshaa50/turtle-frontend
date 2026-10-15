// QA-112 (run 4): a reviewer could ask for a track sketch on a false crawl
// linked to a morning survey, but the correction form for that false crawl
// (inside a sent-back survey) had no sketch control at all - only a
// standalone emergence review's own correction form did. This pins that the
// linked false crawl's edit section now has the same TrackSketchUpload, and
// that a chosen sketch is sent through its own update route (not the
// survey's) before the survey is resubmitted.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReviewQueue from '../screens/ReviewQueue';
import { DatabaseConnection } from '../services/Database';
import { RecordReview, User } from '../types';

vi.mock('../lib/downscaleImage', () => ({
  downscaleImage: vi.fn().mockResolvedValue({ mimeType: 'image/png', base64: 'ZmFrZQ==' }),
}));

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

const fieldLeader: User = {
  id: 7, firstName: 'Elena', lastName: 'Papadaki', role: 'Field Leader', avatar: '', email: 'elena@example.com',
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
  review_note: 'Please add a track sketch, or a note on where she turned.',
  submitted_by_first_name: 'Maria',
  submitted_by_last_name: 'Karydi',
  reviewed_by_first_name: 'Elena',
  reviewed_by_last_name: 'Papadaki',
  record_label: 'Kounopetra',
  record_kind: 'Morning survey',
  record_detail: {
    survey_date: '2026-10-15',
    beach: 'Kounopetra',
    start_time: '06:00:00',
    end_time: '07:00:00',
    protected_nest_count: 0,
    linked_emergences: [
      { id: 175, emergence_type: 'False crawl', event_date: '2026-10-15', beach: 'Kounopetra', distance_to_sea_s: 5, has_track_sketch: false },
    ],
    linked_tracks: [],
  },
  record_missing: false,
};

describe("ReviewQueue — track sketch on a linked false crawl (QA-112, run 4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a track sketch control for the linked false crawl, as a submitter', async () => {
    (DatabaseConnection.getMyReviews as any).mockResolvedValue([surveyReview]);

    render(<ReviewQueue user={{ ...fieldLeader, id: 51, role: 'Field Volunteer' }} />);

    fireEvent.click(await screen.findByText(/Morning survey · Kounopetra/));
    fireEvent.click(screen.getByText('Edit & send back for review'));

    expect(await screen.findByText(/False crawl 1/)).toBeInTheDocument();
    expect(screen.getByText('Track sketch')).toBeInTheDocument();
  });

  it('sends a chosen sketch through updateEmergence (not updateMorningSurvey) before resubmitting', async () => {
    (DatabaseConnection.getMyReviews as any).mockResolvedValue([surveyReview]);
    (DatabaseConnection.updateEmergence as any).mockResolvedValue({});
    (DatabaseConnection.updateMorningSurvey as any).mockResolvedValue({});
    (DatabaseConnection.resubmitReview as any).mockResolvedValue({ ...surveyReview, status: 'pending' });

    render(<ReviewQueue user={{ ...fieldLeader, id: 51, role: 'Field Volunteer' }} />);

    fireEvent.click(await screen.findByText(/Morning survey · Kounopetra/));
    fireEvent.click(screen.getByText('Edit & send back for review'));

    const fileInput = (await screen.findByText('Track sketch')).parentElement!.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake'], 'sketch.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await screen.findByAltText('New track sketch');

    fireEvent.click(screen.getByText('Save & send back for review'));

    await waitFor(() => expect(DatabaseConnection.resubmitReview).toHaveBeenCalled());

    expect(DatabaseConnection.updateEmergence).toHaveBeenCalledWith(
      175,
      expect.objectContaining({ has_track_sketch: true, track_sketch: expect.stringContaining('data:image/png;base64,') })
    );
    const [, surveyPayload] = (DatabaseConnection.updateMorningSurvey as any).mock.calls[0] || [];
    expect(surveyPayload?.track_sketch).toBeUndefined();
  });
});
