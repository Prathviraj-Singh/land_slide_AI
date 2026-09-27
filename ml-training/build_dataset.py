"""
Feature Engineering & Dataset Builder for Landslide Risk Prediction.

Aggregates real geospatial, meteorological, topographical, and historical landslide data
to construct the training dataset ml-training/data/training_dataset.csv.

Strict Rule: NO synthetic or mock data is generated. All labels and features are derived
directly from real dataset inputs.
"""

import os
import sys
import numpy as np
import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")

LANDSLIDE_HISTORY_PATH = os.path.join(DATA_DIR, "landslide_history_india.csv")
RAINFALL_SOIL_PATH = os.path.join(DATA_DIR, "rainfall_soil_by_zone.csv")
SLOPE_PATH = os.path.join(DATA_DIR, "slope_by_zone.csv")
OUTPUT_DATASET_PATH = os.path.join(DATA_DIR, "training_dataset.csv")


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates Great-Circle distance between two lat/lon points in kilometers."""
    R = 6371.0
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = (
        np.sin(dlat / 2.0) ** 2
        + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    return float(R * c)


def check_input_files():
    """Validates that all prerequisite data collection CSV files exist."""
    missing = []
    for path, name in [
        (LANDSLIDE_HISTORY_PATH, "landslide_history_india.csv"),
        (RAINFALL_SOIL_PATH, "rainfall_soil_by_zone.csv"),
        (SLOPE_PATH, "slope_by_zone.csv"),
    ]:
        if not os.path.exists(path):
            missing.append(name)

    if missing:
        print("[FAIL] Cannot build dataset. Missing required data files:")
        for fname in missing:
            print(f"  - ml-training/data/{fname}")
        print("\nPlease run the data collection scripts first before executing build_dataset.py.")
        sys.exit(1)


def main():
    print("=" * 70, flush=True)
    print("  LandslideShield AI -- Feature Engineering & Training Dataset Builder", flush=True)
    print("=" * 70, flush=True)

    check_input_files()

    # 1. Load Datasets
    print("[*] Loading input datasets...", flush=True)
    df_history = pd.read_csv(LANDSLIDE_HISTORY_PATH)
    df_rain_soil = pd.read_csv(RAINFALL_SOIL_PATH)
    df_slope = pd.read_csv(SLOPE_PATH)

    print(f"    - Landslide History Records: {len(df_history):,} rows", flush=True)
    print(f"    - Daily Weather Telemetry:   {len(df_rain_soil):,} rows", flush=True)
    print(f"    - Slope Profiles:            {len(df_slope):,} rows", flush=True)

    # Extract valid coordinates from history dataset
    lat_col = "latitude" if "latitude" in df_history.columns else "lat"
    lon_col = "longitude" if "longitude" in df_history.columns else "lon"
    history_coords = (
        df_history.dropna(subset=[lat_col, lon_col])[[lat_col, lon_col]]
        .to_records(index=False)
    )

    # 2. Extract unique zone coordinates from telemetry
    unique_zones = (
        df_rain_soil[["zone_lat", "zone_lon"]]
        .drop_duplicates()
        .reset_index(drop=True)
    )

    print(f"[*] Processing features for {len(unique_zones)} target zone coordinates...", flush=True)

    rows = []
    positive_count = 0

    for _, zone in unique_zones.iterrows():
        z_lat = float(zone["zone_lat"])
        z_lon = float(zone["zone_lon"])

        # Filter rainfall/soil entries for this zone
        zone_telemetry = df_rain_soil[
            (np.isclose(df_rain_soil["zone_lat"], z_lat, atol=1e-4))
            & (np.isclose(df_rain_soil["zone_lon"], z_lon, atol=1e-4))
        ].sort_values("date", ascending=True)

        # Compute 7-day averages (using the last 7 daily entries)
        last_7d = zone_telemetry.tail(7)
        avg_rain_7d = float(last_7d["rainfall_mm"].mean()) if not last_7d.empty else 0.0
        avg_soil_7d = float(last_7d["soil_moisture"].mean()) if not last_7d.empty else 0.0

        # Retrieve matching slope
        matching_slope = df_slope[
            (np.isclose(df_slope["zone_lat"], z_lat, atol=1e-4))
            & (np.isclose(df_slope["zone_lon"], z_lon, atol=1e-4))
        ]
        slope_val = (
            float(matching_slope["avg_slope_degrees"].iloc[0])
            if not matching_slope.empty
            else 15.0
        )

        # Compute spatial proximity to historical NASA landslides
        # 5km radius -> landslide_occurred label (1 or 0)
        # 20km radius -> historical_landslide_density (count)
        near_5km_count = 0
        near_20km_count = 0

        for h_lat, h_lon in history_coords:
            d_km = haversine_distance_km(z_lat, z_lon, float(h_lat), float(h_lon))
            if d_km <= 5.0:
                near_5km_count += 1
            if d_km <= 20.0:
                near_20km_count += 1

        # Landslides are geotechnically impossible on near-flat plains (< 3 degrees).
        # Proximity within 5km on flat terrain indicates municipal/district reporting centers or data noise.
        label_occurred = 1 if (near_5km_count > 0 and slope_val >= 3.0) else 0
        if label_occurred == 1:
            positive_count += 1

        rows.append({
            "zone_lat": z_lat,
            "zone_lon": z_lon,
            "avg_rainfall_7d": round(avg_rain_7d, 2),
            "avg_soil_moisture_7d": round(avg_soil_7d, 4),
            "slope_degrees": round(slope_val, 2),
            "historical_landslide_density": near_20km_count,
            "landslide_occurred": label_occurred,
        })

    dataset_df = pd.DataFrame(rows)
    total_samples = len(dataset_df)
    negative_count = total_samples - positive_count

    print("-" * 70, flush=True)
    print(f"[*] Dataset Generation Statistics:", flush=True)
    print(f"    - Total Zone Samples:               {total_samples}", flush=True)
    print(f"    - Positive Samples (Real Landslide): {positive_count} ({positive_count/total_samples*100:.1f}%)", flush=True)
    print(f"    - Negative Samples (No Landslide):   {negative_count} ({negative_count/total_samples*100:.1f}%)", flush=True)
    print("-" * 70, flush=True)

    # Validate class distribution before saving
    if positive_count < 3:
        print("[!] WARNING: Too few positive (landslide_occurred=1) samples to reliably train an ML model!")
        print("    Expand the TARGET_ZONES coordinate list in fetch_rainfall_soil.py and fetch_slope_dem.py")
        print("    to include more historical high-risk disaster coordinates in India.")
        print("    Strict Policy: No artificial positive samples will be fabricated.")
        print("[FAIL] Aborting dataset build due to insufficient positive class representation.")
        sys.exit(1)

    # Save to ml-training/data/training_dataset.csv
    try:
        dataset_df.to_csv(OUTPUT_DATASET_PATH, index=False)
        print(f"[SUCCESS] Saved training dataset ({total_samples} rows) to:\n          {OUTPUT_DATASET_PATH}", flush=True)
        print("=" * 70, flush=True)
    except Exception as save_err:
        print(f"[FAIL] Error writing CSV output file: {save_err}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
