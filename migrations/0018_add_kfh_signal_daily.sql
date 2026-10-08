-- Apply after owner approval and before the 1.35 Worker is promoted.
-- Additive: no existing table, row or constraint changes; rollback Workers ignore it.
-- Unattributed daily totals only. No labels, visit token, listing identity or raw events.
CREATE TABLE IF NOT EXISTS kfh_signal_daily (
  day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  signal TEXT NOT NULL CHECK (signal IN ('resource_opens', 'install_prompt_shows', 'install_prompt_dismissals')),
  count INTEGER NOT NULL CHECK (typeof(count) = 'integer' AND count > 0),
  PRIMARY KEY (day, signal)
) WITHOUT ROWID;
