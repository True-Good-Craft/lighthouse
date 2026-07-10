export const BUSCORE_TELEMETRY_PATH = "/telemetry/v1/events";
export const BUSCORE_TELEMETRY_SCHEMA_VERSION = "1.0";

const MAX_BODY_BYTES = 4096;
const RATE_LIMIT_PER_MINUTE = 120;
const RAW_RETENTION_DAYS = 30;
const RATE_RETENTION_DAYS = 2;
const AGGREGATE_RETENTION_DAYS = 400;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;

export const BUSCORE_TELEMETRY_EVENT_NAMES = [
  "installation_first_launch",
  "update_check",
  "update_success",
  "update_failure",
  "inventory_opened",
  "recipes_opened",
  "manufacturing_opened",
  "jobs_opened",
  "invoices_opened",
  "settings_opened",
  "first_inventory_item_created",
  "first_recipe_created",
  "first_manufacturing_run_completed",
  "first_job_completed",
  "first_invoice_created",
  "backup_completed",
  "restore_attempted",
  "restore_completed",
  "import_completed",
  "import_failed",
  "startup_failure",
  "backup_failure",
  "restore_failure",
  "unhandled_application_error",
  "migration_failure",
] as const;

type EventName = (typeof BUSCORE_TELEMETRY_EVENT_NAMES)[number];
const EVENT_NAMES = new Set<string>(BUSCORE_TELEMETRY_EVENT_NAMES);
const RELEASE_CHANNELS = new Set(["stable", "test", "partner-3dque", "lts-1.1", "security-hotfix"]);
const OS_CATEGORIES = new Set(["windows", "linux", "macos", "other"]);
const ROOT_FIELDS = new Set(["schema_version", "event_id", "event_name", "installation_id", "client_ts", "context"]);
const CONTEXT_FIELDS = new Set(["app_version", "release_channel", "os_category"]);

export type BuscoreTelemetryEvent = {
  schema_version: "1.0";
  event_id: string;
  event_name: EventName;
  installation_id: string;
  client_ts: string;
  context: {
    app_version: string;
    release_channel: string;
    os_category: string;
  };
};

export type BuscoreTelemetryParseResult =
  | { ok: true; event: BuscoreTelemetryEvent }
  | { ok: false; error: string };

function hasExactFields(record: Record<string, unknown>, allowed: Set<string>): boolean {
  const keys = Object.keys(record);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

export function parseBuscoreTelemetryEvent(value: unknown): BuscoreTelemetryParseResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "invalid_payload" };
  const root = value as Record<string, unknown>;
  if (!hasExactFields(root, ROOT_FIELDS)) return { ok: false, error: "unexpected_fields" };
  if (root.schema_version !== BUSCORE_TELEMETRY_SCHEMA_VERSION) return { ok: false, error: "unsupported_schema_version" };
  if (typeof root.event_id !== "string" || !UUID_V4.test(root.event_id)) return { ok: false, error: "invalid_event_id" };
  if (typeof root.installation_id !== "string" || !UUID_V4.test(root.installation_id)) return { ok: false, error: "invalid_installation_id" };
  if (typeof root.event_name !== "string" || !EVENT_NAMES.has(root.event_name)) return { ok: false, error: "invalid_event_name" };
  if (typeof root.client_ts !== "string" || !Number.isFinite(Date.parse(root.client_ts))) return { ok: false, error: "invalid_client_ts" };
  if (!root.context || typeof root.context !== "object" || Array.isArray(root.context)) return { ok: false, error: "invalid_context" };
  const context = root.context as Record<string, unknown>;
  if (!hasExactFields(context, CONTEXT_FIELDS)) return { ok: false, error: "unexpected_context_fields" };
  if (typeof context.app_version !== "string" || !SEMVER.test(context.app_version)) return { ok: false, error: "invalid_app_version" };
  if (typeof context.release_channel !== "string" || !RELEASE_CHANNELS.has(context.release_channel)) return { ok: false, error: "invalid_release_channel" };
  if (typeof context.os_category !== "string" || !OS_CATEGORIES.has(context.os_category)) return { ok: false, error: "invalid_os_category" };

  return { ok: true, event: root as BuscoreTelemetryEvent };
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcMinute(date: Date): string {
  return date.toISOString().slice(0, 16);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function incrementRateLimit(db: D1Database, minute: string, ipHash: string): Promise<number> {
  await db.prepare("INSERT INTO buscore_telemetry_rate_limit(minute_bucket, ip_hash, count) VALUES (?, ?, 1) ON CONFLICT(minute_bucket, ip_hash) DO UPDATE SET count = count + 1").bind(minute, ipHash).run();
  const row = await db.prepare("SELECT count FROM buscore_telemetry_rate_limit WHERE minute_bucket = ? AND ip_hash = ?").bind(minute, ipHash).first<{ count: number }>();
  return row?.count ?? 1;
}

async function persistEvent(db: D1Database, event: BuscoreTelemetryEvent, receivedAt: string, receivedDay: string): Promise<"accepted" | "duplicate"> {
  const result = await db.prepare("INSERT OR IGNORE INTO buscore_product_events_raw(event_id, schema_version, event_name, installation_id, client_ts, app_version, release_channel, os_category, received_at, received_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(event.event_id, event.schema_version, event.event_name, event.installation_id, event.client_ts, event.context.app_version, event.context.release_channel, event.context.os_category, receivedAt, receivedDay).run();
  if ((result.meta?.changes ?? 0) === 0) return "duplicate";
  await db.prepare("INSERT INTO buscore_product_events_daily(day, event_name, app_version, release_channel, os_category, event_count) VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT(day, event_name, app_version, release_channel, os_category) DO UPDATE SET event_count = event_count + 1")
    .bind(receivedDay, event.event_name, event.context.app_version, event.context.release_channel, event.context.os_category).run();
  return "accepted";
}

export async function handleBuscoreTelemetryRequest(request: Request, db: D1Database): Promise<Response> {
  if (request.method !== "POST") return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  if (!(request.headers.get("Content-Type") ?? "").toLowerCase().startsWith("application/json")) return Response.json({ ok: false, error: "invalid_content_type" }, { status: 415 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return Response.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const parsed = parseBuscoreTelemetryEvent(body);
  if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });

  const now = new Date();
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (clientIp) {
    const count = await incrementRateLimit(db, utcMinute(now), await sha256(clientIp));
    if (count > RATE_LIMIT_PER_MINUTE) return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const outcome = await persistEvent(db, parsed.event, now.toISOString(), utcDay(now));
  return Response.json({ ok: true, outcome }, { status: outcome === "accepted" ? 202 : 200 });
}

export async function pruneBuscoreTelemetry(db: D1Database, now: Date = new Date()): Promise<void> {
  const dayMs = 24 * 60 * 60 * 1000;
  const rawCutoff = utcDay(new Date(now.getTime() - RAW_RETENTION_DAYS * dayMs));
  const rateCutoff = utcMinute(new Date(now.getTime() - RATE_RETENTION_DAYS * dayMs));
  const aggregateCutoff = utcDay(new Date(now.getTime() - AGGREGATE_RETENTION_DAYS * dayMs));
  await Promise.all([
    db.prepare("DELETE FROM buscore_product_events_raw WHERE received_day < ?").bind(rawCutoff).run(),
    db.prepare("DELETE FROM buscore_telemetry_rate_limit WHERE minute_bucket < ?").bind(rateCutoff).run(),
    db.prepare("DELETE FROM buscore_product_events_daily WHERE day < ?").bind(aggregateCutoff).run(),
  ]);
}
