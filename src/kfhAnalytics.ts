import { KFH_SITE_KEY, KFH_ORIGINS, KFH_SOURCES, KFH_CAMPAIGNS, KFH_CONTENTS, KFH_COUNT_KEYS, KFH_WINDOW_KEYS, KFH_LIMITATIONS, type CountKey, type Counts, type WindowKey, type KfhReport, isKfhReport } from "./kfhContract.js";
type Row = { day: string; metric: string; value: string; count: number };
type Dimension = { value: string; count: number };

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function member(value: unknown, allowed: readonly string[]): value is string {
  return typeof value === "string" && allowed.includes(value);
}

export function parseKfhEvent(value: unknown): { counter: CountKey; source?: string; campaign?: string; content?: string } | null {
  if (!object(value)) return null;
  if (value.site_key !== KFH_SITE_KEY || value.page !== "directory") return null;
  const legacy = value.contract_version === 1 && value.consent === true;
  const optOut = value.contract_version === 2 && value.collection_mode === "opt_out";
  if (!legacy && !optOut) return null;
  const keys = ["site_key", "contract_version", legacy ? "consent" : "collection_mode", "page", "event_name"];
  if (value.event_name === "page_view") {
    keys.push("source", "campaign", "content");
    if (Object.keys(value).some(key => !keys.includes(key))) return null;
    const source = value.source === undefined ? "direct_unknown" : value.source;
    const campaign = value.campaign === undefined ? "none" : value.campaign;
    const content = value.content === undefined ? "none" : value.content;
    if (!member(source, KFH_SOURCES) || !member(campaign, KFH_CAMPAIGNS) || !member(content, KFH_CONTENTS)) return null;
    return { counter: "page_views", source, campaign, content };
  }
  if (value.event_name !== "pwa_install") keys.push("event_value");
  if (Object.keys(value).some(key => !keys.includes(key))) return null;
  if (value.event_name === "pwa_install") return { counter: "pwa_installs" };
  if (value.event_name === "contact_click" && value.event_value === "resource_call") return { counter: "resource_calls" };
  if (value.event_name === "contact_click" && value.event_value === "help_211") return { counter: "help_211" };
  if (value.event_name === "outbound_click" && value.event_value === "directions") return { counter: "directions" };
  if (value.event_name === "outbound_click" && value.event_value === "official_source") return { counter: "official_sources" };
  return null;
}

export async function readKfhBody(request: Request): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) { void reader.cancel().catch(() => {}); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch { return null; }
  finally { reader.releaseLock(); }
}

const day = (date: Date) => date.toISOString().slice(0, 10);
const shiftDay = (now: Date, offset: number) => day(new Date(now.getTime() + offset * 86400000));

export async function ingestKfhEvent(
  payload: unknown, db: D1Database, origin: string | null,
  allowRate: () => Promise<boolean>, now: Date = new Date(),
): Promise<void> {
  if (!origin || !(KFH_ORIGINS as readonly string[]).includes(origin)) return;
  const event = parseKfhEvent(payload);
  if (!event || !(await allowRate())) return;
  const dimensions = [["event", event.counter]];
  if (event.counter === "page_views") {
    dimensions.push(["source", event.source!], ["campaign", event.campaign!], ["content", event.content!]);
  }
  // D1 batch is atomic: a view cannot have a partially written attribution set.
  await db.batch(dimensions.map(([metric, value]) => db.prepare(
    "INSERT INTO kfh_daily(day, metric, value, count) VALUES (?, ?, ?, 1) ON CONFLICT(day, metric, value) DO UPDATE SET count = count + 1",
  ).bind(day(now), metric, value)));
}

export async function pruneKfhData(db: D1Database, now: Date = new Date()): Promise<void> {
  await db.prepare("DELETE FROM kfh_daily WHERE day < ?").bind(shiftDay(now, -399)).run();
}

export async function buildKfhReport(db: D1Database, now: Date = new Date()): Promise<KfhReport> {
  let rows: Row[] = [];
  let available = true;
  try {
    const result = await db.prepare("SELECT day, metric, value, count FROM kfh_daily WHERE day >= ? AND day <= ? ORDER BY day, metric, value")
      .bind(shiftDay(now, -399), day(now)).all<Row>();
    if (!result.success || !Array.isArray(result.results)) throw new Error("unavailable");
    rows = result.results;
    // Fail closed on corrupt/incompatible aggregate rows; no raw values leave here.
    for (const row of rows) {
      const allowed = row.metric === "event" ? KFH_COUNT_KEYS : row.metric === "source" ? KFH_SOURCES
        : row.metric === "campaign" ? KFH_CAMPAIGNS : row.metric === "content" ? KFH_CONTENTS : [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.day) || !member(row.value, allowed)
        || !Number.isSafeInteger(row.count) || row.count < 1) throw new Error("unavailable");
    }
  } catch { available = false; rows = []; }
  return kfhReportFromRows(available ? rows : null, now);
}

function kfhReportFromRows(input: Row[] | null, now: Date): KfhReport {
  const available = input !== null;
  const rows = input ?? [];
  const eventDays = rows.filter(row => row.metric === "event").map(row => row.day).sort();
  const ranges: Record<WindowKey, [number, number]> = {
    today: [0, 0], latest_complete_day: [-1, -1], last_7_complete_days: [-7, -1],
    previous_7_complete_days: [-14, -8], last_30_complete_days: [-30, -1],
  };
  const windows = {} as KfhReport["windows"];
  for (const key of KFH_WINDOW_KEYS) {
    const [start, end] = ranges[key].map(offset => shiftDay(now, offset));
    const counts = Object.fromEntries(KFH_COUNT_KEYS.map(key => [key, 0])) as Counts;
    for (const row of rows) if (row.metric === "event" && row.day >= start && row.day <= end) counts[row.value as CountKey] += row.count;
    if (Object.values(counts).some(count => !Number.isSafeInteger(count))) return kfhReportFromRows(null, now);
    windows[key] = { start_day: start, end_day: end, partial: key === "today", counts: available ? counts : null };
  }
  const rank = (metric: string): Dimension[] => {
    const totals = new Map<string, number>();
    for (const row of rows) if (row.metric === metric && row.day >= shiftDay(now, -7) && row.day <= shiftDay(now, -1)) {
      totals.set(row.value, (totals.get(row.value) ?? 0) + row.count);
    }
    return [...totals].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  };
  const report: KfhReport = {
    view: "kfh", report_contract_version: "1.1", site_key: KFH_SITE_KEY, generated_at: now.toISOString(),
    source: {
      availability: available ? "available" : "unavailable",
      reason: !available ? "query_failed" : eventDays.length ? "observed_activity" : "no_observed_history",
      first_observed_day: eventDays[0] ?? null, last_observed_day: eventDays[eventDays.length - 1] ?? null,
    },
    windows,
    discovery_last_7_complete_days: available ? { sources: rank("source"), campaigns: rank("campaign"), contents: rank("content") } : null,
    limitations: KFH_LIMITATIONS,
  };
  return isKfhReport(report) ? report : kfhReportFromRows(null, now);
}

