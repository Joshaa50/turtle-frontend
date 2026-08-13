import { describe, it, expect } from 'vitest';
import { formatDateDisplay, COORD_LABEL, COORD_PLACEHOLDER } from '../lib/utils';

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
