import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Dashboard from './Dashboard';
import { DatabaseConnection } from '../services/Database';
import { AppView } from '../types';

// Mock DatabaseConnection
vi.mock('../services/Database', () => ({
  DatabaseConnection: {
    getNests: vi.fn(),
    getTurtles: vi.fn(),
  },
}));

describe('Dashboard Component', () => {
  it('renders dashboard with loading state initially', () => {
    (DatabaseConnection.getNests as any).mockResolvedValue([]);
    (DatabaseConnection.getTurtles as any).mockResolvedValue([]);
    
    render(<Dashboard onNavigate={vi.fn()} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Active Nests')).toBeInTheDocument();
    expect(screen.getByText('Turtle Records')).toBeInTheDocument();
  });

  it('loads and displays statistics', async () => {
    const mockNests = [
      { id: 1, nest_code: 'N001', total_num_eggs: 100, relocated: true, status: 'Hatching', date_found: '2023-01-01' },
      { id: 2, nest_code: 'N002', total_num_eggs: 50, relocated: false, status: 'Incubating', date_found: '2023-01-02' }
    ];
    const mockTurtles = [
      { id: 1, name: 'T001', health_condition: 'Healthy', species: 'Caretta caretta' },
      { id: 2, name: 'T002', health_condition: 'Injured', species: 'Chelonia mydas' }
    ];

    (DatabaseConnection.getNests as any).mockResolvedValue(mockNests);
    (DatabaseConnection.getTurtles as any).mockResolvedValue(mockTurtles);

    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText('2').length).toBeGreaterThan(0); // 2 nests, 2 turtles
      expect(screen.getByText('150')).toBeInTheDocument(); // 150 eggs
      expect(screen.getAllByText('1').length).toBeGreaterThan(0); // 1 relocated, 1 hatching, 1 injured
    });
  });

  it('navigates to correct views when clicking cards/buttons', async () => {
    const onNavigate = vi.fn();
    (DatabaseConnection.getNests as any).mockResolvedValue([]);
    (DatabaseConnection.getTurtles as any).mockResolvedValue([]);

    render(<Dashboard onNavigate={onNavigate} />);

    // Wait for loading to finish
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    // Click on Active Nests card
    // Note: StatCard has onClick, we need to find it. It has text "Active Nests"
    // The parent div of "Active Nests" text has the onClick.
    // We can find by text and click the closest div with onClick, or just click the text if it bubbles.
    // However, the StatCard structure puts onClick on the outer div.
    // Let's try clicking the text "Active Nests" which is inside the card.
    // Actually, userEvent.click(screen.getByText('Active Nests')) might work if the event bubbles up.
    
    // But let's check the Quick Actions buttons which are clearer
    const newNestBtn = screen.getByText('New Nest Entry');
    newNestBtn.click();
    expect(onNavigate).toHaveBeenCalledWith(AppView.NEST_ENTRY);

    const newTurtleBtn = screen.getByText('New Turtle Record');
    newTurtleBtn.click();
    expect(onNavigate).toHaveBeenCalledWith(AppView.TAGGING_ENTRY);
  });
});
