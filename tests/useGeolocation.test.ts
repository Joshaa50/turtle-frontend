import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatCoordinate,
  geolocationErrorMessage,
  UNSUPPORTED_MESSAGE,
} from '../lib/useGeolocation';

describe('formatCoordinate', () => {
  it('pads to the five decimals the coordinate fields expect', () => {
    expect(formatCoordinate(38.1)).toBe('38.10000');
    expect(formatCoordinate(20.5)).toBe('20.50000');
  });

  it('rounds rather than truncating a longer device reading', () => {
    expect(formatCoordinate(38.145623847)).toBe('38.14562');
    expect(formatCoordinate(20.578916)).toBe('20.57892');
  });

  it('keeps the sign on southern/western readings', () => {
    expect(formatCoordinate(-38.14562)).toBe('-38.14562');
  });
});

describe('geolocationErrorMessage', () => {
  // The codes are the PositionError constants; each gets its own wording so a
  // surveyor knows whether to retry or to give up and type the pair in.
  it('names a denied permission', () => {
    expect(geolocationErrorMessage({ code: 1 })).toMatch(/permission denied/i);
  });

  it('distinguishes no-fix from a timeout', () => {
    expect(geolocationErrorMessage({ code: 2 })).toMatch(/no gps fix/i);
    expect(geolocationErrorMessage({ code: 3 })).toMatch(/timed out/i);
  });

  it('falls back for an unrecognised or missing code', () => {
    expect(geolocationErrorMessage({})).toMatch(/could not read/i);
    expect(geolocationErrorMessage(undefined)).toMatch(/could not read/i);
  });

  it('always tells the user manual entry is still available', () => {
    [1, 2, 3, 99].forEach((code) => {
      expect(geolocationErrorMessage({ code })).toMatch(/manually/i);
    });
  });
});

describe('unsupported devices', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has a distinct message from the runtime failures', () => {
    expect(UNSUPPORTED_MESSAGE).toMatch(/does not support/i);
    expect(UNSUPPORTED_MESSAGE).not.toBe(geolocationErrorMessage({ code: 2 }));
  });
});
