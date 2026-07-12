import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as workerModule from "../dist/index.js";

test("migration 0012 adds all first-check aggregate counters", () => {
  const sql = readFileSync(new URL("../migrations/0012_add_first_check_aggregates.sql", import.meta.url), "utf8");
  for (const column of ["first_check_true", "first_check_false", "first_check_unknown"]) {
    assert.match(sql, new RegExp(`ALTER TABLE release_update_checks_daily ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`, "i"));
  }
});

const worker = workerModule.default?.fetch
  ? workerModule.default
  : workerModule.default?.default ?? workerModule.default ?? workerModule;

function todayDay() {
  return new Date().toISOString().slice(0, 10);
}

function makeManifest(version = "1.1.0") {
  return JSON.stringify({
    latest: {
      version,
      download: {
        url: `/releases/BUS-Core-${version}.zip`,
      },
    },
  });
}

class FakeR2Object {
  constructor(body, contentType) {
    this.body = body;
    this.contentType = contentType;
    this.httpEtag = '"fake-etag"';
  }

  async text() {
    return typeof this.body === "string" ? this.body : String(this.body);
  }

  writeHttpMetadata(headers) {
    headers.set("Content-Type", this.contentType);
  }
}

class FakeR2Bucket {
  constructor(manifestRaw, releases) {
    this.manifestRaw = manifestRaw;
    this.releases = releases;
  }

  async get(key) {
    if (key === "manifest/core/stable.json") {
      return new FakeR2Object(this.manifestRaw, "application/json");
    }

    if (this.releases.has(key)) {
      return new FakeR2Object(this.releases.get(key), "application/zip");
    }

    return null;
  }
}

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async run() {
    return this.db.run(this.sql, this.args);
  }

  async first() {
    return this.db.first(this.sql, this.args);
  }

  async all() {
    return this.db.all(this.sql, this.args);
  }
}

