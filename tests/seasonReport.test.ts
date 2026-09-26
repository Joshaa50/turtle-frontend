import { describe, it, expect } from 'vitest';
import { buildSeasonReport, seasonOf, seasonsPresent } from '../lib/seasonReport';

const nest = (over: any = {}) => ({
  id: 1, nest_code: 'LG2-1', beach: 'Loggos 2',
  date_found: '2026-06-01', total_num_eggs: 100, ...over,
});

// An excavation is a census of the whole clutch; emergence logs count tracks
// on one night. The report must inherit that rule rather than restate it.
const excavation = (hatched: number) => ({ event_type: 'INVENTORY', hatched_count: hatched });
const emergence = (toSea: number) => ({ event_type: 'EMERGENCE', tracks_to_sea: toSea });

describe('seasonOf / seasonsPresent', () => {
  it('places a nest in the season it was found', () => {
    expect(seasonOf(nest({ date_found: '2026-08-14' }))).toBe(2026);
  });

  it('ignores a nest with no or an unreadable date rather than guessing', () => {
    expect(seasonOf(nest({ date_found: undefined }))).toBeNull();
    expect(seasonOf(nest({ date_found: 'not a date' }))).toBeNull();
  });

  it('lists the seasons present, newest first', () => {
    const seasons = seasonsPresent([
      nest({ date_found: '2024-06-01' }),
      nest({ date_found: '2026-06-01' }),
      nest({ date_found: '2025-06-01' }),
      nest({ date_found: '2026-07-02' }),
      nest({ date_found: undefined }),
    ]);
    expect(seasons).toEqual([2026, 2025, 2024]);
  });
});

describe('buildSeasonReport', () => {
  it('counts only the nests from the season asked for', () => {
    const report = buildSeasonReport(
      [nest({ nest_code: 'A' }), nest({ nest_code: 'B', date_found: '2025-06-01' })],
      {},
      2026
    );
    expect(report.totals.nests).toBe(1);
  });

  it('groups by beach and totals eggs', () => {
    const report = buildSeasonReport(
      [
        nest({ nest_code: 'A', beach: 'Xi', total_num_eggs: 80 }),
        nest({ nest_code: 'B', beach: 'Xi', total_num_eggs: 90 }),
        nest({ nest_code: 'C', beach: 'Vatsa', total_num_eggs: 100 }),
      ],
      {},
      2026
    );
    expect(report.beaches.map((b) => b.beach)).toEqual(['Xi', 'Vatsa']);
    expect(report.beaches[0].eggs).toBe(170);
    expect(report.totals.eggs).toBe(270);
  });

  it('takes the excavation over the emergence logs for the same nest', () => {
    const report = buildSeasonReport(
      [nest({ nest_code: 'A', total_num_eggs: 100 })],
      { A: [emergence(30), emergence(20), excavation(85)] as any },
      2026
    );
    // 85, not 85+50 - the excavation is a census of the same animals.
    expect(report.totals.hatchlings).toBe(85);
    expect(report.totals.successRate).toBe(85);
  });

  it('sums emergence logs when no excavation has happened', () => {
    const report = buildSeasonReport(
      [nest({ nest_code: 'A', total_num_eggs: 100 })],
      { A: [emergence(30), emergence(20)] as any },
      2026
    );
    expect(report.totals.hatchlings).toBe(50);
  });

  it('leaves a still-incubating nest out of the success rate rather than scoring it zero', () => {
    const report = buildSeasonReport(
      [
        nest({ nest_code: 'DONE', total_num_eggs: 100 }),
        nest({ nest_code: 'INCUBATING', total_num_eggs: 100 }),
      ],
      { DONE: [excavation(90)] as any },
      2026
    );

    expect(report.nestsAwaitingOutcome).toBe(1);
    expect(report.totals.nests).toBe(2);
    // 90/100 from the nest that has an outcome - not 90/200, which would
    // report a rate that climbs on its own as the season goes on.
    expect(report.totals.successRate).toBe(90);
  });

  it('reports no rate at all when nothing has hatched yet', () => {
    const report = buildSeasonReport([nest({ nest_code: 'A' })], {}, 2026);
    expect(report.totals.successRate).toBeNull();
    expect(report.totals.hatchlings).toBe(0);
  });

  it('counts relocated nests separately', () => {
    const report = buildSeasonReport(
      [nest({ nest_code: 'A', relocated: true }), nest({ nest_code: 'B', relocated: false })],
      {},
      2026
    );
    expect(report.totals.relocated).toBe(1);
  });

  it('files a nest with no beach under Unrecorded rather than dropping it', () => {
    const report = buildSeasonReport([nest({ nest_code: 'A', beach: undefined })], {}, 2026);
    expect(report.beaches[0].beach).toBe('Unrecorded');
    expect(report.totals.nests).toBe(1);
  });
});
