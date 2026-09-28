/**
 * Historical Landslide Spatial Query Client for Next.js Server / API Routes.
 *
 * Statically imports pre-downloaded NASA Global Landslide Catalog JSON dataset for India
 * (server/data/landslide_history_india.json) and performs Haversine distance spatial queries
 * to find nearby historical landslide events without any runtime file system (fs) lookups.
 */

import landslideData from "../data/landslide_history_india.json";

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
 * Queries historical landslide events in India within a given radius in kilometers.
 */
export async function fetchNearbyLandslideHistory(
  latitude: number,
  longitude: number,
  radiusKm: number = 50
): Promise<LandslideHistoryQueryResult> {
  const events: HistoricalLandslideRecord[] = [];
  let totalFatalities = 0;

  for (const item of landslideData as any[]) {
    const eventLat = Number(item.latitude);
    const eventLon = Number(item.longitude);

    if (isNaN(eventLat) || isNaN(eventLon)) continue;

    const distance = haversineDistanceKm(latitude, longitude, eventLat, eventLon);

    if (distance <= radiusKm) {
      const fatalities = Number(item.fatalities) || 0;
      totalFatalities += fatalities;

      events.push({
        eventId: String(item.eventId || ""),
        date: String(item.date || "Unknown Date"),
        title: String(item.title || "Landslide Event"),
        category: String(item.category || "landslide"),
        trigger: String(item.trigger || "rain"),
        size: String(item.size || "unknown"),
        fatalities,
        latitude: eventLat,
        longitude: eventLon,
        distanceKm: distance,
        locationDescription: String(item.locationDescription || ""),
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
}