class FakeD1Database {
  constructor(options = {}) {
    this.metricsDaily = new Map();
    this.releaseDownloadsDaily = new Map();
    this.releaseUpdateChecksDaily = new Map();
    this.failReleaseSignalReads = options.failReleaseSignalReads ?? false;
    this.failReleaseSignalWrites = options.failReleaseSignalWrites ?? false;
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  metricRow(day) {
    return this.metricsDaily.get(day) ?? { update_checks: 0, downloads: 0, errors: 0 };
  }

  releaseDownloadRows() {
    return Array.from(this.releaseDownloadsDaily.entries()).map(([key, downloads]) => {
      const [day, filename, release_version] = key.split("|");
      return { day, filename, release_version, downloads };
    });
  }

  releaseUpdateCheckRows() {
    return Array.from(this.releaseUpdateChecksDaily.entries()).map(([key, counters]) => {
      const [day, channel, client_version, latest_version, update_available] = key.split("|");
      return {
        day,
        channel,
        client_version,
        latest_version,
        update_available,
        checks: counters.checks,
        first_check_true: counters.first_check_true,
        first_check_false: counters.first_check_false,
        first_check_unknown: counters.first_check_unknown,
      };
    });
  }

  async run(sql, args) {
    if (sql.startsWith("INSERT INTO metrics_daily")) {
      const [day] = args;
      if (!this.metricsDaily.has(day)) {
        this.metricsDaily.set(day, { update_checks: 0, downloads: 0, errors: 0 });
      }
      return { success: true };
    }

    if (sql.startsWith("UPDATE metrics_daily SET")) {
      const column = sql.match(/SET (\w+) = \w+ \+ 1/)?.[1];
      const [day] = args;
      const row = this.metricRow(day);
      row[column] += 1;
      this.metricsDaily.set(day, row);
      return { success: true };
    }

    if (sql.startsWith("INSERT INTO release_downloads_daily")) {
      if (this.failReleaseSignalWrites) {
        throw new Error("no such table: release_downloads_daily");
      }
      const [day, filename, releaseVersion] = args;
      const key = `${day}|${filename}|${releaseVersion}`;
      this.releaseDownloadsDaily.set(key, (this.releaseDownloadsDaily.get(key) ?? 0) + 1);
      return { success: true };
    }

    if (sql.startsWith("INSERT INTO release_update_checks_daily")) {
      if (this.failReleaseSignalWrites) {
        throw new Error("no such table: release_update_checks_daily");
      }
      const [day, channel, clientVersion, latestVersion, updateAvailable, firstCheckTrue, firstCheckFalse, firstCheckUnknown] = args;
      const key = `${day}|${channel}|${clientVersion}|${latestVersion}|${updateAvailable}`;
      const existing = this.releaseUpdateChecksDaily.get(key) ?? {
        checks: 0,
        first_check_true: 0,
        first_check_false: 0,
        first_check_unknown: 0,
      };
      existing.checks += 1;
      existing.first_check_true += firstCheckTrue ?? 0;
      existing.first_check_false += firstCheckFalse ?? 0;
      existing.first_check_unknown += firstCheckUnknown ?? 0;
      this.releaseUpdateChecksDaily.set(key, existing);
      return { success: true };
    }

    return { success: true };
  }

  async first(sql, args) {
    if (this.failReleaseSignalReads && sql.includes("FROM release_downloads_daily")) {
      throw new Error("no such table: release_downloads_daily");
    }

    if (this.failReleaseSignalReads && sql.includes("FROM release_update_checks_daily")) {
      throw new Error("no such table: release_update_checks_daily");
    }

    if (sql.startsWith("SELECT COALESCE(SUM(update_checks),0) AS update_checks")) {
      const [startDay, endDay] = args;
      const totals = { update_checks: 0, downloads: 0, errors: 0 };
      for (const [day, row] of this.metricsDaily.entries()) {
        if (day >= startDay && day <= endDay) {
          totals.update_checks += row.update_checks;
          totals.downloads += row.downloads;
          totals.errors += row.errors;
        }
      }
      return totals;
    }

    if (sql.includes("AS artifact_downloads FROM release_downloads_daily")) {
      const [startDay, endDay] = args;
      let artifact_downloads = 0;
      for (const row of this.releaseDownloadRows()) {
        if (row.day >= startDay && row.day <= endDay) {
          artifact_downloads += row.downloads;
        }
      }
      return { artifact_downloads };
    }

    if (sql.includes("FROM release_update_checks_daily WHERE day >= ? AND day <= ?")) {
      const [, , , startDay, endDay] = args;
      const summary = {
        update_checks: 0,
        update_checks_with_known_client_version: 0,
        update_checks_unknown_client_version: 0,
        update_available_impressions: 0,
        latest_version_checkins: 0,
        first_seen_checkins: 0,
        repeat_checkins: 0,
        unknown_first_checkins: 0,
      };

      for (const row of this.releaseUpdateCheckRows()) {
        if (row.day < startDay || row.day > endDay) {
          continue;
        }

        summary.update_checks += row.checks;
        if (row.client_version === "unknown") {
          summary.update_checks_unknown_client_version += row.checks;
        } else {
          summary.update_checks_with_known_client_version += row.checks;
        }
        if (row.update_available === "true") {
          summary.update_available_impressions += row.checks;
        }
        if (
          row.update_available === "false" &&
          row.client_version !== "unknown" &&
          row.client_version === row.latest_version
        ) {
          summary.latest_version_checkins += row.checks;
        }
        summary.first_seen_checkins += row.first_check_true;
        summary.repeat_checkins += row.first_check_false;
        summary.unknown_first_checkins += row.first_check_unknown;
      }

      return summary;
    }

    if (sql.startsWith("SELECT COUNT(*) AS row_count") && sql.includes("FROM buscore_traffic_daily")) {
      return { row_count: 0, visits: null, requests: null };
    }

    if (sql.startsWith("SELECT day, visits, requests, captured_at FROM buscore_traffic_daily")) {
      return null;
    }

    if (sql.startsWith("SELECT pageviews, last_received_at FROM pageview_daily WHERE day = ?")) {
      return { pageviews: 0, last_received_at: null };
    }

    if (sql.startsWith("SELECT COALESCE(SUM(pageviews),0) AS pageviews, COALESCE(SUM(CASE WHEN pageviews > 0 THEN 1 ELSE 0 END),0) AS days_with_data FROM pageview_daily")) {
      return { pageviews: 0, days_with_data: 0 };
    }

    if (sql.startsWith("SELECT COALESCE(SUM(pageviews),0) AS pageviews, COALESCE(SUM(accepted),0) AS accepted")) {
      return {
        pageviews: 0,
        accepted: 0,
        dropped_rate_limited: 0,
        dropped_invalid: 0,
        last_received_at: null,
        days_with_data: 0,
      };
    }

    if (sql.startsWith("SELECT COALESCE(SUM(accepted),0) AS accepted")) {
      return { accepted: 0, dropped_rate_limited: 0, dropped_invalid: 0, last_received_at: null };
    }

    return null;
  }

  async all(sql, args) {
    if (this.failReleaseSignalReads && sql.includes("FROM release_downloads_daily")) {
      throw new Error("no such table: release_downloads_daily");
    }

    if (sql.startsWith("SELECT release_version, filename, SUM(downloads) AS downloads FROM release_downloads_daily")) {
      const [startDay, endDay] = args;
      const rows = this.releaseDownloadRows()
        .filter((row) => row.day >= startDay && row.day <= endDay)
        .sort((left, right) => {
          if (right.downloads !== left.downloads) return right.downloads - left.downloads;
          if (right.release_version !== left.release_version) {
            return right.release_version.localeCompare(left.release_version);
          }
          return left.filename.localeCompare(right.filename);
        })
        .map(({ release_version, filename, downloads }) => ({ release_version, filename, downloads }));

      return { results: rows };
    }

    return { results: [] };
  }
}

function createHarness(options = {}) {
  const manifestVersion = options.manifestVersion ?? "1.1.0";
  const manifestRaw = options.manifestRaw ?? makeManifest(manifestVersion);
  const releases = new Map();
  for (const [filename, body] of Object.entries(options.releases ?? { [`BUS-Core-${manifestVersion}.zip`]: "zip-body" })) {
    releases.set(`releases/${filename}`, body);
  }

  const db = new FakeD1Database({
    failReleaseSignalReads: options.failReleaseSignalReads,
    failReleaseSignalWrites: options.failReleaseSignalWrites,
  });
  const env = {
    DB: db,
    MANIFEST_R2: new FakeR2Bucket(manifestRaw, releases),
    ADMIN_TOKEN: "secret-token",
    IGNORED_IP: options.ignoredIp ?? "",
    CF_API_TOKEN: "token",
    CF_ZONE_TAG: "zone",
  };

  return { db, env };
}

function createExecutionContext() {
  return {
    pending: [],
    waitUntil(promise) {
      this.pending.push(Promise.resolve(promise));
    },
  };
}

async function dispatch(env, path, init = {}) {
  const headers = new Headers(init.headers ?? {});
  const request = new Request(`https://lighthouse.test${path}`, {
    method: init.method ?? "GET",
    headers,
  });
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await Promise.all(ctx.pending);
  return response;
}

test("GET /download/latest does not increment metrics_daily.downloads by itself", async () => {
  const { db, env } = createHarness();

  const response = await dispatch(env, "/download/latest");

  assert.equal(response.status, 302);
  assert.equal(db.metricRow(todayDay()).downloads, 0);
  assert.deepEqual(db.releaseDownloadRows(), []);
});

test("GET /releases/BUS-Core-1.1.0.zip increments metrics_daily.downloads", async () => {
  const { db, env } = createHarness();

  const response = await dispatch(env, "/releases/BUS-Core-1.1.0.zip");

  assert.equal(response.status, 200);
  assert.equal(db.metricRow(todayDay()).downloads, 1);
  assert.deepEqual(db.releaseDownloadRows(), [
    {
      day: todayDay(),
      filename: "BUS-Core-1.1.0.zip",
      release_version: "1.1.0",
      downloads: 1,
    },
  ]);
});

test("GET /releases/... still succeeds when additive release-signal writes fail", async () => {
  const { db, env } = createHarness({ failReleaseSignalWrites: true });

  const response = await dispatch(env, "/releases/BUS-Core-1.1.0.zip");

  assert.equal(response.status, 200);
  assert.equal(db.metricRow(todayDay()).downloads, 1);
  assert.deepEqual(db.releaseDownloadRows(), []);
});

test("/download/latest redirect flow followed by /releases increments downloads exactly once", async () => {
  const { db, env } = createHarness();

  const redirectResponse = await dispatch(env, "/download/latest");
  const redirectUrl = redirectResponse.headers.get("location");

  assert.ok(redirectUrl);
  await dispatch(env, new URL(redirectUrl).pathname);

  assert.equal(db.metricRow(todayDay()).downloads, 1);
  assert.equal(db.releaseDownloadRows()[0].downloads, 1);
});

test("missing release artifact does not increment downloads", async () => {
  const { db, env } = createHarness({ releases: {} });

  const response = await dispatch(env, "/releases/BUS-Core-1.1.0.zip");

  assert.equal(response.status, 404);
  assert.equal(db.metricRow(todayDay()).downloads, 0);
  assert.deepEqual(db.releaseDownloadRows(), []);
});

test("HEAD /releases/... does not increment downloads", async () => {
  const { db, env } = createHarness();

  const response = await dispatch(env, "/releases/BUS-Core-1.1.0.zip", { method: "HEAD" });

  assert.equal(response.status, 405);
  assert.equal(db.metricRow(todayDay()).downloads, 0);
  assert.deepEqual(db.releaseDownloadRows(), []);
});

test("GET /manifest/core/stable.json does not increment downloads or update_checks", async () => {
  const { db, env } = createHarness();

  const response = await dispatch(env, "/manifest/core/stable.json");

  assert.equal(response.status, 200);
  assert.deepEqual(db.metricRow(todayDay()), { update_checks: 0, downloads: 0, errors: 0 });
});

test("ignored IP suppresses both old counters and new release-signal aggregates", async () => {
  const { db, env } = createHarness({ ignoredIp: "203.0.113.10" });
  const headers = { "CF-Connecting-IP": "203.0.113.10" };

  await dispatch(env, "/update/check?current_version=1.0.4", { headers });
  await dispatch(env, "/releases/BUS-Core-1.1.0.zip", { headers });

  assert.deepEqual(db.metricRow(todayDay()), { update_checks: 0, downloads: 0, errors: 0 });
  assert.deepEqual(db.releaseDownloadRows(), []);
  assert.deepEqual(db.releaseUpdateCheckRows(), []);
});

test("GET /update/check still increments metrics_daily.update_checks", async () => {
  const { db, env } = createHarness();

  const response = await dispatch(env, "/update/check");

  assert.equal(response.status, 200);
  assert.equal(db.metricRow(todayDay()).update_checks, 1);
});

test("GET /update/check still succeeds when additive release-signal writes fail", async () => {
  const { db, env } = createHarness({ failReleaseSignalWrites: true });

  const response = await dispatch(env, "/update/check?current_version=1.0.4");

  assert.equal(response.status, 200);
  assert.equal(db.metricRow(todayDay()).update_checks, 1);
  assert.deepEqual(db.releaseUpdateCheckRows(), []);
});

test("GET /update/check without client version records an unknown client-version bucket", async () => {
  const { db, env } = createHarness();

  await dispatch(env, "/update/check");

  assert.deepEqual(db.releaseUpdateCheckRows(), [
    {
      day: todayDay(),
      channel: "unknown",
      client_version: "unknown",
      latest_version: "1.1.0",
      update_available: "unknown",
      checks: 1,
      first_check_true: 0,
      first_check_false: 0,
      first_check_unknown: 1,
    },
  ]);
});

test("GET /update/check?current_version=1.0.4 records update_available = true", async () => {
  const { db, env } = createHarness();

  await dispatch(env, "/update/check?current_version=1.0.4");

  assert.deepEqual(db.releaseUpdateCheckRows(), [
    {
      day: todayDay(),
      channel: "unknown",
      client_version: "1.0.4",
      latest_version: "1.1.0",
      update_available: "true",
      checks: 1,
      first_check_true: 0,
      first_check_false: 0,
      first_check_unknown: 1,
    },
  ]);
});

test("GET /update/check?current_version=1.1.0 records update_available = false and /report exposes latest-version check-ins", async () => {
  const { db, env } = createHarness();
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("skip refresh");
  };

  try {
    await dispatch(env, "/update/check?current_version=1.1.0");
    await dispatch(env, "/releases/BUS-Core-1.1.0.zip");

    assert.deepEqual(db.releaseUpdateCheckRows(), [
      {
        day: todayDay(),
        channel: "unknown",
        client_version: "1.1.0",
        latest_version: "1.1.0",
        update_available: "false",
        checks: 1,
        first_check_true: 0,
        first_check_false: 0,
        first_check_unknown: 1,
      },
    ]);

    const reportResponse = await dispatch(env, "/report", {
      headers: { "X-Admin-Token": "secret-token" },
    });
    const payload = await reportResponse.json();

    assert.equal(reportResponse.status, 200);
    assert.equal(typeof payload.today.downloads, "number");
    assert.equal(typeof payload.today.update_checks, "number");
    assert.ok("last_7_days" in payload);
    assert.ok("last_30_days" in payload);
    assert.ok("intent_counters" in payload);
    assert.ok("release_signals" in payload);
    assert.deepEqual(payload.release_signals.today, {
      artifact_downloads: 1,
      artifact_downloads_by_release: [
        {
          release_version: "1.1.0",
          filename: "BUS-Core-1.1.0.zip",
          downloads: 1,
        },
      ],
      raw_update_checks: 1,
      breakdown_update_checks: 1,
      raw_breakdown_delta: 0,
      update_checks: 1,
      update_checks_with_known_client_version: 1,
      update_checks_unknown_client_version: 0,
      update_available_impressions: 0,
      latest_version_checkins: 1,
      first_seen_checkins: 0,
      repeat_checkins: 0,
      unknown_first_checkins: 1,
      first_seen_share: 0,
    });
  } finally {
    global.fetch = originalFetch;
  }
});


