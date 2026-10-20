import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import initSqlJs from "sql.js";
import workerModule, { parseCanonicalEventPayload, resolveReportRequest } from "../dist/index.js";
import { KFH_INGEST_ORIGINS, parseKfhEvent, parseKfhSignal, parseKfhFeedback, ingestKfhEvent, buildKfhReport, pruneKfhData } from "../dist/kfhAnalytics.js";
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
  for (const name of ["0008_add_site_event_rate_limit.sql", "0016_add_kfh_daily.sql", "0017_add_kfh_outreach_attribution.sql", "0018_add_kfh_signal_daily.sql", "0020_add_kfh_feedback_daily.sql"]) {
    await db.exec(fs.readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  }
});
after(() => { sqlite?.close(); });
beforeEach(async () => { await db.exec("DELETE FROM kfh_daily; DELETE FROM kfh_outreach_daily; DELETE FROM kfh_signal_daily; DELETE FROM kfh_feedback_daily; DELETE FROM site_event_rate_limit;"); });

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

test("Kingston CORS accepts the migrated and legacy origins without admitting siblings or credentials", async () => {
  const origins = ["https://kingston.food-help.ca", "https://kingstonfoodhelp.ca", "https://www.kingstonfoodhelp.ca"];
  assert.deepEqual([...KFH_INGEST_ORIGINS].sort(), [...origins].sort());
  const databaseMustNotBeUsed = { prepare() { throw new Error("preflight must not access storage"); } };
  for (const origin of [...origins, "https://food-help.ca", "https://www.kingston.food-help.ca", "http://kingston.food-help.ca", "https://kingston.food-help.ca.evil.example", "https://other.food-help.ca", "https://preview.pages.dev"]) {
    const response = await worker.fetch(new Request("https://lighthouse.test/metrics/event", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } }), { DB: databaseMustNotBeUsed }, { waitUntil() { throw new Error("preflight must not schedule work"); } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origins.includes(origin) ? origin : null);
    assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
    if (origins.includes(origin)) assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type");
    else await ingestKfhEvent(payload(), db, origin, async () => { throw new Error("unregistered origin reached rate gate"); }, now);
  }
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM kfh_daily").first()).n, 0);
});

test("migrated origin routes all six v3 events into aggregate storage and the existing strict report", async () => {
  const origin = "https://kingston.food-help.ca";
  const common = { site_key: KFH_SITE_KEY, contract_version: 3, collection_mode: "opt_out", page: "directory" };
  for (const event of [
    { event_name: "page_view" },
    { event_name: "contact_click", event_value: "resource_call" },
    { event_name: "contact_click", event_value: "help_211" },
    { event_name: "outbound_click", event_value: "directions" },
    { event_name: "outbound_click", event_value: "official_source" },
    { event_name: "pwa_install" },
  ]) {
    const attribution = event.event_name === "pwa_install" ? {} : { source: "reddit", campaign: "outreach_2026_09", content: "post_02" };
    const response = await submit({ ...common, ...event, ...attribution }, { headers: { Origin: origin, "Content-Type": "text/plain;charset=UTF-8" } });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
  }
  const report = await buildKfhReport(db, new Date());
  assert.ok(isKfhReport(report));
  assert.deepEqual(report.windows.today.counts, Object.fromEntries(KFH_COUNT_KEYS.map(key => [key, 1])));
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM kfh_outreach_daily").first()).n, 15);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='site_events_raw'").first()).n, 0);
});

test("migrated-origin privacy-suppressed verification never reads or schedules database work", async () => {
  for (const privacy of [{ "Sec-GPC": "1" }, { DNT: "1" }]) {
    let databaseReads = 0, scheduled = 0;
    const response = await worker.fetch(new Request("https://lighthouse.test/metrics/event", { method: "POST", headers: { Origin: "https://kingston.food-help.ca", ...privacy }, body: JSON.stringify({ site_key: KFH_SITE_KEY, contract_version: 3, collection_mode: "opt_out", page: "directory", event_name: "page_view", source: "direct_unknown", campaign: "none", content: "none" }) }), { get DB() { databaseReads++; throw new Error("privacy suppression must precede DB access"); } }, { waitUntil() { scheduled++; } });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://kingston.food-help.ca");
    assert.equal(databaseReads, 0);
    assert.equal(scheduled, 0);
  }
});

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

