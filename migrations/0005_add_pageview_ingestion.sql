CREATE TABLE IF NOT EXISTS pageview_events_raw (
  id              TEXT    PRIMARY KEY,
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
  country         TEXT    NULL,
  js_fired        INTEGER NOT NULL DEFAULT 1,
  ip_hash         TEXT    NULL,
  user_agent_hash TEXT    NULL,
  accepted        INTEGER NOT NULL DEFAULT 1,
  drop_reason     TEXT    NULL,
  request_id      TEXT    NULL,
  ingest_version  TEXT    NULL
);

CREATE INDEX IF NOT EXISTS idx_pageview_events_raw_received_day
  ON pageview_events_raw(received_day);

CREATE TABLE IF NOT EXISTS pageview_daily (
  day                  TEXT    PRIMARY KEY,
  pageviews            INTEGER NOT NULL DEFAULT 0,
  accepted             INTEGER NOT NULL DEFAULT 0,
  dropped_rate_limited INTEGER NOT NULL DEFAULT 0,
  dropped_invalid      INTEGER NOT NULL DEFAULT 0,
  last_received_at     TEXT    NULL
);

CREATE TABLE IF NOT EXISTS pageview_daily_dim (
  day       TEXT    NOT NULL,
  dim_type  TEXT    NOT NULL,
  dim_value TEXT    NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day, dim_type, dim_value)
);

CREATE INDEX IF NOT EXISTS idx_pageview_daily_dim_type_day
  ON pageview_daily_dim(dim_type, day);

CREATE TABLE IF NOT EXISTS pageview_rate_limit (
  minute_bucket TEXT    NOT NULL,
  ip_hash       TEXT    NOT NULL,
  count         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(minute_bucket, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_pageview_rate_limit_bucket
  ON pageview_rate_limit(minute_bucket);