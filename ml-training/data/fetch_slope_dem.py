"""
Digital Elevation Model (DEM) and Slope Calculator.

Fetches real terrain elevation grids for 130 zones in India
via OpenTopography (or Open-Meteo DEM API), calculates spatial elevation gradients
using NumPy, and exports real slope degrees to ml-training/data/slope_by_zone.csv.
"""

import os
import sys
import time
import requests
import numpy as np
import pandas as pd

# Load .env file if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

TARGET_ZONES = [
    # ── HIMACHAL PRADESH (HIGH-RISK) ─────────────────────────────────────────
    {"name": "Shimla, HP", "lat": 31.1048, "lon": 77.1734},
    {"name": "Dharamshala, HP", "lat": 32.2190, "lon": 76.3234},
    {"name": "Kullu/Manali, HP", "lat": 31.9579, "lon": 77.1095},
    {"name": "Mandi, HP", "lat": 31.7084, "lon": 76.9314},
    {"name": "Chamba, HP", "lat": 32.5534, "lon": 76.1258},
    {"name": "Kinnaur (Kalpa), HP", "lat": 31.5302, "lon": 78.2580},
    {"name": "Rampur Bushahr, HP", "lat": 31.4527, "lon": 77.6290},
    {"name": "Solan, HP", "lat": 30.9045, "lon": 77.0967},
    {"name": "Sundernagar, HP", "lat": 31.5218, "lon": 76.9054},
    {"name": "Keylong, Lahaul, HP", "lat": 32.5714, "lon": 77.0404},
    {"name": "Kangra, HP", "lat": 32.0998, "lon": 76.2691},
    {"name": "Kasauli, HP", "lat": 30.8981, "lon": 76.9644},

    # ── UTTARAKHAND (HIGH-RISK) ──────────────────────────────────────────────
    {"name": "Joshimath, UK", "lat": 30.5564, "lon": 79.5664},
    {"name": "Kedarnath, UK", "lat": 30.7352, "lon": 79.0669},
    {"name": "Nainital, UK", "lat": 29.3919, "lon": 79.4542},
    {"name": "Chamoli, UK", "lat": 30.4137, "lon": 79.3308},
    {"name": "Uttarkashi, UK", "lat": 30.7268, "lon": 78.4354},
    {"name": "Pithoragarh, UK", "lat": 29.5829, "lon": 80.2182},
    {"name": "Rudraprayag, UK", "lat": 30.2840, "lon": 78.9834},
    {"name": "Tehri Garhwal, UK", "lat": 30.3752, "lon": 78.4337},
    {"name": "Bageshwar, UK", "lat": 29.8339, "lon": 79.7697},
    {"name": "Almora, UK", "lat": 29.5892, "lon": 79.6467},
    {"name": "Gopeshwar, UK", "lat": 30.4100, "lon": 79.3200},
    {"name": "Munsiyari, UK", "lat": 30.0664, "lon": 80.2381},
    {"name": "Rishikesh slopes, UK", "lat": 30.0869, "lon": 78.2676},
    {"name": "Mussoorie, UK", "lat": 30.4598, "lon": 78.0644},

    # ── JAMMU & KASHMIR (HIGH-RISK) ──────────────────────────────────────────
    {"name": "Ramban (J-S Hwy), J&K", "lat": 33.2422, "lon": 75.2444},
    {"name": "Banihal, J&K", "lat": 33.4367, "lon": 75.1975},
    {"name": "Doda, J&K", "lat": 33.1483, "lon": 75.5472},
    {"name": "Kishtwar, J&K", "lat": 33.3124, "lon": 75.7694},
    {"name": "Poonch, J&K", "lat": 33.7736, "lon": 74.0931},
    {"name": "Anantnag, J&K", "lat": 33.7311, "lon": 75.1547},

    # ── SIKKIM (HIGH-RISK) ───────────────────────────────────────────────────
    {"name": "Gangtok, Sikkim", "lat": 27.3389, "lon": 88.6065},
    {"name": "Mangan, North Sikkim", "lat": 27.5097, "lon": 88.5279},
    {"name": "Lachung, Sikkim", "lat": 27.6930, "lon": 88.7470},
    {"name": "Namchi, South Sikkim", "lat": 27.1654, "lon": 88.3618},
    {"name": "Singtam, Sikkim", "lat": 27.2337, "lon": 88.5038},
    {"name": "Rangpo, Sikkim", "lat": 27.1756, "lon": 88.5319},

    # ── DARJEELING HILLS / WEST BENGAL (HIGH-RISK) ───────────────────────────
    {"name": "Darjeeling, WB", "lat": 27.0410, "lon": 88.2663},
    {"name": "Kalimpong, WB", "lat": 27.0667, "lon": 88.4667},
    {"name": "Kurseong, WB", "lat": 26.8829, "lon": 88.2782},
    {"name": "Mirik, WB", "lat": 26.8868, "lon": 88.1833},
    {"name": "Siliguri foothills, WB", "lat": 26.7271, "lon": 88.3953},

    # ── ARUNACHAL PRADESH (HIGH-RISK) ────────────────────────────────────────
    {"name": "Itanagar, Arunachal Pradesh", "lat": 27.0844, "lon": 93.6053},
    {"name": "Tawang, Arunachal Pradesh", "lat": 27.5860, "lon": 91.8687},
    {"name": "Bomdila, Arunachal Pradesh", "lat": 27.2645, "lon": 92.4159},
    {"name": "Along, Arunachal Pradesh", "lat": 28.1653, "lon": 94.7590},

    # ── MEGHALAYA / ASSAM HILLS (HIGH-RISK) ──────────────────────────────────
    {"name": "Shillong, Meghalaya", "lat": 25.5788, "lon": 91.8933},
    {"name": "Cherrapunji, Meghalaya", "lat": 25.2969, "lon": 91.7322},
    {"name": "Haflong, Assam (Dima Hasao)", "lat": 25.1653, "lon": 93.0127},
    {"name": "Lumding Hills, Assam", "lat": 25.7474, "lon": 93.1697},
    {"name": "Jowai, Meghalaya", "lat": 25.4519, "lon": 92.2020},

    # ── NAGALAND / MANIPUR / MIZORAM HILLS (HIGH-RISK) ───────────────────────
    {"name": "Kohima, Nagaland", "lat": 25.6701, "lon": 94.1077},
    {"name": "Dimapur foothills, Nagaland", "lat": 25.9079, "lon": 93.7273},
    {"name": "Imphal East hills, Manipur", "lat": 24.7952, "lon": 93.9516},
    {"name": "Churachandpur, Manipur", "lat": 24.3299, "lon": 93.6774},
    {"name": "Aizawl, Mizoram", "lat": 23.7271, "lon": 92.7176},
    {"name": "Lunglei, Mizoram", "lat": 22.8873, "lon": 92.7289},
    {"name": "Champhai, Mizoram", "lat": 23.4567, "lon": 93.3266},

    # ── WESTERN GHATS — KERALA (HIGH-RISK) ───────────────────────────────────
    {"name": "Chooralmala/Meppadi, Wayanad, Kerala", "lat": 11.5540, "lon": 76.1300},
    {"name": "Munnar, Idukki, Kerala", "lat": 10.0889, "lon": 77.0595},
    {"name": "Kattippara, Kozhikode, Kerala", "lat": 11.4083, "lon": 75.9475},
    {"name": "Peermedu, Idukki, Kerala", "lat": 9.5713, "lon": 76.9881},
    {"name": "Devikulam, Idukki, Kerala", "lat": 10.0578, "lon": 77.1011},
    {"name": "Vagamon, Kerala", "lat": 9.6856, "lon": 76.9034},

    # ── WESTERN GHATS — KARNATAKA (HIGH-RISK) ───────────────────────────────
    {"name": "Madikeri, Coorg, Karnataka", "lat": 12.4244, "lon": 75.7382},
    {"name": "Agumbe, Shivamogga, Karnataka", "lat": 13.5042, "lon": 75.0931},
    {"name": "Chikmagalur, Karnataka", "lat": 13.3161, "lon": 75.7720},
    {"name": "Sakleshpur, Karnataka", "lat": 12.9424, "lon": 75.7852},
    {"name": "Siddapura, Uttara Kannada, Karnataka", "lat": 14.3497, "lon": 74.8885},

    # ── WESTERN GHATS — TAMIL NADU (HIGH-RISK) ──────────────────────────────
    {"name": "Nilgiris (Coonoor/Ooty), TN", "lat": 11.4102, "lon": 76.6950},
    {"name": "Kodaikanal, TN", "lat": 10.2381, "lon": 77.4892},
    {"name": "Valparai, TN", "lat": 10.3260, "lon": 76.9495},
    {"name": "Gudalur, Nilgiris, TN", "lat": 11.5009, "lon": 76.4895},

    # ── WESTERN GHATS — MAHARASHTRA / GOA (HIGH-RISK) ───────────────────────
    {"name": "Mahabaleshwar, Maharashtra", "lat": 17.9237, "lon": 73.6586},
    {"name": "Ratnagiri/Chiplun, Maharashtra", "lat": 17.5323, "lon": 73.5186},
    {"name": "Ambeghat/Tamhini, Maharashtra", "lat": 18.4558, "lon": 73.4192},
    {"name": "Lonavala/Khandala, Maharashtra", "lat": 18.7546, "lon": 73.4062},
    {"name": "Igatpuri, Maharashtra", "lat": 19.6950, "lon": 73.5626},
    {"name": "Matheran, Maharashtra", "lat": 18.9866, "lon": 73.2669},
    {"name": "Malshej Ghat, Maharashtra", "lat": 19.3502, "lon": 73.7831},

    # ═══════════════════════════════════════════════════════════════════════
    # STABLE / LOW-RISK REFERENCE POINTS (plains, plateaus, dry zones)
    # ═══════════════════════════════════════════════════════════════════════

    # ── Indo-Gangetic Plains ─────────────────────────────────────────────────
    {"name": "Lucknow, UP (plains)", "lat": 26.8467, "lon": 80.9462},
    {"name": "Kanpur, UP (plains)", "lat": 26.4499, "lon": 80.3319},
    {"name": "Patna, Bihar (plains)", "lat": 25.5941, "lon": 85.1376},
    {"name": "Varanasi, UP (plains)", "lat": 25.3176, "lon": 82.9739},
    {"name": "Prayagraj, UP (plains)", "lat": 25.4358, "lon": 81.8463},
    {"name": "Gorakhpur, UP (plains)", "lat": 26.7606, "lon": 83.3732},
    {"name": "Bareilly, UP (plains)", "lat": 28.3670, "lon": 79.4304},
    {"name": "Meerut, UP (plains)", "lat": 28.9845, "lon": 77.7064},

    # ── Rajasthan (arid/flat) ────────────────────────────────────────────────
    {"name": "Jaipur, Rajasthan (dry)", "lat": 26.9124, "lon": 75.7873},
    {"name": "Jodhpur, Rajasthan (arid)", "lat": 26.2389, "lon": 73.0243},
    {"name": "Bikaner, Rajasthan (desert)", "lat": 28.0229, "lon": 73.3119},
    {"name": "Udaipur, Rajasthan (plateau)", "lat": 24.5854, "lon": 73.7125},
    {"name": "Kota, Rajasthan (flat)", "lat": 25.2138, "lon": 75.8648},

    # ── Deccan Plateau / Central India ───────────────────────────────────────
    {"name": "Nagpur, Maharashtra (plateau)", "lat": 21.1458, "lon": 79.0882},
    {"name": "Hyderabad, Telangana (plateau)", "lat": 17.3850, "lon": 78.4867},
    {"name": "Bengaluru, Karnataka (plateau)", "lat": 12.9716, "lon": 77.5946},
    {"name": "Bhopal, MP (plateau)", "lat": 23.2599, "lon": 77.4126},
    {"name": "Indore, MP (plateau)", "lat": 22.7196, "lon": 75.8577},
    {"name": "Raipur, Chhattisgarh (plains)", "lat": 21.2514, "lon": 81.6296},
    {"name": "Pune city, Maharashtra (urban plateau)", "lat": 18.5204, "lon": 73.8567},
    {"name": "Aurangabad, Maharashtra (plateau)", "lat": 19.8762, "lon": 75.3433},
    {"name": "Akola, Maharashtra (flat)", "lat": 20.7002, "lon": 77.0082},
    {"name": "Amravati, Maharashtra (flat)", "lat": 20.9374, "lon": 77.7796},

    # ── Coastal plains / Lowlands ────────────────────────────────────────────
    {"name": "Chennai, TN (coastal)", "lat": 13.0827, "lon": 80.2707},
    {"name": "Visakhapatnam, AP (coast)", "lat": 17.6868, "lon": 83.2185},
    {"name": "Bhubaneswar, Odisha (coast)", "lat": 20.2961, "lon": 85.8245},
    {"name": "Kolkata, WB (delta)", "lat": 22.5726, "lon": 88.3639},
    {"name": "Ahmedabad, Gujarat (flat)", "lat": 23.0225, "lon": 72.5714},
    {"name": "Surat, Gujarat (flat coast)", "lat": 21.1702, "lon": 72.8311},

    # ── Punjab / Haryana (flat alluvial) ─────────────────────────────────────
    {"name": "Chandigarh (foothills/plains)", "lat": 30.7333, "lon": 76.7794},
    {"name": "Ludhiana, Punjab (plains)", "lat": 30.9010, "lon": 75.8573},
    {"name": "Amritsar, Punjab (plains)", "lat": 31.6340, "lon": 74.8723},
    {"name": "Hisar, Haryana (flat)", "lat": 29.1492, "lon": 75.7217},
    {"name": "Karnal, Haryana (flat)", "lat": 29.6857, "lon": 76.9905},

    # ── NE India (low-risk valley/plains) ────────────────────────────────────
    {"name": "Guwahati, Assam (valley)", "lat": 26.1445, "lon": 91.7362},
    {"name": "Jorhat, Assam (plains)", "lat": 26.7509, "lon": 94.2037},
    {"name": "Tezpur, Assam (valley)", "lat": 26.6338, "lon": 92.7840},
    {"name": "Silchar, Assam (valley)", "lat": 24.8333, "lon": 92.7789},
    {"name": "Agartala, Tripura (low hills)", "lat": 23.8315, "lon": 91.2868},

    # ── South India dry interior ─────────────────────────────────────────────
    {"name": "Madurai, TN (dry inland)", "lat": 9.9252, "lon": 78.1198},
    {"name": "Tiruchirappalli, TN (dry)", "lat": 10.7905, "lon": 78.7047},
    {"name": "Mysuru, Karnataka (mild plateau)", "lat": 12.2958, "lon": 76.6394},
    {"name": "Bellary, Karnataka (dry)", "lat": 15.1394, "lon": 76.9214},
    {"name": "Tirupati, AP (dry hills)", "lat": 13.6288, "lon": 79.4192},
]

