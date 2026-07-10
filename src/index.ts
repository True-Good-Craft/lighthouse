import {
  BUSCORE_TELEMETRY_PATH,
  handleBuscoreTelemetryRequest,
  pruneBuscoreTelemetry,
} from "./productTelemetry.js";

export interface Env {
  DB: D1Database;
  BUSCORE_LEADS_DB?: D1Database;
  MANIFEST_R2: R2Bucket;
  ADMIN_TOKEN: string;
  IGNORED_IP: string;
  CF_API_TOKEN: string;
  CF_ZONE_TAG: string;
  // Phase 2 (optional, additive). Missing values degrade to null data, never fake.
  GITHUB_REPO?: string; // defaults to True-Good-Craft/TGC-BUS-Core
  GITHUB_TOKEN?: string; // optional; raises rate limit and unlocks private fields if ever needed
}

type CounterColumn = "update_checks" | "downloads" | "errors";
type MetricTotals = { update_checks: number; downloads: number; errors: number };
type ReleaseDownloadSummaryRow = { release_version: string; filename: string; downloads: number };
type ReleaseUpdateAvailability = "true" | "false" | "unknown";
// Aggregate-only first-check bucket. Never an identity, install, or unique-user signal.
type ReleaseFirstCheck = "true" | "false" | "unknown";
type ReleaseSignalWindow = {
  artifact_downloads: number;
  artifact_downloads_by_release: ReleaseDownloadSummaryRow[];
  raw_update_checks: number;
  breakdown_update_checks: number;
  raw_breakdown_delta: number;
  update_checks: number;
  update_checks_with_known_client_version: number;
  update_checks_unknown_client_version: number;
  update_available_impressions: number;
  latest_version_checkins: number;
  first_seen_checkins: number;
  repeat_checkins: number;
  unknown_first_checkins: number;
  first_seen_share: number;
};
type ReleaseSignalsSummary = {
  today: ReleaseSignalWindow;
  last_7_days: ReleaseSignalWindow;
  last_30_days: ReleaseSignalWindow;
};
type ReleaseUpdateSignalAggregateRow = {
  update_checks?: number | null;
  update_checks_with_known_client_version?: number | null;
  update_checks_unknown_client_version?: number | null;
  update_available_impressions?: number | null;
  latest_version_checkins?: number | null;
  first_seen_checkins?: number | null;
  repeat_checkins?: number | null;
  unknown_first_checkins?: number | null;
};
type TrafficTotals = { row_count: number; visits: number | null; requests: number | null };
type TrafficRow = { day: string; visits: number | null; requests: number; captured_at: string };
type PageviewInput = {
  client_ts: string | null;
  path: string | null;
  url: string | null;
  referrer: string | null;
  src: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  device: string | null;
  viewport: string | null;
  lang: string | null;
  tz: string | null;
  anon_user_id: string | null;
  session_id: string | null;
  is_new_user: number;
};
type PageviewRawEvent = PageviewInput & {
  id: string;
  received_at: string;
  received_day: string;
  referrer_domain: string | null;
  country: string | null;
  js_fired: number;
  ip_hash: string | null;
  user_agent_hash: string | null;
  accepted: number;
  drop_reason: string | null;
  request_id: string | null;
  ingest_version: string;
};
type PageviewSummaryRow = {
  pageviews?: number | null;
  accepted?: number | null;
  dropped_rate_limited?: number | null;
  dropped_invalid?: number | null;
  last_received_at?: string | null;
  days_with_data?: number | null;
};
type TopPageviewDimRow = { value: string; pageviews: number };
type IdentityEventRow = {
  received_day: string;
  anon_user_id: string | null;
  session_id: string | null;
  is_new_user: number;
  src: string | null;
  utm_source: string | null;
};
type IdentityFirstSeenRow = { anon_user_id: string; first_seen_day: string };
type IdentityWindowMetrics = {
  new_users: number;
  returning_users: number;
  sessions: number;
};
type IdentitySummary = {
  today: IdentityWindowMetrics;
  last_7_days: IdentityWindowMetrics & { return_rate: number };
  top_sources_by_returning_users: Array<{ source: string; users: number }>;
};
type PageviewBodyCapture = {
  raw: string | null;
  body_capture_stage_reached: boolean;
  capture_error: string | null;
};
type PageviewRequestContext = {
  method: string;
  origin: string | null;
  contentType: string | null;
  clientIp: string | null;
  country: string | null;
  requestId: string | null;
  userAgent: string | null;
  secFetchMode: string | null;
  secFetchDest: string | null;
  keepalive: boolean;
  transportHint: string;
};
type SiteEventInput = {
  site_key: string;
  event_name: string;
  client_ts: string | null;
  path: string | null;
  url: string | null;
  referrer: string | null;
  src: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  device: string | null;
  viewport: string | null;
  lang: string | null;
  tz: string | null;
  anon_user_id: string | null;
  session_id: string | null;
  is_new_user: number;
  event_value: string | null;
  test_mode: number;
};
type SiteEventRawRecord = SiteEventInput & {
  id: string;
  received_at: string;
  received_day: string;
  referrer_domain: string | null;
  country: string | null;
  ip_hash: string | null;
  user_agent_hash: string | null;
  accepted: number;
  drop_reason: string | null;
  request_id: string | null;
  ingest_version: string;
};
type SiteEventFilter = {
  siteKey: string;
  excludeTestMode: boolean;
  productionOnly: boolean;
};
type SiteEventSummary = {
  scope: {
    site_key: string;
    exclude_test_mode: boolean;
    production_only: boolean;
  };
  totals: {
    accepted_events: number;
    unique_paths: number;
  };
  by_event_name: Array<{ event_name: string; events: number }>;
  top_paths: Array<{ path: string; events: number }>;
  top_sources: Array<{ source: string; events: number }>;
  top_campaigns: Array<{ utm_campaign: string; events: number }>;
  top_referrers: Array<{ referrer_domain: string; events: number }>;
  top_contents: Array<{ utm_content: string; events: number }>;
  observability: {
    included_events: number;
    excluded_test_mode: number;
    excluded_non_production_host: number;
    dropped_rate_limited: number;
    dropped_invalid: number;
    last_received_at: string | null;
  };
};
type PageExecutionEventsSummary = {
  accepted_events: number;
  unique_paths: number;
  by_event_name: Array<{ event_name: string; events: number }>;
  top_paths: Array<{ path: string; events: number }>;
  top_sources: Array<{ source: string; events: number }>;
  top_campaigns: Array<{ utm_campaign: string; events: number }>;
  top_referrers: Array<{ referrer_domain: string; events: number }>;
  top_contents: Array<{ utm_content: string; events: number }>;
};
type TrafficLayerMeta = {
  source: "cloudflare_edge";
  semantics: "edge_observed_not_confirmed_human";
  enabled: boolean;
};
type LegacyPageviewSummary = {
  pageviews_7d: number;
  days_with_data: number;
  last_received_at: string | null;
};
type OperatorSourceCount = { source: string; count: number };
type OperatorCampaignCount = { utm_campaign: string; count: number };
type OperatorPageviewSourceCount = { source: string; pageviews: number };
type OperatorIntentSourceCount = { source: string; events: number };
type OperatorLeadSourceCount = { source: string; leads: number };
type OperatorConversionSource = {
  source: string;
  pageviews: number | null;
  counted_intent: number;
  leads: number | null;
  lead_conversion_percent: number | null;
};
type OperatorLeadAttributionStatus = "unavailable" | "no_leads" | "no_attributed_leads" | "available";
type OperatorLeadAttribution = {
  status: OperatorLeadAttributionStatus;
  available: boolean;
  message: string;
  leads_7d_total: number | null;
  leads_7d_attributed: number | null;
  leads_7d_unknown: number | null;
  top_sources: OperatorSourceCount[] | null;
  top_campaigns: OperatorCampaignCount[] | null;
  attribution_window_days: number;
  error_reason?: string;
};
type OperatorSummary = {
  window: ReportWindow;
  lead_attribution: OperatorLeadAttribution;
  source_to_lead: {
    available: boolean;
    message?: string;
    top_sources_by_early_access_leads: OperatorSourceCount[] | null;
    top_campaigns_by_early_access_leads: OperatorCampaignCount[] | null;
    direct_unknown_leads: number | null;
  };
  source_to_intent: {
    top_sources_by_download_click: OperatorIntentSourceCount[];
    top_sources_by_early_access_submit_success: OperatorIntentSourceCount[];
    top_sources_by_github_click: OperatorIntentSourceCount[];
    top_sources_by_discord_click: OperatorIntentSourceCount[];
    top_sources_by_support_click: OperatorIntentSourceCount[];
    top_sources_by_docs_click: OperatorIntentSourceCount[];
  };
  conversion_summary: {
    page_views_by_source: OperatorPageviewSourceCount[] | null;
    counted_intent_by_source: OperatorIntentSourceCount[];
    leads_by_source: OperatorLeadSourceCount[] | null;
    conversion_by_source: OperatorConversionSource[];
  };
  telemetry_health: {
    last_received_event_timestamp: string | null;
    accepted_events_in_window: number;
    dropped_rate_limited_count: number;
    warning: string | null;
  };
  operator_note: {
    best_source_this_period: string;
    weak_unknown_attribution: string;
  };
};
export type SupportClass = "legacy_hybrid" | "event_only" | "event_plus_cf_traffic" | "not_yet_normalized";
type SharedEventName = "page_view" | "outbound_click" | "contact_click" | "service_interest";
type EventTaxonomyKind = "shared" | "extension" | "invalid";
type SiteSectionAvailability = {
  summary: boolean;
  today: boolean;
  traffic: boolean;
  human_traffic_events: boolean;
  observability: boolean;
  identity: boolean;
  read: boolean;
};
type ReportView = "legacy" | "fleet" | "site" | "source_health" | "asset" | "monthly";
type ReportWindow = {
  start_day: string;
  end_day: string;
  timezone: "UTC";
  semantics: "current_utc_day_plus_previous_6_days";
};
type PageviewRangeSummary = {
  pageviews: number;
  accepted: number;
  dropped_rate_limited: number;
  dropped_invalid: number;
  last_received_at: string | null;
  days_with_data: number;
};
type FleetSiteEntry = {
  site_key: string;
  label: string;
  status: SiteStatus;
  backend_source: string;
  cloudflare_traffic_enabled: boolean;
  production_hosts: string[];
  last_received_at: string | null;
  accepted_events_7d: number;
  pageviews_7d: number | null;
  traffic_requests_7d: number | null;
  traffic_visits_7d: number | null;
  has_recent_signal: boolean;
};
type SiteReportPayload = {
  view: "site";
  generated_at: string;
  scope: {
    site_key: string;
    label: string;
    status: SiteStatus;
    backend_source: string;
    window: ReportWindow;
    exclude_test_mode: boolean;
    production_only: boolean;
    support_class: SupportClass;
    section_availability: SiteSectionAvailability;
  };
  summary: {
    accepted_events_7d: number;
    pageviews_7d: number | null;
    traffic_requests_7d: number | null;
    traffic_visits_7d: number | null;
    last_received_at: string | null;
    has_recent_signal: boolean;
  };
  traffic_layer: TrafficLayerMeta;
  traffic: {
    cloudflare_traffic_enabled: boolean;
    latest_day: ReturnType<typeof latestTrafficWindow>;
    last_7_days: ReturnType<typeof trafficWindowFromTotals>;
  };
  page_execution_events: PageExecutionEventsSummary;
  events: PageExecutionEventsSummary;
  legacy_pageview: LegacyPageviewSummary | null;
  identity: IdentitySummary | null;
  operator_summary?: OperatorSummary;
  health: {
    last_received_at: string | null;
    included_events: number;
    excluded_test_mode: number;
    excluded_non_production_host: number;
    dropped_rate_limited: number;
    dropped_invalid: number | null;
    cloudflare_traffic_enabled: boolean;
    production_only_default: boolean;
  };
};
type SourceHealthSiteEntry = {
  site_key: string;
  label: string;
  backend_source: string;
  cloudflare_traffic_enabled: boolean;
  production_only_default: boolean;
  last_received_at: string | null;
  accepted_signal_7d: number;
  dropped_invalid: number | null;
  dropped_rate_limited: number;
};
type ReportRequestResolution =
  | { ok: true; view: "legacy"; siteEventFilter: SiteEventFilter | null }
  | { ok: true; view: "fleet" }
  | { ok: true; view: "site"; siteEventFilter: SiteEventFilter }
  | { ok: true; view: "source_health" }
  | { ok: true; view: "asset" }
  | { ok: true; view: "monthly" }
  | { ok: false; error: "invalid_view" | "missing_site_key" | "invalid_site_key" };
type CloudflareGraphQLResponse = {
  data?: {
    viewer?: {
      zones?: Array<{
        buscoreTraffic?: Array<{
          count?: number | null;
          sum?: {
            visits?: number | null;
          };
        }>;
      }>;
    };
  };
  errors?: Array<{ message?: string }> | null;
};

type SiteStatus = "active" | "staging" | "planned";

type TrackedSite = {
  readonly site_key: string;
  readonly label: string;
  readonly status: SiteStatus;
  readonly production_hosts: readonly string[];
  readonly allowed_origins: readonly string[];
  readonly staging_hosts: readonly string[];
  readonly cloudflare_traffic_enabled: boolean;
  readonly cloudflare_host: string | null;
  readonly production_only_default: boolean;
};

const TRACKED_SITES: readonly TrackedSite[] = [
  {
    site_key: "buscore",
    label: "BUS Core",
    status: "active",
    production_hosts: ["buscore.ca", "www.buscore.ca"],
    allowed_origins: ["https://buscore.ca", "https://www.buscore.ca"],
    staging_hosts: [],
    cloudflare_traffic_enabled: true,
    cloudflare_host: "buscore.ca",
    production_only_default: false,
  },
  {
    site_key: "star_map_generator",
    label: "Star Map Generator",
    status: "active",
    production_hosts: ["starmap.truegoodcraft.ca"],
    allowed_origins: ["https://starmap.truegoodcraft.ca"],
    staging_hosts: [],
    cloudflare_traffic_enabled: false,
    cloudflare_host: null,
    production_only_default: true,
  },
  {
    site_key: "tgc_site",
    label: "True Good Craft",
    status: "active",
    production_hosts: ["truegoodcraft.ca", "www.truegoodcraft.ca"],
    allowed_origins: ["https://truegoodcraft.ca", "https://www.truegoodcraft.ca"],
    staging_hosts: [],
    cloudflare_traffic_enabled: false,
    cloudflare_host: null,
    production_only_default: true,
  },
];

export const CANONICAL_SHARED_EVENT_TAXONOMY: ReadonlyArray<SharedEventName> = [
  "page_view",
  "outbound_click",
  "contact_click",
  "service_interest",
];

const SHARED_EVENT_ALIAS_TO_CANONICAL: Readonly<Record<string, SharedEventName>> = {
  pageview: "page_view",
  page_view: "page_view",
  link_click: "outbound_click",
  outbound_click: "outbound_click",
  contact_click: "contact_click",
  service_interest: "service_interest",
};

// Developer/operator analytics suppression (`dev_mode`) is enforced by site loaders before emission.
// Lighthouse ingest routes intentionally remain cookie-agnostic on the server side.

const MANIFEST_PATH = "/manifest/core/stable.json";
const MANIFEST_KEY = "manifest/core/stable.json";
const PAGEVIEW_METRICS_PATH = "/metrics/pageview"; // BUS Core legacy-only ingest path.
const SITE_EVENT_METRICS_PATH = "/metrics/event"; // Canonical fleet ingest path.
const RELEASE_PATH = /^\/releases\/([^/]+)$/;
const RELEASE_FILENAME = /^(?:TGC-)?BUS-Core-([0-9]+\.[0-9]+\.[0-9]+)\.zip$/;
const SEMVER_PATTERN = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/;
const CLOUDFLARE_GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const BUSCORE_HOST: string =
  TRACKED_SITES.find((s) => s.site_key === "buscore")?.cloudflare_host ?? "buscore.ca";
const PAGEVIEW_ALLOWED_ORIGINS: Set<string> = new Set(
  TRACKED_SITES.find((s) => s.site_key === "buscore")?.allowed_origins ?? []
);
const PAGEVIEW_INGEST_VERSION = "1.9.0";
const SITE_EVENT_INGEST_VERSION = "1.11.0";
const PAGEVIEW_INVALID_JSON_DEBUG_ENABLED = true;
const PAGEVIEW_INVALID_JSON_DEBUG_PREVIEW_CHARS = 500;
const PAGEVIEW_RATE_LIMIT_PER_MINUTE = 50;
const PAGEVIEW_RAW_RETENTION_DAYS = 30;
const PAGEVIEW_RATE_LIMIT_RETENTION_DAYS = 2;
const SITE_EVENT_RATE_LIMIT_PER_MINUTE = 50;
const SITE_EVENT_RATE_LIMIT_RETENTION_DAYS = 2;
const TOP_PAGEVIEW_DIMENSION_LIMIT = 5;
const DIRECT_SOURCE_LABEL = "(direct)";
const EARLIEST_REPORT_DAY = "0000-01-01";
const UNKNOWN_VERSION_BUCKET = "unknown";
const UNKNOWN_CHANNEL_BUCKET = "unknown";
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGEVIEW_ALLOWED_DEVICES = new Set(["desktop", "mobile", "tablet"]);
const PAGEVIEW_VIEWPORT_PATTERN = /^\d+x\d+$/;
const BUSCORE_TRAFFIC_QUERY = `query DailyBuscoreTraffic($zoneTag: string, $start: Time!, $end: Time!, $host: string!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      buscoreTraffic: httpRequestsAdaptiveGroups(
        limit: 1
        filter: {
          datetime_geq: $start
          datetime_lt: $end
          clientRequestHTTPHost: $host
          requestSource: "eyeball"
        }
      ) {
        count
        sum {
          visits
        }
      }
    }
  }
}`;

const BASE_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function utcMinuteBucket(date: Date = new Date()): string {
  return date.toISOString().slice(0, 16);
}

function addUtcDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function utcMonthStart(base: Date): string {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function getClientIp(request: Request): string | null {
  const ip = request.headers.get("CF-Connecting-IP");
  return ip && ip.trim() ? ip.trim() : null;
}

function getCountry(request: Request): string | null {
  const cf = (request as Request & { cf?: { country?: unknown } }).cf;
  const country = cf?.country;
  return typeof country === "string" && country.trim() ? country.trim() : null;
}

function getRequestId(request: Request): string | null {
  const value = request.headers.get("CF-Ray");
  return value && value.trim() ? value.trim() : null;
}

function shouldSkipCounting(clientIp: string | null, ignoredIp: string | undefined): boolean {
  if (!ignoredIp || !ignoredIp.trim()) return false;
  if (!clientIp) return false;
  return clientIp === ignoredIp.trim();
}

function nullIfBlank(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeSemver(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(SEMVER_PATTERN);
  if (!match) {
    return null;
  }

  return `${Number.parseInt(match[1], 10)}.${Number.parseInt(match[2], 10)}.${Number.parseInt(match[3], 10)}`;
}

function compareSemver(left: string, right: string): number {
  const leftMatch = left.match(SEMVER_PATTERN);
  const rightMatch = right.match(SEMVER_PATTERN);
  if (!leftMatch || !rightMatch) {
    return 0;
  }

  for (let index = 1; index <= 3; index += 1) {
    const leftPart = Number.parseInt(leftMatch[index], 10);
    const rightPart = Number.parseInt(rightMatch[index], 10);
    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  return 0;
}

function extractReleaseVersionFromFilename(filename: string): string | null {
  const match = filename.match(RELEASE_FILENAME);
  return match ? normalizeSemver(match[1]) : null;
}

function normalizeChannelSignal(value: string | null): string {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : UNKNOWN_CHANNEL_BUCKET;
}

function resolveClientVersionSignal(url: URL, request: Request): string | null {
  return (
    nullIfBlank(url.searchParams.get("current_version")) ??
    nullIfBlank(url.searchParams.get("version")) ??
    nullIfBlank(request.headers.get("X-BUS-Core-Version"))
  );
}

function resolveChannelSignal(url: URL, request: Request): string {
  return normalizeChannelSignal(
    nullIfBlank(url.searchParams.get("channel")) ?? nullIfBlank(request.headers.get("X-BUS-Core-Channel"))
  );
}

function resolveUpdateAvailability(
  clientVersion: string | null,
  latestVersion: string | null
): ReleaseUpdateAvailability {
  if (!clientVersion || !latestVersion) {
    return "unknown";
  }

  return compareSemver(latestVersion, clientVersion) > 0 ? "true" : "false";
}

// Parse the optional aggregate-safe `first_check` query param.
//   true  / 1 -> first-seen check
//   false / 0 -> repeat check
//   missing / invalid -> unknown first-check status
// Strict allow-list only. Never inferred from IP, user agent, cookies, or timing.
function resolveFirstCheckSignal(url: URL): ReleaseFirstCheck {
  const raw = nullIfBlank(url.searchParams.get("first_check"));
  if (raw === null) {
    return "unknown";
  }

  const normalized = raw.toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return "true";
  }
  if (normalized === "false" || normalized === "0") {
    return "false";
  }

  return "unknown";
}

function shouldCountArtifactDownload(request: Request): boolean {
  return request.method === "GET" && !request.headers.has("Range");
}

function getSiteByKey(siteKey: string): TrackedSite | undefined {
  return TRACKED_SITES.find((s) => s.site_key === siteKey);
}

function siteSupportsLegacyPageviews(site: TrackedSite): boolean {
  return site.site_key === "buscore";
}

export function supportClassForSite(site: {
  status: SiteStatus;
  cloudflare_traffic_enabled: boolean;
  site_key: string;
}): SupportClass {
  if (site.status !== "active") {
    return "not_yet_normalized";
  }

  if (site.site_key === "buscore") {
    return "legacy_hybrid";
  }

  if (site.cloudflare_traffic_enabled) {
    return "event_plus_cf_traffic";
  }

  return "event_only";
}

export function sectionAvailabilityForSupportClass(supportClass: SupportClass): SiteSectionAvailability {
  if (supportClass === "legacy_hybrid") {
    return {
      summary: true,
      today: true,
      traffic: true,
      human_traffic_events: true,
      observability: true,
      identity: true,
      read: true,
    };
  }

  if (supportClass === "event_plus_cf_traffic") {
    return {
      summary: true,
      today: true,
      traffic: true,
      human_traffic_events: true,
      observability: true,
      identity: false,
      read: true,
    };
  }

  if (supportClass === "event_only") {
    return {
      summary: true,
      today: true,
      traffic: false,
      human_traffic_events: true,
      observability: true,
      identity: false,
      read: true,
    };
  }

  return {
    summary: true,
    today: true,
    traffic: false,
    human_traffic_events: true,
    observability: true,
    identity: false,
    read: true,
  };
}

export function normalizeEventNameToCanonicalShared(eventName: string): SharedEventName | null {
  const normalized = eventName.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return SHARED_EVENT_ALIAS_TO_CANONICAL[normalized] ?? null;
}

export function classifyEventNameAgainstTaxonomy(eventName: string): EventTaxonomyKind {
  const canonical = normalizeEventNameToCanonicalShared(eventName);
  if (canonical) {
    return "shared";
  }
  return eventName.trim() ? "extension" : "invalid";
}

export function normalizeEventNameForReporting(eventName: string): string {
  const canonical = normalizeEventNameToCanonicalShared(eventName);
  if (canonical) {
    return canonical;
  }
  return eventName.trim();
}

export function computeAcceptedSignal7d(input: {
  acceptedEvents7d: number;
  pageviews7d: number | null;
}): number {
  return (input.pageviews7d ?? 0) + input.acceptedEvents7d;
}

export function hasRecentSignalFromAcceptedSignal7d(acceptedSignal7d: number): boolean {
  return acceptedSignal7d > 0;
}

export function supportsIdentityForSite(site: {
  status: SiteStatus;
  cloudflare_traffic_enabled: boolean;
  site_key: string;
}): boolean {
  const supportClass = supportClassForSite(site);
  return sectionAvailabilityForSupportClass(supportClass).identity;
}

function defaultSiteEventFilter(site: TrackedSite): SiteEventFilter {
  return {
    siteKey: site.site_key,
    excludeTestMode: true,
    productionOnly: site.production_only_default,
  };
}

function backendSourceForSite(site: TrackedSite): string {
  const sources: string[] = ["site_events_raw"];

  if (siteSupportsLegacyPageviews(site)) {
    sources.unshift("pageview_daily");
  }

  if (site.cloudflare_traffic_enabled) {
    sources.push("buscore_traffic_daily");
  }

  return sources.join("+");
}

function maxIsoTimestamp(...values: Array<string | null>): string | null {
  let current: string | null = null;

  for (const value of values) {
    if (!value) {
      continue;
    }

    if (!current || value > current) {
      current = value;
    }
  }

  return current;
}

function reportWindow(startDay: string, endDay: string): ReportWindow {
  return {
    start_day: startDay,
    end_day: endDay,
    timezone: "UTC",
    semantics: "current_utc_day_plus_previous_6_days",
  };
}

function emptyTrafficTotals(): TrafficTotals {
  return {
    row_count: 0,
    visits: null,
    requests: null,
  };
}

export function normalizeReportView(value: string | null): ReportView | null {
  const normalized = value?.trim();
  if (!normalized) {
    return "legacy";
  }

  if (
    normalized === "fleet" ||
    normalized === "site" ||
    normalized === "source_health" ||
    normalized === "asset" ||
    normalized === "monthly"
  ) {
    return normalized;
  }

  return null;
}

export function resolveReportRequest(url: URL): ReportRequestResolution {
  const view = normalizeReportView(url.searchParams.get("view"));
  if (!view) {
    return { ok: false, error: "invalid_view" };
  }

  if (view === "legacy") {
    const hasSiteKeyParam = url.searchParams.has("site_key");
    const siteEventFilter = normalizeSiteEventFilter(url);
    if (hasSiteKeyParam && !siteEventFilter) {
      return { ok: false, error: "invalid_site_key" };
    }

    return { ok: true, view, siteEventFilter };
  }

  if (view === "site") {
    const siteKey = nullIfBlank(url.searchParams.get("site_key"));
    if (!siteKey) {
      return { ok: false, error: "missing_site_key" };
    }

    const siteEventFilter = normalizeSiteEventFilter(url);
    if (!siteEventFilter) {
      return { ok: false, error: "invalid_site_key" };
    }

    return { ok: true, view, siteEventFilter };
  }

  return { ok: true, view };
}

function getAllActiveAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  for (const site of TRACKED_SITES) {
    if (site.status === "active") {
      for (const origin of site.allowed_origins) {
        origins.add(origin);
      }
    }
  }
  return origins;
}

function emptyPageviewInput(): PageviewInput {
  return {
    client_ts: null,
    path: null,
    url: null,
    referrer: null,
    src: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    device: null,
    viewport: null,
    lang: null,
    tz: null,
    anon_user_id: null,
    session_id: null,
    is_new_user: 0,
  };
}

export function normalizeOptionalAnonymousId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > 128) {
    return null;
  }

  // Keep ingest permissive for backward compatibility while filtering obvious garbage.
  if (!UUID_V4_PATTERN.test(normalized)) {
    return null;
  }

  return normalized.toLowerCase();
}

