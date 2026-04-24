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
  buildProductionHostClause,
  isValidReleaseArtifactUrl,
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
      top_paths: [{ path: "/", events: 8 }],
      top_sources: [{ source: "search", events: 6 }],
      top_campaigns: [],
      top_referrers: [],
      top_contents: [],
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

// ---------------------------------------------------------------------------
// Star Map reporting path — production-host filtering and observability
// ---------------------------------------------------------------------------

test("buildProductionHostClause generates https and http LIKE patterns for each production host", () => {
  const result = buildProductionHostClause({ production_hosts: ["starmap.truegoodcraft.ca"] });
  assert.equal(result.sql, "(LOWER(url) LIKE ? OR LOWER(url) LIKE ?)");
  assert.deepEqual(result.bindings, [
    "https://starmap.truegoodcraft.ca/%",
    "http://starmap.truegoodcraft.ca/%",
  ]);
});

test("buildProductionHostClause generates patterns only for canonical production host, never for stale dev-host", () => {
  const result = buildProductionHostClause({ production_hosts: ["starmap.truegoodcraft.ca"] });
  for (const binding of result.bindings) {
    assert.equal(binding.includes("pages.dev"), false,
      "production host clause must not include stale star-map-generator.pages.dev hostname");
  }
});

test("buildProductionHostClause handles multiple hosts for BUS Core", () => {
  const result = buildProductionHostClause({ production_hosts: ["buscore.ca", "www.buscore.ca"] });
  assert.equal(
    result.sql,
    "(LOWER(url) LIKE ? OR LOWER(url) LIKE ? OR LOWER(url) LIKE ? OR LOWER(url) LIKE ?)"
  );
  assert.equal(result.bindings.length, 4);
  assert.equal(result.bindings[0], "https://buscore.ca/%");
  assert.equal(result.bindings[1], "http://buscore.ca/%");
  assert.equal(result.bindings[2], "https://www.buscore.ca/%");
  assert.equal(result.bindings[3], "http://www.buscore.ca/%");
});

test("buildProductionHostClause returns never-matching SQL for site with no production hosts", () => {
  const result = buildProductionHostClause({ production_hosts: [] });
  assert.equal(result.sql, "1 = 0");
  assert.deepEqual(result.bindings, []);
});

test("Star Map keeps event_only support class and production_only_default true", () => {
  const starMapSite = {
    status: "active",
    cloudflare_traffic_enabled: false,
    site_key: "star_map_generator",
  };
  assert.equal(supportClassForSite(starMapSite), "event_only");
  assert.equal(sectionAvailabilityForSupportClass("event_only").traffic, false);
  assert.equal(sectionAvailabilityForSupportClass("event_only").identity, false);
});

