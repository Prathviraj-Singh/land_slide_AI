"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Search, MapPin, ArrowLeft, AlertCircle, CheckCircle, AlertTriangle, FilePlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface ZoneOption {
  id: string;
  name: string;
  lat: number;
  lon: number;
  current_score: number;
  trend: string;
}

export default function CitizenPage() {
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchZones() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/zones");
        const data = await res.json();
        if (data.success && data.zones) {
          setZones(data.zones);
          if (data.zones.length > 0) {
            setSelectedZoneId(data.zones[0].id);
          }
        }
      } catch (err) {
        console.warn("[CitizenPage] Failed to fetch zones:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchZones();
  }, []);

  const filteredZones = zones.filter((z) =>
    z.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentZone = zones.find((z) => z.id === selectedZoneId) || zones[0];
  const score = currentZone ? currentZone.current_score : 20;

  let badgeLabel = "Safe";
  let badgeLevel = "LOW";
  let colorTheme = "emerald";
  let advice = "No landslide warnings active in your region. Weather conditions are stable.";

  if (score >= 76) {
    badgeLabel = "Critical Risk";
    badgeLevel = "CRITICAL";
    colorTheme = "rose";
    advice = "DANGER: High risk of slope failure! Stay away from steep mountain hillsides and riverbanks. Follow instructions from local emergency officers immediately.";
  } else if (score >= 51) {
    badgeLabel = "Warning";
    badgeLevel = "HIGH";
    colorTheme = "orange";
    advice = "WARNING: Heavy rainfall and high soil moisture detected. Avoid non-essential travel on mountain highways and watch for falling rocks.";
  } else if (score >= 26) {
    badgeLabel = "Watch";
    badgeLevel = "MODERATE";
    colorTheme = "amber";
    advice = "WATCH: Moderate slope risk due to rain. Keep emergency contact numbers handy and stay informed of local weather broadcasts.";
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base text-white">Citizen Safety Advisory</h1>
              <p className="text-xs text-slate-400">Community Landslide Hazard Information</p>
            </div>
          </div>
        </div>

        <Link href="/citizen/report">
          <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1.5 shadow-emerald-600/20">
            <FilePlus className="w-4 h-4" /> Report Hazard
          </Button>
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full px-6 py-12 space-y-8 flex-1">
        {/* Search & Area Selector */}
        <div className="space-y-3 text-center">
          <h2 className="text-2xl font-extrabold text-white">Check Your Area Safety Status</h2>
          <p className="text-xs text-slate-400">Select your mountain district or region to view real-time safety advisories.</p>

          <div className="max-w-md mx-auto relative mt-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search area (e.g. Wayanad, Shimla, Darjeeling)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Area Selector Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 max-h-32 overflow-y-auto">
            {isLoading ? (
              <span className="text-xs font-mono text-slate-500">Loading areas...</span>
            ) : filteredZones.length === 0 ? (
              <span className="text-xs text-slate-500">No areas found matching search.</span>
            ) : (
              filteredZones.map((z) => {
                const isActive = z.id === selectedZoneId;
                return (
                  <button
                    key={z.id}
                    onClick={() => setSelectedZoneId(z.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                        : "bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <MapPin className="w-3 h-3" />
                    {z.name}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Big Safety Badge & Advisory Box */}
        {currentZone && (
          <motion.div
            key={currentZone.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="rounded-3xl bg-slate-900/90 border border-slate-800 p-8 shadow-2xl text-center space-y-6 backdrop-blur-xl relative overflow-hidden"
          >
            {/* Top Indicator Accent */}
            <div className="flex items-center justify-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-slate-300">{currentZone.name}</span>
            </div>

            {/* Big Risk Level Badge */}
            <div className="py-6 flex flex-col items-center justify-center gap-3">
              <div className="text-xs uppercase font-mono tracking-widest text-slate-400">Current Safety Status</div>

              <div className="inline-block">
                <Badge level={badgeLevel} className="text-lg px-6 py-2">
                  {badgeLabel}
                </Badge>
              </div>

              <div className="text-xs font-mono text-slate-500">
                Risk Index: <span className="font-bold text-white">{score}</span> / 100
              </div>
            </div>

            {/* Plain Language Safety Guidance */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                {score >= 51 ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
                Recommended Safety Advice
              </h3>
              <p className="text-sm text-slate-200 leading-relaxed font-medium">{advice}</p>
            </div>

            {/* Emergency Contacts Footer */}
            <div className="grid grid-cols-2 gap-4 text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-900">
                <span className="block font-bold text-white">Disaster Helpline</span> 1077 (Toll-Free)
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-900">
                <span className="block font-bold text-white">Emergency Services</span> 112
              </div>
            </div>
          </motion.div>
        )}

        {/* Report Hazard Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-900/30 via-slate-900 to-slate-900 border border-emerald-800/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-bold text-white text-base">Spotted cracks or earth movement?</h4>
            <p className="text-xs text-slate-400">Submit a crowdsourced hazard report with photo and live GPS location to alert local authorities.</p>
          </div>
          <Link href="/citizen/report">
            <Button variant="primary" size="md" className="bg-emerald-600 hover:bg-emerald-500 whitespace-nowrap">
              Submit Report &rarr;
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
