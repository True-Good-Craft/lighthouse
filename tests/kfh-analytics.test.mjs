import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import initSqlJs from "sql.js";
import workerModule, { parseCanonicalEventPayload, resolveReportRequest } from "../dist/index.js";
import { parseKfhEvent, ingestKfhEvent, buildKfhReport, pruneKfhData } from "../dist/kfhAnalytics.js";
import { isKfhReport, KFH_SITE_KEY, KFH_ORIGINS, KFH_COUNT_KEYS } from "../dist/kfhContract.js";

const worker = workerModule.fetch ? workerModule : workerModule.default;
const now = new Date("2026-09-04T12:00:00.000Z");
const payload = (overrides = {}) => ({ site_key: KFH_SITE_KEY, contract_version: 1, consent: true, page: "directory", event_name: "page_view", ...overrides });
// Execute the checked-in SQL with SQLite WASM. This tests SQL/atomic batches,
// not Cloudflare's native Worker lifecycle or remote D1 deployment.
let sqlite, db;
before(async () => {
  const SQL = await initSqlJs(); sqlite = new SQL.Database();
  const prepare = (sql, values = []) => ({
    bind(...next) { return prepare(sql, next); },
    async run() { sqlite.run(sql, values); return { success: true }; },
    async all() {
      const statement = sqlite.prepare(sql); const results = [];
      try { statement.bind(values); while (statement.step()) results.push(statement.getAsObject()); }
      finally { statement.free(); }
      return { success: true, results };
    },
    async first() { return (await this.all()).results[0] ?? null; },
  });
  db = { prepare, async exec(sql) { sqlite.exec(sql); }, async batch(statements) {
    sqlite.run("BEGIN");
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.run("COMMIT"); return results; }
    catch (error) { sqlite.run("ROLLBACK"); throw error; }
  } };
  for (const name of ["0008_add_site_event_rate_limit.sql", "0016_add_kfh_daily.sql"]) {
    await db.exec(fs.readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  }
});
after(() => { sqlite?.close(); });
beforeEach(async () => { await db.exec("DELETE FROM kfh_daily; DELETE FROM site_event_rate_limit;"); });

test("strict Kingston payload rejects sensitive fields and action attribution", () => {
  assert.equal(parseKfhEvent(payload()).counter, "page_views");
  for (const key of ["anon_user_id", "session_id", "provider", "resource_id", "phone", "search", "filter", "category", "lat", "url", "path", "referrer", "client_ts", "viewport", "country", "test_mode"]) {
    assert.equal(parseKfhEvent(payload({ [key]: "sensitive fixture" })), null, key);
  }
  for (const patch of [{ consent: false }, { consent: "true" }, { site_key: "tgc_site" }, { event_name: "scroll" }, { campaign: "person@example.test" }, { content: "private-group" }, { page: "food-bank" }]) assert.equal(parseKfhEvent(payload(patch)), null);
  for (const event_value of ["resource_call", "help_211"]) {
    assert.ok(parseKfhEvent(payload({ event_name: "contact_click", event_value })));
    assert.equal(parseKfhEvent(payload({ event_name: "contact_click", event_value, source: "facebook" })), null);
  }
  assert.equal(parseKfhEvent(payload({ event_name: "pwa_install", event_value: "device" })), null);
  assert.equal(parseCanonicalEventPayload(payload({ client_ts: now.toISOString(), path: "/", url: KFH_ORIGINS[0], referrer: "", device: "mobile", viewport: "320x600", lang: "en", tz: "UTC", utm: {} })), null);
});

test("D1 writes separate daily aggregates, with atomic page attribution and no raw rows", async () => {
  await ingestKfhEvent(payload({ source: "facebook", campaign: "launch_2026_09", content: "post_01" }), db, KFH_ORIGINS[0], async () => true, now);
  await ingestKfhEvent(payload({ event_name: "contact_click", event_value: "resource_call" }), db, KFH_ORIGINS[0], async () => true, now);
  const rows = (await db.prepare("SELECT * FROM kfh_daily ORDER BY metric").all()).results;
  assert.equal(rows.length, 5);
  assert.ok(rows.every(row => Object.keys(row).sort().join(",") === "count,day,metric,value"));
  assert.ok(rows.every(row => row.day === "2026-09-04"));
  assert.equal(rows.filter(row => row.metric === "source")[0].count, 1);
  const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results;
  assert.ok(!tables.some(row => row.name === "site_events_raw"));
  await assert.rejects(db.prepare("INSERT INTO kfh_daily VALUES ('2026-09-04', 'source', 'person@example.test', 1)").run());
});