test("/report remains available when additive release-signal aggregate reads fail", async () => {
  const { env } = createHarness({ failReleaseSignalReads: true });
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("skip refresh");
  };

  try {
    const reportResponse = await dispatch(env, "/report?site_key=buscore", {
      headers: { "X-Admin-Token": "secret-token" },
    });
    const payload = await reportResponse.json();

    assert.equal(reportResponse.status, 200);
    assert.equal(typeof payload.today.downloads, "number");
    assert.equal(typeof payload.last_7_days.update_checks, "number");
    assert.deepEqual(payload.release_signals.today, {
      artifact_downloads: 0,
      artifact_downloads_by_release: [],
      raw_update_checks: 0,
      breakdown_update_checks: 0,
      raw_breakdown_delta: 0,
      update_checks: 0,
      update_checks_with_known_client_version: 0,
      update_checks_unknown_client_version: 0,
      update_available_impressions: 0,
      latest_version_checkins: 0,
      first_seen_checkins: 0,
      repeat_checkins: 0,
      unknown_first_checkins: 0,
      first_seen_share: 0,
    });
  } finally {
    global.fetch = originalFetch;
  }
});

// --- Ticket 3: first_check aggregate contract ---------------------------------

test("new client first_check=true records client_version, channel, and first_check_true", async () => {
  const { db, env } = createHarness();

  await dispatch(env, "/update/check?current_version=1.3.3&channel=stable&first_check=true");

  assert.deepEqual(db.releaseUpdateCheckRows(), [
    {
      day: todayDay(),
      channel: "stable",
      client_version: "1.3.3",
      latest_version: "1.1.0",
      update_available: "false",
      checks: 1,
      first_check_true: 1,
      first_check_false: 0,
      first_check_unknown: 0,
    },
  ]);
});

