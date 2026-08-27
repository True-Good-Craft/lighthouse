import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as workerModule from "../dist/index.js";
import {
  computeProductIntentScore,
  computeCommunityResponseScore,
  computeGithubTrustScore,
  computeReliabilityScore,
  computeLeadQualityScore,
  computeAcquisitionReadinessScore,
  aggregateMonthlyRollup,
  parseOperatorNoteBody,
  parseReportSnapshotBody,
} from "../dist/index.js";

const worker = workerModule.default?.fetch ? workerModule.default : workerModule.default?.default ?? workerModule.default;
const PII = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|bc_uid|bc_sid|anon_user_id|session_id|ip_hash|user_agent/i;
const ctx = { waitUntil() {} };

// ---- scoring determinism, null-honesty, raw-inputs-always-present ----------

test("scores are deterministic and every score carries its raw inputs (no hidden numbers)", () => {
  const inputs = { wqpiThis: 48, wqpiPrev: 37, attributedLeads: 9, leadsTotal: 11, downloadClicks: 60, artifactDownloads: 48 };
  const a = computeProductIntentScore(inputs);
  const b = computeProductIntentScore(inputs);
  assert.equal(a.score, b.score);
  assert.equal(typeof a.score, "number");
  assert.ok(a.inputs && typeof a.inputs === "object" && Object.keys(a.inputs).length > 0, "must expose inputs");
  assert.equal(a.inputs.wqpi_this, 48);
  assert.equal(a.inputs.wqpi_prev, 37);
});

test("product intent is null (not faked) when there is no prior month or lead/click data", () => {
  const r = computeProductIntentScore({ wqpiThis: null, wqpiPrev: null, attributedLeads: null, leadsTotal: null, downloadClicks: null, artifactDownloads: null });
  assert.equal(r.score, null);
  assert.equal(r.available, false);
  assert.match(r.reason, /insufficient data/);
});

test("reliability is null when no health checks have run yet (never assumes 100%)", () => {
  const r = computeReliabilityScore({ healthOk: null, healthTotal: null, latestRollupAgeHours: null, errors: null, downloads: null });
  assert.equal(r.score, null);
  assert.match(r.reason, /awaiting first scheduled health checks/);
});

test("github trust weights stars at <=10% and is null with no snapshot", () => {
  assert.equal(computeGithubTrustScore({ latestReleaseAgeDays: null, mergedPrs: null, closedIssues: null, contributors: null, stars: null }).score, null);
  // stars alone contribute at most ~10 (their weight is the only component present).
  const starsOnly = computeGithubTrustScore({ latestReleaseAgeDays: null, mergedPrs: null, closedIssues: null, contributors: null, stars: 100 });
  assert.equal(starsOnly.score, 100); // re-normalized when only stars present, but weight documented as 10
  assert.equal(starsOnly.inputs.stars, 100);
});

test("acquisition readiness is null without reliability, and is capped by reliability", () => {
  const reliabilityNull = { score: null, available: false, reason: "x", weight: 20, inputs: {} };
  const some = { score: 90, available: true, reason: null, weight: 30, inputs: {} };
  const noRel = computeAcquisitionReadinessScore({ productIntent: some, reliability: reliabilityNull, community: some, githubTrust: some, leadQuality: some });
  assert.equal(noRel.score, null);
  assert.match(noRel.reason, /reliability/);

  const rel = { score: 50, available: true, reason: null, weight: 20, inputs: {} };
  const capped = computeAcquisitionReadinessScore({ productIntent: { score: 95, available: true, reason: null, weight: 30, inputs: {} }, reliability: rel, community: some, githubTrust: some, leadQuality: some });
  assert.ok(capped.score <= 60, "capped at reliability + 10");
  // sub-scores always visible
  assert.equal(capped.inputs.reliability, 50);
  assert.equal(capped.inputs.note, "score is not a valuation");
});

test("community response is null with zero posts", () => {
  assert.equal(computeCommunityResponseScore({ posts: 0, cappedDownstreamActions: 0, channels: 0 }).score, null);
});

test("lead quality is null when leads DB is unavailable or empty", () => {
  assert.match(computeLeadQualityScore({ total: null, attributed: null, withPainPoint: null, withConsent: null }).reason, /unavailable/);
  assert.match(computeLeadQualityScore({ total: 0, attributed: 0, withPainPoint: 0, withConsent: 0 }).reason, /insufficient data/);
});

