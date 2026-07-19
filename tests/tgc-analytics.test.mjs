import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  normalizeReportView,
  resolveReportRequest,
  parseCanonicalEventPayload,
  sanitizeAnalyticsLocation,
} from "../dist/index.js";

function payload(overrides = {}) {
  return {
    type: "event",
    site_key: "tgc_site",
    event_name: "page_view",
    client_ts: "2026-07-18T12:00:00.000Z",
    path: "/services.html",
    url: "https://truegoodcraft.ca/services.html?utm_source=test#offers",
    referrer: "https://example.com/article?person=value",
    src: "newsletter",
    utm: { source: "newsletter", medium: "email", campaign: "summer" },
    device: "desktop",
    viewport: "1440x900",
    lang: "en-CA",
    tz: "America/Toronto",
    anon_user_id: "v_a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    session_id: "s_1eebc999-9c0b-4ef8-bb6d-6bb9bd380a11",
    is_new_user: true,
    event_value: "services",
    test_mode: false,
    ...overrides,
  };
}

test("TGC report view resolves without a site key", () => {
  assert.equal(normalizeReportView("tgc"), "tgc");
  assert.deepEqual(resolveReportRequest(new URL("https://lighthouse.test/report?view=tgc")), {
    ok: true,
    view: "tgc",
  });
});

test("TGC payload accepts consent-created IDs and strips URL detail", () => {
  const parsed = parseCanonicalEventPayload(payload());
  assert.ok(parsed);
  assert.equal(parsed.url, "https://truegoodcraft.ca/services.html");
  assert.equal(parsed.referrer, "https://example.com/article");
  assert.equal(parsed.anon_user_id, "v_a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
  assert.equal(parsed.session_id, "s_1eebc999-9c0b-4ef8-bb6d-6bb9bd380a11");
});

test("TGC payload rejects unknown events, mismatched paths, and foreign origins", () => {
  assert.equal(parseCanonicalEventPayload(payload({ event_name: "capture_everything" })), null);
  assert.equal(parseCanonicalEventPayload(payload({ path: "/contact.html" })), null);
  assert.equal(parseCanonicalEventPayload(payload({ url: "https://evil.example/services.html" })), null);
});

test("analytics location permits only HTTP(S) origin and path", () => {
  assert.equal(sanitizeAnalyticsLocation("https://truegoodcraft.ca/a?x=1#b"), "https://truegoodcraft.ca/a");
  assert.equal(sanitizeAnalyticsLocation("javascript:alert(1)"), null);
  assert.equal(sanitizeAnalyticsLocation("", true), "");
});

test("source declares bounded retention and no raw request identifiers for TGC events", () => {
  const source = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.match(source, /TGC_SITE_EVENT_RAW_RETENTION_DAYS = 90/);
  assert.match(source, /SITE_EVENT_RATE_LIMIT_RETENTION_DAYS = 2/);
  assert.match(source, /ip_hash: null/);
  assert.match(source, /user_agent_hash: null/);
  assert.match(source, /request_id: null/);
  assert.match(source, /view: "tgc" as const/);
  assert.match(source, /identifiers_exposed: false/);
});