export function coerceBooleanLikeToInt(value: unknown): number {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return value === 1 ? 1 : 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(normalized)) {
      return 1;
    }
    if (["0", "false", "no", "n", "off", ""].includes(normalized)) {
      return 0;
    }
  }

  return 0;
}

function readRequiredString(root: Record<string, unknown>, key: string, allowEmpty: boolean = false): string | null {
  const raw = root[key];
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim();
  if (!allowEmpty && !normalized) {
    return null;
  }

  return normalized;
}

function readOptionalString(value: unknown): string | null {
  return nullIfBlank(value);
}

function isValidAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function parseCanonicalPageviewPayload(payload: unknown): PageviewInput | null {
  const root = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  if (root.type !== "pageview") {
    return null;
  }

  const clientTs = readRequiredString(root, "client_ts");
  const path = readRequiredString(root, "path");
  const url = readRequiredString(root, "url");
  const referrer = readRequiredString(root, "referrer", true);
  const device = readRequiredString(root, "device");
  const viewport = readRequiredString(root, "viewport");
  const lang = readRequiredString(root, "lang", true);
  const tz = readRequiredString(root, "tz", true);
  const utmRaw = root.utm;

  if (
    !clientTs ||
    !path ||
    !url ||
    referrer === null ||
    !device ||
    !viewport ||
    lang === null ||
    tz === null ||
    typeof utmRaw !== "object" ||
    utmRaw === null ||
    Array.isArray(utmRaw)
  ) {
    return null;
  }

  if (!Number.isFinite(Date.parse(clientTs))) {
    return null;
  }

  if (!path.startsWith("/")) {
    return null;
  }

  if (!isValidAbsoluteUrl(url)) {
    return null;
  }

  if (!PAGEVIEW_ALLOWED_DEVICES.has(device)) {
    return null;
  }

  if (!PAGEVIEW_VIEWPORT_PATTERN.test(viewport)) {
    return null;
  }

  const utm = utmRaw as Record<string, unknown>;

  return {
    client_ts: clientTs,
    path,
    url,
    referrer,
    src: readOptionalString(root.src),
    utm_source: readOptionalString(utm.source),
    utm_medium: readOptionalString(utm.medium),
    utm_campaign: readOptionalString(utm.campaign),
    utm_content: readOptionalString(utm.content),
    device,
    viewport,
    lang,
    tz,
    anon_user_id: normalizeOptionalAnonymousId(root.anon_user_id),
    session_id: normalizeOptionalAnonymousId(root.session_id),
    is_new_user: coerceBooleanLikeToInt(root.is_new_user),
  };
}

export function parseCanonicalEventPayload(payload: unknown): SiteEventInput | null {
  const root = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const siteKey = readRequiredString(root, "site_key");
  const eventName = readRequiredString(root, "event_name");
  const clientTs = readRequiredString(root, "client_ts");
  const path = readRequiredString(root, "path");
  const url = readRequiredString(root, "url");
  const referrer = readRequiredString(root, "referrer", true);
  const device = readRequiredString(root, "device");
  const viewport = readRequiredString(root, "viewport");
  const lang = readRequiredString(root, "lang", true);
  const tz = readRequiredString(root, "tz", true);
  const utmRaw = root.utm;

  if (
    !siteKey ||
    !eventName ||
    !clientTs ||
    !path ||
    !url ||
    referrer === null ||
    !device ||
    !viewport ||
    lang === null ||
    tz === null ||
    typeof utmRaw !== "object" ||
    utmRaw === null ||
    Array.isArray(utmRaw)
  ) {
    return null;
  }

  if (!Number.isFinite(Date.parse(clientTs))) {
    return null;
  }

  if (!path.startsWith("/")) {
    return null;
  }

  if (!isValidAbsoluteUrl(url)) {
    return null;
  }

  if (!PAGEVIEW_ALLOWED_DEVICES.has(device)) {
    return null;
  }

  if (!PAGEVIEW_VIEWPORT_PATTERN.test(viewport)) {
    return null;
  }

  if (!getSiteByKey(siteKey)) {
    return null;
  }

  const utm = utmRaw as Record<string, unknown>;

  return {
    site_key: siteKey,
    event_name: eventName,
    client_ts: clientTs,
    path,
    url,
    referrer,
    src: readOptionalString(root.src),
    utm_source: readOptionalString(utm.source),
    utm_medium: readOptionalString(utm.medium),
    utm_campaign: readOptionalString(utm.campaign),
    utm_content: readOptionalString(utm.content),
    device,
    viewport,
    lang,
    tz,
    anon_user_id: normalizeOptionalAnonymousId(root.anon_user_id),
    session_id: normalizeOptionalAnonymousId(root.session_id),
    is_new_user: coerceBooleanLikeToInt(root.is_new_user),
    event_value: readOptionalString(root.event_value),
    test_mode: coerceBooleanLikeToInt(root.test_mode),
  };
}

function parseReferrerDomain(referrer: string | null): string | null {
  if (!referrer) {
    return null;
  }

  try {
    const hostname = new URL(referrer).hostname.trim().toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (chunk) => chunk.toString(16).padStart(2, "0")).join("");
}

async function incrementCounter(db: D1Database, day: string, column: CounterColumn): Promise<void> {
  await db
    .prepare(
      "INSERT INTO metrics_daily(day, update_checks, downloads, errors) VALUES (?,0,0,0) ON CONFLICT(day) DO NOTHING"
    )
    .bind(day)
    .run();

  await db
    .prepare(`UPDATE metrics_daily SET ${column} = ${column} + 1 WHERE day = ?`)
    .bind(day)
    .run();
}

async function incrementReleaseDownloadCounter(
  db: D1Database,
  day: string,
  filename: string,
  releaseVersion: string
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO release_downloads_daily(day, filename, release_version, downloads) VALUES (?, ?, ?, 1) ON CONFLICT(day, filename, release_version) DO UPDATE SET downloads = downloads + 1"
    )
    .bind(day, filename, releaseVersion)
    .run();
}

async function incrementReleaseUpdateCheckCounter(
  db: D1Database,
  day: string,
  channel: string,
  clientVersion: string,
  latestVersion: string,
  updateAvailable: ReleaseUpdateAvailability,
  firstCheck: ReleaseFirstCheck
): Promise<void> {
  // Additive first-check counters live on the existing row key so we never
  // explode rows or introduce any per-request identity. Exactly one of the
  // three deltas is 1 per call.
  const firstCheckTrue = firstCheck === "true" ? 1 : 0;
  const firstCheckFalse = firstCheck === "false" ? 1 : 0;
  const firstCheckUnknown = firstCheck === "unknown" ? 1 : 0;

  await db
    .prepare(
      "INSERT INTO release_update_checks_daily(day, channel, client_version, latest_version, update_available, checks, first_check_true, first_check_false, first_check_unknown) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?) ON CONFLICT(day, channel, client_version, latest_version, update_available) DO UPDATE SET checks = checks + 1, first_check_true = first_check_true + excluded.first_check_true, first_check_false = first_check_false + excluded.first_check_false, first_check_unknown = first_check_unknown + excluded.first_check_unknown"
    )
    .bind(day, channel, clientVersion, latestVersion, updateAvailable, firstCheckTrue, firstCheckFalse, firstCheckUnknown)
    .run();
}

async function incrementReleaseDownloadCounterBestEffort(
  db: D1Database,
  day: string,
  filename: string,
  releaseVersion: string
): Promise<void> {
  try {
    await incrementReleaseDownloadCounter(db, day, filename, releaseVersion);
  } catch (error) {
    console.warn("Release download aggregate increment skipped after D1 failure.", error);
  }
}

async function incrementReleaseUpdateCheckCounterBestEffort(
  db: D1Database,
  day: string,
  channel: string,
  clientVersion: string,
  latestVersion: string,
  updateAvailable: ReleaseUpdateAvailability,
  firstCheck: ReleaseFirstCheck
): Promise<void> {
  try {
    await incrementReleaseUpdateCheckCounter(db, day, channel, clientVersion, latestVersion, updateAvailable, firstCheck);
  } catch (error) {
    console.warn("Release update-check aggregate increment skipped after D1 failure.", error);
  }
}

async function incrementErrorCounterBestEffort(db: D1Database, day: string): Promise<void> {
  try {
    await incrementCounter(db, day, "errors");
  } catch {
    // Best effort only; avoid masking original failures.
  }
}

async function readManifestFromR2(env: Env): Promise<{ raw: string; parsed: Record<string, unknown> }> {
  const object = await env.MANIFEST_R2.get(MANIFEST_KEY);
  if (!object) {
    throw new Error("manifest_not_found");
  }

  const raw = await object.text();
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return { raw, parsed };
}

function extractLatestDownloadUrl(manifest: Record<string, unknown>): string | null {
  const latest = manifest.latest as Record<string, unknown> | undefined;
  const download = latest?.download as Record<string, unknown> | undefined;
  const value = download?.url;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function extractLatestManifestVersion(manifest: Record<string, unknown>): string | null {
  const latest = manifest.latest as Record<string, unknown> | undefined;
  const fromManifest = normalizeSemver(typeof latest?.version === "string" ? latest.version : null);
  if (fromManifest) {
    return fromManifest;
  }

  const latestUrl = extractLatestDownloadUrl(manifest);
  if (!latestUrl) {
    return null;
  }

  try {
    const parsed = new URL(latestUrl, "https://lighthouse.invalid");
    const filename = parsed.pathname.split("/").pop() ?? "";
    return extractReleaseVersionFromFilename(filename);
  } catch {
    return null;
  }
}

export function isValidReleaseArtifactUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl, "https://lighthouse.invalid");
    const releaseMatch = parsed.pathname.match(RELEASE_PATH);
    if (!releaseMatch) return false;
    return RELEASE_FILENAME.test(releaseMatch[1]);
  } catch {
    return false;
  }
}

function toAbsoluteReleaseUrl(rawUrl: string, requestOrigin: string): string | null {
  if (!isValidReleaseArtifactUrl(rawUrl)) {
    return null;
  }

  try {
    return new URL(rawUrl, requestOrigin).toString();
  } catch {
    return null;
  }
}

async function queryTotalsInRange(db: D1Database, startDay: string, endDay: string): Promise<MetricTotals> {
  const row = await db
    .prepare(
      "SELECT COALESCE(SUM(update_checks),0) AS update_checks, COALESCE(SUM(downloads),0) AS downloads, COALESCE(SUM(errors),0) AS errors FROM metrics_daily WHERE day >= ? AND day <= ?"
    )
    .bind(startDay, endDay)
    .first<MetricTotals>();

  return row ?? { update_checks: 0, downloads: 0, errors: 0 };
}

async function queryReleaseDownloadTotalsInRange(db: D1Database, startDay: string, endDay: string): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COALESCE(SUM(downloads),0) AS artifact_downloads FROM release_downloads_daily WHERE day >= ? AND day <= ?"
    )
    .bind(startDay, endDay)
    .first<{ artifact_downloads: number }>();

  return row?.artifact_downloads ?? 0;
}

async function queryReleaseDownloadBreakdownInRange(
  db: D1Database,
  startDay: string,
  endDay: string
): Promise<ReleaseDownloadSummaryRow[]> {
  const rows = await db
    .prepare(
      "SELECT release_version, filename, SUM(downloads) AS downloads FROM release_downloads_daily WHERE day >= ? AND day <= ? GROUP BY release_version, filename ORDER BY downloads DESC, release_version DESC, filename ASC"
    )
    .bind(startDay, endDay)
    .all<ReleaseDownloadSummaryRow>();

  return rows.results ?? [];
}

async function queryReleaseUpdateSignalsInRange(
  db: D1Database,
  startDay: string,
  endDay: string
): Promise<Omit<
  ReleaseSignalWindow,
  "artifact_downloads" | "artifact_downloads_by_release" | "raw_update_checks" | "breakdown_update_checks" | "raw_breakdown_delta"
>> {
  const row = await db
    .prepare(
      "SELECT COALESCE(SUM(checks),0) AS update_checks, COALESCE(SUM(CASE WHEN client_version != ? THEN checks ELSE 0 END),0) AS update_checks_with_known_client_version, COALESCE(SUM(CASE WHEN client_version = ? THEN checks ELSE 0 END),0) AS update_checks_unknown_client_version, COALESCE(SUM(CASE WHEN update_available = 'true' THEN checks ELSE 0 END),0) AS update_available_impressions, COALESCE(SUM(CASE WHEN update_available = 'false' AND client_version = latest_version AND client_version != ? THEN checks ELSE 0 END),0) AS latest_version_checkins, COALESCE(SUM(first_check_true),0) AS first_seen_checkins, COALESCE(SUM(first_check_false),0) AS repeat_checkins, COALESCE(SUM(first_check_unknown),0) AS unknown_first_checkins FROM release_update_checks_daily WHERE day >= ? AND day <= ?"
    )
    .bind(UNKNOWN_VERSION_BUCKET, UNKNOWN_VERSION_BUCKET, UNKNOWN_VERSION_BUCKET, startDay, endDay)
    .first<ReleaseUpdateSignalAggregateRow>();

  const firstSeenCheckins = row?.first_seen_checkins ?? 0;
  const repeatCheckins = row?.repeat_checkins ?? 0;
  const firstCheckKnown = firstSeenCheckins + repeatCheckins;

  return {
    update_checks: row?.update_checks ?? 0,
    update_checks_with_known_client_version: row?.update_checks_with_known_client_version ?? 0,
    update_checks_unknown_client_version: row?.update_checks_unknown_client_version ?? 0,
    update_available_impressions: row?.update_available_impressions ?? 0,
    latest_version_checkins: row?.latest_version_checkins ?? 0,
    first_seen_checkins: firstSeenCheckins,
    repeat_checkins: repeatCheckins,
    unknown_first_checkins: row?.unknown_first_checkins ?? 0,
    // Share of known-status check-ins that were first-seen. 0 when no known-status
    // check-ins exist, matching the repo's number-only report style (never null).
    first_seen_share: firstCheckKnown > 0 ? firstSeenCheckins / firstCheckKnown : 0,
  };
}

function emptyReleaseSignalWindow(): ReleaseSignalWindow {
  return {
    artifact_downloads: 0,
    artifact_downloads_by_release: [],
    raw_update_checks: 0,
    breakdown_update_checks: 0,
    raw_breakdown_delta: 0,
    update_checks: 0,
    update_checks_with_known_client_version: 0,
    update_checks_unknown_client_version: 0,
    update_available_impressions: 0,
    latest_version_checkins: 0,
    first_seen_checkins: 0,
    repeat_checkins: 0,
    unknown_first_checkins: 0,
    first_seen_share: 0,
  };
}

async function buildReleaseSignalWindow(
  db: D1Database,
  startDay: string,
  endDay: string
): Promise<ReleaseSignalWindow> {
  try {
    const [rawTotals, artifactDownloads, artifactDownloadBreakdown, updateSignals] = await Promise.all([
      queryTotalsInRange(db, startDay, endDay),
      queryReleaseDownloadTotalsInRange(db, startDay, endDay),
      queryReleaseDownloadBreakdownInRange(db, startDay, endDay),
      queryReleaseUpdateSignalsInRange(db, startDay, endDay),
    ]);

    return {
      artifact_downloads: artifactDownloads,
      artifact_downloads_by_release: artifactDownloadBreakdown,
      raw_update_checks: rawTotals.update_checks,
      breakdown_update_checks: updateSignals.update_checks,
      raw_breakdown_delta: rawTotals.update_checks - updateSignals.update_checks,
      ...updateSignals,
    };
  } catch (error) {
    console.warn("Release signal report window unavailable; returning zeroed additive release_signals window.", error);
    return emptyReleaseSignalWindow();
  }
}

async function queryTrafficTotalsInRange(db: D1Database, startDay: string, endDay: string): Promise<TrafficTotals> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS row_count, CASE WHEN COUNT(visits) = 0 THEN NULL ELSE SUM(visits) END AS visits, CASE WHEN COUNT(*) = 0 THEN NULL ELSE SUM(requests) END AS requests FROM buscore_traffic_daily WHERE day >= ? AND day <= ?"
    )
    .bind(startDay, endDay)
    .first<TrafficTotals>();

  return row ?? { row_count: 0, visits: null, requests: null };
}

async function queryLatestTrafficRow(db: D1Database): Promise<TrafficRow | null> {
  const row = await db
    .prepare("SELECT day, visits, requests, captured_at FROM buscore_traffic_daily ORDER BY day DESC LIMIT 1")
    .first<TrafficRow>();

  return row ?? null;
}

async function queryPageviewTotalsForDay(
  db: D1Database,
  day: string
): Promise<{ pageviews: number; last_received_at: string | null }> {
  const row = await db
    .prepare("SELECT pageviews, last_received_at FROM pageview_daily WHERE day = ?")
    .bind(day)
    .first<{ pageviews: number; last_received_at: string | null }>();

  return row ?? { pageviews: 0, last_received_at: null };
}

async function queryPageviewRangeSummary(
  db: D1Database,
  startDay: string,
  endDay: string
): Promise<PageviewRangeSummary> {
  const row = await db
    .prepare(
      "SELECT COALESCE(SUM(pageviews),0) AS pageviews, COALESCE(SUM(accepted),0) AS accepted, COALESCE(SUM(dropped_rate_limited),0) AS dropped_rate_limited, COALESCE(SUM(dropped_invalid),0) AS dropped_invalid, MAX(last_received_at) AS last_received_at, COALESCE(SUM(CASE WHEN pageviews > 0 THEN 1 ELSE 0 END),0) AS days_with_data FROM pageview_daily WHERE day >= ? AND day <= ?"
    )
    .bind(startDay, endDay)
    .first<PageviewRangeSummary>();

  return {
    pageviews: row?.pageviews ?? 0,
    accepted: row?.accepted ?? 0,
    dropped_rate_limited: row?.dropped_rate_limited ?? 0,
    dropped_invalid: row?.dropped_invalid ?? 0,
    last_received_at: row?.last_received_at ?? null,
    days_with_data: row?.days_with_data ?? 0,
  };
}

