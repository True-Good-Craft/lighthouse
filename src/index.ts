export interface Env {
  DB: D1Database;
  MANIFEST_R2: R2Bucket;
  ADMIN_TOKEN: string;
}

type CounterColumn = "update_checks" | "downloads" | "errors";

const MANIFEST_PATH = "/manifest/core/stable.json";
const MANIFEST_KEY = "manifest/core/stable.json";
const RELEASE_ARTIFACT_PATH = /^\/releases\/([^/]+)\/TGC-BUS-Core-\1\.zip$/;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
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
    const parsed = new URL(rawUrl);
    return RELEASE_ARTIFACT_PATH.test(parsed.pathname);
  } catch {
    return false;
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
        const key = "manifest/core/stable.json";
        const obj = await env.MANIFEST_R2.get(key);

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
        await incrementCounter(env.DB, day, "update_checks");
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
        await incrementCounter(env.DB, day, "downloads");
        const manifest = await readManifestFromR2(env);
        const latestUrl = extractLatestDownloadUrl(manifest.parsed);

        if (!latestUrl || !isValidReleaseArtifactUrl(latestUrl)) {
          await incrementErrorCounterBestEffort(env.DB, day);
          return withCors(Response.json({ ok: false, error: "manifest_unavailable" }, { status: 503 }));
        }

        return withCors(Response.redirect(latestUrl, 302));
      } catch {
        await incrementErrorCounterBestEffort(env.DB, day);
        return withCors(Response.json({ ok: false, error: "manifest_unavailable" }, { status: 503 }));
      }
    }

    if (url.pathname === "/report") {
      const token = request.headers.get("X-Admin-Token");
      if (!env.ADMIN_TOKEN || !token || token !== env.ADMIN_TOKEN) {
        return withCors(Response.json({ ok: false, error: "unauthorized" }, { status: 401 }));
      }

      try {
        const now = new Date();
        const todayDay = utcDay(now);
        const yesterdayDay = utcDay(addUtcDays(now, -1));
        const last7StartDay = utcDay(addUtcDays(now, -6));
        const previous7StartDay = utcDay(addUtcDays(now, -13));
        const previous7EndDay = utcDay(addUtcDays(now, -7));
        const monthStartDay = utcMonthStart(now);

        const [today, yesterday, last7Days, previous7Days, monthToDate] = await Promise.all([
          queryTotalsInRange(env.DB, todayDay, todayDay),
          queryTotalsInRange(env.DB, yesterdayDay, yesterdayDay),
          queryTotalsInRange(env.DB, last7StartDay, todayDay),
          queryTotalsInRange(env.DB, previous7StartDay, previous7EndDay),
          queryTotalsInRange(env.DB, monthStartDay, todayDay),
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
