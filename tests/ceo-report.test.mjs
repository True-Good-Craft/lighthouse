import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import * as workerModule from "../dist/index.js";
import {
  buildCeoReport,
  buildCeoReportWindows,
  normalizeReportView,
  resolveReportRequest,
  runHealthChecks,
} from "../dist/index.js";
import { buildBuscoreProductTelemetryWindow } from "../dist/productTelemetry.js";

const worker = workerModule.default?.fetch ? workerModule.default : workerModule.default?.default ?? workerModule.default;
const ctx = { waitUntil() {} };

const PRODUCT_FAILURE_NAMES = [
  "update_failure",
  "startup_failure",
  "backup_failure",
  "restore_failure",
  "migration_failure",
  "import_failed",
  "unhandled_application_error",
];

const WINDOW_KEYS = [
  "today",
  "latest_complete_day",
  "last_7_complete_days",
  "previous_7_complete_days",
  "last_30_complete_days",
];

function windowColumns(metrics, dataThrough = null) {
  const row = { data_through: dataThrough };
  for (const [metric, value] of Object.entries(metrics)) {
    for (const key of WINDOW_KEYS) row[`${metric}_${key}`] = value;
  }
  return row;
}

function productAggregateRow({ zero, watermark, includeProductFailures }) {
  const row = windowColumns({
    first_launches: 0,
    version_first_seen: 0,
    workflow_milestones: 0,
    product_failures: 0,
  }, watermark);
  if (zero) return row;
  for (const key of ["latest_complete_day", "last_7_complete_days", "last_30_complete_days"]) {
    row[`first_launches_${key}`] = 1;
    row[`version_first_seen_${key}`] = 1;
    row[`workflow_milestones_${key}`] = 2;
  }
  if (includeProductFailures) {
    const perFailure = {
      today: 1,
      latest_complete_day: 2,
      last_7_complete_days: 12,
      previous_7_complete_days: 0,
      last_30_complete_days: 12,
    };
    for (const [key, count] of Object.entries(perFailure)) {
      row[`product_failures_${key}`] = count * PRODUCT_FAILURE_NAMES.length;
      for (const name of PRODUCT_FAILURE_NAMES) row[`failure_${name}_${key}`] = count;
    }
  }
  return row;
}

function defaultLeadRows({ zero, watermark }) {
  if (zero) return [{ source: null, data_through: null }];
  return [{
    source: "reddit",
    count_today: 0,
    count_latest_complete_day: 2,
    count_last_7_complete_days: 2,
    count_previous_7_complete_days: 0,
    count_last_30_complete_days: 2,
    data_through: `${watermark}T12:00:00.000Z`,
  }, { source: null, data_through: `${watermark}T12:00:00.000Z` }];
}

