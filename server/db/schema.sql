-- LandslideShield AI Database Schema (MySQL)
-- Run this script against your MySQL server to initialize required tables.

CREATE DATABASE IF NOT EXISTS `landslideshield` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `landslideshield`;

-- 1. Monitored Geographic Zones
CREATE TABLE IF NOT EXISTS `zones` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `lat` DECIMAL(9, 6) NOT NULL,
  `lon` DECIMAL(9, 6) NOT NULL,
  `current_score` INT NOT NULL DEFAULT 0,
  `trend` ENUM('rising', 'stable', 'falling') NOT NULL DEFAULT 'stable',
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Risk Factor Percentage Breakdown (SHAP-based Feature Contributions)
CREATE TABLE IF NOT EXISTS `risk_factors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `zone_id` VARCHAR(64) NOT NULL,
  `rainfall_pct` DECIMAL(5, 2) NOT NULL,
  `soil_pct` DECIMAL(5, 2) NOT NULL,
  `slope_pct` DECIMAL(5, 2) NOT NULL,
  `history_pct` DECIMAL(5, 2) NOT NULL,
  `computed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_zone_computed` (`zone_id`, `computed_at`),
  CONSTRAINT `fk_risk_factors_zone` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Crowdsourced Citizen Hazard Reports
CREATE TABLE IF NOT EXISTS `citizen_reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `zone_id` VARCHAR(64) NULL,
  `photo_url` VARCHAR(512) NULL,
  `description` TEXT NOT NULL,
  `lat` DECIMAL(9, 6) NOT NULL,
  `lon` DECIMAL(9, 6) NOT NULL,
  `status` ENUM('pending', 'verified', 'resolved') NOT NULL DEFAULT 'pending',
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_report_zone` (`zone_id`),
  INDEX `idx_report_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Dispatched Emergency Warning Alerts
CREATE TABLE IF NOT EXISTS `alerts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `zone_id` VARCHAR(64) NOT NULL,
  `score_at_alert` INT NOT NULL,
  `level` VARCHAR(32) NOT NULL DEFAULT 'CRITICAL',
  `sent_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `email_sent` BOOLEAN NOT NULL DEFAULT FALSE,
  INDEX `idx_alert_zone` (`zone_id`),
  CONSTRAINT `fk_alerts_zone` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. External Data Feed Cache (NFR-03: Fallback for offline external APIs)
-- Stores the last successful API response payload for each data source so the
-- application can serve stale-but-real data instead of failing silently.
CREATE TABLE IF NOT EXISTS `data_cache` (
  `source` VARCHAR(64) NOT NULL PRIMARY KEY COMMENT 'Client identifier, e.g. open_meteo, open_topography, osm_overpass, sachet_ndma',
  `payload` LONGTEXT NOT NULL COMMENT 'JSON-serialized last successful API response',
  `fetched_at` DATETIME NOT NULL COMMENT 'UTC timestamp of last successful fetch',
  INDEX `idx_cache_fetched` (`fetched_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