async function queryPageviewLast7Summary(db: D1Database, startDay: string, endDay: string): Promise<{ pageviews: number; days_with_data: number }> {
  const row = await db
    .prepare(
      "SELECT COALESCE(SUM(pageviews),0) AS pageviews, COALESCE(SUM(CASE WHEN pageviews > 0 THEN 1 ELSE 0 END),0) AS days_with_data FROM pageview_daily WHERE day >= ? AND day <= ?"
    )
    .bind(startDay, endDay)
    .first<{ pageviews: number; days_with_data: number }>();

  return row ?? { pageviews: 0, days_with_data: 0 };
}

async function queryPageviewObservability(db: D1Database): Promise<{
  accepted: number;
  dropped_rate_limited: number;
  dropped_invalid: number;
  last_received_at: string | null;
}> {
  const row = await db
    .prepare(
      "SELECT COALESCE(SUM(accepted),0) AS accepted, COALESCE(SUM(dropped_rate_limited),0) AS dropped_rate_limited, COALESCE(SUM(dropped_invalid),0) AS dropped_invalid, MAX(last_received_at) AS last_received_at FROM pageview_daily"
    )
    .first<PageviewSummaryRow>();

  return {
    accepted: row?.accepted ?? 0,
    dropped_rate_limited: row?.dropped_rate_limited ?? 0,
    dropped_invalid: row?.dropped_invalid ?? 0,
    last_received_at: row?.last_received_at ?? null,
  };
}

async function queryTopPageviewDimensions(
  db: D1Database,
  startDay: string,
  endDay: string,
  dimType: string,
  limit: number = TOP_PAGEVIEW_DIMENSION_LIMIT
): Promise<TopPageviewDimRow[]> {
  const rows = await db
    .prepare(
      "SELECT dim_value AS value, SUM(count) AS pageviews FROM pageview_daily_dim WHERE day >= ? AND day <= ? AND dim_type = ? GROUP BY dim_value ORDER BY pageviews DESC, dim_value ASC LIMIT ?"
    )
    .bind(startDay, endDay, dimType, limit)
    .all<TopPageviewDimRow>();

  return rows.results ?? [];
}

async function queryTopPageviewSources(
  db: D1Database,
  startDay: string,
  endDay: string,
  limit: number = TOP_PAGEVIEW_DIMENSION_LIMIT
): Promise<Array<{ source: string; pageviews: number }>> {
  const rows = await db
    .prepare(
      "SELECT COALESCE(NULLIF(src, ''), NULLIF(utm_source, ''), ?) AS source, COUNT(*) AS pageviews FROM pageview_events_raw WHERE accepted = 1 AND received_day >= ? AND received_day <= ? GROUP BY source ORDER BY pageviews DESC, source ASC LIMIT ?"
    )
    .bind(DIRECT_SOURCE_LABEL, startDay, endDay, limit)
    .all<{ source: string; pageviews: number }>();

  return rows.results ?? [];
}

function buildSiteEventFilterWhereClause(
  filter: SiteEventFilter,
  options?: { includeAccepted?: boolean }
): { whereSql: string; bindings: Array<string | number> } {
  const where: string[] = ["site_key = ?", "received_day >= ?", "received_day <= ?"];
  const bindings: Array<string | number> = [filter.siteKey];

  if (options?.includeAccepted !== false) {
    where.push("accepted = 1");
  }

  if (filter.excludeTestMode) {
    where.push("test_mode = 0");
  }

  return {
    whereSql: where.join(" AND "),
    bindings,
  };
}

export function buildProductionHostClause(site: TrackedSite): { sql: string; bindings: string[] } {
  if (site.production_hosts.length === 0) {
    return { sql: "1 = 0", bindings: [] };
  }

  const hostSql: string[] = [];
  const bindings: string[] = [];
  for (const host of site.production_hosts) {
    hostSql.push("LOWER(url) LIKE ?", "LOWER(url) LIKE ?");
    bindings.push(`https://${host.toLowerCase()}/%`, `http://${host.toLowerCase()}/%`);
  }

  return {
    sql: `(${hostSql.join(" OR ")})`,
    bindings,
  };
}

async function querySiteEventOverview(
  db: D1Database,
  filter: SiteEventFilter,
  startDay: string,
  endDay: string
): Promise<{ accepted_events: number; unique_paths: number; last_received_at: string | null }> {
  const site = getSiteByKey(filter.siteKey);
  if (!site) {
    return { accepted_events: 0, unique_paths: 0, last_received_at: null };
  }

  const base = buildSiteEventFilterWhereClause(filter);
  const where: string[] = [base.whereSql];
  const bindings: Array<string | number> = [...base.bindings, startDay, endDay];

  if (filter.productionOnly) {
    const production = buildProductionHostClause(site);
    where.push(production.sql);
    bindings.push(...production.bindings);
  }

  const row = await db
    .prepare(
      `SELECT COUNT(*) AS accepted_events, COUNT(DISTINCT NULLIF(path, '')) AS unique_paths, MAX(received_at) AS last_received_at FROM site_events_raw WHERE ${where.join(" AND ")}`
    )
    .bind(...bindings)
    .first<{ accepted_events: number; unique_paths: number; last_received_at: string | null }>();

  return {
    accepted_events: row?.accepted_events ?? 0,
    unique_paths: row?.unique_paths ?? 0,
    last_received_at: row?.last_received_at ?? null,
  };
}

async function querySiteEventsByEventName(
  db: D1Database,
  filter: SiteEventFilter,
  startDay: string,
  endDay: string,
  limit: number = TOP_PAGEVIEW_DIMENSION_LIMIT
): Promise<Array<{ event_name: string; events: number }>> {
  const site = getSiteByKey(filter.siteKey);
  if (!site) {
    return [];
  }

  const base = buildSiteEventFilterWhereClause(filter);
  const where: string[] = [base.whereSql];
  const bindings: Array<string | number> = [...base.bindings, startDay, endDay];

  if (filter.productionOnly) {
    const production = buildProductionHostClause(site);
    where.push(production.sql);
    bindings.push(...production.bindings);
  }

  const rows = await db
    .prepare(
      `SELECT event_name, COUNT(*) AS events FROM site_events_raw WHERE ${where.join(" AND ")} GROUP BY event_name ORDER BY events DESC, event_name ASC LIMIT ?`
    )
    .bind(...bindings, 1000)
    .all<{ event_name: string; events: number }>();

  const normalizedCounts = new Map<string, number>();
  for (const row of rows.results ?? []) {
    const normalizedName = normalizeEventNameForReporting(row.event_name);
    if (!normalizedName) {
      continue;
    }

    normalizedCounts.set(normalizedName, (normalizedCounts.get(normalizedName) ?? 0) + (row.events ?? 0));
  }

  return Array.from(normalizedCounts.entries())
    .map(([event_name, events]) => ({ event_name, events }))
    .sort((a, b) => (b.events - a.events) || a.event_name.localeCompare(b.event_name))
    .slice(0, limit);
}

async function querySiteEventTopCampaigns(
  db: D1Database,
  filter: SiteEventFilter,
  startDay: string,
  endDay: string,
  limit: number = TOP_PAGEVIEW_DIMENSION_LIMIT
): Promise<Array<{ utm_campaign: string; events: number }>> {
  const site = getSiteByKey(filter.siteKey);
  if (!site) {
    return [];
  }

  const base = buildSiteEventFilterWhereClause(filter);
  const where: string[] = [base.whereSql, "NULLIF(utm_campaign, '') IS NOT NULL"];
  const bindings: Array<string | number> = [...base.bindings, startDay, endDay];

  if (filter.productionOnly) {
    const production = buildProductionHostClause(site);
    where.push(production.sql);
    bindings.push(...production.bindings);
  }

  const rows = await db
    .prepare(
      `SELECT utm_campaign, COUNT(*) AS events FROM site_events_raw WHERE ${where.join(" AND ")} GROUP BY utm_campaign ORDER BY events DESC, utm_campaign ASC LIMIT ?`
    )
    .bind(...bindings, limit)
    .all<{ utm_campaign: string; events: number }>();

  return rows.results ?? [];
}

async function querySiteEventTopReferrers(
  db: D1Database,
  filter: SiteEventFilter,
  startDay: string,
  endDay: string,
  limit: number = TOP_PAGEVIEW_DIMENSION_LIMIT
): Promise<Array<{ referrer_domain: string; events: number }>> {
  const site = getSiteByKey(filter.siteKey);
  if (!site) {
    return [];
  }

  const base = buildSiteEventFilterWhereClause(filter);
  const where: string[] = [base.whereSql, "NULLIF(referrer_domain, '') IS NOT NULL"];
  const bindings: Array<string | number> = [...base.bindings, startDay, endDay];

  if (filter.productionOnly) {
    const production = buildProductionHostClause(site);
    where.push(production.sql);
    bindings.push(...production.bindings);
  }

  const rows = await db
    .prepare(
      `SELECT referrer_domain, COUNT(*) AS events FROM site_events_raw WHERE ${where.join(" AND ")} GROUP BY referrer_domain ORDER BY events DESC, referrer_domain ASC LIMIT ?`
    )
    .bind(...bindings, limit)
    .all<{ referrer_domain: string; events: number }>();

  return rows.results ?? [];
}

async function querySiteEventTopPaths(
  db: D1Database,
  filter: SiteEventFilter,
  startDay: string,
  endDay: string,
  limit: number = TOP_PAGEVIEW_DIMENSION_LIMIT
): Promise<Array<{ path: string; events: number }>> {
  const site = getSiteByKey(filter.siteKey);
  if (!site) {
    return [];
  }

  const base = buildSiteEventFilterWhereClause(filter);
  const where: string[] = [base.whereSql, "NULLIF(path, '') IS NOT NULL"];
  const bindings: Array<string | number> = [...base.bindings, startDay, endDay];

  if (filter.productionOnly) {
    const production = buildProductionHostClause(site);
    where.push(production.sql);
    bindings.push(...production.bindings);
  }

  const rows = await db
    .prepare(
      `SELECT path, COUNT(*) AS events FROM site_events_raw WHERE ${where.join(" AND ")} GROUP BY path ORDER BY events DESC, path ASC LIMIT ?`
    )
    .bind(...bindings, limit)
    .all<{ path: string; events: number }>();

  return rows.results ?? [];
}

async function querySiteEventTopContents(
  db: D1Database,
  filter: SiteEventFilter,
  startDay: string,
  endDay: string,
  limit: number = TOP_PAGEVIEW_DIMENSION_LIMIT
): Promise<Array<{ utm_content: string; events: number }>> {
  const site = getSiteByKey(filter.siteKey);
  if (!site) {
    return [];
  }

  const base = buildSiteEventFilterWhereClause(filter);
  const where: string[] = [base.whereSql, "NULLIF(utm_content, '') IS NOT NULL"];
  const bindings: Array<string | number> = [...base.bindings, startDay, endDay];

  if (filter.productionOnly) {
    const production = buildProductionHostClause(site);
    where.push(production.sql);
    bindings.push(...production.bindings);
  }

  const rows = await db
    .prepare(
      `SELECT utm_content, COUNT(*) AS events FROM site_events_raw WHERE ${where.join(" AND ")} GROUP BY utm_content ORDER BY events DESC, utm_content ASC LIMIT ?`
    )
    .bind(...bindings, limit)
    .all<{ utm_content: string; events: number }>();

  return rows.results ?? [];
}

async function querySiteEventSourceRows(
  db: D1Database,
  filter: SiteEventFilter,
  startDay: string,
  endDay: string
): Promise<Array<{ src: string | null; utm_source: string | null; referrer_domain: string | null }>> {
  const site = getSiteByKey(filter.siteKey);
  if (!site) {
    return [];
  }

  const base = buildSiteEventFilterWhereClause(filter);
  const where: string[] = [base.whereSql];
  const bindings: Array<string | number> = [...base.bindings, startDay, endDay];

  if (filter.productionOnly) {
    const production = buildProductionHostClause(site);
    where.push(production.sql);
    bindings.push(...production.bindings);
  }

  const rows = await db
    .prepare(
      `SELECT src, utm_source, referrer_domain FROM site_events_raw WHERE ${where.join(" AND ")}`
    )
    .bind(...bindings)
    .all<{ src: string | null; utm_source: string | null; referrer_domain: string | null }>();

  return rows.results ?? [];
}

