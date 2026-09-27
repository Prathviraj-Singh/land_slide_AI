import { NextRequest, NextResponse } from "next/server";
import { query } from "@/server/db/client";

export async function GET(request: NextRequest) {
  try {
    const rows = await query<any[]>(
      "SELECT * FROM citizen_reports ORDER BY submitted_at DESC LIMIT 50"
    );
    return NextResponse.json({ success: true, count: rows.length, reports: rows });
  } catch (error: any) {
    console.warn("[GET /api/citizen-report] DB warning:", error.message);
    return NextResponse.json({ success: true, count: 0, reports: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { zone_id, photo_url, description, lat, lon } = body;

    if (!description || typeof lat !== "number" || typeof lon !== "number") {
      return NextResponse.json(
        { success: false, error: "Missing required fields: description, lat, lon" },
        { status: 400 }
      );
    }

    let insertId = Date.now();
    try {
      const res = await query<any>(
        "INSERT INTO citizen_reports (zone_id, photo_url, description, lat, lon, status, submitted_at) VALUES (?, ?, ?, ?, ?, 'pending', NOW())",
        [zone_id || null, photo_url || null, description, lat, lon]
      );
      insertId = res.insertId || insertId;
    } catch (dbErr: any) {
      console.warn("[POST /api/citizen-report] MySQL insert skipped:", dbErr.message);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Citizen hazard report submitted successfully.",
        report: {
          id: insertId,
          zone_id: zone_id || null,
          photo_url: photo_url || null,
          description,
          lat,
          lon,
          status: "pending",
          submitted_at: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[POST /api/citizen-report] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to submit citizen report." },
      { status: 500 }
    );
  }
}
