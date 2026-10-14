import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Records from '../screens/Records';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

// Regression (QA-053, re-opened): the Nest Records list on a 390px phone
// only showed ID and a clipped date, with Beach/Status/Details hidden
// behind a sideways swipe. A prior pass tightened the table's padding, but
// jsdom can't evaluate Tailwind breakpoints, so this proves the fix a unit
// test CAN prove: a `data-testid="nest-cards"` list exists in the DOM,
// carrying the same ID/Beach/Status/Details fields as the table, for the
// mobile card layout to render from (`sm:hidden`) without duplicating logic.

const leader: User = {
  id: '1',
  firstName: 'Lena',
  lastName: 'Leader',
  role: 'Field Leader',
  avatar: '',
  email: 'lena.leader@turtleguard.demo',
};

const props = {
  type: 'nest' as const,
  onNavigate: vi.fn(),
  onSelectNest: vi.fn(),
  onInventoryNest: vi.fn(),
  onSelectTurtle: vi.fn(),
  theme: 'light' as const,
  user: leader,
  isSidebarOpen: false,
  onToggleSidebar: vi.fn(),
};

describe('Records (nest) mobile card layout', () => {
  beforeEach(() => {
    localStorage.clear();

    vi.spyOn(DatabaseConnection, 'getNests').mockResolvedValue([
      {
        id: 501,
        nest_code: 'N-501',
        beach: 'Zakynthos Beach',
        date_laid: '2026-05-10',
        status: 'incubating',
        is_archived: false,
      },
    ] as any);

    vi.spyOn(DatabaseConnection, 'getEmergences').mockResolvedValue([] as any);
  });

  it('renders the nest ID, beach, status, and a Details control inside the card list', async () => {
    render(<Records {...props} />);

    await waitFor(() => {
      expect(DatabaseConnection.getNests).toHaveBeenCalled();
    });

    const cards = await screen.findByTestId('nest-cards');

    expect(cards.textContent).toContain('N-501');
    expect(cards.textContent).toContain('Zakynthos Beach');
    expect(cards.textContent).toContain('INCUBATING');
    expect(within(cards).getByText('Details')).toBeDefined();
  });
});
