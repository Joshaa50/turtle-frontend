import { describe, it, expect } from 'vitest';
import { tallyHatchlings, calculateSuccessRate } from '../lib/nestStats';
import type { NestEventData } from '../services/Database';

const ev = (e: Partial<NestEventData>): NestEventData => e as NestEventData;

describe('tallyHatchlings', () => {
  it('uses the excavation count and ignores emergence tallies for the same nest', () => {
    // Real LP-1 data: 75 eggs, one excavation (71 hatched) plus two emergence
    // logs (66 and 71 tracks) that counted those same hatchlings on the nights
    // they crawled out. Summing all three gave 208/75 = 277.3%.
    const events = [
      ev({ event_type: 'FULL_INVENTORY', hatched_count: 71, start_time: '2026-08-13T23:02:00.000Z' }),
      ev({ event_type: 'EMERGENCE', tracks_to_sea: 68, tracks_lost: 3, start_time: '2026-08-13T12:00:00.000Z' }),
      ev({ event_type: 'EMERGENCE', tracks_to_sea: 62, tracks_lost: 4, start_time: '2026-08-11T12:00:00.000Z' }),
    ];

    const tally = tallyHatchlings(events, 75);
    expect(tally.count).toBe(71);
    expect(tally.source).toBe('excavation');
    expect(tally.exceedsClutch).toBe(false);
    expect(calculateSuccessRate(events, 75).rate).toBe(94.7);
  });

  it('falls back to emergence logs when no excavation has happened yet', () => {
    const events = [
      ev({ event_type: 'EMERGENCE', tracks_to_sea: 40, tracks_lost: 2, start_time: '2026-08-11T12:00:00.000Z' }),
      ev({ event_type: 'EMERGENCE', tracks_to_sea: 10, tracks_lost: 1, start_time: '2026-08-12T12:00:00.000Z' }),
    ];

    // A nest can genuinely emerge over several nights, so these do sum.
    const tally = tallyHatchlings(events, 100);
    expect(tally.count).toBe(53);
    expect(tally.source).toBe('emergence');
    expect(calculateSuccessRate(events, 100).rate).toBe(53);
  });

  it('treats repeat excavations as re-entries, taking the most recent', () => {
    const events = [
      ev({ event_type: 'FULL_INVENTORY', hatched_count: 50, start_time: '2026-08-10T10:00:00.000Z' }),
      ev({ event_type: 'FULL_INVENTORY', hatched_count: 62, start_time: '2026-08-12T10:00:00.000Z' }),
    ];

    expect(tallyHatchlings(events, 80).count).toBe(62);
  });

  it('ignores unrelated event types', () => {
    const events = [
      ev({ event_type: 'TOP_EGG', start_time: '2026-08-01T10:00:00.000Z' }),
      ev({ event_type: 'EMERGENCE', tracks_to_sea: 20, tracks_lost: 0, start_time: '2026-08-11T12:00:00.000Z' }),
    ];

    expect(tallyHatchlings(events, 40).count).toBe(20);
  });

  it('reports no data rather than zero when nothing has been recorded', () => {
    expect(tallyHatchlings([], 75).count).toBeNull();
    expect(calculateSuccessRate([], 75).rate).toBeNull();
    expect(calculateSuccessRate(undefined, 75).rate).toBeNull();
  });

  it('returns no rate when the clutch size is unknown', () => {
    const events = [ev({ event_type: 'FULL_INVENTORY', hatched_count: 71 })];
    const result = calculateSuccessRate(events, 0);
    expect(result.count).toBe(71);
    expect(result.rate).toBeNull();
    expect(result.exceedsClutch).toBe(false);
  });

  it('flags a count that still exceeds the clutch as a data error', () => {
    const events = [ev({ event_type: 'FULL_INVENTORY', hatched_count: 90 })];
    const result = calculateSuccessRate(events, 75);
    expect(result.exceedsClutch).toBe(true);
    expect(result.rate).toBe(120);
  });
});