test("repeat check first_check=false records first_check_false", async () => {
  const { db, env } = createHarness();

  await dispatch(env, "/update/check?current_version=1.3.3&channel=stable&first_check=false");

  const [row] = db.releaseUpdateCheckRows();
  assert.equal(row.channel, "stable");
  assert.equal(row.client_version, "1.3.3");
  assert.equal(row.first_check_true, 0);
  assert.equal(row.first_check_false, 1);
  assert.equal(row.first_check_unknown, 0);
});

test("old client with no query params records unknown client/channel/first-check", async () => {
  const { db, env } = createHarness();

  await dispatch(env, "/update/check");

  assert.deepEqual(db.releaseUpdateCheckRows(), [
    {
      day: todayDay(),
      channel: "unknown",
      client_version: "unknown",
      latest_version: "1.1.0",
      update_available: "unknown",
      checks: 1,
      first_check_true: 0,
      first_check_false: 0,
      first_check_unknown: 1,
    },
  ]);
});

test("invalid first_check value is bucketed as unknown first-check", async () => {
  const { db, env } = createHarness();

  await dispatch(env, "/update/check?current_version=1.3.3&channel=stable&first_check=banana");

  const [row] = db.releaseUpdateCheckRows();
  assert.equal(row.first_check_true, 0);
  assert.equal(row.first_check_false, 0);
  assert.equal(row.first_check_unknown, 1);
});

