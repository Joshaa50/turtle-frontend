import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Records from '../screens/Records';
import { DatabaseConnection } from '../services/Database';
import * as utils from '../lib/utils';
import { User } from '../types';

// Regression (QA-058): the nest CSV export used to ask about GPS inclusion
// via window.confirm(), whose OK/Cancel buttons don't map cleanly onto
// "include" vs "leave out". This replaces that native dialog with a Modal
// using explicitly-labelled buttons, and proves window.confirm is never
// invoked for this flow.

vi.mock('../lib/utils', async () => {
  const actual = await vi.importActual<typeof utils>('../lib/utils');
  return { ...actual, downloadCsv: vi.fn() };
});

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

describe('Records (nest) CSV export GPS prompt', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

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
    // The export path fetches the exported rows' events (for hatchling
    // counts) on demand, in one batched call (QA-131) - unmocked, this fell
    // through to a real network call and the test only passed on luck,
    // timing out whenever that call was slow.
    vi.spyOn(DatabaseConnection, 'getNestEventsBulk').mockResolvedValue({} as any);
  });

  it('opens a modal with explicit Include/Leave-out buttons instead of window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();

    render(<Records {...props} />);
    await waitFor(() => expect(DatabaseConnection.getNests).toHaveBeenCalled());

    // The button stays disabled (sortedData.length === 0) until the nest
    // fetched above has actually landed in state - userEvent silently no-ops
    // a click on a disabled element, so waiting for the mock to have been
    // called isn't enough; wait for the button itself to be enabled.
    const exportButton = await screen.findByRole('button', { name: /export csv/i });
    await waitFor(() => expect(exportButton).toBeEnabled());
    await user.click(exportButton);

    const modalTitle = await screen.findByText('Include GPS coordinates?');
    expect(modalTitle).toBeDefined();
    expect(screen.getByRole('button', { name: 'Include GPS' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Leave GPS out' })).toBeDefined();
    expect(confirmSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Leave GPS out' }));

    await waitFor(() => expect(utils.downloadCsv).toHaveBeenCalled());
    const [filename, rows] = (utils.downloadCsv as any).mock.calls[0];
    expect(filename).not.toContain('with-gps');
    expect(rows[0]).not.toHaveProperty('gps_lat');
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