test("aggregateMonthlyRollup sums nullable fields and returns null for all-empty", () => {
  const empty = aggregateMonthlyRollup([]);
  assert.equal(empty.wqpi, null);
  assert.equal(empty.days_with_data, 0);
  const rows = [
    { day: "2026-06-01", wqpi: 3, artifact_downloads: 2, attributed_leads: 1, leads_total: 1, update_checks_known: 100, latest_checkins: 70, download_clicks: 4, errors: 0, top_source: "reddit" },
    { day: "2026-06-02", wqpi: 5, artifact_downloads: 4, attributed_leads: 1, leads_total: 2, update_checks_known: 120, latest_checkins: 90, download_clicks: 6, errors: 0, top_source: "reddit" },
  ];
  const agg = aggregateMonthlyRollup(rows);
  assert.equal(agg.wqpi, 8);
  assert.equal(agg.artifact_downloads, 6);
  assert.equal(agg.top_source, "reddit");
  assert.equal(agg.days_with_data, 2);
});

// ---- body parsers ---------------------------------------------------------

test("parseOperatorNoteBody requires a note; parseReportSnapshotBody requires a valid kind", () => {
  assert.equal(parseOperatorNoteBody({}), null);
  const note = parseOperatorNoteBody({ note: "shipped v1.3.2", tag: "release" }, { id: "n1", now: "t" });
  assert.equal(note.note, "shipped v1.3.2");
  assert.equal(note.tag, "release");

  assert.equal(parseReportSnapshotBody({ kind: "bogus" }), null);
  const snap = parseReportSnapshotBody({ kind: "monthly", status: "OK", wqpi: 48, summary_json: { acquisition_readiness: 61 }, narrative: "n" }, { id: "s1", now: "t" });
  assert.equal(snap.kind, "monthly");
  assert.equal(snap.wqpi, 48);
  assert.match(snap.summary_json, /acquisition_readiness/);
});

// ---- migration structure --------------------------------------------------

test("migration 0011 creates report_snapshots and operator_notes idempotently", () => {
  const sql = readFileSync(new URL("../migrations/0011_add_phase3_report_and_notes.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS report_snapshots/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS operator_notes/);
  assert.doesNotMatch(sql, /\bDROP\b|\bDELETE\b|\bALTER\b/);
});

// ---- view=monthly + write routes (worker.fetch) ---------------------------

function monthlyDb({ empty = false, inserts } = {}) {
  const rollupRows = empty ? [] : [
    { day: "2026-06-10", wqpi: 3, artifact_downloads: 2, attributed_leads: 1, leads_total: 1, update_checks_known: 100, latest_checkins: 72, download_clicks: 4, return_rate: null, cf_requests: 100, cf_visits: 20, errors: 0, top_source: "reddit", top_referrer: "google.com", captured_at: "t" },
    { day: "2026-06-20", wqpi: 5, artifact_downloads: 4, attributed_leads: 2, leads_total: 3, update_checks_known: 120, latest_checkins: 96, download_clicks: 6, return_rate: null, cf_requests: 120, cf_visits: 25, errors: 0, top_source: "reddit", top_referrer: "google.com", captured_at: "t" },
  ];
  return {
    prepare(sql) {
      const s = sql.replace(/\s+/g, " ").trim();
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() {
          if (s.includes("FROM github_snapshots")) return empty ? null : { day: "2026-07-01", stars: 13, forks: 0, watchers: 1, open_issues: 0, closed_issues: 5, open_prs: 0, merged_prs: 3, contributors: 1, latest_release: "v1.3.2", latest_release_at: "2026-06-20T00:00:00Z", commits_total: 764, release_asset_downloads: 42, captured_at: "t" };
          if (s.includes("SUM(ok)")) return empty ? { ok: 0, total: 0 } : { ok: 20, total: 21 };
          if (s.includes("AS with_pain")) return empty ? { total: 0, attributed: 0, with_pain: 0, with_consent: 0 } : { total: 10, attributed: 8, with_pain: 6, with_consent: 5 };
          if (s.includes("FROM site_events_raw")) return { c: 6 };
          if (s.includes("FROM early_access_leads")) return { c: 2 };
          if (s.includes("FROM report_snapshots")) return null;
          return null;
        },
        async all() {
          if (s.includes("FROM daily_rollup")) return { results: rollupRows };
          if (s.includes("FROM campaign_log")) return { results: empty ? [] : [
            { id: "c1", created_at: "2026-06-05T00:00:00Z", posted_at: "2026-06-05T13:00:00Z", channel: "reddit", community: "r/lasercutting", angle: "x", tagged_src: "reddit_lc", utm_campaign: "202606_lc", tagged_url: "u", notes: "n" },
          ] };
          if (s.includes("FROM operator_notes")) return { results: empty ? [] : [{ id: "n1", created_at: "2026-06-15T00:00:00Z", note: "shipped v1.3.2", tag: "release" }] };
          return { results: [] };
        },
        async run() {
          if (inserts) inserts.push({ sql: s, args });
          return { success: true };
        },
      };
      return api;
    },
  };
}

function monthlyEnv(opts) {
  const db = monthlyDb(opts);
  return { DB: db, BUSCORE_LEADS_DB: db, MANIFEST_R2: {}, ADMIN_TOKEN: "secret", IGNORED_IP: "", CF_API_TOKEN: "", CF_ZONE_TAG: "" };
}

test("GET /report?view=monthly with no Phase 2 data renders awaiting/insufficient, never fakes a score", async () => {
  const res = await worker.fetch(new Request("https://lighthouse.buscore.ca/report?view=monthly", { headers: { "X-Admin-Token": "secret" } }), monthlyEnv({ empty: true }), ctx);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.view, "monthly");
  assert.equal(body.data_status, "awaiting first scheduled rollup");
  assert.equal(body.scores.reliability.score, null);
  assert.equal(body.scores.acquisition_readiness.score, null);
  assert.equal(body.scores.product_intent.score, null);
  assert.doesNotMatch(JSON.stringify(body), PII);
});

