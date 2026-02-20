import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseConnection, API_URL } from './Database';

describe('DatabaseConnection', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes connection', async () => {
    const result = await DatabaseConnection.init();
    expect(result).toBe(true);
    expect(DatabaseConnection.status).toBe('CONNECTED');
  });

  it('creates a user', async () => {
    const mockUser = { firstName: 'John', lastName: 'Doe', email: 'john@example.com', password: 'password', role: 'Researcher' };
    const mockResponse = { message: 'User created' };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await DatabaseConnection.createUser(mockUser);

    expect(global.fetch).toHaveBeenCalledWith(`${API_URL}/users/register`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        first_name: mockUser.firstName,
        last_name: mockUser.lastName,
        email: mockUser.email,
        password: mockUser.password,
        role: mockUser.role
      })
    }));
    expect(result).toEqual(mockResponse);
  });

  it('fetches nests', async () => {
    const mockNests = [{ id: 1, nest_code: 'N001' }];
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ nests: mockNests }),
    });

    const result = await DatabaseConnection.getNests();

    expect(global.fetch).toHaveBeenCalledWith(`${API_URL}/nests`);
    expect(result).toEqual(mockNests);
  });

  it('handles fetch errors', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server Error' }),
    });

    await expect(DatabaseConnection.getNests()).rejects.toThrow('Server Error');
  });
});
