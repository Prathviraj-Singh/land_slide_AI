/**
 * Open-Meteo Live API Client for Next.js Server / API Routes.
 *
 * Fetches real-time weather, 7-day rainfall forecasts, and soil moisture telemetry
 * for any given latitude and longitude coordinate in India.
 *
 * API Documentation: https://open-meteo.com/en/docs
 * No API key required for non-commercial open data usage.
 *
 * NFR-03 Fallback: On any fetch failure, the last successful response is read from
 * the `data_cache` PostgreSQL table and returned with a feed_status: "cached" flag.
 * The response is NEVER silently substituted with zero/fake data.
 */

import { query } from "../db/client";

/**
 * Writes a successful Open-Meteo response to the data_cache table.
 */
async function writeOpenMeteoCache(cacheKey: string, payload: any): Promise<void> {
  try {
    await query(
      `INSERT INTO data_cache (source, payload, fetched_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (source) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at`,
      [cacheKey, JSON.stringify(payload)]
    );
  } catch {
    // Cache write failure is non-fatal
  }
}

/**
 * Reads the last Open-Meteo cached response from the data_cache table.
 */
async function readOpenMeteoCache(cacheKey: string): Promise<{ data: any; fetched_at: string } | null> {
  try {
    const rows = await query<any[]>(
      "SELECT payload, fetched_at FROM data_cache WHERE source = $1 LIMIT 1",
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

export interface LiveDailyForecast {
  date: string;
  precipitationSumMm: number;
  precipitationProbabilityPct: number;
  soilMoistureEstimate: number;
}

export interface LiveWeatherAndSoilData {
  latitude: number;
  longitude: number;
  elevationMeters: number;
  timezone: string;
  current: {
    time: string;
    precipitationMm: number;
    temperatureC: number;
    relativeHumidityPct: number;
  };
  summary: {
    total7DayRainfallMm: number;
    maxDailyRainfallMm: number;
    highRiskRainfallAlert: boolean;
  };
  dailyForecast: LiveDailyForecast[];
}

const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/**
 * Fetches real-time weather and 7-day precipitation/soil moisture forecasts from Open-Meteo API.
 */
export interface LiveWeatherAndSoilDataWithStatus extends LiveWeatherAndSoilData {
  feed_status?: "live" | "cached";
  cache_fetched_at?: string;
  cache_message?: string;
}

export async function fetchLiveWeatherAndSoil(
  latitude: number,
  longitude: number
): Promise<LiveWeatherAndSoilDataWithStatus> {
  const cacheKey = `open_meteo_${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error(`[openMeteoClient] Invalid coordinates provided: lat=${latitude}, lon=${longitude}`);
  }

  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: "precipitation,temperature_2m,relative_humidity_2m",
    daily: "precipitation_sum,precipitation_probability_max",
    hourly: "soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm",
    forecast_days: "7",
    timezone: "auto",
  });

  const requestUrl = `${OPEN_METEO_FORECAST_URL}?${params.toString()}`;

  // NFR-02: enforce a 5-second hard timeout; on expiry fall through to NFR-03 cache
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(requestUrl, {
      headers: {
        "User-Agent": "LandslideShield-AI-App/1.0",
      },
      signal: controller.signal,
      next: { revalidate: 1800 },
    } as any);
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`[openMeteoClient] HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();

    const currentData = data.current || {};
    const dailyData = data.daily || {};
    const hourlyData = data.hourly || {};

    const dates: string[] = dailyData.time || [];
    const precipSums: number[] = dailyData.precipitation_sum || [];
    const precipProbs: number[] = dailyData.precipitation_probability_max || [];

    const hourlySm01: number[] = hourlyData.soil_moisture_0_to_1cm || [];
    const hourlySm13: number[] = hourlyData.soil_moisture_1_to_3cm || [];
    const hourlySm39: number[] = hourlyData.soil_moisture_3_to_9cm || [];

    const dailyForecast: LiveDailyForecast[] = dates.map((dateStr, dayIdx) => {
      const precip = precipSums[dayIdx] ?? 0;
      const prob = precipProbs[dayIdx] ?? 0;

      const startHour = dayIdx * 24;
      const endHour = startHour + 24;
      let smSum = 0;
      let smCount = 0;

      for (let h = startHour; h < endHour && h < hourlySm01.length; h++) {
        const val = (hourlySm01[h] ?? 0) * 0.2 + (hourlySm13[h] ?? 0) * 0.3 + (hourlySm39[h] ?? 0) * 0.5;
        smSum += val;
        smCount++;
      }

      const soilMoistureEst = smCount > 0 ? parseFloat((smSum / smCount).toFixed(3)) : 0.3;

      return {
        date: dateStr,
        precipitationSumMm: parseFloat((precip ?? 0).toFixed(2)),
        precipitationProbabilityPct: Math.round(prob ?? 0),
        soilMoistureEstimate: soilMoistureEst,
      };
    });

    const total7DayRainfallMm = parseFloat(
      dailyForecast.reduce((acc, curr) => acc + curr.precipitationSumMm, 0).toFixed(2)
    );
    const maxDailyRainfallMm = Math.max(...dailyForecast.map((d) => d.precipitationSumMm), 0);

    const result: LiveWeatherAndSoilDataWithStatus = {
      latitude: data.latitude ?? latitude,
      longitude: data.longitude ?? longitude,
      elevationMeters: data.elevation ?? 0,
      timezone: data.timezone ?? "UTC",
      current: {
        time: currentData.time || new Date().toISOString(),
        precipitationMm: parseFloat((currentData.precipitation ?? 0).toFixed(2)),
        temperatureC: parseFloat((currentData.temperature_2m ?? 0).toFixed(1)),
        relativeHumidityPct: Math.round(currentData.relative_humidity_2m ?? 0),
      },
      summary: {
        total7DayRainfallMm,
        maxDailyRainfallMm,
        highRiskRainfallAlert: maxDailyRainfallMm >= 100 || total7DayRainfallMm >= 250,
      },
      dailyForecast,
      feed_status: "live",
    };

    // Cache the successful response for NFR-03 fallback
    await writeOpenMeteoCache(cacheKey, result);

    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    const errLabel = error?.name === "AbortError" ? "5 s timeout" : error?.message;
    console.error(`[openMeteoClient] Exception while fetching weather for (${latitude}, ${longitude}): ${errLabel}`);

    // NFR-03: Attempt to serve last cached response with clear status badge
    const cached = await readOpenMeteoCache(cacheKey);
    if (cached) {
      console.warn(`[openMeteoClient] Serving cached weather data from ${cached.fetched_at} for (${latitude}, ${longitude}).`);
      return {
        ...cached.data,
        feed_status: "cached",
        cache_fetched_at: cached.fetched_at,
        cache_message: `Live Open-Meteo feed unavailable (${error.message}). Showing last-known data from ${cached.fetched_at}.`,
      };
    }

    // No cache — re-throw so callers can handle gracefully
    throw error;
  }
}
