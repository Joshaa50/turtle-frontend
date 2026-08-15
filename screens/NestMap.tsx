import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { DatabaseConnection, NestData } from '../services/Database';
import { saveCache, loadCache } from '../lib/offlineCache';
import { AppView } from '../types';
import { Eye, EyeOff, Ruler, MapPin, Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface NestMapProps {
  onNavigate: (view: AppView) => void;
  onSelectNest: (id: string) => void;
  theme: 'light' | 'dark';
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

// A nest belongs to the season it was laid in. date_found is the fallback for
// older records that never had a laying date recorded.
const seasonOf = (nest: NestData): number | null => {
  const raw = nest.date_laid || nest.date_found;
  if (!raw) return null;
  const year = new Date(raw).getFullYear();
  return isNaN(year) ? null : year;
};

// Whole-island zoom puts the beaches within a few dozen pixels of each other,
// where always-on count labels overlap into an unreadable pile. This reports
// the zoom level so they can be held back until they'd actually be legible.
const ZoomWatcher: React.FC<{ onZoomChange: (zoom: number) => void }> = ({ onZoomChange }) => {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });
  return null;
};

interface BeachDensity {
  beach: string;
  lat: number;
  lng: number;
  total: number;
  thisSeason: number;
  lastSeason: number;
  active: number;
}

