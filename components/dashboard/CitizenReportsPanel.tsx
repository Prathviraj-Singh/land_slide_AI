"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, CheckCircle, ShieldCheck, Clock, MapPin, FileText } from "lucide-react";

export interface CitizenReport {
  id: number;
  zone_id: string | null;
  photo_url: string | null;
  description: string;
  lat: number;
  lon: number;
  status: "pending" | "verified" | "resolved";
  submitted_at: string;
}

function StatusBadge({ status }: { status: CitizenReport["status"] }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-500/10 text-amber-400 border-amber-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Pending
      </span>
    );
  }
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-500/10 text-blue-400 border-blue-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      Resolved
    </span>
  );
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

interface ReportCardProps {
  report: CitizenReport;
  onStatusChange: (id: number, status: "verified" | "resolved") => Promise<void>;
}

function ReportCard({ report, onStatusChange }: ReportCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  async function handleAction(e: React.MouseEvent, status: "verified" | "resolved") {
    e.stopPropagation();
    setIsUpdating(true);
    setUpdateError(null);
    try {
      await onStatusChange(report.id, status);
    } catch (err: any) {
      setUpdateError(err.message || "Failed to update status.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div
      id={`citizen-report-card-${report.id}`}
      onClick={() => setExpanded((prev) => !prev)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded((prev) => !prev);
        }
      }}
      className={`rounded-xl border transition-all duration-200 cursor-pointer ${
        expanded
          ? "border-blue-500/50 bg-slate-800/90 shadow-lg shadow-blue-500/10"
          : "border-slate-800 bg-slate-900/80 hover:border-blue-500/50 hover:bg-slate-800/90 hover:shadow-md hover:shadow-blue-500/5"
      }`}
    >
      {/* Card Header */}
      <div className="w-full text-left p-4 flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
          <FileText className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200 font-medium line-clamp-2 leading-snug">
            {report.description}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <MapPin className="w-3 h-3 text-blue-400" />
              {Number(report.lat).toFixed(4)}, {Number(report.lon).toFixed(4)}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Clock className="w-3 h-3 text-slate-500" />
              {formatDate(report.submitted_at)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <StatusBadge status={report.status} />
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded Detail View */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-3">
          {/* Full description */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Full Description
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">{report.description}</p>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-700/50">
              <p className="text-slate-500 mb-1">Coordinates</p>
              <p className="text-slate-200 font-mono">
                {Number(report.lat).toFixed(6)}, {Number(report.lon).toFixed(6)}
              </p>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-700/50">
              <p className="text-slate-500 mb-1">Report ID</p>
              <p className="text-slate-200 font-mono">#{report.id}</p>
            </div>
            {report.zone_id && (
              <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-700/50 col-span-2">
                <p className="text-slate-500 mb-1">Linked Zone</p>
                <p className="text-slate-200 font-mono">{report.zone_id}</p>
              </div>
            )}
          </div>

          {/* Photo thumbnail */}
          {report.photo_url && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Attached Photo
              </p>
              <img
                src={report.photo_url}
                alt="Hazard site photo"
                className="rounded-lg border border-slate-700 max-h-48 w-auto object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}

          {/* Error */}
          {updateError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {updateError}
            </p>
          )}

          {/* Action buttons */}
          {report.status !== "resolved" && (
            <div className="flex items-center gap-2 pt-1">
              {report.status !== "verified" && (
                <button
                  id={`btn-verify-report-${report.id}`}
                  type="button"
                  disabled={isUpdating}
                  onClick={(e) => handleAction(e, "verified")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-400 border border-blue-500/40 hover:bg-blue-600/40 hover:text-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {isUpdating ? "Updating…" : "Mark Verified"}
                </button>
              )}
              <button
                id={`btn-resolve-report-${report.id}`}
                type="button"
                disabled={isUpdating}
                onClick={(e) => handleAction(e, "resolved")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/40 hover:text-emerald-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {isUpdating ? "Updating…" : "Mark Resolved"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CitizenReportsPanel() {
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/citizen-report");
      const data = await res.json();
      if (data.success) {
        setReports(data.reports || []);
      } else {
        throw new Error(data.error || "Failed to load reports.");
      }
    } catch (err: any) {
      setError(err.message || "Unable to load citizen reports.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  async function handleStatusChange(id: number, status: "verified" | "resolved") {
    const res = await fetch(`/api/citizen-report/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "Status update failed.");
    }
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  }

  const pendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 shadow-2xl overflow-hidden">
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Citizen Field Reports</p>
            <p className="text-[11px] text-slate-400">Crowdsourced hazard telemetry from the field</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {pendingCount} Pending Review
            </span>
          )}
          <button
            id="citizen-reports-refresh-btn"
            type="button"
            onClick={fetchReports}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh reports"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading citizen reports…</span>
          </div>
        )}

        {!isLoading && error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!isLoading && !error && reports.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
            <FileText className="w-8 h-8 opacity-40" />
            <p className="text-sm">No citizen reports submitted yet.</p>
          </div>
        )}

        {!isLoading && !error && reports.length > 0 && (
          <div
            className="space-y-3 overflow-y-auto pr-1"
            style={{ maxHeight: "500px" }}
          >
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
