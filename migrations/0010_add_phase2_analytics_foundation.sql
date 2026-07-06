-- Phase 2 analytics foundation: aggregate/operator tables only.
-- No PII. No user identifiers. No raw IPs. All additive.

-- 1. daily_rollup: one aggregate row per completed UTC day.
--    Idempotent writer upserts on the `day` primary key.
CREATE TABLE IF NOT EXISTS daily_rollup (
  day                 TEXT    PRIMARY KEY,
  wqpi                INTEGER NULL,
  artifact_downloads  INTEGER NULL,
  attributed_leads    INTEGER NULL,
  leads_total         INTEGER NULL,
  update_checks_known INTEGER NULL,
  latest_checkins     INTEGER NULL,
  download_clicks     INTEGER NULL,
  page_views          INTEGER NULL,
  return_rate         REAL    NULL,
  cf_requests         INTEGER NULL,
  cf_visits           INTEGER NULL,
  errors              INTEGER NULL,
  top_source          TEXT    NULL,
  top_referrer        TEXT    NULL,
  captured_at         TEXT    NOT NULL
);

-- 2. campaign_log: operator-authored community post log. No user data.
CREATE TABLE IF NOT EXISTS campaign_log (
  id           TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL,
  posted_at    TEXT NULL,
  channel      TEXT NULL,
  community    TEXT NULL,
  angle        TEXT NULL,
  tagged_src   TEXT NULL,
  utm_campaign TEXT NULL,
  tagged_url   TEXT NULL,
  notes        TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_campaign_log_posted_at ON campaign_log(posted_at);
CREATE INDEX IF NOT EXISTS idx_campaign_log_utm_campaign ON campaign_log(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_campaign_log_tagged_src ON campaign_log(tagged_src);

-- 3. github_snapshots: daily public GitHub project-health snapshot.
CREATE TABLE IF NOT EXISTS github_snapshots (
  day                     TEXT    PRIMARY KEY,
  stars                   INTEGER NULL,
  forks                   INTEGER NULL,
  watchers                INTEGER NULL,
  open_issues             INTEGER NULL,
  closed_issues           INTEGER NULL,
  open_prs                INTEGER NULL,
  merged_prs              INTEGER NULL,
  contributors            INTEGER NULL,
  latest_release          TEXT    NULL,
  latest_release_at       TEXT    NULL,
  commits_total           INTEGER NULL,
  release_asset_downloads INTEGER NULL,
  captured_at             TEXT    NOT NULL
);

-- 4. health_checks: active funnel liveness probes. Append-only, pruned ~90 days.
CREATE TABLE IF NOT EXISTS health_checks (
  id          TEXT    PRIMARY KEY,
  checked_at  TEXT    NOT NULL,
  target      TEXT    NOT NULL,
  ok          INTEGER NOT NULL,
  status_code INTEGER NULL,
  latency_ms  INTEGER NULL,
  note        TEXT    NULL
);
CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON health_checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_health_checks_target ON health_checks(target);
