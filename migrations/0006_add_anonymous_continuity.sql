ALTER TABLE pageview_events_raw ADD COLUMN anon_user_id TEXT NULL;
ALTER TABLE pageview_events_raw ADD COLUMN session_id TEXT NULL;
ALTER TABLE pageview_events_raw ADD COLUMN is_new_user INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pageview_events_raw_day_anon_user
  ON pageview_events_raw(received_day, anon_user_id);

CREATE INDEX IF NOT EXISTS idx_pageview_events_raw_day_session
  ON pageview_events_raw(received_day, session_id);

CREATE INDEX IF NOT EXISTS idx_pageview_events_raw_anon_user
  ON pageview_events_raw(anon_user_id);
