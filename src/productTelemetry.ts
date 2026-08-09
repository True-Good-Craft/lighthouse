export const BUSCORE_TELEMETRY_PATH = "/telemetry/v1/events";
export const BUSCORE_TELEMETRY_SCHEMA_VERSION = "1.0";

export const BUSCORE_TELEMETRY_LIMITS = {
  max_body_bytes: 4096,
  rate_limit_per_minute: 120,
  app_version_max_length: 20,
  semver_component_max_digits: 6,
} as const;

export const BUSCORE_TELEMETRY_RETENTION = {
  dedup: 30,
  aggregate: 400,
  rate_limit: 2,
} as const;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEMVER = /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$/;
const STRICT_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const BUSCORE_TELEMETRY_EVENT_CATEGORIES = {
  installation_release: [
    "installation_first_launch",
    "version_first_seen",
    "update_check",
    "update_check_startup",
    "update_check_manual",
    "update_staged",
    "update_failure",
  ],
  workflow_milestone: [
    "first_stock_recorded",
    "first_contact_created",
    "first_recipe_created",
    "first_manufacturing_run_completed",
    "first_job_completed",
    "first_invoice_issued",
    "first_finance_entry_recorded",
    "first_backup_exported",
    "restore_attempted",
    "restore_completed",
    "import_completed",
    "import_failed",
  ],
  reliability: [
    "startup_failure",
    "backup_failure",
    "restore_failure",
    "unhandled_application_error",
    "migration_failure",
  ],
} as const;

export type BuscoreTelemetryCategory = keyof typeof BUSCORE_TELEMETRY_EVENT_CATEGORIES;
export const BUSCORE_TELEMETRY_EVENT_NAMES = Object.values(BUSCORE_TELEMETRY_EVENT_CATEGORIES).flat();
export const BUSCORE_TELEMETRY_WORKFLOW_MILESTONE_EVENTS = [
  "first_stock_recorded",
  "first_contact_created",
  "first_recipe_created",
  "first_manufacturing_run_completed",
  "first_job_completed",
  "first_invoice_issued",
  "first_finance_entry_recorded",
  "first_backup_exported",
  "restore_completed",
  "import_completed",
] as const;
export const BUSCORE_TELEMETRY_PRODUCT_FAILURE_EVENTS = [
  "update_failure",
  "startup_failure",
  "backup_failure",
  "restore_failure",
  "migration_failure",
  "import_failed",
  "unhandled_application_error",
] as const;
export const BUSCORE_TELEMETRY_RELEASE_CHANNELS = ["stable", "test", "partner-3dque", "lts-1.1", "security-hotfix"] as const;
export const BUSCORE_TELEMETRY_OS_CATEGORIES = ["windows", "linux", "macos", "other"] as const;
export const BUSCORE_TELEMETRY_ROOT_FIELDS = ["schema_version", "event_id", "event_name", "client_ts", "context"] as const;
export const BUSCORE_TELEMETRY_CONTEXT_FIELDS = ["app_version", "release_channel", "os_category"] as const;
const LEGACY_ROOT_FIELDS = new Set<string>([...BUSCORE_TELEMETRY_ROOT_FIELDS, "installation_id"]);

type EventName = (typeof BUSCORE_TELEMETRY_EVENT_NAMES)[number];
const EVENT_NAMES = new Set<string>(BUSCORE_TELEMETRY_EVENT_NAMES);
const RELEASE_CHANNELS = new Set<string>(BUSCORE_TELEMETRY_RELEASE_CHANNELS);
const OS_CATEGORIES = new Set<string>(BUSCORE_TELEMETRY_OS_CATEGORIES);
const ROOT_FIELDS = new Set<string>(BUSCORE_TELEMETRY_ROOT_FIELDS);
const CONTEXT_FIELDS = new Set<string>(BUSCORE_TELEMETRY_CONTEXT_FIELDS);
const CATEGORY_BY_EVENT = new Map<string, BuscoreTelemetryCategory>(
  Object.entries(BUSCORE_TELEMETRY_EVENT_CATEGORIES).flatMap(([category, eventNames]) =>
    eventNames.map((eventName) => [eventName, category as BuscoreTelemetryCategory] as const)
  )
);
let localRateLimitSecret: string | undefined;

function resolveRateLimitSecret(configuredSecret?: string): string {
  if (configuredSecret) return configuredSecret;
  // Cloudflare forbids random generation during module initialization. Keep the
  // standalone-development fallback isolate-local, but initialize it lazily
  // from request scope where runtime I/O is allowed.
  localRateLimitSecret ??= crypto.randomUUID();
  return localRateLimitSecret;
}

