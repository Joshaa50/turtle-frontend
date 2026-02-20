import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NestDetails from './NestDetails';
import { DatabaseConnection } from '../services/Database';

// Mock DatabaseConnection
vi.mock('../services/Database', () => ({
  DatabaseConnection: {
    getNest: vi.fn(),
    getNestEvents: vi.fn(),
  },
}));

describe('NestDetails Component', () => {
  it('renders nest details', async () => {
    const mockNest = {
      id: 1,
      nest_code: 'N001',
      beach: 'Beach A',
      date_found: '2023-01-01',
      status: 'Incubating',
      relocated: false,
      depth_top_egg_h: 30,
      depth_bottom_chamber_h: 50,
      width_w: 20,
      distance_to_sea_s: 10,
      gps_lat: 37.5,
      gps_long: 21.5,
      total_num_eggs: 100
    };
    const mockEvents = [
      { id: 1, event_type: 'DISCOVERY', start_time: '2023-01-01' }
    ];

    (DatabaseConnection.getNest as any).mockResolvedValue({ nest: mockNest });
    (DatabaseConnection.getNestEvents as any).mockResolvedValue(mockEvents);

    render(<NestDetails id="N001" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('N001')).toBeInTheDocument();
      expect(screen.getByText('Incubating')).toBeInTheDocument();
      expect(screen.getByText('30cm')).toBeInTheDocument(); // Depth h
      expect(screen.getByText('50cm')).toBeInTheDocument(); // Depth H
    });
  });

  it('displays relocated site data if relocated', async () => {
    const mockNest = {
      id: 1,
      nest_code: 'N001R',
      beach: 'Beach A',
      date_found: '2023-01-01',
      status: 'Incubating',
      relocated: true,
      notes: 'Moved due to tide',
      depth_top_egg_h: 35, // New depth
      gps_lat: 37.6,
      gps_long: 21.6
    };
    const mockEvents = [
      { 
        id: 1, 
        event_type: 'DISCOVERY', 
        start_time: '2023-01-01',
        original_gps_lat: 37.5,
        original_gps_long: 21.5,
        original_depth_top_egg_h: 30
      }
    ];

    (DatabaseConnection.getNest as any).mockResolvedValue({ nest: mockNest });
    (DatabaseConnection.getNestEvents as any).mockResolvedValue(mockEvents);

    render(<NestDetails id="N001R" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Relocated Site Data')).toBeInTheDocument();
      expect(screen.getByText('35cm')).toBeInTheDocument(); // New depth
      expect(screen.getByText('30cm')).toBeInTheDocument(); // Original depth
      expect(screen.getByText('"Relocated: Moved due to tide"')).toBeInTheDocument();
    });
  });

  it('displays timeline events', async () => {
    const mockNest = {
      id: 1,
      nest_code: 'N001',
      date_found: '2023-01-01',
      status: 'Hatching'
    };
    const mockEvents = [
      { id: 2, event_type: 'EMERGENCE', start_time: '2023-02-01', tracks_to_sea: 50 }
    ];

    (DatabaseConnection.getNest as any).mockResolvedValue({ nest: mockNest });
    (DatabaseConnection.getNestEvents as any).mockResolvedValue(mockEvents);

    render(<NestDetails id="N001" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('EMERGENCE')).toBeInTheDocument();
      expect(screen.getByText('50 hatchlings emerged to sea.')).toBeInTheDocument();
    });
  });
});
