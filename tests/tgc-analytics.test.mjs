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
    viewport: "medium",
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

test("TGC payload discards superseded identity and strips URL detail", () => {
  const parsed = parseCanonicalEventPayload(payload());
  assert.ok(parsed);
  assert.equal(parsed.url, "https://truegoodcraft.ca/services.html");
  assert.equal(parsed.referrer, "https://example.com/article");
  assert.equal(parsed.anon_user_id, null);
  assert.equal(parsed.session_id, null);
  assert.equal(parsed.is_new_user, 0);
  assert.equal(parsed.viewport, "medium");
  assert.equal(parsed.event_value, null);
});

test("TGC stores coarse viewport buckets while accepting the rolling exact-dimension producer", () => {
  for (const viewport of ["small", "medium", "large"]) {
    assert.equal(parseCanonicalEventPayload(payload({ viewport }))?.viewport, viewport);
  }
  assert.equal(parseCanonicalEventPayload(payload({ viewport: "767x900" }))?.viewport, "small");
  assert.equal(parseCanonicalEventPayload(payload({ viewport: "768x900" }))?.viewport, "medium");
  assert.equal(parseCanonicalEventPayload(payload({ viewport: "1199x900" }))?.viewport, "medium");
  assert.equal(parseCanonicalEventPayload(payload({ viewport: "1200x900" }))?.viewport, "large");
  assert.equal(parseCanonicalEventPayload(payload({ viewport: "1440x900" }))?.viewport, "large");
  assert.equal(parseCanonicalEventPayload(payload({ viewport: "wide" })), null);

  const buscore = parseCanonicalEventPayload(payload({
    site_key: "buscore",
    path: "/downloads",
    url: "https://buscore.ca/downloads",
    viewport: "1440x900",
  }));
  assert.equal(buscore?.viewport, "1440x900");
});

test("TGC event values are reduced to event-specific safe enums", () => {
  assert.equal(parseCanonicalEventPayload(payload({
    event_name: "form_start",
    event_value: "audit-form",
  }))?.event_value, "audit");
  assert.equal(parseCanonicalEventPayload(payload({
    event_name: "form_submit_failure",
    event_value: "person@example.com typed this",
  }))?.event_value, "other");
  assert.equal(parseCanonicalEventPayload(payload({
    event_name: "js_error",
    event_value: "unhandled_rejection",
  }))?.event_value, "unhandled_rejection");
  assert.equal(parseCanonicalEventPayload(payload({
    event_name: "js_error",
    event_value: "ReferenceError at /private/person@example.com",
  }))?.event_value, "other");
  assert.equal(parseCanonicalEventPayload(payload({
    event_name: "outbound_click",
    event_value: "https://private.example/users/alice",
  }))?.event_value, "other");
  assert.equal(parseCanonicalEventPayload(payload({
    event_name: "services_interest",
    event_value: "person@example.com",
  }))?.event_value, null);
});

test("TGC payload rejects unknown events, mismatched paths, and foreign origins", () => {
  assert.equal(parseCanonicalEventPayload(payload({ event_name: "capture_everything" })), null);
  assert.equal(parseCanonicalEventPayload(payload({ event_name: "scroll_depth" })), null);
  assert.equal(parseCanonicalEventPayload(payload({ event_name: "form_field_complete" })), null);
  assert.equal(parseCanonicalEventPayload(payload({ event_name: "web_vital_lcp_ms" })), null);
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
  assert.match(source, /UPDATE site_events_raw SET ip_hash = NULL, user_agent_hash = NULL, request_id = NULL/);
  assert.match(source, /view: "tgc" as const/);
  assert.match(source, /identifiers_exposed: false/);
});