export type BuscoreTelemetryEvent = {
  schema_version: "1.0";
  event_id: string;
  event_name: EventName;
  client_ts: string;
  context: {
    app_version: string;
    release_channel: string;
    os_category: string;
  };
};

export type BuscoreTelemetryParseResult =
  | { ok: true; event: BuscoreTelemetryEvent; category: BuscoreTelemetryCategory }
  | { ok: false; error: string };

export type BuscoreProductTelemetryBreakdown = { key: string; events: number };
export type BuscoreProductTelemetryWindow = {
  total_events: number;
  categories: Record<BuscoreTelemetryCategory, number>;
  by_event_name: BuscoreProductTelemetryBreakdown[];
  by_app_version: BuscoreProductTelemetryBreakdown[];
  by_release_channel: BuscoreProductTelemetryBreakdown[];
  by_os_category: BuscoreProductTelemetryBreakdown[];
  first_launches: number;
  version_first_seen: number;
  update_check_delivery_observations: number;
  update_check_startup: number;
  update_check_manual: number;
  update_staged: number;
};

export type BuscoreProductTelemetryReport =
  | {
      available: true;
      semantics: {
        first_launches: string;
        version_first_seen: string;
        update_check_delivery_observations: string;
        update_check_startup: string;
        update_check_manual: string;
      };
      today: BuscoreProductTelemetryWindow;
      last_7_days: BuscoreProductTelemetryWindow;
      last_30_days: BuscoreProductTelemetryWindow;
    }
  | { available: false; reason: "storage_unavailable" };

