"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, MapPin, AlertTriangle, Activity, ArrowRight, UserCheck, Eye } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white">
      {/* Background Glow Overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(30,58,138,0.35),rgba(255,255,255,0))]" />

      {/* Header Bar */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
              LandslideShield <span className="text-blue-500 font-mono text-sm px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">AI</span>
            </h1>
            <p className="text-xs text-slate-400">Early Warning & Risk Management Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ONNX Engine Live
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-16 flex-1 flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-4 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 mb-2">
            <Activity className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            Real-time Telemetry: Weather • Soil Saturation • DEM Slope • NASA History
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            AI-Powered Disaster Intelligence for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">High-Risk Slope Zones</span>
          </h2>

          <p className="text-base text-slate-400 leading-relaxed">
            Predict landslide hazards up to 7 days in advance. Dedicated monitoring workflows for emergency response authorities and instant advisory access for citizens.
          </p>
        </motion.div>

        {/* Portal Choice Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid sm:grid-cols-2 gap-8 w-full max-w-4xl mt-12 text-left"
        >
          {/* Authority Portal Card */}
          <Link href="/authority" className="group">
            <div className="h-full p-8 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800 hover:border-blue-500/60 shadow-xl hover:shadow-blue-500/10 transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <UserCheck className="w-32 h-32 text-blue-400" />
              </div>

              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                  Authority Dashboard
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Full-screen interactive hazard map, ML risk score updates, SHAP factor breakdown, OSM infrastructure exposure, and SMTP emergency email alerts.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 group-hover:translate-x-1 transition-transform">
                Enter Authority Portal <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Link>

          {/* Citizen View Card */}
          <Link href="/citizen" className="group">
            <div className="h-full p-8 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800 hover:border-emerald-500/60 shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <Eye className="w-32 h-32 text-emerald-400" />
              </div>

              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                  <Eye className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                  Citizen Advisory View
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Simplified safety badges (Safe, Watch, Warning, Critical), clear local safety guidelines, GPS hazard report submissions, and direct community alerts.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
                Check Safety Advisory <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Feature Pill Grid */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl text-xs font-mono text-slate-400">
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 flex items-center justify-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400" /> 20 Indian Mountain Zones
          </div>
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 flex items-center justify-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" /> Open-Meteo 7-Day Rainfall
          </div>
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" /> ONNX Model Runtime
          </div>
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" /> Automated SMTP Alerts
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 py-6 text-center text-xs text-slate-500 font-mono">
        LandslideShield AI • Built with Next.js 14 App Router, TypeScript & ONNX Runtime
      </footer>
    </div>
  );
}
