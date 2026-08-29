import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, getAuthToken, setAuthToken, UNAUTHORIZED_EVENT, API_URL } from '../services/Database';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const ok = () => ({ ok: true, status: 200, json: async () => ({}) });
const unauthorized = () => ({ ok: false, status: 401, json: async () => ({ error: 'Session expired.' }) });

const headersOf = (call: any[]): Headers => call[1].headers;

describe('apiFetch', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    setAuthToken(null);
  });

  it('sends no Authorization header when signed out', async () => {
    mockFetch.mockResolvedValueOnce(ok());
    await apiFetch(`${API_URL}/nests`);
    expect(headersOf(mockFetch.mock.calls[0]).has('Authorization')).toBe(false);
  });

  it('attaches the stored token as a bearer credential', async () => {
    setAuthToken('abc.def.ghi');
    mockFetch.mockResolvedValueOnce(ok());
    await apiFetch(`${API_URL}/nests`);
    expect(headersOf(mockFetch.mock.calls[0]).get('Authorization')).toBe('Bearer abc.def.ghi');
  });

  it('preserves headers the caller set', async () => {
    setAuthToken('tok');
    mockFetch.mockResolvedValueOnce(ok());
    await apiFetch(`${API_URL}/nests/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const headers = headersOf(mockFetch.mock.calls[0]);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer tok');
  });

  it('discards the token when the server rejects it', async () => {
    setAuthToken('stale');
    mockFetch.mockResolvedValueOnce(unauthorized());

    await apiFetch(`${API_URL}/nests`);

    // Leaving a token the server has already refused would keep every later
    // call failing in the same way, with no prompt to sign in again.
    expect(getAuthToken()).toBeNull();
  });

  it('announces the rejection so the app can return to the login screen', async () => {
    setAuthToken('stale');
    mockFetch.mockResolvedValueOnce(unauthorized());

    const heard = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, heard);
    await apiFetch(`${API_URL}/nests`);
    window.removeEventListener(UNAUTHORIZED_EVENT, heard);

    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('leaves the token alone on an ordinary failure', async () => {
    setAuthToken('good');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    await apiFetch(`${API_URL}/nests`);

    // A server error says nothing about whether the session is still valid;
    // signing the user out over one would lose their unsaved work.
    expect(getAuthToken()).toBe('good');
  });
});