function hasExactFields(record: Record<string, unknown>, allowed: Set<string>): boolean {
  const keys = Object.keys(record);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function isStrictUtcTimestamp(value: string): boolean {
  if (!STRICT_UTC_TIMESTAMP.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

export function categoryForBuscoreTelemetryEvent(eventName: string): BuscoreTelemetryCategory | null {
  return CATEGORY_BY_EVENT.get(eventName) ?? null;
}

export function parseBuscoreTelemetryEvent(value: unknown): BuscoreTelemetryParseResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "invalid_payload" };
  const root = value as Record<string, unknown>;
  if (!hasExactFields(root, ROOT_FIELDS) && !hasExactFields(root, LEGACY_ROOT_FIELDS)) {
    return { ok: false, error: "unexpected_fields" };
  }
  if (root.schema_version !== BUSCORE_TELEMETRY_SCHEMA_VERSION) return { ok: false, error: "unsupported_schema_version" };
  if (typeof root.event_id !== "string" || !UUID_V4.test(root.event_id)) return { ok: false, error: "invalid_event_id" };
  if (typeof root.event_name !== "string" || !EVENT_NAMES.has(root.event_name)) return { ok: false, error: "invalid_event_name" };
  if (typeof root.client_ts !== "string" || !isStrictUtcTimestamp(root.client_ts)) return { ok: false, error: "invalid_client_ts" };
  if (!root.context || typeof root.context !== "object" || Array.isArray(root.context)) return { ok: false, error: "invalid_context" };
  const context = root.context as Record<string, unknown>;
  if (!hasExactFields(context, CONTEXT_FIELDS)) return { ok: false, error: "unexpected_context_fields" };
  if (
    typeof context.app_version !== "string" ||
    context.app_version.length > BUSCORE_TELEMETRY_LIMITS.app_version_max_length ||
    !SEMVER.test(context.app_version)
  ) return { ok: false, error: "invalid_app_version" };
  if (typeof context.release_channel !== "string" || !RELEASE_CHANNELS.has(context.release_channel)) return { ok: false, error: "invalid_release_channel" };
  if (typeof context.os_category !== "string" || !OS_CATEGORIES.has(context.os_category)) return { ok: false, error: "invalid_os_category" };

  return {
    ok: true,
    event: {
      schema_version: "1.0",
      event_id: root.event_id,
      event_name: root.event_name as EventName,
      client_ts: root.client_ts,
      context: {
        app_version: context.app_version,
        release_channel: context.release_channel as BuscoreTelemetryEvent["context"]["release_channel"],
        os_category: context.os_category as BuscoreTelemetryEvent["context"]["os_category"],
      },
    },
    category: categoryForBuscoreTelemetryEvent(root.event_name) as BuscoreTelemetryCategory,
  };
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcMinute(date: Date): string {
  return date.toISOString().slice(0, 16);
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function hmacRateLimitKey(secret: string, minute: string, clientIp: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${minute}:${clientIp}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function incrementRateLimit(db: D1Database, minute: string, ipHash: string): Promise<number> {
  await db.prepare("INSERT INTO buscore_telemetry_rate_limit(minute_bucket, ip_hash, count) VALUES (?, ?, 1) ON CONFLICT(minute_bucket, ip_hash) DO UPDATE SET count = count + 1").bind(minute, ipHash).run();
  const row = await db.prepare("SELECT count FROM buscore_telemetry_rate_limit WHERE minute_bucket = ? AND ip_hash = ?").bind(minute, ipHash).first<{ count: number }>();
  return row?.count ?? 1;
}

export async function consumeScopedRateLimit(
  db: D1Database,
  configuredSecret: string | undefined,
  bucket: string,
  clientIp: string,
  scope: string,
  limit: number
): Promise<boolean> {
  const hash = await hmacRateLimitKey(
    resolveRateLimitSecret(configuredSecret),
    bucket,
    `${scope}:${clientIp}`
  );
  return (await incrementRateLimit(db, bucket, hash)) <= limit;
}

async function readBodyBounded(request: Request): Promise<{ ok: true; raw: string } | { ok: false }> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > BUSCORE_TELEMETRY_LIMITS.max_body_bytes) return { ok: false };
  }
  if (!request.body) return { ok: true, raw: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > BUSCORE_TELEMETRY_LIMITS.max_body_bytes) {
      await reader.cancel();
      return { ok: false };
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, raw: new TextDecoder().decode(body) };
}

async function persistEvent(db: D1Database, event: BuscoreTelemetryEvent, category: BuscoreTelemetryCategory, receivedDay: string): Promise<"accepted" | "duplicate"> {
  const [dedupResult] = await db.batch([
    db.prepare("INSERT OR IGNORE INTO buscore_product_event_dedup(event_id, received_day) VALUES (?, ?)")
      .bind(event.event_id, receivedDay),
    db.prepare(
      "INSERT INTO buscore_product_events_daily(day, category, event_name, app_version, release_channel, os_category, event_count) " +
      "SELECT ?, ?, ?, ?, ?, ?, 1 WHERE changes() = 1 " +
      "ON CONFLICT(day, category, event_name, app_version, release_channel, os_category) " +
      "DO UPDATE SET event_count = event_count + 1"
    ).bind(
      receivedDay,
      category,
      event.event_name,
      event.context.app_version,
      event.context.release_channel,
      event.context.os_category
    ),
  ]);
  return (dedupResult.meta?.changes ?? 0) === 0 ? "duplicate" : "accepted";
}

export async function handleBuscoreTelemetryRequest(
  request: Request,
  db: D1Database,
  rateLimitSecret?: string,
  now: Date = new Date()
): Promise<Response> {
  if (request.method !== "POST") return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  const contentType = (request.headers.get("Content-Type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return Response.json({ ok: false, error: "invalid_content_type" }, { status: 415 });

  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null && Number(contentLength) > BUSCORE_TELEMETRY_LIMITS.max_body_bytes) {
    return Response.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }

  try {
    const minute = utcMinute(now);
    const clientIp = request.headers.get("CF-Connecting-IP") ?? "missing";
    const allowed = await consumeScopedRateLimit(
      db,
      rateLimitSecret,
      minute,
      clientIp,
      "product-telemetry",
      BUSCORE_TELEMETRY_LIMITS.rate_limit_per_minute
    );
    if (!allowed) {
      return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const captured = await readBodyBounded(request);
    if (!captured.ok) return Response.json({ ok: false, error: "payload_too_large" }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(captured.raw); } catch { return Response.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
    const parsed = parseBuscoreTelemetryEvent(body);
    if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });

    const outcome = await persistEvent(db, parsed.event, parsed.category, utcDay(now));
    return Response.json(
      { ok: true, outcome, acknowledged_event_ids: [parsed.event.event_id] },
      { status: outcome === "accepted" ? 202 : 200 }
    );
  } catch (error) {
    console.warn("BUS Core product telemetry ingest unavailable.", error);
    return Response.json({ ok: false, error: "ingest_unavailable" }, { status: 503 });
  }
}

type CountRow = { key: string; events: number };

async function queryBreakdown(
  db: D1Database,
  column: "category" | "event_name" | "app_version" | "release_channel" | "os_category",
  startDay: string,
  endDay: string,
  limit: number
): Promise<BuscoreProductTelemetryBreakdown[]> {
  const rows = await db.prepare(
    `SELECT ${column} AS key, COALESCE(SUM(event_count), 0) AS events FROM buscore_product_events_daily WHERE day >= ? AND day <= ? GROUP BY ${column} ORDER BY events DESC, key ASC LIMIT ${limit}`
  ).bind(startDay, endDay).all<CountRow>();
  return (rows.results ?? []).map((row) => ({ key: row.key, events: row.events ?? 0 }));
}

export async function buildBuscoreProductTelemetryWindow(
  db: D1Database,
  startDay: string,
  endDay: string
): Promise<BuscoreProductTelemetryWindow> {
  const [total, categoryRows, byEventName, byVersion, byChannel, byOs] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(event_count), 0) AS events FROM buscore_product_events_daily WHERE day >= ? AND day <= ?").bind(startDay, endDay).first<{ events: number }>(),
    queryBreakdown(db, "category", startDay, endDay, 4),
    queryBreakdown(db, "event_name", startDay, endDay, BUSCORE_TELEMETRY_EVENT_NAMES.length),
    queryBreakdown(db, "app_version", startDay, endDay, 20),
    queryBreakdown(db, "release_channel", startDay, endDay, BUSCORE_TELEMETRY_RELEASE_CHANNELS.length),
    queryBreakdown(db, "os_category", startDay, endDay, BUSCORE_TELEMETRY_OS_CATEGORIES.length),
  ]);
  const categories: Record<BuscoreTelemetryCategory, number> = {
    installation_release: 0,
    workflow_milestone: 0,
    reliability: 0,
  };
  for (const row of categoryRows) {
    if (row.key in categories) categories[row.key as BuscoreTelemetryCategory] = row.events;
  }
  const countEvent = (name: string) => byEventName.find((row) => row.key === name)?.events ?? 0;
  return {
    total_events: total?.events ?? 0,
    categories,
    by_event_name: byEventName,
    by_app_version: byVersion,
    by_release_channel: byChannel,
    by_os_category: byOs,
    first_launches: countEvent("installation_first_launch"),
    version_first_seen: countEvent("version_first_seen"),
    update_check_delivery_observations:
      countEvent("update_check") + countEvent("update_check_startup") + countEvent("update_check_manual"),
    update_check_startup: countEvent("update_check_startup"),
    update_check_manual: countEvent("update_check_manual"),
    update_staged: countEvent("update_staged"),
  };
}