function makeCeoDb({
  failPattern = null,
  zero = false,
  sqlLog = [],
  healthRows = null,
  leadRows = null,
  includeProductFailures = true,
  watermark = zero ? null : "2026-08-08",
  tracker = null,
  runLog = [],
} = {}) {
  const maybeFail = (sql) => {
    if (failPattern && sql.includes(failPattern)) throw new Error("simulated source failure");
  };
  const metric = (value) => zero ? 0 : value;
  const observedAt = watermark ? `${watermark}T12:00:00.000Z` : null;
  const execute = async (sql, producer) => {
    if (tracker) {
      tracker.count += 1;
      tracker.active += 1;
      tracker.peak = Math.max(tracker.peak, tracker.active);
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    try {
      maybeFail(sql);
      return producer();
    } finally {
      if (tracker) tracker.active -= 1;
    }
  };
  return {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      sqlLog.push(normalized);
      let args = [];
      const api = {
        bind(...values) { args = values; return api; },
        async first() {
          return execute(normalized, () => {
            if (normalized.includes("FROM artifact_traffic_daily")) {
              return windowColumns({
                full_responses: metric(104),
                deduplicated_clients: metric(100),
                suppressed_repetitive_requests: metric(4),
                rate_limited_requests: 0,
                failed_requests: metric(2),
              }, watermark);
            }
            if (normalized.includes("raw AS") && normalized.includes("release_update_checks_daily")) {
              return {
                ...windowColumns({ raw_checks: metric(6), detail_checks: metric(5), known_checks: metric(4) }),
                raw_data_through: watermark,
                detail_data_through: watermark,
              };
            }
            if (normalized.includes("FROM buscore_product_events_daily") && normalized.includes("product_failures_today")) {
              return productAggregateRow({ zero, watermark, includeProductFailures });
            }
            if (normalized.includes("buscore_download_intent_daily")) {
              return {
                ...windowColumns({ page_views: metric(3), probable_download_intents: metric(1) }),
                pageview_data_through: observedAt,
                intent_data_through: watermark,
              };
            }
            if (normalized.includes("FROM site_events_raw") && normalized.includes("event_name = 'page_view'")) {
              return windowColumns({ page_views: metric(4) }, observedAt);
            }
            if (normalized.includes("errors_today") && normalized.includes("FROM metrics_daily")) {
              return windowColumns({ errors: metric(1) }, watermark);
            }
            return null;
          });
        },
        async all() {
          return execute(normalized, () => {
            if (normalized.includes("FROM buscore_product_events_daily") && normalized.includes("GROUP BY app_version")) {
              return { results: zero ? [] : [{ key: "1.4.1", events: 4 }] };
            }
            if (normalized.includes("FROM health_checks")) {
              return { results: healthRows ?? (zero ? [] : [
                { target: "manifest", ok: 1, status_code: 200, latency_ms: 2, checked_at: "2026-08-08T12:00:00.000Z", note: null },
                { target: "release_artifact", ok: 1, status_code: 200, latency_ms: 2, checked_at: "2026-08-08T12:00:00.000Z", note: null },
                { target: "release_artifact_range", ok: 0, status_code: 500, latency_ms: 2, checked_at: "2026-08-08T12:00:00.000Z", note: "retired target" },
              ]) };
            }
            if (normalized.includes("FROM early_access_leads")) {
              return { results: leadRows ?? defaultLeadRows({ zero, watermark }) };
            }
            return { results: [] };
          });
        },
        async run() {
          return execute(normalized, () => {
            runLog.push({ sql: normalized, args: [...args] });
            return { success: true, meta: { changes: 1 } };
          });
        },
      };
      return api;
    },
  };
}

function ceoEnv(options = {}) {
  const db = options.db ?? makeCeoDb(options);
  return {
    DB: db,
    BUSCORE_LEADS_DB: options.withoutLeads ? undefined : db,
    MANIFEST_R2: {},
    ADMIN_TOKEN: "secret",
    IGNORED_IP: "",
    CF_API_TOKEN: "",
    CF_ZONE_TAG: "",
  };
}

function assertSchemaValid(value, validate, label) {
  assert.equal(validate(value), true, `${label}: ${JSON.stringify(validate.errors)}`);
}

test("CEO report routing is additive and protected", async () => {
  assert.equal(normalizeReportView("ceo"), "ceo");
  assert.deepEqual(resolveReportRequest(new URL("https://lighthouse.test/report?view=ceo")), {
    ok: true,
    view: "ceo",
  });

  const unauthorized = await worker.fetch(
    new Request("https://lighthouse.test/report?view=ceo"),
    ceoEnv(),
    ctx
  );
  assert.equal(unauthorized.status, 401);

  const response = await worker.fetch(
    new Request("https://lighthouse.test/report?view=ceo", { headers: { "X-Admin-Token": "secret" } }),
    ceoEnv(),
    ctx
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.view, "ceo");
  assert.equal(payload.report_contract_version, "1.0");
  assert.equal(payload.metric_definition_version, "1.0");

  const wrongMethod = await worker.fetch(
    new Request("https://lighthouse.test/report?view=ceo", {
      method: "POST",
      headers: { "X-Admin-Token": "secret" },
    }),
    ceoEnv(),
    ctx
  );
  assert.equal(wrongMethod.status, 405);
});

