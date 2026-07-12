import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import * as workerModuleImport from "../dist/index.js";
import {
  BUSCORE_TELEMETRY_CONTEXT_FIELDS,
  BUSCORE_TELEMETRY_EVENT_CATEGORIES,
  BUSCORE_TELEMETRY_EVENT_NAMES,
  BUSCORE_TELEMETRY_LIMITS,
  BUSCORE_TELEMETRY_OS_CATEGORIES,
  BUSCORE_TELEMETRY_RELEASE_CHANNELS,
  BUSCORE_TELEMETRY_RETENTION,
  BUSCORE_TELEMETRY_ROOT_FIELDS,
  buildBuscoreProductTelemetryReport,
  handleBuscoreTelemetryRequest,
  hmacRateLimitKey,
  parseBuscoreTelemetryEvent,
  pruneBuscoreTelemetry,
} from "../dist/productTelemetry.js";

const validEvent = (overrides = {}) => ({
  schema_version: "1.0",
  event_id: "11111111-1111-4111-8111-111111111111",
  event_name: "inventory_opened",
  installation_id: "22222222-2222-4222-8222-222222222222",
  client_ts: "2026-07-10T12:00:00.000Z",
  context: {
    app_version: "1.3.2",
    release_channel: "stable",
    os_category: "windows",
  },
  ...overrides,
});

test("production-like fixture is accepted without extra fields", () => {
  const fixture = JSON.parse(fs.readFileSync(
    new URL("../contracts/fixtures/buscore-product-telemetry-v1.event.json", import.meta.url),
    "utf8",
  ));
  const parsed = parseBuscoreTelemetryEvent(fixture);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.ok && parsed.category, "module_use");
});

const workerModule = workerModuleImport.default?.fetch
  ? workerModuleImport.default
  : workerModuleImport.default?.default ?? workerModuleImport.default ?? workerModuleImport;

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async run() {
    if (this.sql.startsWith("INSERT INTO buscore_telemetry_rate_limit")) {
      if (this.db.failRate) throw new Error("rate unavailable");
      const key = `${this.args[0]}:${this.args[1]}`;
      this.db.rate.set(key, (this.db.rate.get(key) ?? 0) + 1);
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("INSERT OR IGNORE INTO buscore_product_events_raw")) {
      if (this.db.failRaw) throw new Error("raw unavailable");
      const [event_id, schema_version, category, event_name, installation_id, client_ts, app_version, release_channel, os_category, received_at, received_day] = this.args;
      if (this.db.events.has(event_id)) return { meta: { changes: 0 } };
      this.db.events.set(event_id, { event_id, schema_version, category, event_name, installation_id, client_ts, app_version, release_channel, os_category, received_at, received_day });
      const key = [received_day, category, event_name, app_version, release_channel, os_category].join("|");
      this.db.daily.set(key, (this.db.daily.get(key) ?? 0) + 1); // migration trigger
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("DELETE FROM")) {
      this.db.deletes.push({ sql: this.sql, cutoff: this.args[0] });
      return { meta: { changes: 0 } };
    }
    throw new Error(`unexpected run SQL: ${this.sql}`);
  }
  async first() {
    if (this.sql.startsWith("SELECT count FROM buscore_telemetry_rate_limit")) {
      return { count: this.db.rate.get(`${this.args[0]}:${this.args[1]}`) ?? 0 };
    }
    const [startDay, endDay] = this.args;
    if (this.sql.includes("COUNT(*) AS installations")) {
      const daysByInstall = new Map();
      for (const row of this.db.events.values()) {
        if (row.received_day < startDay || row.received_day > endDay) continue;
        const days = daysByInstall.get(row.installation_id) ?? new Set();
        days.add(row.received_day);
        daysByInstall.set(row.installation_id, days);
      }
      return { installations: [...daysByInstall.values()].filter((days) => days.size >= 2).length };
    }
    if (this.sql.includes("SUM(event_count)")) {
      return { events: this.db.dailyRows(startDay, endDay).reduce((sum, row) => sum + row.events, 0) };
    }
    throw new Error(`unexpected first SQL: ${this.sql}`);
  }
  async all() {
    const match = this.sql.match(/SELECT (category|event_name|app_version|release_channel|os_category) AS key/);
    if (!match) throw new Error(`unexpected all SQL: ${this.sql}`);
    const column = match[1];
    const [startDay, endDay] = this.args;
    const totals = new Map();
    for (const row of this.db.dailyRows(startDay, endDay)) totals.set(row[column], (totals.get(row[column]) ?? 0) + row.events);
    return { results: [...totals].map(([key, events]) => ({ key, events })).sort((a, b) => b.events - a.events || a.key.localeCompare(b.key)) };
  }
}

class FakeDb {
  constructor() {
    this.rate = new Map();
    this.events = new Map();
    this.daily = new Map();
    this.deletes = [];
    this.failRate = false;
    this.failRaw = false;
  }
  prepare(sql) { return new FakeStatement(this, sql); }
  dailyRows(startDay, endDay) {
    return [...this.daily].flatMap(([key, events]) => {
      const [day, category, event_name, app_version, release_channel, os_category] = key.split("|");
      return day >= startDay && day <= endDay ? [{ day, category, event_name, app_version, release_channel, os_category, events }] : [];
    });
  }
}

