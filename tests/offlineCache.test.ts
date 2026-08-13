import { describe, it, expect, beforeEach } from 'vitest';
import { saveCache, loadCache } from '../lib/offlineCache';

describe('offlineCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing has been cached', () => {
    expect(loadCache('nests')).toBeNull();
  });

  it('round-trips data through save/load with a timestamp', () => {
    const data = [{ id: 1, nest_code: 'N1' }];
    saveCache('nests', data);
    const cached = loadCache<typeof data>('nests');
    expect(cached).not.toBeNull();
    expect(cached!.data).toEqual(data);
    expect(new Date(cached!.cachedAt).toString()).not.toBe('Invalid Date');
  });

  it('keeps separate keys independent', () => {
    saveCache('nests', ['a']);
    saveCache('turtles', ['b']);
    expect(loadCache('nests')!.data).toEqual(['a']);
    expect(loadCache('turtles')!.data).toEqual(['b']);
  });
});