export async function buildBuscoreProductTelemetryReport(
  db: D1Database,
  now: Date = new Date()
): Promise<BuscoreProductTelemetryReport> {
  const today = utcDay(now);
  try {
    const [todayWindow, last7Days, last30Days] = await Promise.all([
      buildBuscoreProductTelemetryWindow(db, today, today),
      buildBuscoreProductTelemetryWindow(db, utcDay(addUtcDays(now, -6)), today),
      buildBuscoreProductTelemetryWindow(db, utcDay(addUtcDays(now, -29)), today),
    ]);
    return {
      available: true,
      semantics: {
        first_launches: "accepted installation_first_launch events acknowledged by this receiver; opted-in installations only",
        version_first_seen: "accepted locally deduplicated version_first_seen events; not downloads or successful update staging",
        update_check_delivery_observations: "accepted startup, manual, and legacy-unspecified update-check events; not the authoritative /update/check release-route total",
        update_check_startup: "accepted update_check_startup events",
        update_check_manual: "accepted update_check_manual events",
      },
      today: todayWindow,
      last_7_days: last7Days,
      last_30_days: last30Days,
    };
  } catch (error) {
    console.warn("BUS Core product telemetry report unavailable.", error);
    return { available: false, reason: "storage_unavailable" };
  }
}

export async function pruneBuscoreTelemetry(db: D1Database, now: Date = new Date()): Promise<void> {
  const dedupCutoff = utcDay(addUtcDays(now, -BUSCORE_TELEMETRY_RETENTION.dedup));
  const rateCutoff = utcMinute(addUtcDays(now, -BUSCORE_TELEMETRY_RETENTION.rate_limit));
  const aggregateCutoff = utcDay(addUtcDays(now, -BUSCORE_TELEMETRY_RETENTION.aggregate));
  await Promise.all([
    db.prepare("DELETE FROM buscore_product_event_dedup WHERE received_day <= ?").bind(dedupCutoff).run(),
    db.prepare("DELETE FROM buscore_telemetry_rate_limit WHERE minute_bucket <= ?").bind(rateCutoff).run(),
    db.prepare("DELETE FROM buscore_product_events_daily WHERE day <= ?").bind(aggregateCutoff).run(),
  ]);
}
