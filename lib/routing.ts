import { AppView } from '../types';

/**
 * Maps the app's in-memory `view` state to and from a real URL path, so the
 * browser/Android Back button moves within the app instead of leaving it
 * (QA-004), and refreshing or sharing a link lands back on the same screen
 * instead of always dropping to the Dashboard (QA-005).
 *
 * Deliberately shallow: it restores which SCREEN you're on (and, for a nest
 * or turtle, which record), not in-progress form field values - that is a
 * separate, already-tracked piece of work ("saves progress on a form").
 */

// Paths relative to Vite's BASE_URL ('/turtle-frontend/' in production), no
// leading slash.
const STATIC_PATHS: Partial<Record<AppView, string>> = {
  [AppView.LOGIN]: 'login',
  [AppView.DASHBOARD]: 'dashboard',
  [AppView.NEST_RECORDS]: 'nests',
  [AppView.TURTLE_RECORDS]: 'turtles',
  [AppView.NEST_ENTRY]: 'nest-entry',
  [AppView.TAGGING_ENTRY]: 'tagging-entry',
  [AppView.MORNING_SURVEY]: 'morning-survey',
  [AppView.MAP_VIEW]: 'nest-map',
  [AppView.SETTINGS]: 'settings',
  [AppView.TIME_TABLE]: 'time-table',
  [AppView.USER_MANAGEMENT]: 'user-management',
  [AppView.PUBLIC_STATS]: 'public-stats',
  [AppView.REVIEW_QUEUE]: 'review-queue',
  [AppView.SEASON_REPORT]: 'season-report',
  [AppView.PROJECT_SETTINGS]: 'project-settings',
};

export interface RouteState {
  view: AppView;
  nestId?: string;
  turtleId?: string;
  /** Where NEST_ENTRY's own Back button should return to. */
  nestEntryOrigin?: 'records' | 'survey';
}

const base = (): string => {
  const b = (import.meta as any).env?.BASE_URL ?? '/';
  return b.endsWith('/') ? b : `${b}/`;
};

export const pathForRoute = (route: RouteState): string => {
  const { view, nestId, turtleId, nestEntryOrigin } = route;
  if (view === AppView.NEST_DETAILS && nestId) return `${base()}nests/${encodeURIComponent(nestId)}`;
  if (view === AppView.NEST_INVENTORY && nestId) return `${base()}nests/${encodeURIComponent(nestId)}/inventory`;
  if (view === AppView.TURTLE_DETAILS && turtleId) return `${base()}turtles/${encodeURIComponent(turtleId)}`;
  if (view === AppView.NEST_ENTRY) return `${base()}nest-entry${nestEntryOrigin ? `?from=${nestEntryOrigin}` : ''}`;
  const staticPath = STATIC_PATHS[view];
  return `${base()}${staticPath ?? 'dashboard'}`;
};

/** The inverse of pathForRoute. Null when the path names no known screen. */
export const routeForPath = (pathname: string, search: string): RouteState | null => {
  const b = base();
  const rest = pathname.startsWith(b) ? pathname.slice(b.length) : pathname.replace(/^\//, '');
  const segments = rest.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  if (segments[0] === 'nests' && segments[1]) {
    if (segments[2] === 'inventory') return { view: AppView.NEST_INVENTORY, nestId: decodeURIComponent(segments[1]) };
    return { view: AppView.NEST_DETAILS, nestId: decodeURIComponent(segments[1]) };
  }
  if (segments[0] === 'turtles' && segments[1]) {
    return { view: AppView.TURTLE_DETAILS, turtleId: decodeURIComponent(segments[1]) };
  }
  if (segments[0] === 'nest-entry') {
    const params = new URLSearchParams(search);
    const from = params.get('from');
    return { view: AppView.NEST_ENTRY, nestEntryOrigin: from === 'survey' ? 'survey' : 'records' };
  }

  const slug = segments[0];
  for (const [view, path] of Object.entries(STATIC_PATHS)) {
    if (path === slug) return { view: view as AppView };
  }
  return null;
};
