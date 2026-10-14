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

  // QA-048: a Field Leader used to get a "User Management" nav entry that led
  // straight to UserManagement's own "Only a project coordinator can manage
  // user accounts." refusal - a dead end, since that screen's access check
  // is Coordinator-only.
  it('does not offer User Management to a Field Leader', () => {
    render(<Sidebar {...defaultProps} user={mockUser} />);
    expect(screen.queryByText('User Management')).toBeNull();
  });

  it('offers User Management to a Project Coordinator', () => {
    render(<Sidebar {...defaultProps} user={{ ...mockUser, role: 'Project Coordinator' }} />);
    expect(screen.getByText('User Management')).toBeInTheDocument();
  });
});