async function querySiteEventObservability(
  db: D1Database,
  filter: SiteEventFilter,
  startDay: string,
  endDay: string
): Promise<{
  included_events: number;
  excluded_test_mode: number;
  excluded_non_production_host: number;
  dropped_rate_limited: number;
  dropped_invalid: number;
}> {
  const site = getSiteByKey(filter.siteKey);
  if (!site) {
    return {
      included_events: 0,
      excluded_test_mode: 0,
      excluded_non_production_host: 0,
      dropped_rate_limited: 0,
      dropped_invalid: 0,
    };
  }

  const production = buildProductionHostClause(site);
  const row = await db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN accepted = 1 ${filter.excludeTestMode ? "AND test_mode = 0" : ""} ${
          filter.productionOnly ? `AND (${production.sql})` : ""
        } THEN 1 ELSE 0 END), 0) AS included_events,
        COALESCE(SUM(CASE WHEN accepted = 1 AND test_mode = 1 THEN 1 ELSE 0 END), 0) AS excluded_test_mode,
        COALESCE(SUM(CASE WHEN accepted = 1 AND NOT (${production.sql}) THEN 1 ELSE 0 END), 0) AS excluded_non_production_host,
        COALESCE(SUM(CASE WHEN accepted = 0 AND drop_reason = 'rate_limited' THEN 1 ELSE 0 END), 0) AS dropped_rate_limited,
        COALESCE(SUM(CASE WHEN accepted = 0 AND drop_reason = 'invalid_json' THEN 1 ELSE 0 END), 0) AS dropped_invalid
      FROM site_events_raw
      WHERE site_key = ? AND received_day >= ? AND received_day <= ?`
    )
    .bind(
      ...(filter.productionOnly ? production.bindings : []),
      ...production.bindings,
      filter.siteKey,
      startDay,
      endDay
    )
    .first<{
      included_events: number;
      excluded_test_mode: number;
      excluded_non_production_host: number;
      dropped_rate_limited: number;
      dropped_invalid: number;
    }>();

  return {
    included_events: row?.included_events ?? 0,
    excluded_test_mode: row?.excluded_test_mode ?? 0,
    excluded_non_production_host: row?.excluded_non_production_host ?? 0,
    dropped_rate_limited: row?.dropped_rate_limited ?? 0,
    dropped_invalid: row?.dropped_invalid ?? 0,
  };
}

function summarizeSiteEventTopSources(
  rows: Array<{ src: string | null; utm_source: string | null; referrer_domain: string | null }>,
  limit: number = TOP_PAGEVIEW_DIMENSION_LIMIT
): Array<{ source: string; events: number }> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const source = resolveEventSourceLabel(row.src, row.utm_source, row.referrer_domain);
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([source, events]) => ({ source, events }))
    .sort((a, b) => (b.events - a.events) || a.source.localeCompare(b.source))
    .slice(0, limit);
}

async function querySiteIntentSourceRows(
  db: D1Database,
  filter: SiteEventFilter,
  startDay: string,
  endDay: string
): Promise<Array<{ event_name: string; src: string | null; utm_source: string | null; referrer_domain: string | null }>> {
  const site = getSiteByKey(filter.siteKey);
  if (!site) {
    return [];
  }

  const base = buildSiteEventFilterWhereClause(filter);
  const where: string[] = [base.whereSql, "event_name IN ('download_click', 'early_access_submit_success', 'github_click', 'discord_click', 'support_click', 'docs_click')"];
  const bindings: Array<string | number> = [...base.bindings, startDay, endDay];

  if (filter.productionOnly) {
    const production = buildProductionHostClause(site);
    where.push(production.sql);
    bindings.push(...production.bindings);
  }

  const rows = await db
    .prepare(`SELECT event_name, src, utm_source, referrer_domain FROM site_events_raw WHERE ${where.join(" AND ")}`)
    .bind(...bindings)
    .all<{ event_name: string; src: string | null; utm_source: string | null; referrer_domain: string | null }>();

  return rows.results ?? [];
}

function summarizeIntentRowsBySource(
  rows: Array<{ event_name: string; src: string | null; utm_source: string | null; referrer_domain: string | null }>,
  eventName: string | null,
  limit: number = TOP_PAGEVIEW_DIMENSION_LIMIT
): OperatorIntentSourceCount[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (eventName && row.event_name !== eventName) {
      continue;
    }

    const source = resolveEventSourceLabel(row.src, row.utm_source, row.referrer_domain);
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([source, events]) => ({ source, events }))
    .sort((a, b) => (b.events - a.events) || a.source.localeCompare(b.source))
    .slice(0, limit);
}

async function queryLeadSources(
  db: D1Database,
  startDay: string,
  endDay: string,
  limit: number = TOP_PAGEVIEW_DIMENSION_LIMIT
): Promise<OperatorLeadSourceCount[]> {
  const rows = await db
    .prepare(
      "SELECT COALESCE(NULLIF(utm_source, ''), NULLIF(src, ''), NULLIF(referrer_domain, '')) AS source, COUNT(*) AS leads FROM early_access_leads WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ? AND COALESCE(NULLIF(utm_source, ''), NULLIF(src, ''), NULLIF(referrer_domain, '')) IS NOT NULL GROUP BY source ORDER BY leads DESC, source ASC LIMIT ?"
    )
    .bind(startDay, endDay, limit)
    .all<OperatorLeadSourceCount>();

  return rows.results ?? [];
}

async function queryLeadCampaigns(
  db: D1Database,
  startDay: string,
  endDay: string,
  limit: number = TOP_PAGEVIEW_DIMENSION_LIMIT
): Promise<OperatorCampaignCount[]> {
  const rows = await db
    .prepare(
      "SELECT utm_campaign, COUNT(*) AS count FROM early_access_leads WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ? AND NULLIF(utm_campaign, '') IS NOT NULL GROUP BY utm_campaign ORDER BY count DESC, utm_campaign ASC LIMIT ?"
    )
    .bind(startDay, endDay, limit)
    .all<OperatorCampaignCount>();

  return rows.results ?? [];
}

async function queryDirectUnknownLeadCount(db: D1Database, startDay: string, endDay: string): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM early_access_leads WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ? AND NULLIF(src, '') IS NULL AND NULLIF(utm_source, '') IS NULL AND NULLIF(referrer_domain, '') IS NULL"
    )
    .bind(startDay, endDay)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

async function queryLeadAttributionCounts(db: D1Database, startDay: string, endDay: string): Promise<{ total: number; attributed: number }> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN COALESCE(NULLIF(utm_source, ''), NULLIF(src, ''), NULLIF(referrer_domain, '')) IS NOT NULL THEN 1 ELSE 0 END) AS attributed FROM early_access_leads WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?"
    )
    .bind(startDay, endDay)
    .first<{ total: number; attributed: number | null }>();

  return {
    total: row?.total ?? 0,
    attributed: row?.attributed ?? 0,
  };
}

export async function buildLeadAttributionSummary(
  db: D1Database | undefined,
  startDay: string,
  endDay: string
): Promise<{
  available: boolean;
  status: OperatorLeadAttributionStatus;
  message: string;
  errorReason?: string;
  leadsTotal: number | null;
  leadsAttributed: number | null;
  leadsUnknown: number | null;
  topSources: OperatorLeadSourceCount[] | null;
  topCampaigns: OperatorCampaignCount[] | null;
  directUnknown: number | null;
}> {
  if (!db) {
    return {
      available: false,
      status: "unavailable",
      message: "not available: BUSCORE_LEADS_DB binding is not configured",
      errorReason: "binding_not_configured",
      leadsTotal: null,
      leadsAttributed: null,
      leadsUnknown: null,
      topSources: null,
      topCampaigns: null,
      directUnknown: null,
    };
  }

  try {
    const [counts, topSources, topCampaigns, directUnknown] = await Promise.all([
      queryLeadAttributionCounts(db, startDay, endDay),
      queryLeadSources(db, startDay, endDay),
      queryLeadCampaigns(db, startDay, endDay),
      queryDirectUnknownLeadCount(db, startDay, endDay),
    ]);
    const status: OperatorLeadAttributionStatus = counts.total === 0
      ? "no_leads"
      : counts.attributed === 0
        ? "no_attributed_leads"
        : "available";
    const message = status === "no_leads"
      ? "No leads recorded yet."
      : status === "no_attributed_leads"
        ? "Leads recorded, but no attributed leads yet."
        : "Lead attribution available.";

    return {
      available: true,
      status,
      message,
      leadsTotal: counts.total,
      leadsAttributed: counts.attributed,
      leadsUnknown: directUnknown,
      topSources,
      topCampaigns,
      directUnknown,
    };
  } catch (error) {
    console.warn("Lead attribution summary unavailable for operator report.", error instanceof Error ? error.name : typeof error);
    return {
      available: false,
      status: "unavailable",
      message: "not available",
      errorReason: "query_failed",
      leadsTotal: null,
      leadsAttributed: null,
      leadsUnknown: null,
      topSources: null,
      topCampaigns: null,
      directUnknown: null,
    };
  }
}

function buildConversionRows(input: {
  pageviewsBySource: OperatorPageviewSourceCount[] | null;
  intentBySource: OperatorIntentSourceCount[];
  leadsBySource: OperatorLeadSourceCount[] | null;
}): OperatorConversionSource[] {
  const sources = new Set<string>();
  const pageviews = new Map<string, number>();
  const intents = new Map<string, number>();
  const leads = new Map<string, number>();

  for (const row of input.pageviewsBySource ?? []) {
    sources.add(row.source);
    pageviews.set(row.source, row.pageviews);
  }

  for (const row of input.intentBySource) {
    sources.add(row.source);
    intents.set(row.source, row.events);
  }

  for (const row of input.leadsBySource ?? []) {
    sources.add(row.source);
    leads.set(row.source, row.leads);
  }

  return Array.from(sources)
    .map((source) => {
      const pageviewCount = pageviews.get(source) ?? null;
      const leadCount = input.leadsBySource === null ? null : (leads.get(source) ?? 0);
      return {
        source,
        pageviews: pageviewCount,
        counted_intent: intents.get(source) ?? 0,
        leads: leadCount,
        lead_conversion_percent: pageviewCount && leadCount !== null ? (leadCount / pageviewCount) * 100 : null,
      };
    })
    .sort((a, b) => ((b.leads ?? 0) - (a.leads ?? 0)) || (b.counted_intent - a.counted_intent) || a.source.localeCompare(b.source));
}

async function buildOperatorSummary(
  analyticsDb: D1Database,
  leadsDb: D1Database | undefined,
  filter: SiteEventFilter,
  startDay: string,
  endDay: string,
  pageviewsBySource: OperatorPageviewSourceCount[] | null,
  eventLastReceivedAt: string | null,
  acceptedEvents: number,
  droppedRateLimited: number
): Promise<OperatorSummary> {
  const [leadSummary, intentRows] = await Promise.all([
    buildLeadAttributionSummary(leadsDb, startDay, endDay),
    querySiteIntentSourceRows(analyticsDb, filter, startDay, endDay),
  ]);
  const intentBySource = summarizeIntentRowsBySource(intentRows, null);
  const conversionRows = buildConversionRows({
    pageviewsBySource,
    intentBySource,
    leadsBySource: leadSummary.topSources,
  });
  const bestSource = leadSummary.topSources?.[0]?.source ?? intentBySource[0]?.source ?? pageviewsBySource?.[0]?.source ?? "not available";
  const weakUnknown = leadSummary.directUnknown === null ? "not available" : `${leadSummary.directUnknown} leads`;

  return {
    window: reportWindow(startDay, endDay),
    lead_attribution: {
      status: leadSummary.status,
      available: leadSummary.available,
      message: leadSummary.message,
      leads_7d_total: leadSummary.leadsTotal,
      leads_7d_attributed: leadSummary.leadsAttributed,
      leads_7d_unknown: leadSummary.leadsUnknown,
      top_sources: leadSummary.topSources === null
        ? null
        : leadSummary.topSources.map((row) => ({ source: row.source, count: row.leads })),
      top_campaigns: leadSummary.topCampaigns,
      attribution_window_days: 7,
      ...(leadSummary.errorReason ? { error_reason: leadSummary.errorReason } : {}),
    },
    source_to_lead: {
      available: leadSummary.available,
      message: leadSummary.message,
      top_sources_by_early_access_leads: leadSummary.topSources === null
        ? null
        : leadSummary.topSources.map((row) => ({ source: row.source, count: row.leads })),
      top_campaigns_by_early_access_leads: leadSummary.topCampaigns,
      direct_unknown_leads: leadSummary.directUnknown,
    },
    source_to_intent: {
      top_sources_by_download_click: summarizeIntentRowsBySource(intentRows, "download_click"),
      top_sources_by_early_access_submit_success: summarizeIntentRowsBySource(intentRows, "early_access_submit_success"),
      top_sources_by_github_click: summarizeIntentRowsBySource(intentRows, "github_click"),
      top_sources_by_discord_click: summarizeIntentRowsBySource(intentRows, "discord_click"),
      top_sources_by_support_click: summarizeIntentRowsBySource(intentRows, "support_click"),
      top_sources_by_docs_click: summarizeIntentRowsBySource(intentRows, "docs_click"),
    },
    conversion_summary: {
      page_views_by_source: pageviewsBySource,
      counted_intent_by_source: intentBySource,
      leads_by_source: leadSummary.topSources,
      conversion_by_source: conversionRows,
    },
    telemetry_health: {
      last_received_event_timestamp: eventLastReceivedAt,
      accepted_events_in_window: acceptedEvents,
      dropped_rate_limited_count: droppedRateLimited,
      warning: acceptedEvents > 0 ? null : "warning: no recent signal",
    },
    operator_note: {
      best_source_this_period: `Best source this period: ${bestSource}`,
      weak_unknown_attribution: `Weak/unknown attribution: ${weakUnknown}`,
    },
  };
}

async function buildSiteEventSummary(
  db: D1Database,
  filter: SiteEventFilter,
  startDay: string,
  endDay: string
): Promise<SiteEventSummary> {
  const [overview, byEventName, topPaths, topCampaigns, topReferrers, topContents, sourceRows, observability] = await Promise.all([
    querySiteEventOverview(db, filter, startDay, endDay),
    querySiteEventsByEventName(db, filter, startDay, endDay),
    querySiteEventTopPaths(db, filter, startDay, endDay),
    querySiteEventTopCampaigns(db, filter, startDay, endDay),
    querySiteEventTopReferrers(db, filter, startDay, endDay),
    querySiteEventTopContents(db, filter, startDay, endDay),
    querySiteEventSourceRows(db, filter, startDay, endDay),
    querySiteEventObservability(db, filter, startDay, endDay),
  ]);

  return {
    scope: {
      site_key: filter.siteKey,
      exclude_test_mode: filter.excludeTestMode,
      production_only: filter.productionOnly,
    },
    totals: {
      accepted_events: overview.accepted_events,
      unique_paths: overview.unique_paths,
    },
    by_event_name: byEventName,
    top_paths: topPaths,
    top_sources: summarizeSiteEventTopSources(sourceRows),
    top_campaigns: topCampaigns,
    top_referrers: topReferrers,
    top_contents: topContents,
    observability: {
      included_events: observability.included_events,
      excluded_test_mode: observability.excluded_test_mode,
      excluded_non_production_host: observability.excluded_non_production_host,
      dropped_rate_limited: observability.dropped_rate_limited,
      dropped_invalid: observability.dropped_invalid,
      last_received_at: overview.last_received_at,
    },
  };
}

function resolveSourceLabel(src: string | null, utmSource: string | null): string {
  if (src && src.trim()) {
    return src.trim();
  }

  if (utmSource && utmSource.trim()) {
    return utmSource.trim();
  }

  return DIRECT_SOURCE_LABEL;
}

function classifyReferrerSource(referrerDomain: string | null): string | null {
  if (!referrerDomain) {
    return null;
  }

  const domain = referrerDomain.trim().toLowerCase();
  if (!domain) {
    return null;
  }

  if (
    domain.includes("google.") ||
    domain.includes("bing.") ||
    domain.includes("duckduckgo.") ||
    domain.includes("yahoo.") ||
    domain.includes("yandex.")
  ) {
    return "search";
  }

  if (
    domain.includes("facebook.") ||
    domain.includes("instagram.") ||
    domain.includes("twitter.") ||
    domain.includes("x.com") ||
    domain.includes("linkedin.") ||
    domain.includes("reddit.") ||
    domain.includes("tiktok.")
  ) {
    return "social";
  }

  return "referral";
}

function resolveEventSourceLabel(src: string | null, utmSource: string | null, referrerDomain: string | null): string {
  if (src && src.trim()) {
    return src.trim();
  }

  if (utmSource && utmSource.trim()) {
    return utmSource.trim();
  }

  const referrerClass = classifyReferrerSource(referrerDomain);
  if (referrerClass) {
    return referrerClass;
  }

  return DIRECT_SOURCE_LABEL;
}

function parseBooleanQueryFlag(value: string | null, defaultValue: boolean): boolean {
  if (value === null) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function normalizeSiteEventFilter(url: URL): SiteEventFilter | null {
  const siteKey = nullIfBlank(url.searchParams.get("site_key"));
  if (!siteKey) {
    return null;
  }

  const site = getSiteByKey(siteKey);
  if (!site) {
    return null;
  }

  const excludeTestMode = parseBooleanQueryFlag(url.searchParams.get("exclude_test_mode"), true);
  const productionOnly = parseBooleanQueryFlag(
    url.searchParams.get("production_only"),
    site.production_only_default
  );

  return {
    siteKey,
    excludeTestMode,
    productionOnly,
  };
}

export function summarizeIdentity(
  events: IdentityEventRow[],
  firstSeenByUser: Map<string, string>,
  todayDay: string,
  last7StartDay: string,
  topLimit: number = TOP_PAGEVIEW_DIMENSION_LIMIT
): IdentitySummary {
  const todayNewUsers = new Set<string>();
  const todaySessions = new Set<string>();
  const todayUsers = new Set<string>();

  const usersInWindow = new Set<string>();
  const userVisitDaysInWindow = new Map<string, Set<string>>();
  const sessionsInWindow = new Set<string>();
  const eventSourcesByUser = new Map<string, Set<string>>();

  for (const event of events) {
    if (event.received_day === todayDay) {
      if (event.session_id) {
        todaySessions.add(event.session_id);
      }

      if (event.anon_user_id) {
        todayUsers.add(event.anon_user_id);
        if (event.is_new_user === 1) {
          todayNewUsers.add(event.anon_user_id);
        }
      }
    }

    if (event.session_id) {
      sessionsInWindow.add(event.session_id);
    }

    if (!event.anon_user_id) {
      continue;
    }

    const anonUserId = event.anon_user_id;
    usersInWindow.add(anonUserId);

    if (!userVisitDaysInWindow.has(anonUserId)) {
      userVisitDaysInWindow.set(anonUserId, new Set<string>());
    }
    userVisitDaysInWindow.get(anonUserId)?.add(event.received_day);

    if (!eventSourcesByUser.has(anonUserId)) {
      eventSourcesByUser.set(anonUserId, new Set<string>());
    }
    eventSourcesByUser.get(anonUserId)?.add(resolveSourceLabel(event.src, event.utm_source));
  }

  const todayReturningUsers = new Set<string>();
  for (const anonUserId of todayUsers) {
    const firstSeen = firstSeenByUser.get(anonUserId);
    if (firstSeen && firstSeen < todayDay) {
      todayReturningUsers.add(anonUserId);
    }
  }

  const windowNewUsers = new Set<string>();
  const windowReturningUsers = new Set<string>();
  for (const anonUserId of usersInWindow) {
    const firstSeen = firstSeenByUser.get(anonUserId);
    if (firstSeen && firstSeen >= last7StartDay && firstSeen <= todayDay) {
      windowNewUsers.add(anonUserId);
    }

    const daysSeenInWindow = userVisitDaysInWindow.get(anonUserId)?.size ?? 0;
    if ((firstSeen && firstSeen < last7StartDay) || daysSeenInWindow > 1) {
      windowReturningUsers.add(anonUserId);
    }
  }

  const usersBySource = new Map<string, Set<string>>();
  for (const anonUserId of windowReturningUsers) {
    const sources = eventSourcesByUser.get(anonUserId);
    if (!sources) {
      continue;
    }

    for (const source of sources) {
      if (!usersBySource.has(source)) {
        usersBySource.set(source, new Set<string>());
      }
      usersBySource.get(source)?.add(anonUserId);
    }
  }

  const topSourcesByReturningUsers = Array.from(usersBySource.entries())
    .map(([source, users]) => ({ source, users: users.size }))
    .sort((a, b) => (b.users - a.users) || a.source.localeCompare(b.source))
    .slice(0, topLimit);

  const distinctUsersInWindow = usersInWindow.size;
  const returnRate = distinctUsersInWindow === 0 ? 0 : windowReturningUsers.size / distinctUsersInWindow;

  return {
    today: {
      new_users: todayNewUsers.size,
      returning_users: todayReturningUsers.size,
      sessions: todaySessions.size,
    },
    last_7_days: {
      new_users: windowNewUsers.size,
      returning_users: windowReturningUsers.size,
      sessions: sessionsInWindow.size,
      return_rate: returnRate,
    },
    top_sources_by_returning_users: topSourcesByReturningUsers,
  };
}

async function queryAcceptedIdentityEventsInRange(
  db: D1Database,
  startDay: string,
  endDay: string
): Promise<IdentityEventRow[]> {
  const rows = await db
    .prepare(
      "SELECT received_day, anon_user_id, session_id, is_new_user, src, utm_source FROM pageview_events_raw WHERE accepted = 1 AND received_day >= ? AND received_day <= ?"
    )
    .bind(startDay, endDay)
    .all<IdentityEventRow>();

  return rows.results ?? [];
}

async function queryIdentityFirstSeen(db: D1Database): Promise<Map<string, string>> {
  const rows = await db
    .prepare(
      "SELECT anon_user_id, MIN(received_day) AS first_seen_day FROM pageview_events_raw WHERE accepted = 1 AND anon_user_id IS NOT NULL GROUP BY anon_user_id"
    )
    .all<IdentityFirstSeenRow>();

  const mapping = new Map<string, string>();
  for (const row of rows.results ?? []) {
    if (row.anon_user_id && row.first_seen_day) {
      mapping.set(row.anon_user_id, row.first_seen_day);
    }
  }

  return mapping;
}

async function insertPageviewRawEvent(db: D1Database, event: PageviewRawEvent): Promise<void> {
  await db
    .prepare(
      "INSERT INTO pageview_events_raw(id, received_at, received_day, client_ts, path, url, referrer, referrer_domain, src, utm_source, utm_medium, utm_campaign, utm_content, device, viewport, lang, tz, anon_user_id, session_id, is_new_user, country, js_fired, ip_hash, user_agent_hash, accepted, drop_reason, request_id, ingest_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      event.id,
      event.received_at,
      event.received_day,
      event.client_ts,
      event.path,
      event.url,
      event.referrer,
      event.referrer_domain,
      event.src,
      event.utm_source,
      event.utm_medium,
      event.utm_campaign,
      event.utm_content,
      event.device,
      event.viewport,
      event.lang,
      event.tz,
      event.anon_user_id,
      event.session_id,
      event.is_new_user,
      event.country,
      event.js_fired,
      event.ip_hash,
      event.user_agent_hash,
      event.accepted,
      event.drop_reason,
      event.request_id,
      event.ingest_version
    )
    .run();
}

async function upsertPageviewDaily(
  db: D1Database,
  day: string,
  receivedAt: string,
  increments: { pageviews: number; accepted: number; dropped_rate_limited: number; dropped_invalid: number }
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO pageview_daily(day, pageviews, accepted, dropped_rate_limited, dropped_invalid, last_received_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET pageviews = pageview_daily.pageviews + excluded.pageviews, accepted = pageview_daily.accepted + excluded.accepted, dropped_rate_limited = pageview_daily.dropped_rate_limited + excluded.dropped_rate_limited, dropped_invalid = pageview_daily.dropped_invalid + excluded.dropped_invalid, last_received_at = CASE WHEN pageview_daily.last_received_at IS NULL OR excluded.last_received_at > pageview_daily.last_received_at THEN excluded.last_received_at ELSE pageview_daily.last_received_at END"
    )
    .bind(
      day,
      increments.pageviews,
      increments.accepted,
      increments.dropped_rate_limited,
      increments.dropped_invalid,
      receivedAt
    )
    .run();
}

async function incrementPageviewDimension(db: D1Database, day: string, dimType: string, dimValue: string | null): Promise<void> {
  if (!dimValue) {
    return;
  }

  await db
    .prepare(
      "INSERT INTO pageview_daily_dim(day, dim_type, dim_value, count) VALUES (?, ?, ?, 1) ON CONFLICT(day, dim_type, dim_value) DO UPDATE SET count = pageview_daily_dim.count + 1"
    )
    .bind(day, dimType, dimValue)
    .run();
}

async function incrementRateLimitBucket(db: D1Database, minuteBucket: string, ipHash: string): Promise<number> {
  await db
    .prepare(
      "INSERT INTO pageview_rate_limit(minute_bucket, ip_hash, count) VALUES (?, ?, 0) ON CONFLICT(minute_bucket, ip_hash) DO NOTHING"
    )
    .bind(minuteBucket, ipHash)
    .run();

  await db
    .prepare("UPDATE pageview_rate_limit SET count = count + 1 WHERE minute_bucket = ? AND ip_hash = ?")
    .bind(minuteBucket, ipHash)
    .run();

  const row = await db
    .prepare("SELECT count FROM pageview_rate_limit WHERE minute_bucket = ? AND ip_hash = ?")
    .bind(minuteBucket, ipHash)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

async function incrementSiteEventRateLimitBucket(db: D1Database, minuteBucket: string, ipHash: string): Promise<number> {
  await db
    .prepare(
      "INSERT INTO site_event_rate_limit(minute_bucket, ip_hash, count) VALUES (?, ?, 0) ON CONFLICT(minute_bucket, ip_hash) DO NOTHING"
    )
    .bind(minuteBucket, ipHash)
    .run();

  await db
    .prepare("UPDATE site_event_rate_limit SET count = count + 1 WHERE minute_bucket = ? AND ip_hash = ?")
    .bind(minuteBucket, ipHash)
    .run();

  const row = await db
    .prepare("SELECT count FROM site_event_rate_limit WHERE minute_bucket = ? AND ip_hash = ?")
    .bind(minuteBucket, ipHash)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

async function prunePageviewData(db: D1Database, now: Date = new Date()): Promise<void> {
  const rawCutoffDay = utcDay(addUtcDays(now, -PAGEVIEW_RAW_RETENTION_DAYS));
  const rateLimitCutoffMinute = utcMinuteBucket(
    new Date(now.getTime() - PAGEVIEW_RATE_LIMIT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  );
  const siteEventRateLimitCutoffMinute = utcMinuteBucket(
    new Date(now.getTime() - SITE_EVENT_RATE_LIMIT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  );

  await Promise.all([
    db.prepare("DELETE FROM pageview_events_raw WHERE received_day < ?").bind(rawCutoffDay).run(),
    db.prepare("DELETE FROM pageview_rate_limit WHERE minute_bucket < ?").bind(rateLimitCutoffMinute).run(),
    db.prepare("DELETE FROM site_event_rate_limit WHERE minute_bucket < ?").bind(siteEventRateLimitCutoffMinute).run(),
  ]);
}

function buildPageviewRawEvent(
  input: PageviewInput,
  metadata: {
    receivedAt: string;
    receivedDay: string;
    country: string | null;
    ipHash: string | null;
    userAgentHash: string | null;
    requestId: string | null;
  },
  accepted: number,
  dropReason: string | null
): PageviewRawEvent {
  return {
    id: crypto.randomUUID(),
    received_at: metadata.receivedAt,
    received_day: metadata.receivedDay,
    client_ts: input.client_ts,
    path: input.path,
    url: input.url,
    referrer: input.referrer,
    referrer_domain: parseReferrerDomain(input.referrer),
    src: input.src,
    utm_source: input.utm_source,
    utm_medium: input.utm_medium,
    utm_campaign: input.utm_campaign,
    utm_content: input.utm_content,
    device: input.device,
    viewport: input.viewport,
    lang: input.lang,
    tz: input.tz,
    anon_user_id: input.anon_user_id,
    session_id: input.session_id,
    is_new_user: input.is_new_user,
    country: metadata.country,
    js_fired: 1,
    ip_hash: metadata.ipHash,
    user_agent_hash: metadata.userAgentHash,
    accepted,
    drop_reason: dropReason,
    request_id: metadata.requestId,
    ingest_version: PAGEVIEW_INGEST_VERSION,
  };
}

function inferPageviewTransportHint(context: {
  secFetchMode: string | null;
  secFetchDest: string | null;
  keepalive: boolean;
}): string {
  const secFetchMode = context.secFetchMode;
  const secFetchDest = context.secFetchDest;
  const keepalive = context.keepalive;

  if (keepalive && secFetchMode === "no-cors") {
    return "beacon_or_keepalive_fetch_likely";
  }

  if (keepalive) {
    return "keepalive_fetch_likely";
  }

  if (secFetchMode === "cors") {
    return "fetch_cors_likely";
  }

  if (secFetchMode === "no-cors" && secFetchDest === "empty") {
    return "beacon_or_fetch_no_cors_likely";
  }

  if (secFetchMode === "navigate") {
    return "navigation_request_unexpected_for_pageview_ingest";
  }

  return "unknown";
}

function buildPageviewRequestContext(request: Request): PageviewRequestContext {
  const secFetchMode = nullIfBlank(request.headers.get("Sec-Fetch-Mode"));
  const secFetchDest = nullIfBlank(request.headers.get("Sec-Fetch-Dest"));
  const keepalive = (request as Request & { keepalive?: boolean }).keepalive === true;

  return {
    method: request.method,
    origin: nullIfBlank(request.headers.get("Origin")),
    contentType: request.headers.get("Content-Type"),
    clientIp: getClientIp(request),
    country: getCountry(request),
    requestId: getRequestId(request),
    userAgent: nullIfBlank(request.headers.get("User-Agent")),
    secFetchMode,
    secFetchDest,
    keepalive,
    transportHint: inferPageviewTransportHint({ secFetchMode, secFetchDest, keepalive }),
  };
}

function logPageviewBodyCaptureDebug(
  stage: "accepted" | "invalid_json",
  context: PageviewRequestContext,
  capture: PageviewBodyCapture,
  rawBodyPreview: string | null
): void {
  if (!PAGEVIEW_INVALID_JSON_DEBUG_ENABLED) {
    return;
  }

  const rawBodyLength = capture.raw === null ? null : capture.raw.length;
  const logMethod = stage === "invalid_json" ? console.warn : console.info;

  logMethod(
    "Pageview ingest body-capture debug snapshot",
    JSON.stringify({
      ingest_version: PAGEVIEW_INGEST_VERSION,
      stage,
      request_method: context.method,
      origin: context.origin,
      request_id: context.requestId,
      content_type: context.contentType,
      body_capture_stage_reached: capture.body_capture_stage_reached,
      raw_body_length: rawBodyLength,
      raw_body_preview: rawBodyPreview,
      capture_error: capture.capture_error,
      transport_hint: context.transportHint,
      sec_fetch_mode: context.secFetchMode,
      sec_fetch_dest: context.secFetchDest,
      keepalive: context.keepalive,
    })
  );
}

function readAndParsePageviewBody(raw: string | null):
  | { ok: true; raw: string; payload: unknown }
  | { ok: false; raw: string | null; reason: "unreadable_body" | "empty_body" | "invalid_json" } {
  if (raw === null) {
    return { ok: false, raw: null, reason: "unreadable_body" };
  }

  if (!raw.trim()) {
    return { ok: false, raw, reason: "empty_body" };
  }

  try {
    return { ok: true, raw, payload: JSON.parse(raw) };
  } catch {
    return { ok: false, raw, reason: "invalid_json" };
  }
}

async function readRawBodyCapture(request: Request): Promise<PageviewBodyCapture> {
  try {
    const raw = await request.text();
    return { raw, body_capture_stage_reached: true, capture_error: null };
  } catch (error) {
    return {
      raw: null,
      body_capture_stage_reached: false,
      capture_error: errorToMessage(error),
    };
  }
}

async function persistDroppedInvalidPageview(
  db: D1Database,
  metadata: {
    receivedAt: string;
    receivedDay: string;
    country: string | null;
    ipHash: string | null;
    userAgentHash: string | null;
    requestId: string | null;
  }
): Promise<void> {
  await insertPageviewRawEvent(db, buildPageviewRawEvent(emptyPageviewInput(), metadata, 0, "invalid_json"));
  await upsertPageviewDaily(db, metadata.receivedDay, metadata.receivedAt, {
    pageviews: 0,
    accepted: 0,
    dropped_rate_limited: 0,
    dropped_invalid: 1,
  });
}

async function processPageviewIngest(
  capture: PageviewBodyCapture,
  requestContext: PageviewRequestContext,
  env: Env
): Promise<void> {
  const receivedAt = new Date();
  const receivedAtIso = receivedAt.toISOString();
  const receivedDay = utcDay(receivedAt);
  const [ipHash, userAgentHash] = await Promise.all([
    requestContext.clientIp ? sha256Hex(requestContext.clientIp) : Promise.resolve(null),
    requestContext.userAgent ? sha256Hex(requestContext.userAgent) : Promise.resolve(null),
  ]);

  const metadata = {
    receivedAt: receivedAtIso,
    receivedDay,
    country: requestContext.country,
    ipHash,
    userAgentHash,
    requestId: requestContext.requestId,
  };

  const parsedBody = readAndParsePageviewBody(capture.raw);
  if (!parsedBody.ok) {
    const rawBodyPreview =
      parsedBody.raw === null ? null : parsedBody.raw.slice(0, PAGEVIEW_INVALID_JSON_DEBUG_PREVIEW_CHARS);
    logPageviewBodyCaptureDebug("invalid_json", requestContext, capture, rawBodyPreview);
    await persistDroppedInvalidPageview(env.DB, metadata);
    return;
  }

  const payload = parsedBody.payload;

  const normalized = parseCanonicalPageviewPayload(payload);
  if (!normalized) {
    await persistDroppedInvalidPageview(env.DB, metadata);
    return;
  }

  logPageviewBodyCaptureDebug("accepted", requestContext, capture, null);

  let accepted = 1;
  let dropReason: string | null = null;

  if (ipHash) {
    const rateLimitCount = await incrementRateLimitBucket(env.DB, utcMinuteBucket(receivedAt), ipHash);
    if (rateLimitCount > PAGEVIEW_RATE_LIMIT_PER_MINUTE) {
      accepted = 0;
      dropReason = "rate_limited";
    }
  }

  const event = buildPageviewRawEvent(normalized, metadata, accepted, dropReason);
  await insertPageviewRawEvent(env.DB, event);

  if (accepted) {
    await upsertPageviewDaily(env.DB, receivedDay, receivedAtIso, {
      pageviews: 1,
      accepted: 1,
      dropped_rate_limited: 0,
      dropped_invalid: 0,
    });

    await Promise.all([
      incrementPageviewDimension(env.DB, receivedDay, "path", event.path),
      incrementPageviewDimension(env.DB, receivedDay, "referrer_domain", event.referrer_domain),
      incrementPageviewDimension(env.DB, receivedDay, "src", event.src),
      incrementPageviewDimension(env.DB, receivedDay, "utm_source", event.utm_source),
    ]);
    return;
  }

  await upsertPageviewDaily(env.DB, receivedDay, receivedAtIso, {
    pageviews: 0,
    accepted: 0,
    dropped_rate_limited: 1,
    dropped_invalid: 0,
  });
}

async function insertSiteEventRaw(db: D1Database, record: SiteEventRawRecord): Promise<void> {
  await db
    .prepare(
      "INSERT INTO site_events_raw(id, site_key, event_name, received_at, received_day, client_ts, path, url, referrer, referrer_domain, src, utm_source, utm_medium, utm_campaign, utm_content, device, viewport, lang, tz, anon_user_id, session_id, is_new_user, event_value, test_mode, country, ip_hash, user_agent_hash, accepted, drop_reason, request_id, ingest_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      record.id,
      record.site_key,
      record.event_name,
      record.received_at,
      record.received_day,
      record.client_ts,
      record.path,
      record.url,
      record.referrer,
      record.referrer_domain,
      record.src,
      record.utm_source,
      record.utm_medium,
      record.utm_campaign,
      record.utm_content,
      record.device,
      record.viewport,
      record.lang,
      record.tz,
      record.anon_user_id,
      record.session_id,
      record.is_new_user,
      record.event_value,
      record.test_mode,
      record.country,
      record.ip_hash,
      record.user_agent_hash,
      record.accepted,
      record.drop_reason,
      record.request_id,
      record.ingest_version
    )
    .run();
}

async function processSiteEventIngest(
  capture: PageviewBodyCapture,
  requestContext: PageviewRequestContext,
  env: Env
): Promise<void> {
  const receivedAt = new Date();
  const receivedAtIso = receivedAt.toISOString();
  const receivedDay = utcDay(receivedAt);
  const [ipHash, userAgentHash] = await Promise.all([
    requestContext.clientIp ? sha256Hex(requestContext.clientIp) : Promise.resolve(null),
    requestContext.userAgent ? sha256Hex(requestContext.userAgent) : Promise.resolve(null),
  ]);

  const parsedBody = readAndParsePageviewBody(capture.raw);
  if (!parsedBody.ok) {
    return;
  }

  const normalized = parseCanonicalEventPayload(parsedBody.payload);
  if (!normalized) {
    return;
  }

  let accepted = 1;
  let dropReason: string | null = null;

  if (ipHash) {
    const rateLimitCount = await incrementSiteEventRateLimitBucket(env.DB, utcMinuteBucket(receivedAt), ipHash);
    if (rateLimitCount > SITE_EVENT_RATE_LIMIT_PER_MINUTE) {
      accepted = 0;
      dropReason = "rate_limited";
    }
  }

  const record: SiteEventRawRecord = {
    id: crypto.randomUUID(),
    ...normalized,
    received_at: receivedAtIso,
    received_day: receivedDay,
    referrer_domain: parseReferrerDomain(normalized.referrer),
    country: requestContext.country,
    ip_hash: ipHash,
    user_agent_hash: userAgentHash,
    accepted,
    drop_reason: dropReason,
    request_id: requestContext.requestId,
    ingest_version: SITE_EVENT_INGEST_VERSION,
  };

  await insertSiteEventRaw(env.DB, record);
}

function trafficWindowFromTotals(totals: TrafficTotals): {
  visits: number | null;
  requests: number | null;
  avg_daily_visits: number | null;
  avg_daily_requests: number | null;
  days_with_data: number;
} {
  if (totals.row_count === 0) {
    return {
      visits: null,
      requests: null,
      avg_daily_visits: null,
      avg_daily_requests: null,
      days_with_data: 0,
    };
  }

  const daysWithData = totals.row_count;
  const avgDailyVisits = totals.visits === null ? null : totals.visits / daysWithData;
  const avgDailyRequests = totals.requests === null ? null : totals.requests / daysWithData;

  return {
    visits: totals.visits,
    requests: totals.requests,
    avg_daily_visits: avgDailyVisits,
    avg_daily_requests: avgDailyRequests,
    days_with_data: daysWithData,
  };
}

function latestTrafficWindow(row: TrafficRow | null): {
  day: string | null;
  visits: number | null;
  requests: number | null;
  captured_at: string | null;
} {
  if (!row) {
    return {
      day: null,
      visits: null,
      requests: null,
      captured_at: null,
    };
  }

  return {
    day: row.day,
    visits: row.visits,
    requests: row.requests,
    captured_at: row.captured_at,
  };
}

export function assembleLegacyReport(input: {
  today: MetricTotals;
  yesterday: MetricTotals;
  last7Days: MetricTotals;
  last30Days: MetricTotals;
  previous7Days: MetricTotals;
  monthToDate: MetricTotals;
  latestTraffic: TrafficRow | null;
  last7Traffic: TrafficTotals;
  humanToday: { pageviews: number; last_received_at: string | null };
  humanLast7: { pageviews: number; days_with_data: number };
  humanObservability: {
    accepted: number;
    dropped_rate_limited: number;
    dropped_invalid: number;
    last_received_at: string | null;
  };
  topPaths: TopPageviewDimRow[];
  topReferrers: TopPageviewDimRow[];
  topSources: Array<{ source: string; pageviews: number }>;
  identity: IdentitySummary;
  siteEvents: SiteEventSummary | null;
  releaseSignals: ReleaseSignalsSummary;
  operatorSummary: OperatorSummary | undefined;
}) {
  const humanTraffic = {
    today: {
      pageviews: input.humanToday.pageviews,
      last_received_at: input.humanToday.last_received_at,
    },
    last_7_days: {
      pageviews: input.humanLast7.pageviews,
      days_with_data: input.humanLast7.days_with_data,
      top_paths: input.topPaths.map((row) => ({ path: row.value, pageviews: row.pageviews })),
      top_referrers: input.topReferrers.map((row) => ({ referrer_domain: row.value, pageviews: row.pageviews })),
      top_sources: input.topSources,
    },
    observability: input.humanObservability,
  };
  return {
    today: input.today,
    yesterday: input.yesterday,
    last_7_days: input.last7Days,
    last_30_days: input.last30Days,
    month_to_date: input.monthToDate,
    trends: {
      downloads_change_percent: percentChange(input.today.downloads, input.yesterday.downloads),
      update_checks_change_percent: percentChange(input.today.update_checks, input.yesterday.update_checks),
      weekly_downloads_change_percent: percentChange(input.last7Days.downloads, input.previous7Days.downloads),
      weekly_update_checks_change_percent: percentChange(input.last7Days.update_checks, input.previous7Days.update_checks),
      conversion_ratio: safeRatio(input.today.downloads, input.today.update_checks),
    },
    traffic: {
      latest_day: latestTrafficWindow(input.latestTraffic),
      last_7_days: trafficWindowFromTotals(input.last7Traffic),
    },
    human_traffic: humanTraffic,
    legacy_pageview: humanTraffic,
    intent_counters: {
      today: input.today,
      yesterday: input.yesterday,
      last_7_days: input.last7Days,
      last_30_days: input.last30Days,
      month_to_date: input.monthToDate,
    },
    release_signals: input.releaseSignals,
    identity: input.identity,
    site_events: input.siteEvents,
    operator_summary: input.operatorSummary,
  };
}

export function assembleFleetReport(input: { generated_at: string; sites: FleetSiteEntry[] }) {
  return {
    view: "fleet" as const,
    generated_at: input.generated_at,
    sites: input.sites,
  };
}

export function assembleSiteReport(input: Omit<SiteReportPayload, "view">): SiteReportPayload {
  return {
    view: "site",
    ...input,
  };
}

export function assembleSourceHealthReport(input: {
  generated_at: string;
  sites: SourceHealthSiteEntry[];
}) {
  return {
    view: "source_health" as const,
    generated_at: input.generated_at,
    sites: input.sites,
  };
}

function reportDayBounds(now: Date): {
  todayDay: string;
  yesterdayDay: string;
  last7StartDay: string;
  last30StartDay: string;
  previous7StartDay: string;
  previous7EndDay: string;
  monthStartDay: string;
} {
  return {
    todayDay: utcDay(now),
    yesterdayDay: utcDay(addUtcDays(now, -1)),
    last7StartDay: utcDay(addUtcDays(now, -6)),
    last30StartDay: utcDay(addUtcDays(now, -29)),
    previous7StartDay: utcDay(addUtcDays(now, -13)),
    previous7EndDay: utcDay(addUtcDays(now, -7)),
    monthStartDay: utcMonthStart(now),
  };
}

async function refreshPreviousCompletedTrafficBestEffort(env: Env, now: Date): Promise<void> {
  const previousCompletedDay = utcDay(addUtcDays(now, -1));
  try {
    await captureTrafficForDay(env, previousCompletedDay);
  } catch (error) {
    console.warn(
      "Best-effort previous-day Buscore traffic refresh during /report failed; returning report with stored traffic only.",
      error
    );
  }
}

async function buildSiteSignalSnapshot(
  db: D1Database,
  site: TrackedSite,
  filter: SiteEventFilter,
  startDay: string,
  endDay: string
): Promise<{
  siteEventSummary: SiteEventSummary;
  siteEventLastReceivedAt: string | null;
  pageviewRange: PageviewRangeSummary | null;
  pageviewLastReceivedAt: string | null;
  trafficTotals: TrafficTotals | null;
  latestTraffic: TrafficRow | null;
  lastReceivedAt: string | null;
  acceptedSignal7d: number;
  droppedRateLimited: number;
  droppedInvalid: number | null;
  hasRecentSignal: boolean;
}> {
  const supportsPageviews = siteSupportsLegacyPageviews(site);

  const [siteEventSummary, siteEventAllTimeOverview, pageviewRange, pageviewAllTime, trafficTotals, latestTraffic] = await Promise.all([
    buildSiteEventSummary(db, filter, startDay, endDay),
    querySiteEventOverview(db, filter, EARLIEST_REPORT_DAY, endDay),
    supportsPageviews ? queryPageviewRangeSummary(db, startDay, endDay) : Promise.resolve<PageviewRangeSummary | null>(null),
    supportsPageviews
      ? queryPageviewRangeSummary(db, EARLIEST_REPORT_DAY, endDay)
      : Promise.resolve<PageviewRangeSummary | null>(null),
    site.cloudflare_traffic_enabled ? queryTrafficTotalsInRange(db, startDay, endDay) : Promise.resolve<TrafficTotals | null>(null),
    site.cloudflare_traffic_enabled ? queryLatestTrafficRow(db) : Promise.resolve<TrafficRow | null>(null),
  ]);

  const acceptedSignal7d = computeAcceptedSignal7d({
    acceptedEvents7d: siteEventSummary.totals.accepted_events,
    pageviews7d: supportsPageviews ? (pageviewRange?.pageviews ?? 0) : null,
  });
  const lastReceivedAt = maxIsoTimestamp(pageviewAllTime?.last_received_at ?? null, siteEventAllTimeOverview.last_received_at);

  return {
    siteEventSummary,
    siteEventLastReceivedAt: siteEventAllTimeOverview.last_received_at,
    pageviewRange,
    pageviewLastReceivedAt: pageviewAllTime?.last_received_at ?? null,
    trafficTotals,
    latestTraffic,
    lastReceivedAt,
    acceptedSignal7d,
    droppedRateLimited: (pageviewRange?.dropped_rate_limited ?? 0) + siteEventSummary.observability.dropped_rate_limited,
    droppedInvalid: supportsPageviews ? (pageviewRange?.dropped_invalid ?? 0) : null,
    hasRecentSignal: hasRecentSignalFromAcceptedSignal7d(acceptedSignal7d),
  };
}

async function buildSiteIdentitySection(
  db: D1Database,
  site: TrackedSite,
  todayDay: string,
  startDay: string
): Promise<IdentitySummary | null> {
  if (!supportsIdentityForSite(site)) {
    return null;
  }

  const [identityEvents, firstSeenByIdentity] = await Promise.all([
    queryAcceptedIdentityEventsInRange(db, startDay, todayDay),
    queryIdentityFirstSeen(db),
  ]);

  return summarizeIdentity(identityEvents, firstSeenByIdentity, todayDay, startDay);
}

async function buildLegacyReport(
  db: D1Database,
  leadsDb: D1Database | undefined,
  now: Date,
  siteEventFilter: SiteEventFilter | null
): Promise<ReturnType<typeof assembleLegacyReport>> {
  const { todayDay, yesterdayDay, last7StartDay, last30StartDay, previous7StartDay, previous7EndDay, monthStartDay } = reportDayBounds(now);
  const siteEventSummaryPromise = siteEventFilter
    ? buildSiteEventSummary(db, siteEventFilter, last7StartDay, todayDay)
    : Promise.resolve<SiteEventSummary | null>(null);

  const [
    today,
    yesterday,
    last7Days,
    last30Days,
    previous7Days,
    monthToDate,
    latestTraffic,
    last7Traffic,
    humanToday,
    humanLast7,
    humanObservability,
    topPaths,
    topReferrers,
    topSources,
    identityEvents,
    firstSeenByIdentity,
    siteEvents,
    todayReleaseSignals,
    last7ReleaseSignals,
    last30ReleaseSignals,
  ] = await Promise.all([
    queryTotalsInRange(db, todayDay, todayDay),
    queryTotalsInRange(db, yesterdayDay, yesterdayDay),
    queryTotalsInRange(db, last7StartDay, todayDay),
    queryTotalsInRange(db, last30StartDay, todayDay),
    queryTotalsInRange(db, previous7StartDay, previous7EndDay),
    queryTotalsInRange(db, monthStartDay, todayDay),
    queryLatestTrafficRow(db),
    queryTrafficTotalsInRange(db, last7StartDay, todayDay),
    queryPageviewTotalsForDay(db, todayDay),
    queryPageviewLast7Summary(db, last7StartDay, todayDay),
    queryPageviewObservability(db),
    queryTopPageviewDimensions(db, last7StartDay, todayDay, "path"),
    queryTopPageviewDimensions(db, last7StartDay, todayDay, "referrer_domain"),
    queryTopPageviewSources(db, last7StartDay, todayDay),
    queryAcceptedIdentityEventsInRange(db, last7StartDay, todayDay),
    queryIdentityFirstSeen(db),
    siteEventSummaryPromise,
    buildReleaseSignalWindow(db, todayDay, todayDay),
    buildReleaseSignalWindow(db, last7StartDay, todayDay),
    buildReleaseSignalWindow(db, last30StartDay, todayDay),
  ]);

  const identity = summarizeIdentity(identityEvents, firstSeenByIdentity, todayDay, last7StartDay);

  const operatorSummary = siteEventFilter?.siteKey === "buscore"
    ? await buildOperatorSummary(
        db,
        leadsDb,
        siteEventFilter,
        last7StartDay,
        todayDay,
        topSources,
        siteEvents?.observability.last_received_at ?? null,
        siteEvents?.observability.included_events ?? 0,
        siteEvents?.observability.dropped_rate_limited ?? 0
      )
    : undefined;

  return assembleLegacyReport({
    today,
    yesterday,
    last7Days,
    last30Days,
    previous7Days,
    monthToDate,
    latestTraffic,
    last7Traffic,
    humanToday,
    humanLast7,
    humanObservability,
    topPaths,
    topReferrers,
    topSources,
    identity,
    siteEvents,
    releaseSignals: {
      today: todayReleaseSignals,
      last_7_days: last7ReleaseSignals,
      last_30_days: last30ReleaseSignals,
    },
    operatorSummary,
  });
}

async function buildFleetReport(db: D1Database, now: Date): Promise<ReturnType<typeof assembleFleetReport>> {
  const { todayDay, last7StartDay } = reportDayBounds(now);
  const sites = await Promise.all(
    TRACKED_SITES.map(async (site): Promise<FleetSiteEntry> => {
      const snapshot = await buildSiteSignalSnapshot(db, site, defaultSiteEventFilter(site), last7StartDay, todayDay);

      return {
        site_key: site.site_key,
        label: site.label,
        status: site.status,
        backend_source: backendSourceForSite(site),
        cloudflare_traffic_enabled: site.cloudflare_traffic_enabled,
        production_hosts: [...site.production_hosts],
        last_received_at: snapshot.lastReceivedAt,
        accepted_events_7d: snapshot.siteEventSummary.totals.accepted_events,
        pageviews_7d: siteSupportsLegacyPageviews(site) ? (snapshot.pageviewRange?.pageviews ?? 0) : null,
        traffic_requests_7d: snapshot.trafficTotals?.requests ?? null,
        traffic_visits_7d: snapshot.trafficTotals?.visits ?? null,
        has_recent_signal: snapshot.hasRecentSignal,
      };
    })
  );

  return assembleFleetReport({
    generated_at: now.toISOString(),
    sites,
  });
}

async function buildSiteReport(
  db: D1Database,
  leadsDb: D1Database | undefined,
  now: Date,
  filter: SiteEventFilter
): Promise<SiteReportPayload> {
  const { todayDay, last7StartDay } = reportDayBounds(now);
  const site = getSiteByKey(filter.siteKey);
  if (!site) {
    throw new Error("invalid_site_key");
  }

  const supportClass = supportClassForSite(site);
  const sectionAvailability = sectionAvailabilityForSupportClass(supportClass);

  const snapshot = await buildSiteSignalSnapshot(db, site, filter, last7StartDay, todayDay);
  const identity = await buildSiteIdentitySection(db, site, todayDay, last7StartDay);
  const topPageviewSources = siteSupportsLegacyPageviews(site)
    ? await queryTopPageviewSources(db, last7StartDay, todayDay)
    : null;
  const operatorSummary = site.site_key === "buscore"
    ? await buildOperatorSummary(
        db,
        leadsDb,
        filter,
        last7StartDay,
        todayDay,
        topPageviewSources,
        snapshot.siteEventSummary.observability.last_received_at,
        snapshot.siteEventSummary.observability.included_events,
        snapshot.siteEventSummary.observability.dropped_rate_limited
      )
    : undefined;
  const traffic = {
    cloudflare_traffic_enabled: site.cloudflare_traffic_enabled,
    latest_day: latestTrafficWindow(snapshot.latestTraffic),
    last_7_days: trafficWindowFromTotals(snapshot.trafficTotals ?? emptyTrafficTotals()),
  };

  const pageExecutionEvents: PageExecutionEventsSummary = {
    accepted_events: snapshot.siteEventSummary.totals.accepted_events,
    unique_paths: snapshot.siteEventSummary.totals.unique_paths,
    by_event_name: snapshot.siteEventSummary.by_event_name,
    top_paths: snapshot.siteEventSummary.top_paths,
    top_sources: snapshot.siteEventSummary.top_sources,
    top_campaigns: snapshot.siteEventSummary.top_campaigns,
    top_referrers: snapshot.siteEventSummary.top_referrers,
    top_contents: snapshot.siteEventSummary.top_contents,
  };

  return assembleSiteReport({
    generated_at: now.toISOString(),
    scope: {
      site_key: site.site_key,
      label: site.label,
      status: site.status,
      backend_source: backendSourceForSite(site),
      window: reportWindow(last7StartDay, todayDay),
      exclude_test_mode: filter.excludeTestMode,
      production_only: filter.productionOnly,
      support_class: supportClass,
      section_availability: sectionAvailability,
    },
    summary: {
      accepted_events_7d: snapshot.siteEventSummary.totals.accepted_events,
      pageviews_7d: siteSupportsLegacyPageviews(site) ? (snapshot.pageviewRange?.pageviews ?? 0) : null,
      traffic_requests_7d: snapshot.trafficTotals?.requests ?? null,
      traffic_visits_7d: snapshot.trafficTotals?.visits ?? null,
      last_received_at: snapshot.lastReceivedAt,
      has_recent_signal: snapshot.hasRecentSignal,
    },
    traffic_layer: {
      source: "cloudflare_edge",
      semantics: "edge_observed_not_confirmed_human",
      enabled: site.cloudflare_traffic_enabled,
    },
    traffic,
    page_execution_events: pageExecutionEvents,
    events: pageExecutionEvents,
    legacy_pageview: siteSupportsLegacyPageviews(site)
      ? {
          pageviews_7d: snapshot.pageviewRange?.pageviews ?? 0,
          days_with_data: snapshot.pageviewRange?.days_with_data ?? 0,
          last_received_at: snapshot.pageviewRange?.last_received_at ?? null,
        }
      : null,
    identity,
    operator_summary: operatorSummary,
    health: {
      last_received_at: snapshot.lastReceivedAt,
      included_events: snapshot.siteEventSummary.observability.included_events,
      excluded_test_mode: snapshot.siteEventSummary.observability.excluded_test_mode,
      excluded_non_production_host: snapshot.siteEventSummary.observability.excluded_non_production_host,
      dropped_rate_limited: snapshot.droppedRateLimited,
      dropped_invalid: snapshot.droppedInvalid,
      cloudflare_traffic_enabled: site.cloudflare_traffic_enabled,
      production_only_default: site.production_only_default,
    },
  });
}

async function buildSourceHealthReport(
  db: D1Database,
  now: Date
): Promise<ReturnType<typeof assembleSourceHealthReport>> {
  const { todayDay, last7StartDay } = reportDayBounds(now);
  const sites = await Promise.all(
    TRACKED_SITES.map(async (site): Promise<SourceHealthSiteEntry> => {
      const snapshot = await buildSiteSignalSnapshot(db, site, defaultSiteEventFilter(site), last7StartDay, todayDay);

      return {
        site_key: site.site_key,
        label: site.label,
        backend_source: backendSourceForSite(site),
        cloudflare_traffic_enabled: site.cloudflare_traffic_enabled,
        production_only_default: site.production_only_default,
        last_received_at: snapshot.lastReceivedAt,
        accepted_signal_7d: snapshot.acceptedSignal7d,
        dropped_invalid: snapshot.droppedInvalid,
        dropped_rate_limited: snapshot.droppedRateLimited,
      };
    })
  );

  return assembleSourceHealthReport({
    generated_at: now.toISOString(),
    sites,
  });
}

async function fetchPreviousCompletedBuscoreTraffic(env: Env, day: string): Promise<{ visits: number | null; requests: number }> {
  const response = await fetch(CLOUDFLARE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: BUSCORE_TRAFFIC_QUERY,
      variables: {
        zoneTag: env.CF_ZONE_TAG,
        start: `${day}T00:00:00Z`,
        end: `${utcDay(addUtcDays(new Date(`${day}T00:00:00Z`), 1))}T00:00:00Z`,
        host: BUSCORE_HOST,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`cloudflare_graphql_http_${response.status}`);
  }

  const payload = (await response.json()) as CloudflareGraphQLResponse;
  if (payload.errors && payload.errors.length > 0) {
    const message = payload.errors.map((error) => error.message || "graphql_error").join("; ");
    throw new Error(`cloudflare_graphql_payload_${message}`);
  }

  const row = payload.data?.viewer?.zones?.[0]?.buscoreTraffic?.[0];
  if (!row) {
    throw new Error("cloudflare_graphql_empty_daily_result");
  }

  const requests = row.count;
  if (typeof requests !== "number" || !Number.isFinite(requests)) {
    throw new Error("cloudflare_graphql_missing_count_metric");
  }

  return {
    visits: typeof row.sum?.visits === "number" && Number.isFinite(row.sum.visits) ? row.sum.visits : null,
    requests,
  };
}

async function upsertBuscoreTrafficDaily(
  db: D1Database,
  snapshot: { day: string; visits: number | null; requests: number; captured_at: string }
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO buscore_traffic_daily(day, visits, requests, captured_at) VALUES (?, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET visits = excluded.visits, requests = excluded.requests, captured_at = excluded.captured_at"
    )
    .bind(snapshot.day, snapshot.visits, snapshot.requests, snapshot.captured_at)
    .run();
}

async function captureTrafficForDay(env: Env, day: string): Promise<void> {
  if (!env.CF_API_TOKEN || !env.CF_ZONE_TAG) {
    console.warn("Skipping Buscore traffic capture because CF_API_TOKEN or CF_ZONE_TAG is missing.");
    return;
  }

  const traffic = await fetchPreviousCompletedBuscoreTraffic(env, day);
  await upsertBuscoreTrafficDaily(env.DB, {
    day,
    visits: traffic.visits,
    requests: traffic.requests,
    captured_at: new Date().toISOString(),
  });
}

async function capturePreviousCompletedBuscoreTraffic(env: Env): Promise<void> {
  const day = utcDay(addUtcDays(new Date(), -1));
  await captureTrafficForDay(env, day);
}

function percentChange(current: number, baseline: number): number {
  return ((current - baseline) / Math.max(1, baseline)) * 100;
}

function safeRatio(numerator: number, denominator: number): number {
  return numerator / Math.max(1, denominator);
}

function withCors(request: Request, response: Response, allowMethods: string = "GET, OPTIONS"): Response {
  const headers = new Headers(response.headers);

  const pathname = new URL(request.url).pathname;

  if (pathname === PAGEVIEW_METRICS_PATH) {
    const origin = request.headers.get("Origin");
    if (origin && PAGEVIEW_ALLOWED_ORIGINS.has(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      headers.set("Vary", "Origin");
    } else {
      headers.delete("Access-Control-Allow-Origin");
      headers.delete("Access-Control-Allow-Headers");
      headers.delete("Access-Control-Allow-Credentials");
      headers.delete("Vary");
    }
  } else if (pathname === SITE_EVENT_METRICS_PATH) {
    const origin = request.headers.get("Origin");
    const activeOrigins = getAllActiveAllowedOrigins();
    if (origin && activeOrigins.has(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      headers.set("Vary", "Origin");
    } else {
      headers.delete("Access-Control-Allow-Origin");
      headers.delete("Access-Control-Allow-Headers");
      headers.delete("Access-Control-Allow-Credentials");
      headers.delete("Vary");
    }
  } else {
    for (const [key, value] of Object.entries(BASE_CORS_HEADERS)) {
      headers.set(key, value);
    }
  }

  headers.set("Access-Control-Allow-Methods", allowMethods);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/* =========================================================================
 * Phase 2 analytics foundation (aggregate/operator only; no PII).
 * daily_rollup, campaign_log, github_snapshots, health_checks.
 * All writers are idempotent and independently fail-soft. Lighthouse does
 * not post to Discord and does not introduce any user telemetry here.
 * ========================================================================= */

type DailyRollupRow = {
  day: string;
  wqpi: number | null;
  artifact_downloads: number | null;
  attributed_leads: number | null;
  leads_total: number | null;
  update_checks_known: number | null;
  latest_checkins: number | null;
  download_clicks: number | null;
  page_views: number | null;
  return_rate: number | null;
  cf_requests: number | null;
  cf_visits: number | null;
  errors: number | null;
  top_source: string | null;
  top_referrer: string | null;
  captured_at: string;
};

type DailyRollupInputs = Omit<DailyRollupRow, "wqpi">;

// wQPI mirrors the Phase 1 brief: artifact_downloads + attributed_leads.
// Only totalled when BOTH components are available; otherwise null (never faked).
export function computeDailyRollupRow(inputs: DailyRollupInputs): DailyRollupRow {
  const wqpi =
    inputs.artifact_downloads !== null && inputs.attributed_leads !== null
      ? inputs.artifact_downloads + inputs.attributed_leads
      : null;
  return { ...inputs, wqpi };
}

export const DAILY_ROLLUP_UPSERT_SQL =
  "INSERT INTO daily_rollup(day, wqpi, artifact_downloads, attributed_leads, leads_total, update_checks_known, latest_checkins, download_clicks, page_views, return_rate, cf_requests, cf_visits, errors, top_source, top_referrer, captured_at) " +
  "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) " +
  "ON CONFLICT(day) DO UPDATE SET wqpi=excluded.wqpi, artifact_downloads=excluded.artifact_downloads, attributed_leads=excluded.attributed_leads, leads_total=excluded.leads_total, update_checks_known=excluded.update_checks_known, latest_checkins=excluded.latest_checkins, download_clicks=excluded.download_clicks, page_views=excluded.page_views, return_rate=excluded.return_rate, cf_requests=excluded.cf_requests, cf_visits=excluded.cf_visits, errors=excluded.errors, top_source=excluded.top_source, top_referrer=excluded.top_referrer, captured_at=excluded.captured_at";

async function upsertDailyRollup(db: D1Database, row: DailyRollupRow): Promise<void> {
  await db
    .prepare(DAILY_ROLLUP_UPSERT_SQL)
    .bind(
      row.day,
      row.wqpi,
      row.artifact_downloads,
      row.attributed_leads,
      row.leads_total,
      row.update_checks_known,
      row.latest_checkins,
      row.download_clicks,
      row.page_views,
      row.return_rate,
      row.cf_requests,
      row.cf_visits,
      row.errors,
      row.top_source,
      row.top_referrer,
      row.captured_at
    )
    .run();
}

async function captureDailyRollup(env: Env, day: string): Promise<void> {
  const db = env.DB;
  const [totals, artifactDownloads, updateSignals, traffic, leadCounts] = await Promise.all([
    queryTotalsInRange(db, day, day),
    queryReleaseDownloadTotalsInRange(db, day, day),
    queryReleaseUpdateSignalsInRange(db, day, day),
    queryTrafficTotalsInRange(db, day, day),
    env.BUSCORE_LEADS_DB
      ? queryLeadAttributionCounts(env.BUSCORE_LEADS_DB, day, day).catch(() => null)
      : Promise.resolve<{ total: number; attributed: number } | null>(null),
  ]);

  let pageViews: number | null = null;
  let downloadClicks: number | null = null;
  let topSource: string | null = null;
  let topReferrer: string | null = null;
  const buscore = getSiteByKey("buscore");
  if (buscore) {
    try {
      const events = await buildSiteEventSummary(db, defaultSiteEventFilter(buscore), day, day);
      pageViews = events.by_event_name.find((entry) => entry.event_name === "page_view")?.events ?? 0;
      downloadClicks = events.by_event_name.find((entry) => entry.event_name === "download_click")?.events ?? 0;
      topSource = events.top_sources[0]?.source ?? null;
      topReferrer = events.top_referrers[0]?.referrer_domain ?? null;
    } catch (error) {
      console.warn("daily_rollup site-event aggregation unavailable; storing null event fields.", error);
    }
  }

  const row = computeDailyRollupRow({
    day,
    artifact_downloads: artifactDownloads,
    attributed_leads: leadCounts ? leadCounts.attributed : null,
    leads_total: leadCounts ? leadCounts.total : null,
    update_checks_known: updateSignals.update_checks_with_known_client_version,
    latest_checkins: updateSignals.latest_version_checkins,
    download_clicks: downloadClicks,
    page_views: pageViews,
    // return_rate is a 7-day windowed identity metric, not an honest single-day
    // value with current helpers. Stored null rather than faked.
    return_rate: null,
    cf_requests: traffic.requests,
    cf_visits: traffic.visits,
    errors: totals.errors,
    top_source: topSource,
    top_referrer: topReferrer,
    captured_at: new Date().toISOString(),
  });

  await upsertDailyRollup(db, row);
}

async function capturePreviousCompletedDailyRollup(env: Env): Promise<void> {
  await captureDailyRollup(env, utcDay(addUtcDays(new Date(), -1)));
}

// ---- campaign_log -------------------------------------------------------

type CampaignRow = {
  id: string;
  created_at: string;
  posted_at: string | null;
  channel: string | null;
  community: string | null;
  angle: string | null;
  tagged_src: string | null;
  utm_campaign: string | null;
  tagged_url: string | null;
  notes: string | null;
};

export function parseCampaignInsertBody(
  body: unknown,
  opts: { id?: string; now?: string } = {}
): CampaignRow | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const record = body as Record<string, unknown>;
  const capped = (value: unknown, max: number): string | null => {
    const trimmed = nullIfBlank(typeof value === "string" ? value : null);
    return trimmed === null ? null : trimmed.slice(0, max);
  };

  const row: CampaignRow = {
    id: opts.id ?? crypto.randomUUID(),
    created_at: opts.now ?? new Date().toISOString(),
    posted_at: capped(record.posted_at, 40),
    channel: capped(record.channel, 80),
    community: capped(record.community, 120),
    angle: capped(record.angle, 200),
    tagged_src: capped(record.tagged_src, 120),
    utm_campaign: capped(record.utm_campaign, 120),
    tagged_url: capped(record.tagged_url, 500),
    notes: capped(record.notes, 1000),
  };

  const meaningful =
    row.channel || row.community || row.angle || row.tagged_src || row.utm_campaign || row.tagged_url || row.notes;
  if (!meaningful) {
    return null;
  }
  return row;
}

async function insertCampaignLog(db: D1Database, row: CampaignRow): Promise<void> {
  await db
    .prepare(
      "INSERT INTO campaign_log(id, created_at, posted_at, channel, community, angle, tagged_src, utm_campaign, tagged_url, notes) VALUES (?,?,?,?,?,?,?,?,?,?)"
    )
    .bind(
      row.id,
      row.created_at,
      row.posted_at,
      row.channel,
      row.community,
      row.angle,
      row.tagged_src,
      row.utm_campaign,
      row.tagged_url,
      row.notes
    )
    .run();
}

// Downstream attribution: join a logged campaign to BUS Core events/leads by
// tagged_src OR utm_campaign, on/after the post day. Pure so it is testable
// that it references src/utm_campaign.
export function buildCampaignDownstreamQuery(campaign: {
  posted_at?: string | null;
  created_at?: string | null;
  tagged_src?: string | null;
  utm_campaign?: string | null;
}): {
  postedDay: string;
  eventsSql: string;
  eventsBinds: (string | null)[];
  leadsSql: string;
  leadsBinds: (string | null)[];
} {
  const postedDay = (campaign.posted_at ?? campaign.created_at ?? "").slice(0, 10) || EARLIEST_REPORT_DAY;
  const src = campaign.tagged_src ?? null;
  const camp = campaign.utm_campaign ?? null;
  const eventsSql =
    "SELECT COUNT(*) AS c FROM site_events_raw WHERE site_key='buscore' AND accepted=1 AND received_day >= ? AND ((? IS NOT NULL AND src = ?) OR (? IS NOT NULL AND utm_campaign = ?))";
  const leadsSql =
    "SELECT COUNT(*) AS c FROM early_access_leads WHERE substr(created_at,1,10) >= ? AND ((? IS NOT NULL AND src = ?) OR (? IS NOT NULL AND utm_campaign = ?))";
  return {
    postedDay,
    eventsSql,
    eventsBinds: [postedDay, src, src, camp, camp],
    leadsSql,
    leadsBinds: [postedDay, src, src, camp, camp],
  };
}

async function queryCampaignDownstream(
  db: D1Database,
  leadsDb: D1Database | undefined,
  campaign: CampaignRow
): Promise<{ events: number; leads: number | null }> {
  const query = buildCampaignDownstreamQuery(campaign);
  let events = 0;
  try {
    const row = await db.prepare(query.eventsSql).bind(...query.eventsBinds).first<{ c: number }>();
    events = row?.c ?? 0;
  } catch (error) {
    console.warn("Campaign downstream event count unavailable.", error);
  }
  let leads: number | null = null;
  if (leadsDb) {
    try {
      const row = await leadsDb.prepare(query.leadsSql).bind(...query.leadsBinds).first<{ c: number }>();
      leads = row?.c ?? 0;
    } catch (error) {
      console.warn("Campaign downstream lead count unavailable.", error);
    }
  }
  return { events, leads };
}

// ---- github_snapshots ---------------------------------------------------

const DEFAULT_GITHUB_REPO = "True-Good-Craft/TGC-BUS-Core";

function githubRepoSlug(env: Env): string {
  return nullIfBlank(env.GITHUB_REPO ?? null) ?? DEFAULT_GITHUB_REPO;
}

function githubHeaders(env: Env): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "buscore-lighthouse",
    Accept: "application/vnd.github+json",
  };
  const token = nullIfBlank(env.GITHUB_TOKEN ?? null);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

// Extract the total page count from a GitHub `Link` header rel="last".
// Returns null when absent (e.g. <=1 page) so callers can fall back or store null.
export function parseGithubLastPageFromLinkHeader(link: string | null | undefined): number | null {
  if (!link) {
    return null;
  }
  const lastSegment = link
    .split(",")
    .map((segment) => segment.trim())
    .find((segment) => /rel="last"/.test(segment));
  if (!lastSegment) {
    return null;
  }
  const match = lastSegment.match(/[?&]page=(\d+)/);
  return match ? Number(match[1]) : null;
}

type GithubSnapshotRow = {
  day: string;
  stars: number | null;
  forks: number | null;
  watchers: number | null;
  open_issues: number | null;
  closed_issues: number | null;
  open_prs: number | null;
  merged_prs: number | null;
  contributors: number | null;
  latest_release: string | null;
  latest_release_at: string | null;
  commits_total: number | null;
  release_asset_downloads: number | null;
  captured_at: string;
};

// Pure mapper: tolerates any missing/failed input by storing null. Never throws.
export function mapGithubApiToSnapshotRow(
  day: string,
  parts: {
    repo?: unknown;
    releaseLatest?: unknown;
    commitsLastPage?: number | null;
    contributorsLastPage?: number | null;
    openIssues?: number | null;
    closedIssues?: number | null;
    openPrs?: number | null;
    mergedPrs?: number | null;
  },
  capturedAt: string
): GithubSnapshotRow {
  const num = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  const repo = parts.repo && typeof parts.repo === "object" ? (parts.repo as Record<string, unknown>) : null;
  const release =
    parts.releaseLatest && typeof parts.releaseLatest === "object"
      ? (parts.releaseLatest as Record<string, unknown>)
      : null;
  const assets = release && Array.isArray(release.assets) ? (release.assets as Array<Record<string, unknown>>) : null;
  const assetDownloads = assets
    ? assets.reduce((sum, asset) => sum + (num(asset?.download_count) ?? 0), 0)
    : null;

  return {
    day,
    stars: num(repo?.stargazers_count),
    forks: num(repo?.forks_count),
    watchers: num(repo?.subscribers_count),
    open_issues: parts.openIssues ?? null,
    closed_issues: parts.closedIssues ?? null,
    open_prs: parts.openPrs ?? null,
    merged_prs: parts.mergedPrs ?? null,
    contributors: parts.contributorsLastPage ?? null,
    latest_release: release && typeof release.tag_name === "string" ? release.tag_name : null,
    latest_release_at: release && typeof release.published_at === "string" ? release.published_at : null,
    commits_total: parts.commitsLastPage ?? null,
    release_asset_downloads: assetDownloads,
    captured_at: capturedAt,
  };
}

export const GITHUB_SNAPSHOT_UPSERT_SQL =
  "INSERT INTO github_snapshots(day, stars, forks, watchers, open_issues, closed_issues, open_prs, merged_prs, contributors, latest_release, latest_release_at, commits_total, release_asset_downloads, captured_at) " +
  "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) " +
  "ON CONFLICT(day) DO UPDATE SET stars=excluded.stars, forks=excluded.forks, watchers=excluded.watchers, open_issues=excluded.open_issues, closed_issues=excluded.closed_issues, open_prs=excluded.open_prs, merged_prs=excluded.merged_prs, contributors=excluded.contributors, latest_release=excluded.latest_release, latest_release_at=excluded.latest_release_at, commits_total=excluded.commits_total, release_asset_downloads=excluded.release_asset_downloads, captured_at=excluded.captured_at";

async function upsertGithubSnapshot(db: D1Database, row: GithubSnapshotRow): Promise<void> {
  await db
    .prepare(GITHUB_SNAPSHOT_UPSERT_SQL)
    .bind(
      row.day,
      row.stars,
      row.forks,
      row.watchers,
      row.open_issues,
      row.closed_issues,
      row.open_prs,
      row.merged_prs,
      row.contributors,
      row.latest_release,
      row.latest_release_at,
      row.commits_total,
      row.release_asset_downloads,
      row.captured_at
    )
    .run();
}

async function captureGithubSnapshot(env: Env, day: string): Promise<void> {
  const repo = githubRepoSlug(env);
  const headers = githubHeaders(env);

  const safeJson = async (path: string): Promise<unknown> => {
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}${path}`, { headers });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch {
      return null;
    }
  };
  const safeLastPage = async (path: string): Promise<number | null> => {
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}${path}`, { headers });
      if (!response.ok) {
        return null;
      }
      const fromHeader = parseGithubLastPageFromLinkHeader(response.headers.get("Link"));
      if (fromHeader !== null) {
        return fromHeader;
      }
      const body = await response.json();
      return Array.isArray(body) ? body.length : null;
    } catch {
      return null;
    }
  };
  const searchCount = async (queryString: string): Promise<number | null> => {
    try {
      const response = await fetch(
        `https://api.github.com/search/issues?q=${encodeURIComponent(queryString)}&per_page=1`,
        { headers }
      );
      if (!response.ok) {
        return null;
      }
      const body = (await response.json()) as { total_count?: unknown };
      return typeof body.total_count === "number" ? body.total_count : null;
    } catch {
      return null;
    }
  };

  const [repoJson, releaseLatest, commitsLastPage, contributorsLastPage, openIssues, closedIssues, openPrs, mergedPrs] =
    await Promise.all([
      safeJson(""),
      safeJson("/releases/latest"),
      safeLastPage("/commits?per_page=1"),
      safeLastPage("/contributors?per_page=1&anon=true"),
      searchCount(`repo:${repo} type:issue state:open`),
      searchCount(`repo:${repo} type:issue state:closed`),
      searchCount(`repo:${repo} type:pr state:open`),
      searchCount(`repo:${repo} type:pr is:merged`),
    ]);

  const row = mapGithubApiToSnapshotRow(
    day,
    { repo: repoJson, releaseLatest, commitsLastPage, contributorsLastPage, openIssues, closedIssues, openPrs, mergedPrs },
    new Date().toISOString()
  );
  await upsertGithubSnapshot(env.DB, row);
}