test("v2 default-on contract is explicit, isolated and persists the same bounded aggregates", async () => {
  const current = {site_key: KFH_SITE_KEY, contract_version: 2, collection_mode: "opt_out", page: "directory", event_name: "page_view"};
  assert.deepEqual(parseKfhEvent(current), parseKfhEvent(payload()));
  for (const extra of [{consent:true}, {consent:false}, {collection_mode:"opt_in"}, {collection_mode:undefined}, {contract_version:4}, {resource_id:"private"}, {search:"private"}]) assert.equal(parseKfhEvent({...current,...extra}), null);
  assert.equal(parseKfhEvent({...payload(),collection_mode:"opt_out"}), null);
  await ingestKfhEvent(current, db, KFH_ORIGINS[0], async () => true, now);
  const rows = await db.prepare("SELECT metric,value,count FROM kfh_daily ORDER BY metric").all();
  assert.equal(rows.results.length,4); assert.ok(rows.results.every(row => row.count === 1));
  const report = await buildKfhReport(db,now);
  assert.equal(report.report_contract_version,"1.4");
  assert.equal(report.limitations.counts_are,"observed_activity_not_people_or_service_outcomes");
});

test("KFH report legacy compatibility cannot mislabel current default-on counts", () => {
  const legacy=JSON.parse(fs.readFileSync(new URL("../contracts/kfh-v1/legacy-empty.json",import.meta.url),"utf8"));
  assert.equal(isKfhReport(legacy),true);
  assert.equal(isKfhReport({...legacy,report_contract_version:"1.1"}),false);
  assert.equal(isKfhReport({...legacy,report_contract_version:1.0}),false);
});

const v3 = (overrides = {}) => ({ site_key: KFH_SITE_KEY, contract_version: 3, collection_mode: "opt_out", page: "directory", event_name: "page_view", source: "reddit", campaign: "outreach_2026_09", content: "post_02", ...overrides });
test("v3 accepts only fixed outreach labels and broad events, preserving v1/v2 rejection", () => {
  for (const event of [{}, { event_name: "contact_click", event_value: "resource_call" }, { event_name: "contact_click", event_value: "help_211" }, { event_name: "outbound_click", event_value: "directions" }, { event_name: "outbound_click", event_value: "official_source" }]) assert.equal(parseKfhEvent(v3(event)).outreach, true);
  for (const change of [{ source: undefined }, { campaign: undefined }, { content: undefined }, { source: "private-person" }, { consent: true }, { session_id: "private" }, { resource_id: "private" }, { search: "private" }, { referrer: "private" }, { event_value: "extra" }, { event_name: "pwa_install" }, { event_name: "outbound_click", event_value: "resource_call" }, { contract_version: 2 }]) assert.equal(parseKfhEvent(v3(change)), null, JSON.stringify(change));
  const { source, campaign, content, ...install } = v3({ event_name: "pwa_install" });
  assert.deepEqual(parseKfhEvent(install), { counter: "pwa_installs" });
  assert.equal(parseKfhEvent({ ...install, event_value: "device" }), null);
});

