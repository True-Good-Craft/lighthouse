export interface Env {
  DB: D1Database;
  MANIFEST_R2: R2Bucket;
  ADMIN_TOKEN: string;
  IGNORED_IP: string;
  CF_API_TOKEN: string;
  CF_ZONE_TAG: string;
}

type CounterColumn = "update_checks" | "downloads" | "errors";
type MetricTotals = { update_checks: number; downloads: number; errors: number };
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
  top_sources: Array<{ source: string; events: number }>;
  top_campaigns: Array<{ utm_campaign: string; events: number }>;
  top_referrers: Array<{ referrer_domain: string; events: number }>;
  observability: {
    included_events: number;
    excluded_test_mode: number;
    excluded_non_production_host: number;
    dropped_rate_limited: number;
    dropped_invalid: number;
    last_received_at: string | null;
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
type ReportView = "legacy" | "fleet" | "site" | "source_health";
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
  traffic: {
    cloudflare_traffic_enabled: boolean;
    latest_day: ReturnType<typeof latestTrafficWindow>;
    last_7_days: ReturnType<typeof trafficWindowFromTotals>;
  };
  events: {
    accepted_events: number;
    unique_paths: number;
    by_event_name: Array<{ event_name: string; events: number }>;
    top_sources: Array<{ source: string; events: number }>;
    top_campaigns: Array<{ utm_campaign: string; events: number }>;
    top_referrers: Array<{ referrer_domain: string; events: number }>;
  };
  identity: IdentitySummary | null;
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
const RELEASE_FILENAME = /^TGC-BUS-Core-[0-9]+\.[0-9]+\.[0-9]+\.zip$/;
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

  if (normalized === "fleet" || normalized === "site" || normalized === "source_health") {
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

function isValidReleaseArtifactUrl(rawUrl: string): boolean {
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

function buildProductionHostClause(site: TrackedSite): { sql: string; bindings: string[] } {
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
      filter.siteKey,
      startDay,
      endDay,
      ...(filter.productionOnly ? production.bindings : []),
      ...production.bindings
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

async function buildSiteEventSummary(
  db: D1Database,
  filter: SiteEventFilter,
  startDay: string,
  endDay: string
): Promise<SiteEventSummary> {
  const [overview, byEventName, topCampaigns, topReferrers, sourceRows, observability] = await Promise.all([
    querySiteEventOverview(db, filter, startDay, endDay),
    querySiteEventsByEventName(db, filter, startDay, endDay),
    querySiteEventTopCampaigns(db, filter, startDay, endDay),
    querySiteEventTopReferrers(db, filter, startDay, endDay),
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
    top_sources: summarizeSiteEventTopSources(sourceRows),
    top_campaigns: topCampaigns,
    top_referrers: topReferrers,
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
}) {
  return {
    today: input.today,
    yesterday: input.yesterday,
    last_7_days: input.last7Days,
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
    human_traffic: {
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
    },
    identity: input.identity,
    site_events: input.siteEvents,
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
  previous7StartDay: string;
  previous7EndDay: string;
  monthStartDay: string;
} {
  return {
    todayDay: utcDay(now),
    yesterdayDay: utcDay(addUtcDays(now, -1)),
    last7StartDay: utcDay(addUtcDays(now, -6)),
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
  now: Date,
  siteEventFilter: SiteEventFilter | null
): Promise<ReturnType<typeof assembleLegacyReport>> {
  const { todayDay, yesterdayDay, last7StartDay, previous7StartDay, previous7EndDay, monthStartDay } = reportDayBounds(now);
  const siteEventSummaryPromise = siteEventFilter
    ? buildSiteEventSummary(db, siteEventFilter, last7StartDay, todayDay)
    : Promise.resolve<SiteEventSummary | null>(null);

  const [
    today,
    yesterday,
    last7Days,
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
  ] = await Promise.all([
    queryTotalsInRange(db, todayDay, todayDay),
    queryTotalsInRange(db, yesterdayDay, yesterdayDay),
    queryTotalsInRange(db, last7StartDay, todayDay),
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
  ]);

  const identity = summarizeIdentity(identityEvents, firstSeenByIdentity, todayDay, last7StartDay);

  return assembleLegacyReport({
    today,
    yesterday,
    last7Days,
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
  const traffic = {
    cloudflare_traffic_enabled: site.cloudflare_traffic_enabled,
    latest_day: latestTrafficWindow(snapshot.latestTraffic),
    last_7_days: trafficWindowFromTotals(snapshot.trafficTotals ?? emptyTrafficTotals()),
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
    traffic,
    events: {
      accepted_events: snapshot.siteEventSummary.totals.accepted_events,
      unique_paths: snapshot.siteEventSummary.totals.unique_paths,
      by_event_name: snapshot.siteEventSummary.by_event_name,
      top_sources: snapshot.siteEventSummary.top_sources,
      top_campaigns: snapshot.siteEventSummary.top_campaigns,
      top_referrers: snapshot.siteEventSummary.top_referrers,
    },
    identity,
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

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      Promise.all([
        capturePreviousCompletedBuscoreTraffic(env).catch((error) => {
          console.warn("Buscore traffic capture skipped after Cloudflare GraphQL failure.", error);
        }),
        prunePageviewData(env.DB).catch((error) => {
          console.warn("Pageview retention cleanup skipped after D1 failure.", error);
        }),
      ]).then(() => undefined)
    );
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const day = utcDay();

    if (request.method === "OPTIONS") {
      const allowMethods =
        url.pathname === PAGEVIEW_METRICS_PATH || url.pathname === SITE_EVENT_METRICS_PATH
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
        if (!shouldSkipCounting(getClientIp(request), env.IGNORED_IP)) {
          await incrementCounter(env.DB, day, "update_checks");
        }
        const manifest = await readManifestFromR2(env);
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
        if (!shouldSkipCounting(getClientIp(request), env.IGNORED_IP)) {
          await incrementCounter(env.DB, day, "downloads");
        }
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
        if (reportRequest.view !== "source_health") {
          await refreshPreviousCompletedTrafficBestEffort(env, now);
        }

        const payload =
          reportRequest.view === "legacy"
            ? await buildLegacyReport(env.DB, now, reportRequest.siteEventFilter)
            : reportRequest.view === "fleet"
              ? await buildFleetReport(env.DB, now)
              : reportRequest.view === "site"
                ? await buildSiteReport(env.DB, now, reportRequest.siteEventFilter)
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
