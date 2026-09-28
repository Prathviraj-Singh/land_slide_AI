-- LandslideShield AI Database Schema (PostgreSQL / Supabase)
-- Run this script against your PostgreSQL / Supabase instance to initialize required tables.

-- 1. Monitored Geographic Zones
CREATE TABLE IF NOT EXISTS zones (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  lat DECIMAL(9, 6) NOT NULL,
  lon DECIMAL(9, 6) NOT NULL,
  current_score INT NOT NULL DEFAULT 0,
  trend VARCHAR(16) NOT NULL DEFAULT 'stable',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Risk Factor Percentage Breakdown (SHAP-based Feature Contributions)
CREATE TABLE IF NOT EXISTS risk_factors (
  id SERIAL PRIMARY KEY,
  zone_id VARCHAR(64) NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  rainfall_pct DECIMAL(5, 2) NOT NULL,
  soil_pct DECIMAL(5, 2) NOT NULL,
  slope_pct DECIMAL(5, 2) NOT NULL,
  history_pct DECIMAL(5, 2) NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_zone_computed ON risk_factors (zone_id, computed_at);

-- 3. Crowdsourced Citizen Hazard Reports
CREATE TABLE IF NOT EXISTS citizen_reports (
  id SERIAL PRIMARY KEY,
  zone_id VARCHAR(64) NULL,
  photo_url VARCHAR(512) NULL,
  description TEXT NOT NULL,
  lat DECIMAL(9, 6) NOT NULL,
  lon DECIMAL(9, 6) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_report_zone ON citizen_reports (zone_id);
CREATE INDEX IF NOT EXISTS idx_report_status ON citizen_reports (status);

-- 4. Dispatched Emergency Warning Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  zone_id VARCHAR(64) NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  score_at_alert INT NOT NULL,
  level VARCHAR(32) NOT NULL DEFAULT 'CRITICAL',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_alert_zone ON alerts (zone_id);

-- 5. External Data Feed Cache (NFR-03: Fallback for offline external APIs)
CREATE TABLE IF NOT EXISTS data_cache (
  source VARCHAR(64) NOT NULL PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cache_fetched ON data_cache (fetched_at);
