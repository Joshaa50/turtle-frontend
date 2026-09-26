// Coordinator QA pass (26 Sep 2026): the pure logic behind the fixes.
import { describe, it, expect } from 'vitest';
import { resolveShiftHours, shiftHours } from '../lib/shiftHours';
import { nestAttention, isOpenNest, OVERDUE_DAYS, DUE_TO_HATCH_DAYS } from '../lib/nestLifecycle';
import { distanceMetres, beachLocationWarning, triangulationWarning } from '../lib/geo';
import { timeAgo } from '../lib/timeAgo';
import { buildSeasonReport, currentSeason } from '../lib/seasonReport';
import { surveyAreaTaskLabel } from '../lib/surveyAreas';
import { stationLabel } from '../lib/stations';
import { formatDate, formatDateTime } from '../lib/utils';
import { isTokenExpired, tokenExpiresAt } from '../services/Database';

const daysAgo = (n: number, from = new Date('2026-09-26T12:00:00')) => {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const NOW = new Date('2026-09-26T12:00:00');

describe('volunteer hours (#5)', () => {
  it('uses the template\'s own times when it has both', () => {
    expect(resolveShiftHours({ start_time: '17:00', end_time: '18:00' }, 'Afternoon'))
      .toEqual({ hours: 1, estimated: false });
  });

  it('gives an open-ended morning survey its default length instead of nothing', () => {
    const r = resolveShiftHours({ start_time: '06:00', end_time: null }, 'Morning');
    expect(r.hours).toBe(3.5); // 06:00-09:30
    expect(r.estimated).toBe(true);
  });

  it('still reports unknown for a shift type it has no default for', () => {
    expect(resolveShiftHours({}, 'Mystery')).toEqual({ hours: null, estimated: false });
  });

  it('counts a shift that crosses midnight', () => {
    expect(shiftHours('22:00', '02:00')).toBe(4);
  });
});

describe('nest lifecycle (#7, #9)', () => {
  it('does not count a hatched nest as active, archived or not', () => {
    expect(isOpenNest({ status: 'hatched', is_archived: false })).toBe(false);
    expect(isOpenNest({ status: 'hatching', is_archived: false })).toBe(true);
    expect(isOpenNest({ status: 'incubating', is_archived: true })).toBe(false);
  });

  it('flags a nest as due to hatch, then overdue for excavation', () => {
    const open = (days: number) => ({ status: 'hatching', date_found: daysAgo(days) });
    expect(nestAttention(open(DUE_TO_HATCH_DAYS - 1), NOW)).toBeNull();
    expect(nestAttention(open(DUE_TO_HATCH_DAYS), NOW)).toBe('due');
    expect(nestAttention(open(OVERDUE_DAYS), NOW)).toBe('overdue');
    // The QA case: AI-2 at 77 days and still "Hatching".
    expect(nestAttention(open(77), NOW)).toBe('overdue');
  });

  it('never flags a nest that has hatched', () => {
    expect(nestAttention({ status: 'hatched', date_found: daysAgo(200) }, NOW)).toBeNull();
  });
});

describe('position checks (#2)', () => {
  const vatsa = { name: 'Vatsa', gps_lat: 38.2, gps_long: 20.4 };

  it('measures distance sensibly', () => {
    // 0.001 degrees of latitude is ~111 m.
    expect(distanceMetres(38, 20, 38.001, 20)).toBeGreaterThan(105);
    expect(distanceMetres(38, 20, 38.001, 20)).toBeLessThan(115);
  });

  it('warns about a pin well away from its beach', () => {
    // The QA case: a Vatsa pin near the airport, kilometres from the beach.
    const w = beachLocationWarning(vatsa, 38.11554, 20.52823);
    expect(w).toMatch(/km from Vatsa/);
  });

  it('is quiet for a pin on the beach', () => {
    expect(beachLocationWarning(vatsa, 38.2004, 20.4003)).toBeNull();
  });

  it('respects a wider radius for a long beach', () => {
    const long = { ...vatsa, radius_m: 1500 };
    expect(beachLocationWarning(long, 38.208, 20.4)).toBeNull();
  });

  it('does not check a beach that has no reference point', () => {
    expect(beachLocationWarning({ name: 'Vatsa' }, 38.11554, 20.52823)).toBeNull();
  });

  it('catches a triangulation distance that disagrees with its coordinates', () => {
    // Stated 11.97 m, coordinates ~290 m away (the AI-2 case).
    const w = triangulationWarning(38.2, 20.4, 38.2026, 20.4, 11.97);
    expect(w).toMatch(/11\.97 m/);
  });

  it('accepts a triangulation point that agrees within tolerance', () => {
    expect(triangulationWarning(38.2, 20.4, 38.20009, 20.4, 10)).toBeNull();
  });
});

describe('hatch success can never exceed 100% (#3)', () => {
  it('caps a nest that recorded more hatchlings than eggs, and flags it', () => {
    const report = buildSeasonReport(
      [{ id: 1, nest_code: 'VA-1', beach: 'Vatsa', date_found: '2026-06-01', total_num_eggs: 45 }],
      { 'VA-1': [{ event_type: 'FULL_INVENTORY', hatched_count: 46 } as any] },
      2026
    );
    expect(report.totals.hatchlings).toBe(45);
    expect(report.totals.successRate).toBe(100);
    expect(report.totals.flaggedNests).toBe(1);
    expect(report.beaches[0].flaggedNests).toBe(1);
  });

  it('leaves an ordinary nest alone', () => {
    const report = buildSeasonReport(
      [{ id: 1, nest_code: 'A', beach: 'X', date_found: '2026-06-01', total_num_eggs: 100 }],
      { A: [{ event_type: 'FULL_INVENTORY', hatched_count: 80 } as any] },
      2026
    );
    expect(report.totals.successRate).toBe(80);
    expect(report.totals.flaggedNests).toBe(0);
  });
});

describe('dashboard season (#8)', () => {
  const nests = [
    { id: 1, date_found: '2024-06-19' },
    { id: 2, date_found: '2026-06-01' },
  ];

  it('is this year when it has nests', () => {
    expect(currentSeason(nests, new Date('2026-09-26'))).toBe(2026);
  });

  it('falls back to the newest season present rather than a blank year', () => {
    expect(currentSeason(nests, new Date('2027-02-01'))).toBe(2026);
  });

  it('is null with no nests', () => {
    expect(currentSeason([])).toBeNull();
  });
});

describe('wording (#13, P3)', () => {
  const beaches = [
    { name: 'Loggos 1', survey_area: 'Lepeda' },
    { name: 'Megas Lakkos', survey_area: 'Megas' },
    { name: 'Vatsa', survey_area: 'Vatsa' },
  ];

  it('names a Time Table task after the survey area the Morning Survey uses', () => {
    expect(surveyAreaTaskLabel('Loggos Beach Survey', beaches)).toBe('Lepeda Beach Survey');
  });

  it('leaves a task whose place already matches its area', () => {
    expect(surveyAreaTaskLabel('Vatsa Beach Survey', beaches)).toBe('Vatsa Beach Survey');
    expect(surveyAreaTaskLabel('Megas Beach Survey', beaches)).toBe('Megas Beach Survey');
  });

  it('leaves tasks that are not beach surveys, and unknown places', () => {
    expect(surveyAreaTaskLabel('Public Education', beaches)).toBe('Public Education');
    expect(surveyAreaTaskLabel('Nowhere Beach Survey', beaches)).toBe('Nowhere Beach Survey');
  });

  it('shows one capitalisation of "Clean Up"', () => {
    expect(surveyAreaTaskLabel('Beach Clean up', [])).toBe('Beach Clean Up');
    expect(surveyAreaTaskLabel('Beach Clean Up', [])).toBe('Beach Clean Up');
  });

  it('is singular for one', () => {
    const now = new Date('2026-09-26T12:00:00Z');
    expect(timeAgo(new Date('2026-08-20T12:00:00Z'), now)).toBe('1 month ago');
    expect(timeAgo(new Date('2026-09-25T12:00:00Z'), now)).toBe('1 day ago');
    expect(timeAgo(new Date('2026-09-23T12:00:00Z'), now)).toBe('3 days ago');
    expect(timeAgo(new Date('2026-09-26T11:59:30Z'), now)).toBe('Just now');
  });

  it('spells out a station code people would not recognise', () => {
    expect(stationLabel('Lix')).toBe('Lixouri (Lix)');
    expect(stationLabel('Argo')).toBe('Argostoli (Argo)');
    expect(stationLabel('Skala')).toBe('Skala');
    expect(stationLabel('')).toBe('');
  });
});

describe('one date format (P3)', () => {
  it('shows DD/MM/YYYY however the date arrives', () => {
    expect(formatDate('2026-09-21')).toBe('21/09/2026');
    expect(formatDate('2026-09-21T10:00:00Z')).toBe('21/09/2026');
    expect(formatDate(new Date(2026, 8, 21))).toBe('21/09/2026');
  });

  it('drops the seconds from a timestamp', () => {
    expect(formatDateTime(new Date(2026, 8, 26, 9, 7, 17))).toBe('26/09/2026 09:07');
  });

  it('shows nothing for nothing', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDateTime(undefined)).toBe('');
  });
});

describe('session expiry (#1)', () => {
  const tokenExpiringAt = (unixSeconds: number) =>
    `x.${btoa(JSON.stringify({ exp: unixSeconds })).replace(/=/g, '')}.y`;

  it('reads the expiry out of a token', () => {
    expect(tokenExpiresAt(tokenExpiringAt(1000))).toBe(1_000_000);
  });

  it('knows a token has run out', () => {
    expect(isTokenExpired(tokenExpiringAt(1000), 2_000_000)).toBe(true);
    expect(isTokenExpired(tokenExpiringAt(3000), 2_000_000)).toBe(false);
  });

  it('does not guess about a token it cannot read', () => {
    expect(isTokenExpired('not-a-token')).toBe(false);
    expect(isTokenExpired(null)).toBe(false);
  });
});