test("CEO windows use today partial and only completed UTC days for comparisons", () => {
  const { windows, ranges } = buildCeoReportWindows(new Date("2026-08-08T22:00:00.000Z"));
  assert.deepEqual(windows.today, {
    start_at: "2026-08-08T00:00:00.000Z",
    end_at: "2026-08-08T22:00:00.000Z",
    complete: false,
  });
  assert.deepEqual(windows.latest_complete_day, {
    start_at: "2026-08-07T00:00:00.000Z",
    end_at: "2026-08-08T00:00:00.000Z",
    complete: true,
  });
  assert.equal(windows.last_7_complete_days.start_at, "2026-08-01T00:00:00.000Z");
  assert.equal(windows.previous_7_complete_days.start_at, "2026-07-25T00:00:00.000Z");
  assert.equal(windows.previous_7_complete_days.end_at, "2026-08-01T00:00:00.000Z");
  assert.equal(windows.last_30_complete_days.start_at, "2026-07-09T00:00:00.000Z");
  assert.equal(ranges.previous_7_complete_days.end_day, "2026-07-31");
});

test("product telemetry exposes an arbitrary inclusive UTC-day window", async () => {
  const boundWindows = [];
  const db = {
    prepare() {
      const statement = {
        bind(...values) { boundWindows.push(values); return statement; },
        async first() { return { events: 0 }; },
        async all() { return { results: [] }; },
      };
      return statement;
    },
  };

  const window = await buildBuscoreProductTelemetryWindow(db, "2026-07-25", "2026-07-31");
  assert.equal(window.total_events, 0);
  assert.equal(boundWindows.length, 6);
  assert.deepEqual([...new Set(boundWindows.map((values) => values.join("/")))], ["2026-07-25/2026-07-31"]);
});

