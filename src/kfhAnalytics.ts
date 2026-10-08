import { KFH_SITE_KEY, KFH_ORIGINS, KFH_SOURCES, KFH_CAMPAIGNS, KFH_CONTENTS, KFH_COUNT_KEYS, KFH_WINDOW_KEYS, KFH_OUTREACH_LIMITATIONS, type CountKey, type Counts, type WindowKey, type KfhReport, isKfhReport } from "./kfhContract.js";
import { KFH_SIGNAL_KEYS, KFH_SIGNAL_WINDOW_KEYS, type SignalKey, type ProductSignals } from "./kfhSignalsContract.js";
import { KFH_OUTREACH_SOURCES, KFH_OUTREACH_CAMPAIGNS, KFH_OUTREACH_CONTENTS, KFH_ATTRIBUTABLE_KEYS, type AttributableKey, type Outreach, type OutreachCounts, type OutreachRow } from "./kfhOutreachContract.js";

// Collector routing is local to Lighthouse; the pinned Smith report contract stays unchanged.
export const KFH_INGEST_ORIGINS: readonly string[] = [...KFH_ORIGINS, "https://kingston.food-help.ca"];
type Row = { day: string; metric: string; value: string; count: number };
type StoredOutreach = OutreachRow & { day: string; dimension: string };
type Dimension = { value: string; count: number };

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function member(value: unknown, allowed: readonly string[]): value is string {
  return typeof value === "string" && allowed.includes(value);
}

export function parseKfhEvent(value: unknown): { counter: CountKey; outreach?: true; source?: string; campaign?: string; content?: string } | null {
  if (!object(value)) return null;
  if (value.site_key !== KFH_SITE_KEY || value.page !== "directory") return null;
  const legacy = value.contract_version === 1 && value.consent === true;
  const outreach = value.contract_version === 3 && value.collection_mode === "opt_out";
  const optOut = (value.contract_version === 2 || outreach) && value.collection_mode === "opt_out";
  if (!legacy && !optOut) return null;
  const keys = ["site_key", "contract_version", legacy ? "consent" : "collection_mode", "page", "event_name"];
  if (value.event_name === "page_view" || (outreach && (value.event_name === "contact_click" || value.event_name === "outbound_click"))) {
    keys.push("source", "campaign", "content");
    if (value.event_name !== "page_view") keys.push("event_value");
    if (Object.keys(value).some(key => !keys.includes(key))) return null;
    const source = value.source === undefined ? "direct_unknown" : value.source;
    const campaign = value.campaign === undefined ? "none" : value.campaign;
    const content = value.content === undefined ? "none" : value.content;
    if (!member(source, outreach ? KFH_OUTREACH_SOURCES : KFH_SOURCES)
      || !member(campaign, outreach ? KFH_OUTREACH_CAMPAIGNS : KFH_CAMPAIGNS)
      || !member(content, outreach ? KFH_OUTREACH_CONTENTS : KFH_CONTENTS)) return null;
    // v3 must carry all labels: missing attribution is not silently classified.
    if (outreach && [value.source, value.campaign, value.content].some(label => label === undefined)) return null;
    const counter = value.event_name === "page_view" ? "page_views" : actionCounter(value.event_name, value.event_value);
    return counter ? { counter, ...(outreach ? { outreach: true as const } : {}), source, campaign, content } : null;
  }
  if (value.event_name !== "pwa_install") keys.push("event_value");
  if (Object.keys(value).some(key => !keys.includes(key))) return null;
  if (value.event_name === "pwa_install") return { counter: "pwa_installs" };
  const counter = actionCounter(value.event_name, value.event_value);
  return counter ? { counter } : null;
}

// v3 product signals carry no labels or values beyond the fixed prompt outcome.
export function parseKfhSignal(value: unknown): SignalKey | null {
  if (!object(value) || value.site_key !== KFH_SITE_KEY || value.page !== "directory") return null;
  if (value.contract_version !== 3 || value.collection_mode !== "opt_out") return null;
  const keys = ["site_key", "contract_version", "collection_mode", "page", "event_name"];
  if (value.event_name === "resource_open") {
    return Object.keys(value).some(key => !keys.includes(key)) ? null : "resource_opens";
  }
  if (value.event_name !== "install_prompt") return null;
  if (Object.keys(value).some(key => ![...keys, "event_value"].includes(key))) return null;
  return value.event_value === "show" ? "install_prompt_shows" : value.event_value === "dismiss" ? "install_prompt_dismissals" : null;
}

function actionCounter(name: unknown, value: unknown): AttributableKey | null {
  if (name === "contact_click" && value === "resource_call") return "resource_calls";
  if (name === "contact_click" && value === "help_211") return "help_211";
  if (name === "outbound_click" && value === "directions") return "directions";
  if (name === "outbound_click" && value === "official_source") return "official_sources";
  return null;
}

