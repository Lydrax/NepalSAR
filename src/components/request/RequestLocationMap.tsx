'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [28.2096, 83.9856],
      zoom: 7,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    map.on('click', (event) => {
      onLocationSelect({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
        source: 'MAP',
        accuracy: null,
        timestamp: new Date().toISOString(),
      });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [onLocationSelect]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (latitude === null || longitude === null) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.setView([28.2096, 83.9856], 7, { animate: true });
      return;
    }

    const selectedLatLng: [number, number] = [latitude, longitude];
    const icon = L.divIcon({
      className: 'request-location-marker',
      html: `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 9999px;
          border: 3px solid #f8fafc;
          background: #dc2626;
          color: #fff;
          font-size: 16px;
          box-shadow: 0 10px 24px rgba(0,0,0,0.35);
          transform: translate(-50%, -50%);
        ">📍</div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng(selectedLatLng);
      markerRef.current.setIcon(icon);
    } else {
      markerRef.current = L.marker(selectedLatLng, { icon }).addTo(map);
    }

    map.setView(selectedLatLng, Math.max(map.getZoom(), 12), { animate: true });
  }, [latitude, longitude]);

  return (
    <div className="relative w-full h-full min-h-[280px] rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute top-2 left-2 right-2 z-10 rounded-lg border border-slate-700 bg-slate-950/90 backdrop-blur px-3 py-2 text-[11px] text-slate-300 shadow-lg">
        Tap or click the map to place a pin. The selected point will be used as the rescue location.
      </div>
    </div>
  );
}
