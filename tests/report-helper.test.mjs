import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";

const originalFetch = globalThis.fetch;
let importFetchCalls = 0;
let helper;
try {
  globalThis.fetch = async () => {
    importFetchCalls += 1;
    throw new Error("unexpected import-time fetch");
  };
  helper = await import("../scripts/read-ceo-report.mjs");
} finally {
  globalThis.fetch = originalFetch;
}

const {
  ACCESS_BLOCKED_LINE,
  CEO_REPORT_URL,
  FAILURE_LINE,
  MAX_REPORT_TOKEN_BYTES,
  MAX_RESPONSE_BYTES,
  MIN_REPORT_TOKEN_BYTES,
  REPORT_TOKEN_ENV,
  REPORT_TOKEN_HEADER,
  REPORT_UNAVAILABLE_LINE,
  REQUEST_TIMEOUT_MS,
  TOKEN_PROMPT,
  isUsableReportToken,
  readHiddenToken,
  runDiagnostic,
} = helper;

const VALID_REPORT_TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef";
const SECOND_VALID_REPORT_TOKEN = "abcdef0123456789abcdef0123456789abcdef0123456789";

const fixtureText = readFileSync(
  new URL("../contracts/ceo-v1/healthy-zero.json", import.meta.url),
  "utf8",
);
const fixture = JSON.parse(fixtureText);

function writer({ isTTY = false } = {}) {
  const chunks = [];
  return {
    isTTY,
    chunks,
    write(value) {
      chunks.push(String(value));
      return true;
    },
    get text() {
      return chunks.join("");
    },
  };
}