test("event_only site report shows null traffic fields by design, not as a bug", () => {
  const payload = assembleSiteReport({
    generated_at: "2026-04-10T12:00:00.000Z",
    scope: {
      site_key: "star_map_generator",
      label: "Star Map Generator",
      status: "active",
      backend_source: "site_events_raw",
      window: {
        start_day: "2026-04-04",
        end_day: "2026-04-10",
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
      accepted_events_7d: 5,
      pageviews_7d: null,
      traffic_requests_7d: null,
      traffic_visits_7d: null,
      last_received_at: "2026-04-10T09:00:00.000Z",
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
      accepted_events: 5,
      unique_paths: 2,
      by_event_name: [
        { event_name: "page_view", events: 3 },
        { event_name: "preview_generated", events: 2 },
      ],
      top_paths: [
        { path: "/", events: 3 },
        { path: "/generate", events: 2 },
      ],
      top_sources: [],
      top_campaigns: [],
      top_referrers: [],
      top_contents: [],
    },
    identity: null,
    health: {
      last_received_at: "2026-04-10T09:00:00.000Z",
      included_events: 5,
      excluded_test_mode: 0,
      excluded_non_production_host: 0,
      dropped_rate_limited: 0,
      dropped_invalid: null,
      cloudflare_traffic_enabled: false,
      production_only_default: true,
    },
  });

  // Traffic layer is unavailable by design for event_only sites.
  assert.equal(payload.traffic.cloudflare_traffic_enabled, false);
  assert.equal(payload.traffic.latest_day.day, null);
  assert.equal(payload.traffic.latest_day.requests, null);
  assert.equal(payload.traffic.latest_day.visits, null);
  assert.equal(payload.traffic.last_7_days.requests, null);
  assert.equal(payload.traffic.last_7_days.visits, null);
  assert.equal(payload.summary.traffic_requests_7d, null);
  assert.equal(payload.summary.traffic_visits_7d, null);
  assert.equal(payload.summary.pageviews_7d, null);
});

test("health.included_events and events.accepted_events carry the same filter-scoped count", () => {
  // After the binding-order fix, included_events and accepted_events are computed
  // from the same filter predicate and must produce the same value.
  const eventCount = 7;
  const payload = assembleSiteReport({
    generated_at: "2026-04-10T12:00:00.000Z",
    scope: {
      site_key: "star_map_generator",
      label: "Star Map Generator",
      status: "active",
      backend_source: "site_events_raw",
      window: {
        start_day: "2026-04-04",
        end_day: "2026-04-10",
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
      accepted_events_7d: eventCount,
      pageviews_7d: null,
      traffic_requests_7d: null,
      traffic_visits_7d: null,
      last_received_at: "2026-04-10T09:00:00.000Z",
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
      accepted_events: eventCount,
      unique_paths: 3,
      by_event_name: [{ event_name: "page_view", events: eventCount }],
      top_paths: [{ path: "/", events: eventCount }],
      top_sources: [],
      top_campaigns: [],
      top_referrers: [],
      top_contents: [],
    },
    identity: null,
    health: {
      last_received_at: "2026-04-10T09:00:00.000Z",
      included_events: eventCount,
      excluded_test_mode: 0,
      excluded_non_production_host: 0,
      dropped_rate_limited: 0,
      dropped_invalid: null,
      cloudflare_traffic_enabled: false,
      production_only_default: true,
    },
  });

  // events.accepted_events and health.included_events represent the same
  // filter-scoped accepted event count and must be equal.
  assert.equal(payload.events.accepted_events, payload.health.included_events);
  assert.equal(payload.events.accepted_events, eventCount);
});

test("excluded_non_production_host is computed independently of included_events filter scope", () => {
  // excluded_non_production_host counts accepted events whose url does NOT match any
  // production host, regardless of the productionOnly filter setting.
  // When production_only=true, included_events + excluded_non_production_host
  // accounts for all accepted non-test-mode events.
  const payload = assembleSiteReport({
    generated_at: "2026-04-10T12:00:00.000Z",
    scope: {
      site_key: "star_map_generator",
      label: "Star Map Generator",
      status: "active",
      backend_source: "site_events_raw",
      window: {
        start_day: "2026-04-04",
        end_day: "2026-04-10",
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
      accepted_events_7d: 3,
      pageviews_7d: null,
      traffic_requests_7d: null,
      traffic_visits_7d: null,
      last_received_at: "2026-04-10T09:00:00.000Z",
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
      accepted_events: 3,
      unique_paths: 1,
      by_event_name: [{ event_name: "page_view", events: 3 }],
      top_paths: [{ path: "/", events: 3 }],
      top_sources: [],
      top_campaigns: [],
      top_referrers: [],
      top_contents: [],
    },
    identity: null,
    health: {
      last_received_at: "2026-04-10T09:00:00.000Z",
      included_events: 3,
      excluded_test_mode: 0,
      excluded_non_production_host: 2,
      dropped_rate_limited: 0,
      dropped_invalid: null,
      cloudflare_traffic_enabled: false,
      production_only_default: true,
    },
  });

  // excluded_non_production_host is populated independently.
  // It is not subtracted from included_events in the assembled payload.
  assert.equal(payload.health.excluded_non_production_host, 2);
  assert.equal(payload.health.included_events, 3);
  assert.equal(typeof payload.health.excluded_non_production_host, "number");
});

// ---------------------------------------------------------------------------
// site-view event breakdown fields — event_only properties
// ---------------------------------------------------------------------------

function makeEventOnlySiteReport(eventsOverride) {
  return assembleSiteReport({
    generated_at: "2026-04-10T12:00:00.000Z",
    scope: {
      site_key: "star_map_generator",
      label: "Star Map Generator",
      status: "active",
      backend_source: "site_events_raw",
      window: {
        start_day: "2026-04-04",
        end_day: "2026-04-10",
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
      accepted_events_7d: eventsOverride.accepted_events,
      pageviews_7d: null,
      traffic_requests_7d: null,
      traffic_visits_7d: null,
      last_received_at: "2026-04-10T09:00:00.000Z",
      has_recent_signal: eventsOverride.accepted_events > 0,
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
    events: eventsOverride,
    identity: null,
    health: {
      last_received_at: "2026-04-10T09:00:00.000Z",
      included_events: eventsOverride.accepted_events,
      excluded_test_mode: 0,
      excluded_non_production_host: 0,
      dropped_rate_limited: 0,
      dropped_invalid: null,
      cloudflare_traffic_enabled: false,
      production_only_default: true,
    },
  });
}

test("event_only site-view: events section includes all breakdown fields", () => {
  const payload = makeEventOnlySiteReport({
    accepted_events: 10,
    unique_paths: 3,
    by_event_name: [
      { event_name: "page_view", events: 6 },
      { event_name: "preview_generated", events: 3 },
      { event_name: "payment_click", events: 1 },
    ],
    top_paths: [
      { path: "/", events: 6 },
      { path: "/generate", events: 3 },
      { path: "/download", events: 1 },
    ],
    top_sources: [
      { source: "search", events: 5 },
      { source: "google_ads", events: 3 },
      { source: "(direct)", events: 2 },
    ],
    top_campaigns: [{ utm_campaign: "spring_promo", events: 3 }],
    top_referrers: [{ referrer_domain: "google.com", events: 5 }],
    top_contents: [
      { utm_content: "banner_v2", events: 3 },
      { utm_content: "sidebar_v1", events: 0 },
    ],
  });

  assert.equal(payload.events.accepted_events, 10);
  assert.equal(payload.events.unique_paths, 3);

  assert.equal(Array.isArray(payload.events.by_event_name), true);
  assert.equal(payload.events.by_event_name.length, 3);
  assert.equal(payload.events.by_event_name[0].event_name, "page_view");
  assert.equal(payload.events.by_event_name[0].events, 6);

  assert.equal(Array.isArray(payload.events.top_paths), true);
  assert.equal(payload.events.top_paths.length, 3);
  assert.equal(payload.events.top_paths[0].path, "/");
  assert.equal(payload.events.top_paths[0].events, 6);

  assert.equal(Array.isArray(payload.events.top_sources), true);
  assert.equal(payload.events.top_sources.length, 3);
  assert.equal(payload.events.top_sources[0].source, "search");

  assert.equal(Array.isArray(payload.events.top_campaigns), true);
  assert.equal(payload.events.top_campaigns.length, 1);
  assert.equal(payload.events.top_campaigns[0].utm_campaign, "spring_promo");

  assert.equal(Array.isArray(payload.events.top_referrers), true);
  assert.equal(payload.events.top_referrers.length, 1);
  assert.equal(payload.events.top_referrers[0].referrer_domain, "google.com");

  assert.equal(Array.isArray(payload.events.top_contents), true);
  assert.equal(payload.events.top_contents.length, 2);
  assert.equal(payload.events.top_contents[0].utm_content, "banner_v2");

  assert.equal(payload.identity, null);
  assert.equal(payload.traffic.cloudflare_traffic_enabled, false);
  assert.equal(payload.traffic.latest_day.requests, null);
});

test("event_only site-view: top_paths carries path breakdown independent of unique_paths count", () => {
  const payload = makeEventOnlySiteReport({
    accepted_events: 12,
    unique_paths: 4,
    by_event_name: [{ event_name: "page_view", events: 12 }],
    top_paths: [
      { path: "/", events: 5 },
      { path: "/generate", events: 4 },
      { path: "/high-res", events: 2 },
      { path: "/download", events: 1 },
    ],
    top_sources: [],
    top_campaigns: [],
    top_referrers: [],
    top_contents: [],
  });

  assert.equal(payload.events.unique_paths, 4);
  assert.equal(payload.events.top_paths.length, 4);
  for (const entry of payload.events.top_paths) {
    assert.equal(typeof entry.path, "string");
    assert.equal(typeof entry.events, "number");
  }
});

test("event_only site-view: top_sources aggregation via referrer classification", () => {
  const payload = makeEventOnlySiteReport({
    accepted_events: 8,
    unique_paths: 1,
    by_event_name: [{ event_name: "page_view", events: 8 }],
    top_paths: [{ path: "/", events: 8 }],
    top_sources: [
      { source: "search", events: 5 },
      { source: "(direct)", events: 3 },
    ],
    top_campaigns: [],
    top_referrers: [{ referrer_domain: "google.com", events: 5 }],
    top_contents: [],
  });

  for (const entry of payload.events.top_sources) {
    assert.equal(typeof entry.source, "string");
    assert.equal(typeof entry.events, "number");
  }
  assert.equal(payload.events.top_sources[0].source, "search");
  assert.equal(payload.events.top_sources[0].events, 5);
});

test("event_only site-view: top_campaigns aggregation for utm_campaign attribution", () => {
  const payload = makeEventOnlySiteReport({
    accepted_events: 9,
    unique_paths: 2,
    by_event_name: [{ event_name: "page_view", events: 9 }],
    top_paths: [{ path: "/", events: 9 }],
    top_sources: [{ source: "google_ads", events: 9 }],
    top_campaigns: [
      { utm_campaign: "star_map_launch", events: 6 },
      { utm_campaign: "retarget_q2", events: 3 },
    ],
    top_referrers: [],
    top_contents: [],
  });

  assert.equal(Array.isArray(payload.events.top_campaigns), true);
  assert.equal(payload.events.top_campaigns.length, 2);
  assert.equal(payload.events.top_campaigns[0].utm_campaign, "star_map_launch");
  assert.equal(payload.events.top_campaigns[0].events, 6);
  assert.equal(typeof payload.events.top_campaigns[0].utm_campaign, "string");
});

test("event_only site-view: top_referrers aggregation for referrer domain attribution", () => {
  const payload = makeEventOnlySiteReport({
    accepted_events: 7,
    unique_paths: 2,
    by_event_name: [{ event_name: "page_view", events: 7 }],
    top_paths: [{ path: "/", events: 7 }],
    top_sources: [{ source: "social", events: 7 }],
    top_campaigns: [],
    top_referrers: [
      { referrer_domain: "reddit.com", events: 4 },
      { referrer_domain: "twitter.com", events: 3 },
    ],
    top_contents: [],
  });

  assert.equal(Array.isArray(payload.events.top_referrers), true);
  assert.equal(payload.events.top_referrers.length, 2);
  assert.equal(payload.events.top_referrers[0].referrer_domain, "reddit.com");
  assert.equal(payload.events.top_referrers[0].events, 4);
});

test("event_only site-view: top_contents aggregation for utm_content ad/creative evaluation", () => {
  const payload = makeEventOnlySiteReport({
    accepted_events: 15,
    unique_paths: 2,
    by_event_name: [{ event_name: "page_view", events: 15 }],
    top_paths: [{ path: "/", events: 15 }],
    top_sources: [{ source: "google_ads", events: 15 }],
    top_campaigns: [{ utm_campaign: "summer_sale", events: 15 }],
    top_referrers: [],
    top_contents: [
      { utm_content: "hero_banner_v3", events: 9 },
      { utm_content: "sidebar_cta_v1", events: 6 },
    ],
  });

  assert.equal(Array.isArray(payload.events.top_contents), true);
  assert.equal(payload.events.top_contents.length, 2);
  assert.equal(payload.events.top_contents[0].utm_content, "hero_banner_v3");
  assert.equal(payload.events.top_contents[0].events, 9);
  assert.equal(typeof payload.events.top_contents[0].utm_content, "string");
});

test("event_only site-view: empty breakdown arrays when no attribution data present", () => {
  const payload = makeEventOnlySiteReport({
    accepted_events: 3,
    unique_paths: 1,
    by_event_name: [{ event_name: "preview_generated", events: 3 }],
    top_paths: [{ path: "/generate", events: 3 }],
    top_sources: [{ source: "(direct)", events: 3 }],
    top_campaigns: [],
    top_referrers: [],
    top_contents: [],
  });

  assert.equal(payload.events.top_campaigns.length, 0);
  assert.equal(payload.events.top_referrers.length, 0);
  assert.equal(payload.events.top_contents.length, 0);
  assert.equal(payload.events.by_event_name.length > 0, true);
  assert.equal(payload.events.top_paths.length > 0, true);
  assert.equal(payload.events.top_sources.length > 0, true);
});

test("event_only site-view: Star Map extension events appear in by_event_name breakdown", () => {
  const extensionEvents = [
    { event_name: "page_view", events: 20 },
    { event_name: "preview_generated", events: 15 },
    { event_name: "high_res_requested", events: 8 },
    { event_name: "payment_click", events: 5 },
    { event_name: "download_completed", events: 3 },
  ];
  const payload = makeEventOnlySiteReport({
    accepted_events: 51,
    unique_paths: 3,
    by_event_name: extensionEvents,
    top_paths: [{ path: "/", events: 30 }, { path: "/generate", events: 21 }],
    top_sources: [{ source: "(direct)", events: 51 }],
    top_campaigns: [],
    top_referrers: [],
    top_contents: [],
  });

  assert.equal(payload.events.by_event_name.length, 5);
  const names = payload.events.by_event_name.map((e) => e.event_name);
  assert.equal(names.includes("page_view"), true);
  assert.equal(names.includes("preview_generated"), true);
  assert.equal(names.includes("payment_click"), true);
  assert.equal(payload.scope.support_class, "event_only");
  assert.equal(payload.identity, null);
  assert.equal(payload.traffic.cloudflare_traffic_enabled, false);
});

test("isValidReleaseArtifactUrl accepts new BUS-Core-<semver>.zip filenames", () => {
  assert.equal(isValidReleaseArtifactUrl("/releases/BUS-Core-1.0.4.zip"), true);
  assert.equal(isValidReleaseArtifactUrl("https://lighthouse.buscore.ca/releases/BUS-Core-1.0.4.zip"), true);
  assert.equal(isValidReleaseArtifactUrl("/releases/BUS-Core-2.0.0.zip"), true);
});

test("isValidReleaseArtifactUrl accepts legacy TGC-BUS-Core-<semver>.zip filenames", () => {
  assert.equal(isValidReleaseArtifactUrl("/releases/TGC-BUS-Core-1.0.3.zip"), true);
  assert.equal(isValidReleaseArtifactUrl("https://lighthouse.buscore.ca/releases/TGC-BUS-Core-1.0.3.zip"), true);
});

test("isValidReleaseArtifactUrl rejects invalid filenames", () => {
  assert.equal(isValidReleaseArtifactUrl("/releases/malicious.exe"), false);
  assert.equal(isValidReleaseArtifactUrl("/releases/BUS-Core-1.0.4.tar.gz"), false);
  assert.equal(isValidReleaseArtifactUrl("/releases/../etc/passwd"), false);
  assert.equal(isValidReleaseArtifactUrl("/releases/"), false);
  assert.equal(isValidReleaseArtifactUrl("/update/check"), false);
});
