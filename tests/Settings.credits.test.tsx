// GD-009 follow-up: the nav icons were self-hosted to stop leaking visitor
// IPs to icons8.com, but icons8's free tier requires a visible attribution
// link in lieu of a paid licence. This checks that link is actually present.
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import Settings from '../screens/Settings';
import { AppView } from '../types';

const user = {
  id: 1,
  firstName: 'Jo',
  lastName: 'Doe',
  role: 'Field Leader',
  avatar: '',
  email: 'jo@example.com',
} as any;

describe('Settings: icons8 attribution', () => {
  it('shows a working credit link to icons8.com', () => {
    render(
      <Settings
        onNavigate={() => {}}
        user={user}
        onUpdateUser={() => {}}
        theme="light"
        isSidebarOpen={false}
        onToggleSidebar={() => {}}
      />
    );

    const link = screen.getByRole('link', { name: /icons8/i });
    expect(link).toHaveAttribute('href', 'https://icons8.com');
  });
});
