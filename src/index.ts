export interface Env {
  DB: D1Database;
  MANIFEST_R2: R2Bucket;
  ADMIN_TOKEN: string;
  IGNORED_IP: string;
  CF_API_TOKEN: string;
  CF_ZONE_TAG: string;
}

type CounterColumn = "update_checks" | "downloads" | "errors";
type TrafficTotals = { row_count: number; visits: number | null; requests: number | null };
type TrafficRow = { day: string; visits: number | null; requests: number; referrer_summary: string | null; captured_at: string };
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

type CloudflareReferrersGraphQLResponse = {
  data?: {
    viewer?: {
      zones?: Array<{
        referrerData?: Array<{
          count?: number | null;
          dimensions?: {
            clientRefererHost?: string | null;
          };
        }>;
      }>;
    };
  };
  errors?: Array<{ message?: string }> | null;
};

const MANIFEST_PATH = "/manifest/core/stable.json";
const MANIFEST_KEY = "manifest/core/stable.json";
const RELEASE_PATH = /^\/releases\/([^/]+)$/;
const RELEASE_FILENAME = /^TGC-BUS-Core-[0-9]+\.[0-9]+\.[0-9]+\.zip$/;
const CLOUDFLARE_GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const BUSCORE_HOST = "buscore.ca";
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

const BUSCORE_REFERRERS_QUERY = `query DailyBuscoreReferrers($zoneTag: string, $start: Time!, $end: Time!, $host: string!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      referrerData: httpRequestsAdaptiveGroups(
        limit: 10
        orderBy: [count_DESC]
        filter: {
          datetime_geq: $start
          datetime_lt: $end
          clientRequestHTTPHost: $host
          requestSource: "eyeball"
        }
      ) {
        count
        dimensions {
          clientRefererHost
        }
      }
    }
  }
}`;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function getClientIp(request: Request): string | null {
  const ip = request.headers.get("CF-Connecting-IP");
  return ip && ip.trim() ? ip.trim() : null;
}

function shouldSkipCounting(clientIp: string | null, ignoredIp: string | undefined): boolean {
  if (!ignoredIp || !ignoredIp.trim()) return false;
  if (!clientIp) return false;
  return clientIp === ignoredIp.trim();
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

type MetricTotals = { update_checks: number; downloads: number; errors: number };

function addUtcDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function utcMonthStart(base: Date): string {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1)).toISOString().slice(0, 10);
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
    .prepare(
      "SELECT day, visits, requests, referrer_summary, captured_at FROM buscore_traffic_daily ORDER BY day DESC LIMIT 1"
    )
    .first<TrafficRow>();

  return row ?? null;
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
  referrer_summary: string | null;
} {
  if (!row) {
    return {
      day: null,
      visits: null,
      requests: null,
      captured_at: null,
      referrer_summary: null,
    };
  }

  return {
    day: row.day,
    visits: row.visits,
    requests: row.requests,
    captured_at: row.captured_at,
    referrer_summary: row.referrer_summary,
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

async function fetchTopReferrersForDay(env: Env, day: string): Promise<Array<{ referrer: string; count: number }>> {
  console.log(`[Referrer Capture] Starting query for day ${day}`);
  const response = await fetch(CLOUDFLARE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: BUSCORE_REFERRERS_QUERY,
      variables: {
        zoneTag: env.CF_ZONE_TAG,
        start: `${day}T00:00:00Z`,
        end: `${utcDay(addUtcDays(new Date(`${day}T00:00:00Z`), 1))}T00:00:00Z`,
        host: BUSCORE_HOST,
      },
    }),
  });

  if (!response.ok) {
    const errorMsg = `HTTP ${response.status}`;
    console.error(`[Referrer Capture] Query failed: ${errorMsg}`);
    throw new Error(`cloudflare_referrers_graphql_http_${response.status}`);
  }

  const payload = (await response.json()) as CloudflareReferrersGraphQLResponse;
  if (payload.errors && payload.errors.length > 0) {
    const message = payload.errors.map((error) => error.message || "graphql_error").join("; ");
    console.error(`[Referrer Capture] GraphQL error(s): ${message}`);
    throw new Error(`cloudflare_referrers_graphql_payload_${message}`);
  }

  const rows = payload.data?.viewer?.zones?.[0]?.referrerData;
  if (!rows || rows.length === 0) {
    console.warn(
      `[Referrer Capture] Query returned no rows. Payload structure: data=${!!payload.data}, viewer=${!!payload.data?.viewer}, zones=${!!payload.data?.viewer?.zones}, referrerData=${rows ? "exists but empty" : "missing"}`
    );
    throw new Error("cloudflare_referrers_graphql_empty_result");
  }

  console.log(`[Referrer Capture] Query succeeded; ${rows.length} raw referrer row(s) returned from Cloudflare`);

  const referrers: Array<{ referrer: string; count: number }> = [];
  let skippedCount = 0;
  for (const row of rows) {
    const referer = row.dimensions?.clientRefererHost ?? null;
    const count = row.count ?? null;

    if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) {
      skippedCount++;
      continue;
    }

    const normalizedReferer = normalizeReferrer(referer);
    referrers.push({ referrer: normalizedReferer, count });
  }

  if (skippedCount > 0) {
    console.log(`[Referrer Capture] Skipped ${skippedCount} row(s) with invalid/missing count metric`);
  }

  if (referrers.length === 0) {
    console.error(
      `[Referrer Capture] No valid entries after filtering. All ${rows.length} rows either had invalid count or normalized to nothing.`
    );
    throw new Error("cloudflare_referrers_no_valid_entries");
  }

  console.log(`[Referrer Capture] Normalized to ${referrers.length} unique referrer(s) after aggregation`);
  return referrers;
}

