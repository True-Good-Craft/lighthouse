import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeReportView,
  resolveReportRequest,
  assembleLegacyReport,
  assembleFleetReport,
  assembleSiteReport,
  assembleSourceHealthReport,
  CANONICAL_SHARED_EVENT_TAXONOMY,
  normalizeEventNameToCanonicalShared,
  classifyEventNameAgainstTaxonomy,
  normalizeEventNameForReporting,
  supportClassForSite,
  sectionAvailabilityForSupportClass,
  computeAcceptedSignal7d,
  hasRecentSignalFromAcceptedSignal7d,
  supportsIdentityForSite,
} from "../dist/index.js";

test("normalizeReportView keeps bare /report on the legacy contract", () => {
  assert.equal(normalizeReportView(null), "legacy");
  assert.equal(normalizeReportView(""), "legacy");
  assert.equal(normalizeReportView("fleet"), "fleet");
  assert.equal(normalizeReportView("source_health"), "source_health");
  assert.equal(normalizeReportView("bogus"), null);
});

test("resolveReportRequest rejects invalid view", () => {
  const resolved = resolveReportRequest(new URL("https://example.test/report?view=bogus"));
  assert.deepEqual(resolved, { ok: false, error: "invalid_view" });
});

test("resolveReportRequest rejects site view without site_key", () => {
  const resolved = resolveReportRequest(new URL("https://example.test/report?view=site"));
  assert.deepEqual(resolved, { ok: false, error: "missing_site_key" });
});

test("resolveReportRequest rejects site view with unknown site_key", () => {
  const resolved = resolveReportRequest(
    new URL("https://example.test/report?view=site&site_key=unknown_property")
  );
  assert.deepEqual(resolved, { ok: false, error: "invalid_site_key" });
});

test("assembleLegacyReport preserves the legacy top-level shape", () => {
  const payload = assembleLegacyReport({
    today: { update_checks: 1, downloads: 2, errors: 0 },
    yesterday: { update_checks: 3, downloads: 4, errors: 0 },
    last7Days: { update_checks: 5, downloads: 6, errors: 0 },
    previous7Days: { update_checks: 2, downloads: 3, errors: 0 },
    monthToDate: { update_checks: 7, downloads: 8, errors: 0 },
    latestTraffic: {
      day: "2026-04-07",
      visits: 12,
      requests: 34,
      captured_at: "2026-04-08T00:05:00.000Z",
    },
    last7Traffic: { row_count: 1, visits: 12, requests: 34 },
    humanToday: { pageviews: 9, last_received_at: "2026-04-08T12:00:00.000Z" },
    humanLast7: { pageviews: 11, days_with_data: 2 },
    humanObservability: {
      accepted: 11,
      dropped_rate_limited: 1,
      dropped_invalid: 2,
      last_received_at: "2026-04-08T12:00:00.000Z",
    },
    topPaths: [{ value: "/", pageviews: 11 }],
    topReferrers: [{ value: "google.com", pageviews: 7 }],
    topSources: [{ source: "github", pageviews: 5 }],
    identity: {
      today: { new_users: 1, returning_users: 2, sessions: 3 },
      last_7_days: { new_users: 4, returning_users: 5, sessions: 6, return_rate: 0.5 },
      top_sources_by_returning_users: [{ source: "github", users: 2 }],
    },
    siteEvents: null,
  });

  assert.deepEqual(Object.keys(payload), [
    "today",
    "yesterday",
    "last_7_days",
    "month_to_date",
    "trends",
    "traffic",
    "human_traffic",
    "identity",
    "site_events",
  ]);
  assert.equal("view" in payload, false);
});

test("assembleFleetReport returns the fleet view shape", () => {
  const payload = assembleFleetReport({
    generated_at: "2026-04-08T12:00:00.000Z",
    sites: [
      {
        site_key: "buscore",
        label: "BUS Core",
        status: "active",
        backend_source: "pageview_daily+site_events_raw+buscore_traffic_daily",
        cloudflare_traffic_enabled: true,
        production_hosts: ["buscore.ca"],
        last_received_at: "2026-04-08T11:00:00.000Z",
        accepted_events_7d: 1,
        pageviews_7d: 2,
        traffic_requests_7d: 3,
        traffic_visits_7d: 4,
        has_recent_signal: true,
      },
    ],
  });

  assert.equal(payload.view, "fleet");
  assert.equal(typeof payload.generated_at, "string");
  assert.equal(Array.isArray(payload.sites), true);
  assert.deepEqual(Object.keys(payload.sites[0]), [
    "site_key",
    "label",
    "status",
    "backend_source",
    "cloudflare_traffic_enabled",
    "production_hosts",
    "last_received_at",
    "accepted_events_7d",
    "pageviews_7d",
    "traffic_requests_7d",
    "traffic_visits_7d",
    "has_recent_signal",
  ]);
});