// ---- health_checks ------------------------------------------------------

type HealthCheckResult = {
  id: string;
  checked_at: string;
  target: string;
  ok: number; // 0 | 1
  status_code: number | null;
  latency_ms: number | null;
  note: string | null;
};

// Never throws. A probe that throws records ok=0 with the error note.
export async function probeHealthTarget(
  target: string,
  run: () => Promise<{ status: number; ok: boolean; note?: string | null }>
): Promise<HealthCheckResult> {
  const started = Date.now();
  try {
    const result = await run();
    return {
      id: crypto.randomUUID(),
      checked_at: new Date().toISOString(),
      target,
      ok: result.ok ? 1 : 0,
      status_code: result.status,
      latency_ms: Date.now() - started,
      note: result.note ?? null,
    };
  } catch (error) {
    return {
      id: crypto.randomUUID(),
      checked_at: new Date().toISOString(),
      target,
      ok: 0,
      status_code: null,
      latency_ms: Date.now() - started,
      note: errorToMessage(error).slice(0, 200),
    };
  }
}

async function insertHealthCheck(db: D1Database, result: HealthCheckResult): Promise<void> {
  await db
    .prepare(
      "INSERT INTO health_checks(id, checked_at, target, ok, status_code, latency_ms, note) VALUES (?,?,?,?,?,?,?)"
    )
    .bind(result.id, result.checked_at, result.target, result.ok, result.status_code, result.latency_ms, result.note)
    .run();
}

