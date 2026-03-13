import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TimePicker } from '../components/TimePicker';

describe('TimePicker', () => {
  it('renders correctly with initial value', () => {
    render(<TimePicker value="10:30" onChange={vi.fn()} />);
    expect(screen.getByText('10:30')).toBeDefined();
  });

  it('opens and closes when clicked', () => {
    render(<TimePicker value="10:30" onChange={vi.fn()} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByText('Hr')).toBeDefined();
    expect(screen.getByText('Min')).toBeDefined();
    
    // Click outside or toggle again to close
    fireEvent.click(button);
    expect(screen.queryByText('Hr')).toBeNull();
  });

  it('calls onChange when time is selected', () => {
    const onChange = vi.fn();
    render(<TimePicker value="10:30" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    
    // Select hour 12
    const hourButtons = screen.getAllByText('12');
    fireEvent.click(hourButtons[0]);
    
    expect(onChange).toHaveBeenCalledWith('12:30');
  });
});
