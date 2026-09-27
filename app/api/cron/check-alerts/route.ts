/**
 * Periodic Cron Check-Alerts API Route.
 *
 * URL: GET /api/cron/check-alerts
 *
 * PURPOSE
 * -------
 * This route evaluates all monitored zones for critical risk thresholds,
 * dispatches emergency alert emails when scores exceed 76, and refreshes
 * risk scores for every zone from live external data sources.
 *
 * HOW TO SCHEDULE (Hostinger hPanel)
 * ------------------------------------
 * Because this app is deployed as a Node.js process on Hostinger (not as a
 * serverless platform with built-in scheduler), a standalone always-on background
 * scheduler is not used. Instead, configure a Cron Job in Hostinger hPanel:
 *
 *  1. Log in to hPanel → Advanced → Cron Jobs.
 *  2. Set the cron expression to every 30 minutes:   * /30 * * * *
 *     or every 60 minutes:                             0 * * * *
 *  3. Set the command to:
 *       curl -s -X GET "https://yourdomain.com/api/cron/check-alerts" > /dev/null 2>&1
 *     (replace yourdomain.com with your actual deployment domain)
 *  4. Save. Hostinger's cron daemon will call this URL on schedule.
 *
 * SECURITY
 * --------
 * The route accepts an optional CRON_SECRET header (or ?secret= query param)
 * to prevent unauthorized external triggering. Set CRON_SECRET in your .env.
 * If CRON_SECRET is not configured in env, the check is skipped (open during
 * local development).
 *
 * WHAT IT DOES
 * ------------
 * 1. checkAndSendAlerts() — scans all zones; for any zone with current_score >= 76,
 *    dispatches an email alert (with deduplication to avoid spam on active streaks).
 * 2. updateZoneRiskScore() — for every zone, fetches fresh weather, DEM slope,
 *    and landslide history data, runs ONNX inference, and persists the updated
 *    score + SHAP factor breakdown into MySQL.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAndSendAlerts } from "@/server/services/alertService";
import { updateZoneRiskScore } from "@/server/services/riskScoreService";
import { query } from "@/server/db/client";

export async function GET(request: NextRequest) {
  // ── Optional secret check ────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const providedSecret =
      request.headers.get("x-cron-secret") ||
      new URL(request.url).searchParams.get("secret");
    if (providedSecret !== cronSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: invalid or missing CRON_SECRET." },
        { status: 401 }
      );
    }
  }

  const startedAt = new Date().toISOString();
  const results: Record<string, any> = { started_at: startedAt };

  // ── Step 1: Check and send alerts for critical zones ─────────────────────
  try {
    const alertResult = await checkAndSendAlerts();
    results.alerts = alertResult;
  } catch (err: any) {
    console.error("[cron/check-alerts] checkAndSendAlerts error:", err.message);
    results.alerts = { error: err.message };
  }

  // ── Step 2: Refresh risk scores for all zones ────────────────────────────
  let zones: any[] = [];
  try {
    zones = await query<any[]>("SELECT id, name FROM zones");
  } catch (dbErr: any) {
    console.warn("[cron/check-alerts] Could not load zones from DB:", dbErr.message);
  }

  const scoreUpdates: Array<{ zoneId: string; zoneName: string; status: string; error?: string }> =
    [];

  for (const zone of zones) {
    try {
      await updateZoneRiskScore(zone.id);
      scoreUpdates.push({ zoneId: zone.id, zoneName: zone.name, status: "updated" });
    } catch (zoneErr: any) {
      console.warn(
        `[cron/check-alerts] Failed to update score for zone ${zone.id} (${zone.name}):`,
        zoneErr.message
      );
      scoreUpdates.push({
        zoneId: zone.id,
        zoneName: zone.name,
        status: "error",
        error: zoneErr.message,
      });
    }
  }

  results.score_updates = {
    total_zones: zones.length,
    updated: scoreUpdates.filter((s) => s.status === "updated").length,
    errors: scoreUpdates.filter((s) => s.status === "error").length,
    details: scoreUpdates,
  };

  results.completed_at = new Date().toISOString();

  return NextResponse.json({
    success: true,
    message: "Cron job executed: alert checks and zone score refresh complete.",
    ...results,
  });
}
