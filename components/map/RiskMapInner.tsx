"use client";

import React, { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { RiskMapProps, ZoneMarkerData } from "./RiskMap";

// Fix Leaflet default icon paths in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function getScoreColor(score: number): string {
  if (score >= 76) return "#f43f5e";
  if (score >= 51) return "#f97316";
  if (score >= 26) return "#f59e0b";
  return "#10b981";
}

function MapViewController({ selectedZone }: { selectedZone?: ZoneMarkerData | null }) {
  const map = useMap();
  useEffect(() => {
    if (selectedZone) {
      map.flyTo([selectedZone.lat, selectedZone.lon], 9, { duration: 1.2 });
    }
  }, [selectedZone, map]);
  return null;
}

export default function RiskMapInner({
  zones = [],
  selectedZoneId,
  onSelectZone,
  layers,
}: RiskMapProps) {
  const selectedZone = zones.find((z) => z.id === selectedZoneId);
  const showRiskMarkers = layers ? layers.currentRisk : true;

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={[23.5937, 78.9629]}
        zoom={5}
        scrollWheelZoom={true}
        className="w-full h-full bg-slate-950"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          className="osm-dark-filter"
        />

        <MapViewController selectedZone={selectedZone} />

        {showRiskMarkers &&
          zones.map((zone) => {
            const isSelected = zone.id === selectedZoneId;
            const color = getScoreColor(zone.current_score);
            const radius = isSelected ? 14 : 10;

            return (
              <CircleMarker
                key={zone.id}
                center={[zone.lat, zone.lon]}
                radius={radius}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.85,
                  color: isSelected ? "#ffffff" : color,
                  weight: isSelected ? 3 : 1.5,
                }}
                eventHandlers={{ click: () => onSelectZone(zone.id) }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={0.9} permanent={false}>
                  <div className="font-sans text-xs">
                    <strong className="block font-bold">{zone.name}</strong>
                    <span className="text-slate-400">Risk Score: </span>
                    <span style={{ color }} className="font-bold">
                      {zone.current_score} / 100
                    </span>
                  </div>
                </Tooltip>

                <Popup className="custom-leaflet-popup">
                  <div className="p-1 font-sans text-xs">
                    <h4 className="font-bold text-slate-900">{zone.name}</h4>
                    <p className="text-slate-600 text-[11px] my-1">
                      Coordinates: {zone.lat.toFixed(4)}, {zone.lon.toFixed(4)}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                      <span className="font-bold" style={{ color }}>
                        Score: {zone.current_score}
                      </span>
                      <button
                        onClick={() => onSelectZone(zone.id)}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-medium"
                      >
                        Inspect Zone &rarr;
                      </button>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
      </MapContainer>
    </div>
  );
}
