// Regression (QA-166): the year-on-year "+N% vs <season>" comparison divides
// by the previous season's total, so a previous season holding only a
// handful of seed nests (e.g. 2 historical records) produced absurd swings
// like "+4650%". Below a minimum nest count, the previous season isn't a
// big enough sample to compare against, so the percentage should be hidden
// rather than shown.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SeasonReport from '../screens/SeasonReport';
import { DatabaseConnection } from '../services/Database';
import { User } from '../types';

const coordinator: User = {
  id: '1', firstName: 'Cora', lastName: 'Coordinator', role: 'Project Coordinator',
  avatar: '', email: 'cora.coordinator@turtleguard.demo',
};

const SEASON_DEFS = [
  { id: '2025', name: '2025 Nesting Season', start: '2025-05-01', end: '2025-10-31' },
  { id: '2026', name: '2026 Nesting Season', start: '2026-05-01', end: '2026-12-31' },
];

const bigSeasonNests = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1, nest_code: `LG-${i + 1}`, status: 'active',
  date_found: '2026-06-01', total_num_eggs: 80, beach: 'Loggos 4',
}));

const tinyPreviousSeasonNests = [
  { id: 101, nest_code: 'KP-7', status: 'hatched', date_found: '2025-06-10', total_num_eggs: 100, beach: 'Kounopetra' },
  { id: 102, nest_code: 'VR-7', status: 'hatched', date_found: '2025-06-12', total_num_eggs: 108, beach: 'Vrakhinari' },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(DatabaseConnection, 'getNests').mockResolvedValue(
    [...bigSeasonNests, ...tinyPreviousSeasonNests] as any
  );
  vi.spyOn(DatabaseConnection, 'getSettings').mockResolvedValue({
    seasons: { seasons: SEASON_DEFS, current: '2026' },
  } as any);
  vi.spyOn(DatabaseConnection, 'getNestEventsBulk').mockResolvedValue({});
});

describe('QA-166: season comparison hides the percentage against a tiny previous season', () => {
  it('shows no "vs previous season" percentage when the previous season has under 10 nests', async () => {
    render(<SeasonReport user={coordinator} />);

    await waitFor(() =>
      expect(screen.queryByText('Building the report…')).not.toBeInTheDocument()
    );
    await screen.findByRole('heading', { name: '2026 Nesting Season' });

    expect(screen.queryByText(/vs 2025 Nesting Season/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/[+-]\d+%/)).not.toBeInTheDocument();
  });
});
