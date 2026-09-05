-- Aggregate counts only. No raw events, identity or source-to-action joins.
-- Apply only after owner approval; retain for 400 UTC day buckets.
CREATE TABLE IF NOT EXISTS kfh_daily (
  day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  metric TEXT NOT NULL,
  value TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (typeof(count) = 'integer' AND count > 0),
  PRIMARY KEY (day, metric, value),
  CHECK (
    (metric = 'event' AND value IN ('page_views', 'resource_calls', 'help_211', 'directions', 'official_sources', 'pwa_installs')) OR
    (metric = 'source' AND value IN ('direct_unknown', 'facebook', 'community', 'search', 'other')) OR
    (metric = 'campaign' AND value IN ('none', 'launch_2026_09')) OR
    (metric = 'content' AND value IN ('none', 'post_01', 'poster_01'))
  )
) WITHOUT ROWID;
