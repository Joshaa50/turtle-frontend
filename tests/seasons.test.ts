import { describe, it, expect } from 'vitest';
import {
  seasonOf, seasonsPresent, seasonLabel, currentSeason, nestsOutsideSeasons, outOfSeasonWarning, buildSeasonReport,
  type SeasonDef,
} from '../lib/seasonReport';

const nest = (date_found: string | undefined, over: any = {}) => ({
  id: date_found ?? 'x', nest_code: `N-${date_found}`, beach: 'Loggos 2', date_found, total_num_eggs: 100, ...over,
});

const summer: SeasonDef = { id: 'a', name: 'Summer 2026', start: '2026-05-01', end: '2026-10-31' };
const austral: SeasonDef = { id: 'b', name: '2026-27', start: '2026-11-15', end: '2027-04-30' };

describe('seasons defined by date range', () => {
  it('keeps the calendar-year behaviour when nothing is configured', () => {
    expect(seasonOf(nest('2026-03-01'))).toBe(2026);
    expect(seasonOf(nest('2026-03-01'), [])).toBe(2026);
    expect(nestsOutsideSeasons([nest('2026-03-01')], [])).toBe(0);
    expect(outOfSeasonWarning('2026-03-01', [])).toBeNull();
  });

  it('places a nest by date, boundaries included', () => {
    expect(seasonOf(nest('2026-05-01'), [summer])).toBe(2026);
    expect(seasonOf(nest('2026-10-31'), [summer])).toBe(2026);
    expect(seasonOf(nest('2026-04-30'), [summer])).toBeNull();
    expect(seasonOf(nest('2026-11-01'), [summer])).toBeNull();
  });

  it('keeps a season that crosses New Year together under its starting year', () => {
    expect(seasonOf(nest('2026-12-20'), [summer, austral])).toBe(2026);
    expect(seasonOf(nest('2027-02-10'), [summer, austral])).toBe(2026);
    expect(seasonsPresent([nest('2026-12-20'), nest('2027-02-10')], [austral])).toEqual([2026]);
  });

  it('does not fold a nest outside every season into a neighbour, but counts it', () => {
    const nests = [nest('2026-06-01'), nest('2026-03-01')];
    expect(seasonsPresent(nests, [summer])).toEqual([2026]);
    expect(nestsOutsideSeasons(nests, [summer])).toBe(1);
    expect(buildSeasonReport(nests, {}, 2026, [summer]).totals.nests).toBe(1);
  });

  it('ignores nests with no date rather than counting them as outside', () => {
    expect(nestsOutsideSeasons([nest(undefined)], [summer])).toBe(0);
  });

  it('names a season by its configured name, else the year', () => {
    expect(seasonLabel(2026, [summer])).toBe('Summer 2026');
    expect(seasonLabel(2025, [summer])).toBe('2025');
    expect(seasonLabel(2026)).toBe('2026');
  });

  it('opens on the season the coordinator marked current', () => {
    const nests = [nest('2026-06-01'), nest('2027-01-10')];
    expect(currentSeason(nests, new Date('2027-01-15'), [summer, austral], 'a')).toBe(2026);
    // Unmarked: falls back to the newest present.
    expect(currentSeason(nests, new Date('2030-01-01'), [summer, austral], null)).toBe(2026);
    // A marked season with no nests yet is still the one to show.
    expect(currentSeason([], new Date(), [summer], 'a')).toBe(2026);
  });
});

describe('outOfSeasonWarning', () => {
  it('says nothing inside a season', () => {
    expect(outOfSeasonWarning('2026-07-04', [summer])).toBeNull();
  });

  it('warns outside every season, naming them, without refusing', () => {
    const msg = outOfSeasonWarning('2026-03-01', [summer, austral]);
    expect(msg).toContain('Summer 2026');
    expect(msg).toContain('2026-27');
    expect(msg).toContain('can still save');
  });

  it('says nothing for an empty or unreadable date', () => {
    expect(outOfSeasonWarning('', [summer])).toBeNull();
    expect(outOfSeasonWarning(undefined, [summer])).toBeNull();
    expect(outOfSeasonWarning('not a date', [summer])).toBeNull();
  });
});