async function pruneHealthChecks(db: D1Database, now: Date = new Date(), days: number = 90): Promise<void> {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare("DELETE FROM health_checks WHERE checked_at < ?").bind(cutoff).run();
}

async function runHealthChecks(env: Env): Promise<void> {
  const results: HealthCheckResult[] = [];
  const push = async (
    target: string,
    run: () => Promise<{ status: number; ok: boolean; note?: string | null }>
  ): Promise<void> => {
    results.push(await probeHealthTarget(target, run));
  };

  // Site pages: 2xx/3xx acceptable (canonicalization redirects are fine).
  await push("site_home", async () => {
    const response = await fetch("https://buscore.ca/", { redirect: "manual" });
    return { status: response.status, ok: response.status >= 200 && response.status < 400 };
  });
  await push("site_downloads", async () => {
    const response = await fetch("https://buscore.ca/downloads", { redirect: "manual" });
    return { status: response.status, ok: response.status >= 200 && response.status < 400 };
  });
  // Update path validated via the NON-COUNTING manifest read (never /update/check,
  // which would inflate update_checks).
  await push("manifest", async () => {
    const response = await fetch("https://lighthouse.buscore.ca/manifest/core/stable.json");
    return { status: response.status, ok: response.status === 200 };
  });
  await push("download_latest_redirect", async () => {
    const response = await fetch("https://lighthouse.buscore.ca/download/latest", { redirect: "manual" });
    return { status: response.status, ok: response.status === 302 };
  });
  // Artifact reachability via a Range bytes=0-0 GET, which is excluded from the
  // download counter by design, so probing never inflates `downloads`.
  await push("release_artifact_range", async () => {
    const redirect = await fetch("https://lighthouse.buscore.ca/download/latest", { redirect: "manual" });
    const location = redirect.headers.get("Location");
    if (redirect.status !== 302 || !location) {
      return { status: redirect.status, ok: false, note: "no redirect location" };
    }
    const artifactUrl = location.startsWith("http") ? location : `https://lighthouse.buscore.ca${location}`;
    const artifact = await fetch(artifactUrl, { headers: { Range: "bytes=0-0" } });
    return { status: artifact.status, ok: artifact.status === 206 || artifact.status === 200, note: "range probe" };
  });
  // Lead endpoint liveness via GET only (never POST — no synthetic leads).
  await push("lead_endpoint", async () => {
    const response = await fetch("https://buscore.ca/api/early-access", { method: "GET", redirect: "manual" });
    return { status: response.status, ok: response.status > 0 && response.status < 500, note: "GET liveness only; no POST" };
  });
  await push("github_release", async () => {
    const response = await fetch(`https://api.github.com/repos/${githubRepoSlug(env)}/releases/latest`, {
      headers: githubHeaders(env),
      redirect: "manual",
    });
    return { status: response.status, ok: response.status === 200 };
  });

  for (const result of results) {
    await insertHealthCheck(env.DB, result).catch((error) => {
      console.warn("health_checks row insert failed; continuing.", error);
    });
  }
}

