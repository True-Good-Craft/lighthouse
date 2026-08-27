import test from "node:test";
import assert from "node:assert/strict";

import * as workerModule from "../dist/index.js";

const worker = workerModule.default?.fetch
  ? workerModule.default
  : workerModule.default?.default ?? workerModule.default;

const ADMIN_SECRET = "admin-secret";
const REPORT_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";

function makeDb() {
  const calls = { prepare: 0, run: 0 };
  const db = {
    prepare() {
      calls.prepare += 1;
      const statement = {
        bind() {
          return statement;
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          calls.run += 1;
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
  return { db, calls };
}

function makeEnv({
  db,
  includeReportToken = true,
  reportToken = REPORT_SECRET,
  adminToken = ADMIN_SECRET,
} = {}) {
  const env = {
    DB: db ?? makeDb().db,
    MANIFEST_R2: {},
    ADMIN_TOKEN: adminToken,
    IGNORED_IP: "",
    CF_API_TOKEN: "",
    CF_ZONE_TAG: "",
  };
  if (includeReportToken) env.REPORT_READ_TOKEN = reportToken;
  return env;
}

function makeContext() {
  const calls = { waitUntil: 0 };
  return {
    calls,
    ctx: {
      waitUntil() {
        calls.waitUntil += 1;
      },
    },
  };
}

async function assertUnauthorized(response) {
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: "unauthorized" });
}

test("GET /report accepts the exact report-read token for the current report contract", async () => {
  const { db, calls } = makeDb();
  const { ctx } = makeContext();
  const response = await worker.fetch(
    new Request("https://lighthouse.test/report?view=ceo", {
      headers: { "X-Report-Token": REPORT_SECRET },
    }),
    makeEnv({ db }),
    ctx
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.view, "ceo");
  assert.equal(payload.report_contract_version, "1.2");
  assert.ok(calls.prepare > 0, "an authorized report reaches stored-data reads");
  assert.equal(calls.run, 0, "the stored-data CEO view performs no writes");
  assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type");
});

test("GET /report retains exact admin-token compatibility when the distinct read binding is absent or malformed", async () => {
  const configurations = [
    { includeReportToken: false },
    { includeReportToken: true, reportToken: "short-report-secret" },
  ];

  for (const configuration of configurations) {
    const { db } = makeDb();
    const response = await worker.fetch(
      new Request("https://lighthouse.test/report?view=ceo", {
        headers: { "X-Admin-Token": ADMIN_SECRET },
      }),
      makeEnv({ db, ...configuration }),
      makeContext().ctx
    );

    assert.equal(response.status, 200);
    assert.equal((await response.json()).view, "ceo");
  }
});

test("GET /report rejects missing, blank, malformed, unbound, and non-exact report credentials before side effects", async () => {
  const cases = [
    { name: "missing header", headers: {}, includeReportToken: true },
    { name: "blank header", headers: { "X-Report-Token": "" }, includeReportToken: true },
    { name: "missing binding", headers: { "X-Report-Token": REPORT_SECRET }, includeReportToken: false },
    { name: "blank binding", headers: { "X-Report-Token": REPORT_SECRET }, includeReportToken: true, reportToken: "" },
    {
      name: "short binding",
      headers: { "X-Report-Token": "short-report-secret" },
      includeReportToken: true,
      reportToken: "short-report-secret",
    },
    {
      name: "space-containing binding",
      headers: { "X-Report-Token": `${"a".repeat(16)} ${"b".repeat(16)}` },
      includeReportToken: true,
      reportToken: `${"a".repeat(16)} ${"b".repeat(16)}`,
    },
    {
      name: "punctuation-containing binding",
      headers: { "X-Report-Token": `${"a".repeat(31)}!` },
      includeReportToken: true,
      reportToken: `${"a".repeat(31)}!`,
    },
    {
      name: "oversized binding",
      headers: { "X-Report-Token": "a".repeat(129) },
      includeReportToken: true,
      reportToken: "a".repeat(129),
    },
    { name: "wrong value", headers: { "X-Report-Token": "wrong" }, includeReportToken: true },
    { name: "value with suffix", headers: { "X-Report-Token": `${REPORT_SECRET}-extra` }, includeReportToken: true },
    { name: "report credential in admin header", headers: { "X-Admin-Token": REPORT_SECRET }, includeReportToken: true },
    { name: "wrong admin value", headers: { "X-Admin-Token": "wrong" }, includeReportToken: true },
  ];

  for (const authCase of cases) {
    const { db, calls } = makeDb();
    const { ctx, calls: contextCalls } = makeContext();
    const response = await worker.fetch(
      new Request("https://lighthouse.test/report?view=invalid", { headers: authCase.headers }),
      makeEnv({
        db,
        includeReportToken: authCase.includeReportToken,
        reportToken: authCase.reportToken,
      }),
      ctx
    );

    await assertUnauthorized(response);
    assert.equal(calls.prepare, 0, `${authCase.name}: no database read or error-counter access`);
    assert.equal(calls.run, 0, `${authCase.name}: no database write`);
    assert.equal(contextCalls.waitUntil, 0, `${authCase.name}: no deferred work`);
  }
});

test("REPORT_READ_TOKEN cannot turn /report into a non-GET surface", async () => {
  const { db, calls } = makeDb();
  const { ctx, calls: contextCalls } = makeContext();
  const response = await worker.fetch(
    new Request("https://lighthouse.test/report?view=ceo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Report-Token": REPORT_SECRET,
      },
      body: JSON.stringify({ method_probe: "must not be authorized" }),
    }),
    makeEnv({ db }),
    ctx
  );

  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), { ok: false, error: "method_not_allowed" });
  assert.equal(calls.prepare, 0);
  assert.equal(calls.run, 0);
  assert.equal(contextCalls.waitUntil, 0);
});

