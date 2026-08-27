import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { pathToFileURL } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export const CEO_REPORT_URL = "https://lighthouse.buscore.ca/report?view=ceo";
export const REPORT_TOKEN_ENV = "LIGHTHOUSE_REPORT_READ_TOKEN";
export const REPORT_TOKEN_HEADER = "X-Report-Token";
export const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_RESPONSE_BYTES = 1024 * 1024;
export const MIN_REPORT_TOKEN_BYTES = 32;
export const MAX_REPORT_TOKEN_BYTES = 128;
export const FAILURE_LINE = "Lighthouse CEO diagnostic failed.\n";
export const ACCESS_BLOCKED_LINE = "Lighthouse CEO diagnostic access blocked.\n";
export const REPORT_UNAVAILABLE_LINE = "Lighthouse CEO report unavailable; metrics_daily.errors may have been incremented.\n";
export const TOKEN_PROMPT = "Lighthouse report token: ";

const CEO_SCHEMA_URL = new URL("../contracts/ceo-v1/report.schema.json", import.meta.url);
const REPORT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const FAILURE_KIND = Object.freeze({
  ACCESS_BLOCKED: "access_blocked",
  DIAGNOSTIC: "diagnostic",
  REPORT_UNAVAILABLE: "report_unavailable",
});

class DiagnosticFailure extends Error {
  constructor(kind = FAILURE_KIND.DIAGNOSTIC) {
    super("diagnostic_failed");
    this.name = "DiagnosticFailure";
    this.kind = kind;
  }
}

let reportValidator;

function fail(kind = FAILURE_KIND.DIAGNOSTIC) {
  throw new DiagnosticFailure(kind);
}

export function isUsableReportToken(token) {
  if (typeof token !== "string" || !REPORT_TOKEN_PATTERN.test(token)) return false;
  const bytes = Buffer.byteLength(token, "utf8");
  return bytes >= MIN_REPORT_TOKEN_BYTES && bytes <= MAX_REPORT_TOKEN_BYTES;
}

function getReportValidator() {
  if (reportValidator) return reportValidator;

  const schema = JSON.parse(readFileSync(CEO_SCHEMA_URL, "utf8"));
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  reportValidator = ajv.compile(schema);
  return reportValidator;
}

export function takeEnvironmentToken(environment) {
  if (!environment || typeof environment !== "object") fail();

  const hadToken = Object.prototype.hasOwnProperty.call(environment, REPORT_TOKEN_ENV);
  const value = environment[REPORT_TOKEN_ENV];
  if (!Reflect.deleteProperty(environment, REPORT_TOKEN_ENV)) fail();
  if (!hadToken) return null;
  if (!isUsableReportToken(value)) fail(FAILURE_KIND.ACCESS_BLOCKED);
  return value;
}

export function readHiddenToken({ input, output }) {
  return new Promise((resolveToken, rejectToken) => {
    if (
      !input?.isTTY
      || !output?.isTTY
      || typeof input.setRawMode !== "function"
      || typeof input.on !== "function"
      || typeof input.removeListener !== "function"
    ) {
      rejectToken(new DiagnosticFailure(FAILURE_KIND.ACCESS_BLOCKED));
      return;
    }

    const wasRaw = Boolean(input.isRaw);
    const wasPaused = typeof input.isPaused === "function" ? input.isPaused() : false;
    const decoder = new StringDecoder("utf8");
    let token = "";
    let settled = false;

    const restoreInput = () => {
      input.removeListener("data", onData);
      input.removeListener("end", onEnd);
      input.removeListener("error", onError);
      try {
        input.setRawMode(wasRaw);
      } catch {
        // The caller still receives only the static failure contract.
      }
      if (wasPaused && typeof input.pause === "function") input.pause();
    };

    const settle = (ok) => {
      if (settled) return;
      settled = true;
      restoreInput();
      try {
        output.write("\n");
      } catch {
        rejectToken(new DiagnosticFailure());
        return;
      }
      if (ok && isUsableReportToken(token)) resolveToken(token);
      else rejectToken(new DiagnosticFailure(FAILURE_KIND.ACCESS_BLOCKED));
    };

    function onData(chunk) {
      const text = decoder.write(Buffer.from(chunk));
      for (const character of text) {
        if (character === "\u0003" || character === "\u0004") {
          settle(false);
          return;
        }
        if (character === "\r" || character === "\n") {
          settle(true);
          return;
        }
        if (character === "\b" || character === "\u007f") {
          token = Array.from(token).slice(0, -1).join("");
          continue;
        }
        if (character < " ") continue;

        const nextToken = `${token}${character}`;
        if (Buffer.byteLength(nextToken, "utf8") > MAX_REPORT_TOKEN_BYTES) {
          settle(false);
          return;
        }
        token = nextToken;
      }
    }

    function onEnd() {
      settle(false);
    }

    function onError() {
      settle(false);
    }

    try {
      input.setRawMode(true);
      if (typeof input.resume === "function") input.resume();
      output.write(TOKEN_PROMPT);
      input.on("data", onData);
      input.on("end", onEnd);
      input.on("error", onError);
    } catch {
      settle(false);
    }
  });
}