function normalizeReferrer(referer: string | null | undefined): string {
  if (!referer || !referer.trim()) {
    return "direct_or_unknown";
  }

  const normalized = referer.trim().toLowerCase();

  if (normalized === "" || normalized === "-" || normalized === "(direct)" || normalized === "direct") {
    return "direct_or_unknown";
  }

  try {
    const url = new URL(normalized.startsWith("http") ? normalized : `https://${normalized}`);
    const hostname = url.hostname.toLowerCase();
    if (hostname === "buscore.ca" || hostname === "www.buscore.ca") {
      return "self_hosted";
    }
    return hostname;
  } catch {
    return "direct_or_unknown";
  }
}

function buildReferrerSummary(referrers: Array<{ referrer: string; count: number }>): string {
  const summary: Record<string, number> = {};
  for (const item of referrers) {
    if (summary[item.referrer] !== undefined) {
      summary[item.referrer] += item.count;
    } else {
      summary[item.referrer] = item.count;
    }
  }

  const sorted = Object.entries(summary)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const result = JSON.stringify(Object.fromEntries(sorted));
  console.log(`[Referrer Capture] Summary built: ${result}`);
  return result;
}

async function fetchReferrerSummaryForDay(env: Env, day: string): Promise<string | null> {
  try {
    const referrers = await fetchTopReferrersForDay(env, day);
    const summary = buildReferrerSummary(referrers);
    console.log(`[Referrer Capture] Capture succeeded for day ${day}; referrer_summary will be populated.`);
    return summary;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(
      `[Referrer Capture] Referrer capture failed for day ${day}; traffic totals will still be captured with referrer_summary=null. Error: ${errorMsg}`
    );
    return null;
  }
}

async function upsertBuscoreTrafficDaily(
  db: D1Database,
  snapshot: { day: string; visits: number | null; requests: number; referrer_summary: string | null; captured_at: string }
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO buscore_traffic_daily(day, visits, requests, referrer_summary, captured_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET visits = excluded.visits, requests = excluded.requests, referrer_summary = excluded.referrer_summary, captured_at = excluded.captured_at"
    )
    .bind(snapshot.day, snapshot.visits, snapshot.requests, snapshot.referrer_summary, snapshot.captured_at)
    .run();
}

