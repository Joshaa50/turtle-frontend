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

    expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/nests`);
    expect(nests).toEqual(mockNests);
  });
});
