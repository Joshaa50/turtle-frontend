
import React, { useState, useRef } from 'react';

const GISMap: React.FC = () => {
  // Map View State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  // Live coordinates at the center of the view - Default to Central Greece
  const [centerCoords, setCenterCoords] = useState({ lat: 38.25, lng: 23.5 }); 
  
  const dragStart = useRef({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  // Bounds for the map image mapping (Approximate for Greece)
  const MAP_BOUNDS = {
    minLat: 34.8, 
    maxLat: 41.8, 
    minLng: 19.3, 
    maxLng: 28.3  
  };

  // Recalculate live center coordinates based on pan/zoom
  const updateCenterCoords = (currentTransform: typeof transform) => {
    if (!mapRef.current) return;
    
    const { clientWidth, clientHeight } = mapRef.current;
    
    // Viewport Center relative to the container
    const cx = clientWidth / 2;
    const cy = clientHeight / 2;
    
    // Determine where the Center point falls on the UN-TRANSFORMED map (0 to width, 0 to height)
    const mapX = (cx - currentTransform.x) / currentTransform.scale;
    const mapY = (cy - currentTransform.y) / currentTransform.scale;
    
    // Convert to percentage (0 to 1)
    const pctX = mapX / clientWidth;
    const pctY = mapY / clientHeight;
    
    // Map percentage back to Lat/Lng
    const latRange = MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat;
    const lngRange = MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng;
    
    const lat = MAP_BOUNDS.maxLat - (pctY * latRange);
    const lng = MAP_BOUNDS.minLng + (pctX * lngRange);
    
    setCenterCoords({ lat, lng });
  };

  // Dragging Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const newTransform = {
      ...transform,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    };
    
    setTransform(newTransform);
    updateCenterCoords(newTransform);
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  // Zoom Logic
  const handleZoom = (delta: number) => {
    setTransform(prev => {
        const newScale = Math.max(0.5, Math.min(8, prev.scale + delta));
        const newTransform = { ...prev, scale: newScale };
        updateCenterCoords(newTransform);
        return newTransform;
    });
  };

  const centerOnPoint = () => {
      // Reset view
      const newTransform = { x: 0, y: 0, scale: 1 };
      setTransform(newTransform);
      updateCenterCoords(newTransform);
  };

  return (
    <div className="flex h-full w-full relative overflow-hidden bg-[#0F172A]">
      
      {/* Interactive Map Container */}
      <div 
        ref={mapRef}
        className={`absolute inset-0 z-0 cursor-${isDragging ? 'grabbing' : 'grab'} active:cursor-grabbing select-none`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
            backgroundImage: `
                linear-gradient(rgba(51, 65, 85, 0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(51, 65, 85, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            backgroundColor: '#0F172A' // Fallback color
        }}
      >
        <div 
            className="w-full h-full relative transition-transform duration-75 ease-linear origin-center will-change-transform shadow-2xl"
            style={{ 
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` 
            }}
        >
            {/* Map Image Layer */}
            <img 
              alt="Greek Coastline Map" 
              className="w-full h-full object-cover opacity-70 pointer-events-none select-none"
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Greece_relief_map.jpg/1280px-Greece_relief_map.jpg"
              draggable={false}
            />
        </div>
      </div>

      {/* Floating Controls */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none z-20">
        <div className="flex gap-3 pointer-events-auto">
          <div className="bg-[#111418]/90 backdrop-blur shadow-2xl rounded-xl border border-white/10 p-2 flex gap-1">
            <button className={`p-2 rounded-lg text-primary bg-primary/10`} title="Pan Mode">
              <span className="material-symbols-outlined">pan_tool</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 pointer-events-auto">
          <button onClick={() => handleZoom(0.5)} className="size-10 bg-[#111418]/90 backdrop-blur shadow-xl rounded-xl border border-white/10 flex items-center justify-center text-slate-400 hover:text-primary transition-all active:scale-95">
            <span className="material-symbols-outlined">add</span>
          </button>
          <button onClick={() => handleZoom(-0.5)} className="size-10 bg-[#111418]/90 backdrop-blur shadow-xl rounded-xl border border-white/10 flex items-center justify-center text-slate-400 hover:text-primary transition-all active:scale-95">
            <span className="material-symbols-outlined">remove</span>
          </button>
          <button onClick={centerOnPoint} className="size-10 bg-[#111418]/90 backdrop-blur shadow-xl rounded-xl border border-white/10 flex items-center justify-center text-slate-400 hover:text-primary transition-all active:scale-95">
            <span className="material-symbols-outlined">my_location</span>
          </button>
        </div>
      </div>

      {/* Live Coordinate Status Bar */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-2 z-20 pointer-events-none">
        <div className="flex items-center gap-2 opacity-70">
            <div className="h-2 w-px bg-white"></div>
            <div className="h-px w-24 bg-white flex justify-center items-center">
                <span className="pb-4 text-[9px] font-black text-white">{ (200 / transform.scale).toFixed(0) } km</span>
            </div>
            <div className="h-2 w-px bg-white"></div>
        </div>

        <div className="bg-black/80 backdrop-blur-md text-white text-[10px] px-4 py-2 rounded-full font-mono border border-white/20 tracking-widest flex items-center gap-3 shadow-2xl">
            <div className="flex items-center gap-1.5">
                <span className="text-slate-500">LAT</span>
                <span className="font-bold text-primary">{centerCoords.lat.toFixed(5)}° N</span>
            </div>
            <div className="w-px h-3 bg-white/20"></div>
            <div className="flex items-center gap-1.5">
                <span className="text-slate-500">LNG</span>
                <span className="font-bold text-primary">{centerCoords.lng.toFixed(5)}° E</span>
            </div>
            <div className="w-px h-3 bg-white/20"></div>
            <span className="text-slate-400">ZOOM: {(transform.scale * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};

export default GISMap;
