// Last-known-good snapshot of GET data, so list screens can still show
// something offline instead of an empty "failed to load" state. Stores the
// already-mapped shape each screen renders, not the raw API response, so the
// fallback path is a plain setState with no re-mapping logic duplicated.
const PREFIX = 'turtle_cache_';

export interface CachedEntry<T> {
  data: T;
  cachedAt: string;
}

export function saveCache<T>(key: string, data: T): void {
  try {
    const entry: CachedEntry<T> = { data, cachedAt: new Date().toISOString() };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable - caching is a nice-to-have, not worth failing the save for.
  }
}

export function loadCache<T>(key: string): CachedEntry<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Drops one cached snapshot, so a delete can't be undone by a stale copy the
 * next time a list falls back to the cache.
 */
export function clearCacheKey(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Storage unavailable - nothing was cached to begin with.
  }
}

/**
 * Drops every cached snapshot. Called on logout: these are read-through copies
 * of one researcher's view of the data - nest GPS positions, colleagues' names
 * and emails - and on a shared field device they would otherwise sit in
 * localStorage for whoever signs in next.
 *
 * Deliberately does not touch the offline write queues. Those hold work that
 * has not reached the server yet, and losing a survey someone recorded out of
 * signal is far worse than the snapshot this cleans up.
 */
export function clearCache(): void {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage unavailable - nothing to clear.
  }
}
