import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NestEntry from './NestEntry';
import { DatabaseConnection } from '../services/Database';

// Mock DatabaseConnection
vi.mock('../services/Database', () => ({
  DatabaseConnection: {
    getNests: vi.fn(),
    createNest: vi.fn(),
  },
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('NestEntry Component', () => {
  it('renders nest entry form', () => {
    (DatabaseConnection.getNests as any).mockResolvedValue([]);
    render(<NestEntry onBack={vi.fn()} />);

    expect(screen.getByText('New Nest Entry')).toBeInTheDocument();
    expect(screen.getByText('Primary Information')).toBeInTheDocument();
    expect(screen.getByText('Original Nest Metrics')).toBeInTheDocument();
    expect(screen.getByText('Triangulation Points')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    (DatabaseConnection.getNests as any).mockResolvedValue([]);
    render(<NestEntry onBack={vi.fn()} />);

    // Try to save without filling anything
    const saveBtn = screen.getByRole('button', { name: 'SAVE' });
    expect(saveBtn).toBeDisabled();

    // Check for error message display (Review Field)
    // Initially it might show "Depth (h) Required" or similar because some fields are pre-filled (like date, beach)
    // The component calculates errorInfo on render.
    // Let's check if we can see the error button text.
    // The error message is dynamic.
    
    // Fill required fields to enable save
    
    // 1. Metrics
    const hInput = screen.getByLabelText(/h \(Depth top\)/i);
    fireEvent.change(hInput, { target: { value: '30' } });

    // 2. Coords
    const latInputs = screen.getAllByPlaceholderText('037.44670');
    const lngInputs = screen.getAllByPlaceholderText('021.61630');
    
    // Original coords are the first ones
    fireEvent.change(latInputs[0], { target: { value: '37.50000' } });
    fireEvent.change(lngInputs[0], { target: { value: '21.50000' } });

    // 3. Triangulation
    const descInputs = screen.getAllByPlaceholderText('e.g. Blue Stake #4 or Landmark tree');
    const distInputs = screen.getAllByPlaceholderText('0.00');
    // Triangulation coords are the subsequent ones in latInputs/lngInputs
    
    // Point 1
    fireEvent.change(descInputs[0], { target: { value: 'Tree' } });
    fireEvent.change(distInputs[0], { target: { value: '5.5' } });
    fireEvent.change(latInputs[1], { target: { value: '37.50001' } });
    fireEvent.change(lngInputs[1], { target: { value: '21.50001' } });

    // Point 2
    fireEvent.change(descInputs[1], { target: { value: 'Rock' } });
    fireEvent.change(distInputs[1], { target: { value: '3.2' } });
    fireEvent.change(latInputs[2], { target: { value: '37.50002' } });
    fireEvent.change(lngInputs[2], { target: { value: '21.50002' } });

    // Now save should be enabled
    await waitFor(() => {
      expect(saveBtn).not.toBeDisabled();
    });
  });

  it('handles form submission', async () => {
    const onBack = vi.fn();
    (DatabaseConnection.getNests as any).mockResolvedValue([]);
    (DatabaseConnection.createNest as any).mockResolvedValue({});
    
    render(<NestEntry onBack={onBack} />);

    // Fill form
    fireEvent.change(screen.getByLabelText(/h \(Depth top\)/i), { target: { value: '30' } });
    
    const latInputs = screen.getAllByPlaceholderText('037.44670');
    const lngInputs = screen.getAllByPlaceholderText('021.61630');
    fireEvent.change(latInputs[0], { target: { value: '37.50000' } });
    fireEvent.change(lngInputs[0], { target: { value: '21.50000' } });

    const descInputs = screen.getAllByPlaceholderText('e.g. Blue Stake #4 or Landmark tree');
    const distInputs = screen.getAllByPlaceholderText('0.00');
    
    fireEvent.change(descInputs[0], { target: { value: 'Tree' } });
    fireEvent.change(distInputs[0], { target: { value: '5.5' } });
    fireEvent.change(latInputs[1], { target: { value: '37.50001' } });
    fireEvent.change(lngInputs[1], { target: { value: '21.50001' } });

    fireEvent.change(descInputs[1], { target: { value: 'Rock' } });
    fireEvent.change(distInputs[1], { target: { value: '3.2' } });
    fireEvent.change(latInputs[2], { target: { value: '37.50002' } });
    fireEvent.change(lngInputs[2], { target: { value: '21.50002' } });

    // Mock alert
    window.alert = vi.fn();

    const saveBtn = screen.getByRole('button', { name: 'SAVE' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(DatabaseConnection.createNest).toHaveBeenCalled();
      expect(onBack).toHaveBeenCalled();
    });
  });
});
