'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PriorityLevel, RescueCaseStatus } from '@/lib/types/emergency';

export interface MapCaseItem {
  id: string;
  caseNumber: string;
  latitude: number | null;
  longitude: number | null;
  priority: PriorityLevel;
  status: RescueCaseStatus;
  peopleCount: number;
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

    // Default center: Nepal (Pokhara / Central Nepal)
    const map = L.map(mapContainerRef.current, {
      center: [28.2096, 83.9856],
      zoom: 7,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers when cases or selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    const validCoordinates: L.LatLngExpression[] = [];

    cases.forEach((c) => {
      if (c.latitude === null || c.longitude === null) return;

      const isSelected = c.id === selectedCaseId;
      const latLng: [number, number] = [c.latitude, c.longitude];
      validCoordinates.push(latLng);

      // Distinct Priority Colors & Accessible Marker Badges
      const colorBg =
        c.priority === 'CRITICAL'
          ? '#dc2626'
          : c.priority === 'HIGH'
          ? '#ea580c'
          : '#3b82f6';

      const customIcon = L.divIcon({
        className: 'custom-responder-marker',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: ${colorBg};
            color: #ffffff;
            border: ${isSelected ? '3px solid #38bdf8' : '2px solid #ffffff'};
            border-radius: 9999px;
            width: ${isSelected ? '36px' : '28px'};
            height: ${isSelected ? '36px' : '28px'};
            font-size: 11px;
            font-weight: 800;
            font-family: monospace;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            transform: translate(-50%, -50%);
            cursor: pointer;
            transition: all 0.2s ease;
          " title="${c.caseNumber} - ${c.priority} (${c.peopleCount} ppl)">
            ${c.peopleCount}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker(latLng, { icon: customIcon }).addTo(map);

      marker.on('click', () => {
        onSelectCase(c.id);
      });

      markersRef.current.set(c.id, marker);
    });

    // If a case is selected, pan to it smoothly
    if (selectedCaseId) {
      const selected = cases.find((c) => c.id === selectedCaseId);
      if (selected && selected.latitude !== null && selected.longitude !== null) {
        map.panTo([selected.latitude, selected.longitude], { animate: true, duration: 0.5 });
      }
    } else if (validCoordinates.length > 0 && map) {
      // Auto fit bounds if no case selected
      const bounds = L.latLngBounds(validCoordinates);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [cases, selectedCaseId, onSelectCase]);

  return (
    <div className="relative w-full h-full min-h-[300px] bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <div className="absolute top-2 right-2 bg-slate-900/90 backdrop-blur px-2.5 py-1.5 rounded-lg border border-slate-700 text-[11px] font-mono text-slate-300 z-10 flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" /> CRITICAL
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block" /> HIGH
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> NORMAL
        </span>
      </div>
    </div>
  );
}
