// QA-133: GET /turtles/:id and GET /turtles/:id/survey_events now return
// microchip_number/microchip_location (backend fix), but TurtleDetails.tsx
// read turtleMeta.tags?.microchip?.number - a shape its own mapping code
// never populated from those flat fields, so the chip still showed
// "NO CHIP DETECTED" even once the backend saved it correctly.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TurtleDetails from '../screens/TurtleDetails';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

const leader: User = {
  id: '1', firstName: 'Lena', lastName: 'Leader', role: 'Field Leader',
  avatar: '', email: 'lena.leader@turtleguard.demo',
};

const props = {
  id: '61',
  onBack: vi.fn(),
  isSidebarOpen: false,
  onToggleSidebar: vi.fn(),
  user: leader,
};

describe('Turtle Details shows the recorded microchip number (QA-133)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(DatabaseConnection, 'getTurtle').mockResolvedValue({
      turtle: {
        id: 61,
        name: 'Eirini',
        species: 'Caretta caretta',
        health_condition: 'Healthy',
        sex: 'Female',
        microchip_number: '985141002387761',
        microchip_location: 'Left front flipper, proximal',
      },
    } as any);
    vi.spyOn(DatabaseConnection, 'getTurtleSurveyEvents').mockResolvedValue({ events: [] } as any);
    vi.spyOn(DatabaseConnection, 'getNests').mockResolvedValue([] as any);
  });

  it('renders the microchip number instead of NO CHIP DETECTED', async () => {
    render(<TurtleDetails {...props} />);

    expect(await screen.findByText('985141002387761')).toBeInTheDocument();
    expect(screen.queryByText('NO CHIP DETECTED')).not.toBeInTheDocument();
  });

  it('still shows NO CHIP DETECTED when no microchip was recorded', async () => {
    (DatabaseConnection.getTurtle as any).mockResolvedValue({
      turtle: { id: 62, name: 'Nikos', species: 'Caretta caretta', health_condition: 'Healthy', sex: 'Male' },
    });

    render(<TurtleDetails {...props} id="62" />);

    await waitFor(() => expect(DatabaseConnection.getTurtle).toHaveBeenCalled());
    expect(await screen.findByText('NO CHIP DETECTED')).toBeInTheDocument();
  });
});
