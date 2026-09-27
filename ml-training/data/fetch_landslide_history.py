"""
NASA Global Landslide Catalog (GLC) Data Ingestion Script.

Downloads historical landslide records from NASA Open Data,
filters specifically for events located within India, and saves the
cleaned subset for ML feature training and geospatial proximity analysis.
"""

import os
import sys
import io
import requests
import pandas as pd

# Primary URL specified in requirements & official fallback mirror
PRIMARY_URL = "https://data.nasa.gov/api/views/dd9e-wu2v/rows.csv?accessType=DOWNLOAD"
FALLBACK_URL = "https://data.nasa.gov/docs/legacy/Global_Landslide_Catalog_Export/Global_Landslide_Catalog_Export_rows.csv"

OUTPUT_FILENAME = "landslide_history_india.csv"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(SCRIPT_DIR, OUTPUT_FILENAME)


def download_csv(url: str, timeout: int = 15) -> bytes:
    """Download CSV content over HTTP with headers."""
    headers = {
        "User-Agent": "LandslideShield-AI/1.0 (Earth Observation System)"
    }
    response = requests.get(url, headers=headers, stream=True, timeout=timeout)
    response.raise_for_status()
    return response.content


def main():
    print("=" * 70, flush=True)
    print("  LandslideShield AI -- NASA Global Landslide Catalog Downloader", flush=True)
    print("=" * 70, flush=True)

    csv_data = None

    print(f"[*] Attempting download from primary NASA endpoint:\n    {PRIMARY_URL}", flush=True)
    try:
        csv_data = download_csv(PRIMARY_URL, timeout=5)
        print("    [OK] Successfully downloaded from primary URL.", flush=True)
    except Exception as e:
        print(f"    [!] Primary URL unreachable ({e}).", flush=True)
        print(f"[*] Falling back to NASA legacy catalog export:\n    {FALLBACK_URL}", flush=True)
        try:
            csv_data = download_csv(FALLBACK_URL, timeout=45)
            print("    [OK] Successfully downloaded from fallback NASA URL.", flush=True)
        except Exception as fallback_err:
            print(f"    [FAIL] Error: Failed to download dataset from fallback URL: {fallback_err}", flush=True)
            sys.exit(1)

    # Load dataset into pandas dataframe
    print("[*] Parsing CSV data into DataFrame...", flush=True)
    try:
        df = pd.read_csv(io.BytesIO(csv_data), low_memory=False)
    except Exception as err:
        print(f"[FAIL] Error parsing downloaded CSV: {err}", flush=True)
        sys.exit(1)

    total_records = len(df)
    print(f"[OK] Raw dataset loaded: {total_records:,} global landslide events.", flush=True)

    # Locate the country column (varies slightly across catalog revisions)
    country_col = None
    for candidate in ["country_name", "country", "country_code"]:
        if candidate in df.columns:
            country_col = candidate
            break

    if not country_col:
        print(f"[FAIL] Error: Could not locate a recognizable country column. Found columns: {list(df.columns)}", flush=True)
        sys.exit(1)

    print(f"[*] Filtering records for India using column '{country_col}'...", flush=True)

    # Filter for India (name or country code 'IN')
    if country_col == "country_code":
        india_mask = df[country_col].astype(str).str.strip().str.upper() == "IN"
    else:
        india_mask = (
            df[country_col].astype(str).str.strip().str.lower() == "india"
        ) | (
            df.get("country_code", pd.Series(dtype=str)).astype(str).str.strip().str.upper() == "IN"
        )

    india_df = df[india_mask].copy()
    india_count = len(india_df)

    if india_count == 0:
        print("[!] Warning: Zero rows matched country filter 'India'. Please inspect dataset.", flush=True)
    else:
        print(f"[OK] Filtered successfully: {india_count:,} records found for India.", flush=True)

    # Ensure coordinates are numeric and valid
    lat_col = "latitude" if "latitude" in india_df.columns else "lat"
    lon_col = "longitude" if "longitude" in india_df.columns else "lon"
    if lat_col in india_df.columns and lon_col in india_df.columns:
        india_df[lat_col] = pd.to_numeric(india_df[lat_col], errors="coerce")
        india_df[lon_col] = pd.to_numeric(india_df[lon_col], errors="coerce")
        valid_coords = india_df.dropna(subset=[lat_col, lon_col])
        print(f"[OK] Records with valid geospatial coordinates: {len(valid_coords):,}", flush=True)

    # Save output to ml-training/data/landslide_history_india.csv
    try:
        india_df.to_csv(OUTPUT_PATH, index=False)
        print(f"[SUCCESS] Saved cleaned dataset to: {OUTPUT_PATH}", flush=True)
        print("=" * 70, flush=True)
        print(f"SUMMARY: Processed {total_records:,} global rows -> {india_count:,} India landslide events saved.", flush=True)
        print("=" * 70, flush=True)
    except Exception as err:
        print(f"[FAIL] Failed to save CSV file to {OUTPUT_PATH}: {err}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
