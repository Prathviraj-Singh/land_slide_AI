"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import "leaflet/dist/leaflet.css";

export interface ZoneMarkerData {
  id: string;
  name: string;
  lat: number;
  lon: number;
  current_score: number;
  trend: "rising" | "stable" | "falling";
}

export interface MapLayersState {
  currentRisk: boolean;
  rainfall: boolean;
  soilMoisture: boolean;
  landslideHistory: boolean;
  roads: boolean;
  settlements: boolean;
}

export interface RiskMapProps {
  zones: ZoneMarkerData[];
  selectedZoneId?: string | null;
  onSelectZone: (zoneId: string) => void;
  layers?: MapLayersState;
}

// Dynamically import Leaflet MapContainer — ssr: false is *required*.
// Leaflet accesses `window` and `document` at module-parse time; if Next.js
// tries to SSR this module it throws. ssr: false also eliminates the
// server-client HTML mismatch that can trigger a second client-side hydration
// mount (another source of "already initialized" errors).
const MapInner = dynamic(() => import("./RiskMapInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-xs font-mono text-slate-500 gap-2">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      Initializing Interactive Map Canvas...
    </div>
  ),
});

/**
 * RiskMap — thin wrapper around the dynamically-loaded Leaflet map.
 *
 * `key` is derived from `usePathname()` so React re-mounts MapInner exactly
 * once per navigation — never on a zone-selection re-render or data refresh.
 * Combined with LeafletCleanup inside RiskMapInner, this guarantees that each
 * new mount finds a clean container with no residual `_leaflet_*` properties.
 */
export default function RiskMap(props: RiskMapProps) {
  const pathname = usePathname();
  // Stable key: changes only when the route changes, not on prop updates.
  return <MapInner key={`risk-map-${pathname}`} {...props} />;
}
