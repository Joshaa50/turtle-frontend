import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from '../components/Sidebar';
import { AppView, User } from '../types';

const mockUser: User = {
  id: '1',
  firstName: 'Test',
  lastName: 'User',
  role: 'Field Leader',
  avatar: 'test-avatar.jpg',
  email: 'test@example.com'
};

describe('Sidebar', () => {
  const defaultProps = {
    currentView: AppView.DASHBOARD,
    onNavigate: vi.fn(),
    user: mockUser,
    onLogout: vi.fn(),
    isOpen: true,
    onToggle: vi.fn(),
    theme: 'light' as const,
    onToggleTheme: vi.fn(),
  };

  it('renders correctly', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Turtle Guard')).toBeDefined();
    expect(screen.getByText('Dashboard')).toBeDefined();
  });

  it('calls onNavigate when a menu item is clicked', () => {
    render(<Sidebar {...defaultProps} />);
    const dashboardButton = screen.getByText('Dashboard');
    fireEvent.click(dashboardButton);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith(AppView.DASHBOARD);
  });
});