function successfulResponse(value = fixtureText) {
  return new Response(value, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("helper import is local-only and the diagnostic surface is fixed", () => {
  assert.equal(importFetchCalls, 0);
  assert.equal(CEO_REPORT_URL, "https://lighthouse.buscore.ca/report?view=ceo");
  assert.equal(REPORT_TOKEN_ENV, "LIGHTHOUSE_REPORT_READ_TOKEN");
  assert.equal(REPORT_TOKEN_HEADER, "X-Report-Token");
  assert.equal(REQUEST_TIMEOUT_MS, 15_000);
  assert.equal(MAX_RESPONSE_BYTES, 1024 * 1024);
  assert.equal(MIN_REPORT_TOKEN_BYTES, 32);
  assert.equal(MAX_REPORT_TOKEN_BYTES, 128);
  assert.equal(isUsableReportToken("a".repeat(32)), true);
  assert.equal(isUsableReportToken("a".repeat(128)), true);
  assert.equal(isUsableReportToken("a".repeat(31)), false);
  assert.equal(isUsableReportToken("a".repeat(129)), false);
  assert.equal(isUsableReportToken(`a${"b".repeat(31)} `), false);
  assert.equal(isUsableReportToken(`a${"b".repeat(30)}!`), false);
  assert.equal(isUsableReportToken(`a${"b".repeat(30)}é`), false);
});

test("automation credential is deleted before one fixed validated GET reaches stdout", async () => {
  const secret = VALID_REPORT_TOKEN;
  const environment = { [REPORT_TOKEN_ENV]: secret };
  const stdout = writer();
  const stderr = writer();
  const calls = [];
  let scheduledDelay = null;
  let clearedTimer = null;
  const timerHandle = Symbol("timer");

  const exitCode = await runDiagnostic({
    argv: [],
    environment,
    stdin: { isTTY: false },
    stdout,
    stderr,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return successfulResponse();
    },
    scheduleTimeout(_callback, delay) {
      scheduledDelay = delay;
      return timerHandle;
    },
    cancelTimeout(handle) {
      clearedTimer = handle;
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(Object.hasOwn(environment, REPORT_TOKEN_ENV), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, CEO_REPORT_URL);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.redirect, "manual");
  assert.equal(calls[0].options.headers[REPORT_TOKEN_HEADER], secret);
  assert.equal(calls[0].options.headers.Accept, "application/json");
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(scheduledDelay, REQUEST_TIMEOUT_MS);
  assert.equal(clearedTimer, timerHandle);
  assert.deepEqual(JSON.parse(stdout.text), fixture);
  assert.equal(stdout.text.endsWith("\n"), true);
  assert.equal(stderr.text, "");
  assert.equal(`${stdout.text}${stderr.text}`.includes(secret), false);
});

test("hidden TTY prompt does not echo the interactive credential", async () => {
  class FakeTty extends EventEmitter {
    constructor() {
      super();
      this.isTTY = true;
      this.isRaw = false;
      this.paused = true;
      this.rawTransitions = [];
    }
    isPaused() { return this.paused; }
    pause() { this.paused = true; }
    resume() { this.paused = false; }
    setRawMode(value) {
      this.isRaw = value;
      this.rawTransitions.push(value);
    }
  }

  const input = new FakeTty();
  const output = writer({ isTTY: true });
  const tokenPromise = readHiddenToken({ input, output });
  input.emit("data", Buffer.from(`${VALID_REPORT_TOKEN}x`));
  input.emit("data", Buffer.from("\b"));
  input.emit("data", Buffer.from("\r"));

  assert.equal(await tokenPromise, VALID_REPORT_TOKEN);
  assert.equal(output.text, `${TOKEN_PROMPT}\n`);
  assert.equal(output.text.includes(VALID_REPORT_TOKEN), false);
  assert.deepEqual(input.rawTransitions, [true, false]);
  assert.equal(input.paused, true);
});

test("missing credential and any CLI argument fail closed without a request", async (t) => {
  await t.test("missing credential", async () => {
    const environment = {};
    const stdout = writer();
    const stderr = writer();
    let fetchCalls = 0;

    const exitCode = await runDiagnostic({
      argv: [],
      environment,
      stdin: { isTTY: false },
      stdout,
      stderr,
      fetchImpl: async () => {
        fetchCalls += 1;
        return successfulResponse();
      },
    });

    assert.equal(exitCode, 1);
    assert.equal(fetchCalls, 0);
    assert.equal(stdout.text, "");
    assert.equal(stderr.text, ACCESS_BLOCKED_LINE);
  });

  await t.test("arguments cannot override the fixed request", async () => {
    const secret = SECOND_VALID_REPORT_TOKEN;
    const environment = { [REPORT_TOKEN_ENV]: secret };
    const stdout = writer();
    const stderr = writer();
    let fetchCalls = 0;

    const exitCode = await runDiagnostic({
      argv: ["https://example.invalid/report"],
      environment,
      stdout,
      stderr,
      fetchImpl: async () => {
        fetchCalls += 1;
        return successfulResponse();
      },
    });

    assert.equal(exitCode, 1);
    assert.equal(Object.hasOwn(environment, REPORT_TOKEN_ENV), false);
    assert.equal(fetchCalls, 0);
    assert.equal(stdout.text, "");
    assert.equal(stderr.text, FAILURE_LINE);
    assert.equal(stderr.text.includes(secret), false);
  });

  await t.test("invalid automation credential format is deleted and fails before a request", async () => {
    const environment = { [REPORT_TOKEN_ENV]: "too-short" };
    const stdout = writer();
    const stderr = writer();
    let fetchCalls = 0;

    const exitCode = await runDiagnostic({
      environment,
      stdout,
      stderr,
      fetchImpl: async () => {
        fetchCalls += 1;
        return successfulResponse();
      },
    });

    assert.equal(exitCode, 1);
    assert.equal(Object.hasOwn(environment, REPORT_TOKEN_ENV), false);
    assert.equal(fetchCalls, 0);
    assert.equal(stdout.text, "");
    assert.equal(stderr.text, ACCESS_BLOCKED_LINE);
  });
});

test("redirects, bad payloads, reflected credentials, and oversized bodies are suppressed", async (t) => {
  const cases = [
    ["redirect", () => new Response(null, { status: 302, headers: { Location: CEO_REPORT_URL } }), FAILURE_LINE],
    ["authorization failure", () => new Response("unauthorized", { status: 401 }), ACCESS_BLOCKED_LINE],
    ["authorization forbidden", () => new Response("forbidden", { status: 403 }), ACCESS_BLOCKED_LINE],
    ["report unavailable", () => new Response("unavailable", { status: 503 }), REPORT_UNAVAILABLE_LINE],
    ["other server failure", () => new Response("failed", { status: 500 }), FAILURE_LINE],
    ["invalid JSON", () => successfulResponse("not json"), FAILURE_LINE],
    ["schema drift", () => successfulResponse(JSON.stringify({ ...fixture, report_contract_version: "9" })), FAILURE_LINE],
    [
      "advertised oversized body",
      () => new Response("{}", {
        status: 200,
        headers: { "Content-Length": String(MAX_RESPONSE_BYTES + 1) },
      }),
      FAILURE_LINE,
    ],
    [
      "streamed oversized body",
      () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(MAX_RESPONSE_BYTES));
          controller.enqueue(new Uint8Array(1));
          controller.close();
        },
      }), { status: 200 }),
      FAILURE_LINE,
    ],
  ];

  for (const [name, responseFactory, expectedFailureLine] of cases) {
    await t.test(name, async () => {
      const secret = VALID_REPORT_TOKEN;
      const stdout = writer();
      const stderr = writer();
      let fetchCalls = 0;
      const exitCode = await runDiagnostic({
        environment: { [REPORT_TOKEN_ENV]: secret },
        stdout,
        stderr,
        fetchImpl: async () => {
          fetchCalls += 1;
          return responseFactory();
        },
      });

      assert.equal(exitCode, 1);
      assert.equal(fetchCalls, 1);
      assert.equal(stdout.text, "");
      assert.equal(stderr.text, expectedFailureLine);
      assert.equal(stderr.text.includes(secret), false);
    });
  }

  await t.test("schema-valid response containing the credential", async () => {
    const secret = fixture.report_id;
    const stdout = writer();
    const stderr = writer();
    const exitCode = await runDiagnostic({
      environment: { [REPORT_TOKEN_ENV]: secret },
      stdout,
      stderr,
      fetchImpl: async () => successfulResponse(),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.text, "");
    assert.equal(stderr.text, FAILURE_LINE);
    assert.equal(stderr.text.includes(secret), false);
  });
});

test("the 15-second abort path is single-shot and emits only the static failure", async () => {
  const secret = SECOND_VALID_REPORT_TOKEN;
  const stdout = writer();
  const stderr = writer();
  let fetchCalls = 0;
  let scheduledDelay = null;
  let cleared = false;

  const exitCode = await runDiagnostic({
    environment: { [REPORT_TOKEN_ENV]: secret },
    stdout,
    stderr,
    fetchImpl: async (_url, { signal }) => {
      fetchCalls += 1;
      return await new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error(`do not print ${secret}`)), { once: true });
      });
    },
    scheduleTimeout(callback, delay) {
      scheduledDelay = delay;
      queueMicrotask(callback);
      return Symbol("timeout");
    },
    cancelTimeout() {
      cleared = true;
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(fetchCalls, 1);
  assert.equal(scheduledDelay, REQUEST_TIMEOUT_MS);
  assert.equal(cleared, true);
  assert.equal(stdout.text, "");
  assert.equal(stderr.text, FAILURE_LINE);
  assert.equal(stderr.text.includes(secret), false);
});
