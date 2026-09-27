/**
 * OpenTopography API Client for Next.js Server / API Routes.
 *
 * Requests SRTM 30m Global DEM raster data for a target latitude and longitude,
 * parses Arc ASCII Grid (AAIGrid) format directly in TypeScript, and computes
 * real-time slope (gradient in degrees) and elevation profile metrics.
 *
 * API Key required: OPENTOPOGRAPHY_API_KEY environment variable.
 *
 * NFR-03 Fallback: On any fetch failure, the last successful DEM/slope response
 * is read from the `data_cache` MySQL table and returned with feed_status: "cached".
 * The response is NEVER silently substituted with zero/fake data.
 */

import { query } from "../db/client";

async function writeTopoCache(cacheKey: string, payload: any): Promise<void> {
  try {
    await query(
      `INSERT INTO data_cache (source, payload, fetched_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), fetched_at = VALUES(fetched_at)`,
      [cacheKey, JSON.stringify(payload)]
    );
  } catch {
    // non-fatal
  }
}

async function readTopoCache(cacheKey: string): Promise<{ data: any; fetched_at: string } | null> {
  try {
    const rows = await query<any[]>(
      "SELECT payload, fetched_at FROM data_cache WHERE source = ? LIMIT 1",
      [cacheKey]
    );
    if (rows && rows.length > 0 && rows[0].payload) {
      return { data: JSON.parse(rows[0].payload), fetched_at: rows[0].fetched_at };
    }
    return null;
  } catch {
    return null;
  }
}

export interface SlopeProfileResult {
  latitude: number;
  longitude: number;
  averageSlopeDegrees: number;
  maxSlopeDegrees: number;
  elevationMinMeters: number;
  elevationMaxMeters: number;
  elevationRangeMeters: number;
  gridResolutionMeters: number;
  feed_status?: "live" | "cached";
  cache_fetched_at?: string;
  cache_message?: string;
}

const OPENTOPOGRAPHY_GLOBALDEM_URL = "https://portal.opentopography.org/API/globaldem";

/**
 * Parses AAIGrid ASCII elevation grid text and computes slope degrees using gradient math.
 */
function parseAAIGridAndCalculateSlope(
  asciiText: string,
  centerLat: float
): { avgSlope: number; maxSlope: number; minElev: number; maxElev: number; resMeters: number } {
  const lines = asciiText.trim().split(/\r?\n/);
  const header: Record<string, number> = {};
  let dataStartLine = 0;

  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length === 2) {
      const key = parts[0].toLowerCase();
      const val = parseFloat(parts[1]);
      if (!isNaN(val)) {
        header[key] = val;
        dataStartLine = i + 1;
      } else {
        break;
      }
    }
  }

  const ncols = header["ncols"] || 0;
  const nrows = header["nrows"] || 0;
  const cellsizeDeg = header["cellsize"] || 0.000277777777777778; // ~30m SRTM
  const nodataVal = header["nodata_value"] ?? -9999;

  // Convert elevation rows into 2D array
  const grid: number[][] = [];
  for (let i = dataStartLine; i < lines.length; i++) {
    const rowStr = lines[i].trim();
    if (!rowStr) continue;
    const nums = rowStr.split(/\s+/).map((s) => parseFloat(s));
    if (nums.length > 0) {
      grid.push(nums);
    }
  }

  if (grid.length === 0 || grid[0].length === 0) {
    throw new Error("[openTopographyClient] Failed to parse elevation matrix from AAIGrid output.");
  }

  const numRows = grid.length;
  const numCols = grid[0].length;

  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const val = grid[r][c];
      if (val !== nodataVal && !isNaN(val)) {
        if (val < minElev) minElev = val;
        if (val > maxElev) maxElev = val;
      }
    }
  }

  if (minElev === Infinity) {
    throw new Error("[openTopographyClient] AAIGrid contains no valid elevation data.");
  }

  // Calculate cell dimensions in meters
  const latRad = (centerLat * Math.PI) / 180;
  const dy = cellsizeDeg * 111320.0; // meters per cell vertical
  const dx = cellsizeDeg * 111320.0 * Math.cos(latRad); // meters per cell horizontal

  const slopeGrid: number[] = [];

  // Compute central differences for interior grid cells
  for (let r = 1; r < numRows - 1; r++) {
    for (let c = 1; c < numCols - 1; c++) {
      const z = grid[r][c];
      if (z === nodataVal || isNaN(z)) continue;

      const zTop = grid[r - 1][c];
      const zBottom = grid[r + 1][c];
      const zLeft = grid[r][c - 1];
      const zRight = grid[r][c + 1];

      if (
        zTop === nodataVal ||
        zBottom === nodataVal ||
        zLeft === nodataVal ||
        zRight === nodataVal
      ) {
        continue;
      }

      const dzdy = (zBottom - zTop) / (2 * dy);
      const dzdx = (zRight - zLeft) / (2 * dx);

      const slopeRad = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy));
      const slopeDeg = (slopeRad * 180) / Math.PI;

      slopeGrid.push(slopeDeg);
    }
  }

  if (slopeGrid.length === 0) {
    // Fallback if grid is too small for interior central difference: estimate overall range slope
    const distM = Math.sqrt(numRows * dy * (numRows * dy) + numCols * dx * (numCols * dx));
    const estSlopeRad = Math.atan((maxElev - minElev) / Math.max(1, distM));
    const estSlopeDeg = (estSlopeRad * 180) / Math.PI;
    return {
      avgSlope: parseFloat(estSlopeDeg.toFixed(2)),
      maxSlope: parseFloat((estSlopeDeg * 1.5).toFixed(2)),
      minElev: Math.round(minElev),
      maxElev: Math.round(maxElev),
      resMeters: Math.round((dx + dy) / 2),
    };
  }

  const sumSlope = slopeGrid.reduce((a, b) => a + b, 0);
  const avgSlope = sumSlope / slopeGrid.length;
  const maxSlope = Math.max(...slopeGrid);

  return {
    avgSlope: parseFloat(avgSlope.toFixed(2)),
    maxSlope: parseFloat(maxSlope.toFixed(2)),
    minElev: Math.round(minElev),
    maxElev: Math.round(maxElev),
    resMeters: Math.round((dx + dy) / 2),
  };
}

