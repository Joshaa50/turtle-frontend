import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TaggingEntry from './TaggingEntry';
import { DatabaseConnection } from '../services/Database';

// Mock DatabaseConnection
vi.mock('../services/Database', () => ({
  DatabaseConnection: {
    getTurtles: vi.fn(),
    createTurtle: vi.fn(),
    createTurtleEvent: vi.fn(),
    updateTurtle: vi.fn(),
  },
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.scrollTo = vi.fn();

describe('TaggingEntry Component', () => {
  it('renders tagging entry form', () => {
    (DatabaseConnection.getTurtles as any).mockResolvedValue([]);
    render(<TaggingEntry onBack={vi.fn()} />);

    expect(screen.getByText('Tagging Event')).toBeInTheDocument();
    expect(screen.getByText('Existing Turtle')).toBeInTheDocument();
    expect(screen.getByText('New Turtle')).toBeInTheDocument();
  });

  it('switches between existing and new turtle modes', () => {
    (DatabaseConnection.getTurtles as any).mockResolvedValue([]);
    render(<TaggingEntry onBack={vi.fn()} />);

    // Default is Existing
    expect(screen.getByText('Search Turtle')).toBeInTheDocument();

    // Switch to New
    fireEvent.click(screen.getByText('New Turtle'));
    expect(screen.getByText('Turtle Identity')).toBeInTheDocument();
    expect(screen.getByText('Species')).toBeInTheDocument();
    expect(screen.getByText('Sex')).toBeInTheDocument();
  });

  it('validates required fields for new turtle', async () => {
    (DatabaseConnection.getTurtles as any).mockResolvedValue([]);
    render(<TaggingEntry onBack={vi.fn()} />);

    fireEvent.click(screen.getByText('New Turtle'));

    // Try to save without filling required fields
    fireEvent.click(screen.getByText('SAVE'));

    expect(screen.getByText('Please fill in Location and Observer.')).toBeInTheDocument();

    // Fill Location and Observer
    fireEvent.change(screen.getByPlaceholderText('Enter observer name'), { target: { value: 'John Doe' } });
    
    // Try save again
    fireEvent.click(screen.getByText('SAVE'));
    // Should pass location/observer check, now check species/sex (though they have defaults, so might pass or need explicit check depending on implementation)
    // In implementation: if (entryMode === 'NEW' && (!formData.species || !formData.sex))
    // Defaults are Loggerhead and Unknown. So it might pass or fail if Unknown is considered invalid?
    // Implementation: sex default is 'Unknown'.
    // Let's check if it complains about something else or succeeds.
    
    // Actually, let's fill everything to be sure.
    const speciesSelect = screen.getByDisplayValue('Loggerhead');
    fireEvent.change(speciesSelect, { target: { value: 'Green' } });
    
    const sexSelect = screen.getByDisplayValue('Unknown');
    fireEvent.change(sexSelect, { target: { value: 'Female' } });

    // Mock createTurtle response
    (DatabaseConnection.createTurtle as any).mockResolvedValue({ id: 123 });
    (DatabaseConnection.createTurtleEvent as any).mockResolvedValue({});
    window.alert = vi.fn();

    fireEvent.click(screen.getByText('SAVE'));

    await waitFor(() => {
      expect(DatabaseConnection.createTurtle).toHaveBeenCalled();
      expect(DatabaseConnection.createTurtleEvent).toHaveBeenCalled();
    });
  });

  it('searches and selects existing turtle', async () => {
    const mockTurtles = [
      { id: 1, name: 'T001', species: 'Caretta caretta', front_left_tag: 'KF-1001' }
    ];
    (DatabaseConnection.getTurtles as any).mockResolvedValue(mockTurtles);

    render(<TaggingEntry onBack={vi.fn()} />);

    // Wait for turtles to load
    await waitFor(() => expect(DatabaseConnection.getTurtles).toHaveBeenCalled());

    const searchInput = screen.getByPlaceholderText('Name, Tag or ID...');
    fireEvent.change(searchInput, { target: { value: 'T001' } });
    fireEvent.focus(searchInput);

    await waitFor(() => {
      expect(screen.getByText('T001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('T001'));

    expect(screen.getByText('ID: 1')).toBeInTheDocument();
  });
});
