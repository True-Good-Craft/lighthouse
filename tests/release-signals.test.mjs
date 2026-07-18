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

test("migration 0014 adds aggregate-only artifact and intent truth tables", () => {
  const sql = readFileSync(new URL("../migrations/0014_add_artifact_traffic_truth.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS artifact_traffic_daily/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS buscore_download_intent_daily/i);
  assert.doesNotMatch(sql, /\bip(?:_hash)?\b|user_agent|email|request_id/i);
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
  constructor(body, contentType, options = {}) {
    this.body = body;
    this.contentType = contentType;
    this.httpEtag = '"fake-etag"';
    this.size = options.size ?? Buffer.byteLength(typeof body === "string" ? body : String(body));
    this.range = options.range;
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
    this.getCalls = [];
  }

  async get(key, options = {}) {
    this.getCalls.push(key);
    if (key === "manifest/core/stable.json") {
      return new FakeR2Object(this.manifestRaw, "application/json");
    }

    if (this.releases.has(key)) {
      const body = String(this.releases.get(key));
      const rangeHeader = options.range instanceof Headers ? options.range.get("Range") : null;
      if (rangeHeader) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
        if (!match) throw new Error("invalid range");
        const start = Number(match[1]);
        const requestedEnd = match[2] ? Number(match[2]) : body.length - 1;
        const end = Math.min(requestedEnd, body.length - 1);
        if (start > end || start >= body.length) throw new Error("invalid range");
        return new FakeR2Object(body.slice(start, end + 1), "application/zip", {
          size: body.length,
          range: { offset: start, length: end - start + 1 },
        });
      }
      return new FakeR2Object(body, "application/zip");
    }

    return null;
  }

  async head(key) {
    if (!this.releases.has(key)) return null;
    return new FakeR2Object(null, "application/zip", { size: String(this.releases.get(key)).length });
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
    this.artifactTrafficDaily = new Map();
    this.downloadIntentDaily = new Map();
    this.rateLimits = new Map();
    this.failReleaseSignalReads = options.failReleaseSignalReads ?? false;
    this.failTrafficTruthReads = options.failTrafficTruthReads ?? false;
    this.failReleaseSignalWrites = options.failReleaseSignalWrites ?? false;
    this.failRateLimit = options.failRateLimit ?? false;
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

  artifactTrafficRow(day, filename = "BUS-Core-1.1.0.zip", releaseVersion = "1.1.0") {
    return this.artifactTrafficDaily.get(`${day}|${filename}|${releaseVersion}`) ?? {
      raw_requests: 0, successful_responses: 0, full_responses: 0, partial_responses: 0,
      head_requests: 0, range_requests: 0, failed_requests: 0, response_bytes: 0,
      deduplicated_clients: 0, suppressed_repetitive_requests: 0, rate_limited_requests: 0,
      cache_hits: 0, cache_misses: 0,
    };
  }

  async run(sql, args) {
    if (sql.startsWith("INSERT INTO buscore_telemetry_rate_limit")) {
      if (this.failRateLimit) {
        throw new Error("rate limit unavailable");
      }
      const [bucket, ipHash] = args;
      const key = `${bucket}|${ipHash}`;
      this.rateLimits.set(key, (this.rateLimits.get(key) ?? 0) + 1);
      return { success: true };
    }

    if (sql.startsWith("INSERT INTO metrics_daily")) {
      const [day] = args;
      if (!this.metricsDaily.has(day)) {
        this.metricsDaily.set(day, { update_checks: 0, downloads: 0, errors: 0 });
      }
      return { success: true };
    }

    if (sql.startsWith("INSERT INTO artifact_traffic_daily")) {
      if (this.failReleaseSignalWrites) throw new Error("no such table: artifact_traffic_daily");
      const [day, filename, releaseVersion, ...values] = args;
      const names = ["raw_requests", "successful_responses", "full_responses", "partial_responses", "head_requests", "range_requests", "failed_requests", "response_bytes", "deduplicated_clients", "suppressed_repetitive_requests", "rate_limited_requests", "cache_hits", "cache_misses"];
      const row = this.artifactTrafficRow(day, filename, releaseVersion);
      names.forEach((name, index) => { row[name] += values[index] ?? 0; });
      this.artifactTrafficDaily.set(`${day}|${filename}|${releaseVersion}`, row);
      return { success: true };
    }

    if (sql.startsWith("INSERT INTO buscore_download_intent_daily")) {
      const day = args[0];
      const row = this.downloadIntentDaily.get(day) ?? { raw_intent_events: 0, probable_human_intents: 0, suppressed_repetitive_intents: 0, successful_redirects: 0 };
      if (sql.includes("successful_redirects")) row.successful_redirects += 1;
      else {
        row.raw_intent_events += args[1] ?? 0;
        row.probable_human_intents += args[2] ?? 0;
        row.suppressed_repetitive_intents += args[3] ?? 0;
      }
      this.downloadIntentDaily.set(day, row);
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
    if (sql.startsWith("SELECT count FROM buscore_telemetry_rate_limit")) {
      if (this.failRateLimit) {
        throw new Error("rate limit unavailable");
      }
      const [bucket, ipHash] = args;
      return { count: this.rateLimits.get(`${bucket}|${ipHash}`) ?? 0 };
    }

    if (this.failReleaseSignalReads && sql.includes("FROM release_downloads_daily")) {
      throw new Error("no such table: release_downloads_daily");
    }

    if (this.failReleaseSignalReads && sql.includes("FROM release_update_checks_daily")) {
      throw new Error("no such table: release_update_checks_daily");
    }
    if (this.failTrafficTruthReads && (sql.includes("FROM artifact_traffic_daily") || sql.includes("FROM buscore_download_intent_daily"))) {
      throw new Error("no such table: artifact_traffic_daily");
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

    if (sql.includes("FROM artifact_traffic_daily WHERE day >= ? AND day <= ?")) {
      const [startDay, endDay] = args;
      const result = {};
      for (const [key, row] of this.artifactTrafficDaily.entries()) {
        const [day] = key.split("|");
        if (day < startDay || day > endDay) continue;
        for (const [name, value] of Object.entries(row)) result[name] = (result[name] ?? 0) + value;
      }
      return {
        raw_artifact_requests: result.raw_requests ?? 0,
        successful_artifact_responses: result.successful_responses ?? 0,
        full_artifact_responses: result.full_responses ?? 0,
        partial_artifact_responses: result.partial_responses ?? 0,
        head_artifact_requests: result.head_requests ?? 0,
        range_artifact_requests: result.range_requests ?? 0,
        failed_artifact_requests: result.failed_requests ?? 0,
        artifact_response_bytes: result.response_bytes ?? 0,
        deduplicated_artifact_clients: result.deduplicated_clients ?? 0,
        suppressed_repetitive_requests: result.suppressed_repetitive_requests ?? 0,
        rate_limited_artifact_requests: result.rate_limited_requests ?? 0,
        artifact_cache_hits: result.cache_hits ?? 0,
        artifact_cache_misses: result.cache_misses ?? 0,
      };
    }

    if (sql.includes("FROM buscore_download_intent_daily WHERE day >= ? AND day <= ?")) {
      const [startDay, endDay] = args;
      const totals = { raw_download_intent_events: 0, probable_human_download_intents: 0, suppressed_repetitive_intents: 0, successful_download_redirects: 0 };
      for (const [day, row] of this.downloadIntentDaily.entries()) {
        if (day < startDay || day > endDay) continue;
        totals.raw_download_intent_events += row.raw_intent_events;
        totals.probable_human_download_intents += row.probable_human_intents;
        totals.suppressed_repetitive_intents += row.suppressed_repetitive_intents;
        totals.successful_download_redirects += row.successful_redirects;
      }
      return totals;
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
    failTrafficTruthReads: options.failTrafficTruthReads,
    failReleaseSignalWrites: options.failReleaseSignalWrites,
    failRateLimit: options.failRateLimit,
  });
  const env = {
    DB: db,
    MANIFEST_R2: new FakeR2Bucket(manifestRaw, releases),
    ADMIN_TOKEN: "secret-token",
    IGNORED_IP: options.ignoredIp ?? "",
    CF_API_TOKEN: "token",
    CF_ZONE_TAG: "zone",
  };
  if (!options.omitRateLimitSecret) {
    env.TELEMETRY_RATE_LIMIT_SECRET = "test-rate-secret";
  }

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

const CORE_IP_A = { "CF-Connecting-IP": "198.51.100.10" };
const CORE_IP_B = { "CF-Connecting-IP": "198.51.100.11" };
const VALID_FIRST_CHECK = "/update/check?current_version=1.4.0&channel=stable&first_check=true";
const VALID_REPEAT_CHECK = "/update/check?current_version=1.4.0&channel=stable&first_check=false";

test("GET /download/latest does not increment metrics_daily.downloads by itself", async () => {
  const { db, env } = createHarness();

  const response = await dispatch(env, "/download/latest");

  assert.equal(response.status, 302);
  assert.equal(db.metricRow(todayDay()).downloads, 0);
  assert.deepEqual(db.releaseDownloadRows(), []);
  assert.equal(db.downloadIntentDaily.get(todayDay()).successful_redirects, 1);
});

test("qualified GET /releases/BUS-Core-1.1.0.zip increments metrics_daily.downloads", async () => {
  const { db, env } = createHarness();

  const response = await dispatch(env, "/releases/BUS-Core-1.1.0.zip", { headers: CORE_IP_A });

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

test("versioned full responses use Worker cache without hiding raw request truth", async () => {
  const { db, env } = createHarness();
  const entries = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "caches");
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      default: {
        async match(request) { return entries.get(request.url)?.clone(); },
        async put(request, response) { entries.set(request.url, response.clone()); },
      },
    },
  });
  try {
    const first = await dispatch(env, "/releases/BUS-Core-1.1.0.zip", { headers: CORE_IP_A });
    const second = await dispatch(env, "/releases/BUS-Core-1.1.0.zip", { headers: CORE_IP_A });
    assert.equal(first.headers.get("X-BUS-Artifact-Cache"), "MISS");
    assert.equal(second.headers.get("X-BUS-Artifact-Cache"), "HIT");
    assert.equal(env.MANIFEST_R2.getCalls.filter((key) => key.startsWith("releases/")).length, 1);
    assert.equal(db.artifactTrafficRow(todayDay()).raw_requests, 2);
    assert.equal(db.artifactTrafficRow(todayDay()).cache_misses, 1);
    assert.equal(db.artifactTrafficRow(todayDay()).cache_hits, 1);
  } finally {
    if (previous) Object.defineProperty(globalThis, "caches", previous);
    else delete globalThis.caches;
  }
});

test("GET /releases/... still succeeds when additive release-signal writes fail", async () => {
  const { db, env } = createHarness({ failReleaseSignalWrites: true });

  const response = await dispatch(env, "/releases/BUS-Core-1.1.0.zip", { headers: CORE_IP_A });

  assert.equal(response.status, 200);
  assert.equal(db.metricRow(todayDay()).downloads, 1);
  assert.deepEqual(db.releaseDownloadRows(), []);
});

test("/download/latest redirect flow followed by /releases increments downloads exactly once", async () => {
  const { db, env } = createHarness();

  const redirectResponse = await dispatch(env, "/download/latest");
  const redirectUrl = redirectResponse.headers.get("location");

  assert.ok(redirectUrl);
  await dispatch(env, new URL(redirectUrl).pathname, { headers: CORE_IP_A });

  assert.equal(db.metricRow(todayDay()).downloads, 1);
  assert.equal(db.releaseDownloadRows()[0].downloads, 1);
});

test("missing release artifact does not increment downloads", async () => {
  const { db, env } = createHarness({ releases: {} });

  const response = await dispatch(env, "/releases/BUS-Core-1.1.0.zip");

  assert.equal(response.status, 404);
  assert.equal(db.metricRow(todayDay()).downloads, 0);
  assert.deepEqual(db.releaseDownloadRows(), []);
  assert.equal(db.artifactTrafficRow(todayDay()).raw_requests, 1);
  assert.equal(db.artifactTrafficRow(todayDay()).failed_requests, 1);
});

test("100 repeated full requests stay public while one client bucket is credited", async () => {
  const { db, env } = createHarness();

  for (let i = 0; i < 100; i += 1) {
    const response = await dispatch(env, "/releases/BUS-Core-1.1.0.zip", { headers: CORE_IP_A });
    assert.equal(response.status, 200);
  }

  assert.equal(db.metricRow(todayDay()).downloads, 1);
  assert.equal(db.releaseDownloadRows()[0].downloads, 1);
  assert.equal(db.artifactTrafficRow(todayDay()).raw_requests, 100);
  assert.equal(db.artifactTrafficRow(todayDay()).successful_responses, 100);
  assert.equal(db.artifactTrafficRow(todayDay()).deduplicated_clients, 1);
  assert.equal(db.artifactTrafficRow(todayDay()).suppressed_repetitive_requests, 99);

  await dispatch(env, "/releases/BUS-Core-1.1.0.zip", { headers: CORE_IP_B });
  assert.equal(db.metricRow(todayDay()).downloads, 2);
  assert.equal(db.releaseDownloadRows()[0].downloads, 2);
  assert.equal(db.artifactTrafficRow(todayDay()).deduplicated_clients, 2);
});

test("one IP may count one request for each distinct release per UTC day", async () => {
  const { db, env } = createHarness({
    releases: {
      "BUS-Core-1.1.0.zip": "zip-1.1.0",
      "BUS-Core-1.2.0.zip": "zip-1.2.0",
    },
  });

  await dispatch(env, "/releases/BUS-Core-1.1.0.zip", { headers: CORE_IP_A });
  await dispatch(env, "/releases/BUS-Core-1.2.0.zip", { headers: CORE_IP_A });

  assert.equal(db.metricRow(todayDay()).downloads, 2);
  assert.equal(db.releaseDownloadRows().length, 2);
});

test("artifact and update-check gates use separate scopes for the same IP and UTC day", async () => {
  const { db, env } = createHarness({ manifestVersion: "1.4.0" });

  await dispatch(env, VALID_REPEAT_CHECK, { headers: CORE_IP_A });
  await dispatch(env, "/releases/BUS-Core-1.4.0.zip", { headers: CORE_IP_A });

  assert.deepEqual(db.metricRow(todayDay()), { update_checks: 1, downloads: 1, errors: 0 });
  assert.equal(db.rateLimits.size, 2);
});

test("missing client IP or rate secret skips counting without blocking artifact delivery", async () => {
  const { db, env } = createHarness();
  const withoutIp = await dispatch(env, "/releases/BUS-Core-1.1.0.zip");
  assert.equal(withoutIp.status, 200);
  assert.equal(db.metricRow(todayDay()).downloads, 0);

  const { db: noSecretDb, env: noSecretEnv } = createHarness({ omitRateLimitSecret: true });
  const withoutSecret = await dispatch(noSecretEnv, "/releases/BUS-Core-1.1.0.zip", { headers: CORE_IP_A });
  assert.equal(withoutSecret.status, 200);
  assert.equal(noSecretDb.metricRow(todayDay()).downloads, 0);
});

test("rate-control storage failure skips counting without blocking artifact delivery", async () => {
  const { db, env } = createHarness({ failRateLimit: true });

  const response = await dispatch(env, "/releases/BUS-Core-1.1.0.zip", { headers: CORE_IP_A });

  assert.equal(response.status, 200);
  assert.equal(db.metricRow(todayDay()).downloads, 0);
  assert.deepEqual(db.releaseDownloadRows(), []);
});

test("Range requests return 206 and remain outside client-bucket credit", async () => {
  const { db, env } = createHarness();

  const response = await dispatch(env, "/releases/BUS-Core-1.1.0.zip", {
    headers: { ...CORE_IP_A, Range: "bytes=0-0" },
  });

  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Content-Range"), "bytes 0-0/8");
  assert.equal(await response.text(), "z");
  assert.equal(db.metricRow(todayDay()).downloads, 0);
  assert.equal(db.artifactTrafficRow(todayDay()).partial_responses, 1);
  assert.equal(db.artifactTrafficRow(todayDay()).range_requests, 1);
  assert.equal(db.artifactTrafficRow(todayDay()).response_bytes, 1);
});

test("HEAD /releases/... serves metadata without download credit", async () => {
  const { db, env } = createHarness();

  const response = await dispatch(env, "/releases/BUS-Core-1.1.0.zip", { method: "HEAD" });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Length"), "8");
  assert.equal(await response.text(), "");
  assert.equal(db.metricRow(todayDay()).downloads, 0);
  assert.deepEqual(db.releaseDownloadRows(), []);
  assert.equal(db.artifactTrafficRow(todayDay()).head_requests, 1);
  assert.equal(db.artifactTrafficRow(todayDay()).successful_responses, 0);
});

test("GET /manifest/core/stable.json does not increment downloads or update_checks", async () => {
  const { db, env } = createHarness();

  const response = await dispatch(env, "/manifest/core/stable.json");

  assert.equal(response.status, 200);
  assert.deepEqual(db.metricRow(todayDay()), { update_checks: 0, downloads: 0, errors: 0 });
});

test("ignored IP suppresses qualified update checks and artifact downloads", async () => {
  const { db, env } = createHarness({ manifestVersion: "1.4.0", ignoredIp: "203.0.113.10" });
  const headers = { "CF-Connecting-IP": "203.0.113.10" };

  await dispatch(env, VALID_FIRST_CHECK, { headers });
  await dispatch(env, "/releases/BUS-Core-1.4.0.zip", { headers });

  assert.deepEqual(db.metricRow(todayDay()), { update_checks: 0, downloads: 0, errors: 0 });
  assert.deepEqual(db.releaseDownloadRows(), []);
  assert.deepEqual(db.releaseUpdateCheckRows(), []);
});

test("bare public /update/check still serves the manifest but is not counted", async () => {
  const { db, env } = createHarness({ manifestVersion: "1.4.0" });

  const response = await dispatch(env, "/update/check");

  assert.equal(response.status, 200);
  assert.equal(db.metricRow(todayDay()).update_checks, 0);
  assert.deepEqual(db.releaseUpdateCheckRows(), []);
});

test("exact BUS Core v1.4 request shape is counted", async () => {
  const { db, env } = createHarness({ manifestVersion: "1.4.0" });

  const response = await dispatch(env, VALID_FIRST_CHECK, { headers: CORE_IP_A });

  assert.equal(response.status, 200);
  assert.equal(db.metricRow(todayDay()).update_checks, 1);
  assert.deepEqual(db.releaseUpdateCheckRows(), [{
    day: todayDay(),
    channel: "stable",
    client_version: "1.4.0",
    latest_version: "1.4.0",
    update_available: "false",
    checks: 1,
    first_check_true: 1,
    first_check_false: 0,
    first_check_unknown: 0,
  }]);
});

test("malformed, legacy, duplicated, and embellished query shapes are not counted", async () => {
  const invalidPaths = [
    "/update/check?current_version=1.4.0&channel=stable",
    "/update/check?version=1.4.0&channel=stable&first_check=true",
    "/update/check?current_version=1.4.0&channel=stable&first_check=true&probe=1",
    "/update/check?current_version=1.4.0&channel=stable&first_check=true&first_check=false",
    "/update/check?current_version=1.4.0&channel=stable&first_check=1",
    "/update/check?current_version=1.4.0&channel=STABLE&first_check=true",
    "/update/check?current_version=01.4.0&channel=stable&first_check=true",
  ];

  for (const path of invalidPaths) {
    const { db, env } = createHarness({ manifestVersion: "1.4.0" });
    const response = await dispatch(env, path, { headers: CORE_IP_A });
    assert.equal(response.status, 200, path);
    assert.equal(db.metricRow(todayDay()).update_checks, 0, path);
    assert.deepEqual(db.releaseUpdateCheckRows(), [], path);
  }
});

test("versions before the instrumented floor or ahead of the selected manifest are not counted", async () => {
  for (const version of ["1.3.3", "1.4.1", "999.0.0"]) {
    const { db, env } = createHarness({ manifestVersion: "1.4.0" });
    const path = `/update/check?current_version=${version}&channel=stable&first_check=true`;
    const response = await dispatch(env, path, { headers: CORE_IP_A });
    assert.equal(response.status, 200);
    assert.equal(db.metricRow(todayDay()).update_checks, 0, version);
  }
});

test("non-stable channels count only when the manifest has an explicit matching channel", async () => {
  const manifestRaw = JSON.stringify({
    latest: { version: "1.4.0", download: { url: "/releases/BUS-Core-1.4.0.zip" } },
    channels: {
      test: { version: "1.4.0", download: { url: "/releases/BUS-Core-1.4.0.zip" } },
    },
  });
  const { db, env } = createHarness({ manifestVersion: "1.4.0", manifestRaw });

  await dispatch(
    env,
    "/update/check?current_version=1.4.0&channel=test&first_check=false",
    { headers: CORE_IP_A },
  );

  assert.equal(db.metricRow(todayDay()).update_checks, 1);
  assert.equal(db.releaseUpdateCheckRows()[0].channel, "test");

  const { db: missingDb, env: missingEnv } = createHarness({ manifestVersion: "1.4.0" });
  await dispatch(
    missingEnv,
    "/update/check?current_version=1.4.0&channel=test&first_check=false",
    { headers: CORE_IP_A },
  );
  assert.equal(missingDb.metricRow(todayDay()).update_checks, 0);
});

test("counting is capped at two qualified requests per IP and UTC day", async () => {
  const { db, env } = createHarness({ manifestVersion: "1.4.0" });

  await dispatch(env, VALID_FIRST_CHECK, { headers: CORE_IP_A });
  await dispatch(env, VALID_REPEAT_CHECK, { headers: CORE_IP_A });
  const third = await dispatch(env, VALID_REPEAT_CHECK, { headers: CORE_IP_A });

  assert.equal(third.status, 200);
  assert.equal(db.metricRow(todayDay()).update_checks, 2);
  assert.equal(db.releaseUpdateCheckRows()[0].checks, 2);
  assert.equal(db.releaseUpdateCheckRows()[0].first_check_true, 1);
  assert.equal(db.releaseUpdateCheckRows()[0].first_check_false, 1);

  await dispatch(env, VALID_REPEAT_CHECK, { headers: CORE_IP_B });
  assert.equal(db.metricRow(todayDay()).update_checks, 3);
});

test("missing client IP fails closed for counting while manifest delivery stays available", async () => {
  const { db, env } = createHarness({ manifestVersion: "1.4.0" });

  const response = await dispatch(env, VALID_FIRST_CHECK);

  assert.equal(response.status, 200);
  assert.equal(db.metricRow(todayDay()).update_checks, 0);
});

test("missing production rate secret fails closed for counting", async () => {
  const { db, env } = createHarness({
    manifestVersion: "1.4.0",
    omitRateLimitSecret: true,
  });

  const response = await dispatch(env, VALID_FIRST_CHECK, { headers: CORE_IP_A });

  assert.equal(response.status, 200);
  assert.equal(db.metricRow(todayDay()).update_checks, 0);
});

test("rate-control storage failure fails closed for counting without breaking update checks", async () => {
  const { db, env } = createHarness({ manifestVersion: "1.4.0", failRateLimit: true });

  const response = await dispatch(env, VALID_FIRST_CHECK, { headers: CORE_IP_A });

  assert.equal(response.status, 200);
  assert.equal(db.metricRow(todayDay()).update_checks, 0);
  assert.deepEqual(db.releaseUpdateCheckRows(), []);
});

test("additive release-signal write failure does not break a qualified update check", async () => {
  const { db, env } = createHarness({
    manifestVersion: "1.4.0",
    failReleaseSignalWrites: true,
  });

  const response = await dispatch(env, VALID_FIRST_CHECK, { headers: CORE_IP_A });

  assert.equal(response.status, 200);
  assert.equal(db.metricRow(todayDay()).update_checks, 1);
  assert.deepEqual(db.releaseUpdateCheckRows(), []);
});

test("/report exposes only qualified known-version check-ins", async () => {
  const { db, env } = createHarness({ manifestVersion: "1.4.0" });
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("skip refresh");
  };

  try {
    await dispatch(env, VALID_FIRST_CHECK, { headers: CORE_IP_A });
    await dispatch(env, VALID_REPEAT_CHECK, { headers: CORE_IP_B });
    await dispatch(env, "/update/check", { headers: { "CF-Connecting-IP": "198.51.100.12" } });
    await dispatch(env, "/releases/BUS-Core-1.4.0.zip", { headers: CORE_IP_A });

    const reportResponse = await dispatch(env, "/report", {
      headers: { "X-Admin-Token": "secret-token" },
    });
    const payload = await reportResponse.json();
    const today = payload.release_signals.today;

    assert.equal(reportResponse.status, 200);
    assert.equal(today.raw_update_checks, 2);
    assert.equal(today.breakdown_update_checks, 2);
    assert.equal(today.raw_breakdown_delta, 0);
    assert.equal(today.update_checks_with_known_client_version, 2);
    assert.equal(today.update_checks_unknown_client_version, 0);
    assert.equal(today.first_seen_checkins, 1);
    assert.equal(today.repeat_checkins, 1);
    assert.equal(today.unknown_first_checkins, 0);
    assert.equal(today.first_seen_share, 0.5);
    assert.equal(today.latest_version_checkins, 2);
    assert.equal(today.artifact_downloads, 1);
    assert.equal(today.artifact_measurement_available, true);
    assert.equal(today.raw_artifact_requests, 1);
    assert.equal(today.successful_artifact_responses, 1);
    assert.equal(today.deduplicated_artifact_clients, 1);
    assert.equal(today.suppressed_repetitive_requests, 0);
    assert.equal(db.metricRow(todayDay()).update_checks, 2);
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
    assert.equal(payload.release_signals.today.raw_update_checks, 0);
    assert.equal(payload.release_signals.today.breakdown_update_checks, 0);
    assert.equal(payload.release_signals.today.artifact_measurement_available, false);
    assert.equal(payload.release_signals.today.raw_artifact_requests, null);
  } finally {
    global.fetch = originalFetch;
  }
});

test("/report keeps legacy release signals but returns null truth fields before migration 0014", async () => {
  const { env } = createHarness({ failTrafficTruthReads: true });
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error("skip refresh"); };
  try {
    const response = await dispatch(env, "/report?site_key=buscore", {
      headers: { "X-Admin-Token": "secret-token" },
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.release_signals.today.artifact_downloads, 0);
    assert.equal(payload.release_signals.today.artifact_measurement_available, false);
    assert.equal(payload.release_signals.today.raw_artifact_requests, null);
    assert.equal(payload.release_signals.today.probable_human_download_intents, null);
  } finally {
    global.fetch = originalFetch;
  }
});

test("invalid manifest version prevents counting without breaking manifest delivery", async () => {
  const { db, env } = createHarness({ manifestVersion: "v1.4.0" });

  const response = await dispatch(env, VALID_FIRST_CHECK, { headers: CORE_IP_A });

  assert.equal(response.status, 200);
  assert.equal(db.metricRow(todayDay()).update_checks, 0);
  assert.deepEqual(db.releaseUpdateCheckRows(), []);
});

test("GET /report and scoped BUS Core report retain release-signal parity", async () => {
  const { env } = createHarness({ manifestVersion: "1.4.0" });
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("skip refresh");
  };

  try {
    await dispatch(env, VALID_FIRST_CHECK, { headers: CORE_IP_A });
    await dispatch(env, VALID_REPEAT_CHECK, { headers: CORE_IP_B });

    const plain = await (
      await dispatch(env, "/report", { headers: { "X-Admin-Token": "secret-token" } })
    ).json();
    const scoped = await (
      await dispatch(env, "/report?site_key=buscore", {
        headers: { "X-Admin-Token": "secret-token" },
      })
    ).json();

    assert.deepEqual(scoped.release_signals, plain.release_signals);
  } finally {
    global.fetch = originalFetch;
  }
});
