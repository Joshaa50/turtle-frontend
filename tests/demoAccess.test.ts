import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseConnection } from '../services/Database';

// The demo buttons are the only way a visitor with no account can get in, and
// this backend sleeps when idle: the first request after a quiet spell can take
// most of a minute or fail outright. One unretried fetch means the buttons never
// appear and the visitor is simply locked out, with nothing on screen saying why.
describe('getDemoRoles', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  const ok = (roles: string[]) => ({
    ok: true, status: 200, json: async () => ({ enabled: true, roles }),
  }) as unknown as Response;

  // Runs a call that sleeps between attempts, without waiting in real time.
  const settle = async <T,>(p: Promise<T>) => {
    await vi.runAllTimersAsync();
    return p;
  };

  it('returns the roles when the server answers first time', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok(['Coordinator', 'Volunteer']));
    await expect(settle(DatabaseConnection.getDemoRoles())).resolves.toEqual(['Coordinator', 'Volunteer']);
  });

  it('keeps trying while the server is still waking up', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(ok(['Coordinator']));

    await expect(settle(DatabaseConnection.getDemoRoles())).resolves.toEqual(['Coordinator']);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('retries a 502 from the platform while a cold instance starts', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) } as unknown as Response)
      .mockResolvedValue(ok(['Volunteer']));

    await expect(settle(DatabaseConnection.getDemoRoles())).resolves.toEqual(['Volunteer']);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not retry when demo access is deliberately switched off', async () => {
    // DEMO_LOGIN=off is an answer, not a failure. Retrying would hammer the
    // server for a minute to be told the same thing.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200, json: async () => ({ enabled: false, roles: [] }),
    } as unknown as Response);

    await expect(settle(DatabaseConnection.getDemoRoles())).resolves.toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('gives up rather than retrying for ever', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(settle(DatabaseConnection.getDemoRoles({ attempts: 4 }))).resolves.toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('reports each attempt so the screen can say what is happening', async () => {
    const onAttempt = vi.fn();
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(ok(['Coordinator']));

    await settle(DatabaseConnection.getDemoRoles({ onAttempt }));
    expect(onAttempt).toHaveBeenCalledWith(1);
    expect(onAttempt).toHaveBeenCalledWith(2);
  });

  it('stops when the caller aborts, so leaving the page ends the retries', async () => {
    const controller = new AbortController();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const promise = DatabaseConnection.getDemoRoles({ signal: controller.signal });
    controller.abort();
    await expect(settle(promise)).resolves.toEqual([]);
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
