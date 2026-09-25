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
      role: 'Field Leader',
      station: 'Station A'
    };

    await DatabaseConnection.createUser(userData);

    expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/users/register`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'Field Leader',
        station: 'Station A'
      })
    }));
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