const NestMap: React.FC<NestMapProps> = ({ onNavigate, onSelectNest, theme, isSidebarOpen, onToggleSidebar }) => {
  const [nests, setNests] = useState<NestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [selectedTriangulationNestId, setSelectedTriangulationNestId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<'nests' | 'density'>('nests');
  const [zoom, setZoom] = useState(10);

  useEffect(() => {
    const withCoords = (data: NestData[]) => data.filter((nest: NestData) =>
      nest.gps_lat && nest.gps_long &&
      !isNaN(Number(nest.gps_lat)) && !isNaN(Number(nest.gps_long))
    );

    const fetchNests = async () => {
      try {
        const data = await DatabaseConnection.getNests();
        setNests(withCoords(data));
        saveCache('nests_raw', data);
      } catch (error) {
        console.error("Failed to fetch nests for map:", error);
        // Offline: plot the last-known nests instead of an empty map.
        const cached = loadCache<NestData[]>('nests_raw');
        if (cached) setNests(withCoords(cached.data));
      } finally {
        setLoading(false);
      }
    };

    fetchNests();
  }, []);

  // Kefalonia coordinates
  const kefaloniaCenter: [number, number] = [38.175, 20.569]; 

  const filteredNests = showActiveOnly
    ? nests.filter(nest => nest.status?.toLowerCase() !== 'hatched')
    : nests;

  // The latest season present in the data rather than the wall-clock year: out
  // of season - or looking at an archived export - "this year" would otherwise
  // read as zero everywhere.
  const currentSeason = useMemo(() => {
    const seasons = nests.map(seasonOf).filter((y): y is number => y !== null);
    return seasons.length > 0 ? Math.max(...seasons) : new Date().getFullYear();
  }, [nests]);

  // One point per beach, placed at the mean position of its located nests, with
  // this season set against the one before it. Always computed over every nest,
  // never the Active Only subset: last season's nests have all hatched, so
  // filtering would flatten the comparison this view exists to show.
  const beachDensities = useMemo<BeachDensity[]>(() => {
    const byBeach = new Map<string, { latSum: number; lngSum: number; nests: NestData[] }>();

    nests.forEach((nest) => {
      const beach = nest.beach || 'Unknown beach';
      const entry = byBeach.get(beach) || { latSum: 0, lngSum: 0, nests: [] };
      entry.latSum += Number(nest.gps_lat);
      entry.lngSum += Number(nest.gps_long);
      entry.nests.push(nest);
      byBeach.set(beach, entry);
    });

    return Array.from(byBeach.entries())
      .map(([beach, { latSum, lngSum, nests: beachNests }]) => ({
        beach,
        lat: latSum / beachNests.length,
        lng: lngSum / beachNests.length,
        total: beachNests.length,
        thisSeason: beachNests.filter((n) => seasonOf(n) === currentSeason).length,
        lastSeason: beachNests.filter((n) => seasonOf(n) === currentSeason - 1).length,
        active: beachNests.filter((n) => n.status?.toLowerCase() !== 'hatched').length,
      }))
      .sort((a, b) => b.thisSeason - a.thisSeason);
  }, [nests, currentSeason]);

  const busiestBeach = beachDensities[0]?.thisSeason || 0;

  // Area, not radius, carries the count - a circle twice as wide reads as far
  // more than twice as many nests. Floors at 14px so a single-nest beach stays
  // tappable.
  const densityRadius = (count: number) => {
    if (busiestBeach === 0) return 14;
    return 14 + 26 * Math.sqrt(count / busiestBeach);
  };

  const densityColor = (count: number) => {
    const share = busiestBeach === 0 ? 0 : count / busiestBeach;
    if (share >= 0.75) return '#dc2626';
    if (share >= 0.5) return '#f97316';
    if (share >= 0.25) return '#f59e0b';
    return '#0ea5e9';
  };

  // `relative` on the wrapper keeps the floating map controls anchored to the
  // map itself. Without it they resolve against <main> and sit on top of the
  // sticky app header, covering the offline/pending status pills.
  return (
    <div className="relative h-[calc(100vh-4rem)] flex flex-col z-0">
      <div className="absolute top-4 right-4 z-[500] flex flex-col items-end gap-2">
        {/* Individual nests answer "where exactly is this one"; density answers
            "which beaches are busy this season". Active Only belongs to the
            first question - the second is a season comparison, and last
            season's nests have all hatched. */}
        <div className={`flex items-center gap-1 p-1 rounded-full border ${
            theme === 'dark' ? 'bg-background-dark/90 border-white/10' : 'bg-white/90 border-slate-200'
        }`}>
            {([
              { mode: 'nests' as const, label: 'Nests', icon: <MapPin className="size-3.5" /> },
              { mode: 'density' as const, label: 'Density', icon: <Flame className="size-3.5" /> },
            ]).map(({ mode, label, icon }) => (
              <button
                key={mode}
                onClick={() => setMapMode(mode)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${
                  mapMode === mode
                    ? 'bg-primary text-white shadow-sm'
                    : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
        </div>

        {mapMode === 'nests' && (
          <label className={`flex items-center gap-2 sm:gap-3 cursor-pointer group select-none px-2 sm:px-3 py-1.5 rounded-full border transition-all whitespace-nowrap ${
              theme === 'dark'
                  ? 'bg-background-dark/90 border-white/10 hover:bg-white/10'
                  : 'bg-white/90 border-slate-200 hover:bg-slate-100'
          }`}>
              <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${
                  theme === 'dark' ? 'text-slate-400 group-hover:text-white' : 'text-slate-500 group-hover:text-slate-900'
              } transition-colors`}>Active Only</span>
              <div className={`relative w-7 sm:w-8 h-3.5 sm:h-4 rounded-full transition-colors duration-300 ${
                  showActiveOnly ? 'bg-primary' : (theme === 'dark' ? 'bg-slate-700' : 'bg-slate-300')
              }`}>
                  <input
                      type="checkbox"
                      className="sr-only"
                      checked={showActiveOnly}
                      onChange={(e) => setShowActiveOnly(e.target.checked)}
                  />
                  <div className={`absolute top-0.5 left-0.5 size-2.5 sm:size-3 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                      showActiveOnly ? 'translate-x-3.5 sm:translate-x-4' : 'translate-x-0'
                  }`} />
              </div>
          </label>
        )}
      </div>

      {mapMode === 'density' && !loading && (
        <div className={`absolute bottom-6 left-4 z-[500] px-4 py-3 rounded-2xl border shadow-lg max-w-[15rem] ${
          theme === 'dark' ? 'bg-background-dark/95 border-white/10' : 'bg-white/95 border-slate-200'
        }`}>
          <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Nests laid · {currentSeason} season
          </p>
          <div className="flex items-end gap-3 mb-2">
            {[
              { share: 0.15, label: 'Low' },
              { share: 0.4, label: '' },
              { share: 0.65, label: '' },
              { share: 1, label: 'High' },
            ].map(({ share, label }, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span
                  className="rounded-full block"
                  style={{
                    width: `${8 + share * 14}px`,
                    height: `${8 + share * 14}px`,
                    backgroundColor: densityColor(share * (busiestBeach || 1)),
                    opacity: 0.75,
                  }}
                />
                <span className={`text-[8px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
          <p className={`text-[9px] font-bold leading-snug ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            One circle per beach, sized by nests laid this season. Tap for the
            year-on-year change.
          </p>
        </div>
      )}

      <div className="flex-1 flex flex-col relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <MapContainer 
            center={kefaloniaCenter} 
            zoom={10} 
            scrollWheelZoom={true}
            zoomSnap={0.5}
            zoomDelta={0.5}
            wheelPxPerZoomLevel={120}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <ZoomWatcher onZoomChange={setZoom} />
            {mapMode === 'density' && beachDensities.map((beach) => {
              const change = beach.thisSeason - beach.lastSeason;
              const color = densityColor(beach.thisSeason);

              return (
                <CircleMarker
                  key={`density-${beach.beach}`}
                  center={[beach.lat, beach.lng]}
                  radius={densityRadius(beach.thisSeason)}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 2 }}
                >
                  <Tooltip direction="top" offset={[0, -6]} opacity={1} permanent={zoom >= 12}>
                    <span className="font-bold text-xs">{beach.beach} · {beach.thisSeason}</span>
                  </Tooltip>
                  <Popup>
                    <div className={`min-w-[220px] ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      <h3 className="font-bold text-lg mb-2">{beach.beach}</h3>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                          <p className={`text-[9px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{currentSeason}</p>
                          <p className="text-xl font-black leading-none mt-1">{beach.thisSeason}</p>
                        </div>
                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                          <p className={`text-[9px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{currentSeason - 1}</p>
                          <p className="text-xl font-black leading-none mt-1">{beach.lastSeason}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mb-3 text-xs font-bold">
                        {beach.lastSeason === 0 ? (
                          <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
                            No {currentSeason - 1} records to compare against
                          </span>
                        ) : change > 0 ? (
                          <><TrendingUp className="size-4 text-emerald-500" /><span className="text-emerald-500">+{change} on {currentSeason - 1}</span></>
                        ) : change < 0 ? (
                          <><TrendingDown className="size-4 text-rose-500" /><span className="text-rose-500">{change} on {currentSeason - 1}</span></>
                        ) : (
                          <><Minus className="size-4 text-slate-400" /><span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Level with {currentSeason - 1}</span></>
                        )}
                      </div>

                      <p className={`text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {beach.total} located nest{beach.total !== 1 ? 's' : ''} on record · {beach.active} still incubating
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {mapMode === 'nests' && filteredNests.map((nest) => {
              const isTriangulationSelected = selectedTriangulationNestId === nest.nest_code;
              const hasTriangulationData = 
                (nest.tri_tl_lat && nest.tri_tl_long) || 
                (nest.tri_tr_lat && nest.tri_tr_long);

              return (
                <React.Fragment key={nest.id || nest.nest_code}>
                  <Marker 
                    position={[Number(nest.gps_lat), Number(nest.gps_long)]}
                  >
                    <Popup>
                      <div className={`min-w-[200px] ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-lg">{nest.nest_code}</h3>
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${
                            nest.status === 'hatched' ? (theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700') :
                            nest.status === 'hatching' ? (theme === 'dark' ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700') :
                            (theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700')
                          }`}>
                            {nest.status}
                          </span>
                        </div>

                        <div className="space-y-1 mb-3">
                          <p className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Location</p>
                          <p className="text-sm font-medium">{nest.beach}</p>
                          <p className={`text-[10px] font-mono mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                            {Number(nest.gps_lat).toFixed(5)}, {Number(nest.gps_long).toFixed(5)}
                          </p>
                        </div>

                        <div className={`flex flex-col gap-2 mt-3 pt-3 border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'}`}>
                          <button
                            onClick={() => onSelectNest(nest.nest_code)}
                            className="w-full text-xs font-bold bg-primary text-white px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                          >
                            <Eye className="size-4" />
                            View Details
                          </button>

                          {hasTriangulationData && (
                            <button
                              onClick={() => setSelectedTriangulationNestId(isTriangulationSelected ? null : nest.nest_code)}
                              className={`w-full text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 border ${
                                isTriangulationSelected
                                  ? (theme === 'dark' ? 'bg-white/10 text-white border-white/10 hover:bg-white/20' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200')
                                  : (theme === 'dark' ? 'bg-transparent text-slate-300 border-white/10 hover:bg-white/5' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')
                              }`}
                            >
                              {isTriangulationSelected ? <EyeOff className="size-4" /> : <Ruler className="size-4" />}
                              {isTriangulationSelected ? 'Hide Triangulation' : 'Show Triangulation'}
                            </button>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Render Triangulation Lines and Points if selected */}
                  {isTriangulationSelected && (
                    <>
                      {/* Point A (Top Left) */}
                      {nest.tri_tl_lat !== null && nest.tri_tl_lat !== undefined && nest.tri_tl_long !== null && nest.tri_tl_long !== undefined && (
                        <>
                          <Polyline 
                            positions={[
                              [Number(nest.gps_lat), Number(nest.gps_long)],
                              [Number(nest.tri_tl_lat), Number(nest.tri_tl_long)]
                            ]}
                            pathOptions={{ color: '#ef4444', dashArray: '5, 10', weight: 2 }}
                          />
                          <CircleMarker 
                            center={[Number(nest.tri_tl_lat), Number(nest.tri_tl_long)]}
                            pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }}
                            radius={4}
                          >
                            <Tooltip direction="top" offset={[0, -5]} opacity={1} permanent>
                              <div className="text-center">
                                <span className="font-bold text-xs block">Point A ({nest.tri_tl_distance}m)</span>
                                <span className="text-[10px] block font-mono">{Number(nest.tri_tl_lat).toFixed(5)}, {Number(nest.tri_tl_long).toFixed(5)}</span>
                              </div>
                            </Tooltip>
                          </CircleMarker>
                        </>
                      )}

                      {/* Point B (Top Right) */}
                      {nest.tri_tr_lat && nest.tri_tr_long && (
                        <>
                          <Polyline 
                            positions={[
                              [Number(nest.gps_lat), Number(nest.gps_long)],
                              [Number(nest.tri_tr_lat), Number(nest.tri_tr_long)]
                            ]}
                            pathOptions={{ color: '#3b82f6', dashArray: '5, 10', weight: 2 }}
                          />
                          <CircleMarker 
                            center={[Number(nest.tri_tr_lat), Number(nest.tri_tr_long)]}
                            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 1 }}
                            radius={4}
                          >
                            <Tooltip direction="top" offset={[0, -5]} opacity={1} permanent>
                              <div className="text-center">
                                <span className="font-bold text-xs block">Point B ({nest.tri_tr_distance}m)</span>
                                <span className="text-[10px] block font-mono">{Number(nest.tri_tr_lat).toFixed(5)}, {Number(nest.tri_tr_long).toFixed(5)}</span>
                              </div>
                            </Tooltip>
                          </CircleMarker>
                        </>
                      )}
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default NestMap;
