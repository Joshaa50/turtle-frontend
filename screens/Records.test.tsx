import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Records from './Records';
import { DatabaseConnection } from '../services/Database';

// Mock DatabaseConnection
vi.mock('../services/Database', () => ({
  DatabaseConnection: {
    getNests: vi.fn(),
    getTurtles: vi.fn(),
    getNest: vi.fn(),
    createNestEvent: vi.fn(),
    updateNest: vi.fn(),
  },
}));

describe('Records Component', () => {
  it('renders nest records', async () => {
    const mockNests = [
      { nest_code: 'N001', id: 1, beach: 'Beach A', date_found: '2023-01-01', species: 'Loggerhead', status: 'Incubating', is_archived: false }
    ];
    (DatabaseConnection.getNests as any).mockResolvedValue(mockNests);

    render(<Records type="nest" onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('N001')).toBeInTheDocument();
      expect(screen.getByText('Beach A')).toBeInTheDocument();
    });
  });

  it('renders turtle records', async () => {
    const mockTurtles = [
      { id: 1, front_left_tag: 'KF-1001', name: 'T001', species: 'Green', updated_at: '2023-01-01' }
    ];
    (DatabaseConnection.getTurtles as any).mockResolvedValue(mockTurtles);

    render(<Records type="turtle" onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('T001')).toBeInTheDocument();
      expect(screen.getByText(/KF-1001/)).toBeInTheDocument();
    });
  });

  it('filters records by search term', async () => {
    const mockNests = [
      { nest_code: 'N001', id: 1, beach: 'Beach A', date_found: '2023-01-01', species: 'Loggerhead', status: 'Incubating', is_archived: false },
      { nest_code: 'N002', id: 2, beach: 'Beach B', date_found: '2023-01-02', species: 'Loggerhead', status: 'Incubating', is_archived: false }
    ];
    (DatabaseConnection.getNests as any).mockResolvedValue(mockNests);

    render(<Records type="nest" onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('N001')).toBeInTheDocument();
      expect(screen.getByText('N002')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search Nest ID or Location...');
    fireEvent.change(searchInput, { target: { value: 'N001' } });

    expect(screen.getByText('N001')).toBeInTheDocument();
    expect(screen.queryByText('N002')).not.toBeInTheDocument();
  });

  it('opens hatchling modal and submits data', async () => {
    const mockNests = [
      { nest_code: 'N001', id: 1, beach: 'Beach A', date_found: '2023-01-01', species: 'Loggerhead', status: 'Incubating', is_archived: false }
    ];
    (DatabaseConnection.getNests as any).mockResolvedValue(mockNests);
    (DatabaseConnection.getNest as any).mockResolvedValue({ nest: { id: 1, status: 'incubating' } });
    (DatabaseConnection.createNestEvent as any).mockResolvedValue({});
    (DatabaseConnection.updateNest as any).mockResolvedValue({});
    window.alert = vi.fn();

    render(<Records type="nest" onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('N001')).toBeInTheDocument();
    });

    // Find the button to log hatchlings (child_care icon)
    // It's inside the row.
    const logBtn = screen.getByTitle('Log Emerging Hatchlings');
    fireEvent.click(logBtn);

    expect(screen.getByText('Log Hatchling Tracks: N001')).toBeInTheDocument();

    const toSeaInput = screen.getByPlaceholderText('Total tracks reaching water');
    fireEvent.change(toSeaInput, { target: { value: '50' } });

    const submitBtn = screen.getByText('Submit Records');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(DatabaseConnection.createNestEvent).toHaveBeenCalled();
      expect(DatabaseConnection.updateNest).toHaveBeenCalled();
    });
  });
});
