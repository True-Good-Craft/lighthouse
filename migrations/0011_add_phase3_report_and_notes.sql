-- Phase 3: report archival + operator notes. Aggregate/operator-authored only.
-- No PII. All additive.

-- Dated archive of each generated brief (daily/weekly/monthly).
CREATE TABLE IF NOT EXISTS report_snapshots (
  id           TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  kind         TEXT NOT NULL,           -- daily | weekly | monthly
  status       TEXT NULL,               -- OK | WATCH | ACTION | ALERT | CRITICAL (or null)
  wqpi         INTEGER NULL,
  summary_json TEXT NULL,               -- compact aggregate numbers, no PII
  narrative    TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_kind_generated
  ON report_snapshots(kind, generated_at);

-- Operator annotations that feed the monthly narrative.
CREATE TABLE IF NOT EXISTS operator_notes (
  id         TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  note       TEXT NOT NULL,
  tag        TEXT NULL                  -- release | community | lead | ops | other
);
CREATE INDEX IF NOT EXISTS idx_operator_notes_created ON operator_notes(created_at);