test("assembleSourceHealthReport returns the source health shape", () => {
  const payload = assembleSourceHealthReport({
    generated_at: "2026-04-08T12:00:00.000Z",
    sites: [
      {
        site_key: "tgc_site",
        label: "True Good Craft",
        backend_source: "site_events_raw",
        cloudflare_traffic_enabled: false,
        production_only_default: true,
        last_received_at: null,
        accepted_signal_7d: 0,
        dropped_invalid: null,
        dropped_rate_limited: 0,
      },
    ],
  });

  assert.equal(payload.view, "source_health");
  assert.equal(typeof payload.generated_at, "string");
  assert.equal(Array.isArray(payload.sites), true);
  assert.deepEqual(Object.keys(payload.sites[0]), [
    "site_key",
    "label",
    "backend_source",
    "cloudflare_traffic_enabled",
    "production_only_default",
    "last_received_at",
    "accepted_signal_7d",
    "dropped_invalid",
    "dropped_rate_limited",
  ]);
});

test("canonical shared event taxonomy is frozen", () => {
  assert.deepEqual(CANONICAL_SHARED_EVENT_TAXONOMY, [
    "page_view",
    "outbound_click",
    "contact_click",
    "service_interest",
  ]);
});

test("event taxonomy helper normalizes aliases while preserving extension names", () => {
  assert.equal(normalizeEventNameToCanonicalShared("page_view"), "page_view");
  assert.equal(normalizeEventNameToCanonicalShared("pageview"), "page_view");
  assert.equal(normalizeEventNameToCanonicalShared("link_click"), "outbound_click");
  assert.equal(classifyEventNameAgainstTaxonomy("service_interest"), "shared");
  assert.equal(classifyEventNameAgainstTaxonomy("generator_complete"), "extension");
  assert.equal(classifyEventNameAgainstTaxonomy("  "), "invalid");
  assert.equal(normalizeEventNameForReporting("  generator_complete "), "generator_complete");
});

test("support class and section availability remain deterministic", () => {
  const legacyClass = supportClassForSite({
    status: "active",
    cloudflare_traffic_enabled: true,
    site_key: "buscore",
  });
  assert.equal(legacyClass, "legacy_hybrid");
  assert.equal(sectionAvailabilityForSupportClass(legacyClass).identity, true);

  const eventOnlyClass = supportClassForSite({
    status: "active",
    cloudflare_traffic_enabled: false,
    site_key: "star_map_generator",
  });
  assert.equal(eventOnlyClass, "event_only");
  assert.equal(sectionAvailabilityForSupportClass(eventOnlyClass).traffic, false);
  assert.equal(sectionAvailabilityForSupportClass(eventOnlyClass).identity, false);

  assert.equal(
    supportClassForSite({ status: "staging", cloudflare_traffic_enabled: false, site_key: "new_site" }),
    "not_yet_normalized"
  );
});

test("shared signal semantics helpers stay aligned", () => {
  assert.equal(computeAcceptedSignal7d({ acceptedEvents7d: 3, pageviews7d: null }), 3);
  assert.equal(computeAcceptedSignal7d({ acceptedEvents7d: 3, pageviews7d: 7 }), 10);
  assert.equal(hasRecentSignalFromAcceptedSignal7d(0), false);
  assert.equal(hasRecentSignalFromAcceptedSignal7d(1), true);
});

test("site support helper keeps identity BUS Core-only", () => {
  assert.equal(
    supportsIdentityForSite({ status: "active", cloudflare_traffic_enabled: true, site_key: "buscore" }),
    true
  );
  assert.equal(
    supportsIdentityForSite({ status: "active", cloudflare_traffic_enabled: false, site_key: "tgc_site" }),
    false
  );
});

test("assembleSiteReport includes support metadata and explicit null identity for event-only sites", () => {
  const payload = assembleSiteReport({
    generated_at: "2026-04-08T12:00:00.000Z",
    scope: {
      site_key: "star_map_generator",
      label: "Star Map Generator",
      status: "active",
      backend_source: "site_events_raw",
      window: {
        start_day: "2026-04-02",
        end_day: "2026-04-08",
        timezone: "UTC",
        semantics: "current_utc_day_plus_previous_6_days",
      },
      exclude_test_mode: true,
      production_only: true,
      support_class: "event_only",
      section_availability: {
        summary: true,
        today: true,
        traffic: false,
        human_traffic_events: true,
        observability: true,
        identity: false,
        read: true,
      },
    },
    summary: {
      accepted_events_7d: 8,
      pageviews_7d: null,
      traffic_requests_7d: null,
      traffic_visits_7d: null,
      last_received_at: "2026-04-08T10:00:00.000Z",
      has_recent_signal: true,
    },
    traffic: {
      cloudflare_traffic_enabled: false,
      latest_day: { day: null, visits: null, requests: null, captured_at: null },
      last_7_days: {
        visits: null,
        requests: null,
        avg_daily_visits: null,
        avg_daily_requests: null,
        days_with_data: 0,
      },
    },
    events: {
      accepted_events: 8,
      unique_paths: 3,
      by_event_name: [{ event_name: "page_view", events: 8 }],
      top_sources: [{ source: "search", events: 6 }],
      top_campaigns: [],
      top_referrers: [],
    },
    identity: null,
    health: {
      last_received_at: "2026-04-08T10:00:00.000Z",
      included_events: 8,
      excluded_test_mode: 0,
      excluded_non_production_host: 0,
      dropped_rate_limited: 0,
      dropped_invalid: null,
      cloudflare_traffic_enabled: false,
      production_only_default: true,
    },
  });

  assert.equal(payload.view, "site");
  assert.equal(payload.scope.support_class, "event_only");
  assert.equal(payload.scope.section_availability.identity, false);
  assert.equal(payload.identity, null);
});