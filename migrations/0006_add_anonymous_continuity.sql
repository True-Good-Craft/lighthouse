-- Migration 0006: Add anonymous continuity fields to pageview_events_raw.
-- These columns and indexes were shipped in v1.9.0.
--
-- DRIFT NOTE (remediated in v1.9.1): After this migration was written, the
-- continuity columns (anon_user_id, session_id, is_new_user) and their indexes
-- were retroactively added to 0005_add_pageview_ingestion.sql, causing
-- ALTER TABLE failures on fresh installs when both migrations ran in sequence.
-- Migration 0005 has been restored to its original form (base table only).
-- This migration remains the correct and sole source for continuity columns.
--
-- OPERATOR RISK: If your environment applied a modified 0005 that already
-- includes these columns, running this migration will fail with
-- "duplicate column name". In that case, verify the columns exist and mark
-- this migration as applied in your D1 migrations table without re-running it.
ALTER TABLE pageview_events_raw ADD COLUMN anon_user_id TEXT NULL;
ALTER TABLE pageview_events_raw ADD COLUMN session_id TEXT NULL;
ALTER TABLE pageview_events_raw ADD COLUMN is_new_user INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pageview_events_raw_day_anon_user
  ON pageview_events_raw(received_day, anon_user_id);

CREATE INDEX IF NOT EXISTS idx_pageview_events_raw_day_session
  ON pageview_events_raw(received_day, session_id);

CREATE INDEX IF NOT EXISTS idx_pageview_events_raw_anon_user
  ON pageview_events_raw(anon_user_id);
