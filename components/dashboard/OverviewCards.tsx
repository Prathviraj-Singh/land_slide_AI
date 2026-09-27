"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, ShieldCheck, FileText } from "lucide-react";
import { Card } from "../ui/Card";

export interface ZoneItem {
  id: string;
  name: string;
  lat: number;
  lon: number;
  current_score: number;
  trend: "rising" | "stable" | "falling";
}

export interface OverviewCardsProps {
  zones: ZoneItem[];
  isLoading?: boolean;
}

export default function OverviewCards({ zones = [], isLoading = false }: OverviewCardsProps) {
  const [alertsCount, setAlertsCount] = useState<number>(0);
  const [reportsCount, setReportsCount] = useState<number>(0);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [alertsRes, reportsRes] = await Promise.all([
          fetch("/api/alerts").then((r) => r.json()).catch(() => ({ count: 0 })),
          fetch("/api/citizen-report").then((r) => r.json()).catch(() => ({ count: 0 })),
        ]);
        setAlertsCount(alertsRes.count || (alertsRes.alerts ? alertsRes.alerts.length : 0));
        setReportsCount(reportsRes.count || (reportsRes.reports ? reportsRes.reports.length : 0));
      } catch (err) {
        console.warn("[OverviewCards] Failed to fetch alert/report statistics:", err);
      }
    }
    fetchStats();
  }, []);

  const criticalCount = zones.filter((z) => z.current_score >= 76).length;
  const highRiskCount = zones.filter((z) => z.current_score >= 51 && z.current_score < 76).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Active Alerts */}
      <Card hoverable className="border-rose-900/40 bg-slate-900/90">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Active Warning Alerts</p>
            <h3 className="text-2xl font-black text-white mt-1">
              {isLoading ? "..." : alertsCount}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">SMTP Automated Notifications</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </Card>

      {/* Card 2: Critical Zones */}
      <Card hoverable className="border-red-900/40 bg-slate-900/90">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Critical Zones (&gt;=76)</p>
            <h3 className="text-2xl font-black text-white mt-1">
              {isLoading ? "..." : criticalCount}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Immediate Evacuation Advisory</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </Card>

      {/* Card 3: High-Risk Zones */}
      <Card hoverable className="border-amber-900/40 bg-slate-900/90">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">High Risk Zones (51-75)</p>
            <h3 className="text-2xl font-black text-white mt-1">
              {isLoading ? "..." : highRiskCount}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Active Slope Monitoring</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </Card>

      {/* Card 4: Citizen Reports */}
      <Card hoverable className="border-blue-900/40 bg-slate-900/90">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Citizen Reports</p>
            <h3 className="text-2xl font-black text-white mt-1">
              {isLoading ? "..." : reportsCount}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Crowdsourced Field Telemetry</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <FileText className="w-5 h-5" />
          </div>
        </div>
      </Card>
    </div>
  );
}
