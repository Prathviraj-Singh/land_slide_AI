/**
 * NDMA SACHET CAP/RSS Alert Feed Client for Next.js Server / API Routes.
 *
 * Fetches official government disaster warnings from the NDMA SACHET platform.
 * Endpoint: https://sachet.ndma.gov.in/cap_public_website/FetchAllAlerts
 * (JSON API that returns active CAP alerts — no authentication required for public data)
 *
 * Fallback: If the live feed is unreachable, the client reads from the
 * `data_cache` table (last successful response) and returns it with a
 * "feed_status: unavailable" flag. It NEVER fabricates alert data.
 *
 * NFR-05 compliance: every alert carries source + last_updated timestamp.
 */

import { query } from "../db/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SachetAlert {
  id: string;
  title: string;
  description: string;
  severity: string;       // "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown"
  urgency: string;
  certainty: string;
  event: string;          // e.g. "Landslide", "Heavy Rain", "Flash Flood"
  area: string;           // affected area name
  state: string;          // Indian state name, empty string if not parseable
  onset: string;          // ISO timestamp
  expires: string;        // ISO timestamp
  source: "official";     // always tagged "official" for SACHET alerts
  feed_url: string;
  last_updated: string;   // ISO timestamp when this record was fetched
}

export interface SachetFeedResult {
  feed_status: "live" | "cached" | "unavailable";
  fetched_at: string;
  alerts: SachetAlert[];
  message?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * NDMA SACHET public alert JSON endpoint.
 * Returns an array of active CAP alerts as JSON objects.
 * Source: https://sachet.ndma.gov.in — no API key required.
 */
const SACHET_JSON_ENDPOINT =
  "https://sachet.ndma.gov.in/cap_public_website/FetchAllAlerts";

const CACHE_SOURCE_KEY = "sachet_ndma";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts a state name from a composite area string.
 * SACHET area strings frequently follow the format "District, State" or just "State".
 */
function extractState(area: string): string {
  if (!area) return "";
  const parts = area.split(",");
  return parts[parts.length - 1].trim();
}

/**
 * Maps a SACHET severity string to a normalized value.
 */
function normalizeSeverity(raw: string): string {
  const s = (raw || "").toLowerCase();
  if (s === "extreme") return "Extreme";
  if (s === "severe") return "Severe";
  if (s === "moderate") return "Moderate";
  if (s === "minor") return "Minor";
  return "Unknown";
}

/**
 * Converts a single raw SACHET JSON alert object into a typed SachetAlert.
 */
function parseSachetAlert(raw: any, fetchedAt: string): SachetAlert {
  // SACHET CAP field names (observed from the public endpoint)
  const area = raw.areaDescription || raw.areaDesc || raw.area_desc || raw.area || "";
  const title =
    raw.headline ||
    raw.event ||
    raw.eventType ||
    "NDMA SACHET Alert";

  return {
    id: raw.identifier || raw.id || `sachet-${Date.now()}-${Math.random()}`,
    title,
    description:
      raw.description ||
      raw.instruction ||
      raw.msgDesc ||
      "Official NDMA SACHET early warning alert. Check sachet.ndma.gov.in for details.",
    severity: normalizeSeverity(raw.severity),
    urgency: raw.urgency || "Unknown",
    certainty: raw.certainty || "Unknown",
    event: raw.event || raw.eventType || "Weather Alert",
    area,
    state: extractState(area),
    onset: raw.onset || raw.effective || fetchedAt,
    expires: raw.expires || "",
    source: "official",
    feed_url: SACHET_JSON_ENDPOINT,
    last_updated: fetchedAt,
  };
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

/**
 * Persists a successful SACHET fetch payload to the `data_cache` table.
 */
async function writeSachetCache(alerts: SachetAlert[], fetchedAt: string): Promise<void> {
  try {
    const payload = JSON.stringify({ alerts, fetched_at: fetchedAt });
    await query(
      `INSERT INTO data_cache (source, payload, fetched_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (source) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at`,
      [CACHE_SOURCE_KEY, payload, fetchedAt]
    );
  } catch (dbErr: any) {
    // Cache write failure is non-fatal — log and continue.
    console.warn("[sachetClient] Failed to write cache to data_cache:", dbErr.message);
  }
}

/**
 * Reads the last-known SACHET payload from the `data_cache` table.
 * Returns null if no cached record exists.
 */
async function readSachetCache(): Promise<{ alerts: SachetAlert[]; fetched_at: string } | null> {
  try {
    const rows = await query<any[]>(
      "SELECT payload, fetched_at FROM data_cache WHERE source = $1 ORDER BY fetched_at DESC LIMIT 1",
      [CACHE_SOURCE_KEY]
    );
    if (rows && rows.length > 0 && rows[0].payload) {
      return JSON.parse(rows[0].payload);
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches active official NDMA SACHET alerts.
 *
 * Flow:
 *  1. Attempts a live fetch from SACHET JSON endpoint.
 *  2. On success — parses, caches, and returns alerts tagged "official".
 *  3. On failure — falls back to last DB-cached response with feed_status "cached".
 *  4. If no cache exists either — returns empty list with feed_status "unavailable".
 *
 * @param filterStates  Optional array of Indian state names to filter results.
 *                      Pass an empty array (default) to return all national alerts.
 */
export async function fetchSachetAlerts(filterStates: string[] = []): Promise<SachetFeedResult> {
  const fetchedAt = new Date().toISOString();

  try {
    const response = await fetch(SACHET_JSON_ENDPOINT, {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "LandslideShield-AI-App/1.0 (sachet.ndma.gov.in public data)",
      },
      // Do NOT use Next.js cache for alert data — always want fresh government warnings.
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from SACHET endpoint`);
    }

    const raw = await response.json();

    // SACHET may return an array directly or wrap inside a key
    const rawAlerts: any[] = Array.isArray(raw)
      ? raw
      : raw.alerts || raw.data || raw.results || raw.items || [];

    const parsed: SachetAlert[] = rawAlerts
      .map((item: any) => parseSachetAlert(item, fetchedAt))
      .filter((a) => {
        if (filterStates.length === 0) return true;
        return filterStates.some(
          (s) => a.state.toLowerCase().includes(s.toLowerCase()) ||
                 a.area.toLowerCase().includes(s.toLowerCase())
        );
      });

    // Persist to DB cache for fallback
    await writeSachetCache(parsed, fetchedAt);

    return {
      feed_status: "live",
      fetched_at: fetchedAt,
      alerts: parsed,
    };
  } catch (liveError: any) {
    console.warn(
      `[sachetClient] Live SACHET feed unavailable (${liveError.message}). Attempting DB cache fallback.`
    );

    const cached = await readSachetCache();
    if (cached) {
      const filteredAlerts =
        filterStates.length === 0
          ? cached.alerts
          : cached.alerts.filter((a) =>
              filterStates.some(
                (s) =>
                  a.state.toLowerCase().includes(s.toLowerCase()) ||
                  a.area.toLowerCase().includes(s.toLowerCase())
              )
            );

      return {
        feed_status: "cached",
        fetched_at: cached.fetched_at,
        alerts: filteredAlerts,
        message: `Live SACHET feed unavailable (${liveError.message}). Showing last-known data from ${cached.fetched_at}.`,
      };
    }

    // No cache either — return empty with clear unavailable flag
    return {
      feed_status: "unavailable",
      fetched_at: fetchedAt,
      alerts: [],
      message: `NDMA SACHET feed is currently unreachable and no cached data is available. Error: ${liveError.message}`,
    };
  }
}