test("CEO metrics use literal sources, page_view only, exact lead rows, and all seven product failures", async () => {
  const sqlLog = [];
  const db = makeCeoDb({ sqlLog });
  const report = await buildCeoReport(db, db, new Date("2026-08-08T22:00:00.000Z"));

  assert.equal(report.bus_core.site_page_views.latest_complete_day, 3);
  assert.equal(report.bus_core.possible_download_interest_actions.latest_complete_day, 1);
  assert.equal(report.bus_core.full_artifact_responses_offered.latest_complete_day, 104);
  assert.equal(report.bus_core.daily_source_credits.latest_complete_day, 100);
  assert.equal(report.bus_core.known_version_check_requests.latest_complete_day, 4);
  assert.equal(report.bus_core.update_check_reconciliation_delta.latest_complete_day, 1);
  assert.equal(report.bus_core.acknowledged_first_launches.latest_complete_day, 1);
  assert.equal(report.bus_core.acknowledged_workflow_milestones.latest_complete_day, 2);
  assert.equal(report.bus_core.acknowledged_product_failures.latest_complete_day, 14);
  assert.deepEqual(report.details.recent_product_failures_by_name.map((row) => row.name), PRODUCT_FAILURE_NAMES);
  assert.deepEqual(report.details.recent_product_failures_by_name.map((row) => row.count), Array(7).fill(3));
  assert.equal(report.business.tgc_consented_page_views.latest_complete_day, 4);
  assert.equal(report.business.voluntary_inquiries.latest_complete_day, 2);
  assert.deepEqual(report.business.inquiry_sources_last_7_complete_days, [{ source: "reddit", count: 2 }]);
  assert.equal(report.details.service_probes.some((row) => row.target === "release_artifact_range"), false);
  assert.equal(report.sources.artifact_delivery.coverage.today, "partial");
  assert.equal(report.sources.artifact_delivery.coverage.latest_complete_day, "full");
  assert.equal(report.sources.artifact_delivery.coverage.last_30_complete_days, "partial");
  assert.ok(sqlLog.some((sql) => sql.includes("event_name = 'page_view'")));
  assert.equal(sqlLog.some((sql) => /top_paths|GROUP BY path/.test(sql)), false);
  const productSql = sqlLog.filter((sql) => sql.includes("FROM buscore_product_events_daily"));
  assert.equal(productSql.length, 2, "product telemetry is one fixed aggregate plus one bounded version query");
  assert.match(productSql.find((sql) => sql.includes("product_failures_today")), /SUM\(CASE WHEN day >=/);
  assert.match(productSql.find((sql) => sql.includes("GROUP BY app_version")), /ORDER BY events DESC, key ASC LIMIT 10/);
  assert.equal(productSql.some((sql) => /GROUP BY day, category, event_name, app_version/.test(sql)), false);
});

test("CEO report stays far below D1 Free query and simultaneous connection limits", async () => {
  const tracker = { count: 0, active: 0, peak: 0 };
  const db = makeCeoDb({ tracker });

  await buildCeoReport(db, db, new Date("2026-08-08T22:00:00.000Z"));

  assert.equal(tracker.count, 9, "eight Lighthouse statements plus one optional leads statement");
  assert.ok(tracker.count <= 12, "keep meaningful headroom below the 50-statement Free limit");
  assert.equal(tracker.peak, 3, "source batches never approach the six-connection limit");
});

test("inquiry attribution is a fixed privacy bucket and never a raw label", async () => {
  const rawLabels = [
    "ceo.person@example.com",
    "https://private.example/users/alice?token=secret",
    "550e8400-e29b-41d4-a716-446655440000",
  ];
  const leadRows = rawLabels.map((source, index) => ({
    source,
    count_today: 0,
    count_latest_complete_day: 1,
    count_last_7_complete_days: 1,
    count_previous_7_complete_days: 0,
    count_last_30_complete_days: 1,
    data_through: `2026-08-08T12:00:0${index}.000Z`,
  }));
  const sqlLog = [];
  const db = makeCeoDb({ leadRows, sqlLog });
  const report = await buildCeoReport(db, db, new Date("2026-08-08T22:00:00.000Z"));
  const serialized = JSON.stringify(report);

  assert.deepEqual(report.business.inquiry_sources_last_7_complete_days, [{ source: "other", count: 3 }]);
  assert.equal(report.business.voluntary_inquiries.last_7_complete_days, 3);
  for (const raw of rawLabels) assert.equal(serialized.includes(raw), false);
  const leadSql = sqlLog.find((sql) => sql.includes("FROM early_access_leads"));
  assert.match(leadSql, /CASE .* ELSE 'other' END/);
  assert.match(leadSql, /GROUP BY source/);
});

test("service probes remain explicitly incomplete until every active target has run", async () => {
  const db = makeCeoDb();
  const report = await buildCeoReport(db, db, new Date("2026-08-08T22:00:00.000Z"));

  assert.equal(report.sources.service_probes.availability, "unavailable");
  assert.equal(report.sources.service_probes.freshness, "unknown");
  assert.equal(report.sources.service_probes.data_through, null);
  assert.equal(report.sources.service_probes.reason_code, "probe_history_missing");
  assert.equal(report.sources.service_probes.coverage.today, "unavailable");
});

test("service probe freshness uses the oldest required target watermark", async () => {
  const healthRows = [
    { target: "site_home", checked_at: "2026-08-08T21:00:00.000Z" },
    { target: "site_downloads", checked_at: "2026-08-08T21:00:00.000Z" },
    { target: "manifest", checked_at: "2026-08-08T21:00:00.000Z" },
    { target: "release_artifact", checked_at: "2026-08-06T00:00:00.000Z" },
    { target: "lead_endpoint", checked_at: "2026-08-08T21:00:00.000Z" },
    { target: "github_release", checked_at: "2026-08-08T21:00:00.000Z" },
  ].map((row) => ({ ...row, ok: 1, status_code: 200, latency_ms: 2, note: null }));
  const db = makeCeoDb({ healthRows });
  const report = await buildCeoReport(db, db, new Date("2026-08-08T22:00:00.000Z"));

  assert.equal(report.sources.service_probes.availability, "available");
  assert.equal(report.sources.service_probes.freshness, "stale");
  assert.equal(report.sources.service_probes.data_through, "2026-08-06T00:00:00.000Z");
  assert.equal(report.sources.service_probes.reason_code, "probe_data_stale");
  assert.equal(report.sources.service_probes.coverage.today, "partial");
});

test("successful empty queries are zero while an unavailable source is null", async () => {
  const emptyDb = makeCeoDb({ zero: true });
  const empty = await buildCeoReport(emptyDb, emptyDb, new Date("2026-08-08T22:00:00.000Z"));
  assert.equal(empty.sources.artifact_delivery.availability, "available");
  assert.equal(empty.sources.artifact_delivery.freshness, "unknown");
  assert.equal(empty.sources.artifact_delivery.data_through, null);
  assert.equal(empty.sources.artifact_delivery.reason_code, "source_history_missing");
  assert.deepEqual(Object.values(empty.sources.artifact_delivery.coverage), Array(5).fill("partial"));
  assert.equal(empty.bus_core.full_artifact_responses_offered.latest_complete_day, 0);

  const failingDb = makeCeoDb({ failPattern: "FROM artifact_traffic_daily" });
  const partial = await buildCeoReport(failingDb, failingDb, new Date("2026-08-08T22:00:00.000Z"));
  assert.equal(partial.sources.artifact_delivery.availability, "unavailable");
  assert.equal(partial.sources.artifact_delivery.reason_code, "query_failed");
  assert.equal(partial.bus_core.full_artifact_responses_offered.latest_complete_day, null);
  assert.equal(partial.bus_core.artifact_response_failures.today, null);
  assert.equal(partial.bus_core.site_page_views.latest_complete_day, 3, "other sources stay available");
});

test("an old direct-source watermark fails closed as stale without erasing observed counts", async () => {
  const sqlLog = [];
  const db = makeCeoDb({ watermark: "2026-08-01", sqlLog });
  const report = await buildCeoReport(db, db, new Date("2026-08-08T22:00:00.000Z"));

  assert.equal(report.sources.artifact_delivery.availability, "available");
  assert.equal(report.sources.artifact_delivery.freshness, "stale");
  assert.equal(report.sources.artifact_delivery.data_through, "2026-08-01T23:59:59.999Z");
  assert.equal(report.sources.artifact_delivery.reason_code, "source_data_stale");
  assert.equal(report.bus_core.full_artifact_responses_offered.latest_complete_day, 104);
  for (const source of ["update_checks", "buscore_site", "tgc_site", "lighthouse_errors"]) {
    assert.equal(report.sources[source].freshness, "stale", `${source} must retain an all-history watermark`);
    assert.equal(report.sources[source].reason_code, "source_data_stale");
  }
  assert.ok(sqlLog.some((sql) => sql.includes("SELECT MAX(received_at) FROM matching_pageviews")));
  assert.ok(sqlLog.some((sql) => sql.includes("SELECT MAX(day) FROM release_update_checks_daily")));
  assert.ok(sqlLog.some((sql) => sql.includes("SELECT MAX(day) FROM metrics_daily")));
});

test("missing voluntary inquiry binding is explicit and never rendered as zero", async () => {
  const db = makeCeoDb();
  const report = await buildCeoReport(db, undefined, new Date("2026-08-08T22:00:00.000Z"));
  assert.equal(report.sources.voluntary_inquiries.availability, "unavailable");
  assert.equal(report.sources.voluntary_inquiries.reason_code, "binding_not_configured");
  assert.equal(report.business.voluntary_inquiries.latest_complete_day, null);
  assert.deepEqual(report.business.inquiry_sources_last_7_complete_days, []);
});

test("strict CEO schema accepts every fixture and representative live producer state", async () => {
  const contractDir = new URL("../contracts/ceo-v1/", import.meta.url);
  const schema = JSON.parse(readFileSync(new URL("report.schema.json", contractDir), "utf8"));
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const fixtureNames = readdirSync(contractDir)
    .filter((name) => name.endsWith(".json") && name !== "report.schema.json")
    .sort();
  for (const name of fixtureNames) {
    assertSchemaValid(JSON.parse(readFileSync(new URL(name, contractDir), "utf8")), validate, `fixture ${name}`);
  }

  const now = new Date("2026-08-08T22:00:00.000Z");
  const currentDb = makeCeoDb({ includeProductFailures: false });
  const missingLeadsDb = makeCeoDb({ includeProductFailures: false });
  const runtimeReports = [
    ["healthy-zero", await buildCeoReport(makeCeoDb({ zero: true }), makeCeoDb({ zero: true }), now)],
    ["current", await buildCeoReport(currentDb, currentDb, now)],
    ["missing-leads", await buildCeoReport(missingLeadsDb, undefined, now)],
    ["product-failure", await buildCeoReport(makeCeoDb(), makeCeoDb(), now)],
    ["core-source-failure", await buildCeoReport(
      makeCeoDb({ failPattern: "FROM artifact_traffic_daily" }),
      makeCeoDb(),
      now
    )],
  ];
  for (const [label, report] of runtimeReports) assertSchemaValid(report, validate, `runtime ${label}`);

  const base = structuredClone(runtimeReports[1][1]);
  const extra = structuredClone(base);
  extra.uncontracted = true;
  const badUuid = structuredClone(base);
  badUuid.report_id = "not-a-uuid";
  const badDate = structuredClone(base);
  badDate.generated_at = "not-a-date";
  const rawSource = structuredClone(base);
  rawSource.business.inquiry_sources_last_7_complete_days = [{ source: "person@example.com", count: 1 }];
  const freshUnavailable = structuredClone(base);
  freshUnavailable.sources.artifact_delivery.availability = "unavailable";
  const freshNullWatermark = structuredClone(base);
  freshNullWatermark.sources.artifact_delivery.data_through = null;
  const freshReason = structuredClone(base);
  freshReason.sources.artifact_delivery.reason_code = "source_history_missing";
  const staleBadReason = structuredClone(base);
  staleBadReason.sources.artifact_delivery.freshness = "stale";
  staleBadReason.sources.artifact_delivery.reason_code = "query_failed";
  const staleNullWatermark = structuredClone(base);
  staleNullWatermark.sources.artifact_delivery.freshness = "stale";
  staleNullWatermark.sources.artifact_delivery.data_through = null;
  staleNullWatermark.sources.artifact_delivery.reason_code = "source_data_stale";
  const unknownFull = structuredClone(runtimeReports[0][1]);
  unknownFull.sources.artifact_delivery.coverage.latest_complete_day = "full";
  const unavailablePartial = structuredClone(runtimeReports[4][1]);
  unavailablePartial.sources.artifact_delivery.coverage.today = "partial";
  const unavailableStaleReason = structuredClone(runtimeReports[4][1]);
  unavailableStaleReason.sources.artifact_delivery.reason_code = "source_data_stale";
  for (const [label, invalid] of [
    ["extra", extra],
    ["uuid", badUuid],
    ["date", badDate],
    ["raw source", rawSource],
    ["fresh unavailable", freshUnavailable],
    ["fresh null watermark", freshNullWatermark],
    ["fresh non-null reason", freshReason],
    ["stale invalid reason", staleBadReason],
    ["stale null watermark", staleNullWatermark],
    ["unknown full coverage", unknownFull],
    ["unavailable partial coverage", unavailablePartial],
    ["unavailable stale reason", unavailableStaleReason],
  ]) {
    assert.equal(validate(invalid), false, `${label} must fail strict schema validation`);
  }
});

test("health checks exercise only non-counted public manifest GET and artifact HEAD routes", async () => {
  const fetched = [];
  const sqlLog = [];
  const originalFetch = global.fetch;
  const manifest = {
    latest: { version: "1.4.1", download: { url: "/releases/BUS-Core-1.4.1.zip" } },
  };
  global.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";
    fetched.push({ url, method });
    if (url.endsWith("/manifest/core/stable.json")) {
      return Response.json(manifest, { status: 200 });
    }
    if (url.endsWith("/releases/BUS-Core-1.4.1.zip")) {
      return new Response(null, { status: 200, headers: { "Content-Length": "123" } });
    }
    return new Response(null, { status: url.includes("github.com") ? 200 : 204 });
  };
  const env = {
    DB: makeCeoDb({ sqlLog }),
    MANIFEST_R2: {},
    ADMIN_TOKEN: "secret",
    IGNORED_IP: "",
    CF_API_TOKEN: "",
    CF_ZONE_TAG: "",
  };

  try {
    await runHealthChecks(env);
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(fetched.some(({ url }) => url.includes("lighthouse.buscore.ca/download/latest")), false);
  assert.equal(fetched.some(({ url }) => url.includes("/update/check")), false);
  assert.equal(fetched.filter(({ url, method }) => url.endsWith("/manifest/core/stable.json") && method === "GET").length, 2);
  assert.deepEqual(
    fetched.filter(({ url }) => url.includes("lighthouse.buscore.ca/releases/")),
    [{ url: "https://lighthouse.buscore.ca/releases/BUS-Core-1.4.1.zip", method: "HEAD" }]
  );
  assert.equal(sqlLog.some((sql) => /artifact_traffic_daily|buscore_download_intent_daily|metrics_daily/.test(sql)), false);
  assert.ok(sqlLog.some((sql) => sql.includes("INSERT INTO health_checks")));
});

test("health checks reject a 404 lead route and a zero-byte public artifact", async () => {
  const runLog = [];
  const originalFetch = global.fetch;
  const manifest = { latest: { version: "1.4.1", download: { url: "/releases/BUS-Core-1.4.1.zip" } } };
  global.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/manifest/core/stable.json")) return Response.json(manifest);
    if (url.endsWith("/releases/BUS-Core-1.4.1.zip")) {
      return new Response(null, { status: 200, headers: { "Content-Length": "0" } });
    }
    if (url.endsWith("/api/early-access")) return new Response(null, { status: 404 });
    return new Response(null, { status: url.includes("github.com") ? 200 : 204 });
  };
  try {
    await runHealthChecks({
      DB: makeCeoDb({ runLog }),
      MANIFEST_R2: {},
      ADMIN_TOKEN: "secret",
      IGNORED_IP: "",
      CF_API_TOKEN: "",
      CF_ZONE_TAG: "",
    });
  } finally {
    global.fetch = originalFetch;
  }

  const inserted = new Map(
    runLog.filter((row) => row.sql.includes("INSERT INTO health_checks"))
      .map((row) => [row.args[2], { ok: row.args[3], status: row.args[4] }])
  );
  assert.deepEqual(inserted.get("release_artifact"), { ok: 0, status: 200 });
  assert.deepEqual(inserted.get("lead_endpoint"), { ok: 0, status: 404 });
});

