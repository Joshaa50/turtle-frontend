import { describe, it, expect } from 'vitest';
import { formatDateDisplay, daysBetween, COORD_LABEL, COORD_PLACEHOLDER } from '../lib/utils';

describe('formatDateDisplay', () => {
  it('renders an ISO date as DD/MM/YYYY', () => {
    expect(formatDateDisplay('2026-08-12')).toBe('12/08/2026');
  });

  it('takes the date half of an ISO timestamp', () => {
    expect(formatDateDisplay('2026-03-10T00:00:00.000Z')).toBe('10/03/2026');
  });

  // Parsed off the string rather than via `new Date()`, so a bare date isn't
  // shifted a day backwards for anyone west of UTC.
  it('does not shift the day across timezones', () => {
    expect(formatDateDisplay('2026-01-01')).toBe('01/01/2026');
  });

  it('returns an empty string for missing values', () => {
    expect(formatDateDisplay('')).toBe('');
    expect(formatDateDisplay(null)).toBe('');
    expect(formatDateDisplay(undefined)).toBe('');
  });

  it('passes through values it cannot parse', () => {
    expect(formatDateDisplay('not-a-date')).toBe('not-a-date');
  });
});

describe('coordinate conventions', () => {
  it('uses one label and placeholder pair app-wide', () => {
    expect(COORD_LABEL).toEqual({ lat: 'Lat', lng: 'Lng' });
    expect(COORD_PLACEHOLDER).toEqual({ lat: '38.xxxxx', lng: '20.xxxxx' });
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days', () => {
    expect(daysBetween('2026-05-28', '2026-08-14')).toBe(78);
    expect(daysBetween('2026-08-13', '2026-08-17')).toBe(4);
    expect(daysBetween('2026-08-17', '2026-08-17')).toBe(0);
  });

  it('ignores the time of day', () => {
    // The reported off-by-one: an event earlier in the day than the discovery
    // was recorded used to floor to one day short.
    expect(daysBetween('2026-05-28T14:00:00', '2026-08-14T08:00:00')).toBe(78);
    expect(daysBetween('2026-05-28T00:00:00', '2026-08-14T23:59:00')).toBe(78);
  });

  it('spans a daylight-saving change without losing a day', () => {
    // Europe/Athens moves the clocks on 25 Oct 2026.
    expect(daysBetween('2026-10-20', '2026-10-30')).toBe(10);
  });

  it('is negative when the second date is earlier', () => {
    expect(daysBetween('2026-08-14', '2026-08-12')).toBe(-2);
  });

  it('returns null for an unparseable date', () => {
    expect(daysBetween('not-a-date', '2026-08-14')).toBeNull();
  });
});
