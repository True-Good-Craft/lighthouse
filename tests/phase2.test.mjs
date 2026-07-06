import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as workerModule from "../dist/index.js";
import {
  computeDailyRollupRow,
  parseCampaignInsertBody,
  parseGithubLastPageFromLinkHeader,
  mapGithubApiToSnapshotRow,
  buildCampaignDownstreamQuery,
  probeHealthTarget,
  assembleAssetReport,
  DAILY_ROLLUP_UPSERT_SQL,
  GITHUB_SNAPSHOT_UPSERT_SQL,
} from "../dist/index.js";

const worker = workerModule.default?.fetch ? workerModule.default : workerModule.default?.default ?? workerModule.default;

const PII = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|bc_uid|bc_sid|anon_user_id|session_id|ip_hash|user_agent/i;
const ctx = { waitUntil() {} };

function baseRollupInputs(overrides = {}) {
  return {
    day: "2026-07-05",
    artifact_downloads: 12,
    attributed_leads: 2,
    leads_total: 2,
    update_checks_known: 210,
    latest_checkins: 150,
    download_clicks: 7,
    page_views: 180,
    return_rate: null,
    cf_requests: 5600,
    cf_visits: 1200,
    errors: 0,
    top_source: "reddit",
    top_referrer: "google.com",
    captured_at: "2026-07-06T00:05:00.000Z",
    ...overrides,
  };
}

// ---- daily_rollup aggregation --------------------------------------------

test("computeDailyRollupRow produces wQPI = artifact_downloads + attributed_leads and preserves fields", () => {
  const row = computeDailyRollupRow(baseRollupInputs());
  assert.equal(row.wqpi, 14);
  assert.equal(row.artifact_downloads, 12);
  assert.equal(row.attributed_leads, 2);
  assert.equal(row.update_checks_known, 210);
  assert.equal(row.top_source, "reddit");
  assert.equal(row.return_rate, null);
});

test("computeDailyRollupRow leaves wQPI null when a component is unavailable (never faked)", () => {
  assert.equal(computeDailyRollupRow(baseRollupInputs({ attributed_leads: null })).wqpi, null);
  assert.equal(computeDailyRollupRow(baseRollupInputs({ artifact_downloads: null })).wqpi, null);
});

test("daily_rollup and github_snapshot writers use idempotent day-keyed upserts", () => {
  assert.match(DAILY_ROLLUP_UPSERT_SQL, /INSERT INTO daily_rollup/);
  assert.match(DAILY_ROLLUP_UPSERT_SQL, /ON CONFLICT\(day\) DO UPDATE/);
  assert.match(GITHUB_SNAPSHOT_UPSERT_SQL, /INSERT INTO github_snapshots/);
  assert.match(GITHUB_SNAPSHOT_UPSERT_SQL, /ON CONFLICT\(day\) DO UPDATE/);
});

// ---- migration structure --------------------------------------------------

