import { NextRequest, NextResponse } from "next/server";
import { query } from "@/server/db/client";
import { INITIAL_ZONES } from "@/server/db/seedZones";

export async function GET(request: NextRequest) {
  try {
    const rows = await query<any[]>("SELECT * FROM zones ORDER BY current_score DESC");
    
    if (rows && rows.length > 0) {
      const zones = rows.map((r) => ({
        id: r.id,
        name: r.name,
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        current_score: r.current_score,
        trend: r.trend,
        last_updated: r.last_updated,
      }));
      return NextResponse.json({ success: true, count: zones.length, zones });
    }

    // Fallback if database is not yet seeded
    const fallbackZones = INITIAL_ZONES.map((z, idx) => ({
      ...z,
      current_score: 45 + (idx % 30),
      trend: idx % 3 === 0 ? "rising" : idx % 3 === 1 ? "stable" : "falling",
      last_updated: new Date().toISOString(),
    }));

    return NextResponse.json({
      success: true,
      count: fallbackZones.length,
      zones: fallbackZones,
      note: "Loaded initial monitored zones (database pending seed).",
    });
  } catch (error: any) {
    console.error("[GET /api/zones] Error:", error.message);
    
    // Graceful fallback response on DB connection failure
    const fallbackZones = INITIAL_ZONES.map((z, idx) => ({
      ...z,
      current_score: 50 + (idx % 25),
      trend: "stable",
      last_updated: new Date().toISOString(),
    }));

    return NextResponse.json(
      {
        success: true,
        count: fallbackZones.length,
        zones: fallbackZones,
        warning: "MySQL offline -- using local seed fallback.",
      },
      { status: 200 }
    );
  }
}
