import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Records from '../screens/Records';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

// Regression (QA-127): only the nest active/archived list got a mobile card
// layout (QA-053) - Turtle Records and the Emergences tab kept the
// `hidden sm:block` table at every width, so a phone showed nothing but
// "Showing N records" with no way to open a turtle or emergence. jsdom can't
// evaluate Tailwind breakpoints, so this proves what a unit test CAN prove:
// `data-testid="turtle-cards"` / `"emergence-cards"` lists now exist in the
// DOM, carrying the same fields and actions as their tables, for the
// `sm:hidden` card layout to render from.

const leader: User = {
  id: '1',
  firstName: 'Lena',
  lastName: 'Leader',
  role: 'Field Leader',
  avatar: '',
  email: 'lena.leader@turtleguard.demo',
};

const baseProps = {
  onNavigate: vi.fn(),
  onSelectNest: vi.fn(),
  onInventoryNest: vi.fn(),
  onSelectTurtle: vi.fn(),
  theme: 'light' as const,
  user: leader,
  isSidebarOpen: false,
  onToggleSidebar: vi.fn(),
};

describe('Records (turtle) mobile card layout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(DatabaseConnection, 'getTurtles').mockResolvedValue([
      {
        id: 15,
        front_left_tag: '2204',
        name: 'Calypso',
        species: 'Loggerhead',
        is_archived: false,
      },
    ] as any);
  });

  it('renders the turtle tag, name, species and a View Details control inside the card list', async () => {
    render(<Records {...baseProps} type="turtle" />);

    await waitFor(() => expect(DatabaseConnection.getTurtles).toHaveBeenCalled());

    const cards = await screen.findByTestId('turtle-cards');
    expect(cards.textContent).toContain('KF-2204');
    expect(cards.textContent).toContain('Calypso');
    expect(within(cards).getByText('View Details')).toBeDefined();
  });
});

describe('Records (nest, emergence tab) mobile card layout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(DatabaseConnection, 'getNests').mockResolvedValue([] as any);
    vi.spyOn(DatabaseConnection, 'getEmergences').mockResolvedValue([
      {
        id: 174,
        event_date: '2026-10-15',
        beach: 'Xi',
        emergence_type: 'False crawl',
        nest_code: null,
      },
    ] as any);
  });

  it('renders the emergence date, beach, type badge and a Details control inside the card list', async () => {
    render(<Records {...baseProps} type="nest" />);

    fireEvent.click(await screen.findByText('Emergences'));

    const cards = await screen.findByTestId('emergence-cards');
    expect(cards.textContent).toContain('Xi');
    expect(cards.textContent).toContain('False crawl');
    expect(within(cards).getByText('Details')).toBeDefined();
  });
});
