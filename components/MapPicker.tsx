import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { Map as MapIcon, X, Check, AlertTriangle } from 'lucide-react';
import { Button } from './UIComponents';

L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41],
});

/**
 * Placing a nest by tapping a map.
 *
 * A third way in alongside typing a handheld reading and reading the phone,
 * and the least precise of the three: what you get is where your finger
 * landed, at whatever zoom you were on. It is here for the cases the other two
 * do not cover — a nest being entered back at base from a sketch map, or a
 * relocation site being chosen before anyone walks to it — so it says what it
 * is rather than presenting a tapped point as a measurement.
 */

/** Below this, a fingertip covers more ground than a nest is wide. */
const IMPRECISE_BELOW_ZOOM = 16;

interface MapPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (lat: string, lng: string) => void;
  /** Where the form already points, if anywhere. */
  initial?: { lat?: string; lng?: string };
  /** Other nests on this beach, drawn for orientation. */
  context?: Array<{ lat: number; lng: number; label?: string }>;
  precision?: number;
}

const ClickCatcher: React.FC<{ onClick: (lat: number, lng: number) => void; onZoom: (z: number) => void }> = ({ onClick, onZoom }) => {
  useMapEvents({
    click: (e) => onClick(e.latlng.lat, e.latlng.lng),
    zoomend: (e) => onZoom(e.target.getZoom()),
  });
  return null;
};

const MapPicker: React.FC<MapPickerProps> = ({ open, onClose, onPick, initial, context = [], precision = 5 }) => {
  const startLat = Number(initial?.lat);
  const startLng = Number(initial?.lng);
  const hasStart = Number.isFinite(startLat) && Number.isFinite(startLng) && startLat !== 0;

  // Centre on what the form already has; failing that on the nests already
  // recorded at this beach, which is where the next one is likely to be. Only
  // if there is neither does it fall back to the wider site.
  const centre = useMemo<[number, number]>(() => {
    if (hasStart) return [startLat, startLng];
    if (context.length > 0) {
      return [
        context.reduce((s, c) => s + c.lat, 0) / context.length,
        context.reduce((s, c) => s + c.lng, 0) / context.length,
      ];
    }
    return [38.18, 20.55];
  }, [hasStart, startLat, startLng, context]);

  const [picked, setPicked] = useState<[number, number] | null>(hasStart ? [startLat, startLng] : null);
  const [zoom, setZoom] = useState(hasStart || context.length > 0 ? 17 : 13);

  if (!open) return null;

  const tooFarOut = zoom < IMPRECISE_BELOW_ZOOM;

  return (
    // Above the sidebar (z-2000) and its mobile backdrop (z-1500). At z-1000
    // the sidebar drew over the dialog, hiding its heading and its confirm
    // button behind the nav.
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden bg-white dark:bg-[#111418] shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <MapIcon className="size-5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Place on the map</h3>
            <p className="text-xs text-slate-500">Tap where the nest is. Zoom in first — accuracy is only as good as the tap.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        <div className="h-[45vh] min-h-[280px]">
          <MapContainer center={centre} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            <ClickCatcher onClick={(lat, lng) => setPicked([lat, lng])} onZoom={setZoom} />
            {/* Nests already recorded here, so the tap can be placed relative
                to something rather than into empty blue. */}
            {context.map((c, i) => (
              <CircleMarker key={i} center={[c.lat, c.lng]} radius={5}
                            pathOptions={{ color: '#64748b', fillColor: '#64748b', fillOpacity: 0.6 }}>
                {c.label && <Tooltip>{c.label}</Tooltip>}
              </CircleMarker>
            ))}
            {picked && <Marker position={picked} />}
          </MapContainer>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          {picked ? (
            <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">
              {picked[0].toFixed(precision)}, {picked[1].toFixed(precision)}
            </p>
          ) : (
            <p className="text-sm text-slate-500">Nothing selected yet — tap the map.</p>
          )}

          {picked && tooFarOut && (
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-500 flex items-start gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0 mt-px" />
              <span>Zoomed out this far, a tap is tens of metres wide. Zoom in, or use a GPS reading instead.</span>
            </p>
          )}

          {picked && !tooFarOut && (
            <p className="text-[11px] text-slate-500">
              A tapped point is where you touched the map, not a measurement — a handheld GPS reading is more accurate.
            </p>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => { if (picked) { onPick(picked[0].toFixed(precision), picked[1].toFixed(precision)); onClose(); } }}
              disabled={!picked}
              icon={<Check className="size-4" />}
            >
              Use this point
            </Button>
            <Button variant="outline" onClick={onClose} icon={<X className="size-4" />}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapPicker;
