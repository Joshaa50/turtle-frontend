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