test("first_check accepts 1 and 0 aliases", async () => {
  const { db: dbTrue, env: envTrue } = createHarness();
  await dispatch(envTrue, "/update/check?current_version=1.3.3&channel=stable&first_check=1");
  assert.equal(dbTrue.releaseUpdateCheckRows()[0].first_check_true, 1);

  const { db: dbFalse, env: envFalse } = createHarness();
  await dispatch(envFalse, "/update/check?current_version=1.3.3&channel=stable&first_check=0");
  assert.equal(dbFalse.releaseUpdateCheckRows()[0].first_check_false, 1);
});

test("first_check is case-insensitive (TRUE)", async () => {
  const { db, env } = createHarness();

  await dispatch(env, "/update/check?current_version=1.3.3&channel=stable&first_check=TRUE");

  assert.equal(db.releaseUpdateCheckRows()[0].first_check_true, 1);
});

test("D1 write failure never breaks /update/check even with first_check present", async () => {
  const { db, env } = createHarness({ failReleaseSignalWrites: true });

  const response = await dispatch(env, "/update/check?current_version=1.3.3&channel=stable&first_check=true");

  assert.equal(response.status, 200);
  assert.equal(db.metricRow(todayDay()).update_checks, 1);
  assert.deepEqual(db.releaseUpdateCheckRows(), []);
});