OPENTOPOGRAPHY_API_URL = "https://portal.opentopography.org/API/globaldem"
OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"
OUTPUT_FILENAME = "slope_by_zone.csv"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(SCRIPT_DIR, OUTPUT_FILENAME)


def calculate_slope_from_grid(grid: np.ndarray, cellstep_deg: float, center_lat: float) -> float:
    """Calculates mean slope angle in degrees from a 2D elevation grid using NumPy gradients."""
    lat_rad = np.radians(center_lat)
    dy = cellstep_deg * 111320.0
    dx = cellstep_deg * 111320.0 * np.cos(lat_rad)

    gy, gx = np.gradient(grid, dy, dx)
    slope_rad = np.arctan(np.sqrt(gx**2 + gy**2))
    slope_deg = np.degrees(slope_rad)

    return round(float(np.nanmean(slope_deg)), 2)


def fetch_slope_openmeteo(lat: float, lon: float, grid_size: int = 5, step: float = 0.001) -> float:
    """Fetches a real elevation grid via Open-Meteo Elevation API and calculates slope."""
    half = grid_size // 2
    lats = [lat + (r - half) * step for r in range(grid_size) for _ in range(grid_size)]
    lons = [lon + (c - half) * step for _ in range(grid_size) for c in range(grid_size)]

    params = {
        "latitude": ",".join(f"{x:.5f}" for x in lats),
        "longitude": ",".join(f"{y:.5f}" for y in lons),
    }

    max_retries = 4
    for attempt in range(max_retries):
        try:
            res = requests.get(OPEN_METEO_ELEVATION_URL, params=params, timeout=20)
            if res.status_code == 429:
                wait_time = 2.5 * (attempt + 1)
                time.sleep(wait_time)
                continue
            res.raise_for_status()
            data = res.json()

            elevations = data.get("elevation", [])
            if len(elevations) != grid_size * grid_size:
                raise ValueError("Invalid elevation data length returned from API.")

            grid = np.array(elevations, dtype=float).reshape((grid_size, grid_size))
            return calculate_slope_from_grid(grid, step, lat)
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(2.0 * (attempt + 1))
    raise RuntimeError("Failed after max retries")


