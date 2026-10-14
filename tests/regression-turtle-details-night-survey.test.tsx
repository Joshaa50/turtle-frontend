// Regression (QA-097): a night-survey event's timings and health condition
// were recorded by the backend (confirmed via GET /turtles/:id/survey_events
// returning time_first_seen etc.) but the frontend mapping dropped them, and
// the Event Details Modal only ever rendered the TAGGING-shaped
// Morphometric Data / Identification sections - so clicking a NIGHT_SURVEY
// row opened a modal with nothing relevant in it. This pins that the modal
// now shows the night survey's timeline and health condition instead.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import TurtleDetails from '../screens/TurtleDetails';

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getTurtle: vi.fn().mockResolvedValue({
        turtle: {
          id: 47, name: 'Thalia', species: 'Loggerhead', health_condition: 'Healthy', sex: 'Female',
        },
      }),
      getTurtleSurveyEvents: vi.fn().mockResolvedValue({
        events: [
          {
            id: 74,
            event_type: 'NIGHT_SURVEY',
            event_date: '2026-10-11',
            location: 'Kalamaki',
            observer: 'Elena Papadaki',
            notes: 'Calm sea, full moon.',
            health_condition: 'Healthy',
            time_first_seen: '23:10:00',
            time_start_egg_laying: '23:25:00',
            time_covering: '23:40:00',
            time_end_camouflage: '23:48:00',
            time_reach_sea: '23:52:00',
          },
        ],
      }),
      getNests: vi.fn().mockResolvedValue([]),
      getSettings: vi.fn().mockResolvedValue(actual.DatabaseConnection.defaultSettings()),
      defaultSettings: actual.DatabaseConnection.defaultSettings,
    },
  };
});

describe('Turtle Details — night survey event details (QA-097)', () => {
  it('shows the night survey timeline and health condition when the row is clicked', async () => {
    render(
      <TurtleDetails
        id="47"
        onBack={vi.fn()}
        isSidebarOpen={false}
        onToggleSidebar={vi.fn()}
        user={null}
      />
    );

    const row = await screen.findByText('NIGHT SURVEY');
    fireEvent.click(row.closest('tr')!);

    await waitFor(() => expect(screen.getByText('Night Survey Timeline')).toBeInTheDocument());

    expect(screen.getByText('23:10')).toBeInTheDocument(); // First Seen
    expect(screen.getByText('23:25')).toBeInTheDocument(); // Started Laying
    expect(screen.getByText('23:40')).toBeInTheDocument(); // Covering
    expect(screen.getByText('23:48')).toBeInTheDocument(); // End Camouflage
    expect(screen.getByText('23:52')).toBeInTheDocument(); // Reached Sea
    expect(screen.getByText('Health Condition')).toBeInTheDocument();
    expect(screen.getAllByText('Healthy').length).toBeGreaterThan(0);

    // The TAGGING-only sections must not appear for a night survey.
    expect(screen.queryByText('Morphometric Data')).toBeNull();
    expect(screen.queryByText('Identification')).toBeNull();
  });

  it('still shows Morphometric Data and Identification for a TAGGING event', async () => {
    const { DatabaseConnection } = await import('../services/Database');
    (DatabaseConnection.getTurtleSurveyEvents as any).mockResolvedValueOnce({
      events: [
        {
          id: 75,
          event_type: 'TAGGING',
          event_date: '2026-10-11',
          location: 'Kalamaki',
          observer: 'Elena Papadaki',
          scl_max: 92.5,
        },
      ],
    });

    render(
      <TurtleDetails
        id="47"
        onBack={vi.fn()}
        isSidebarOpen={false}
        onToggleSidebar={vi.fn()}
        user={null}
      />
    );

    const row = await screen.findByText('TAGGING');
    fireEvent.click(row.closest('tr')!);

    await waitFor(() => expect(screen.getByText('Morphometric Data')).toBeInTheDocument());
    expect(screen.getByText('Identification')).toBeInTheDocument();
    expect(screen.queryByText('Night Survey Timeline')).toBeNull();
  });
});
