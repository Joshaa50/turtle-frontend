// Remigration is the average gap between nesting seasons (calendar years).
// Regression (QA-116): only NIGHT_SURVEY counted, so a turtle nesting in 2024
// and 2026 showed "Needs 2+ nesting seasons".
import { describe, it, expect } from 'vitest';
import { remigrationFromEvents } from '../screens/TurtleDetails';

const ev = (type: 'TAGGING' | 'NIGHT_SURVEY', rawDate: string) => ({ type, rawDate });

describe('remigrationFromEvents', () => {
  it('reports a two-year remigration for a turtle seen in two nesting seasons (Iris KF-1413)', () => {
    const events = [
      ev('NIGHT_SURVEY', '2024-06-11T00:00:00Z'),
      ev('TAGGING', '2026-05-22T00:00:00Z'),
      ev('TAGGING', '2026-09-01T00:00:00Z'),
    ];
    expect(remigrationFromEvents(events)).toEqual({ seasons: [2024, 2026], avgRemigrationYears: 2 });
  });

  it('counts a season once however many encounters it has', () => {
    const events = [
      ev('TAGGING', '2024-06-11T00:00:00Z'),
      ev('NIGHT_SURVEY', '2024-06-25T00:00:00Z'),
      ev('TAGGING', '2024-07-09T00:00:00Z'),
      ev('TAGGING', '2027-06-01T00:00:00Z'),
    ];
    expect(remigrationFromEvents(events)).toEqual({ seasons: [2024, 2027], avgRemigrationYears: 3 });
  });

  it('gives no remigration when all encounters fall in one year', () => {
    const events = [
      ev('TAGGING', '2025-05-01T00:00:00Z'),
      ev('TAGGING', '2025-08-01T00:00:00Z'),
    ];
    expect(remigrationFromEvents(events)).toEqual({ seasons: [2025], avgRemigrationYears: null });
  });

  it('averages the gaps between three seasons', () => {
    const events = [
      ev('NIGHT_SURVEY', '2021-06-01T00:00:00Z'),
      ev('NIGHT_SURVEY', '2023-06-01T00:00:00Z'),
      ev('TAGGING', '2026-06-01T00:00:00Z'),
    ];
    expect(remigrationFromEvents(events).avgRemigrationYears).toBeCloseTo(2.5);
  });
});
