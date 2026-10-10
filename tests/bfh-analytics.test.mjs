import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import initSqlJs from "sql.js";
import workerModule, { parseCanonicalEventPayload, resolveReportRequest } from "../dist/index.js";
import { BROCKVILLE_PROFILE, BROCKVILLE_INGEST_ORIGINS, parseKfhEvent, parseKfhSignal, ingestKfhEvent, buildKfhReport, pruneKfhData } from "../dist/kfhAnalytics.js";
import { isKfhReport, KFH_SITE_KEY, BFH_SITE_KEY, KFH_COUNT_KEYS } from "../dist/kfhContract.js";

// Brockville runs Kingston's v3 collector under its own key, origin, tables and view.
const worker = workerModule.fetch ? workerModule : workerModule.default;
const origin = "https://brockville.food-help.ca";
const now = new Date("2026-10-20T12:00:00.000Z");
const fixture = name => JSON.parse(fs.readFileSync(new URL(`../contracts/bfh-v1/${name}.json`, import.meta.url), "utf8"));
const v3 = (overrides = {}) => ({ site_key: BFH_SITE_KEY, contract_version: 3, collection_mode: "opt_out", page: "directory", event_name: "page_view", source: "reddit", campaign: "outreach_2026_09", content: "post_02", ...overrides });
const accept = (body, at = now, from = origin, allow = async () => true) => ingestKfhEvent(body, db, from, allow, at, BROCKVILLE_PROFILE);
const build = at => buildKfhReport(db, at, BROCKVILLE_PROFILE);

// SQLite WASM executes the checked-in SQL; this is not Cloudflare's native D1.
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
  for (const name of ["0008_add_site_event_rate_limit.sql", "0016_add_kfh_daily.sql", "0017_add_kfh_outreach_attribution.sql", "0018_add_kfh_signal_daily.sql", "0019_add_bfh_daily.sql"]) {
    await db.exec(fs.readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  }
});
after(() => { sqlite?.close(); });
beforeEach(async () => { await db.exec("DELETE FROM kfh_daily; DELETE FROM kfh_outreach_daily; DELETE FROM kfh_signal_daily; DELETE FROM bfh_daily; DELETE FROM bfh_outreach_daily; DELETE FROM site_event_rate_limit;"); });

async function submit(body, headers = {}, env = {}) {
  const pending = [];
  const request = new Request("https://lighthouse.test/metrics/event", { method: "POST", headers: { Origin: origin, "CF-Connecting-IP": "192.0.2.5", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const response = await worker.fetch(request, { DB: db, TELEMETRY_RATE_LIMIT_SECRET: "local-test-rate-secret", ...env }, { waitUntil(p) { pending.push(p); } });
  await Promise.all(pending);
  return response;
}

test("Brockville accepts exactly Kingston's v3 events and nothing older or extra", () => {
  for (const event of [{}, { event_name: "contact_click", event_value: "resource_call" }, { event_name: "contact_click", event_value: "help_211" }, { event_name: "outbound_click", event_value: "directions" }, { event_name: "outbound_click", event_value: "official_source" }]) {
    assert.equal(parseKfhEvent(v3(event), BROCKVILLE_PROFILE).outreach, true);
  }
  const { source, campaign, content, ...install } = v3({ event_name: "pwa_install" });
  assert.deepEqual(parseKfhEvent(install, BROCKVILLE_PROFILE), { counter: "pwa_installs" });
  for (const change of [{ contract_version: 1, consent: true, collection_mode: undefined }, { contract_version: 2 }, { site_key: KFH_SITE_KEY }, { source: undefined }, { source: "private-person" },
    { visit: "0123456789abcdef" }, { session_id: "private" }, { consent: true }, { event_name: "resource_open" }, { event_name: "engagement", event_value: "resource_open" }]) {
    assert.equal(parseKfhEvent(v3(change), BROCKVILLE_PROFILE), null, JSON.stringify(change));
  }
  assert.equal(parseKfhEvent(v3()), null); // Kingston's parser rejects Brockville's key.
  assert.equal(parseKfhSignal(v3({ event_name: "install_prompt", event_value: "show", source: undefined, campaign: undefined, content: undefined })), null);
  assert.equal(parseCanonicalEventPayload({ ...v3(), client_ts: now.toISOString(), path: "/" }), null);
  assert.deepEqual(resolveReportRequest(new URL("https://lighthouse.test/report?view=bfh")), { ok: true, view: "bfh" });
  for (const query of [`?view=site&site_key=${BFH_SITE_KEY}`, `?site_key=${BFH_SITE_KEY}`]) assert.equal(resolveReportRequest(new URL(`https://lighthouse.test/report${query}`)).error, "invalid_site_key");
});

test("only the Brockville origin writes, only to Brockville tables, and signals are not collected", async () => {
  for (const from of [null, "https://evil.example", "http://brockville.food-help.ca", "https://brockville.food-help.ca.evil.example", "https://food-help.ca", "https://kingston.food-help.ca", "https://www.brockville.food-help.ca", "https://food-help-brockville.pages.dev"]) {
    await accept(v3(), now, from, async () => { throw new Error("must not call rate gate"); });
  }
  await accept(v3({ site_key: KFH_SITE_KEY }));
  await accept(v3({ event_name: "resource_open", source: undefined, campaign: undefined, content: undefined }));
  await accept(v3({ event_name: "install_prompt", event_value: "show", source: undefined, campaign: undefined, content: undefined }));
  await accept(v3(), now, origin, async () => false);
  for (const table of ["bfh_daily", "bfh_outreach_daily", "kfh_daily", "kfh_outreach_daily", "kfh_signal_daily"]) assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n, 0, table);
  await accept(v3()); await accept(v3({ event_name: "outbound_click", event_value: "directions" }));
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM bfh_daily").first()).n, 5);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM bfh_outreach_daily").first()).n, 6);
  for (const table of ["kfh_daily", "kfh_outreach_daily", "kfh_signal_daily"]) assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n, 0, table);
  await assert.rejects(db.prepare("INSERT INTO bfh_daily VALUES ('2026-10-20', 'source', 'person@example.test', 1)").run());
});

