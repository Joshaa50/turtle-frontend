import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseConnection, API_URL } from '../services/Database';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('DatabaseConnection', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('createUser calls the correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'User created' }),
    });

    const userData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'password123',
      station: 'Station A',
      privacyNoticeAccepted: true
    };

    await DatabaseConnection.createUser(userData);

    expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/users/register`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        password: 'password123',
        station: 'Station A',
        privacy_notice_accepted: true
      })
    }));
  });

  it('never sends a role on registration, even if one is passed in', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'User created' }) });

    // The server assigns Field Volunteer regardless. Sending a role would be
    // ignored there, so a caller smuggling one in must not reach the wire -
    // this is what stopped anyone registering as a Project Coordinator.
    await DatabaseConnection.createUser({
      firstName: 'Mal', lastName: 'Ory', email: 'mal@example.com', password: 'x',
      station: 'Station A', privacyNoticeAccepted: true,
      role: 'Project Coordinator',
    } as any);

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).not.toHaveProperty('role');
  });

  it('createUser passes the notice acceptance through faithfully, not defaulted', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'User created' }),
    });

    await DatabaseConnection.createUser({
      firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', password: 'x',
      station: 'Station A', privacyNoticeAccepted: false,
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body).privacy_notice_accepted).toBe(false);
  });

  it('getNests fetches nests correctly', async () => {
    const mockNests = [{ id: 1, nest_code: 'N1' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ nests: mockNests }),
    });

    const nests = await DatabaseConnection.getNests();

    // apiFetch always passes an init object so it can attach the bearer token.
    expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/nests`, expect.any(Object));
    expect(nests).toEqual(mockNests);
  });

  it('dismissReview DELETEs the review row and never the underlying record', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Review removed.' }),
    });

    await DatabaseConnection.dismissReview(7);

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_URL}/reviews/7`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('dismissReview throws with the server message on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Review not found.' }),
    });

    await expect(DatabaseConnection.dismissReview(7)).rejects.toThrow('Review not found.');
  });
});