test("REPORT_READ_TOKEN cannot authorize campaign, note, or snapshot writes", async () => {
  const requests = [
    ["/campaign", { channel: "community", tagged_src: "test" }],
    ["/notes", { note: "must not be inserted" }],
    ["/report/snapshot", { kind: "monthly", summary_json: { test: true } }],
  ];

  for (const [path, body] of requests) {
    const { db, calls } = makeDb();
    const { ctx, calls: contextCalls } = makeContext();
    const response = await worker.fetch(
      new Request(`https://lighthouse.test${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Report-Token": REPORT_SECRET,
        },
        body: JSON.stringify(body),
      }),
      makeEnv({ db }),
      ctx
    );

    await assertUnauthorized(response);
    assert.equal(calls.prepare, 0, `${path}: authorization fails before database access`);
    assert.equal(calls.run, 0, `${path}: no insert is attempted`);
    assert.equal(contextCalls.waitUntil, 0, `${path}: no deferred work`);
  }
});

test("colliding admin and report-read secrets fail closed for reads and writes", async () => {
  const collisionSecret = "abcdef0123456789abcdef0123456789abcdef0123456789";
  const requests = [
    new Request("https://lighthouse.test/report?view=ceo", {
      headers: { "X-Report-Token": collisionSecret },
    }),
    new Request("https://lighthouse.test/report?view=ceo", {
      headers: { "X-Admin-Token": collisionSecret },
    }),
    new Request("https://lighthouse.test/campaign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": collisionSecret,
      },
      body: JSON.stringify({ channel: "community", tagged_src: "collision" }),
    }),
  ];

  for (const request of requests) {
    const { db, calls } = makeDb();
    const { ctx, calls: contextCalls } = makeContext();
    const response = await worker.fetch(
      request,
      makeEnv({ db, adminToken: collisionSecret, reportToken: collisionSecret }),
      ctx
    );

    await assertUnauthorized(response);
    assert.equal(calls.prepare, 0);
    assert.equal(calls.run, 0);
    assert.equal(contextCalls.waitUntil, 0);
  }
});
