'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Map as MapIcon, Satellite, Mountain } from 'lucide-react';

export type MapTileMode = 'STREET' | 'SATELLITE' | 'TERRAIN';

interface RequestLocationMapProps {
  latitude: number | null;
  longitude: number | null;
  onLocationSelect: (coords: {
    latitude: number;
    longitude: number;
    source: 'MAP';
    accuracy: number | null;
    timestamp: string;
  }) => void;
}

export default function RequestLocationMap({
  latitude,
  longitude,
  onLocationSelect,
}: RequestLocationMapProps) {
  const [mapLayer, setMapLayer] = useState<MapTileMode>('SATELLITE');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tileLayersRef = useRef<L.Layer[]>([]);
  const onLocationSelectRef = useRef(onLocationSelect);
  const isInternalMapActionRef = useRef<boolean>(false);

  // Helper to switch base tile layers smoothly with house-level zoom capability
  const applyTileLayer = (mode: MapTileMode, map: L.Map) => {
    tileLayersRef.current.forEach((layer) => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
    tileLayersRef.current = [];

    if (mode === 'SATELLITE') {
      // High-resolution Google Hybrid Satellite (imagery + roads + building names) with deep zoom up to 22
      // maxNativeZoom: 20 prevents "Map data not available" by smoothly upscaling zoom-20 tiles when zooming deeper into houses
      const googleHybrid = L.tileLayer(
        'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        {
          subdomains: ['0', '1', '2', '3'],
          maxZoom: 22,
          maxNativeZoom: 20,
          attribution: '&copy; Google Satellite & Imagery',
        }
      );
      googleHybrid.addTo(map);
      tileLayersRef.current = [googleHybrid];
    } else if (mode === 'TERRAIN') {
      // High-resolution elevation relief and mountain contours
      const topo = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 22,
          maxNativeZoom: 18,
          attribution: 'Tiles &copy; Esri &mdash; Topographic Relief',
        }
      );
      topo.addTo(map);
      tileLayersRef.current = [topo];
    } else {
      // Standard OpenStreetMap street view with smooth upscale support
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 22,
        maxNativeZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      });
      osm.addTo(map);
      tileLayersRef.current = [osm];
    }
  };

  // Keep callback reference updated without triggering map re-instantiation
  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  // Create custom marker icon
  const createMarkerIcon = () => {
    return L.divIcon({
      className: 'request-location-marker',
      html: `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 9999px;
          border: 3px solid #ffffff;
          background: #dc2626;
          color: #fff;
          font-size: 20px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          cursor: grab;
          user-select: none;
          transform: translate(-50%, -50%);
          transition: transform 0.1s ease;
        ">📍</div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });
  };

  // 1. Initialize Leaflet Map ONCE on mount
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] =
      latitude !== null && longitude !== null ? [latitude, longitude] : [28.2096, 84.5];
    const initialZoom = latitude !== null && longitude !== null ? 16 : 7;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      maxZoom: 22,
      zoomControl: true,
      attributionControl: true,
    });

    applyTileLayer(mapLayer, map);

    // Initial marker if coordinates were passed at mount
    if (latitude !== null && longitude !== null) {
      const marker = L.marker([latitude, longitude], {
        icon: createMarkerIcon(),
        draggable: true,
      }).addTo(map);

      marker.on('dragstart', () => {
        isInternalMapActionRef.current = true;
      });

      marker.on('dragend', (e) => {
        isInternalMapActionRef.current = true;
        const markerPos = e.target.getLatLng();
        onLocationSelectRef.current({
          latitude: Number(markerPos.lat.toFixed(6)),
          longitude: Number(markerPos.lng.toFixed(6)),
          source: 'MAP',
          accuracy: null,
          timestamp: new Date().toISOString(),
        });
      });

      markerRef.current = marker;
    }

    // On Map Click -> Update or create pin immediately and trigger state update
    map.on('click', (event) => {
      isInternalMapActionRef.current = true;
      const lat = Number(event.latlng.lat.toFixed(6));
      const lng = Number(event.latlng.lng.toFixed(6));

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const newMarker = L.marker([lat, lng], {
          icon: createMarkerIcon(),
          draggable: true,
        }).addTo(map);

        newMarker.on('dragstart', () => {
          isInternalMapActionRef.current = true;
        });

        newMarker.on('dragend', (e) => {
          isInternalMapActionRef.current = true;
          const markerPos = e.target.getLatLng();
          onLocationSelectRef.current({
            latitude: Number(markerPos.lat.toFixed(6)),
            longitude: Number(markerPos.lng.toFixed(6)),
            source: 'MAP',
            accuracy: null,
            timestamp: new Date().toISOString(),
          });
        });

        markerRef.current = newMarker;
      }

      onLocationSelectRef.current({
        latitude: lat,
        longitude: lng,
        source: 'MAP',
        accuracy: null,
        timestamp: new Date().toISOString(),
      });
    });

    mapInstanceRef.current = map;

    let rafId: number | null = null;
    let lastWidth = 0;
    let lastHeight = 0;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (Math.abs(width - lastWidth) > 1 || Math.abs(height - lastHeight) > 1) {
          lastWidth = width;
          lastHeight = height;
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.invalidateSize({ debounceMoveend: true });
            }
          });
        }
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    const t1 = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize({ debounceMoveend: true });
    }, 150);
    const t2 = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize({ debounceMoveend: true });
    }, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      tileLayersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount!

  // 2. React to mapLayer state changes and swap tiles seamlessly
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    applyTileLayer(mapLayer, map);
  }, [mapLayer]);

  // 3. Synchronize Marker & View when latitude/longitude props update from outside (e.g. GPS button)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (latitude === null || longitude === null) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    const targetLatLng: [number, number] = [latitude, longitude];

    if (markerRef.current) {
      const currentPos = markerRef.current.getLatLng();
      const dist = Math.hypot(currentPos.lat - latitude, currentPos.lng - longitude);
      if (dist > 0.00001) {
        markerRef.current.setLatLng(targetLatLng);
      }
    } else {
      const newMarker = L.marker(targetLatLng, {
        icon: createMarkerIcon(),
        draggable: true,
      }).addTo(map);

      newMarker.on('dragstart', () => {
        isInternalMapActionRef.current = true;
      });

      newMarker.on('dragend', (e) => {
        isInternalMapActionRef.current = true;
        const markerPos = e.target.getLatLng();
        onLocationSelectRef.current({
          latitude: Number(markerPos.lat.toFixed(6)),
          longitude: Number(markerPos.lng.toFixed(6)),
          source: 'MAP',
          accuracy: null,
          timestamp: new Date().toISOString(),
        });
      });

      markerRef.current = newMarker;
    }

    // If change was caused by clicking or dragging directly on the map, preserve user zoom & center completely
    if (isInternalMapActionRef.current) {
      isInternalMapActionRef.current = false;
      return;
    }

    // If external update (e.g., GPS button), smoothly center and ensure clear view without zooming out
    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom, 16);
    map.setView(targetLatLng, targetZoom, { animate: true });
  }, [latitude, longitude]);

  return (
    <div className="relative w-full h-full min-h-[300px] rounded-xl overflow-hidden border border-slate-300 bg-slate-100 shadow-xs flex flex-col">
      <div ref={mapContainerRef} className="w-full h-full min-h-[300px] flex-1" />
      
      {/* Incident Pin Info Bar */}
      <div className="absolute top-2 left-2 right-2 z-[400] rounded-lg border border-slate-300 bg-white/95 backdrop-blur-xs px-3 py-2 text-xs font-medium text-slate-800 shadow-xs flex items-center justify-between">
        <span>📍 Click or drag pin to position incident location.</span>
        {latitude !== null && longitude !== null && (
          <span className="font-mono text-[11px] font-bold text-red-700">
            {latitude}, {longitude}
          </span>
        )}
      </div>

      {/* Layer Toggle Switcher */}
      <div className="absolute bottom-2 left-2 z-[400] flex items-center gap-1 bg-white/95 backdrop-blur-xs p-1 rounded-lg border border-slate-300 shadow-xs">
        <button
          type="button"
          onClick={() => setMapLayer('SATELLITE')}
          className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
            mapLayer === 'SATELLITE'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="High-Resolution Satellite & House-Level Zoom"
        >
          <Satellite className="w-3.5 h-3.5" />
          <span>Satellite</span>
        </button>
        <button
          type="button"
          onClick={() => setMapLayer('STREET')}
          className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
            mapLayer === 'STREET'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Standard Street Map"
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>Street</span>
        </button>
        <button
          type="button"
          onClick={() => setMapLayer('TERRAIN')}
          className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
            mapLayer === 'TERRAIN'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Topographic Elevation & Mountain Contours"
        >
          <Mountain className="w-3.5 h-3.5" />
          <span>Terrain</span>
        </button>
      </div>
    </div>
  );
}