function requestFor(event = validEvent(), headers = {}) {
  return new Request("https://lighthouse.buscore.ca/telemetry/v1/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.10", ...headers },
    body: JSON.stringify(event),
  });
}

test("fixture and implementation expose the exact complete contract", () => {
  const fixture = JSON.parse(fs.readFileSync(new URL("../contracts/buscore-product-telemetry-v1.json", import.meta.url)));
  assert.deepEqual(fixture.common_fields.root, [...BUSCORE_TELEMETRY_ROOT_FIELDS]);
  assert.deepEqual(fixture.common_fields.context, [...BUSCORE_TELEMETRY_CONTEXT_FIELDS]);
  assert.deepEqual(fixture.event_categories, BUSCORE_TELEMETRY_EVENT_CATEGORIES);
  assert.deepEqual(fixture.event_names, [...BUSCORE_TELEMETRY_EVENT_NAMES]);
  assert.deepEqual(fixture.release_channels, [...BUSCORE_TELEMETRY_RELEASE_CHANNELS]);
  assert.deepEqual(fixture.os_categories, [...BUSCORE_TELEMETRY_OS_CATEGORIES]);
  assert.deepEqual(fixture.limits, BUSCORE_TELEMETRY_LIMITS);
  assert.deepEqual(fixture.retention_days, BUSCORE_TELEMETRY_RETENTION);
  assert.equal(new Set(fixture.event_names).size, fixture.event_names.length);
});

test("strict parser accepts every allowlisted event and derives its server category", () => {
  for (const [category, names] of Object.entries(BUSCORE_TELEMETRY_EVENT_CATEGORIES)) {
    for (const event_name of names) {
      const result = parseBuscoreTelemetryEvent(validEvent({ event_name }));
      assert.equal(result.ok, true, event_name);
      assert.equal(result.category, category, event_name);
    }
  }
});

test("strict parser rejects prohibited field families and unexpected nesting", () => {
  for (const field of ["customer_name", "supplier_name", "employee_name", "item_name", "recipe_name", "invoice_contents", "email", "file_path", "exact_financial_value", "exact_quantity", "raw_database", "machine_fingerprint", "raw_ip"]) {
    assert.deepEqual(parseBuscoreTelemetryEvent({ ...validEvent(), [field]: "prohibited" }), { ok: false, error: "unexpected_fields" });
  }
  assert.deepEqual(parseBuscoreTelemetryEvent(validEvent({ context: { ...validEvent().context, nested: {} } })), { ok: false, error: "unexpected_context_fields" });
});

test("strict parser enforces UUID shape, bounded SemVer, dimensions, and canonical UTC timestamps", () => {
  assert.equal(parseBuscoreTelemetryEvent(validEvent({ installation_id: "machine-name" })).ok, false);
  assert.equal(parseBuscoreTelemetryEvent(validEvent({ context: { ...validEvent().context, app_version: "000001.2.3" } })).ok, false);
  assert.equal(parseBuscoreTelemetryEvent(validEvent({ context: { ...validEvent().context, app_version: "1234567.2.3" } })).ok, false);
  assert.equal(parseBuscoreTelemetryEvent(validEvent({ context: { ...validEvent().context, release_channel: "private-customer" } })).ok, false);
  assert.equal(parseBuscoreTelemetryEvent(validEvent({ context: { ...validEvent().context, os_category: "Windows 11 build 123" } })).ok, false);
  assert.equal(parseBuscoreTelemetryEvent(validEvent({ client_ts: "July 10 2026" })).ok, false);
  assert.equal(parseBuscoreTelemetryEvent(validEvent({ client_ts: "2026-02-30T00:00:00.000Z" })).ok, false);
});