test("v3 persists atomic independent margins; legacy totals remain readable on rollback", async () => {
  const accept = body => ingestKfhEvent(body, db, KFH_ORIGINS[0], async () => true, new Date("2026-09-03T12:00:00Z"));
  await accept(payload({ source: "facebook", campaign: "launch_2026_09", content: "post_01" }));
  await accept(v3()); await accept(v3());
  await accept(v3({ event_name: "outbound_click", event_value: "directions" }));
  await accept(payload({ event_name: "contact_click", event_value: "resource_call" }));
  const report = await buildKfhReport(db, now);
  assert.equal(isKfhReport(report), true);
  assert.deepEqual(report.discovery_last_7_complete_days.sources, [{ value: "reddit", count: 2 }, { value: "facebook", count: 1 }]);
  const outreach = report.outreach_last_7_complete_days;
  assert.equal(outreach.classified.page_views, 2); assert.equal(outreach.unclassified.page_views, 1);
  assert.equal(outreach.classified.directions, 1); assert.equal(outreach.unclassified.resource_calls, 1);
  assert.ok(outreach.sources.every(row => row.value === "reddit"));
  assert.equal((await db.prepare("SELECT count FROM kfh_daily WHERE metric='source' AND value='other'").first()).count, 2);
  assert.equal((await db.prepare("SELECT count FROM kfh_daily WHERE metric='campaign' AND value='none'").first()).count, 2);
  const rows = (await db.prepare("SELECT * FROM kfh_outreach_daily").all()).results;
  assert.equal(rows.length, 6);
  assert.ok(rows.every(row => Object.keys(row).sort().join(',') === 'count,day,dimension,event,value'));
  assert.deepEqual(report, JSON.parse(fs.readFileSync(new URL('../contracts/kfh-v1/feedback-sample.json', import.meta.url), 'utf8')));
  await db.exec(fs.readFileSync(new URL('../migrations/0017_add_kfh_outreach_attribution.sql', import.meta.url), 'utf8'));
  assert.deepEqual(await buildKfhReport(db, now), report);
});

test("failure in new attribution rolls back both tables, while missing migration reports unavailable", async () => {
  await db.exec("CREATE TRIGGER fixture_reject_outreach BEFORE INSERT ON kfh_outreach_daily WHEN NEW.dimension='content' BEGIN SELECT RAISE(ABORT, 'fixture'); END;");
  try {
    await assert.rejects(ingestKfhEvent(v3(), db, KFH_ORIGINS[0], async () => true, now));
    for (const table of ['kfh_daily', 'kfh_outreach_daily']) assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n, 0);
  } finally { await db.exec('DROP TRIGGER fixture_reject_outreach'); }
  const noMigration = { prepare(sql) { if (sql.includes('kfh_outreach_daily')) throw new Error('missing table'); return db.prepare(sql); } };
  const report = await buildKfhReport(noMigration, now);
  assert.equal(report.source.reason, 'query_failed'); assert.equal(report.outreach_last_7_complete_days, null);
  assert.deepEqual(report, JSON.parse(fs.readFileSync(new URL('../contracts/kfh-v1/feedback-unavailable.json', import.meta.url), 'utf8')));
});

test("v3 UTC windows, retention and inconsistent margins fail honestly", async () => {
  const accept = (date) => ingestKfhEvent(v3(), db, KFH_ORIGINS[0], async () => true, date);
  const empty = await buildKfhReport(db, now);
  assert.deepEqual(empty, JSON.parse(fs.readFileSync(new URL('../contracts/kfh-v1/feedback-empty.json', import.meta.url), 'utf8')));
  for (const offset of [-400, -399, -8, -7, -1, 0]) await accept(new Date(now.getTime() + offset * 86400000));
  const report = await buildKfhReport(db, now);
  assert.equal(report.outreach_last_7_complete_days.classified.page_views, 2);
  assert.deepEqual(Object.values(report.windows).map(w => w.counts.page_views), [1, 1, 2, 1, 3]);
  await pruneKfhData(db, now);
  for (const table of ['kfh_daily', 'kfh_outreach_daily']) assert.equal((await db.prepare(`SELECT COUNT(DISTINCT day) AS n FROM ${table}`).first()).n, 5);
  for (const mutate of [r => r.outreach_last_7_complete_days.classified.page_views++, r => r.outreach_last_7_complete_days.sources[0].count++, r => r.outreach_last_7_complete_days.sources[0].resource_id='private', r => r.outreach_last_7_complete_days.sources[0].event='pwa_installs', r => r.outreach_last_7_complete_days.sources.push(r.outreach_last_7_complete_days.sources[0]), r => r.outreach_last_7_complete_days.sources[0].value='facebook', r => r.report_contract_version='1.1', r => r.report_contract_version='1.2', r => r.report_contract_version='1.3', r => delete r.product_signals, r => delete r.help_feedback]) {
    const changed = structuredClone(report); mutate(changed); assert.equal(isKfhReport(changed), false);
  }
  await db.exec("DELETE FROM kfh_outreach_daily WHERE dimension='content' AND day='2026-09-03'");
  assert.equal((await buildKfhReport(db, now)).source.reason, 'query_failed');
});

