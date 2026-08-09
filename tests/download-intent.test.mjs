import assert from "node:assert/strict";
import test from "node:test";

import workerModule from "../dist/index.js";

const worker = workerModule.fetch ? workerModule : workerModule.default ?? workerModule;

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql.replace(/\s+/g, " ").trim(); this.args = []; }
  bind(...args) { this.args = args; return this; }
  run() { return this.db.run(this.sql, this.args); }
  first() { return this.db.first(this.sql, this.args); }
}

class IntentDb {
  constructor() {
    this.siteRate = new Map();
    this.hmacRate = new Map();
    this.intent = { raw: 0, probable: 0, suppressed: 0 };
    this.rawRows = 0;
  }
  prepare(sql) { return new Statement(this, sql); }
  async run(sql, args) {
    if (sql.startsWith("INSERT INTO site_event_rate_limit")) {
      const key = `${args[0]}|${args[1]}`;
      if (!this.siteRate.has(key)) this.siteRate.set(key, 0);
    } else if (sql.startsWith("UPDATE site_event_rate_limit SET count")) {
      const key = `${args[0]}|${args[1]}`;
      this.siteRate.set(key, (this.siteRate.get(key) ?? 0) + 1);
    } else if (sql.startsWith("INSERT INTO site_events_raw")) {
      this.rawRows += 1;
    } else if (sql.startsWith("INSERT INTO buscore_telemetry_rate_limit")) {
      const key = `${args[0]}|${args[1]}`;
      this.hmacRate.set(key, (this.hmacRate.get(key) ?? 0) + 1);
    } else if (sql.startsWith("INSERT INTO buscore_download_intent_daily")) {
      this.intent.raw += args[1];
      this.intent.probable += args[2];
      this.intent.suppressed += args[3];
    }
    return { success: true };
  }
  async first(sql, args) {
    if (sql.startsWith("SELECT count FROM site_event_rate_limit")) {
      return { count: this.siteRate.get(`${args[0]}|${args[1]}`) ?? 0 };
    }
    if (sql.startsWith("SELECT count FROM buscore_telemetry_rate_limit")) {
      return { count: this.hmacRate.get(`${args[0]}|${args[1]}`) ?? 0 };
    }
    return null;
  }
}

function payload(overrides = {}) {
  return {
    site_key: "buscore",
    event_name: "download_click",
    client_ts: new Date().toISOString(),
    path: "/downloads",
    url: "https://buscore.ca/downloads",
    referrer: "",
    utm: {},
    device: "desktop",
    viewport: "1440x900",
    lang: "en-CA",
    tz: "America/Toronto",
    event_value: "/releases/BUS-Core-1.4.1.zip",
    ...overrides,
  };
}

async function send(db, body, ip = "198.51.100.10", origin = "https://buscore.ca") {
  const pending = [];
  const response = await worker.fetch(new Request("https://lighthouse.buscore.ca/metrics/event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": origin,
      "CF-Connecting-IP": ip,
      "User-Agent": "intent-test",
    },
    body: JSON.stringify(body),
  }), {
    DB: db,
    TELEMETRY_RATE_LIMIT_SECRET: "intent-test-secret",
    IGNORED_IP: "",
  }, { waitUntil(value) { pending.push(Promise.resolve(value)); } });
  await Promise.all(pending);
  return response;
}

test("download intent keeps raw events while daily HMAC dedup stays an explicit proxy", async () => {
  const db = new IntentDb();
  assert.equal((await send(db, payload())).status, 204);
  assert.equal((await send(db, payload())).status, 204);
  assert.equal((await send(db, payload(), "198.51.100.11")).status, 204);

  assert.equal(db.rawRows, 3);
  assert.deepEqual(db.intent, { raw: 3, probable: 2, suppressed: 1 });
});

test("test-mode or wrong-origin clicks remain raw events but never probable-human intent", async () => {
  const db = new IntentDb();
  await send(db, payload({ test_mode: true }));
  await send(db, payload(), "198.51.100.12", "https://evil.example");

  assert.equal(db.rawRows, 2);
  assert.deepEqual(db.intent, { raw: 2, probable: 0, suppressed: 0 });
});

test("download interest requires an exact Lighthouse artifact target", async () => {
  const db = new IntentDb();
  await send(db, payload({ event_value: null }));
  await send(db, payload({ event_value: "/downloads" }), "198.51.100.11");
  await send(db, payload({ event_value: "https://example.com/releases/BUS-Core-1.4.1.zip" }), "198.51.100.12");
  await send(db, payload({ event_value: "/releases/BUS-Core-1.4.1.zip?probe=1" }), "198.51.100.13");
  await send(db, payload({ event_value: "https://lighthouse.buscore.ca/releases/BUS-Core-1.4.1.zip" }), "198.51.100.14");

  assert.equal(db.rawRows, 5);
  assert.deepEqual(db.intent, { raw: 5, probable: 1, suppressed: 0 });
});
