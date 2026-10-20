-- Apply after owner approval and before the 1.37 Worker is promoted.
-- Additive: no existing table, row or constraint changes; rollback Workers ignore it.
-- "Did this help?" answers as plain daily totals only. No listing, visit token, labels or raw events.
CREATE TABLE IF NOT EXISTS kfh_feedback_daily (
  day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  answer TEXT NOT NULL CHECK (answer IN ('yes', 'not_this_time')),
  count INTEGER NOT NULL CHECK (typeof(count) = 'integer' AND count > 0),
  PRIMARY KEY (day, answer)
) WITHOUT ROWID;
