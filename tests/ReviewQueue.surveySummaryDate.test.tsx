// QA-149: recordSummary (the collapsed card's one-line summary) checked
// detail.event_date and detail.date_found but never detail.survey_date, so a
// pending morning_survey review's card showed only "Morning survey ·
// <beach>" with no date - a reviewer triaging several pending surveys from
// different mornings couldn't tell which day each one covered without
// expanding the card.
import React from 'react';
import { render, screen } from '@testing-library/react';
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

const pendingSurveyReview: RecordReview = {
  id: 201,
  record_type: 'morning_survey',
  record_id: 161,
  status: 'pending',
  submitted_by: 51,
  submitted_at: '2026-10-20T03:05:00.000Z',
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  submitted_by_first_name: 'Maria',
  submitted_by_last_name: 'Karydi',
  reviewed_by_first_name: null,
  reviewed_by_last_name: null,
  record_label: 'Vrakhinari',
  record_kind: 'Morning survey',
  record_detail: {
    survey_date: '2026-10-20',
    beach: 'Vrakhinari',
    start_time: '06:10:00',
    end_time: '06:30:00',
    protected_nest_count: 0,
    linked_emergences: [],
    linked_tracks: [],
  },
  record_missing: false,
};

describe('ReviewQueue — morning survey card summary shows survey_date (QA-149)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the survey date in the collapsed card without expanding it', async () => {
    (DatabaseConnection.getMyReviews as any).mockResolvedValue([pendingSurveyReview]);

    render(<ReviewQueue user={volunteer} />);

    expect(await screen.findByText(/Morning survey · Vrakhinari · 20\/10\/2026/)).toBeTruthy();
  });
});