async function captureTrafficForDay(env: Env, day: string): Promise<void> {
  if (!env.CF_API_TOKEN || !env.CF_ZONE_TAG) {
    console.warn("Skipping Buscore traffic capture because CF_API_TOKEN or CF_ZONE_TAG is missing.");
    return;
  }

  console.log(`[Traffic Totals] Fetching traffic totals for day ${day}`);
  const traffic = await fetchPreviousCompletedBuscoreTraffic(env, day);
  console.log(`[Traffic Totals] Retrieved: visits=${traffic.visits}, requests=${traffic.requests}`);

  let referrerSummary: string | null = null;
  console.log(`[Referrer Capture] Starting referrer capture for day ${day}`);
  try {
    referrerSummary = await fetchReferrerSummaryForDay(env, day);
  } catch (error) {
    console.warn("Referrer summary fetch failed; storing traffic totals with null referrer_summary.", error);
  }

  console.log(
    `[Traffic Totals] Upserting row for day ${day}: visits=${traffic.visits}, requests=${traffic.requests}, referrer_summary=${referrerSummary ? "populated" : "null"}`
  );
  await upsertBuscoreTrafficDaily(env.DB, {
    day,
    visits: traffic.visits,
    requests: traffic.requests,
    referrer_summary: referrerSummary,
    captured_at: new Date().toISOString(),
  });
  console.log(`[Traffic Totals] Upsert complete for day ${day}`);
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

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      capturePreviousCompletedBuscoreTraffic(env).catch((error) => {
        console.warn("Buscore traffic capture skipped after Cloudflare GraphQL failure.", error);
      })
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const day = utcDay();

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 200 }));
    }

    if (request.method !== "GET") {
      return withCors(Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 }));
    }

    if (url.pathname === MANIFEST_PATH) {
      try {
        const obj = await env.MANIFEST_R2.get(MANIFEST_KEY);

        if (!obj) {
          await incrementErrorCounterBestEffort(env.DB, day);
          return withCors(
            new Response(JSON.stringify({ ok: false, error: "manifest_unavailable" }), {
              status: 503,
              headers: {
                "Content-Type": "application/json",
              },
            })
          );
        }

        return withCors(
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
        return withCors(Response.json({ ok: false, error: "manifest_unavailable" }, { status: 503 }));
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
          return withCors(Response.json({ ok: false, error: "manifest_unavailable" }, { status: 503 }));
        }

        return withCors(Response.redirect(redirectUrl, 302));
      } catch {
        await incrementErrorCounterBestEffort(env.DB, day);
        return withCors(Response.json({ ok: false, error: "manifest_unavailable" }, { status: 503 }));
      }
    }

    const releaseMatch = url.pathname.match(RELEASE_PATH);
    if (releaseMatch) {
      const filename = releaseMatch[1];

      if (!RELEASE_FILENAME.test(filename)) {
        return withCors(Response.json({ ok: false, error: "not_found" }, { status: 404 }));
      }

      const object = await env.MANIFEST_R2.get(`releases/${filename}`);
      if (!object) {
        return withCors(Response.json({ ok: false, error: "not_found" }, { status: 404 }));
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("ETag", object.httpEtag);
      headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/zip");
      }

      return withCors(
        new Response(object.body, {
          status: 200,
          headers,
        })
      );
    }

    if (url.pathname === "/report") {
      const token = request.headers.get("X-Admin-Token");
      if (!env.ADMIN_TOKEN || !token || token !== env.ADMIN_TOKEN) {
        return withCors(Response.json({ ok: false, error: "unauthorized" }, { status: 401 }));
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

        const [today, yesterday, last7Days, previous7Days, monthToDate, latestTraffic, last7Traffic] = await Promise.all([
          queryTotalsInRange(env.DB, todayDay, todayDay),
          queryTotalsInRange(env.DB, yesterdayDay, yesterdayDay),
          queryTotalsInRange(env.DB, last7StartDay, todayDay),
          queryTotalsInRange(env.DB, previous7StartDay, previous7EndDay),
          queryTotalsInRange(env.DB, monthStartDay, todayDay),
          queryLatestTrafficRow(env.DB),
          queryTrafficTotalsInRange(env.DB, last7StartDay, todayDay),
        ]);

        return withCors(
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
            },
            { status: 200 }
          )
        );
      } catch {
        await incrementErrorCounterBestEffort(env.DB, day);
        return withCors(Response.json({ ok: false, error: "report_unavailable" }, { status: 503 }));
      }
    }

    return withCors(Response.json({ ok: false, error: "not_found" }, { status: 404 }));
  },
};
