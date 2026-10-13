// QA-074 (run 2): the password show/hide (eye icon) button had no
// accessible name at all, only its icon changing shape.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from '../screens/Login';

vi.mock('../services/Database', () => ({
  DatabaseConnection: {
    getDemoRoles: vi.fn().mockResolvedValue([]),
    getPublicStations: vi.fn().mockResolvedValue(['Lix', 'Argo']),
    loginUser: vi.fn().mockResolvedValue({ user: { id: 1, email: 'a@b.com' } }),
  },
}));

describe('Login — password visibility toggle accessibility (QA-074)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('names the button, and the name flips with its state', () => {
    render(<Login onLogin={vi.fn()} />);

    const toggle = screen.getByRole('button', { name: 'Show password' });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });
});
