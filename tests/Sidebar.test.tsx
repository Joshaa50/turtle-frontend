import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Sidebar from '../components/Sidebar';
import { AppView, User } from '../types';

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
};

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

  // QA-121: the mobile drawer could only be closed with the collapse button
  // or by choosing a menu item - Escape did nothing, unlike MapPicker's
  // "Place on the map" picker, which already closes on Escape.
  //
  // QA-121 (run 7) / QA-122: the first fix fired on any Escape whenever
  // `isOpen` was true, which on desktop (>= 1024px) is the permanent
  // sidebar's own "open" state, not a drawer - collapsing it on every
  // Escape anywhere (closing a popover, typing in a form). These tests pin
  // the viewport-width gate, and that the focus-return (deferred because the
  // menu button is unmounted until the close re-render commits) still works.
  describe('closing the drawer with Escape (QA-121 / QA-122)', () => {
    const originalInnerWidth = window.innerWidth;
    afterEach(() => setViewportWidth(originalInnerWidth));

    it('closes the drawer and returns focus to the menu button that opened it, on a mobile-width viewport', async () => {
      setViewportWidth(390);
      document.body.innerHTML = '<button aria-label="Open navigation">Menu</button>';
      const menuButton = screen.getByLabelText('Open navigation');
      const onToggle = vi.fn();
      render(<Sidebar {...defaultProps} onToggle={onToggle} isOpen={true} />);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onToggle).toHaveBeenCalledTimes(1);

      await new Promise((r) => setTimeout(r, 0));
      expect(menuButton).toHaveFocus();
    });

    it('does nothing on a desktop-width viewport, even while the sidebar is open (QA-122)', () => {
      setViewportWidth(1366);
      const onToggle = vi.fn();
      render(<Sidebar {...defaultProps} onToggle={onToggle} isOpen={true} />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onToggle).not.toHaveBeenCalled();
    });

    it('does nothing when the drawer is already closed', () => {
      setViewportWidth(390);
      const onToggle = vi.fn();
      render(<Sidebar {...defaultProps} onToggle={onToggle} isOpen={false} />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onToggle).not.toHaveBeenCalled();
    });

    it('ignores a key other than Escape', () => {
      setViewportWidth(390);
      const onToggle = vi.fn();
      render(<Sidebar {...defaultProps} onToggle={onToggle} isOpen={true} />);
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(onToggle).not.toHaveBeenCalled();
    });
  });
});