// Keep the old table valid for a rolled-back Worker, including its page margins.
const legacyLabel = (dimension: string, value: string) => dimension === "source"
  ? member(value, KFH_SOURCES) ? value : "other"
  : dimension === "campaign" ? member(value, KFH_CAMPAIGNS) ? value : "none"
  : member(value, KFH_CONTENTS) ? value : "none";

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
  if (!origin || !KFH_INGEST_ORIGINS.includes(origin)) return;
  const event = parseKfhEvent(payload);
  if (!event) {
    // Signals use only their own table, so a missing 0018 cannot affect core counters.
    const signal = parseKfhSignal(payload);
    if (!signal || !(await allowRate())) return;
    await db.prepare("INSERT INTO kfh_signal_daily(day, signal, count) VALUES (?, ?, 1) ON CONFLICT(day, signal) DO UPDATE SET count = count + 1")
      .bind(day(now), signal).run();
    return;
  }
  if (!(await allowRate())) return;
  const dimensions = [["event", event.counter]];
  if (event.counter === "page_views") {
    dimensions.push(["source", legacyLabel("source", event.source!)], ["campaign", legacyLabel("campaign", event.campaign!)], ["content", legacyLabel("content", event.content!)]);
  }
  const statements = dimensions.map(([metric, value]) => db.prepare(
    "INSERT INTO kfh_daily(day, metric, value, count) VALUES (?, ?, ?, 1) ON CONFLICT(day, metric, value) DO UPDATE SET count = count + 1",
  ).bind(day(now), metric, value));
  if (event.outreach) for (const [dimension, value] of [["source", event.source], ["campaign", event.campaign], ["content", event.content]]) {
    statements.push(db.prepare("INSERT INTO kfh_outreach_daily(day, event, dimension, value, count) VALUES (?, ?, ?, ?, 1) ON CONFLICT(day, event, dimension, value) DO UPDATE SET count = count + 1")
      .bind(day(now), event.counter, dimension, value));
  }
  // All totals and independent margins succeed together; never store a raw event.
  await db.batch(statements);
}

export async function pruneKfhData(db: D1Database, now: Date = new Date()): Promise<void> {
  await db.batch(["kfh_daily", "kfh_outreach_daily"].map(table => db.prepare(`DELETE FROM ${table} WHERE day < ?`).bind(shiftDay(now, -399))));
  // Separate so a missing additive 0018 table never blocks core retention.
  try { await db.prepare("DELETE FROM kfh_signal_daily WHERE day < ?").bind(shiftDay(now, -399)).run(); } catch {}
}

async function readProductSignals(db: D1Database, now: Date): Promise<ProductSignals> {
  try {
    const result = await db.prepare("SELECT day, signal, count FROM kfh_signal_daily WHERE day >= ? AND day <= ? ORDER BY day, signal")
      .bind(shiftDay(now, -399), day(now)).all<{ day: string; signal: string; count: number }>();
    if (!result.success || !Array.isArray(result.results)) throw new Error("unavailable");
    const ranges: Record<typeof KFH_SIGNAL_WINDOW_KEYS[number], [number, number]> = {
      today: [0, 0], latest_complete_day: [-1, -1], last_7_complete_days: [-7, -1],
      previous_7_complete_days: [-14, -8], last_30_complete_days: [-30, -1],
    };
    const windows = {} as NonNullable<ProductSignals["windows"]>;
    for (const key of KFH_SIGNAL_WINDOW_KEYS) {
      const [start, end] = ranges[key].map(offset => shiftDay(now, offset));
      const counts = Object.fromEntries(KFH_SIGNAL_KEYS.map(signal => [signal, 0])) as Record<SignalKey, number>;
      for (const row of result.results) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(row.day) || !member(row.signal, KFH_SIGNAL_KEYS)
          || !Number.isSafeInteger(row.count) || row.count < 1) throw new Error("unavailable");
        if (row.day >= start && row.day <= end) counts[row.signal as SignalKey] += row.count;
      }
      if (Object.values(counts).some(value => !Number.isSafeInteger(value))) throw new Error("unavailable");
      windows[key] = counts;
    }
    return { availability: "available", windows };
  } catch { return { availability: "unavailable", windows: null }; }
}

