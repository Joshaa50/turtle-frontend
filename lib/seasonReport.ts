import { tallyHatchlings } from './nestStats';
import type { NestEventData } from '../services/Database';

/**
 * Season aggregates for the report an organisation sends a funder or a
 * ministry.
 *
 * Hatchling counts come from tallyHatchlings rather than a second
 * implementation here: an excavation supersedes the emergence logs for the
 * same nest and the two must never be summed, and a product that arrives at
 * "hatch success" two different ways will eventually print two different
 * numbers for the same season.
 */

export interface NestLike {
  id: number | string;
  nest_code?: string;
  beach?: string;
  date_found?: string;
  status?: string;
  total_num_eggs?: number | string | null;
  relocated?: boolean | null;
}

export interface BeachSummary {
  beach: string;
  nests: number;
  relocated: number;
  eggs: number;
  /** Nests with a hatchling count on record. The success rate's denominator. */
  nestsWithOutcome: number;
  hatchlings: number;
  /**
   * Nests whose recorded hatchlings exceeded their eggs. A clutch cannot hatch
   * more than it held, so these are data-entry errors: their hatchlings are
   * counted as the clutch size (100%) and the nest is flagged, not left to push
   * a beach's success rate above 100.
   */
  flaggedNests: number;
  /** Hatchlings as a share of eggs in nests that have an outcome, or null. */
  successRate: number | null;
}

export interface SeasonReport {
  season: number;
  totals: BeachSummary;
  beaches: BeachSummary[];
  /** Nests counted but with no hatching outcome recorded yet. */
  nestsAwaitingOutcome: number;
}

const emptySummary = (beach: string): BeachSummary => ({
  beach, nests: 0, relocated: 0, eggs: 0, nestsWithOutcome: 0, hatchlings: 0, flaggedNests: 0, successRate: null,
});

/** A coordinator-defined season: a named date range (ISO days, inclusive). */
export interface SeasonDef {
  id: string;
  name: string;
  start: string;
  end: string;
}

/**
 * A season is identified by a number: the calendar year it is found in when no
 * seasons are configured (the app's original behaviour), or the year a
 * configured season starts in - so one that runs November to April is "2026",
 * not two half-seasons. Nests are matched by date range, not by year.
 */
const dayOf = (value: string | undefined): string | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/**
 * The season a nest belongs to. With seasons configured, a nest found outside
 * every one belongs to none (null) rather than being folded into a neighbour.
 */
export const seasonOf = (nest: NestLike, seasons: SeasonDef[] = []): number | null => {
  const day = dayOf(nest.date_found);
  if (!day) return null;
  if (seasons.length === 0) return Number(day.slice(0, 4));
  const match = seasons.find((s) => day >= s.start && day <= s.end);
  return match ? Number(match.start.slice(0, 4)) : null;
};

export const seasonsPresent = (nests: NestLike[], seasons: SeasonDef[] = []): number[] =>
  Array.from(new Set(nests.map((n) => seasonOf(n, seasons)).filter((y): y is number => y !== null)))
    .sort((a, b) => b - a);

/** What to call a season: the coordinator's name for it, else the year. */
export const seasonLabel = (key: number, seasons: SeasonDef[] = []): string =>
  seasons.find((s) => Number(s.start.slice(0, 4)) === key)?.name ?? String(key);

/** Nests with a date that fall in no configured season, so a report can say so. */
export const nestsOutsideSeasons = (nests: NestLike[], seasons: SeasonDef[] = []): number =>
  seasons.length === 0 ? 0 : nests.filter((n) => dayOf(n.date_found) && seasonOf(n, seasons) === null).length;

/**
 * A word for the person entering a record dated outside every configured
 * season - shown while they can still fix the date, never a reason to refuse
 * the save (a late nest is still a nest). Null when there is nothing to say,
 * including when no seasons are configured.
 */