test("migration 0010 creates the four tables idempotently with day primary keys", () => {
  const sql = readFileSync(new URL("../migrations/0010_add_phase2_analytics_foundation.sql", import.meta.url), "utf8");
  for (const table of ["daily_rollup", "campaign_log", "github_snapshots", "health_checks"]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`), `missing ${table}`);
  }
  assert.match(sql, /CREATE TABLE IF NOT EXISTS daily_rollup \(\s*day\s+TEXT\s+PRIMARY KEY/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS github_snapshots \(\s*day\s+TEXT\s+PRIMARY KEY/);
});

// ---- campaign_log ---------------------------------------------------------

test("parseCampaignInsertBody normalizes an operator body and caps length", () => {
  const row = parseCampaignInsertBody(
    { channel: "reddit", community: "r/lasercutting", utm_campaign: "202607_lasercut", tagged_src: "reddit_lc", notes: "x".repeat(5000) },
    { id: "fixed-id", now: "2026-07-06T00:00:00.000Z" }
  );
  assert.equal(row.id, "fixed-id");
  assert.equal(row.created_at, "2026-07-06T00:00:00.000Z");
  assert.equal(row.channel, "reddit");
  assert.equal(row.utm_campaign, "202607_lasercut");
  assert.equal(row.notes.length, 1000);
});

test("parseCampaignInsertBody rejects empty/whitespace and non-object bodies", () => {
  assert.equal(parseCampaignInsertBody({}), null);
  assert.equal(parseCampaignInsertBody({ channel: "   " }), null);
  assert.equal(parseCampaignInsertBody(null), null);
  assert.equal(parseCampaignInsertBody("nope"), null);
  assert.equal(parseCampaignInsertBody([1, 2]), null);
});

test("buildCampaignDownstreamQuery joins on src AND utm_campaign from the post day", () => {
  const q = buildCampaignDownstreamQuery({ posted_at: "2026-07-01T13:00:00Z", tagged_src: "reddit_lc", utm_campaign: "202607_lasercut" });
  assert.equal(q.postedDay, "2026-07-01");
  assert.match(q.eventsSql, /site_events_raw/);
  assert.match(q.eventsSql, /src = \?/);
  assert.match(q.eventsSql, /utm_campaign = \?/);
  assert.match(q.leadsSql, /early_access_leads/);
  assert.deepEqual(q.eventsBinds, ["2026-07-01", "reddit_lc", "reddit_lc", "202607_lasercut", "202607_lasercut"]);
});

// ---- github_snapshots -----------------------------------------------------

test("parseGithubLastPageFromLinkHeader parses rel=last, returns null when absent", () => {
  const link = '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=42>; rel="last"';
  assert.equal(parseGithubLastPageFromLinkHeader(link), 42);
  assert.equal(parseGithubLastPageFromLinkHeader(null), null);
  assert.equal(parseGithubLastPageFromLinkHeader('<https://x?page=2>; rel="next"'), null);
});

test("mapGithubApiToSnapshotRow tolerates fully-missing GitHub data without crashing", () => {
  const row = mapGithubApiToSnapshotRow("2026-07-06", {}, "2026-07-06T00:05:00.000Z");
  assert.equal(row.stars, null);
  assert.equal(row.forks, null);
  assert.equal(row.latest_release, null);
  assert.equal(row.release_asset_downloads, null);
  assert.equal(row.day, "2026-07-06");
});

test("mapGithubApiToSnapshotRow maps present fields and sums release asset downloads", () => {
  const row = mapGithubApiToSnapshotRow(
    "2026-07-06",
    {
      repo: { stargazers_count: 13, forks_count: 0, subscribers_count: 1 },
      releaseLatest: { tag_name: "v1.3.2", published_at: "2026-06-20T00:00:00Z", assets: [{ download_count: 30 }, { download_count: 12 }] },
      commitsLastPage: 764,
      openIssues: 0,
      mergedPrs: 3,
    },
    "2026-07-06T00:05:00.000Z"
  );
  assert.equal(row.stars, 13);
  assert.equal(row.watchers, 1);
  assert.equal(row.latest_release, "v1.3.2");
  assert.equal(row.commits_total, 764);
  assert.equal(row.merged_prs, 3);
  assert.equal(row.release_asset_downloads, 42);
});

// ---- health_checks --------------------------------------------------------

test("probeHealthTarget records a failed check when the probe throws (never throws)", async () => {
  const result = await probeHealthTarget("site_home", async () => {
    throw new Error("network down");
  });
  assert.equal(result.ok, 0);
  assert.equal(result.status_code, null);
  assert.equal(result.target, "site_home");
  assert.match(result.note, /network down/);
  assert.equal(typeof result.latency_ms, "number");
});

test("probeHealthTarget records ok=1 for a healthy probe", async () => {
  const result = await probeHealthTarget("manifest", async () => ({ status: 200, ok: true }));
  assert.equal(result.ok, 1);
  assert.equal(result.status_code, 200);
});

// ---- view=asset & POST /campaign (worker.fetch) ---------------------------

function fullRollup(day, wqpi) {
  return {
    day, wqpi, artifact_downloads: 12, attributed_leads: 2, leads_total: 2, update_checks_known: 210,
    latest_checkins: 150, download_clicks: 7, page_views: 180, return_rate: null, cf_requests: 5600,
    cf_visits: 1200, errors: 0, top_source: "reddit", top_referrer: "google.com", captured_at: "2026-07-06T00:05:00Z",
  };
}

function makeAssetDb({ inserts } = {}) {
  return {
    prepare(sql) {
      const s = sql.replace(/\s+/g, " ").trim();
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() {
          if (s.includes("FROM daily_rollup")) return fullRollup("2026-07-05", 14);
          if (s.includes("FROM github_snapshots")) {
            return { day: "2026-07-06", stars: 13, forks: 0, watchers: 1, open_issues: 0, closed_issues: 5, open_prs: 0, merged_prs: 3, contributors: 1, latest_release: "v1.3.2", latest_release_at: "2026-06-20T00:00:00Z", commits_total: 764, release_asset_downloads: 42, captured_at: "2026-07-06T00:05:00Z" };
          }
          if (s.includes("FROM site_events_raw")) return { c: 6 };
          if (s.includes("FROM early_access_leads")) return { c: 2 };
          return null;
        },
        async all() {
          if (s.includes("FROM daily_rollup")) return { results: [fullRollup("2026-07-04", 9), fullRollup("2026-07-05", 14)] };
          if (s.includes("FROM health_checks")) return { results: [
            { target: "site_home", ok: 1, status_code: 200, latency_ms: 120, checked_at: "2026-07-06T00:05:00Z", note: null },
            { target: "manifest", ok: 1, status_code: 200, latency_ms: 80, checked_at: "2026-07-06T00:05:00Z", note: null },
          ] };
          if (s.includes("FROM campaign_log")) return { results: [
            { id: "c1", created_at: "2026-07-01T00:00:00Z", posted_at: "2026-07-01T13:00:00Z", channel: "reddit", community: "r/lasercutting", angle: "spreadsheet pain", tagged_src: "reddit_lc", utm_campaign: "202607_lasercut", tagged_url: "https://reddit.com/x", notes: "tone: not salesy" },
          ] };
          return { results: [] };
        },
        async run() {
          if (s.includes("INSERT INTO campaign_log") && inserts) inserts.push(args);
          return { success: true };
        },
      };
      return api;
    },
  };
}

function assetEnv(overrides = {}) {
  const db = makeAssetDb(overrides.dbOptions);
  return {
    DB: db,
    BUSCORE_LEADS_DB: db,
    MANIFEST_R2: {},
    ADMIN_TOKEN: "secret",
    IGNORED_IP: "",
    CF_API_TOKEN: "",
    CF_ZONE_TAG: "",
  };
}

test("GET /report?view=asset returns rollup, github, health, campaigns with downstream and no PII", async () => {
  const env = assetEnv();
  const response = await worker.fetch(
    new Request("https://lighthouse.buscore.ca/report?view=asset", { headers: { "X-Admin-Token": "secret" } }),
    env,
    ctx
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.view, "asset");
  assert.equal(body.rollup.latest.wqpi, 14);
  assert.equal(body.rollup.last_14_days.length, 2);
  assert.equal(body.github.stars, 13);
  assert.equal(body.health.length, 2);
  assert.equal(body.campaigns.length, 1);
  assert.deepEqual(body.campaigns[0].downstream, { events: 6, leads: 2 });
  assert.doesNotMatch(JSON.stringify(body), PII, "asset report must contain no PII");
});

test("GET /report?view=asset requires the admin token", async () => {
  const response = await worker.fetch(new Request("https://lighthouse.buscore.ca/report?view=asset"), assetEnv(), ctx);
  assert.equal(response.status, 401);
});

test("POST /campaign inserts an operator campaign row with the admin token", async () => {
  const inserts = [];
  const env = assetEnv({ dbOptions: { inserts } });
  const response = await worker.fetch(
    new Request("https://lighthouse.buscore.ca/campaign", {
      method: "POST",
      headers: { "X-Admin-Token": "secret", "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "reddit", community: "r/lasercutting", tagged_src: "reddit_lc", utm_campaign: "202607_lasercut" }),
    }),
    env,
    ctx
  );
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.id, "string");
  assert.equal(inserts.length, 1);
});

test("POST /campaign rejects without admin token and rejects empty bodies", async () => {
  const unauth = await worker.fetch(
    new Request("https://lighthouse.buscore.ca/campaign", { method: "POST", body: "{}" }),
    assetEnv(),
    ctx
  );
  assert.equal(unauth.status, 401);

  const empty = await worker.fetch(
    new Request("https://lighthouse.buscore.ca/campaign", {
      method: "POST",
      headers: { "X-Admin-Token": "secret", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    assetEnv(),
    ctx
  );
  assert.equal(empty.status, 400);
});

test("assembleAssetReport is a pure shaper that tags the view", () => {
  const shaped = assembleAssetReport({
    generated_at: "2026-07-06T12:00:00Z",
    rollup: { latest: null, last_14_days: [] },
    github: null,
    health: [],
    campaigns: [],
  });
  assert.equal(shaped.view, "asset");
  assert.equal(shaped.github, null);
});
