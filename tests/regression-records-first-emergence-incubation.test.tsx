import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Records from '../screens/Records';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

// QA-145: mapNests() used n.hatched_at (set at excavation/inventory time) as
// the incubation end date for a "Hatched & Archived" nest, which can trail
// the actual first hatchling emergence by however many days the team waited
// before digging. n.first_emergence_at (set from the earliest EMERGENCE/
// HATCHING event) is now preferred when present, falling back to hatched_at
// only for nests with no emergence event recorded.

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

describe('Records (nest) incubation day count prefers first_emergence_at over hatched_at (QA-145)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(DatabaseConnection, 'getEmergences').mockResolvedValue([] as any);
  });

  it('uses first_emergence_at (60d), not the later hatched_at (90d), when both are present', async () => {
    vi.spyOn(DatabaseConnection, 'getNests').mockResolvedValue([
      {
        id: 601,
        nest_code: 'N-601',
        beach: 'Zakynthos Beach',
        date_laid: '2026-07-01',
        status: 'hatched',
        is_archived: false,
        first_emergence_at: '2026-08-30T06:00:00.000Z', // 60 days after laid
        hatched_at: '2026-09-29T06:00:00.000Z', // 90 days after laid
      },
    ] as any);

    render(<Records {...props} />);

    await waitFor(() => expect(DatabaseConnection.getNests).toHaveBeenCalled());
    await userEvent.click(screen.getByText('Hatched & Archived'));

    const cards = await screen.findByTestId('nest-cards');
    expect(cards.textContent).toContain('incubation 60d');
    expect(cards.textContent).not.toContain('incubation 90d');
  });

  it('falls back to hatched_at when first_emergence_at is absent', async () => {
    vi.spyOn(DatabaseConnection, 'getNests').mockResolvedValue([
      {
        id: 602,
        nest_code: 'N-602',
        beach: 'Zakynthos Beach',
        date_laid: '2026-07-01',
        status: 'hatched',
        is_archived: false,
        hatched_at: '2026-09-29T06:00:00.000Z', // 90 days after laid
      },
    ] as any);

    render(<Records {...props} />);

    await waitFor(() => expect(DatabaseConnection.getNests).toHaveBeenCalled());
    await userEvent.click(screen.getByText('Hatched & Archived'));

    const cards = await screen.findByTestId('nest-cards');
    expect(cards.textContent).toContain('incubation 90d');
  });
});