export async function buildKfhReport(db: D1Database, now: Date = new Date()): Promise<KfhReport> {
  let rows: Row[] = [];
  let outreachRows: StoredOutreach[] = [];
  let available = true;
  try {
    const result = await db.prepare("SELECT day, metric, value, count FROM kfh_daily WHERE day >= ? AND day <= ? ORDER BY day, metric, value")
      .bind(shiftDay(now, -399), day(now)).all<Row>();
    if (!result.success || !Array.isArray(result.results)) throw new Error("unavailable");
    rows = result.results;
    const outreach = await db.prepare("SELECT day, event, dimension, value, count FROM kfh_outreach_daily WHERE day >= ? AND day <= ? ORDER BY day, event, dimension, value")
      .bind(shiftDay(now, -399), day(now)).all<StoredOutreach>();
    if (!outreach.success || !Array.isArray(outreach.results)) throw new Error("unavailable");
    outreachRows = outreach.results;
    // Fail closed on corrupt/incompatible aggregate rows; no raw values leave here.
    for (const row of rows) {
      const allowed = row.metric === "event" ? KFH_COUNT_KEYS : row.metric === "source" ? KFH_SOURCES
        : row.metric === "campaign" ? KFH_CAMPAIGNS : row.metric === "content" ? KFH_CONTENTS : [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.day) || !member(row.value, allowed)
        || !Number.isSafeInteger(row.count) || row.count < 1) throw new Error("unavailable");
    }
    for (const row of outreachRows) {
      const allowed = row.dimension === "source" ? KFH_OUTREACH_SOURCES : row.dimension === "campaign" ? KFH_OUTREACH_CAMPAIGNS : row.dimension === "content" ? KFH_OUTREACH_CONTENTS : [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.day) || !member(row.event, KFH_ATTRIBUTABLE_KEYS)
        || !member(row.value, allowed) || !Number.isSafeInteger(row.count) || row.count < 1) throw new Error("unavailable");
    }
  } catch { available = false; rows = []; }
  const signals: ProductSignals = available ? await readProductSignals(db, now) : { availability: "unavailable", windows: null };
  return kfhReportFromRows(available ? rows : null, now, available ? outreachRows : [], signals);
}

function kfhReportFromRows(input: Row[] | null, now: Date, outreachRows: StoredOutreach[] = [],
  signals: ProductSignals = { availability: "unavailable", windows: null }): KfhReport {
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
    for (const row of outreachRows) if (row.event === "page_views" && row.dimension === metric && inWeek(row.day)) {
      const fallback = legacyLabel(metric, row.value);
      totals.set(fallback, (totals.get(fallback) ?? 0) - row.count);
      totals.set(row.value, (totals.get(row.value) ?? 0) + row.count);
    }
    return [...totals].filter(([, count]) => count !== 0).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  };
  const inWeek = (date: string) => date >= shiftDay(now, -7) && date <= shiftDay(now, -1);
  const outreach: Outreach = {
    classified: Object.fromEntries(KFH_ATTRIBUTABLE_KEYS.map(key => [key, 0])) as OutreachCounts,
    unclassified: Object.fromEntries(KFH_ATTRIBUTABLE_KEYS.map(key => [key, 0])) as OutreachCounts,
    sources: [], campaigns: [], contents: [],
  };
  for (const [dimension, key] of [["source", "sources"], ["campaign", "campaigns"], ["content", "contents"]] as const) {
    const totals = new Map<string, OutreachRow>();
    for (const row of outreachRows) if (row.dimension === dimension && inWeek(row.day)) {
      const id = `${row.event}:${row.value}`;
      const total = totals.get(id) ?? { event: row.event, value: row.value, count: 0 };
      total.count += row.count; totals.set(id, total);
      if (dimension === "source") outreach.classified[row.event] += row.count;
    }
    outreach[key] = [...totals.values()].sort((a, b) => a.event.localeCompare(b.event) || b.count - a.count || a.value.localeCompare(b.value));
  }
  if (available) for (const key of KFH_ATTRIBUTABLE_KEYS) outreach.unclassified[key] = windows.last_7_complete_days.counts![key] - outreach.classified[key];
  const report: KfhReport = {
    view: "kfh", report_contract_version: "1.3", site_key: KFH_SITE_KEY, generated_at: now.toISOString(),
    source: {
      availability: available ? "available" : "unavailable",
      reason: !available ? "query_failed" : eventDays.length ? "observed_activity" : "no_observed_history",
      first_observed_day: eventDays[0] ?? null, last_observed_day: eventDays[eventDays.length - 1] ?? null,
    },
    windows,
    discovery_last_7_complete_days: available ? { sources: rank("source"), campaigns: rank("campaign"), contents: rank("content") } : null,
    outreach_last_7_complete_days: available ? outreach : null,
    product_signals: available ? signals : { availability: "unavailable", windows: null },
    limitations: KFH_OUTREACH_LIMITATIONS,
  };
  if (isKfhReport(report)) return report;
  // Bad signal rows must not take down the core report.
  if (signals.availability === "available") return kfhReportFromRows(input, now, outreachRows, { availability: "unavailable", windows: null });
  return kfhReportFromRows(null, now);
}

