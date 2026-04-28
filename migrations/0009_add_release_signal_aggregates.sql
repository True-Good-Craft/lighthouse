CREATE TABLE IF NOT EXISTS release_downloads_daily (
  day             TEXT    NOT NULL,
  filename        TEXT    NOT NULL,
  release_version TEXT    NOT NULL,
  downloads       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day, filename, release_version)
);

CREATE INDEX IF NOT EXISTS idx_release_downloads_daily_release
  ON release_downloads_daily(release_version, day);

CREATE TABLE IF NOT EXISTS release_update_checks_daily (
  day              TEXT    NOT NULL,
  channel          TEXT    NOT NULL,
  client_version   TEXT    NOT NULL,
  latest_version   TEXT    NOT NULL,
  update_available TEXT    NOT NULL,
  checks           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day, channel, client_version, latest_version, update_available)
);

CREATE INDEX IF NOT EXISTS idx_release_update_checks_daily_versions
  ON release_update_checks_daily(latest_version, client_version, day);