// ---- view=asset read path ----------------------------------------------

async function queryDailyRollupLatest(db: D1Database): Promise<DailyRollupRow | null> {
  const row = await db.prepare("SELECT * FROM daily_rollup ORDER BY day DESC LIMIT 1").first<DailyRollupRow>();
  return row ?? null;
}

async function queryDailyRollupRecent(db: D1Database, limit: number): Promise<DailyRollupRow[]> {
  const rows = await db
    .prepare("SELECT * FROM daily_rollup ORDER BY day DESC LIMIT ?")
    .bind(limit)
    .all<DailyRollupRow>();
  return (rows.results ?? []).slice().reverse();
}

async function queryGithubSnapshotLatest(db: D1Database): Promise<GithubSnapshotRow | null> {
  const row = await db.prepare("SELECT * FROM github_snapshots ORDER BY day DESC LIMIT 1").first<GithubSnapshotRow>();
  return row ?? null;
}

async function queryHealthLatestPerTarget(db: D1Database): Promise<
  Array<{ target: string; ok: number; status_code: number | null; latency_ms: number | null; checked_at: string; note: string | null }>
> {
  const rows = await db
    .prepare(
      "SELECT h.target, h.ok, h.status_code, h.latency_ms, h.checked_at, h.note FROM health_checks h JOIN (SELECT target, MAX(checked_at) AS max_checked FROM health_checks GROUP BY target) latest ON h.target = latest.target AND h.checked_at = latest.max_checked ORDER BY h.target ASC"
    )
    .all<{ target: string; ok: number; status_code: number | null; latency_ms: number | null; checked_at: string; note: string | null }>();
  return rows.results ?? [];
}

async function queryRecentCampaigns(db: D1Database, limit: number): Promise<CampaignRow[]> {
  const rows = await db
    .prepare(
      "SELECT id, created_at, posted_at, channel, community, angle, tagged_src, utm_campaign, tagged_url, notes FROM campaign_log ORDER BY COALESCE(posted_at, created_at) DESC LIMIT ?"
    )
    .bind(limit)
    .all<CampaignRow>();
  return rows.results ?? [];
}

export function assembleAssetReport(input: {
  generated_at: string;
  rollup: { latest: DailyRollupRow | null; last_14_days: DailyRollupRow[] };
  github: GithubSnapshotRow | null;
  health: Array<{ target: string; ok: number; status_code: number | null; latency_ms: number | null; checked_at: string; note: string | null }>;
  campaigns: Array<CampaignRow & { downstream: { events: number; leads: number | null } }>;
}): {
  view: "asset";
  generated_at: string;
  rollup: { latest: DailyRollupRow | null; last_14_days: DailyRollupRow[] };
  github: GithubSnapshotRow | null;
  health: Array<{ target: string; ok: number; status_code: number | null; latency_ms: number | null; checked_at: string; note: string | null }>;
  campaigns: Array<CampaignRow & { downstream: { events: number; leads: number | null } }>;
} {
  return { view: "asset", ...input };
}

async function buildAssetReport(
  db: D1Database,
  leadsDb: D1Database | undefined,
  now: Date
): Promise<ReturnType<typeof assembleAssetReport>> {
  const [rollupLatest, rollupRecent, github, health, campaigns] = await Promise.all([
    queryDailyRollupLatest(db),
    queryDailyRollupRecent(db, 14),
    queryGithubSnapshotLatest(db),
    queryHealthLatestPerTarget(db),
    queryRecentCampaigns(db, 10),
  ]);

  const campaignsWithDownstream = await Promise.all(
    campaigns.map(async (campaign) => ({
      ...campaign,
      downstream: await queryCampaignDownstream(db, leadsDb, campaign),
    }))
  );

  return assembleAssetReport({
    generated_at: now.toISOString(),
    rollup: { latest: rollupLatest, last_14_days: rollupRecent },
    github,
    health,
    campaigns: campaignsWithDownstream,
  });
}

/* =========================================================================
 * Phase 3: deterministic scoring + Monthly Asset Brief data + archival.
 * Scores are honest: null on insufficient data (never faked), always carry
 * their raw inputs (raw numbers never hidden), and never claim a valuation.
 * Downloads are not users; update checks are not active users; stars are
 * weighted <=10% of GitHub Trust.
 * ========================================================================= */

export type ScoreResult = {
  score: number | null; // 0..100, or null when insufficient data
  available: boolean;
  reason: string | null; // e.g. "awaiting first scheduled rollup"
  weight: number; // suggested weight in the composite (documentation)
  inputs: Record<string, number | string | boolean | null>;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// Map a value in [lo..hi] to [0..100], clamped. Supports descending ranges (lo>hi).
function linMap(value: number, lo: number, hi: number): number {
  if (lo === hi) {
    return value >= hi ? 100 : 0;
  }
  return clampScore(((value - lo) / (hi - lo)) * 100);
}

// Weighted average over ONLY the available components, re-normalizing weights.
function weightedAvailable(components: Array<{ score: number; weight: number }>): number | null {
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  if (components.length === 0 || totalWeight <= 0) {
    return null;
  }
  const weighted = components.reduce((sum, c) => sum + c.score * c.weight, 0);
  return clampScore(weighted / totalWeight);
}

export function computeProductIntentScore(inputs: {
  wqpiThis: number | null;
  wqpiPrev: number | null;
  attributedLeads: number | null;
  leadsTotal: number | null;
  downloadClicks: number | null;
  artifactDownloads: number | null;
}): ScoreResult {
  const trendPct =
    inputs.wqpiThis !== null && inputs.wqpiPrev !== null
      ? ((inputs.wqpiThis - inputs.wqpiPrev) / Math.max(1, inputs.wqpiPrev)) * 100
      : null;
  const attributedRatio =
    inputs.leadsTotal !== null && inputs.leadsTotal > 0 && inputs.attributedLeads !== null
      ? inputs.attributedLeads / inputs.leadsTotal
      : null;
  const completion =
    inputs.downloadClicks !== null && inputs.downloadClicks > 0 && inputs.artifactDownloads !== null
      ? Math.min(inputs.artifactDownloads / inputs.downloadClicks, 1)
      : null;

  const rawInputs = {
    wqpi_this: inputs.wqpiThis,
    wqpi_prev: inputs.wqpiPrev,
    trend_pct: trendPct === null ? null : Math.round(trendPct),
    attributed_leads: inputs.attributedLeads,
    leads_total: inputs.leadsTotal,
    attributed_ratio: attributedRatio === null ? null : Number(attributedRatio.toFixed(2)),
    download_clicks: inputs.downloadClicks,
    artifact_downloads: inputs.artifactDownloads,
    click_to_download: completion === null ? null : Number(completion.toFixed(2)),
  };

  const components: Array<{ score: number; weight: number }> = [];
  if (trendPct !== null) components.push({ score: linMap(trendPct, -50, 50), weight: 60 });
  if (attributedRatio !== null) components.push({ score: clampScore(attributedRatio * 100), weight: 25 });
  if (completion !== null) components.push({ score: clampScore(completion * 100), weight: 15 });

  const score = weightedAvailable(components);
  return {
    score,
    available: score !== null,
    reason: score === null ? "insufficient data (need a prior month plus lead/click data)" : null,
    weight: 30,
    inputs: rawInputs,
  };
}

export function computeCommunityResponseScore(inputs: {
  posts: number;
  cappedDownstreamActions: number;
  channels: number;
}): ScoreResult {
  const rawInputs = {
    posts: inputs.posts,
    downstream_actions: inputs.cappedDownstreamActions,
    actions_per_post: inputs.posts > 0 ? Number((inputs.cappedDownstreamActions / inputs.posts).toFixed(2)) : null,
    channels: inputs.channels,
  };
  if (inputs.posts <= 0) {
    return { score: null, available: false, reason: "insufficient data (no campaigns logged)", weight: 15, inputs: rawInputs };
  }
  const actionsPerPost = inputs.cappedDownstreamActions / inputs.posts;
  const apScore = linMap(actionsPerPost, 0, 5);
  const diversity = (Math.min(inputs.channels, 4) / 4) * 100;
  const score = clampScore(0.8 * apScore + 0.2 * diversity);
  return { score, available: true, reason: null, weight: 15, inputs: rawInputs };
}

export function computeGithubTrustScore(inputs: {
  latestReleaseAgeDays: number | null;
  mergedPrs: number | null;
  closedIssues: number | null;
  contributors: number | null;
  stars: number | null;
}): ScoreResult {
  const rawInputs = {
    latest_release_age_days: inputs.latestReleaseAgeDays,
    merged_prs: inputs.mergedPrs,
    closed_issues: inputs.closedIssues,
    contributors: inputs.contributors,
    stars: inputs.stars,
  };
  const components: Array<{ score: number; weight: number }> = [];
  if (inputs.latestReleaseAgeDays !== null) components.push({ score: linMap(inputs.latestReleaseAgeDays, 90, 0), weight: 40 });
  if (inputs.mergedPrs !== null || inputs.closedIssues !== null) {
    const activity = (inputs.mergedPrs ?? 0) + (inputs.closedIssues ?? 0);
    components.push({ score: linMap(activity, 0, 20), weight: 30 });
  }
  if (inputs.contributors !== null) components.push({ score: linMap(inputs.contributors, 1, 5), weight: 20 });
  // Stars are a weak signal: capped at 10% of the score.
  if (inputs.stars !== null) components.push({ score: linMap(inputs.stars, 0, 100), weight: 10 });

  const score = weightedAvailable(components);
  return {
    score,
    available: score !== null,
    reason: score === null ? "awaiting first github snapshot" : null,
    weight: 10,
    inputs: rawInputs,
  };
}

export function computeReliabilityScore(inputs: {
  healthOk: number | null;
  healthTotal: number | null;
  latestRollupAgeHours: number | null;
  errors: number | null;
  downloads: number | null;
}): ScoreResult {
  const uptimePct =
    inputs.healthTotal !== null && inputs.healthTotal > 0 && inputs.healthOk !== null
      ? (inputs.healthOk / inputs.healthTotal) * 100
      : null;
  const errorRate =
    inputs.errors !== null && inputs.downloads !== null && inputs.downloads > 0
      ? inputs.errors / inputs.downloads
      : null;

  const rawInputs = {
    uptime_pct: uptimePct === null ? null : Math.round(uptimePct),
    health_ok: inputs.healthOk,
    health_total: inputs.healthTotal,
    latest_rollup_age_hours: inputs.latestRollupAgeHours,
    errors: inputs.errors,
    downloads: inputs.downloads,
    error_rate: errorRate === null ? null : Number(errorRate.toFixed(3)),
  };

  if (uptimePct === null) {
    return { score: null, available: false, reason: "awaiting first scheduled health checks", weight: 20, inputs: rawInputs };
  }

  const components: Array<{ score: number; weight: number }> = [{ score: clampScore(uptimePct), weight: 60 }];
  if (inputs.latestRollupAgeHours !== null) {
    components.push({ score: inputs.latestRollupAgeHours <= 36 ? 100 : linMap(inputs.latestRollupAgeHours, 96, 36), weight: 20 });
  }
  if (errorRate !== null) {
    components.push({ score: linMap(errorRate, 0.1, 0), weight: 20 });
  } else if (inputs.errors !== null) {
    components.push({ score: inputs.errors === 0 ? 100 : 0, weight: 20 });
  }

  const score = weightedAvailable(components);
  return { score, available: score !== null, reason: null, weight: 20, inputs: rawInputs };
}

export function computeLeadQualityScore(inputs: {
  total: number | null;
  attributed: number | null;
  withPainPoint: number | null;
  withConsent: number | null;
}): ScoreResult {
  const rawInputs = {
    leads_total: inputs.total,
    attributed: inputs.attributed,
    with_pain_point: inputs.withPainPoint,
    with_consent: inputs.withConsent,
    attributed_pct: inputs.total && inputs.attributed !== null ? Math.round((inputs.attributed / inputs.total) * 100) : null,
    pain_point_pct: inputs.total && inputs.withPainPoint !== null ? Math.round((inputs.withPainPoint / inputs.total) * 100) : null,
    consent_pct: inputs.total && inputs.withConsent !== null ? Math.round((inputs.withConsent / inputs.total) * 100) : null,
  };
  if (inputs.total === null) {
    return { score: null, available: false, reason: "lead attribution unavailable", weight: 15, inputs: rawInputs };
  }
  if (inputs.total === 0) {
    return { score: null, available: false, reason: "insufficient data (no leads this month)", weight: 15, inputs: rawInputs };
  }
  const attributedRatio = (inputs.attributed ?? 0) / inputs.total;
  const painRatio = (inputs.withPainPoint ?? 0) / inputs.total;
  const consentRatio = (inputs.withConsent ?? 0) / inputs.total;
  const score = clampScore(100 * (0.5 * attributedRatio + 0.3 * painRatio + 0.2 * consentRatio));
  return { score, available: true, reason: null, weight: 15, inputs: rawInputs };
}

// Composite. Capped by Reliability; null if Reliability is unavailable. Always
// carries the five sub-scores so raw component scores are never hidden.
export function computeAcquisitionReadinessScore(subs: {
  productIntent: ScoreResult;
  reliability: ScoreResult;
  community: ScoreResult;
  githubTrust: ScoreResult;
  leadQuality: ScoreResult;
  positioning?: ScoreResult | null;
}): ScoreResult {
  const positioning = subs.positioning ?? {
    score: null,
    available: false,
    reason: "manual assessment unavailable (no data source)",
    weight: 10,
    inputs: {},
  };

  const subScoreInputs = {
    product_intent: subs.productIntent.score,
    reliability: subs.reliability.score,
    community_response: subs.community.score,
    github_trust: subs.githubTrust.score,
    lead_quality: subs.leadQuality.score,
    positioning: positioning.score,
    note: "score is not a valuation",
  };

  if (subs.reliability.score === null) {
    return {
      score: null,
      available: false,
      reason: "cannot assess readiness without reliability data",
      weight: 100,
      inputs: subScoreInputs,
    };
  }

  const components: Array<{ score: number; weight: number }> = [];
  const add = (result: ScoreResult, weight: number) => {
    if (result.score !== null) components.push({ score: result.score, weight });
  };
  add(subs.productIntent, 30);
  add(subs.reliability, 20);
  add(subs.community, 15);
  add(subs.githubTrust, 10);
  add(subs.leadQuality, 15);
  add(positioning, 10);

  // Require reliability plus at least one other component.
  if (components.length < 2) {
    return { score: null, available: false, reason: "insufficient data (too few components)", weight: 100, inputs: subScoreInputs };
  }

  const raw = weightedAvailable(components);
  const capped = raw === null ? null : Math.min(raw, subs.reliability.score + 10);
  return { score: capped, available: capped !== null, reason: null, weight: 100, inputs: subScoreInputs };
}

// ---- monthly asset data assembly ----------------------------------------

function previousCalendarMonthBounds(now: Date): { startDay: string; endDay: string; label: string } {
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastOfPrev = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000);
  const startOfPrev = new Date(Date.UTC(lastOfPrev.getUTCFullYear(), lastOfPrev.getUTCMonth(), 1));
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return {
    startDay: utcDay(startOfPrev),
    endDay: utcDay(lastOfPrev),
    label: `${monthNames[lastOfPrev.getUTCMonth()]} ${lastOfPrev.getUTCFullYear()}`,
  };
}

function monthBeforeBounds(monthStartDay: string): { startDay: string; endDay: string } {
  const monthStart = new Date(`${monthStartDay}T00:00:00Z`);
  const lastOfPrev = new Date(monthStart.getTime() - 24 * 60 * 60 * 1000);
  const startOfPrev = new Date(Date.UTC(lastOfPrev.getUTCFullYear(), lastOfPrev.getUTCMonth(), 1));
  return { startDay: utcDay(startOfPrev), endDay: utcDay(lastOfPrev) };
}

function sumNullable(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length === 0 ? null : present.reduce((sum, value) => sum + value, 0);
}

function avgNullable(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length === 0 ? null : Math.round(present.reduce((sum, value) => sum + value, 0) / present.length);
}

type MonthlyRollupAggregate = {
  days_with_data: number;
  wqpi: number | null;
  artifact_downloads: number | null;
  attributed_leads: number | null;
  leads_total: number | null;
  download_clicks: number | null;
  known_checks_avg: number | null;
  latest_checkins: number | null;
  adoption_pct: number | null;
  errors: number | null;
  top_source: string | null;
};

export function aggregateMonthlyRollup(rows: DailyRollupRow[]): MonthlyRollupAggregate {
  const latestCheckins = sumNullable(rows.map((r) => r.latest_checkins));
  const knownTotal = sumNullable(rows.map((r) => r.update_checks_known));
  const sourceCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.top_source) sourceCounts.set(row.top_source, (sourceCounts.get(row.top_source) ?? 0) + 1);
  }
  const topSource = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    days_with_data: rows.length,
    wqpi: sumNullable(rows.map((r) => r.wqpi)),
    artifact_downloads: sumNullable(rows.map((r) => r.artifact_downloads)),
    attributed_leads: sumNullable(rows.map((r) => r.attributed_leads)),
    leads_total: sumNullable(rows.map((r) => r.leads_total)),
    download_clicks: sumNullable(rows.map((r) => r.download_clicks)),
    known_checks_avg: avgNullable(rows.map((r) => r.update_checks_known)),
    latest_checkins: latestCheckins,
    adoption_pct: knownTotal && knownTotal > 0 && latestCheckins !== null ? Math.round((latestCheckins / knownTotal) * 100) : null,
    errors: sumNullable(rows.map((r) => r.errors)),
    top_source: topSource,
  };
}

async function queryRollupRange(db: D1Database, startDay: string, endDay: string): Promise<DailyRollupRow[]> {
  const rows = await db
    .prepare("SELECT * FROM daily_rollup WHERE day >= ? AND day <= ? ORDER BY day ASC")
    .bind(startDay, endDay)
    .all<DailyRollupRow>();
  return rows.results ?? [];
}

async function queryHealthUptimeInRange(db: D1Database, startDay: string, endDay: string): Promise<{ ok: number; total: number }> {
  const row = await db
    .prepare("SELECT COALESCE(SUM(ok),0) AS ok, COUNT(*) AS total FROM health_checks WHERE checked_at >= ? AND checked_at <= ?")
    .bind(`${startDay}T00:00:00.000Z`, `${endDay}T23:59:59.999Z`)
    .first<{ ok: number; total: number }>();
  return { ok: row?.ok ?? 0, total: row?.total ?? 0 };
}

async function queryCampaignsInRange(db: D1Database, startDay: string, endDay: string): Promise<CampaignRow[]> {
  const rows = await db
    .prepare(
      "SELECT id, created_at, posted_at, channel, community, angle, tagged_src, utm_campaign, tagged_url, notes FROM campaign_log WHERE substr(COALESCE(posted_at, created_at),1,10) >= ? AND substr(COALESCE(posted_at, created_at),1,10) <= ? ORDER BY COALESCE(posted_at, created_at) ASC"
    )
    .bind(startDay, endDay)
    .all<CampaignRow>();
  return rows.results ?? [];
}

