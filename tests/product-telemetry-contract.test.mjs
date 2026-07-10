import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  BUSCORE_TELEMETRY_EVENT_NAMES,
  handleBuscoreTelemetryRequest,
  parseBuscoreTelemetryEvent,
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

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async run() {
    if (this.sql.startsWith("INSERT INTO buscore_telemetry_rate_limit")) {
      const key = `${this.args[0]}:${this.args[1]}`;
      this.db.rate.set(key, (this.db.rate.get(key) ?? 0) + 1);
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("INSERT OR IGNORE INTO buscore_product_events_raw")) {
      const id = this.args[0];
      if (this.db.events.has(id)) return { meta: { changes: 0 } };
      this.db.events.add(id);
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("INSERT INTO buscore_product_events_daily")) {
      this.db.aggregateWrites += 1;
      return { meta: { changes: 1 } };
    }
    throw new Error(`unexpected run SQL: ${this.sql}`);
  }
  async first() {
    if (this.sql.startsWith("SELECT count FROM buscore_telemetry_rate_limit")) {
      return { count: this.db.rate.get(`${this.args[0]}:${this.args[1]}`) ?? 0 };
    }
    throw new Error(`unexpected first SQL: ${this.sql}`);
  }
}

class FakeDb {
  constructor() { this.rate = new Map(); this.events = new Set(); this.aggregateWrites = 0; }
  prepare(sql) { return new FakeStatement(this, sql); }
}

test("fixture and implementation expose the same complete allowlist", () => {
  const fixture = JSON.parse(fs.readFileSync(new URL("../contracts/buscore-product-telemetry-v1.json", import.meta.url)));
  assert.deepEqual([...BUSCORE_TELEMETRY_EVENT_NAMES], fixture.event_names);
  assert.equal(fixture.strict, true);
});

test("strict parser accepts the canonical event", () => {
  const result = parseBuscoreTelemetryEvent(validEvent());
  assert.equal(result.ok, true);
});

test("strict parser rejects unknown events and unexpected root or context fields", () => {
  assert.deepEqual(parseBuscoreTelemetryEvent(validEvent({ event_name: "customer_opened" })), { ok: false, error: "invalid_event_name" });
  assert.deepEqual(parseBuscoreTelemetryEvent({ ...validEvent(), customer_name: "prohibited" }), { ok: false, error: "unexpected_fields" });
  assert.deepEqual(parseBuscoreTelemetryEvent(validEvent({ context: { ...validEvent().context, file_path: "C:/private" } })), { ok: false, error: "unexpected_context_fields" });
});

test("strict parser rejects non-random installation identifiers and invalid dimensions", () => {
  assert.equal(parseBuscoreTelemetryEvent(validEvent({ installation_id: "machine-name" })).ok, false);
  assert.equal(parseBuscoreTelemetryEvent(validEvent({ context: { ...validEvent().context, app_version: "latest" } })).ok, false);
  assert.equal(parseBuscoreTelemetryEvent(validEvent({ context: { ...validEvent().context, os_category: "Windows 11 build 123" } })).ok, false);
});

test("endpoint persists once and deduplicates retries by event_id", async () => {
  const db = new FakeDb();
  const request = () => new Request("https://lighthouse.buscore.ca/telemetry/v1/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.10" },
    body: JSON.stringify(validEvent()),
  });
  const accepted = await handleBuscoreTelemetryRequest(request(), db);
  const duplicate = await handleBuscoreTelemetryRequest(request(), db);
  assert.equal(accepted.status, 202);
  assert.equal(duplicate.status, 200);
  assert.equal(db.events.size, 1);
  assert.equal(db.aggregateWrites, 1);
});

test("endpoint rejects malformed content without writing", async () => {
  const db = new FakeDb();
  const response = await handleBuscoreTelemetryRequest(new Request("https://lighthouse.buscore.ca/telemetry/v1/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...validEvent(), invoice_contents: "prohibited" }),
  }), db);
  assert.equal(response.status, 400);
  assert.equal(db.events.size, 0);
});

test("migration defines raw, aggregate, and short-lived rate-limit storage", () => {
  const sql = fs.readFileSync(new URL("../migrations/0013_add_buscore_product_telemetry.sql", import.meta.url), "utf8");
  assert.match(sql, /buscore_product_events_raw/);
  assert.match(sql, /buscore_product_events_daily/);
  assert.match(sql, /buscore_telemetry_rate_limit/);
  assert.doesNotMatch(sql, /customer_name|invoice_contents|file_path|raw_ip/i);
});