test("/report exposes a raw-versus-breakdown update-check mismatch when additive writes fail", async () => {
  const { env } = createHarness({ failReleaseSignalWrites: true });
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("skip refresh");
  };

  try {
    const updateResponse = await dispatch(env, "/update/check?current_version=1.3.3&channel=stable&first_check=true");
    const reportResponse = await dispatch(env, "/report", {
      headers: { "X-Admin-Token": "secret-token" },
    });
    const payload = await reportResponse.json();

    assert.equal(updateResponse.status, 200);
    for (const window of Object.values(payload.release_signals)) {
      assert.equal(window.raw_update_checks, 1);
      assert.equal(window.breakdown_update_checks, 0);
      assert.equal(window.raw_breakdown_delta, 1);
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test("/report exposes first-check aggregates with correct sums and share", async () => {
  const { env } = createHarness();
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("skip refresh");
  };

  try {
    // Two first-seen and one repeat check-in collapse onto the same additive row.
    await dispatch(env, "/update/check?current_version=1.0.4&channel=stable&first_check=true");
    await dispatch(env, "/update/check?current_version=1.0.4&channel=stable&first_check=true");
    await dispatch(env, "/update/check?current_version=1.0.4&channel=stable&first_check=false");
    // One unknown-first-check check-in.
    await dispatch(env, "/update/check?current_version=1.0.4&channel=stable");

    const reportResponse = await dispatch(env, "/report", {
      headers: { "X-Admin-Token": "secret-token" },
    });
    const payload = await reportResponse.json();

    assert.equal(reportResponse.status, 200);
    const today = payload.release_signals.today;
    assert.equal(today.raw_update_checks, 4);
    assert.equal(today.breakdown_update_checks, 4);
    assert.equal(today.raw_breakdown_delta, 0);
    assert.equal(today.first_seen_checkins, 2);
    assert.equal(today.repeat_checkins, 1);
    assert.equal(today.unknown_first_checkins, 1);
    assert.equal(today.first_seen_share, 2 / 3);
  } finally {
    global.fetch = originalFetch;
  }
});

test("first_seen_share is 0 when there are no known-status first-check check-ins", async () => {
  const { env } = createHarness();
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("skip refresh");
  };

  try {
    await dispatch(env, "/update/check");

    const reportResponse = await dispatch(env, "/report", {
      headers: { "X-Admin-Token": "secret-token" },
    });
    const payload = await reportResponse.json();
    const today = payload.release_signals.today;

    assert.equal(today.raw_update_checks, 1);
    assert.equal(today.breakdown_update_checks, 1);
    assert.equal(today.raw_breakdown_delta, 0);
    assert.equal(today.first_seen_checkins, 0);
    assert.equal(today.repeat_checkins, 0);
    assert.equal(today.unknown_first_checkins, 1);
    assert.equal(today.first_seen_share, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

// --- Ticket 3: manifest latest-version parse guard ---------------------------

test("manifest latest version 1.3.3 parses as a valid latest version", async () => {
  const { db, env } = createHarness({ manifestVersion: "1.3.3" });

  await dispatch(env, "/update/check");

  assert.equal(db.releaseUpdateCheckRows()[0].latest_version, "1.3.3");
});

test("manifest latest version v1.3.3 is intentionally rejected and buckets as unknown", async () => {
  // Guard: the strict semver parser rejects a leading-v tag. If the BUS Core
  // release pipeline ever emits `vX.Y.Z`, latest-version reporting zeroes out —
  // this test documents that behavior so the change cannot happen silently.
  const { db, env } = createHarness({ manifestVersion: "v1.3.3" });

  await dispatch(env, "/update/check");

  assert.equal(db.releaseUpdateCheckRows()[0].latest_version, "unknown");
});

// --- Ticket 3: /report vs /report?site_key=buscore release-signal parity -----

test("GET /report and GET /report?site_key=buscore return equivalent release_signals", async () => {
  const { env } = createHarness();
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("skip refresh");
  };

  try {
    await dispatch(env, "/update/check?current_version=1.0.4&channel=stable&first_check=true");
    await dispatch(env, "/update/check?current_version=1.1.0&channel=stable&first_check=false");

    const plain = await (
      await dispatch(env, "/report", { headers: { "X-Admin-Token": "secret-token" } })
    ).json();
    const scoped = await (
      await dispatch(env, "/report?site_key=buscore", { headers: { "X-Admin-Token": "secret-token" } })
    ).json();

    assert.deepEqual(scoped.release_signals, plain.release_signals);
  } finally {
    global.fetch = originalFetch;
  }
});
