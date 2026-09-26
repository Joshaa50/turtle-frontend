import React, { useState } from 'react';
import { Crosshair, Loader2, AlertTriangle, Check } from 'lucide-react';

/**
 * Optional "read the phone's GPS" button that sits beside a pair of manually
 * typed coordinate fields.
 *
 * Typing stays the authoritative path. Field teams use a handheld GNSS unit
 * (1-3 m) and key the reading in; a phone is 3-5 m at best and worse under
 * cliffs, which is exactly where these beaches are. So this never fills a
 * field the recorder has already filled without asking, and it always shows
 * the accuracy the phone itself reports, so a bad fix can be rejected instead
 * of trusted. A reading the phone is not confident about is offered with a
 * warning rather than silently accepted.
 */

/** Above this, the phone's own error estimate is wider than a nest is long. */
const POOR_ACCURACY_M = 10;

export type CoordSource = 'manual' | 'device';

interface GpsAssistProps {
  /** Applies the reading. Called only after any overwrite is confirmed. */
  onFix: (lat: string, lng: string, accuracyM: number | null) => void;
  /** True when either field already holds something worth protecting. */
  hasExistingValue?: boolean;
  /** Decimal places to keep. Five is ~1 m at these latitudes. */
  precision?: number;
  className?: string;
  disabled?: boolean;
}

const GpsAssist: React.FC<GpsAssistProps> = ({
  onFix,
  hasExistingValue = false,
  precision = 5,
  className = '',
  disabled = false,
}) => {
  const [status, setStatus] = useState<'idle' | 'reading' | 'done' | 'error'>('idle');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  if (!supported) return null;

  const read = () => {
    if (hasExistingValue) {
      // Overwriting a reading someone walked to a handheld unit for is a far
      // worse failure than making them press twice.
      const ok = window.confirm(
        'Replace the coordinates already entered with a reading from this phone?\n\n' +
        'A handheld GPS unit is usually more accurate than a phone.'
      );
      if (!ok) return;
    }

    setStatus('reading');
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        const accM = typeof acc === 'number' && Number.isFinite(acc) ? Math.round(acc) : null;
        setAccuracy(accM);
        setStatus('done');
        onFix(latitude.toFixed(precision), longitude.toFixed(precision), accM);
      },
      (err) => {
        setStatus('error');
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — type the reading from your GPS unit instead.'
            : err.code === err.TIMEOUT
              ? 'The phone could not get a fix in time. Under a cliff or tree cover this is normal — type the reading instead.'
              : 'Could not read a location from this phone. Type the reading instead.'
        );
      },
      // No cached position: a fix from somewhere the recorder stood earlier is
      // worse than no fix, because it looks exactly like a good one.
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const poor = accuracy !== null && accuracy > POOR_ACCURACY_M;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={read}
        disabled={disabled || status === 'reading'}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
      >
        {status === 'reading'
          ? <Loader2 className="size-3.5 animate-spin" />
          : <Crosshair className="size-3.5" />}
        {status === 'reading' ? 'Reading phone GPS…' : 'Use this phone'}
      </button>

      {status === 'done' && accuracy !== null && (
        <p className={`mt-1.5 text-[11px] font-semibold flex items-start gap-1.5 ${poor ? 'text-amber-600 dark:text-amber-500' : 'text-emerald-600 dark:text-emerald-500'}`}>
          {poor ? <AlertTriangle className="size-3.5 shrink-0 mt-px" /> : <Check className="size-3.5 shrink-0 mt-px" />}
          <span>
            Phone reports ±{accuracy} m.
            {poor && ' That is wider than a nest — prefer a handheld GPS reading if you have one.'}
          </span>
        </p>
      )}

      {status === 'done' && accuracy === null && (
        <p className="mt-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-500 flex items-start gap-1.5">
          <AlertTriangle className="size-3.5 shrink-0 mt-px" />
          <span>This phone did not report an accuracy figure — treat the reading as approximate.</span>
        </p>
      )}

      {status === 'error' && message && (
        <p className="mt-1.5 text-[11px] font-semibold text-rose-500 flex items-start gap-1.5">
          <AlertTriangle className="size-3.5 shrink-0 mt-px" />
          <span>{message}</span>
        </p>
      )}
    </div>
  );
};

export default GpsAssist;
