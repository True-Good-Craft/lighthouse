CREATE TABLE IF NOT EXISTS buscore_product_events_raw (
  event_id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  event_name TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  client_ts TEXT NOT NULL,
  app_version TEXT NOT NULL,
  release_channel TEXT NOT NULL,
  os_category TEXT NOT NULL,
  received_at TEXT NOT NULL,
  received_day TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_buscore_product_events_raw_received_day ON buscore_product_events_raw(received_day);
CREATE INDEX IF NOT EXISTS idx_buscore_product_events_raw_installation ON buscore_product_events_raw(installation_id, received_day);

CREATE TABLE IF NOT EXISTS buscore_product_events_daily (
  day TEXT NOT NULL,
  event_name TEXT NOT NULL,
  app_version TEXT NOT NULL,
  release_channel TEXT NOT NULL,
  os_category TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event_name, app_version, release_channel, os_category)
);

CREATE TABLE IF NOT EXISTS buscore_telemetry_rate_limit (
  minute_bucket TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (minute_bucket, ip_hash)
);