test("public route: all six events, CORS without credentials, privacy and abuse bounds", async () => {
  for (const event of [{ event_name: "page_view" }, { event_name: "contact_click", event_value: "resource_call" }, { event_name: "contact_click", event_value: "help_211" }, { event_name: "outbound_click", event_value: "directions" }, { event_name: "outbound_click", event_value: "official_source" }, { event_name: "pwa_install" }]) {
    const attribution = event.event_name === "pwa_install" ? { source: undefined, campaign: undefined, content: undefined } : {};
    const response = await submit(v3({ ...event, ...attribution }), { "Content-Type": "text/plain;charset=UTF-8" });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
  }
  const report = await buildKfhReport(db, new Date(), BROCKVILLE_PROFILE);
  assert.deepEqual(report.windows.today.counts, Object.fromEntries(KFH_COUNT_KEYS.map(key => [key, 1])));
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='site_events_raw'").first()).n, 0);
  for (const privacy of [{ "Sec-GPC": "1" }, { DNT: "1" }]) {
    let reads = 0;
    const response = await worker.fetch(new Request("https://lighthouse.test/metrics/event", { method: "POST", headers: { Origin: origin, ...privacy }, body: JSON.stringify(v3()) }), { get DB() { reads++; throw new Error("no DB access"); } }, { waitUntil() { throw new Error("no work"); } });
    assert.equal(response.status, 204); assert.equal(reads, 0);
  }
  const preflight = await worker.fetch(new Request("https://lighthouse.test/metrics/event", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST" } }), { DB: { prepare() { throw new Error("no storage"); } } }, { waitUntil() { throw new Error("no work"); } });
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(preflight.headers.get("Access-Control-Allow-Credentials"), null);
  for (const body of ["{invalid", "x".repeat(1025), v3({ site_key: "buscore", anon_user_id: "fixture" })]) assert.equal((await submit(body)).status, 204);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM kfh_daily").first()).n, 0);
});

test("failed attribution writes roll back the total; a storage failure is fail-soft", async () => {
  await db.exec("CREATE TRIGGER fixture_reject BEFORE INSERT ON bfh_daily WHEN NEW.metric = 'content' BEGIN SELECT RAISE(ABORT, 'fixture'); END;");
  try {
    await assert.rejects(accept(v3()));
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM bfh_daily").first()).n, 0);
  } finally { await db.exec("DROP TRIGGER fixture_reject;"); }
  const warnings = []; const original = console.warn; console.warn = (...args) => warnings.push(args);
  try {
    const response = await submit(v3(), {}, { DB: { prepare() { throw new Error("sensitive-fixture"); } } });
    assert.equal(response.status, 204); assert.equal(await response.text(), "");
    assert.deepEqual(warnings, [["KFH ingest unavailable; submission dropped."]]);
  } finally { console.warn = original; }
});

test("report 1.2 matches the pinned fixtures, is Brockville-only and fails closed", async () => {
  const empty = await build(now);
  assert.deepEqual(empty, fixture("empty"));
  assert.equal(empty.source.reason, "no_observed_history");
  for (const [offset, body] of [[-8, v3()], [-2, v3()], [-1, v3({ event_name: "contact_click", event_value: "resource_call" })], [-1, v3({ event_name: "outbound_click", event_value: "directions", source: "facebook", campaign: "launch_2026_09", content: "poster_01" })], [0, v3({ source: "search", campaign: "none", content: "none" })]]) {
    await accept(body, new Date(now.getTime() + offset * 86400000));
  }
  const report = await build(now);
  assert.deepEqual(report, fixture("sample"));
  assert.deepEqual(Object.values(report.windows).map(w => w.counts.page_views), [1, 0, 1, 1, 2]);
  assert.equal(report.report_contract_version, "1.2");
  assert.equal(report.site_key, BFH_SITE_KEY);
  assert.equal("product_signals" in report, false);
  assert.equal(isKfhReport(report, BFH_SITE_KEY), true);
  assert.equal(isKfhReport(report), false); // /kfh must reject a Brockville report.
  assert.equal(isKfhReport({ ...report, site_key: KFH_SITE_KEY }, BFH_SITE_KEY), false);
  for (const version of ["1.0", "1.1", "1.3"]) assert.equal(isKfhReport({ ...report, report_contract_version: version }, BFH_SITE_KEY), false, version);
  const unavailable = await buildKfhReport({ prepare() { throw new Error("fixture failure"); } }, now, BROCKVILLE_PROFILE);
  assert.deepEqual(unavailable, fixture("unavailable"));
  assert.equal(isKfhReport(unavailable, BFH_SITE_KEY), true);
  for (const name of ["empty", "sample", "unavailable"]) {
    assert.equal(isKfhReport(fixture(name), BFH_SITE_KEY), true, name);
    assert.equal(isKfhReport(fixture(name)), false, name);
  }
  await db.exec("DELETE FROM bfh_outreach_daily WHERE dimension='content' AND day='2026-10-19'");
  assert.equal((await build(now)).source.reason, "query_failed");
});

test("view=bfh needs authentication, skips traffic refresh and is no-store", async () => {
  const env = { DB: db, ADMIN_TOKEN: "local-admin", REPORT_READ_TOKEN: "r".repeat(32) };
  const ctx = { waitUntil() { throw new Error("no deferred writes"); } };
  assert.equal((await worker.fetch(new Request("https://lighthouse.test/report?view=bfh"), env, ctx)).status, 401);
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("no external traffic refresh"); };
  try {
    const response = await worker.fetch(new Request("https://lighthouse.test/report?view=bfh", { headers: { "X-Report-Token": env.REPORT_READ_TOKEN } }), env, ctx);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const body = await response.json();
    assert.equal(isKfhReport(body, BFH_SITE_KEY), true);
    assert.equal(body.site_key, BFH_SITE_KEY);
  } finally { globalThis.fetch = original; }
});

test("retention bounds Brockville storage and reporting independently of Kingston", async () => {
  const inside = new Date(now.getTime() - 399 * 86400000), outside = new Date(now.getTime() - 400 * 86400000);
  for (const date of [inside, outside]) await accept(v3(), date);
  await ingestKfhEvent({ ...v3(), site_key: KFH_SITE_KEY }, db, "https://kingston.food-help.ca", async () => true, outside);
  assert.equal((await build(now)).source.first_observed_day, inside.toISOString().slice(0, 10));
  await pruneKfhData(db, now, BROCKVILLE_PROFILE);
  for (const table of ["bfh_daily", "bfh_outreach_daily"]) assert.equal((await db.prepare(`SELECT COUNT(DISTINCT day) AS n FROM ${table}`).first()).n, 1, table);
  assert.equal((await db.prepare("SELECT COUNT(DISTINCT day) AS n FROM kfh_daily").first()).n, 1);
  assert.deepEqual([...BROCKVILLE_INGEST_ORIGINS], [origin]);
});