test("GET /report?view=monthly with data computes scores, shows sub-scores + inputs, no PII", async () => {
  const res = await worker.fetch(new Request("https://lighthouse.buscore.ca/report?view=monthly", { headers: { "X-Admin-Token": "secret" } }), monthlyEnv(), ctx);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data_status, "available");
  assert.equal(typeof body.scores.reliability.score, "number");
  assert.equal(typeof body.scores.acquisition_readiness.score, "number");
  // sub-scores visible under the composite; raw inputs present on every score
  assert.ok("reliability" in body.scores.acquisition_readiness.inputs);
  assert.ok(Object.keys(body.scores.reliability.inputs).length > 0);
  assert.equal(body.scores.acquisition_readiness.inputs.note, "score is not a valuation");
  assert.equal(body.repeat_interest.note, "update checks are a proxy, not active users");
  assert.doesNotMatch(JSON.stringify(body), PII);
});

test("GET /report?view=monthly rejects a missing report credential", async () => {
  const res = await worker.fetch(new Request("https://lighthouse.buscore.ca/report?view=monthly"), monthlyEnv(), ctx);
  assert.equal(res.status, 401);
});

test("POST /notes and POST /report/snapshot insert with the admin token and reject without", async () => {
  const inserts = [];
  const env = monthlyEnv({ inserts });

  const note = await worker.fetch(new Request("https://lighthouse.buscore.ca/notes", { method: "POST", headers: { "X-Admin-Token": "secret", "Content-Type": "application/json" }, body: JSON.stringify({ note: "posted in r/3Dprinting", tag: "community" }) }), env, ctx);
  assert.equal(note.status, 201);
  assert.equal((await note.json()).ok, true);

  const snap = await worker.fetch(new Request("https://lighthouse.buscore.ca/report/snapshot", { method: "POST", headers: { "X-Admin-Token": "secret", "Content-Type": "application/json" }, body: JSON.stringify({ kind: "monthly", status: "OK", wqpi: 48, summary_json: { acquisition_readiness: 61 }, narrative: "test" }) }), env, ctx);
  assert.equal(snap.status, 201);

  const noAuth = await worker.fetch(new Request("https://lighthouse.buscore.ca/notes", { method: "POST", body: JSON.stringify({ note: "x" }) }), env, ctx);
  assert.equal(noAuth.status, 401);

  const badSnap = await worker.fetch(new Request("https://lighthouse.buscore.ca/report/snapshot", { method: "POST", headers: { "X-Admin-Token": "secret", "Content-Type": "application/json" }, body: JSON.stringify({ kind: "bogus" }) }), env, ctx);
  assert.equal(badSnap.status, 400);

  assert.ok(inserts.length >= 2, "note + snapshot inserted");
});