export const outOfSeasonWarning = (date: string | undefined, seasons: SeasonDef[] = []): string | null => {
  const day = dayOf(date);
  if (!day || seasons.length === 0) return null;
  if (seasons.some((s) => day >= s.start && day <= s.end)) return null;
  return `This date is outside every nesting season (${seasons.map((s) => s.name).join(', ')}). You can still save it - check the date is right.`;
};

/**
 * The season the dashboard should describe. If the coordinator has marked one
 * current, that one. Otherwise this calendar year if any nest was found in it,
 * else the newest season on record - which keeps the dashboard and the season
 * report on the same nests, and an off-season demo from opening on a blank year.
 */
export const currentSeason = (
  nests: NestLike[],
  now: Date = new Date(),
  seasons: SeasonDef[] = [],
  currentId: string | null = null
): number | null => {
  const chosen = seasons.find((s) => s.id === currentId);
  if (chosen) return Number(chosen.start.slice(0, 4));
  const present = seasonsPresent(nests, seasons);
  if (present.length === 0) return null;
  return present.includes(now.getFullYear()) ? now.getFullYear() : present[0];
};

/**
 * `eventsByNest` is keyed by nest_code, matching what the API returns. A nest
 * with no entry is counted as awaiting an outcome rather than as zero
 * hatchlings - a nest still incubating is not a failed one, and averaging it
 * in as a zero would understate every beach it sits on.
 */
export const buildSeasonReport = (
  nests: NestLike[],
  eventsByNest: Record<string, NestEventData[]>,
  season: number,
  seasons: SeasonDef[] = []
): SeasonReport => {
  const inSeason = nests.filter((n) => seasonOf(n, seasons) === season);

  const byBeach = new Map<string, BeachSummary>();
  const totals = emptySummary('All beaches');
  let nestsAwaitingOutcome = 0;

  for (const nest of inSeason) {
    const beach = nest.beach || 'Unrecorded';
    if (!byBeach.has(beach)) byBeach.set(beach, emptySummary(beach));
    const row = byBeach.get(beach)!;

    const eggs = Number(nest.total_num_eggs) || 0;
    row.nests += 1;
    row.eggs += eggs;
    if (nest.relocated) row.relocated += 1;

    const tally = tallyHatchlings(eventsByNest[String(nest.nest_code)], eggs);
    if (tally.count !== null) {
      // Capped at the clutch: see BeachSummary.flaggedNests.
      const counted = tally.exceedsClutch ? eggs : tally.count;
      row.nestsWithOutcome += 1;
      row.hatchlings += counted;
      totals.nestsWithOutcome += 1;
      totals.hatchlings += counted;
      if (tally.exceedsClutch) {
        row.flaggedNests += 1;
        totals.flaggedNests += 1;
      }
    } else {
      nestsAwaitingOutcome += 1;
    }

    totals.nests += 1;
    totals.eggs += eggs;
    if (nest.relocated) totals.relocated += 1;
  }

  // The denominator is the eggs in nests that actually have an outcome, not
  // every egg laid: dividing by clutches still incubating would report a
  // success rate that climbs on its own as the season goes on.
  const rateFor = (rows: NestLike[], summary: BeachSummary): number | null => {
    if (summary.nestsWithOutcome === 0) return null;
    const eggsWithOutcome = rows
      .filter((n) => tallyHatchlings(eventsByNest[String(n.nest_code)], Number(n.total_num_eggs) || 0).count !== null)
      .reduce((sum, n) => sum + (Number(n.total_num_eggs) || 0), 0);
    if (eggsWithOutcome <= 0) return null;
    return Number(((summary.hatchlings / eggsWithOutcome) * 100).toFixed(1));
  };

  for (const [beach, row] of byBeach) {
    row.successRate = rateFor(inSeason.filter((n) => (n.beach || 'Unrecorded') === beach), row);
  }
  totals.successRate = rateFor(inSeason, totals);

  return {
    season,
    totals,
    beaches: Array.from(byBeach.values()).sort((a, b) => b.nests - a.nests || a.beach.localeCompare(b.beach)),
    nestsAwaitingOutcome,
  };
};
