// Regression (QA-104): the emergence edit dialog's Beach field was a plain
// free-text <Input>, unlike every other beach field in the app (Nest Entry,
// Morning Survey), which use a <Select> of configured beaches. A typo (e.g.
// "Logos 4") was only ever caught by the server's 400. This pins that the
// field is now a dropdown of the configured beaches, with no way to type an
// arbitrary string.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Records from '../screens/Records';
import { DatabaseConnection, apiFetch } from '../services/Database';
import { User } from '../types';

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

const leader: User = {
  id: '1', firstName: 'Lena', lastName: 'Leader', role: 'Field Leader',
  avatar: '', email: 'lena.leader@turtleguard.demo',
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

const EMERGENCE = {
  id: 154, nest_code: 'LG4-2', beach: 'Loggos 4', event_date: '2026-10-13T06:00:00.000Z',
  distance_to_sea_s: 19, gps_lat: 38.05, gps_long: 20.44,
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.spyOn(DatabaseConnection, 'getNests').mockResolvedValue([] as any);
  vi.spyOn(DatabaseConnection, 'getEmergences').mockResolvedValue([EMERGENCE] as any);
  (apiFetch as any).mockImplementation((url: string) => {
    if (url.includes('/beaches')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          beaches: [
            { name: 'Loggos 4', survey_area: 'Lixouri' },
            { name: 'Loggos 3', survey_area: 'Lixouri' },
          ],
        }),
      });
    }
    if (url.includes('/emergences/154')) {
      return Promise.resolve({ ok: true, json: async () => ({ emergence: EMERGENCE }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
});

describe('Records — emergence edit Beach field (QA-104)', () => {
  it('is a dropdown of configured beaches, not a free-text box', async () => {
    const user = userEvent.setup();
    render(<Records {...props} />);
    await waitFor(() => expect(DatabaseConnection.getEmergences).toHaveBeenCalled());

    await user.click(await screen.findByRole('button', { name: /^emergences$/i }));
    await user.click(await screen.findByRole('button', { name: /details/i }));

    fireEvent.click(await screen.findByRole('button', { name: /edit record/i }));

    const beachField = await screen.findByLabelText('Beach');
    expect(beachField.tagName).toBe('SELECT');
    const options = Array.from((beachField as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(expect.arrayContaining(['Loggos 4', 'Loggos 3']));
  });
});