const signal = (overrides = {}) => ({ site_key: KFH_SITE_KEY, contract_version: 3, collection_mode: "opt_out", page: "directory", event_name: "resource_open", ...overrides });

test("v3 product signals are exact, unattributed and never alter the six core events", () => {
  assert.equal(parseKfhSignal(signal()), "resource_opens");
  assert.equal(parseKfhSignal(signal({ event_name: "install_prompt", event_value: "show" })), "install_prompt_shows");
  assert.equal(parseKfhSignal(signal({ event_name: "install_prompt", event_value: "dismiss" })), "install_prompt_dismissals");
  for (const change of [{ source: "reddit" }, { campaign: "none" }, { content: "none" }, { visit: "0123456789abcdef" }, { event_value: "resource_open" },
    { event_name: "engagement", event_value: "resource_open" }, { event_name: "install_prompt" }, { event_name: "install_prompt", event_value: "accept" },
    { event_name: "install_prompt", event_value: "show", visit: "x" }, { resource_id: "private" }, { contract_version: 2 }, { contract_version: 4 },
    { collection_mode: undefined, consent: true }, { page: "home" }, { site_key: "tgc_site" }]) assert.equal(parseKfhSignal(signal(change)), null, JSON.stringify(change));
  for (const body of [signal(), signal({ event_name: "install_prompt", event_value: "show" })]) assert.equal(parseKfhEvent(body), null);
  for (const event of [v3(), v3({ event_name: "outbound_click", event_value: "directions" })]) assert.equal(parseKfhSignal(event), null);
});

test("signals persist in their own table and a missing 0018 never affects core counts or retention", async () => {
  const at = new Date("2026-09-03T12:00:00Z");
  const accept = (body, target = db) => ingestKfhEvent(body, target, KFH_ORIGINS[0], async () => true, at);
  await accept(payload({ source: "facebook", campaign: "launch_2026_09", content: "post_01" }));
  await accept(v3()); await accept(v3());
  await accept(v3({ event_name: "outbound_click", event_value: "directions" }));
  await accept(payload({ event_name: "contact_click", event_value: "resource_call" }));
  for (const body of [signal(), signal(), signal({ event_name: "install_prompt", event_value: "show" }), signal({ event_name: "install_prompt", event_value: "dismiss" })]) await accept(body);
  await ingestKfhEvent(signal(), db, "https://brockville.food-help.ca", async () => true, at);
  await ingestKfhEvent(signal(), db, KFH_ORIGINS[0], async () => false, at);
  assert.deepEqual((await db.prepare("SELECT signal, count FROM kfh_signal_daily ORDER BY signal").all()).results,
    [{ signal: "install_prompt_dismissals", count: 1 }, { signal: "install_prompt_shows", count: 1 }, { signal: "resource_opens", count: 2 }]);
  const report = await buildKfhReport(db, now);
  assert.equal(isKfhReport(report), true);
  assert.deepEqual(report.product_signals.windows.last_7_complete_days, { resource_opens: 2, install_prompt_shows: 1, install_prompt_dismissals: 1 });
  assert.deepEqual(report.product_signals.windows.today, { resource_opens: 0, install_prompt_shows: 0, install_prompt_dismissals: 0 });
  assert.deepEqual(report, JSON.parse(fs.readFileSync(new URL('../contracts/kfh-v1/feedback-observed.json', import.meta.url), 'utf8')));
  // Core rows are exactly what the earlier v3 test stores; signals touched nothing else.
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM kfh_outreach_daily").first()).n, 6);
  const { product_signals, help_feedback, ...core } = report;
  const { product_signals: _ignored, help_feedback: _none, ...expected } = JSON.parse(fs.readFileSync(new URL('../contracts/kfh-v1/feedback-sample.json', import.meta.url), 'utf8'));
  assert.deepEqual(core, expected);

  const noSignals = { prepare(sql) { if (sql.includes('kfh_signal_daily')) throw new Error('missing table'); return db.prepare(sql); }, batch: statements => db.batch(statements) };
  await accept(signal(), noSignals).catch(() => {});
  const withoutTable = await buildKfhReport(noSignals, now);
  assert.equal(isKfhReport(withoutTable), true);
  assert.deepEqual(withoutTable.product_signals, { availability: "unavailable", windows: null });
  // Answers report listing opens beside them, so they are unavailable together.
  assert.deepEqual(withoutTable.help_feedback, { availability: "unavailable", months: null });
  assert.deepEqual({ ...withoutTable, product_signals: null, help_feedback: null }, { ...report, product_signals: null, help_feedback: null });
  await pruneKfhData(noSignals, now);
  await db.exec("DROP TABLE kfh_signal_daily");
  try {
    await accept(v3());
    assert.equal((await buildKfhReport(db, now)).windows.last_7_complete_days.counts.page_views, 4);
  } finally { await db.exec(fs.readFileSync(new URL('../migrations/0018_add_kfh_signal_daily.sql', import.meta.url), 'utf8')); }
});

