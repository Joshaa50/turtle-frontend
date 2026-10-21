// QA-138: a half-filled Nest Entry draft (which can hold exact nest GPS)
// survived logout and was silently restored into the next person's form on
// the same device - performLogout already clears the survey draft and
// several caches for this exact device-sharing reason (QA-123), but never
// cleared turtle_nest_entry_draft.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import App from '../App';
import { saveNestEntryDraft } from '../lib/nestEntryDraft';

vi.mock('../services/Database', async () => {
  const actual = await vi.importActual<any>('../services/Database');
  return {
    ...actual,
    DatabaseConnection: {
      ...actual.DatabaseConnection,
      getBeaches: vi.fn().mockResolvedValue([]),
      getReviews: vi.fn().mockResolvedValue([]),
      getMyReviews: vi.fn().mockResolvedValue([]),
      getSettings: vi.fn().mockResolvedValue(actual.DatabaseConnection.defaultSettings()),
      getNests: vi.fn().mockResolvedValue([]),
      getTurtles: vi.fn().mockResolvedValue([]),
      getEmergences: vi.fn().mockResolvedValue([]),
      getWeeklyTimetable: vi.fn().mockResolvedValue([]),
      getAlerts: vi.fn().mockResolvedValue([]),
      getDemoRoles: vi.fn().mockResolvedValue([]),
      getPublicStations: vi.fn().mockResolvedValue([]),
      logout: vi.fn(),
    },
  };
});

// jsdom has no scroll implementation - App.tsx's view-change effect calls
// mainRef.current.scrollTo(0, 0) unconditionally.
Element.prototype.scrollTo = vi.fn() as any;

// App reads the role straight off the signed JWT payload (tokenRole), not
// the editable localStorage copy - a base64 payload with no real signature
// is enough, since isTokenExpired/tokenRole only decode, never verify.
const fakeToken = (role: string, expiresInSeconds = 3600) => {
  const payload = { role, exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
  const b64 = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
};

beforeEach(() => {
  localStorage.clear();
  const user = { id: 1, firstName: 'Nikos', lastName: 'Floros', role: 'Field Assistant', avatar: '', email: 'nikos@example.com' };
  localStorage.setItem('turtle_session_token', fakeToken('Field Assistant'));
  localStorage.setItem('turtle_session_user', JSON.stringify(user));
  saveNestEntryDraft({
    isNest: true,
    formData: {
      beach: 'Lepeda', nestId: 'LP-5', relocated: false, relocationReason: '',
      eggsTakenOut: '', eggsPutBackIn: '', startTime: '', endTime: '', notes: '',
    } as any,
    metrics: { h: '35', H: '', w: '', S: '' },
    coords: { lat: '38.17771', lng: '20.43968' },
    relocatedMetrics: { h: '', H: '', w: '', S: '' },
    relocatedCoords: { lat: '', lng: '' },
    triangulation: [],
    capturedSketch: null,
  });
});

describe('App: logout clears a half-filled Nest Entry draft (QA-138)', () => {
  it('removes turtle_nest_entry_draft so the next sign-in does not inherit it', async () => {
    render(<App />);

    expect(localStorage.getItem('turtle_nest_entry_draft')).toBeTruthy();

    const logoutButton = await screen.findByText('Logout');
    fireEvent.click(logoutButton);

    await waitFor(() => expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument());
    expect(localStorage.getItem('turtle_nest_entry_draft')).toBeNull();
  });
});