test("public artifact HEAD proves routing without changing any CEO artifact metric", async () => {
  const runLog = [];
  const pending = [];
  const env = {
    DB: makeCeoDb({ runLog }),
    MANIFEST_R2: {
      async head(key) {
        assert.equal(key, "releases/BUS-Core-1.4.1.zip");
        return {
          size: 123,
          httpEtag: '"etag"',
          writeHttpMetadata() {},
        };
      },
    },
    ADMIN_TOKEN: "secret",
    IGNORED_IP: "",
    CF_API_TOKEN: "",
    CF_ZONE_TAG: "",
  };
  const response = await worker.fetch(
    new Request("https://lighthouse.buscore.ca/releases/BUS-Core-1.4.1.zip", { method: "HEAD" }),
    env,
    { waitUntil(promise) { pending.push(promise); } }
  );
  await Promise.all(pending);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Length"), "123");
  const artifactWrite = runLog.find((row) => row.sql.includes("INSERT INTO artifact_traffic_daily"));
  assert.ok(artifactWrite);
  assert.equal(artifactWrite.args[5], 0, "full responses");
  assert.equal(artifactWrite.args[9], 0, "failed responses");
  assert.equal(artifactWrite.args[11], 0, "daily source credits");
  assert.equal(artifactWrite.args[12], 0, "repeated full responses");
  assert.equal(artifactWrite.args[13], 0, "limited artifact requests");
  assert.equal(runLog.some((row) => /metrics_daily|release_downloads_daily|buscore_download_intent_daily/.test(row.sql)), false);

  const failedRunLog = [];
  const failedPending = [];
  const failed = await worker.fetch(
    new Request("https://lighthouse.buscore.ca/releases/BUS-Core-1.4.1.zip", { method: "HEAD" }),
    {
      ...env,
      DB: makeCeoDb({ runLog: failedRunLog }),
      MANIFEST_R2: { async head() { return null; } },
    },
    { waitUntil(promise) { failedPending.push(promise); } }
  );
  await Promise.all(failedPending);
  assert.equal(failed.status, 404);
  const failedArtifactWrite = failedRunLog.find((row) => row.sql.includes("INSERT INTO artifact_traffic_daily"));
  assert.ok(failedArtifactWrite);
  assert.equal(failedArtifactWrite.args[7], 1, "failed HEAD remains visible as metadata traffic");
  assert.equal(failedArtifactWrite.args[9], 0, "failed HEAD cannot pollute CEO artifact failures");
  assert.equal(failedArtifactWrite.args[11], 0, "failed HEAD cannot create a daily source credit");
});

test("Worker config forces same-zone health fetches through Cloudflare's public front door", () => {
  const wrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.match(wrangler, /compatibility_flags\s*=\s*\[[^\]]*"global_fetch_strictly_public"[^\]]*\]/);
});
