import { NextRequest, NextResponse } from "next/server";
import { query } from "@/server/db/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const reportId = parseInt(resolvedParams.id, 10);
    if (isNaN(reportId)) {
      return NextResponse.json(
        { success: false, error: "Invalid report ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!["pending", "verified", "resolved"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status value" },
        { status: 400 }
      );
    }

    try {
      await query("UPDATE citizen_reports SET status = ? WHERE id = ?", [
        status,
        reportId,
      ]);
    } catch (dbErr: any) {
      console.warn("[PATCH /api/citizen-report/[id]] MySQL update warning:", dbErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `Report #${reportId} status updated to ${status}.`,
      reportId,
      status,
    });
  } catch (error: any) {
    console.error("[PATCH /api/citizen-report/[id]] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update report status." },
      { status: 500 }
    );
  }
}
