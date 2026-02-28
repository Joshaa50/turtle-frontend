import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { DatabaseConnection, NestData } from '../services/Database';
import { AppView } from '../types';

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
}

const NestMap: React.FC<NestMapProps> = ({ onNavigate, onSelectNest, theme }) => {
  const [nests, setNests] = useState<NestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [selectedTriangulationNestId, setSelectedTriangulationNestId] = useState<string | null>(null);

  useEffect(() => {
    const fetchNests = async () => {
      try {
        const data = await DatabaseConnection.getNests();
        // Filter nests that have valid coordinates
        const validNests = data.filter((nest: NestData) => 
          nest.gps_lat && nest.gps_long && 
          !isNaN(Number(nest.gps_lat)) && !isNaN(Number(nest.gps_long))
        );
        setNests(validNests);
      } catch (error) {
        console.error("Failed to fetch nests for map:", error);
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

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-background-dark text-white' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`px-8 py-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-xl border-b shadow-sm ${
        theme === 'dark' ? 'bg-background-dark/90 border-border-dark' : 'bg-white/90 border-slate-200'
      }`}>
        {/* Spacer for centering */}
        <div className="w-40 hidden md:block"></div>

        <div className="text-center flex-1">
          <h1 className="text-xl font-black uppercase tracking-tight flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-primary">map</span>
            Nest Map
          </h1>
          <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            Geographic Distribution
          </p>
        </div>

        <div className="w-40 flex justify-end">
            <label className={`flex items-center gap-3 cursor-pointer group select-none px-3 py-1.5 rounded-full border transition-all ${
                theme === 'dark' 
                    ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${
                    theme === 'dark' ? 'text-slate-400 group-hover:text-white' : 'text-slate-500 group-hover:text-slate-900'
                } transition-colors`}>Active Only</span>
                <div className={`relative w-8 h-4 rounded-full transition-colors duration-300 ${
                    showActiveOnly ? 'bg-primary' : (theme === 'dark' ? 'bg-slate-700' : 'bg-slate-300')
                }`}>
                    <input 
                        type="checkbox" 
                        className="sr-only"
                        checked={showActiveOnly}
                        onChange={(e) => setShowActiveOnly(e.target.checked)}
                    />
                    <div className={`absolute top-0.5 left-0.5 size-3 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                        showActiveOnly ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                </div>
            </label>
        </div>
      </header>

      <div className="flex-1 relative z-0">
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
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            {filteredNests.map((nest) => {
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
                      <div className="text-slate-900 min-w-[200px]">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-lg">{nest.nest_code}</h3>
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${
                            nest.status === 'hatched' ? 'bg-emerald-100 text-emerald-700' : 
                            nest.status === 'hatching' ? 'bg-amber-100 text-amber-700' : 
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {nest.status}
                          </span>
                        </div>
                        
                        <div className="space-y-1 mb-3">
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Location</p>
                          <p className="text-sm font-medium">{nest.beach}</p>
                          <p className="text-[10px] font-mono text-slate-400 mt-1">
                            {Number(nest.gps_lat).toFixed(5)}, {Number(nest.gps_long).toFixed(5)}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-slate-100">
                          <button 
                            onClick={() => onSelectNest(nest.nest_code)}
                            className="w-full text-xs font-bold bg-primary text-white px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            View Details
                          </button>
                          
                          {hasTriangulationData && (
                            <button 
                              onClick={() => setSelectedTriangulationNestId(isTriangulationSelected ? null : nest.nest_code)}
                              className={`w-full text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 border ${
                                isTriangulationSelected 
                                  ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' 
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {isTriangulationSelected ? 'visibility_off' : 'straighten'}
                              </span>
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
                      {nest.tri_tl_lat && nest.tri_tl_long && (
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
