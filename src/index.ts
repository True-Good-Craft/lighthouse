export interface Env {
  DB: D1Database;
  MANIFEST_R2: R2Bucket;
}

type CounterColumn = "update_checks" | "downloads" | "errors";

const MANIFEST_PATH = "/manifest/core/stable.json";
const MANIFEST_KEY = "manifest/core/stable.json";
const RELEASE_ARTIFACT_PATH = /^\/releases\/([^/]+)\/TGC-BUS-Core-\1\.zip$/;

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

async function querySummary(db: D1Database): Promise<{ update_checks: number; downloads: number; errors: number }> {
  const row = await db
    .prepare(
      "SELECT COALESCE(SUM(update_checks),0) AS update_checks, COALESCE(SUM(downloads),0) AS downloads, COALESCE(SUM(errors),0) AS errors FROM metrics_daily"
    )
    .first<{ update_checks: number; downloads: number; errors: number }>();

  return row ?? { update_checks: 0, downloads: 0, errors: 0 };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const day = utcDay();

    if (request.method !== "GET") {
      return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }

    if (url.pathname === MANIFEST_PATH) {
      try {
        const manifest = await readManifestFromR2(env);
        return new Response(manifest.raw, {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      } catch {
        await incrementErrorCounterBestEffort(env.DB, day);
        return Response.json({ ok: false, error: "manifest_unavailable" }, { status: 503 });
      }
    }

    if (url.pathname === "/update/check") {
      try {
        await incrementCounter(env.DB, day, "update_checks");
        const manifest = await readManifestFromR2(env);
        return new Response(manifest.raw, {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json",
          },
        });
      } catch {
        await incrementErrorCounterBestEffort(env.DB, day);
        return Response.json({ ok: false, error: "manifest_unavailable" }, { status: 503 });
      }
    }

    if (url.pathname === "/download/latest") {
      try {
        await incrementCounter(env.DB, day, "downloads");
        const manifest = await readManifestFromR2(env);
        const latestUrl = extractLatestDownloadUrl(manifest.parsed);

        if (!latestUrl || !isValidReleaseArtifactUrl(latestUrl)) {
          await incrementErrorCounterBestEffort(env.DB, day);
          return Response.json({ ok: false, error: "manifest_unavailable" }, { status: 503 });
        }

        return Response.redirect(latestUrl, 302);
      } catch {
        await incrementErrorCounterBestEffort(env.DB, day);
        return Response.json({ ok: false, error: "manifest_unavailable" }, { status: 503 });
      }
    }

    if (url.pathname === "/report") {
      try {
        const summary = await querySummary(env.DB);
        return Response.json(summary, { status: 200 });
      } catch {
        await incrementErrorCounterBestEffort(env.DB, day);
        return Response.json({ ok: false, error: "report_unavailable" }, { status: 503 });
      }
    }

    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  },
};