test("signal report windows, retention and validation fail closed per section", async () => {
  for (const offset of [-400, -399, -8, -7, -1, 0]) await ingestKfhEvent(signal(), db, KFH_ORIGINS[0], async () => true, new Date(now.getTime() + offset * 86400000));
  await ingestKfhEvent(v3(), db, KFH_ORIGINS[0], async () => true, new Date(now.getTime() - 86400000));
  const report = await buildKfhReport(db, now);
  assert.deepEqual(Object.values(report.product_signals.windows).map(w => w.resource_opens), [1, 1, 2, 1, 3]);
  await pruneKfhData(db, now);
  assert.equal((await db.prepare("SELECT COUNT(DISTINCT day) AS n FROM kfh_signal_daily").first()).n, 5);
  for (const mutate of [r => r.product_signals.windows.today.resource_opens = -1, r => r.product_signals.windows.today.visit = 1,
    r => r.product_signals.windows.latest_complete_day.resource_opens = 99, r => r.product_signals.availability = "partial",
    r => r.product_signals.windows = null, r => { r.product_signals.availability = "unavailable"; },
    r => r.product_signals.windows.today.install_prompt_shows = "1", r => r.product_signals.sources = []]) {
    const changed = structuredClone(report); mutate(changed); assert.equal(isKfhReport(changed), false);
  }
  const unavailable = JSON.parse(fs.readFileSync(new URL('../contracts/kfh-v1/signals-unavailable.json', import.meta.url), 'utf8'));
  assert.equal(isKfhReport({ ...unavailable, product_signals: report.product_signals }), false);
  for (const name of ['outreach-sample', 'outreach-empty', 'outreach-unavailable', 'sample', 'legacy-empty', 'signals-sample', 'signals-empty', 'signals-unavailable', 'signals-observed', 'feedback-sample', 'feedback-empty', 'feedback-unavailable', 'feedback-observed']) {
    assert.equal(isKfhReport(JSON.parse(fs.readFileSync(new URL(`../contracts/kfh-v1/${name}.json`, import.meta.url), 'utf8'))), true, name);
  }
});

test("migrated origin delivers a product signal through the public route into its own table", async () => {
  const response = await submit(signal({ event_name: "install_prompt", event_value: "show" }), { headers: { Origin: "https://kingston.food-help.ca", "Content-Type": "text/plain;charset=UTF-8" } });
  assert.equal(response.status, 204);
  assert.deepEqual((await db.prepare("SELECT signal, count FROM kfh_signal_daily").all()).results, [{ signal: "install_prompt_shows", count: 1 }]);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM kfh_daily").first()).n, 0);
});

