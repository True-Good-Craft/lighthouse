CREATE TABLE IF NOT EXISTS buscore_traffic_daily (
  day              TEXT    PRIMARY KEY,
  visits           INTEGER NULL,
  pageviews        INTEGER NOT NULL,
  referrer_summary TEXT    NULL,
  captured_at      TEXT    NOT NULL
);