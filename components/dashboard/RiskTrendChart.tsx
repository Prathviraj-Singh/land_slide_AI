"use client";

import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp, RefreshCw } from "lucide-react";
import { Card } from "../ui/Card";

export interface RiskTrendChartProps {
  zoneId: string;
  zoneName?: string;
}

export default function RiskTrendChart({ zoneId, zoneName }: RiskTrendChartProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchHistory() {
    if (!zoneId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/zones/${encodeURIComponent(zoneId)}/history`);
      const data = await res.json();
      if (data.success && data.history) {
        setHistory(data.history);
      } else {
        throw new Error(data.error || "Failed to load risk history.");
      }
    } catch (err: any) {
      console.warn(`[RiskTrendChart] Error fetching history for zone ${zoneId}:`, err.message);
      setError("Unable to load time-series history for this zone.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, [zoneId]);

  return (
    <Card className="bg-slate-900/90 border-slate-800 p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            Risk Score Trend History
          </h3>
          <p className="text-xs text-slate-400">
            {zoneName ? `Time-series progression for ${zoneName}` : "Time-series score progression"}
          </p>
        </div>
        <button
          onClick={fetchHistory}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-xs flex items-center gap-1"
          title="Refresh Trend"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center text-xs font-mono text-slate-500">
          Loading time-series data...
        </div>
      ) : error ? (
        <div className="h-48 flex flex-col items-center justify-center text-xs text-rose-400 gap-2">
          <span>{error}</span>
          <button onClick={fetchHistory} className="text-blue-400 underline">Retry</button>
        </div>
      ) : history.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-xs text-slate-500">
          No historical evaluation runs recorded yet.
        </div>
      ) : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#f8fafc",
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                name="Risk Score"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#3b82f6" }}
                activeDot={{ r: 6, fill: "#60a5fa" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
