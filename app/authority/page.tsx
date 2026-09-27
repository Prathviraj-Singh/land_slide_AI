"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, RefreshCw, ArrowLeft, Layers, MapPin } from "lucide-react";
import OverviewCards, { ZoneItem } from "@/components/dashboard/OverviewCards";
import RiskMap from "@/components/map/RiskMap";
import MapLayerToggle, { MapLayersState } from "@/components/map/MapLayerToggle";
import ZoneSidePanel from "@/components/dashboard/ZoneSidePanel";
import RiskTrendChart from "@/components/dashboard/RiskTrendChart";
import CitizenReportsPanel from "@/components/dashboard/CitizenReportsPanel";
import { Button } from "@/components/ui/Button";

export default function AuthorityDashboardPage() {
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showLayerToggle, setShowLayerToggle] = useState<boolean>(false);

  const [layers, setLayers] = useState<MapLayersState>({
    currentRisk: true,
    rainfall: true,
    soilMoisture: true,
    landslideHistory: true,
    roads: true,
    settlements: true,
  });

  async function fetchZones() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/zones");
      const data = await res.json();
      if (data.success && data.zones) {
        setZones(data.zones);
      }
    } catch (err) {
      console.warn("[AuthorityDashboard] Error fetching zones:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchZones();
  }, []);

  const handleToggleLayer = (key: keyof MapLayersState) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between z-30 sticky top-0">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Back to Landing Page"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base text-white flex items-center gap-2">
                Authority Monitoring Dashboard
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Live ONNX Operations
                </span>
              </h1>
              <p className="text-xs text-slate-400">Indian Mountain Range & Western Ghats Surveillance</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLayerToggle((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              showLayerToggle
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Layers className="w-4 h-4" /> Map Layers
          </button>

          <Button variant="outline" size="sm" onClick={fetchZones} isLoading={isLoading} className="flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Sync All Zones
          </Button>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <main className="flex-1 p-6 space-y-6 max-w-[1800px] w-full mx-auto">
        {/* KPI Overview Cards */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <OverviewCards zones={zones} isLoading={isLoading} />
        </motion.div>

        {/* Central Grid: Map + Trend Chart */}
        <div className="grid lg:grid-cols-12 gap-6 h-[640px]">
          {/* Map Column */}
          <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden relative shadow-2xl flex flex-col">
            <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10">
              <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>Geospatial Risk Surface Map</span>
                <span className="text-slate-500">• Click any marker to open detailed panel</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {zones.length} Zones Monitored
              </span>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative z-0">
              <RiskMap
                zones={zones}
                selectedZoneId={selectedZoneId}
                onSelectZone={(id) => setSelectedZoneId(id)}
                layers={layers}
              />

              {/* Map Layer Controls Floating Overlay */}
              {showLayerToggle && (
                <div className="absolute top-4 right-4 z-20">
                  <MapLayerToggle layers={layers} onToggle={handleToggleLayer} />
                </div>
              )}
            </div>
          </div>

          {/* Time Series Trend Column */}
          <div className="lg:col-span-4 flex flex-col h-full">
            <RiskTrendChart
              zoneId={selectedZoneId || (zones[0]?.id ?? "")}
              zoneName={selectedZone?.name}
            />
          </div>
        </div>

        {/* Citizen Field Hazard Reports Section */}
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Citizen Field Reports
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Crowdsourced Telemetry
              </span>
            </h2>
          </div>
          <CitizenReportsPanel />
        </section>
      </main>

      {/* Slide-Out Zone Detail Panel */}
      <ZoneSidePanel
        zoneId={selectedZoneId}
        onClose={() => setSelectedZoneId(null)}
        onScoreUpdated={fetchZones}
      />
    </div>
  );
}
