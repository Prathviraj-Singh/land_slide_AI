"use client";

import React from "react";
import { Layers, Check } from "lucide-react";

export interface MapLayersState {
  currentRisk: boolean;
  rainfall: boolean;
  soilMoisture: boolean;
  landslideHistory: boolean;
  roads: boolean;
  settlements: boolean;
}

export interface MapLayerToggleProps {
  layers: MapLayersState;
  onToggle: (layerKey: keyof MapLayersState) => void;
}

export default function MapLayerToggle({ layers, onToggle }: MapLayerToggleProps) {
  const layerLabels: { key: keyof MapLayersState; label: string; color: string }[] = [
    { key: "currentRisk", label: "Current Risk Level", color: "bg-rose-500" },
    { key: "rainfall", label: "7-Day Rainfall Accumulation", color: "bg-blue-500" },
    { key: "soilMoisture", label: "Soil Saturation Index", color: "bg-cyan-500" },
    { key: "landslideHistory", label: "NASA Historical Events", color: "bg-purple-500" },
    { key: "roads", label: "Mountain Highways & Roads", color: "bg-amber-500" },
    { key: "settlements", label: "Villages & Settlements", color: "bg-emerald-500" },
  ];

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 shadow-xl backdrop-blur-md text-slate-200 w-64 text-xs space-y-2">
      <div className="flex items-center gap-2 font-bold text-slate-100 pb-1.5 border-b border-slate-800">
        <Layers className="w-4 h-4 text-blue-400" />
        Map Layer Controls
      </div>

      <div className="space-y-1.5 pt-1">
        {layerLabels.map(({ key, label, color }) => {
          const isActive = layers[key];
          return (
            <button
              key={key}
              onClick={() => onToggle(key)}
              className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors text-left ${
                isActive ? "bg-slate-800/80 text-white font-medium" : "hover:bg-slate-900/60 text-slate-400"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span>{label}</span>
              </div>

              {isActive && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
