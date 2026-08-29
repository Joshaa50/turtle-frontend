import { describe, it, expect, beforeEach } from 'vitest';
import { saveCache, loadCache, clearCache, clearCacheKey } from '../lib/offlineCache';

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

describe('clearing cached snapshots', () => {
  beforeEach(() => localStorage.clear());

  it('clearCacheKey drops only the named snapshot', () => {
    saveCache('turtles_raw', ['t']);
    saveCache('nests_raw', ['n']);

    clearCacheKey('turtles_raw');

    expect(loadCache('turtles_raw')).toBeNull();
    expect(loadCache('nests_raw')!.data).toEqual(['n']);
  });

  it('clearCache drops every snapshot', () => {
    saveCache('turtles_raw', ['t']);
    saveCache('nests_raw', ['n']);
    saveCache('emergences', ['e']);

    clearCache();

    expect(loadCache('turtles_raw')).toBeNull();
    expect(loadCache('nests_raw')).toBeNull();
    expect(loadCache('emergences')).toBeNull();
  });

  it('leaves unrelated keys alone', () => {
    // The offline write queues live outside this prefix and hold work that has
    // not reached the server. Clearing those on logout would lose field data.
    localStorage.setItem('turtle_offline_writes', '[{"pending":true}]');
    saveCache('nests_raw', ['n']);

    clearCache();

    expect(localStorage.getItem('turtle_offline_writes')).toBe('[{"pending":true}]');
  });
});