def fetch_slope_opentopography(lat: float, lon: float, api_key: str, delta: float = 0.005) -> float:
    """Fetches SRTM DEM raster from OpenTopography API and calculates slope."""
    params = {
        "demtype": "SRTMGL1",
        "south": round(lat - delta, 5),
        "north": round(lat + delta, 5),
        "west": round(lon - delta, 5),
        "east": round(lon + delta, 5),
        "outputFormat": "AAIGrid",
        "API_Key": api_key,
    }
    res = requests.get(OPENTOPOGRAPHY_API_URL, params=params, timeout=30)
    if res.status_code in [401, 403] or "Unauthorized" in res.text:
        raise ValueError("Unauthorized OpenTopography API key.")
    res.raise_for_status()

    # Parse AAIGrid format
    lines = res.text.strip().splitlines()
    header = {}
    data_start = 0
    for i, line in enumerate(lines[:10]):
        parts = line.strip().split()
        if len(parts) == 2:
            key, val = parts[0].lower(), parts[1]
            try:
                header[key] = float(val)
                data_start = i + 1
            except ValueError:
                break

    grid_data = np.loadtxt(lines[data_start:], dtype=float)
    cellsize_deg = header.get("cellsize", 0.000277777777777778)
    nodata_val = header.get("nodata_value", -9999)
    grid_data[grid_data == nodata_val] = np.nan

    return calculate_slope_from_grid(grid_data, cellsize_deg, lat)


