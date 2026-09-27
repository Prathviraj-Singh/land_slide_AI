import { NextRequest, NextResponse } from "next/server";
import { updateZoneRiskScore, getZoneDetail } from "@/server/services/riskScoreService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get("zoneId") || searchParams.get("id");

    if (!zoneId) {
      return NextResponse.json(
        { success: false, error: "Missing required query parameter: zoneId" },
        { status: 400 }
      );
    }

    const detail = await getZoneDetail(zoneId);
    return NextResponse.json({ success: true, ...detail });
  } catch (error: any) {
    console.error("[GET /api/risk-score] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve zone detail." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const zoneId = body.zoneId || body.id;

    if (!zoneId) {
      return NextResponse.json(
        { success: false, error: "Missing required field: zoneId" },
        { status: 400 }
      );
    }

    const updateResult = await updateZoneRiskScore(zoneId);
    return NextResponse.json({
      success: true,
      message: `Risk score updated for zone ${zoneId}`,
      ...updateResult,
    });
  } catch (error: any) {
    console.error("[POST /api/risk-score] Error updating score:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to recalculate risk score." },
      { status: 500 }
    );
  }
}
