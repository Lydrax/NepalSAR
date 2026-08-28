'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PriorityLevel, RescueCaseStatus } from '@/lib/types/emergency';
import { Focus, Maximize2, Map as MapIcon, Satellite, Mountain } from 'lucide-react';

export type MapTileMode = 'STREET' | 'SATELLITE' | 'TERRAIN';

export interface MapCaseItem {
  id: string;
  caseNumber: string;
  latitude: number | null;
  longitude: number | null;
  priority: PriorityLevel;
  status: RescueCaseStatus;
  peopleCount: number;
  disasterType?: string;
  locationDescription?: string | null;
}

interface ResponderMapProps {
  cases: MapCaseItem[];
  selectedCaseId: string | null;
  onSelectCase: (id: string) => void;
}

export default function ResponderMap({
  cases,
  selectedCaseId,
  onSelectCase,
}: ResponderMapProps) {
  const [mapLayer, setMapLayer] = useState<MapTileMode>('SATELLITE');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const tileLayersRef = useRef<L.Layer[]>([]);
  const prevSelectedCaseIdRef = useRef<string | null | undefined>(undefined);
  const hasInitialFitRef = useRef<boolean>(false);

  // Helper to switch base tile layers smoothly with deep zoom support
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

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center: Nepal (Kathmandu / Pokhara corridor)
    const map = L.map(mapContainerRef.current, {
      center: [28.2096, 84.5],
      zoom: 7,
      maxZoom: 22,
      zoomControl: true,
      attributionControl: true,
    });

    applyTileLayer(mapLayer, map);

    mapInstanceRef.current = map;

    // ResizeObserver ensures Leaflet updates tile dimensions whenever container resizes or un-hides
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

    // Initial size invalidations to ensure clean rendering after flex layout settling
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to mapLayer state changes and swap tiles seamlessly
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    applyTileLayer(mapLayer, map);
  }, [mapLayer]);

  // Update Markers and Map View
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Invalidate map size in case layout or tab changed
    map.invalidateSize();

    // Clear and re-populate markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    const validCoordinates: [number, number][] = [];

    cases.forEach((c) => {
      if (c.latitude === null || c.longitude === null) return;

      const isSelected = c.id === selectedCaseId;
      const latLng: [number, number] = [c.latitude, c.longitude];
      validCoordinates.push(latLng);

      const colorBg =
        c.priority === 'CRITICAL'
          ? '#b91c1c'
          : c.priority === 'HIGH'
          ? '#c2410c'
          : '#1d4ed8';

      const customIcon = L.divIcon({
        className: 'custom-responder-marker',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: ${colorBg};
            color: #ffffff;
            border: ${isSelected ? '3px solid #0f172a' : '2px solid #ffffff'};
            border-radius: 9999px;
            width: ${isSelected ? '34px' : '26px'};
            height: ${isSelected ? '34px' : '26px'};
            font-size: ${isSelected ? '12px' : '11px'};
            font-weight: 800;
            font-family: monospace;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            transform: translate(-50%, -50%);
            cursor: pointer;
            transition: all 0.15s ease;
          " title="${c.caseNumber} - ${c.priority}">
            ${c.peopleCount}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker(latLng, { icon: customIcon }).addTo(map);

      // Popup on marker click
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; color: #0f172a; min-width: 160px;">
          <div style="font-weight: 800; font-family: monospace; font-size: 13px; color: #0f172a; margin-bottom: 2px;">
            ${c.caseNumber}
          </div>
          <div style="display: inline-block; font-size: 10px; font-weight: 700; font-family: monospace; padding: 2px 6px; border-radius: 4px; background: ${
            c.priority === 'CRITICAL' ? '#fee2e2' : c.priority === 'HIGH' ? '#ffedd5' : '#dbeafe'
          }; color: ${colorBg}; margin-bottom: 6px;">
            ${c.priority} &bull; ${c.status}
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">
            <strong>People:</strong> ${c.peopleCount}
          </div>
          ${
            c.locationDescription
              ? `<div style="font-size: 11px; color: #334155; margin-bottom: 6px;">${c.locationDescription}</div>`
              : ''
          }
        </div>
      `);

      marker.on('click', () => {
        onSelectCase(c.id);
      });

      markersRef.current.set(c.id, marker);
    });

    const isCaseSelectionChanged = prevSelectedCaseIdRef.current !== selectedCaseId;
    prevSelectedCaseIdRef.current = selectedCaseId;

    // 1. If user switched selected case, smoothly pan to it without forcing zoom out
    if (isCaseSelectionChanged && selectedCaseId) {
      const selected = cases.find((c) => c.id === selectedCaseId);
      if (selected && selected.latitude !== null && selected.longitude !== null) {
        const currentZoom = map.getZoom();
        const targetZoom = Math.max(currentZoom, 15);
        map.setView([selected.latitude, selected.longitude], targetZoom, { animate: true });
        const m = markersRef.current.get(selectedCaseId);
        if (m) {
          m.openPopup();
        }
      }
    } else if (selectedCaseId) {
      // Keep popup open for active case if already open, but DO NOT modify map zoom/pan on polling
      const m = markersRef.current.get(selectedCaseId);
      if (m && !m.isPopupOpen()) {
        m.openPopup();
      }
    } else if (!hasInitialFitRef.current && validCoordinates.length > 0) {
      // 2. Only fit bounds ONCE on initial load to avoid auto-zooming out when background polling updates
      const bounds = L.latLngBounds(validCoordinates);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      hasInitialFitRef.current = true;
    }
  }, [cases, selectedCaseId, onSelectCase]);

  // Recenter helper to fit all cases (explicit user click)
  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.invalidateSize();
    const coords = cases
      .filter((c) => c.latitude !== null && c.longitude !== null)
      .map((c) => [c.latitude!, c.longitude!] as [number, number]);

    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    } else {
      map.setView([28.2096, 84.5], 7);
    }
  };

  const handleCenterSelected = () => {
    const map = mapInstanceRef.current;
    if (!map || !selectedCaseId) return;
    map.invalidateSize();
    const selected = cases.find((c) => c.id === selectedCaseId);
    if (selected && selected.latitude !== null && selected.longitude !== null) {
      const currentZoom = map.getZoom();
      const targetZoom = Math.max(currentZoom, 16);
      map.setView([selected.latitude, selected.longitude], targetZoom, { animate: true });
      const m = markersRef.current.get(selectedCaseId);
      if (m) {
        m.openPopup();
      }
    }
  };

  return (
    <div className="relative w-full h-full min-h-[350px] bg-slate-100 rounded-xl overflow-hidden border border-slate-300 shadow-xs flex flex-col">
      <div ref={mapContainerRef} className="w-full h-full z-0 min-h-[350px] flex-1" />

      {/* Map Control Shortcuts & Layer Toggles */}
      <div className="absolute top-2 left-14 z-[400] flex items-center gap-1.5 bg-white/95 backdrop-blur-xs p-1 rounded-lg border border-slate-300 shadow-xs">
        <button
          type="button"
          onClick={handleFitAll}
          className="p-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          title="Fit all cases on map"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px]">Fit All</span>
        </button>
        {selectedCaseId && (
          <button
            type="button"
            onClick={handleCenterSelected}
            className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded text-xs font-semibold flex items-center gap-1 transition-colors border-l border-slate-200 cursor-pointer"
            title="Center on selected incident"
          >
            <Focus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Selected</span>
          </button>
        )}

        {/* Map Layer Mode Toggle */}
        <div className="flex items-center gap-0.5 border-l border-slate-200 pl-1">
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
            <span className="hidden md:inline">Satellite</span>
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
            <span className="hidden md:inline">Street</span>
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
            <span className="hidden md:inline">Terrain</span>
          </button>
        </div>
      </div>

      {/* Priority Legend Badge */}
      <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 z-[400] flex items-center gap-3 shadow-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-700 inline-block ring-1 ring-red-300" /> CRITICAL
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-700 inline-block ring-1 ring-orange-300" /> HIGH
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-700 inline-block ring-1 ring-blue-300" /> NORMAL
        </span>
      </div>
    </div>
  );
}
