/**
 * Emergency Alert Monitoring & Dispatch Service.
 *
 * Scans monitored zones, checks for critical risk thresholds (score >= 76),
 * enforces alert streak deduplication, dispatches emergency emails,
 * and persists alert audit logs into PostgreSQL.
 */

import { query } from "../db/client";
import { sendAlertEmail } from "../email/sendAlertEmail";

export interface AlertRecord {
  id: number;
  zone_id: string;
  zone_name?: string;
  score_at_alert: number;
  level: string;
  sent_at: string;
  email_sent: boolean;
}

export interface CheckAlertsResult {
  totalZonesEvaluated: number;
  criticalZonesCount: number;
  alertsDispatchedCount: number;
  skippedStreakCount: number;
  alerts: AlertRecord[];
}

const DEFAULT_EMERGENCY_RECIPIENT = process.env.EMERGENCY_ALERT_RECIPIENT || "disaster-management@authority.gov.in";

/**
 * Checks all zones for critical risk score thresholds (score >= 76) and dispatches alert emails
 * if no alert has been sent for the current critical streak.
 */
export async function checkAndSendAlerts(): Promise<CheckAlertsResult> {
  let zones: any[] = [];
  try {
    zones = await query<any[]>("SELECT * FROM zones");
  } catch (err) {
    console.warn(`[alertService] DB query warning in checkAndSendAlerts:`, err);
  }

  let criticalCount = 0;
  let dispatchedCount = 0;
  let skippedStreakCount = 0;
  const processedAlerts: AlertRecord[] = [];

  for (const z of zones) {
    const zoneId = z.id;
    const name = z.name;
    const score = z.current_score;
    const lat = parseFloat(z.lat);
    const lon = parseFloat(z.lon);

    if (score >= 76) {
      criticalCount++;

      // Check if an alert was already sent for the current active streak in PostgreSQL
      let recentAlerts: any[] = [];
      try {
        recentAlerts = await query<any[]>(
          "SELECT * FROM alerts WHERE zone_id = $1 ORDER BY sent_at DESC LIMIT 1",
          [zoneId]
        );
      } catch (dbErr) {
        console.warn(`[alertService] Alert table query warning for zone ${zoneId}:`, dbErr);
      }

      const lastAlert = recentAlerts[0];
      const hasActiveStreak = lastAlert && lastAlert.score_at_alert >= 76 && lastAlert.email_sent;

      if (hasActiveStreak) {
        skippedStreakCount++;
        processedAlerts.push(lastAlert);
        continue; // Skip duplicate email dispatch for ongoing critical streak
      }

      // Dispatch alert email
      const emailResult = await sendAlertEmail(DEFAULT_EMERGENCY_RECIPIENT, {
        zoneId,
        zoneName: name,
        latitude: lat,
        longitude: lon,
        riskScore: score,
        riskLevel: "CRITICAL",
        triggeredAt: new Date().toISOString(),
      });

      // Insert new alert record into PostgreSQL alerts table
      try {
        const insertRes = await query<any>(
          "INSERT INTO alerts (zone_id, score_at_alert, level, sent_at, email_sent) VALUES ($1, $2, 'CRITICAL', NOW(), $3) RETURNING id",
          [zoneId, score, emailResult.sent]
        );

        const insertedId = (insertRes && insertRes[0] && insertRes[0].id) || insertRes.insertId || Date.now();

        const newAlert: AlertRecord = {
          id: insertedId,
          zone_id: zoneId,
          zone_name: name,
          score_at_alert: score,
          level: "CRITICAL",
          sent_at: new Date().toISOString(),
          email_sent: emailResult.sent,
        };

        processedAlerts.push(newAlert);
        dispatchedCount++;
      } catch (insertErr) {
        console.warn(`[alertService] Failed to insert alert record into DB:`, insertErr);
      }
    }
  }

  return {
    totalZonesEvaluated: zones.length,
    criticalZonesCount: criticalCount,
    alertsDispatchedCount: dispatchedCount,
    skippedStreakCount,
    alerts: processedAlerts,
  };
}

/**
 * Returns recent emergency alerts from DB.
 */
export async function getRecentAlerts(limit: number = 20): Promise<AlertRecord[]> {
  try {
    const rows = await query<any[]>(
      `SELECT a.*, z.name as zone_name 
       FROM alerts a 
       LEFT JOIN zones z ON a.zone_id = z.id 
       ORDER BY a.sent_at DESC 
       LIMIT $1`,
      [limit]
    );
    return rows.map((r) => ({
      id: r.id,
      zone_id: r.zone_id,
      zone_name: r.zone_name || r.zone_id,
      score_at_alert: r.score_at_alert,
      level: r.level,
      sent_at: r.sent_at,
      email_sent: Boolean(r.email_sent),
    }));
  } catch (err) {
    console.warn(`[alertService] Error reading alerts from DB:`, err);
    return [];
  }
}