async function queryLeadQuality(
  leadsDb: D1Database | undefined,
  startDay: string,
  endDay: string
): Promise<{ total: number; attributed: number; withPainPoint: number; withConsent: number } | null> {
  if (!leadsDb) return null;
  try {
    const row = await leadsDb
      .prepare(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN COALESCE(NULLIF(utm_source,''),NULLIF(src,''),NULLIF(referrer_domain,'')) IS NOT NULL THEN 1 ELSE 0 END) AS attributed, SUM(CASE WHEN NULLIF(pain_point,'') IS NOT NULL THEN 1 ELSE 0 END) AS with_pain, SUM(CASE WHEN consent_updates = 1 THEN 1 ELSE 0 END) AS with_consent FROM early_access_leads WHERE substr(created_at,1,10) >= ? AND substr(created_at,1,10) <= ?"
      )
      .bind(startDay, endDay)
      .first<{ total: number; attributed: number | null; with_pain: number | null; with_consent: number | null }>();
    return {
      total: row?.total ?? 0,
      attributed: row?.attributed ?? 0,
      withPainPoint: row?.with_pain ?? 0,
      withConsent: row?.with_consent ?? 0,
    };
  } catch (error) {
    console.warn("Monthly lead-quality query unavailable.", error);
    return null;
  }
}

async function queryRecentOperatorNotes(db: D1Database, limit: number): Promise<Array<{ id: string; created_at: string; note: string; tag: string | null }>> {
  const rows = await db
    .prepare("SELECT id, created_at, note, tag FROM operator_notes ORDER BY created_at DESC LIMIT ?")
    .bind(limit)
    .all<{ id: string; created_at: string; note: string; tag: string | null }>();
  return rows.results ?? [];
}

async function queryPreviousMonthlyAcquisitionScore(db: D1Database): Promise<number | null> {
  try {
    const row = await db
      .prepare("SELECT summary_json FROM report_snapshots WHERE kind = 'monthly' ORDER BY generated_at DESC LIMIT 1")
      .first<{ summary_json: string | null }>();
    if (!row?.summary_json) return null;
    const parsed = JSON.parse(row.summary_json) as { acquisition_readiness?: number | null };
    return typeof parsed.acquisition_readiness === "number" ? parsed.acquisition_readiness : null;
  } catch {
    return null;
  }
}

async function buildMonthlyAssetReport(db: D1Database, leadsDb: D1Database | undefined, now: Date): Promise<Record<string, unknown>> {
  const month = previousCalendarMonthBounds(now);
  const prior = monthBeforeBounds(month.startDay);

  const [monthRows, priorRows, github, health, campaignsRaw, leadQualityRaw, notes, prevAcqScore] = await Promise.all([
    queryRollupRange(db, month.startDay, month.endDay),
    queryRollupRange(db, prior.startDay, prior.endDay),
    queryGithubSnapshotLatest(db),
    queryHealthUptimeInRange(db, month.startDay, month.endDay),
    queryCampaignsInRange(db, month.startDay, month.endDay),
    queryLeadQuality(leadsDb, month.startDay, month.endDay),
    queryRecentOperatorNotes(db, 10),
    queryPreviousMonthlyAcquisitionScore(db),
  ]);

  const agg = aggregateMonthlyRollup(monthRows);
  const priorAgg = aggregateMonthlyRollup(priorRows);

  // Community downstream (per-post capped at 20 to stop one viral post dominating).
  let cappedDownstream = 0;
  const perChannel = new Map<string, { posts: number; actions: number }>();
  const campaigns = await Promise.all(
    campaignsRaw.map(async (campaign) => {
      const downstream = await queryCampaignDownstream(db, leadsDb, campaign);
      const actions = downstream.events + (downstream.leads ?? 0);
      cappedDownstream += Math.min(actions, 20);
      const channelKey = campaign.channel ?? "(unknown)";
      const entry = perChannel.get(channelKey) ?? { posts: 0, actions: 0 };
      entry.posts += 1;
      entry.actions += actions;
      perChannel.set(channelKey, entry);
      return { channel: campaign.channel, community: campaign.community, utm_campaign: campaign.utm_campaign, downstream };
    })
  );
  const channels = perChannel.size;

  // GitHub latest-release age in days.
  let latestReleaseAgeDays: number | null = null;
  if (github?.latest_release_at) {
    const releaseTime = new Date(github.latest_release_at).getTime();
    if (Number.isFinite(releaseTime)) {
      latestReleaseAgeDays = Math.round((now.getTime() - releaseTime) / (24 * 60 * 60 * 1000));
    }
  }

  // Freshness: age of the most recent rollup row we have.
  const latestRollupDay = monthRows.length > 0 ? monthRows[monthRows.length - 1].day : null;
  const latestRollupAgeHours = latestRollupDay
    ? Math.round((now.getTime() - new Date(`${latestRollupDay}T00:00:00Z`).getTime()) / (60 * 60 * 1000))
    : null;

  const productIntent = computeProductIntentScore({
    wqpiThis: agg.wqpi,
    wqpiPrev: priorAgg.wqpi,
    attributedLeads: agg.attributed_leads,
    leadsTotal: agg.leads_total,
    downloadClicks: agg.download_clicks,
    artifactDownloads: agg.artifact_downloads,
  });
  const community = computeCommunityResponseScore({ posts: campaigns.length, cappedDownstreamActions: cappedDownstream, channels });
  const githubTrust = computeGithubTrustScore({
    latestReleaseAgeDays,
    mergedPrs: github?.merged_prs ?? null,
    closedIssues: github?.closed_issues ?? null,
    contributors: github?.contributors ?? null,
    stars: github?.stars ?? null,
  });
  const reliability = computeReliabilityScore({
    healthOk: health.total > 0 ? health.ok : null,
    healthTotal: health.total > 0 ? health.total : null,
    latestRollupAgeHours,
    errors: agg.errors,
    downloads: agg.artifact_downloads,
  });
  const leadQuality = computeLeadQualityScore({
    total: leadQualityRaw ? leadQualityRaw.total : null,
    attributed: leadQualityRaw ? leadQualityRaw.attributed : null,
    withPainPoint: leadQualityRaw ? leadQualityRaw.withPainPoint : null,
    withConsent: leadQualityRaw ? leadQualityRaw.withConsent : null,
  });
  const acquisitionReadiness = computeAcquisitionReadinessScore({ productIntent, reliability, community, githubTrust, leadQuality });

  const wqpiTrendPct =
    agg.wqpi !== null && priorAgg.wqpi !== null ? Math.round(((agg.wqpi - priorAgg.wqpi) / Math.max(1, priorAgg.wqpi)) * 100) : null;

  return {
    view: "monthly",
    generated_at: now.toISOString(),
    month: month.label,
    window: { start_day: month.startDay, end_day: month.endDay, timezone: "UTC" },
    data_status: monthRows.length === 0 ? "awaiting first scheduled rollup" : "available",
    organic_demand: {
      wqpi: agg.wqpi,
      wqpi_prev_month: priorAgg.wqpi,
      wqpi_mom_pct: wqpiTrendPct,
      artifact_downloads: agg.artifact_downloads,
      attributed_leads: agg.attributed_leads,
      leads_total: agg.leads_total,
      days_with_data: agg.days_with_data,
    },
    repeat_interest: {
      known_version_checks_avg_per_day: agg.known_checks_avg,
      latest_version_checkins: agg.latest_checkins,
      latest_version_adoption_pct: agg.adoption_pct,
      note: "update checks are a proxy, not active users",
    },
    community: {
      posts: campaigns.length,
      downstream_actions_capped: cappedDownstream,
      channels,
      per_channel: [...perChannel.entries()].map(([channel, v]) => ({
        channel,
        posts: v.posts,
        actions: v.actions,
        actions_per_post: Number((v.actions / Math.max(1, v.posts)).toFixed(2)),
      })),
    },
    reliability: {
      uptime_pct: health.total > 0 ? Math.round((health.ok / health.total) * 100) : null,
      health_checks: health.total,
      errors: agg.errors,
      latest_rollup_age_hours: latestRollupAgeHours,
    },
    github: github
      ? {
          stars: github.stars,
          forks: github.forks,
          watchers: github.watchers,
          open_issues: github.open_issues,
          closed_issues: github.closed_issues,
          merged_prs: github.merged_prs,
          contributors: github.contributors,
          latest_release: github.latest_release,
          latest_release_age_days: latestReleaseAgeDays,
          license: "AGPL-3.0 (+ commercial)",
          note: "stars are a weak signal",
        }
      : null,
    lead_quality: leadQuality.inputs,
    scores: {
      product_intent: productIntent,
      community_response: community,
      github_trust: githubTrust,
      reliability,
      lead_quality: leadQuality,
      acquisition_readiness: acquisitionReadiness,
      previous_acquisition_readiness: prevAcqScore,
      disclaimer: "Scores are trend/triage indicators, not a valuation. Raw inputs are shown with each score.",
    },
    operator_notes: notes,
  };
}

// ---- Phase 3 write-route bodies -----------------------------------------

type OperatorNoteRow = { id: string; created_at: string; note: string; tag: string | null };

export function parseOperatorNoteBody(body: unknown, opts: { id?: string; now?: string } = {}): OperatorNoteRow | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const note = nullIfBlank(typeof record.note === "string" ? record.note : null);
  if (!note) return null;
  const tag = nullIfBlank(typeof record.tag === "string" ? record.tag : null);
  return { id: opts.id ?? crypto.randomUUID(), created_at: opts.now ?? new Date().toISOString(), note: note.slice(0, 1000), tag: tag ? tag.slice(0, 40) : null };
}

async function insertOperatorNote(db: D1Database, row: OperatorNoteRow): Promise<void> {
  await db
    .prepare("INSERT INTO operator_notes(id, created_at, note, tag) VALUES (?,?,?,?)")
    .bind(row.id, row.created_at, row.note, row.tag)
    .run();
}

type ReportSnapshotRow = {
  id: string;
  generated_at: string;
  kind: string;
  status: string | null;
  wqpi: number | null;
  summary_json: string | null;
  narrative: string | null;
};

const REPORT_SNAPSHOT_KINDS = new Set(["daily", "weekly", "monthly"]);

export function parseReportSnapshotBody(body: unknown, opts: { id?: string; now?: string } = {}): ReportSnapshotRow | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const kind = nullIfBlank(typeof record.kind === "string" ? record.kind : null);
  if (!kind || !REPORT_SNAPSHOT_KINDS.has(kind)) return null;

  const status = nullIfBlank(typeof record.status === "string" ? record.status : null);
  const wqpi = typeof record.wqpi === "number" && Number.isFinite(record.wqpi) ? record.wqpi : null;
  let summaryJson: string | null = null;
  if (typeof record.summary_json === "string") {
    summaryJson = record.summary_json.slice(0, 20000);
  } else if (record.summary_json && typeof record.summary_json === "object") {
    summaryJson = JSON.stringify(record.summary_json).slice(0, 20000);
  }
  const narrative = nullIfBlank(typeof record.narrative === "string" ? record.narrative : null);

  return {
    id: opts.id ?? crypto.randomUUID(),
    generated_at: opts.now ?? new Date().toISOString(),
    kind,
    status: status ? status.slice(0, 20) : null,
    wqpi,
    summary_json: summaryJson,
    narrative: narrative ? narrative.slice(0, 8000) : null,
  };
}

async function insertReportSnapshot(db: D1Database, row: ReportSnapshotRow): Promise<void> {
  await db
    .prepare("INSERT INTO report_snapshots(id, generated_at, kind, status, wqpi, summary_json, narrative) VALUES (?,?,?,?,?,?,?)")
    .bind(row.id, row.generated_at, row.kind, row.status, row.wqpi, row.summary_json, row.narrative)
    .run();
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        // Capture the previous completed day's traffic FIRST so the daily rollup
        // can read the traffic row for the same day.
        await capturePreviousCompletedBuscoreTraffic(env).catch((error) => {
          console.warn("Buscore traffic capture skipped after Cloudflare GraphQL failure.", error);
        });

        // Independent, fail-soft writers. One failing cannot break the others.
        await Promise.all([
          prunePageviewData(env.DB).catch((error) => {
            console.warn("Pageview retention cleanup skipped after D1 failure.", error);
          }),
          pruneBuscoreTelemetry(env.DB).catch((error) => {
            console.warn("BUS Core product telemetry retention cleanup skipped after D1 failure.", error);
          }),
          capturePreviousCompletedDailyRollup(env).catch((error) => {
            console.warn("Daily rollup capture skipped after failure.", error);
          }),
          captureGithubSnapshot(env, utcDay()).catch((error) => {
            console.warn("GitHub snapshot capture skipped after failure.", error);
          }),
          runHealthChecks(env).catch((error) => {
            console.warn("Health checks skipped after failure.", error);
          }),
          pruneHealthChecks(env.DB).catch((error) => {
            console.warn("Health check retention cleanup skipped after failure.", error);
          }),
        ]);
      })()
    );
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const day = utcDay();

    if (request.method === "OPTIONS") {
      const allowMethods =
        url.pathname === PAGEVIEW_METRICS_PATH || url.pathname === SITE_EVENT_METRICS_PATH || url.pathname === BUSCORE_TELEMETRY_PATH
          ? "POST, OPTIONS"
          : "GET, OPTIONS";
      return withCors(request, new Response(null, { status: 200 }), allowMethods);
    }

    if (url.pathname === PAGEVIEW_METRICS_PATH && request.method === "POST") {
      const requestContext = buildPageviewRequestContext(request);
      const capture = await readRawBodyCapture(request);
      ctx.waitUntil(
        processPageviewIngest(capture, requestContext, env)
          .catch((error) => {
            console.warn("Pageview ingest failed after 204 response.", error);
          })
      );
      return withCors(request, new Response(null, { status: 204 }), "POST, OPTIONS");
    }

    if (url.pathname === SITE_EVENT_METRICS_PATH && request.method === "POST") {
      const requestContext = buildPageviewRequestContext(request);
      const capture = await readRawBodyCapture(request);
      ctx.waitUntil(
        processSiteEventIngest(capture, requestContext, env)
          .catch((error) => {
            console.warn("Site event ingest failed after 204 response.", error);
          })
      );
      return withCors(request, new Response(null, { status: 204 }), "POST, OPTIONS");
    }

    if (url.pathname === BUSCORE_TELEMETRY_PATH) {
      return handleBuscoreTelemetryRequest(request, env.DB);
    }

    // Admin-token-protected operator route for logging community posts.
    // Operator-authored aggregate/annotation data only; no user data, no PII.
    if (url.pathname === "/campaign" && request.method === "POST") {
      const token = request.headers.get("X-Admin-Token");
      if (!env.ADMIN_TOKEN || !token || token !== env.ADMIN_TOKEN) {
        return withCors(request, Response.json({ ok: false, error: "unauthorized" }, { status: 401 }));
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return withCors(request, Response.json({ ok: false, error: "invalid_json" }, { status: 400 }));
      }

      const row = parseCampaignInsertBody(body);
      if (!row) {
        return withCors(request, Response.json({ ok: false, error: "invalid_campaign" }, { status: 400 }));
      }

      try {
        await insertCampaignLog(env.DB, row);
      } catch {
        return withCors(request, Response.json({ ok: false, error: "campaign_insert_failed" }, { status: 503 }));
      }

      return withCors(request, Response.json({ ok: true, id: row.id }, { status: 201 }), "POST, OPTIONS");
    }

    // Admin-token-protected operator note insert (feeds the monthly narrative).
    if (url.pathname === "/notes" && request.method === "POST") {
      const token = request.headers.get("X-Admin-Token");
      if (!env.ADMIN_TOKEN || !token || token !== env.ADMIN_TOKEN) {
        return withCors(request, Response.json({ ok: false, error: "unauthorized" }, { status: 401 }));
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return withCors(request, Response.json({ ok: false, error: "invalid_json" }, { status: 400 }));
      }
      const row = parseOperatorNoteBody(body);
      if (!row) {
        return withCors(request, Response.json({ ok: false, error: "invalid_note" }, { status: 400 }));
      }
      try {
        await insertOperatorNote(env.DB, row);
      } catch {
        return withCors(request, Response.json({ ok: false, error: "note_insert_failed" }, { status: 503 }));
      }
      return withCors(request, Response.json({ ok: true, id: row.id }, { status: 201 }), "POST, OPTIONS");
    }

    // Admin-token-protected report archival (Agent Smith archives what it posts).
    if (url.pathname === "/report/snapshot" && request.method === "POST") {
      const token = request.headers.get("X-Admin-Token");
      if (!env.ADMIN_TOKEN || !token || token !== env.ADMIN_TOKEN) {
        return withCors(request, Response.json({ ok: false, error: "unauthorized" }, { status: 401 }));
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return withCors(request, Response.json({ ok: false, error: "invalid_json" }, { status: 400 }));
      }
      const row = parseReportSnapshotBody(body);
      if (!row) {
        return withCors(request, Response.json({ ok: false, error: "invalid_snapshot" }, { status: 400 }));
      }
      try {
        await insertReportSnapshot(env.DB, row);
      } catch {
        return withCors(request, Response.json({ ok: false, error: "snapshot_insert_failed" }, { status: 503 }));
      }
      return withCors(request, Response.json({ ok: true, id: row.id }, { status: 201 }), "POST, OPTIONS");
    }

    if (request.method !== "GET") {
      return withCors(request, Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 }));
    }

    if (url.pathname === MANIFEST_PATH) {
      try {
        const obj = await env.MANIFEST_R2.get(MANIFEST_KEY);

        if (!obj) {
          await incrementErrorCounterBestEffort(env.DB, day);
          return withCors(
            request,
            new Response(JSON.stringify({ ok: false, error: "manifest_unavailable" }), {
              status: 503,
              headers: {
                "Content-Type": "application/json",
              },
            })
          );
        }

        return withCors(
          request,
          new Response(obj.body, {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=60, s-maxage=60",
            },
          })
        );
      } catch {
        await incrementErrorCounterBestEffort(env.DB, day);
        return withCors(
          request,
          new Response(JSON.stringify({ ok: false, error: "manifest_unavailable" }), {
            status: 503,
            headers: {
              "Content-Type": "application/json",
            },
          })
        );
      }
    }

    if (url.pathname === "/update/check") {
      try {
        const manifest = await readManifestFromR2(env);
        if (!shouldSkipCounting(getClientIp(request), env.IGNORED_IP)) {
          const latestVersion = extractLatestManifestVersion(manifest.parsed) ?? UNKNOWN_VERSION_BUCKET;
          const clientVersion = normalizeSemver(resolveClientVersionSignal(url, request)) ?? UNKNOWN_VERSION_BUCKET;
          const channel = resolveChannelSignal(url, request);
          const updateAvailable = resolveUpdateAvailability(
            clientVersion === UNKNOWN_VERSION_BUCKET ? null : clientVersion,
            latestVersion === UNKNOWN_VERSION_BUCKET ? null : latestVersion
          );
          const firstCheck = resolveFirstCheckSignal(url);

          await incrementCounter(env.DB, day, "update_checks");
          await incrementReleaseUpdateCheckCounterBestEffort(
            env.DB,
            day,
            channel,
            clientVersion,
            latestVersion,
            updateAvailable,
            firstCheck
          );
        }
        return withCors(
          request,
          new Response(manifest.raw, {
            status: 200,
            headers: {
              "Cache-Control": "no-store",
              "Content-Type": "application/json",
            },
          })
        );
      } catch {
        await incrementErrorCounterBestEffort(env.DB, day);
        return withCors(request, Response.json({ ok: false, error: "manifest_unavailable" }, { status: 503 }));
      }
    }

    if (url.pathname === "/download/latest") {
      try {
        const manifest = await readManifestFromR2(env);
        const latestUrl = extractLatestDownloadUrl(manifest.parsed);
        const redirectUrl = latestUrl ? toAbsoluteReleaseUrl(latestUrl, url.origin) : null;

        if (!redirectUrl) {
          await incrementErrorCounterBestEffort(env.DB, day);
          return withCors(request, Response.json({ ok: false, error: "manifest_unavailable" }, { status: 503 }));
        }

        return withCors(request, Response.redirect(redirectUrl, 302));
      } catch {
        await incrementErrorCounterBestEffort(env.DB, day);
        return withCors(request, Response.json({ ok: false, error: "manifest_unavailable" }, { status: 503 }));
      }
    }

    const releaseMatch = url.pathname.match(RELEASE_PATH);
    if (releaseMatch) {
      const filename = releaseMatch[1];

      if (!RELEASE_FILENAME.test(filename)) {
        return withCors(request, Response.json({ ok: false, error: "not_found" }, { status: 404 }));
      }

      const object = await env.MANIFEST_R2.get(`releases/${filename}`);
      if (!object) {
        return withCors(request, Response.json({ ok: false, error: "not_found" }, { status: 404 }));
      }

      if (!shouldSkipCounting(getClientIp(request), env.IGNORED_IP) && shouldCountArtifactDownload(request)) {
        const releaseVersion = extractReleaseVersionFromFilename(filename);
        if (releaseVersion) {
          await incrementCounter(env.DB, day, "downloads");
          await incrementReleaseDownloadCounterBestEffort(env.DB, day, filename, releaseVersion);
        }
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("ETag", object.httpEtag);
      headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/zip");
      }

      return withCors(
        request,
        new Response(object.body, {
          status: 200,
          headers,
        })
      );
    }

    if (url.pathname === "/report") {
      const token = request.headers.get("X-Admin-Token");
      if (!env.ADMIN_TOKEN || !token || token !== env.ADMIN_TOKEN) {
        return withCors(request, Response.json({ ok: false, error: "unauthorized" }, { status: 401 }));
      }

      const reportRequest = resolveReportRequest(url);
      if (!reportRequest.ok) {
        return withCors(request, Response.json({ ok: false, error: reportRequest.error }, { status: 400 }));
      }

      try {
        const now = new Date();
        // asset/monthly/source_health read only stored aggregates; skip the traffic refresh.
        if (
          reportRequest.view !== "source_health" &&
          reportRequest.view !== "asset" &&
          reportRequest.view !== "monthly"
        ) {
          await refreshPreviousCompletedTrafficBestEffort(env, now);
        }

        const payload =
          reportRequest.view === "legacy"
            ? await buildLegacyReport(env.DB, env.BUSCORE_LEADS_DB, now, reportRequest.siteEventFilter)
            : reportRequest.view === "fleet"
              ? await buildFleetReport(env.DB, now)
              : reportRequest.view === "site"
                ? await buildSiteReport(env.DB, env.BUSCORE_LEADS_DB, now, reportRequest.siteEventFilter)
                : reportRequest.view === "asset"
                  ? await buildAssetReport(env.DB, env.BUSCORE_LEADS_DB, now)
                  : reportRequest.view === "monthly"
                    ? await buildMonthlyAssetReport(env.DB, env.BUSCORE_LEADS_DB, now)
                    : await buildSourceHealthReport(env.DB, now);

        return withCors(
          request,
          Response.json(payload, { status: 200 })
        );
      } catch {
        await incrementErrorCounterBestEffort(env.DB, day);
        return withCors(request, Response.json({ ok: false, error: "report_unavailable" }, { status: 503 }));
      }
    }

    return withCors(request, Response.json({ ok: false, error: "not_found" }, { status: 404 }));
  },
};
