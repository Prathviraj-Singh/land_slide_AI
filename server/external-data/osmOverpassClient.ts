/**
 * OpenStreetMap (OSM) Overpass API Client for Next.js Server / API Routes.
 *
 * Queries OSM infrastructure elements (roads/highways, schools, villages, hamlets, towns)
 * within a specified radius (meters) around a target landslide risk coordinate.
 *
 * API Endpoint: https://overpass-api.de/api/interpreter
 * No API key required.
 *
 * NFR-03 Fallback: On all-endpoint failure, the last successful OSM response is read
 * from the `data_cache` MySQL table and returned with feed_status: "cached".
 * The response is NEVER silently substituted with zero/fake data.
 */

import { query } from "../db/client";

async function writeOsmCache(cacheKey: string, payload: any): Promise<void> {
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

async function readOsmCache(cacheKey: string): Promise<{ data: any; fetched_at: string } | null> {
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

export interface InfrastructureItem {
  id: number;
  type: "road" | "school" | "settlement" | "other";
  name: string;
  category: string;
  latitude?: number;
  longitude?: number;
}

export interface NearbyInfrastructureOverview {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  totalVulnerableElements: number;
  summary: {
    roadCount: number;
    schoolCount: number;
    settlementCount: number;
  };
  roads: InfrastructureItem[];
  schools: InfrastructureItem[];
  settlements: InfrastructureItem[];
  feed_status?: "live" | "cached";
  cache_fetched_at?: string;
  cache_message?: string;
}

const OVERPASS_PRIMARY_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_FALLBACK_URL = "https://overpass.kumi.systems/api/interpreter";

/**
 * Builds Overpass QL query string for roads, schools, and settlements.
 */
function buildOverpassQuery(lat: number, lon: number, radiusMeters: number): string {
  return `[out:json][timeout:25];
(
  node["highway"](around:${radiusMeters},${lat},${lon});
  way["highway"](around:${radiusMeters},${lat},${lon});
  node["amenity"="school"](around:${radiusMeters},${lat},${lon});
  way["amenity"="school"](around:${radiusMeters},${lat},${lon});
  node["place"~"village|hamlet|town|isolated_dwelling"](around:${radiusMeters},${lat},${lon});
  way["place"~"village|hamlet|town|isolated_dwelling"](around:${radiusMeters},${lat},${lon});
);
out body;
`;
}

/**
 * Queries OSM Overpass API to assess critical infrastructure elements in proximity to high-risk slope zones.
 */
export async function fetchNearbyInfrastructure(
  latitude: number,
  longitude: number,
  radiusMeters: number = 3000
): Promise<NearbyInfrastructureOverview> {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error(`[osmOverpassClient] Invalid coordinates: lat=${latitude}, lon=${longitude}`);
  }

  const cacheKey = `osm_overpass_${latitude.toFixed(4)}_${longitude.toFixed(4)}_${radiusMeters}`;

  const query = buildOverpassQuery(latitude, longitude, radiusMeters);

  let responseData: any = null;
  let lastError: Error | null = null;

  for (const endpoint of [OVERPASS_PRIMARY_URL, OVERPASS_FALLBACK_URL]) {
    // NFR-02: 5-second hard timeout per endpoint; move to fallback on expiry
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "LandslideShield-AI-App/1.0",
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
        next: { revalidate: 3600 }, // Cache infrastructure data for 1 hour
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${endpoint}`);
      }

      responseData = await response.json();
      break; // Success!
    } catch (err: any) {
      clearTimeout(timeoutId);
      const errLabel = err?.name === "AbortError" ? "5 s timeout" : err?.message;
      lastError = new Error(errLabel);
      console.warn(`[osmOverpassClient] Endpoint ${endpoint} failed: ${errLabel}. Retrying fallback...`);
    }
  }

  if (!responseData) {
    console.error(`[osmOverpassClient] All Overpass API endpoints failed: ${lastError?.message}`);

    // NFR-03: serve last cached infrastructure data with status badge
    const cached = await readOsmCache(cacheKey);
    if (cached) {
      console.warn(`[osmOverpassClient] Serving cached OSM data from ${cached.fetched_at} for (${latitude}, ${longitude}).`);
      return {
        ...cached.data,
        feed_status: "cached",
        cache_fetched_at: cached.fetched_at,
        cache_message: `Live Overpass API unavailable (${lastError?.message}). Showing last-known infrastructure data from ${cached.fetched_at}.`,
      };
    }

    throw new Error(`[osmOverpassClient] All Overpass API endpoints failed: ${lastError?.message}`);
  }

  const elements: any[] = responseData.elements || [];

  const roads: InfrastructureItem[] = [];
  const schools: InfrastructureItem[] = [];
  const settlements: InfrastructureItem[] = [];

  const seenRoadNames = new Set<string>();

  for (const elem of elements) {
    const tags = elem.tags || {};
    const name = tags.name || tags["name:en"] || tags.ref || "Unnamed Infrastructure";
    const lat = elem.lat || elem.center?.lat;
    const lon = elem.lon || elem.center?.lon;

    if (tags.highway) {
      // Avoid cluttering list with duplicate highway segment names
      const roadKey = `${tags.highway}:${name}`;
      if (!seenRoadNames.has(roadKey) || name !== "Unnamed Infrastructure") {
        seenRoadNames.add(roadKey);
        roads.push({
          id: elem.id,
          type: "road",
          name,
          category: `Highway (${tags.highway})`,
          latitude: lat,
          longitude: lon,
        });
      }
    } else if (tags.amenity === "school") {
      schools.push({
        id: elem.id,
        type: "school",
        name,
        category: "Educational Facility",
        latitude: lat,
        longitude: lon,
      });
    } else if (tags.place) {
      settlements.push({
        id: elem.id,
        type: "settlement",
        name,
        category: `Settlement (${tags.place})`,
        latitude: lat,
        longitude: lon,
      });
    }
  }

  const result: NearbyInfrastructureOverview = {
    latitude,
    longitude,
    radiusMeters,
    totalVulnerableElements: roads.length + schools.length + settlements.length,
    summary: {
      roadCount: roads.length,
      schoolCount: schools.length,
      settlementCount: settlements.length,
    },
    roads,
    schools,
    settlements,
    feed_status: "live",
  };

  // Cache successful result for NFR-03 fallback
  await writeOsmCache(cacheKey, result);

  return result;
}
