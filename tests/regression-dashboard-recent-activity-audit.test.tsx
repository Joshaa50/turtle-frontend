// Regression (QA-147): the Dashboard's Recent Activity feed only drew on
// nests, emergences, turtles and reviews, so nest inventories/hatching
// events and turtle re-sightings - often the day's biggest news - never
// appeared. getRecentActivityAudit() surfaces GET /audit/recent's rows,
// each already carrying its own human-readable summary.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import Dashboard from '../screens/Dashboard';

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getNests: vi.fn().mockResolvedValue([]),
      getTurtles: vi.fn().mockResolvedValue([]),
      getEmergences: vi.fn().mockResolvedValue([]),
      getReviews: vi.fn().mockResolvedValue([]),
      getSettings: vi.fn().mockResolvedValue(actual.DatabaseConnection.defaultSettings()),
      getWeeklyTimetable: vi.fn().mockResolvedValue([]),
      getRecentActivityAudit: vi.fn().mockResolvedValue([
        {
          record_type: 'turtle_survey_event',
          record_id: 7,
          action: 'created',
          summary: 'Re-sighted turtle TG-4021 at Loggos 2',
          occurred_at: new Date().toISOString(),
        },
      ]),
    },
  };
});

const baseProps = {
  onNavigate: vi.fn(),
  theme: 'dark' as const,
  isSidebarOpen: false,
  onToggleSidebar: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('Dashboard Recent Activity feed includes audit-sourced events (QA-147)', () => {
  it('shows a turtle re-sighting using its own audit summary', async () => {
    render(<Dashboard {...baseProps} user={{ id: '1', firstName: 'A', lastName: 'B', role: 'Field Leader', avatar: '', email: 'a@b.com' } as any} />);

    const entry = await waitFor(() => screen.getByText('Re-sighted turtle TG-4021 at Loggos 2'));
    expect(entry).toBeInTheDocument();
  });
});
