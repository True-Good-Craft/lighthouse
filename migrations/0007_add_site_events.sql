-- Migration 0007: Add site_events_raw table for multi-site event ingestion.
-- Shipped in v1.10.0 as part of the tracked-site foundation.
--
-- This table stores normalized events from any registered tracked site,
-- keyed by site_key and event_name for future per-site report isolation.
-- Raw retention and privacy semantics mirror pageview_events_raw.
CREATE TABLE IF NOT EXISTS site_events_raw (
  id              TEXT    PRIMARY KEY,
  site_key        TEXT    NOT NULL,
  event_name      TEXT    NOT NULL,
  received_at     TEXT    NOT NULL,
  received_day    TEXT    NOT NULL,
  client_ts       TEXT    NULL,
  path            TEXT    NULL,
  url             TEXT    NULL,
  referrer        TEXT    NULL,
  referrer_domain TEXT    NULL,
  src             TEXT    NULL,
  utm_source      TEXT    NULL,
  utm_medium      TEXT    NULL,
  utm_campaign    TEXT    NULL,
  utm_content     TEXT    NULL,
  device          TEXT    NULL,
  viewport        TEXT    NULL,
  lang            TEXT    NULL,
  tz              TEXT    NULL,
  anon_user_id    TEXT    NULL,
  session_id      TEXT    NULL,
  is_new_user     INTEGER NOT NULL DEFAULT 0,
  event_value     TEXT    NULL,
  test_mode       INTEGER NOT NULL DEFAULT 0,
  country         TEXT    NULL,
  ip_hash         TEXT    NULL,
  user_agent_hash TEXT    NULL,
  accepted        INTEGER NOT NULL DEFAULT 1,
  drop_reason     TEXT    NULL,
  request_id      TEXT    NULL,
  ingest_version  TEXT    NULL
);

CREATE INDEX IF NOT EXISTS idx_site_events_raw_site_day
  ON site_events_raw(site_key, received_day);

CREATE INDEX IF NOT EXISTS idx_site_events_raw_received_day
  ON site_events_raw(received_day);
