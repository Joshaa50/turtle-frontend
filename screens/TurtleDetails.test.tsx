import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TurtleDetails from './TurtleDetails';
import { DatabaseConnection } from '../services/Database';

// Mock DatabaseConnection
vi.mock('../services/Database', () => ({
  DatabaseConnection: {
    getTurtle: vi.fn(),
    getTurtleSurveyEvents: vi.fn(),
  },
}));

describe('TurtleDetails Component', () => {
  it('renders turtle details', async () => {
    const mockTurtle = {
      id: 1,
      name: 'T001',
      species: 'Caretta caretta',
      health_condition: 'Healthy',
      sex: 'Female',
      scl_max: 80,
      front_left_tag: 'KF-1001'
    };
    const mockEvents = [
      { 
        id: 1, 
        event_date: '2023-01-01', 
        event_type: 'TAGGING', 
        location: 'Beach A', 
        observer: 'John Doe',
        front_left_tag: 'KF-1001'
      }
    ];

    (DatabaseConnection.getTurtle as any).mockResolvedValue({ turtle: mockTurtle });
    (DatabaseConnection.getTurtleSurveyEvents as any).mockResolvedValue({ events: mockEvents });

    render(<TurtleDetails id="1" onBack={vi.fn()} onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('T001')).toBeInTheDocument();
      expect(screen.getByText('Loggerhead')).toBeInTheDocument(); // Mapped from Caretta caretta
      expect(screen.getByText('Healthy')).toBeInTheDocument();
      expect(screen.getByText('Female')).toBeInTheDocument();
      expect(screen.getByText('80')).toBeInTheDocument(); // SCL Max
    });
  });

  it('displays tag inventory', async () => {
    const mockTurtle = { id: 1, front_left_tag: 'KF-1001' };
    const mockEvents = [
      { id: 1, event_date: '2023-01-01', front_left_tag: 'KF-1001' },
      { id: 2, event_date: '2022-01-01', front_left_tag: 'KF-0999' } // Old tag
    ];

    (DatabaseConnection.getTurtle as any).mockResolvedValue({ turtle: mockTurtle });
    (DatabaseConnection.getTurtleSurveyEvents as any).mockResolvedValue({ events: mockEvents });

    render(<TurtleDetails id="1" onBack={vi.fn()} onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText('KF-1001').length).toBeGreaterThan(0);
      expect(screen.getByText('KF-0999')).toBeInTheDocument();
    });
  });

  it('opens event details modal', async () => {
    const mockTurtle = { id: 1 };
    const mockEvents = [
      { 
        id: 1, 
        event_date: '2023-01-01', 
        event_type: 'TAGGING', 
        location: 'Beach A', 
        observer: 'John Doe',
        notes: 'Found nesting'
      }
    ];

    (DatabaseConnection.getTurtle as any).mockResolvedValue({ turtle: mockTurtle });
    (DatabaseConnection.getTurtleSurveyEvents as any).mockResolvedValue({ events: mockEvents });

    render(<TurtleDetails id="1" onBack={vi.fn()} onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('TAGGING')).toBeInTheDocument();
    });

    // Click on the event row
    const eventRow = screen.getByText('TAGGING').closest('tr');
    fireEvent.click(eventRow!);

    await waitFor(() => {
      expect(screen.getByText('TAGGING RECORD')).toBeInTheDocument();
      expect(screen.getAllByText('"Found nesting"').length).toBeGreaterThan(0);
    });
  });
});
