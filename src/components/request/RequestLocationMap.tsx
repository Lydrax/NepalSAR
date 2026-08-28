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
  const onLocationSelectRef = useRef(onLocationSelect);

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
          width: 36px;
          height: 36px;
          border-radius: 9999px;
          border: 3px solid #ffffff;
          background: #b91c1c;
          color: #fff;
          font-size: 18px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.4);
          cursor: grab;
          user-select: none;
          transform: translate(-50%, -50%);
        ">📍</div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  };

  // 1. Initialize Leaflet Map ONCE on mount
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] =
      latitude !== null && longitude !== null ? [latitude, longitude] : [28.2096, 84.5];
    const initialZoom = latitude !== null && longitude !== null ? 13 : 7;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Initial marker if coordinates were passed at mount
    if (latitude !== null && longitude !== null) {
      const marker = L.marker([latitude, longitude], {
        icon: createMarkerIcon(),
        draggable: true,
      }).addTo(map);

      marker.on('dragend', (e) => {
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
      const lat = Number(event.latlng.lat.toFixed(6));
      const lng = Number(event.latlng.lng.toFixed(6));

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const newMarker = L.marker([lat, lng], {
          icon: createMarkerIcon(),
          draggable: true,
        }).addTo(map);

        newMarker.on('dragend', (e) => {
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

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount!

  // 2. Synchronize Marker & View when latitude/longitude props update from outside (e.g. GPS button)
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

      newMarker.on('dragend', (e) => {
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

    // Only adjust view if the map center is far away from the point
    const center = map.getCenter();
    const distance = Math.hypot(center.lat - latitude, center.lng - longitude);
    if (distance > 0.05 || map.getZoom() < 10) {
      map.setView(targetLatLng, Math.max(map.getZoom(), 12), { animate: true });
    }
  }, [latitude, longitude]);

  return (
    <div className="relative w-full h-full min-h-[300px] rounded-xl overflow-hidden border border-slate-300 bg-slate-100 shadow-xs flex flex-col">
      <div ref={mapContainerRef} className="w-full h-full min-h-[300px] flex-1" />
      <div className="absolute top-2 left-2 right-2 z-[400] rounded-lg border border-slate-300 bg-white/95 backdrop-blur-xs px-3 py-2 text-xs font-medium text-slate-800 shadow-xs flex items-center justify-between">
        <span>📍 Click or drag pin to position incident location.</span>
        {latitude !== null && longitude !== null && (
          <span className="font-mono text-[11px] font-bold text-red-700">
            {latitude}, {longitude}
          </span>
        )}
      </div>
    </div>
  );
}