/**
 * Fetches real-time DEM elevation grid and calculates terrain slope for a target lat/lon location.
 */
export async function fetchLiveSlopeData(
  latitude: number,
  longitude: number,
  delta: number = 0.005
): Promise<SlopeProfileResult> {
  const cacheKey = `open_topography_${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
  const apiKey = process.env.OPENTOPOGRAPHY_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "[openTopographyClient] OPENTOPOGRAPHY_API_KEY is missing from process.env.\n" +
        "Get a free API key at https://portal.opentopography.org/newUser and add it to your .env file."
    );
  }

  const params = new URLSearchParams({
    demtype: "SRTMGL1",
    south: (latitude - delta).toFixed(5),
    north: (latitude + delta).toFixed(5),
    west: (longitude - delta).toFixed(5),
    east: (longitude + delta).toFixed(5),
    outputFormat: "AAIGrid",
    API_Key: apiKey,
  });

  const requestUrl = `${OPENTOPOGRAPHY_GLOBALDEM_URL}?${params.toString()}`;

  // NFR-02: enforce a 5-second hard timeout; on expiry fall through to NFR-03 cache
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(requestUrl, {
      headers: { "User-Agent": "LandslideShield-AI-App/1.0" },
      signal: controller.signal,
      next: { revalidate: 86400 }, // Cache elevation/slope data for 24 hours
    });
    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 403) {
      throw new Error("[openTopographyClient] Invalid or unauthorized OPENTOPOGRAPHY_API_KEY.");
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`[openTopographyClient] HTTP ${response.status}: ${errText}`);
    }

    const asciiText = await response.text();
    const metrics = parseAAIGridAndCalculateSlope(asciiText, latitude);

    const result: SlopeProfileResult = {
      latitude,
      longitude,
      averageSlopeDegrees: metrics.avgSlope,
      maxSlopeDegrees: metrics.maxSlope,
      elevationMinMeters: metrics.minElev,
      elevationMaxMeters: metrics.maxElev,
      elevationRangeMeters: metrics.maxElev - metrics.minElev,
      gridResolutionMeters: metrics.resMeters,
      feed_status: "live",
    };

    // Cache successful DEM result for NFR-03 fallback
    await writeTopoCache(cacheKey, result);

    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    const errLabel = error?.name === "AbortError" ? "5 s timeout" : error?.message;
    console.error(`[openTopographyClient] Error fetching slope for (${latitude}, ${longitude}): ${errLabel}`);

    // NFR-03: serve last cached slope data with status badge
    const cached = await readTopoCache(cacheKey);
    if (cached) {
      console.warn(`[openTopographyClient] Serving cached slope data from ${cached.fetched_at} for (${latitude}, ${longitude}).`);
      return {
        ...cached.data,
        feed_status: "cached",
        cache_fetched_at: cached.fetched_at,
        cache_message: `Live OpenTopography feed unavailable (${error.message}). Showing last-known slope data from ${cached.fetched_at}.`,
      };
    }

    throw error;
  }
}
type float = number;
