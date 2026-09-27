"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import ReportForm from "@/components/citizen/ReportForm";

export default function CitizenReportPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
        <Link
          href="/citizen"
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base text-white">Submit Field Hazard Report</h1>
            <p className="text-xs text-slate-400">Crowdsourced Community Safety Portal</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto w-full px-6 py-12 flex-1 flex flex-col justify-center">
        <ReportForm />
      </main>
    </div>
  );
}
