'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PriorityLevel, RescueCaseStatus } from '@/lib/types/emergency';
import { Focus, Maximize2 } from 'lucide-react';

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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center: Nepal (Kathmandu / Pokhara corridor)
    const map = L.map(mapContainerRef.current, {
      center: [28.2096, 84.5],
      zoom: 7,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    // ResizeObserver ensures Leaflet updates tile dimensions whenever container resizes or un-hides
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    // Initial size invalidations to ensure clean rendering after flex layout settling
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers and Map View
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Invalidate map size in case layout or tab changed
    map.invalidateSize();

    // Clear existing markers
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

    // If a case is selected, pan and zoom to it
    if (selectedCaseId) {
      const selected = cases.find((c) => c.id === selectedCaseId);
      if (selected && selected.latitude !== null && selected.longitude !== null) {
        map.setView([selected.latitude, selected.longitude], 13, { animate: true });
        const m = markersRef.current.get(selectedCaseId);
        if (m) {
          m.openPopup();
        }
      }
    } else if (validCoordinates.length > 0) {
      const bounds = L.latLngBounds(validCoordinates);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [cases, selectedCaseId, onSelectCase]);

  // Recenter helper to fit all cases
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
      map.setView([selected.latitude, selected.longitude], 13, { animate: true });
      const m = markersRef.current.get(selectedCaseId);
      if (m) {
        m.openPopup();
      }
    }
  };

  return (
    <div className="relative w-full h-full min-h-[350px] bg-slate-100 rounded-xl overflow-hidden border border-slate-300 shadow-xs flex flex-col">
      <div ref={mapContainerRef} className="w-full h-full z-0 min-h-[350px] flex-1" />

      {/* Map Control Shortcuts */}
      <div className="absolute top-2 left-14 z-[400] flex items-center gap-1.5 bg-white/95 backdrop-blur-xs p-1 rounded-lg border border-slate-300 shadow-xs">
        <button
          type="button"
          onClick={handleFitAll}
          className="p-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
          title="Fit all cases on map"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px]">Fit All</span>
        </button>
        {selectedCaseId && (
          <button
            type="button"
            onClick={handleCenterSelected}
            className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded text-xs font-semibold flex items-center gap-1 transition-colors border-l border-slate-200"
            title="Center on selected incident"
          >
            <Focus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Selected</span>
          </button>
        )}
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