def main():
    print("=" * 70, flush=True)
    print("  LandslideShield AI -- DEM Terrain & Slope Calculator", flush=True)
    print("=" * 70, flush=True)

    api_key = os.getenv("OPENTOPOGRAPHY_API_KEY", "").strip()

    if api_key:
        print(f"[*] OpenTopography API Key Detected: {api_key[:4]}...{api_key[-4:] if len(api_key)>8 else ''}", flush=True)
    else:
        print("[!] OPENTOPOGRAPHY_API_KEY not set -- using Open-Meteo DEM Elevation Grid.", flush=True)

    # Resume from existing results if available
    existing_map = {}
    if os.path.exists(OUTPUT_PATH):
        try:
            old_df = pd.read_csv(OUTPUT_PATH)
            for _, r in old_df.iterrows():
                existing_map[(round(float(r["zone_lat"]), 4), round(float(r["zone_lon"]), 4))] = float(r["avg_slope_degrees"])
            print(f"[*] Found {len(existing_map)} pre-existing slope calculations in CSV.", flush=True)
        except Exception:
            pass

    print(f"[*] Calculating slope degrees for {len(TARGET_ZONES)} target zones...", flush=True)

    results = []
    successful = 0

    for idx, zone in enumerate(TARGET_ZONES, start=1):
        name = zone["name"]
        lat = zone["lat"]
        lon = zone["lon"]
        coord_key = (round(lat, 4), round(lon, 4))

        if coord_key in existing_map:
            slope = existing_map[coord_key]
            results.append({
                "zone_lat": lat,
                "zone_lon": lon,
                "avg_slope_degrees": slope
            })
            successful += 1
            print(f"[{idx:02d}/{len(TARGET_ZONES):02d}] {name} ({lat:.4f}, {lon:.4f}) -> [CACHED] Slope: {slope:.2f}\u00b0", flush=True)
            continue

        print(f"[{idx:02d}/{len(TARGET_ZONES):02d}] Computing slope for {name} ({lat:.4f}, {lon:.4f})...", end="", flush=True)

        slope = None
        if api_key:
            try:
                slope = fetch_slope_opentopography(lat, lon, api_key)
            except Exception as e:
                print(f" (OpenTopography failed: {e}, falling back to Open-Meteo DEM)...", end="", flush=True)

        if slope is None:
            try:
                slope = fetch_slope_openmeteo(lat, lon)
            except Exception as e:
                print(f" [FAIL] Failed: {e}", flush=True)
                continue

        results.append({
            "zone_lat": lat,
            "zone_lon": lon,
            "avg_slope_degrees": slope
        })
        successful += 1
        print(f" [OK] Slope: {slope:.2f}\u00b0", flush=True)
        time.sleep(0.3)

    if not results:
        print("[FAIL] Could not calculate slope for any zone.", flush=True)
        sys.exit(1)

    df_out = pd.DataFrame(results)
    try:
        df_out.to_csv(OUTPUT_PATH, index=False)
        print("=" * 70, flush=True)
        print(f"[SUCCESS] Saved slope dataset ({len(df_out)} zones) to:\n          {OUTPUT_PATH}", flush=True)
        print("=" * 70, flush=True)
    except Exception as err:
        print(f"[FAIL] Error saving output file: {err}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
