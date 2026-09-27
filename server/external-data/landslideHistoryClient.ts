/**
 * Historical Landslide Spatial Query Client for Next.js Server / API Routes.
 *
 * Reads pre-downloaded NASA Global Landslide Catalog dataset for India
 * (landslide_history_india.csv) and performs Haversine distance spatial queries
 * to find nearby historical landslide events.
 */

import fs from "fs";
import path from "path";

export interface HistoricalLandslideRecord {
  eventId: string;
  date: string;
  title: string;
  category: string;
  trigger: string;
  size: string;
  fatalities: number;
  latitude: number;
  longitude: number;
  distanceKm: number;
  locationDescription: string;
}

export interface LandslideHistoryQueryResult {
  targetLatitude: number;
  targetLongitude: number;
  radiusKm: number;
  totalNearbyEvents: number;
  closestEventDistanceKm: number | null;
  totalFatalitiesRecorded: number;
  events: HistoricalLandslideRecord[];
  datasetLoaded: boolean;
  message?: string;
}

/**
 * Calculates Great Circle distance between two lat/lon points on Earth in kilometers
 * using the Haversine formula.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371.0; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

/**
 * Locates the downloaded landslide_history_india.csv file across standard project paths.
 */
function resolveCsvPath(): string | null {
  const candidatePaths = [
    path.join(process.cwd(), "server", "db", "seed-data", "landslide_history_india.csv"),
    path.join(__dirname, "..", "db", "seed-data", "landslide_history_india.csv"),
    path.join(process.cwd(), "ml-training", "data", "landslide_history_india.csv"),
    path.join(process.cwd(), "server", "data", "landslide_history_india.csv"),
    path.join(process.cwd(), "public", "data", "landslide_history_india.csv"),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Simple CSV parser handling quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Queries historical landslide events in India within a given radius in kilometers.
 */
export async function fetchNearbyLandslideHistory(
  latitude: number,
  longitude: number,
  radiusKm: number = 50
): Promise<LandslideHistoryQueryResult> {
  const csvPath = resolveCsvPath();

  if (!csvPath) {
    return {
      targetLatitude: latitude,
      targetLongitude: longitude,
      radiusKm,
      totalNearbyEvents: 0,
      closestEventDistanceKm: null,
      totalFatalitiesRecorded: 0,
      events: [],
      datasetLoaded: false,
      message:
        "Historical landslide dataset (landslide_history_india.csv) not found.\n" +
        "Please run: python ml-training/data/fetch_landslide_history.py",
    };
  }

  try {
    const content = fs.readFileSync(csvPath, "utf-8");
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length <= 1) {
      return {
        targetLatitude: latitude,
        targetLongitude: longitude,
        radiusKm,
        totalNearbyEvents: 0,
        closestEventDistanceKm: null,
        totalFatalitiesRecorded: 0,
        events: [],
        datasetLoaded: true,
        message: "Dataset file is empty.",
      };
    }

    const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/^"/, "").replace(/"$/, ""));

    const latIdx = header.findIndex((h) => h === "latitude" || h === "lat");
    const lonIdx = header.findIndex((h) => h === "longitude" || h === "lon");
    const idIdx = header.findIndex((h) => h === "event_id" || h === "id");
    const dateIdx = header.findIndex((h) => h === "event_date" || h === "date");
    const titleIdx = header.findIndex((h) => h === "event_title" || h === "title");
    const catIdx = header.findIndex((h) => h === "landslide_category" || h === "category");
    const trigIdx = header.findIndex((h) => h === "landslide_trigger" || h === "trigger");
    const sizeIdx = header.findIndex((h) => h === "landslide_size" || h === "size");
    const fatIdx = header.findIndex((h) => h === "fatality_count" || h === "fatalities");
    const locIdx = header.findIndex((h) => h === "location_description" || h === "location");

    const events: HistoricalLandslideRecord[] = [];
    let totalFatalities = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length <= Math.max(latIdx, lonIdx)) continue;

      const eventLat = parseFloat(cols[latIdx]);
      const eventLon = parseFloat(cols[lonIdx]);

      if (isNaN(eventLat) || isNaN(eventLon)) continue;

      const distance = haversineDistanceKm(latitude, longitude, eventLat, eventLon);

      if (distance <= radiusKm) {
        const fatalities = fatIdx >= 0 ? parseInt(cols[fatIdx], 10) || 0 : 0;
        totalFatalities += fatalities;

        events.push({
          eventId: idIdx >= 0 ? cols[idIdx] || `evt-${i}` : `evt-${i}`,
          date: dateIdx >= 0 ? cols[dateIdx] || "Unknown Date" : "Unknown Date",
          title: titleIdx >= 0 ? cols[titleIdx] || "Landslide Event" : "Landslide Event",
          category: catIdx >= 0 ? cols[catIdx] || "landslide" : "landslide",
          trigger: trigIdx >= 0 ? cols[trigIdx] || "rain" : "rain",
          size: sizeIdx >= 0 ? cols[sizeIdx] || "unknown" : "unknown",
          fatalities,
          latitude: eventLat,
          longitude: eventLon,
          distanceKm: distance,
          locationDescription: locIdx >= 0 ? cols[locIdx] || "" : "",
        });
      }
    }

    // Sort events by distance (closest first)
    events.sort((a, b) => a.distanceKm - b.distanceKm);

    return {
      targetLatitude: latitude,
      targetLongitude: longitude,
      radiusKm,
      totalNearbyEvents: events.length,
      closestEventDistanceKm: events.length > 0 ? events[0].distanceKm : null,
      totalFatalitiesRecorded: totalFatalities,
      events,
      datasetLoaded: true,
    };
  } catch (err: any) {
    console.error(`[landslideHistoryClient] Error querying historical landslides:`, err);
    throw err;
  }
}