async function readBoundedBody(response) {
  const contentLength = response.headers?.get?.("content-length");
  if (typeof contentLength === "string" && /^\d+$/.test(contentLength.trim())) {
    const advertisedBytes = Number(contentLength);
    if (!Number.isSafeInteger(advertisedBytes) || advertisedBytes > MAX_RESPONSE_BYTES) fail();
  }

  if (!response.body || typeof response.body.getReader !== "function") fail();

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!(value instanceof Uint8Array)) fail();

    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // Cancellation failure does not alter the static diagnostic failure.
      }
      fail();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function fetchValidatedCeoReport({
  token,
  fetchImpl = globalThis.fetch,
  scheduleTimeout = setTimeout,
  cancelTimeout = clearTimeout,
}) {
  if (!isUsableReportToken(token)) fail(FAILURE_KIND.ACCESS_BLOCKED);
  if (typeof fetchImpl !== "function") fail();

  const controller = new AbortController();
  const timeout = scheduleTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(CEO_REPORT_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        [REPORT_TOKEN_HEADER]: token,
      },
      redirect: "manual",
      signal: controller.signal,
    });

    if (!response || response.redirected === true) fail();
    if (response.status === 401 || response.status === 403) fail(FAILURE_KIND.ACCESS_BLOCKED);
    if (response.status === 503) fail(FAILURE_KIND.REPORT_UNAVAILABLE);
    if (response.status !== 200) fail();

    const body = await readBoundedBody(response);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    if (text.includes(token)) fail();

    const report = JSON.parse(text);
    if (!getReportValidator()(report)) fail();

    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (output.includes(token)) fail();
    return output;
  } catch (error) {
    if (error instanceof DiagnosticFailure) throw error;
    fail();
  } finally {
    cancelTimeout(timeout);
  }
}

function writeStaticFailure(stderr, kind) {
  const line = kind === FAILURE_KIND.ACCESS_BLOCKED
    ? ACCESS_BLOCKED_LINE
    : kind === FAILURE_KIND.REPORT_UNAVAILABLE
      ? REPORT_UNAVAILABLE_LINE
      : FAILURE_LINE;
  try {
    stderr?.write?.(line);
  } catch {
    // There is no secondary output channel and dynamic errors are forbidden.
  }
}

export async function runDiagnostic({
  argv = [],
  environment = process.env,
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  fetchImpl = globalThis.fetch,
  promptImpl = readHiddenToken,
  scheduleTimeout = setTimeout,
  cancelTimeout = clearTimeout,
} = {}) {
  let environmentToken = null;

  try {
    environmentToken = takeEnvironmentToken(environment);
    if (!Array.isArray(argv) || argv.length !== 0) fail();

    const token = environmentToken ?? await promptImpl({ input: stdin, output: stderr });
    if (!isUsableReportToken(token)) fail(FAILURE_KIND.ACCESS_BLOCKED);

    const output = await fetchValidatedCeoReport({
      token,
      fetchImpl,
      scheduleTimeout,
      cancelTimeout,
    });
    stdout.write(output);
    return 0;
  } catch (error) {
    const kind = error instanceof DiagnosticFailure ? error.kind : FAILURE_KIND.DIAGNOSTIC;
    writeStaticFailure(stderr, kind);
    return 1;
  } finally {
    environmentToken = null;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  process.exitCode = await runDiagnostic({ argv: process.argv.slice(2) });
}
