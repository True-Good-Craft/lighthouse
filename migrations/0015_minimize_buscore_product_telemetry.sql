DROP TRIGGER IF EXISTS trg_buscore_product_events_daily_after_insert;
DROP TABLE IF EXISTS buscore_product_events_raw;

CREATE TABLE IF NOT EXISTS buscore_product_event_dedup (
  event_id TEXT PRIMARY KEY,
  received_day TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_buscore_product_event_dedup_received_day
ON buscore_product_event_dedup(received_day);
