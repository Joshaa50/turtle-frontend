// QA-131: Nest Records' Export CSV fired one GET /nest-events/<code> request
// per nest (N+1 - 31 separate requests on live data, slowest over 3s), to
// get each nest's hatchling count. Reuses the same batched codes= endpoint
// (getNestEventsBulk) the Season Report already uses for the same reason
// (QA-024): one request for every exported nest's events, not one per nest.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Records from '../screens/Records';
import { DatabaseConnection } from '../services/Database';
import * as utils from '../lib/utils';
import { User } from '../types';

vi.mock('../lib/utils', async () => {
  const actual = await vi.importActual<typeof utils>('../lib/utils');
  return { ...actual, downloadCsv: vi.fn() };
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

const nests = [
  { id: 701, nest_code: 'KP-1', beach: 'Kounopetra', date_laid: '2026-09-01', status: 'incubating', is_archived: false, total_num_eggs: 100 },
  { id: 702, nest_code: 'AG-3', beach: 'Agios Georgios', date_laid: '2026-09-02', status: 'incubating', is_archived: false, total_num_eggs: 90 },
  { id: 703, nest_code: 'VA-3', beach: 'Vatsa', date_laid: '2026-09-03', status: 'incubating', is_archived: false, total_num_eggs: 80 },
] as any;

describe('Records (nest) CSV export fetches hatchling counts in one batch (QA-131)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(DatabaseConnection, 'getNests').mockResolvedValue(nests);
    vi.spyOn(DatabaseConnection, 'getEmergences').mockResolvedValue([] as any);
    vi.spyOn(DatabaseConnection, 'getNestEventsBulk').mockResolvedValue({
      'KP-1': [], 'AG-3': [], 'VA-3': [],
    } as any);
    vi.spyOn(DatabaseConnection, 'getNestEvents');
  });

  it('calls getNestEventsBulk once with every exported nest code, not getNestEvents per nest', async () => {
    const user = userEvent.setup();
    render(<Records {...props} />);
    await waitFor(() => expect(DatabaseConnection.getNests).toHaveBeenCalled());

    const exportButton = await screen.findByRole('button', { name: /export csv/i });
    await waitFor(() => expect(exportButton).toBeEnabled());
    await user.click(exportButton);

    await user.click(await screen.findByRole('button', { name: 'Leave GPS out' }));

    await waitFor(() => expect(utils.downloadCsv).toHaveBeenCalled());

    expect(DatabaseConnection.getNestEventsBulk).toHaveBeenCalledTimes(1);
    expect(DatabaseConnection.getNestEventsBulk).toHaveBeenCalledWith(
      expect.arrayContaining(['KP-1', 'AG-3', 'VA-3'])
    );
    expect(DatabaseConnection.getNestEvents).not.toHaveBeenCalled();
  });
});
