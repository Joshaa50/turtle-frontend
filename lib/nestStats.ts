import type { NestEventData } from '../services/Database';

export type HatchlingSource = 'excavation' | 'partial_excavation' | 'emergence';

export interface HatchlingTally {
  /** Hatchlings counted for this nest, or null when nothing has been recorded yet. */
  count: number | null;
  /** Which kind of record the count came from, for labelling it in the UI. */
  source: HatchlingSource | null;
  /** True when the count exceeds the clutch size — always a data-entry problem. */
  exceedsClutch: boolean;
}

// A PARTIAL_INVENTORY leaves eggs reburied and still incubating - it is a
// progress check, not the clutch's final outcome, so it is never let outrank
// a later FULL_INVENTORY and its count is reported as provisional rather than
// final. TOP_EGG isn't a count at all (it records finding the first egg) and
// is deliberately excluded here even though NestDetails' timeline treats it
// as excavation-adjacent for other purposes.
const isFullExcavation = (e: NestEventData) => e.event_type === 'FULL_INVENTORY' || e.event_type === 'INVENTORY';
const isPartialExcavation = (e: NestEventData) => e.event_type === 'PARTIAL_INVENTORY';

const isEmergence = (e: NestEventData) =>
  e.event_type === 'EMERGENCE' || e.event_type === 'HATCHING';

const eventTime = (e: NestEventData) => {
  const raw = e.start_time || e.created_at;
  const ms = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Counts the hatchlings a nest produced.
 *
 * The two kinds of record describe the *same* animals, so they must never be
 * added together:
 *
 * - An excavation ("INVENTORY") is a census of the whole clutch — every hatched
 *   shell in the chamber, including hatchlings that left on earlier nights and
 *   were already counted as tracks. It is the authoritative number.
 * - Emergence logs count tracks seen on one night. They are the field estimate
 *   of those same hatchlings.
 *
 * So an excavation, once it exists, wins outright. Several excavations on one
 * nest are re-entries of the same census rather than extra hatchlings, so the
 * most recent supersedes the others. Only when no excavation has happened yet do
 * the emergence logs stand in — and those genuinely do sum, because a nest can
 * emerge over several nights.
 */
export function tallyHatchlings(
  events: NestEventData[] | undefined | null,
  totalEggs: number
): HatchlingTally {
  const all = events || [];
  const fullExcavations = all.filter(isFullExcavation);
  const partialExcavations = all.filter(isPartialExcavation);
  const emergences = all.filter(isEmergence);

  let count: number | null = null;
  let source: HatchlingSource | null = null;

  if (fullExcavations.length > 0) {
    const latest = fullExcavations.reduce((a, b) => (eventTime(b) >= eventTime(a) ? b : a));
    count = latest.hatched_count || 0;
    source = 'excavation';
  } else if (partialExcavations.length > 0) {
    const latest = partialExcavations.reduce((a, b) => (eventTime(b) >= eventTime(a) ? b : a));
    count = latest.hatched_count || 0;
    source = 'partial_excavation';
  } else if (emergences.length > 0) {
    count = emergences.reduce(
      (sum, e) => sum + (e.tracks_to_sea || 0) + (e.tracks_lost || 0),
      0
    );
    source = 'emergence';
  }

  return {
    count,
    source,
    exceedsClutch: count !== null && totalEggs > 0 && count > totalEggs,
  };
}

export interface NestSuccessRate extends HatchlingTally {
  /** Hatchlings as a percentage of the clutch, to one decimal place. */
  rate: number | null;
}

export function calculateSuccessRate(
  events: NestEventData[] | undefined | null,
  totalEggs: number
): NestSuccessRate {
  const tally = tallyHatchlings(events, totalEggs);
  const rate =
    tally.count !== null && totalEggs > 0
      ? Number(((tally.count / totalEggs) * 100).toFixed(1))
      : null;
  return { ...tally, rate };
}
