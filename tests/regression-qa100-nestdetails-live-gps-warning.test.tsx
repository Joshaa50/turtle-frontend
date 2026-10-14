// Regression (QA-100): Nest Entry and Morning Survey already warn live when
// a typed GPS position is implausibly far from the chosen beach, but Edit
// Nest Details only ever computed that warning from the *saved* nest
// (viewData.locationWarning), and only rendered it with `!isEditing` - so
// while actually editing the lat/lng inputs, no warning showed no matter how
// far off the new coordinates were, and Save went through with no
// confirmation. This pins that the warning now appears live while editing,
// using the in-progress edit values, and clears once they're back in range.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import NestDetails from '../screens/NestDetails';

const { NEST, BEACH } = vi.hoisted(() => ({
  NEST: {
    id: 94, nest_code: 'LG4-2', beach: 'Loggos 4', status: 'incubating',
    total_num_eggs: 100, current_num_eggs: 100, is_archived: false,
    depth_top_egg_h: '36', distance_to_sea_s: 19,
    gps_lat: '38.05000', gps_long: '20.44031', date_laid: '2026-10-13',
    notes: '',
  },
  BEACH: { name: 'Loggos 4', gps_lat: 38.05, gps_long: 20.44, radius_m: 150 },
}));

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getNest: vi.fn().mockResolvedValue({ message: 'Nest found', nest: NEST }),
      getNestEvents: vi.fn().mockResolvedValue([]),
      getAudit: vi.fn().mockResolvedValue([]),
      getBeaches: vi.fn().mockResolvedValue([BEACH]),
      getNestPhotos: vi.fn().mockResolvedValue([]),
      updateNest: vi.fn(),
    },
  };
});

const user = { role: 'Project Coordinator' } as any;

// setHeaderActions publishes the Cancel/Save/Edit buttons out of the
// component (App.tsx renders them in its own header). onBack/onNavigate etc.
// must be created ONCE at the outer render() call and passed down as a
// prop - creating them inside Harness's own body would give NestDetails a
// new function reference every render, which the header-actions effect
// (keyed on onBack) depends on, re-triggering it and looping forever.
const Harness: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [actions, setActions] = React.useState<React.ReactNode>(null);
  return (
    <>
      <div>{actions}</div>
      <NestDetails
        id="LG4-2"
        onBack={onBack}
        onNavigate={vi.fn()}
        user={user}
        isSidebarOpen={false}
        onToggleSidebar={vi.fn()}
        setHeaderActions={setActions}
      />
    </>
  );
};

beforeEach(() => vi.clearAllMocks());

describe('Nest Details — live GPS plausibility warning while editing (QA-100)', () => {
  it('warns live when a typed latitude lands far from the beach', async () => {
    render(<Harness onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /edit nest details/i }));

    const latInput = await screen.findByLabelText('Latitude') as HTMLInputElement;
    fireEvent.change(latInput, { target: { value: '38.18412' } });

    expect(await screen.findByText(/from Loggos 4/i)).toBeInTheDocument();
  });

  it('shows no warning once the edited coordinate is back in range', async () => {
    render(<Harness onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /edit nest details/i }));

    const latInput = await screen.findByLabelText('Latitude') as HTMLInputElement;
    fireEvent.change(latInput, { target: { value: '38.18412' } });
    await screen.findByText(/from Loggos 4/i);

    fireEvent.change(latInput, { target: { value: '38.05010' } });

    await waitFor(() => expect(screen.queryByText(/from Loggos 4/i)).toBeNull());
  });
});