test("origin and rate failures write no Kingston measurements", async () => {
  for (const origin of [null, "https://evil.example", "http://kingstonfoodhelp.ca", "https://kingstonfoodhelp.ca.evil.example", "https://preview.pages.dev"]) {
    await ingestKfhEvent(payload(), db, origin, async () => { throw new Error("must not call rate gate"); }, now);
  }
  await ingestKfhEvent(payload(), db, KFH_ORIGINS[0], async () => false, now);
  await assert.rejects(ingestKfhEvent(payload(), db, KFH_ORIGINS[0], async () => { throw new Error("fixture rate failure"); }, now));
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM kfh_daily").first()).n, 0);
});

async function submit(body, options = {}) {
  const pending = [];
  const headers = { Origin: KFH_ORIGINS[0], "CF-Connecting-IP": "192.0.2.5", ...options.headers };
  const request = new Request("https://lighthouse.test/metrics/event", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
  const response = await worker.fetch(request, { DB: db, TELEMETRY_RATE_LIMIT_SECRET: "local-test-rate-secret", ...options.env }, { waitUntil(p) { pending.push(p); } });
  await Promise.all(pending);
  return response;
}

test("public route is fail-soft, production-only, privacy-suppressed and rate-bounded", async () => {
  for (const options of [{ headers: { DNT: "1" } }, { headers: { "Sec-GPC": "1" } }, { headers: { "CF-Connecting-IP": "" } }, { env: { TELEMETRY_RATE_LIMIT_SECRET: "" } }, { env: { IGNORED_IP: "192.0.2.5" } }]) assert.equal((await submit(payload(), options)).status, 204);
  for (const body of ["{invalid", "x".repeat(1025), payload({ site_key: "buscore", anon_user_id: "fixture" }), payload({ consent: false })]) assert.equal((await submit(body)).status, 204);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM kfh_daily").first()).n, 0);
  for (let i = 0; i < 51; i++) await submit(payload());
  const rate = (await db.prepare("SELECT * FROM site_event_rate_limit").all()).results;
  assert.equal((await db.prepare("SELECT count FROM kfh_daily WHERE metric='event' AND value='page_views'").first()).count, rate.reduce((sum, row) => sum + Math.min(row.count, 50), 0));
  assert.ok(rate.length >= 1 && rate.length <= 2); // A UTC minute may turn during the test.
  assert.match(rate[0].ip_hash, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(rate).includes("192.0.2.5"));
  const response = await submit(payload());
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), KFH_ORIGINS[0]);
  assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
});

test("failed attribution writes roll back the event total and migration reapplication preserves data", async () => {
  await db.exec("CREATE TRIGGER fixture_reject_content BEFORE INSERT ON kfh_daily WHEN NEW.metric = 'content' BEGIN SELECT RAISE(ABORT, 'fixture'); END;");
  try {
    await assert.rejects(ingestKfhEvent(payload(), db, KFH_ORIGINS[0], async () => true, now));
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM kfh_daily").first()).n, 0);
  } finally { await db.exec("DROP TRIGGER fixture_reject_content;"); }
  await ingestKfhEvent(payload(), db, KFH_ORIGINS[0], async () => true, now);
  await db.exec(fs.readFileSync(new URL("../migrations/0016_add_kfh_daily.sql", import.meta.url), "utf8"));
  assert.equal((await db.prepare("SELECT count FROM kfh_daily WHERE metric='event'").first()).count, 1);
});