// The two exact bodies the Kingston site sends for "Did this help you find food?".
const YES_BODY = '{"site_key":"kingston_food_help","contract_version":3,"collection_mode":"opt_out","page":"directory","event_name":"help_feedback","event_value":"yes"}';
const NOT_BODY = '{"site_key":"kingston_food_help","contract_version":3,"collection_mode":"opt_out","page":"directory","event_name":"help_feedback","event_value":"not_this_time"}';
const answer = (overrides = {}) => ({ ...JSON.parse(YES_BODY), ...overrides });

test("help_feedback accepts exactly the two site bodies and nothing else", () => {
  assert.equal(parseKfhFeedback(JSON.parse(YES_BODY)), "yes");
  assert.equal(parseKfhFeedback(JSON.parse(NOT_BODY)), "not_this_time");
  for (const change of [{ event_value: "maybe" }, { event_value: "Yes" }, { event_value: undefined }, { resource_id: "private" }, { visit: "0123456789abcdef" },
    { source: "facebook" }, { campaign: "outreach_2026_09" }, { content: "post_02" }, { source: "facebook", campaign: "none", content: "none" },
    { contract_version: 2 }, { collection_mode: undefined, consent: true }, { page: "home" }, { site_key: "brockville_food_help" }, { site_key: "tgc_site" }]) {
    const body = answer(change); for (const key of Object.keys(body)) if (body[key] === undefined) delete body[key];
    assert.equal(parseKfhFeedback(body), null, JSON.stringify(change));
  }
  // Answers never become core events or product signals.
  for (const body of [YES_BODY, NOT_BODY]) { assert.equal(parseKfhEvent(JSON.parse(body)), null); assert.equal(parseKfhSignal(JSON.parse(body)), null); }
});

test("answers are stored as daily totals and reported as UTC calendar months beside listing opens", async () => {
  const at = iso => new Date(`${iso}T12:00:00Z`);
  const accept = (body, date, origin = KFH_ORIGINS[0]) => ingestKfhEvent(JSON.parse(body), db, origin, async () => true, at(date));
  for (const [body, date] of [[YES_BODY, "2026-07-31"], [YES_BODY, "2026-08-01"], [YES_BODY, "2026-08-31"], [NOT_BODY, "2026-08-15"],
    [YES_BODY, "2026-09-01"], [YES_BODY, "2026-09-04"], [NOT_BODY, "2026-09-04"]]) await accept(body, date);
  for (const date of ["2026-08-02", "2026-09-02", "2026-09-03"]) await ingestKfhEvent(signal(), db, KFH_ORIGINS[0], async () => true, at(date));
  await accept(YES_BODY, "2026-09-04", "https://brockville.food-help.ca");
  await ingestKfhEvent(JSON.parse(YES_BODY), db, KFH_ORIGINS[0], async () => false, at("2026-09-04"));
  const rows = (await db.prepare("SELECT * FROM kfh_feedback_daily ORDER BY day, answer").all()).results;
  assert.ok(rows.every(row => Object.keys(row).sort().join(",") === "answer,count,day"));
  assert.deepEqual(rows.filter(row => row.day === "2026-09-04"), [{ day: "2026-09-04", answer: "not_this_time", count: 1 }, { day: "2026-09-04", answer: "yes", count: 1 }]);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM kfh_daily").first()).n, 0);
  const report = await buildKfhReport(db, now);
  assert.equal(isKfhReport(report), true);
  assert.deepEqual(report.help_feedback, { availability: "available", months: {
    previous_month: { month: "2026-08", start_day: "2026-08-01", end_day: "2026-08-31", partial: false, counts: { yes: 2, not_this_time: 1, resource_opens: 1 } },
    current_month: { month: "2026-09", start_day: "2026-09-01", end_day: "2026-09-04", partial: true, counts: { yes: 2, not_this_time: 1, resource_opens: 2 } },
  } });
  // January reaches back into the previous year.
  const january = await buildKfhReport(db, new Date("2027-01-10T00:00:00Z"));
  assert.equal(january.help_feedback.months.previous_month.month, "2026-12");
  assert.equal(january.help_feedback.months.previous_month.end_day, "2026-12-31");
  for (const mutate of [r => r.help_feedback.months.current_month.counts.yes = -1, r => r.help_feedback.months.current_month.counts.resource_id = 1,
    r => r.help_feedback.months.previous_month.month = "2026-07", r => r.help_feedback.months.current_month.partial = false,
    r => r.help_feedback.months.current_month.end_day = "2026-09-03", r => r.help_feedback.availability = "partial",
    r => { r.help_feedback.availability = "unavailable"; }, r => r.help_feedback.months.listings = [], r => r.help_feedback.months.current_month.counts.yes = "2"]) {
    const changed = structuredClone(report); mutate(changed); assert.equal(isKfhReport(changed), false);
  }
});

