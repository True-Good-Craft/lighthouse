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

const MANIFEST_PATH = "/manifest/core/stable.json";
const MANIFEST_KEY = "manifest/core/stable.json";
const PAGEVIEW_METRICS_PATH = "/metrics/pageview";
const RELEASE_PATH = /^\/releases\/([^/]+)$/;
const RELEASE_FILENAME = /^TGC-BUS-Core-[0-9]+\.[0-9]+\.[0-9]+\.zip$/;
const CLOUDFLARE_GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const BUSCORE_HOST = "buscore.ca";
const PAGEVIEW_ALLOWED_ORIGINS = new Set(["https://buscore.ca", "https://www.buscore.ca"]);
const PAGEVIEW_INGEST_VERSION = "1.8.0";
const PAGEVIEW_RATE_LIMIT_PER_MINUTE = 50;
const PAGEVIEW_RAW_RETENTION_DAYS = 30;
const PAGEVIEW_RATE_LIMIT_RETENTION_DAYS = 2;
const TOP_PAGEVIEW_DIMENSION_LIMIT = 5;
const DIRECT_SOURCE_LABEL = "(direct)";
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

function normalizePageviewPayload(payload: unknown): PageviewInput {
  const root = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const utm = typeof root.utm === "object" && root.utm !== null ? (root.utm as Record<string, unknown>) : {};

  return {
    client_ts: nullIfBlank(root.client_ts),
    path: nullIfBlank(root.path),
    url: nullIfBlank(root.url),
    referrer: nullIfBlank(root.referrer),
    src: nullIfBlank(root.src),
    utm_source: nullIfBlank(utm.source),
    utm_medium: nullIfBlank(utm.medium),
    utm_campaign: nullIfBlank(utm.campaign),
    utm_content: nullIfBlank(utm.content),
    device: nullIfBlank(root.device),
    viewport: nullIfBlank(root.viewport),
    lang: nullIfBlank(root.lang),
    tz: nullIfBlank(root.tz),
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

async function insertPageviewRawEvent(db: D1Database, event: PageviewRawEvent): Promise<void> {
  await db
    .prepare(
      "INSERT INTO pageview_events_raw(id, received_at, received_day, client_ts, path, url, referrer, referrer_domain, src, utm_source, utm_medium, utm_campaign, utm_content, device, viewport, lang, tz, country, js_fired, ip_hash, user_agent_hash, accepted, drop_reason, request_id, ingest_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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

async function prunePageviewData(db: D1Database, now: Date = new Date()): Promise<void> {
  const rawCutoffDay = utcDay(addUtcDays(now, -PAGEVIEW_RAW_RETENTION_DAYS));
  const rateLimitCutoffMinute = utcMinuteBucket(
    new Date(now.getTime() - PAGEVIEW_RATE_LIMIT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  );

  await Promise.all([
    db.prepare("DELETE FROM pageview_events_raw WHERE received_day < ?").bind(rawCutoffDay).run(),
    db.prepare("DELETE FROM pageview_rate_limit WHERE minute_bucket < ?").bind(rateLimitCutoffMinute).run(),
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
  await insertPageviewRawEvent(db, buildPageviewRawEvent(normalizePageviewPayload(null), metadata, 0, "invalid_json"));
  await upsertPageviewDaily(db, metadata.receivedDay, metadata.receivedAt, {
    pageviews: 0,
    accepted: 0,
    dropped_rate_limited: 0,
    dropped_invalid: 1,
  });
}

async function processPageviewIngest(request: Request, env: Env): Promise<void> {
  const receivedAt = new Date();
  const receivedAtIso = receivedAt.toISOString();
  const receivedDay = utcDay(receivedAt);
  const clientIp = getClientIp(request);
  const userAgent = nullIfBlank(request.headers.get("User-Agent"));
  const [ipHash, userAgentHash] = await Promise.all([
    clientIp ? sha256Hex(clientIp) : Promise.resolve(null),
    userAgent ? sha256Hex(userAgent) : Promise.resolve(null),
  ]);

  const metadata = {
    receivedAt: receivedAtIso,
    receivedDay,
    country: getCountry(request),
    ipHash,
    userAgentHash,
    requestId: getRequestId(request),
  };

  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch {
    await persistDroppedInvalidPageview(env.DB, metadata);
    return;
  }

  if (!bodyText.trim()) {
    await persistDroppedInvalidPageview(env.DB, metadata);
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    await persistDroppedInvalidPageview(env.DB, metadata);
    return;
  }

  const normalized = normalizePageviewPayload(payload);
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

  if (new URL(request.url).pathname === PAGEVIEW_METRICS_PATH) {
    const origin = request.headers.get("Origin");
    if (origin && PAGEVIEW_ALLOWED_ORIGINS.has(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
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
      const allowMethods = url.pathname === PAGEVIEW_METRICS_PATH ? "POST, OPTIONS" : "GET, OPTIONS";
      return withCors(request, new Response(null, { status: 200 }), allowMethods);
    }

    if (url.pathname === PAGEVIEW_METRICS_PATH && request.method === "POST") {
      ctx.waitUntil(
        processPageviewIngest(request.clone(), env).catch((error) => {
          console.warn("Pageview ingest failed after 204 response.", error);
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

      try {
        const now = new Date();
        const previousCompletedDay = utcDay(addUtcDays(now, -1));
        try {
          await captureTrafficForDay(env, previousCompletedDay);
        } catch (error) {
          console.warn(
            "Best-effort previous-day Buscore traffic refresh during /report failed; returning report with stored traffic only.",
            error
          );
        }

        const todayDay = utcDay(now);
        const yesterdayDay = utcDay(addUtcDays(now, -1));
        const last7StartDay = utcDay(addUtcDays(now, -6));
        const previous7StartDay = utcDay(addUtcDays(now, -13));
        const previous7EndDay = utcDay(addUtcDays(now, -7));
        const monthStartDay = utcMonthStart(now);

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
        ] = await Promise.all([
          queryTotalsInRange(env.DB, todayDay, todayDay),
          queryTotalsInRange(env.DB, yesterdayDay, yesterdayDay),
          queryTotalsInRange(env.DB, last7StartDay, todayDay),
          queryTotalsInRange(env.DB, previous7StartDay, previous7EndDay),
          queryTotalsInRange(env.DB, monthStartDay, todayDay),
          queryLatestTrafficRow(env.DB),
          queryTrafficTotalsInRange(env.DB, last7StartDay, todayDay),
          queryPageviewTotalsForDay(env.DB, todayDay),
          queryPageviewLast7Summary(env.DB, last7StartDay, todayDay),
          queryPageviewObservability(env.DB),
          queryTopPageviewDimensions(env.DB, last7StartDay, todayDay, "path"),
          queryTopPageviewDimensions(env.DB, last7StartDay, todayDay, "referrer_domain"),
          queryTopPageviewSources(env.DB, last7StartDay, todayDay),
        ]);

        return withCors(
          request,
          Response.json(
            {
              today,
              yesterday,
              last_7_days: last7Days,
              month_to_date: monthToDate,
              trends: {
                downloads_change_percent: percentChange(today.downloads, yesterday.downloads),
                update_checks_change_percent: percentChange(today.update_checks, yesterday.update_checks),
                weekly_downloads_change_percent: percentChange(last7Days.downloads, previous7Days.downloads),
                weekly_update_checks_change_percent: percentChange(last7Days.update_checks, previous7Days.update_checks),
                conversion_ratio: safeRatio(today.downloads, today.update_checks),
              },
              traffic: {
                latest_day: latestTrafficWindow(latestTraffic),
                last_7_days: trafficWindowFromTotals(last7Traffic),
              },
              human_traffic: {
                today: {
                  pageviews: humanToday.pageviews,
                  last_received_at: humanToday.last_received_at,
                },
                last_7_days: {
                  pageviews: humanLast7.pageviews,
                  days_with_data: humanLast7.days_with_data,
                  top_paths: topPaths.map((row) => ({ path: row.value, pageviews: row.pageviews })),
                  top_referrers: topReferrers.map((row) => ({ referrer_domain: row.value, pageviews: row.pageviews })),
                  top_sources: topSources,
                },
                observability: humanObservability,
              },
            },
            { status: 200 }
          )
        );
      } catch {
        await incrementErrorCounterBestEffort(env.DB, day);
        return withCors(request, Response.json({ ok: false, error: "report_unavailable" }, { status: 503 }));
      }
    }

    return withCors(request, Response.json({ ok: false, error: "not_found" }, { status: 404 }));
  },
};
