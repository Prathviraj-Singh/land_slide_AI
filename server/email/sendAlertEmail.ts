/**
 * Hostinger SMTP Nodemailer Client for Landslide Warning Dispatch.
 *
 * Configures Nodemailer transporter using Hostinger SMTP environment variables
 * (HOSTINGER_SMTP_HOST, HOSTINGER_SMTP_USER, HOSTINGER_SMTP_PASS) and sends
 * emergency landslide warning alert emails with full zone context.
 *
 * Email template includes: risk score, trend, top contributing factor,
 * and the first affected road/village from real OSM data.
 */

import nodemailer from "nodemailer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlertEmailDetails {
  zoneId: string;
  zoneName: string;
  latitude: number;
  longitude: number;
  riskScore: number;
  riskLevel: string;
  trend?: "rising" | "stable" | "falling";
  triggeredAt: string;
  /** SHAP factor breakdown — highest percentage factor becomes "top contributing factor" */
  factorBreakdown?: {
    rainfall_pct: number;
    soil_pct: number;
    slope_pct: number;
    history_pct: number;
  };
  /** First affected road name from OSM Overpass within 3 km (may be empty string) */
  affectedRoad?: string;
  /** First affected village/settlement name from OSM Overpass within 3 km (may be empty string) */
  affectedVillage?: string;
}

// ─── SMTP Configuration ───────────────────────────────────────────────────────

// Supports both HOSTINGER_SMTP_* (task spec) and plain SMTP_* names for compatibility.
const smtpHost =
  process.env.HOSTINGER_SMTP_HOST ||
  process.env.SMTP_HOST ||
  "smtp.hostinger.com";
const smtpPort = parseInt(
  process.env.HOSTINGER_SMTP_PORT || process.env.SMTP_PORT || "465",
  10
);
const smtpUser =
  process.env.HOSTINGER_SMTP_USER || process.env.SMTP_USER || "";
const smtpPass =
  process.env.HOSTINGER_SMTP_PASS || process.env.SMTP_PASSWORD || "";
const fromAddress =
  process.env.ALERT_EMAIL_FROM ||
  `"LandslideShield AI" <${smtpUser || "alerts@landslideshield.ai"}>`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves which factor contributed most to the risk score based on the SHAP breakdown.
 */
function topFactor(breakdown?: AlertEmailDetails["factorBreakdown"]): string {
  if (!breakdown) return "Rainfall Accumulation";
  const factors = [
    { name: "Rainfall Accumulation", pct: breakdown.rainfall_pct },
    { name: "Soil Moisture Saturation", pct: breakdown.soil_pct },
    { name: "Terrain Slope (DEM)", pct: breakdown.slope_pct },
    { name: "Historical Landslide Density", pct: breakdown.history_pct },
  ];
  factors.sort((a, b) => b.pct - a.pct);
  return `${factors[0].name} (${factors[0].pct}%)`;
}

/**
 * Returns an emoji-based trend indicator for use in email subject/body.
 */
function trendLabel(trend?: "rising" | "stable" | "falling"): string {
  if (trend === "rising") return "📈 Rising";
  if (trend === "falling") return "📉 Falling";
  return "➡️ Stable";
}

