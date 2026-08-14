import React from 'react';
import { Crosshair, LoaderCircle } from 'lucide-react';
import type { GeolocationCapture } from '../../lib/useGeolocation';

interface UseLocationButtonProps {
  geo: GeolocationCapture;
  className?: string;
}

/**
 * One-tap coordinate capture, styled to match the "Now" buttons on the time
 * fields so the two shortcuts read as the same affordance.
 *
 * Renders the button only — callers place {geo.error} / {geo.accuracy} where it
 * suits their layout, since the GPS pairs sit in very different containers.
 */
export const UseLocationButton: React.FC<UseLocationButtonProps> = ({ geo, className = '' }) => (
  <button
    type="button"
    onClick={geo.capture}
    disabled={geo.isLocating}
    title="Fill these coordinates from this device's GPS"
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all disabled:opacity-60 disabled:cursor-wait ${className}`}
  >
    {geo.isLocating ? (
      <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
    ) : (
      <Crosshair className="w-3.5 h-3.5" />
    )}
    <span className="text-[10px] font-black uppercase tracking-widest">
      {geo.isLocating ? 'Locating' : 'Use GPS'}
    </span>
  </button>
);

/** Accuracy / failure feedback for a capture, shown under the coordinate pair. */
export const LocationStatus: React.FC<{ geo: GeolocationCapture }> = ({ geo }) => {
  if (geo.error) {
    return (
      <p className="text-[10px] font-bold text-amber-500 mt-2 leading-tight">{geo.error}</p>
    );
  }
  if (geo.accuracy !== null) {
    return (
      <p className="text-[10px] font-bold text-slate-400 mt-2 leading-tight">
        Filled from GPS — accurate to about {geo.accuracy}m.
      </p>
    );
  }
  return null;
};