test("endpoint validates method/content type/body bounds and rate-limits malformed JSON before parsing", async () => {
  const db = new FakeDb();
  assert.equal((await handleBuscoreTelemetryRequest(new Request("https://x/telemetry/v1/events"), db, "secret")).status, 405);
  assert.equal((await handleBuscoreTelemetryRequest(new Request("https://x/telemetry/v1/events", { method: "POST", body: "{}" }), db, "secret")).status, 415);
  assert.equal((await handleBuscoreTelemetryRequest(requestFor(validEvent(), { "Content-Length": "5000" }), db, "secret")).status, 413);
  assert.equal(db.rate.size, 0, "early Content-Length rejection must not hit D1");
  const malformed = await handleBuscoreTelemetryRequest(new Request("https://x/telemetry/v1/events", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" }, body: "{" }), db, "secret");
  assert.equal(malformed.status, 400);
  assert.equal([...db.rate.values()].reduce((a, b) => a + b, 0), 1);
});

test("bounded stream rejects a body larger than the limit without Content-Length", async () => {
  const db = new FakeDb();
  const response = await handleBuscoreTelemetryRequest(new Request("https://x/telemetry/v1/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" },
    body: "x".repeat(BUSCORE_TELEMETRY_LIMITS.max_body_bytes + 1),
  }), db, "secret");
  assert.equal(response.status, 413);
});

test("HMAC rate keys are stable within a minute and rotate across minutes", async () => {
  const a = await hmacRateLimitKey("secret", "2026-07-12T12:00", "192.0.2.10");
  const b = await hmacRateLimitKey("secret", "2026-07-12T12:00", "192.0.2.10");
  const c = await hmacRateLimitKey("secret", "2026-07-12T12:01", "192.0.2.10");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.doesNotMatch(a, /192\.0\.2\.10/);
});

test("endpoint persists once; the migration trigger makes retry aggregation idempotent", async () => {
  const db = new FakeDb();
  const now = new Date("2026-07-12T12:00:00.000Z");
  assert.equal((await handleBuscoreTelemetryRequest(requestFor(), db, "secret", now)).status, 202);
  assert.equal((await handleBuscoreTelemetryRequest(requestFor(), db, "secret", now)).status, 200);
  assert.equal(db.events.size, 1);
  assert.equal([...db.daily.values()].reduce((a, b) => a + b, 0), 1);
});

test("persistence failures return a bounded unavailable response and cannot write an aggregate", async () => {
  const db = new FakeDb();
  db.failRaw = true;
  const response = await handleBuscoreTelemetryRequest(requestFor(), db, "secret", new Date("2026-07-12T12:00:00.000Z"));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: "ingest_unavailable" });
  assert.equal(db.daily.size, 0);
});

test("rate limit rejects the first request above the configured threshold", async () => {
  const db = new FakeDb();
  const now = new Date("2026-07-12T12:00:00.000Z");
  for (let i = 0; i < BUSCORE_TELEMETRY_LIMITS.rate_limit_per_minute; i += 1) {
    const event_id = `11111111-1111-4111-8${i.toString(16).padStart(3, "0")}-111111111111`;
    assert.notEqual((await handleBuscoreTelemetryRequest(requestFor(validEvent({ event_id })), db, "secret", now)).status, 429);
  }
  assert.equal((await handleBuscoreTelemetryRequest(requestFor(validEvent({ event_id: "33333333-3333-4333-8333-333333333333" })), db, "secret", now)).status, 429);
});

test("report exposes literal aggregates and returning installation signals without IDs", async () => {
  const db = new FakeDb();
  const install = "22222222-2222-4222-8222-222222222222";
  await handleBuscoreTelemetryRequest(requestFor(validEvent({ event_id: "11111111-1111-4111-8111-111111111111", installation_id: install, event_name: "installation_first_launch" })), db, "secret", new Date("2026-07-11T12:00:00.000Z"));
  await handleBuscoreTelemetryRequest(requestFor(validEvent({ event_id: "33333333-3333-4333-8333-333333333333", installation_id: install, event_name: "update_check" })), db, "secret", new Date("2026-07-12T12:00:00.000Z"));
  const report = await buildBuscoreProductTelemetryReport(db, new Date("2026-07-12T13:00:00.000Z"));
  assert.equal(report.available, true);
  assert.equal(report.last_7_days.total_events, 2);
  assert.equal(report.last_7_days.categories.installation_release, 2);
  assert.equal(report.last_7_days.first_launches, 1);
  assert.equal(report.last_7_days.update_check_delivery_observations, 1);
  assert.equal(report.last_7_days.returning_installation_signals, 1);
  assert.doesNotMatch(JSON.stringify(report), new RegExp(install));
});

test("retention deletes cutoff buckets inclusively for exact retained windows", async () => {
  const db = new FakeDb();
  await pruneBuscoreTelemetry(db, new Date("2026-07-12T12:34:00.000Z"));
  assert.deepEqual(db.deletes, [
    { sql: "DELETE FROM buscore_product_events_raw WHERE received_day <= ?", cutoff: "2026-06-12" },
    { sql: "DELETE FROM buscore_telemetry_rate_limit WHERE minute_bucket <= ?", cutoff: "2026-07-10T12:34" },
    { sql: "DELETE FROM buscore_product_events_daily WHERE day <= ?", cutoff: "2025-06-07" },
  ]);
});

test("migration defines category storage and an atomic AFTER INSERT aggregate trigger", () => {
  const sql = fs.readFileSync(new URL("../migrations/0013_add_buscore_product_telemetry.sql", import.meta.url), "utf8");
  assert.match(sql, /category TEXT NOT NULL/);
  assert.match(sql, /CREATE TRIGGER IF NOT EXISTS trg_buscore_product_events_daily_after_insert/i);
  assert.match(sql, /AFTER INSERT ON buscore_product_events_raw/i);
  assert.match(sql, /ON CONFLICT\(day, category, event_name, app_version, release_channel, os_category\)/i);
  assert.doesNotMatch(sql, /customer_name|invoice_contents|file_path|raw_ip/i);
});

test("Worker route integrates telemetry secret and CORS without touching other services", async () => {
  const db = new FakeDb();
  const response = await workerModule.fetch(requestFor(), { DB: db, TELEMETRY_RATE_LIMIT_SECRET: "production-secret" }, {});
  assert.equal(response.status, 202);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
});
