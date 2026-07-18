CREATE TABLE IF NOT EXISTS artifact_traffic_daily (
  day TEXT NOT NULL,
  filename TEXT NOT NULL,
  release_version TEXT NOT NULL,
  raw_requests INTEGER NOT NULL DEFAULT 0,
  successful_responses INTEGER NOT NULL DEFAULT 0,
  full_responses INTEGER NOT NULL DEFAULT 0,
  partial_responses INTEGER NOT NULL DEFAULT 0,
  head_requests INTEGER NOT NULL DEFAULT 0,
  range_requests INTEGER NOT NULL DEFAULT 0,
  failed_requests INTEGER NOT NULL DEFAULT 0,
  response_bytes INTEGER NOT NULL DEFAULT 0,
  deduplicated_clients INTEGER NOT NULL DEFAULT 0,
  suppressed_repetitive_requests INTEGER NOT NULL DEFAULT 0,
  rate_limited_requests INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  cache_misses INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, filename, release_version)
);

CREATE INDEX IF NOT EXISTS idx_artifact_traffic_daily_day
  ON artifact_traffic_daily(day);

CREATE TABLE IF NOT EXISTS buscore_download_intent_daily (
  day TEXT PRIMARY KEY,
  raw_intent_events INTEGER NOT NULL DEFAULT 0,
  probable_human_intents INTEGER NOT NULL DEFAULT 0,
  suppressed_repetitive_intents INTEGER NOT NULL DEFAULT 0,
  successful_redirects INTEGER NOT NULL DEFAULT 0
);
