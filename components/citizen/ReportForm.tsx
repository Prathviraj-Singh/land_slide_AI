"use client";

import React, { useState, useEffect } from "react";
import { Navigation, Camera, CheckCircle2, AlertCircle, Send, MapPin } from "lucide-react";
import { Button } from "../ui/Button";

export interface ZoneOption {
  id: string;
  name: string;
}

export default function ReportForm() {
  const [description, setDescription] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [zoneId, setZoneId] = useState<string>("");
  const [zones, setZones] = useState<ZoneOption[]>([]);

  const [isGettingGps, setIsGettingGps] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedReport, setSubmittedReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch zone options
    fetch("/api/zones")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.zones) {
          setZones(d.zones);
        }
      })
      .catch(() => {});

    // Try auto-capturing GPS coordinates on load
    handleCaptureGps();
  }, []);

  function handleCaptureGps() {
    if (!navigator.geolocation) {
      setError("Browser geolocation is not supported.");
      return;
    }
    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(parseFloat(pos.coords.latitude.toFixed(6)));
        setLon(parseFloat(pos.coords.longitude.toFixed(6)));
        setIsGettingGps(false);
      },
      (err) => {
        console.warn("[ReportForm] Geolocation notice:", err.message);
        // Fallback default coordinates (Wayanad)
        setLat(11.5540);
        setLon(76.1300);
        setIsGettingGps(false);
      }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please provide a description of the hazard.");
      return;
    }
    if (lat === null || lon === null) {
      setError("Geospatial location is required. Please capture GPS coordinates.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/citizen-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone_id: zoneId || null,
          photo_url: photoUrl || null,
          description,
          lat,
          lon,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSubmittedReport(json.report);
      } else {
        throw new Error(json.error || "Submission failed.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit hazard report.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submittedReport) {
    return (
      <div className="p-8 rounded-3xl bg-slate-900 border border-emerald-500/30 text-center space-y-6 shadow-2xl backdrop-blur-xl">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-white">Hazard Report Submitted</h3>
          <p className="text-xs text-slate-400">
            Thank you for contributing to community safety! Your report has been dispatched to emergency response teams.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left text-xs font-mono space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Report ID:</span>
            <span className="text-white font-bold">#{submittedReport.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Verification Status:</span>
            <span className="text-amber-400 font-bold uppercase">{submittedReport.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Coordinates:</span>
            <span className="text-slate-300">{submittedReport.lat}, {submittedReport.lon}</span>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            setSubmittedReport(null);
            setDescription("");
            setPhotoUrl("");
          }}
          className="w-full"
        >
          Submit Another Hazard Report
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl space-y-6">
      <div className="space-y-1">
        <h3 className="text-xl font-bold text-white">Report Slope Hazard or Movement</h3>
        <p className="text-xs text-slate-400">Submit crowdsourced field observations to alert authority monitoring teams.</p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
          Hazard Observation / Description <span className="text-rose-400">*</span>
        </label>
        <textarea
          rows={4}
          required
          placeholder="Describe observed cracks, mud accumulation, rockfalls, or road blockage..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
        />
      </div>

      {/* Zone selection optional */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
          Monitored District (Optional)
        </label>
        <select
          value={zoneId}
          onChange={(e) => setZoneId(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">-- Auto-Detect / Unassigned --</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      </div>

      {/* Photo URL */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-blue-400" /> Photo URL / Attachment Link
        </label>
        <input
          type="url"
          placeholder="https://example.com/field-photo.jpg"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* GPS Location Capture */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Navigation className="w-4 h-4 text-blue-400" />
            GPS Location Coordinates
          </div>
          <button
            type="button"
            onClick={handleCaptureGps}
            disabled={isGettingGps}
            className="text-xs text-blue-400 hover:underline font-mono"
          >
            {isGettingGps ? "Acquiring..." : "Refresh GPS"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Latitude</span>
            <span className="text-white font-bold">{lat !== null ? lat : "Not set"}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Longitude</span>
            <span className="text-white font-bold">{lon !== null ? lon : "Not set"}</span>
          </div>
        </div>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isSubmitting}
        className="w-full bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20 flex items-center gap-2"
      >
        <Send className="w-4 h-4" /> Submit Report to Authority
      </Button>
    </form>
  );
}