test("rate storage failure cannot fail delivery or leak the error/payload", async () => {
  const warnings = []; const original = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const response = await submit(payload(), { env: { DB: { prepare() { throw new Error("sensitive-fixture"); } } } });
    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
    assert.deepEqual(warnings, [["KFH ingest unavailable; submission dropped."]]);
  } finally { console.warn = original; }
});

test("report uses complete UTC windows and preserves empty versus unavailable data", async () => {
  const empty = await buildKfhReport(db, now);
  assert.ok(isKfhReport(empty));
  assert.equal(empty.source.reason, "no_observed_history");
  assert.equal(empty.windows.last_7_complete_days.counts.page_views, 0);
  for (const date of ["2026-08-05", "2026-08-21", "2026-08-27", "2026-08-28", "2026-09-03", "2026-09-04"]) {
    await ingestKfhEvent(payload(), db, KFH_ORIGINS[0], async () => true, new Date(`${date}T23:59:59Z`));
  }
  const report = await buildKfhReport(db, now);
  assert.ok(isKfhReport(report));
  assert.deepEqual(Object.values(report.windows).map(window => window.counts.page_views), [1, 1, 2, 2, 5]);
  assert.equal(report.windows.last_7_complete_days.start_day, "2026-08-28");
  assert.equal(report.windows.previous_7_complete_days.end_day, "2026-08-27");
  assert.equal(report.discovery_last_7_complete_days.sources[0].count, 2);
  const unavailable = await buildKfhReport({ prepare() { throw new Error("fixture failure"); } }, now);
  assert.ok(isKfhReport(unavailable));
  assert.equal(unavailable.source.reason, "query_failed");
  assert.ok(Object.values(unavailable.windows).every(window => window.counts === null));
  assert.equal(unavailable.discovery_last_7_complete_days, null);
});

test("aggregate retention bounds both storage and reporting without raw event history", async () => {
  const inside = new Date(now.getTime() - 399 * 86400000);
  const outside = new Date(now.getTime() - 400 * 86400000);
  for (const date of [inside, outside]) await ingestKfhEvent(payload(), db, KFH_ORIGINS[0], async () => true, date);
  assert.equal((await buildKfhReport(db, now)).source.first_observed_day, inside.toISOString().slice(0, 10));
  await pruneKfhData(db, now);
  assert.equal((await db.prepare("SELECT COUNT(DISTINCT day) AS n FROM kfh_daily").first()).n, 1);
});

test("dedicated report requires authentication, skips traffic refresh and cannot select another site", async () => {
  assert.deepEqual(resolveReportRequest(new URL("https://lighthouse.test/report?view=kfh")), { ok: true, view: "kfh" });
  for (const query of [`?view=site&site_key=${KFH_SITE_KEY}`, `?site_key=${KFH_SITE_KEY}`]) assert.equal(resolveReportRequest(new URL(`https://lighthouse.test/report${query}`)).error, "invalid_site_key");
  const env = { DB: db, ADMIN_TOKEN: "local-admin", REPORT_READ_TOKEN: "r".repeat(32) };
  const ctx = { waitUntil() { throw new Error("no deferred writes"); } };
  assert.equal((await worker.fetch(new Request("https://lighthouse.test/report?view=kfh"), env, ctx)).status, 401);
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("no external traffic refresh"); };
  try {
    const response = await worker.fetch(new Request("https://lighthouse.test/report?view=kfh", { headers: { "X-Report-Token": env.REPORT_READ_TOKEN } }), env, ctx);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.ok(isKfhReport(await response.json()));
  } finally { globalThis.fetch = original; }
});

test("strict response contract rejects identity, unsafe numbers and invented coverage", async () => {
  const report = await buildKfhReport(db, now);
  for (const change of [r => r.visitors = 1, r => r.windows.today.counts.resource_calls = null, r => r.windows.today.partial = false, r => r.source.last_observed_day = "2026-09-04", r => r.limitations.coverage = "full", r => r.site_key = "tgc_site", r => r.windows.today.counts.page_views = Number.MAX_SAFE_INTEGER + 1]) {
    const changed = structuredClone(report); change(changed); assert.equal(isKfhReport(changed), false);
  }
  assert.equal(KFH_COUNT_KEYS.length, 6);
});