/**
 * Creates a Nodemailer SMTP transporter configured for Hostinger.
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // TLS on port 465; STARTTLS on 587
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

// ─── Email Builder ────────────────────────────────────────────────────────────

function buildHtmlBody(d: AlertEmailDetails): string {
  const top = topFactor(d.factorBreakdown);
  const trend = trendLabel(d.trend);
  const affRoad = d.affectedRoad || "—";
  const affVillage = d.affectedVillage || "—";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>LandslideShield AI Alert — ${d.zoneName}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:28px;color:#fff;">⚠️</p>
              <h1 style="margin:8px 0 4px;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.5px;">
                CRITICAL LANDSLIDE ALERT
              </h1>
              <p style="margin:0;font-size:13px;color:#fca5a5;">
                LandslideShield AI Early Warning Advisory &bull; NDMA-Aligned Protocol
              </p>
            </td>
          </tr>

          <!-- Zone Summary -->
          <tr>
            <td style="padding:24px 32px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:12px;">
                    <span style="display:inline-block;background:#dc2626;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px;">
                      ${d.riskLevel}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <h2 style="margin:0 0 4px;font-size:18px;color:#f1f5f9;font-weight:700;">
                      ${d.zoneName}
                    </h2>
                    <p style="margin:0;font-size:12px;color:#94a3b8;font-family:monospace;">
                      ID: ${d.zoneId} &bull; Coordinates: ${d.latitude.toFixed(4)}° N, ${d.longitude.toFixed(4)}° E
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Score + Trend Row -->
          <tr>
            <td style="padding:0 32px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;border:1px solid #334155;overflow:hidden;">
                <tr>
                  <td width="50%" style="padding:16px 20px;border-right:1px solid #334155;text-align:center;">
                    <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Risk Score</p>
                    <p style="margin:0;font-size:36px;font-weight:800;color:#ef4444;">${d.riskScore}<span style="font-size:16px;color:#94a3b8;font-weight:400;">/100</span></p>
                  </td>
                  <td width="50%" style="padding:16px 20px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Trend</p>
                    <p style="margin:0;font-size:20px;font-weight:700;color:#f1f5f9;">${trend}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Details Grid -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #334155;border-radius:8px;overflow:hidden;">
                <tr style="background:#1e293b;">
                  <td style="padding:12px 16px;border-bottom:1px solid #334155;">
                    <p style="margin:0 0 2px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Top Contributing Factor (SHAP)</p>
                    <p style="margin:0;font-size:14px;font-weight:600;color:#fbbf24;">${top}</p>
                  </td>
                </tr>
                <tr style="background:#0f172a;">
                  <td style="padding:12px 16px;border-bottom:1px solid #334155;">
                    <p style="margin:0 0 2px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Nearest Affected Road (OSM)</p>
                    <p style="margin:0;font-size:14px;font-weight:600;color:#38bdf8;">${affRoad}</p>
                  </td>
                </tr>
                <tr style="background:#1e293b;">
                  <td style="padding:12px 16px;">
                    <p style="margin:0 0 2px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Nearest Affected Village/Settlement (OSM)</p>
                    <p style="margin:0;font-size:14px;font-weight:600;color:#34d399;">${affVillage}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Advisory -->
          <tr>
            <td style="padding:0 32px 24px;">
              <div style="background:#431407;border:1px solid #7c2d12;border-radius:8px;padding:16px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;color:#fb923c;letter-spacing:0.5px;">Immediate Action Required</p>
                <p style="margin:0;font-size:13px;color:#fed7aa;line-height:1.6;">
                  Activate district-level emergency response protocols. Notify field officers in ${d.zoneName} and adjacent areas.
                  Issue SMS/IVR warnings to communities near ${affVillage !== "—" ? affVillage : "the risk zone"}.
                  Restrict movement on ${affRoad !== "—" ? affRoad : "mountain passes"} and coordinate with NDMA SACHET for official advisory.
                </p>
              </div>
            </td>
          </tr>

          <!-- Timestamp Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;font-size:11px;color:#475569;">
                Alert generated at: <strong style="color:#94a3b8;font-family:monospace;">${d.triggeredAt}</strong>
              </p>
              <p style="margin:4px 0 0;font-size:11px;color:#334155;">
                LandslideShield AI &bull; Powered by ONNX ML Inference &bull; Data: Open-Meteo, OpenTopography, OSM, NASA EONET
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Sends an emergency landslide alert email to the designated authority recipient.
 *
 * Uses Hostinger SMTP (HOSTINGER_SMTP_HOST / HOSTINGER_SMTP_USER / HOSTINGER_SMTP_PASS).
 * Returns { sent: false } with an error string if SMTP credentials are unconfigured.
 */
export async function sendAlertEmail(
  recipient: string,
  alertDetails: AlertEmailDetails
): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  if (!smtpUser || !smtpPass) {
    console.warn(
      `[sendAlertEmail] SMTP credentials missing in process.env ` +
        `(HOSTINGER_SMTP_USER / HOSTINGER_SMTP_PASS). ` +
        `Email dispatch skipped for zone ${alertDetails.zoneName}.`
    );
    return {
      sent: false,
      error: "SMTP credentials not configured in environment.",
    };
  }

  const transporter = createTransporter();
  const subject = `LandslideShield AI Alert — ${alertDetails.zoneName} Critical Risk (Score: ${alertDetails.riskScore}/100)`;
  const htmlBody = buildHtmlBody(alertDetails);

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      subject,
      html: htmlBody,
    });

    console.log(
      `[sendAlertEmail] Sent alert for zone "${alertDetails.zoneName}" to ${recipient}. MessageId: ${info.messageId}`
    );
    return { sent: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(
      `[sendAlertEmail] Failed to send email to ${recipient}:`,
      error.message
    );
    return { sent: false, error: error.message };
  }
}