test("a missing 0020 or bad answer row never affects core counts, signals or retention", async () => {
  const at = new Date("2026-09-03T12:00:00Z");
  await ingestKfhEvent(v3(), db, KFH_ORIGINS[0], async () => true, at);
  await ingestKfhEvent(signal(), db, KFH_ORIGINS[0], async () => true, at);
  const noFeedback = { prepare(sql) { if (sql.includes('kfh_feedback_daily')) throw new Error('missing table'); return db.prepare(sql); }, batch: statements => db.batch(statements) };
  await ingestKfhEvent(JSON.parse(YES_BODY), noFeedback, KFH_ORIGINS[0], async () => true, at).catch(() => {});
  await pruneKfhData(noFeedback, now);
  const report = await buildKfhReport(noFeedback, now);
  assert.equal(isKfhReport(report), true);
  assert.deepEqual(report.help_feedback, { availability: "unavailable", months: null });
  assert.equal(report.product_signals.availability, "available");
  assert.equal(report.windows.last_7_complete_days.counts.page_views, 1);
  const corrupt = { prepare(sql) { const statement = db.prepare(sql); if (!sql.includes('kfh_feedback_daily')) return statement;
    return { bind: () => ({ all: async () => ({ success: true, results: [{ day: '2026-09-03', answer: 'maybe', count: 1 }] }) }) }; } };
  const bad = await buildKfhReport(corrupt, now);
  assert.equal(isKfhReport(bad), true);
  assert.deepEqual(bad.help_feedback, { availability: "unavailable", months: null });
  assert.equal(bad.product_signals.availability, "available");
});

test("answer retention matches the other Kingston daily totals", async () => {
  for (const offset of [-400, -399, 0]) await ingestKfhEvent(JSON.parse(NOT_BODY), db, KFH_ORIGINS[0], async () => true, new Date(now.getTime() + offset * 86400000));
  await pruneKfhData(db, now);
  assert.equal((await db.prepare("SELECT COUNT(DISTINCT day) AS n FROM kfh_feedback_daily").first()).n, 2);
});

test("both exact answers travel the public route from the Kingston origin like existing events", async () => {
  const origin = "https://kingston.food-help.ca";
  const preflight = await worker.fetch(new Request("https://lighthouse.test/metrics/event", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } }), { DB: db }, { waitUntil() {} });
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), origin);
  for (const body of [YES_BODY, NOT_BODY, answer({ event_value: "maybe" }), answer({ visit: "x" })]) {
    const response = await submit(typeof body === "string" ? JSON.parse(body) : body, { headers: { Origin: origin, "Content-Type": "text/plain;charset=UTF-8" } });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
  }
  assert.deepEqual((await db.prepare("SELECT answer, count FROM kfh_feedback_daily ORDER BY answer").all()).results, [{ answer: "not_this_time", count: 1 }, { answer: "yes", count: 1 }]);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM kfh_daily").first()).n, 0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM kfh_signal_daily").first()).n, 0);
});
