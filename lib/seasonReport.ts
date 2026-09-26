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
  beach, nests: 0, relocated: 0, eggs: 0, nestsWithOutcome: 0, hatchlings: 0, successRate: null,
});

/** The season a nest belongs to, by the year it was found. */
export const seasonOf = (nest: NestLike): number | null => {
  if (!nest.date_found) return null;
  const d = new Date(nest.date_found);
  return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
};

export const seasonsPresent = (nests: NestLike[]): number[] =>
  Array.from(new Set(nests.map(seasonOf).filter((y): y is number => y !== null)))
    .sort((a, b) => b - a);

/**
 * `eventsByNest` is keyed by nest_code, matching what the API returns. A nest
 * with no entry is counted as awaiting an outcome rather than as zero
 * hatchlings - a nest still incubating is not a failed one, and averaging it
 * in as a zero would understate every beach it sits on.
 */
export const buildSeasonReport = (
  nests: NestLike[],
  eventsByNest: Record<string, NestEventData[]>,
  season: number
): SeasonReport => {
  const inSeason = nests.filter((n) => seasonOf(n) === season);

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
      row.nestsWithOutcome += 1;
      row.hatchlings += tally.count;
      totals.nestsWithOutcome += 1;
      totals.hatchlings += tally.count;
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
