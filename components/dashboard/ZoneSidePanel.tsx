"use client";

import React, { useEffect, useState } from "react";
import { X, RefreshCcw, TrendingUp, TrendingDown, Minus, MapPin, Building, GraduationCap, Navigation } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export interface ZoneSidePanelProps {
  zoneId: string | null;
  onClose: () => void;
  onScoreUpdated?: () => void;
}

export default function ZoneSidePanel({ zoneId, onClose, onScoreUpdated }: ZoneSidePanelProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchDetail(id: string) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/risk-score?zoneId=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        throw new Error(json.error || "Failed to load zone detail.");
      }
    } catch (err: any) {
      console.warn(`[ZoneSidePanel] Error fetching detail for ${id}:`, err.message);
      setError("Unable to load live details for this zone.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRecalculate() {
    if (!zoneId) return;
    setIsUpdating(true);
    try {
      const res = await fetch("/api/risk-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneId }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchDetail(zoneId);
        if (onScoreUpdated) onScoreUpdated();
      } else {
        throw new Error(json.error || "Recalculation failed.");
      }
    } catch (err: any) {
      alert(`Recalculation failed: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  }

  useEffect(() => {
    if (zoneId) {
      fetchDetail(zoneId);
    } else {
      setData(null);
    }
  }, [zoneId]);

  if (!zoneId) return null;

  const score = data?.zone?.current_score ?? 0;
  const trend = data?.zone?.trend ?? "stable";

  let level: "Safe" | "Watch" | "Warning" | "Critical" = "Safe";
  let actionText = "Normal conditions. Continue standard monitoring.";
  let badgeColor = "LOW";

  if (score >= 76) {
    level = "Critical";
    badgeColor = "CRITICAL";
    actionText = "CRITICAL HAZARD: Immediate evacuation advisory recommended. Alert emergency response personnel and issue local siren/SMS warnings.";
  } else if (score >= 51) {
    level = "Warning";
    badgeColor = "HIGH";
    actionText = "WARNING ALERT: High probability of slope instability. Restrict heavy traffic on mountain passes and notify field inspectors.";
  } else if (score >= 26) {
    level = "Watch";
    badgeColor = "MODERATE";
    actionText = "ELEVATED WATCH: Rainfall accumulation increasing. Inspect drainage channels and monitor soil saturation gauges.";
  }

  const factors = data?.riskFactors || {
    rainfall_pct: 35,
    soil_pct: 25,
    slope_pct: 20,
    history_pct: 20,
  };

  const assets = data?.impactedAssets || { roads: [], schools: [], settlements: [] };

  return (
    <>
      {/* Click-to-close Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-slate-950/95 border-l border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col justify-between text-slate-100 transition-all duration-300">
      {/* Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-400" />
          <h2 className="font-bold text-lg text-white truncate max-w-[320px]">
            {data?.zone?.name || "Zone Detail"}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {isLoading ? (
          <div className="py-20 text-center text-xs font-mono text-slate-500 flex flex-col items-center gap-3">
            <RefreshCcw className="w-6 h-6 animate-spin text-blue-400" />
            Connecting to live telemetry & ONNX engine...
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 text-center">
            {error}
          </div>
        ) : (
          <>
            {/* Score & Trend Hero */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Risk Score</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-4xl font-extrabold text-white">{score}</span>
                  <span className="text-sm font-medium text-slate-400">/ 100</span>

                  {trend === "rising" && (
                    <span className="flex items-center text-xs font-bold text-rose-400 gap-1 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      <TrendingUp className="w-3.5 h-3.5" /> Rising
                    </span>
                  )}
                  {trend === "falling" && (
                    <span className="flex items-center text-xs font-bold text-emerald-400 gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <TrendingDown className="w-3.5 h-3.5" /> Falling
                    </span>
                  )}
                  {trend === "stable" && (
                    <span className="flex items-center text-xs font-bold text-slate-400 gap-1 bg-slate-800 px-2 py-0.5 rounded">
                      <Minus className="w-3.5 h-3.5" /> Stable
                    </span>
                  )}
                </div>
              </div>

              <Badge level={badgeColor}>{level}</Badge>
            </div>

            {/* Recommended Action */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Recommended Authority Action
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">{actionText}</p>
            </div>

            {/* SHAP Factor Breakdown % */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                SHAP Risk Factor Contribution (%)
              </h4>

              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Rainfall Accumulation</span>
                    <span className="font-mono text-blue-400 font-bold">{factors.rainfall_pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${factors.rainfall_pct}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Soil Moisture Saturation</span>
                    <span className="font-mono text-cyan-400 font-bold">{factors.soil_pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${factors.soil_pct}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">DEM Terrain Slope</span>
                    <span className="font-mono text-amber-400 font-bold">{factors.slope_pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${factors.slope_pct}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">NASA History Susceptibility</span>
                    <span className="font-mono text-purple-400 font-bold">{factors.history_pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${factors.history_pct}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Impacted Infrastructure Assets within 2km */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Impacted Infrastructure Assets (&lt;2km)</span>
                <span className="text-slate-500 font-mono text-[11px]">{assets.roads?.length + assets.schools?.length + assets.settlements?.length || 0} Found</span>
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {assets.roads?.map((r: any, idx: number) => (
                  <div key={`r-${idx}`} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center gap-2.5">
                    <Navigation className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-slate-200 truncate">{r.name}</span>
                    <span className="ml-auto text-[10px] text-slate-500 font-mono">Highway</span>
                  </div>
                ))}

                {assets.schools?.map((s: any, idx: number) => (
                  <div key={`s-${idx}`} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center gap-2.5">
                    <GraduationCap className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-slate-200 truncate">{s.name}</span>
                    <span className="ml-auto text-[10px] text-slate-500 font-mono">School</span>
                  </div>
                ))}

                {assets.settlements?.map((v: any, idx: number) => (
                  <div key={`v-${idx}`} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center gap-2.5">
                    <Building className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-200 truncate">{v.name}</span>
                    <span className="ml-auto text-[10px] text-slate-500 font-mono">Settlement</span>
                  </div>
                ))}

                {(!assets.roads?.length && !assets.schools?.length && !assets.settlements?.length) && (
                  <div className="p-3 text-center text-xs text-slate-500 bg-slate-900/50 rounded-lg">
                    No major infrastructure listed in immediate 2km radius.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Action */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRecalculate}
          isLoading={isUpdating}
          className="w-full flex items-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" /> Recalculate Risk Score
        </Button>
      </div>
    </div>
  </>
  );
}
