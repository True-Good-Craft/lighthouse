-- Migration 0008: Add site_event_rate_limit for /metrics/event ingestion noise control.
-- Mirrors pageview_rate_limit semantics: per-minute counters keyed by hashed IP.
CREATE TABLE IF NOT EXISTS site_event_rate_limit (
  minute_bucket TEXT    NOT NULL,
  ip_hash       TEXT    NOT NULL,
  count         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(minute_bucket, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_site_event_rate_limit_bucket
  ON site_event_rate_limit(minute_bucket);
