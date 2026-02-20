import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Login from './Login';
import { DatabaseConnection } from '../services/Database';

// Mock DatabaseConnection
vi.mock('../services/Database', () => ({
  DatabaseConnection: {
    createUser: vi.fn(),
  },
}));

describe('Login Component', () => {
  it('renders login form by default', () => {
    render(<Login onLogin={vi.fn()} />);
    expect(screen.getByText('Archelon Data Portal')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('switches to sign up mode', () => {
    render(<Login onLogin={vi.fn()} />);
    fireEvent.click(screen.getByText('Create an Account'));
    expect(screen.getByText('Create Researcher Profile')).toBeInTheDocument();
    expect(screen.getByText('First Name')).toBeInTheDocument();
    expect(screen.getByText('Last Name')).toBeInTheDocument();
  });

  it('handles login submission', async () => {
    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} />);
    
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith({
        name: "Demo Researcher",
        role: "Project Coordinator",
        email: "test@example.com"
      });
    });
  });

  it('handles sign up submission', async () => {
    render(<Login onLogin={vi.fn()} />);
    fireEvent.click(screen.getByText('Create an Account'));

    fireEvent.change(screen.getByPlaceholderText('Maria'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByPlaceholderText('Pappas'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByPlaceholderText('m.pappas@university.gr'), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Create a strong password'), { target: { value: 'password123' } });
    
    (DatabaseConnection.createUser as any).mockResolvedValue({});

    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() => {
      expect(DatabaseConnection.createUser).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        password: 'password123',
        role: 'researcher'
      });
    });

    expect(screen.getByText('Application Submitted')).toBeInTheDocument();
  });
});
