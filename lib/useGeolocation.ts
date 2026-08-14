import { useCallback, useRef, useState } from 'react';

/**
 * Coordinate capture for the phone-first field forms.
 *
 * Every GPS field in the app is a manual-entry box with a `38.xxxxx` style
 * placeholder, which is a poor fit for someone standing on the beach at dawn
 * typing five decimal places into a phone. This mirrors the existing "Now"
 * buttons on the time fields: one tap fills the pair from the device.
 */

/** Five decimals is ~1m at this latitude, and matches the coordinate placeholders. */
const COORD_PRECISION = 5;

export const formatCoordinate = (value: number): string => value.toFixed(COORD_PRECISION);

export function geolocationErrorMessage(err: unknown): string {
  const code = (err as GeolocationPositionError | undefined)?.code;
  switch (code) {
    case 1: // PERMISSION_DENIED
      return 'Location permission denied — enter the coordinates manually.';
    case 2: // POSITION_UNAVAILABLE
      return 'No GPS fix available here — enter the coordinates manually.';
    case 3: // TIMEOUT
      return 'Locating timed out — try again, or enter the coordinates manually.';
    default:
      return 'Could not read this device\'s location — enter the coordinates manually.';
  }
}

export interface GeolocationCapture {
  /** Ask the device for a fix and hand the formatted pair to the callback. */
  capture: () => void;
  isLocating: boolean;
  error: string | null;
  /** Reported accuracy of the last successful fix, in metres. */
  accuracy: number | null;
  clearError: () => void;
}

export const UNSUPPORTED_MESSAGE =
  'This device does not support GPS capture — enter the coordinates manually.';

/**
 * High accuracy matters for nest triangulation; the generous timeout is for
 * cold GPS starts under tree cover, and a stale fix is useless when the
 * surveyor has walked the length of a beach since the last one.
 */
const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

function requestPosition(
  onSuccess: (lat: string, lng: string, accuracy: number | null) => void,
  onFailure: (message: string) => void
): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onFailure(UNSUPPORTED_MESSAGE);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) =>
      onSuccess(
        formatCoordinate(position.coords.latitude),
        formatCoordinate(position.coords.longitude),
        typeof position.coords.accuracy === 'number' ? Math.round(position.coords.accuracy) : null
      ),
    (err) => onFailure(geolocationErrorMessage(err)),
    POSITION_OPTIONS
  );
}

/**
 * `onCapture` receives already-formatted strings, because every consumer stores
 * coordinates as form strings rather than numbers.
 */
export function useGeolocation(
  onCapture: (lat: string, lng: string) => void
): GeolocationCapture {
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  // Keeps `capture` stable while still calling the latest callback — consumers
  // pass an inline arrow, which would otherwise rebuild the handler every render.
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  const clearError = useCallback(() => setError(null), []);

  const capture = useCallback(() => {
    setIsLocating(true);
    setError(null);
    requestPosition(
      (lat, lng, acc) => {
        setIsLocating(false);
        setAccuracy(acc);
        onCaptureRef.current(lat, lng);
      },
      (message) => {
        setIsLocating(false);
        setError(message);
      }
    );
  }, []);

  return { capture, isLocating, error, accuracy, clearError };
}

interface TargetState {
  isLocating: boolean;
  error: string | null;
  accuracy: number | null;
}

const EMPTY_TARGET: TargetState = { isLocating: false, error: null, accuracy: null };

/**
 * Keyed variant for coordinate pairs rendered inside a `.map()` — the
 * triangulation points — where one hook per point would break the Rules of
 * Hooks. `forKey` is a plain props factory, so it is legal to call in a loop
 * and returns the same shape the single-pair hook does.
 */
export function useGeolocationTargets(): {
  forKey: (key: string, onCapture: (lat: string, lng: string) => void) => GeolocationCapture;
} {
  const [targets, setTargets] = useState<Record<string, TargetState>>({});

  const patch = useCallback((key: string, next: Partial<TargetState>) => {
    setTargets((prev) => ({ ...prev, [key]: { ...EMPTY_TARGET, ...prev[key], ...next } }));
  }, []);

  const forKey = useCallback(
    (key: string, onCapture: (lat: string, lng: string) => void): GeolocationCapture => {
      const state = targets[key] || EMPTY_TARGET;
      return {
        ...state,
        capture: () => {
          patch(key, { isLocating: true, error: null });
          requestPosition(
            (lat, lng, acc) => {
              patch(key, { isLocating: false, accuracy: acc });
              onCapture(lat, lng);
            },
            (message) => patch(key, { isLocating: false, error: message })
          );
        },
        clearError: () => patch(key, { error: null }),
      };
    },
    [targets, patch]
  );

  return { forKey };
}
