// Kingston's sensitive-use directory keeps only separate daily totals.
// No raw event, provider context, identity or cross-dimension journey is stored.
export const KFH_SITE_KEY = "kingston_food_help";
export const KFH_ORIGINS = ["https://kingstonfoodhelp.ca", "https://www.kingstonfoodhelp.ca"] as const;
export const KFH_SOURCES = ["direct_unknown", "facebook", "community", "search", "other"] as const;
export const KFH_CAMPAIGNS = ["none", "launch_2026_09"] as const;
export const KFH_CONTENTS = ["none", "post_01", "poster_01"] as const;
export const KFH_COUNT_KEYS = ["page_views", "resource_calls", "help_211", "directions", "official_sources", "pwa_installs"] as const;
export const KFH_WINDOW_KEYS = ["today", "latest_complete_day", "last_7_complete_days", "previous_7_complete_days", "last_30_complete_days"] as const;
export const KFH_LIMITATIONS = {
  coverage: "observed_only",
  counts_are: "consented_activity_not_people_or_service_outcomes",
  attribution: "page_views_only_no_action_join",
  activity_is_health: false,
  raw_events_stored: false,
  identifiers_reported: false,
  aggregate_retention_days: 400,
} as const;

export type CountKey = typeof KFH_COUNT_KEYS[number];
export type WindowKey = typeof KFH_WINDOW_KEYS[number];
export type Counts = Record<CountKey, number>;
type Dimension = { value: string; count: number };
export type KfhReport = {
  view: "kfh";
  report_contract_version: "1.0";
  site_key: typeof KFH_SITE_KEY;
  generated_at: string;
  source: {
    availability: "available" | "unavailable";
    reason: "observed_activity" | "no_observed_history" | "query_failed";
    first_observed_day: string | null;
    last_observed_day: string | null;
  };
  windows: Record<WindowKey, { start_day: string; end_day: string; partial: boolean; counts: Counts | null }>;
  discovery_last_7_complete_days: { sources: Dimension[]; campaigns: Dimension[]; contents: Dimension[] } | null;
  limitations: typeof KFH_LIMITATIONS;
};

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
}
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function validDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}
export function kfhWindowDays(now: Date): Record<WindowKey, [string, string]> {
  const at = (offset: number) => new Date(now.getTime() + offset * 86400000).toISOString().slice(0, 10);
  return {
    today: [at(0), at(0)], latest_complete_day: [at(-1), at(-1)], last_7_complete_days: [at(-7), at(-1)],
    previous_7_complete_days: [at(-14), at(-8)], last_30_complete_days: [at(-30), at(-1)],
  };
}

// Strict shared producer/consumer contract. No runtime schema compiler is needed.
export function isKfhReport(value: unknown): value is KfhReport {
  if (!exact(value, ["view", "report_contract_version", "site_key", "generated_at", "source", "windows", "discovery_last_7_complete_days", "limitations"])) return false;
  if (value.view !== "kfh" || value.report_contract_version !== "1.0" || value.site_key !== KFH_SITE_KEY) return false;
  if (typeof value.generated_at !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.generated_at)
    || !Number.isFinite(Date.parse(value.generated_at)) || new Date(value.generated_at).toISOString() !== value.generated_at) return false;
  if (!exact(value.limitations, Object.keys(KFH_LIMITATIONS))) return false;
  for (const [key, expected] of Object.entries(KFH_LIMITATIONS)) if (value.limitations[key] !== expected) return false;
  const source = value.source;
  if (!exact(source, ["availability", "reason", "first_observed_day", "last_observed_day"])) return false;
  const unavailable = source.availability === "unavailable";
  if (!unavailable && source.availability !== "available") return false;
  if (unavailable) {
    if (source.reason !== "query_failed" || source.first_observed_day !== null || source.last_observed_day !== null) return false;
  } else if (source.reason === "no_observed_history") {
    if (source.first_observed_day !== null || source.last_observed_day !== null) return false;
  } else {
    if (source.reason !== "observed_activity" || !validDay(source.first_observed_day) || !validDay(source.last_observed_day)
      || source.first_observed_day > source.last_observed_day || source.last_observed_day > value.generated_at.slice(0, 10)) return false;
  }
  if (!exact(value.windows, KFH_WINDOW_KEYS)) return false;
  const ranges = kfhWindowDays(new Date(value.generated_at));
  for (const key of KFH_WINDOW_KEYS) {
    const window = value.windows[key];
    if (!exact(window, ["start_day", "end_day", "partial", "counts"]) || window.start_day !== ranges[key][0]
      || window.end_day !== ranges[key][1] || window.partial !== (key === "today")) return false;
    if (unavailable) { if (window.counts !== null) return false; }
    else {
      if (!exact(window.counts, KFH_COUNT_KEYS) || !Object.values(window.counts).every(isCount)) return false;
      if (source.reason === "no_observed_history" && Object.values(window.counts).some(count => count !== 0)) return false;
    }
  }
  const discovery = value.discovery_last_7_complete_days;
  if (unavailable) return discovery === null;
  if (!exact(discovery, ["sources", "campaigns", "contents"])) return false;
  const windows = value.windows as KfhReport["windows"];
  const views = windows.last_7_complete_days.counts!.page_views;
  for (const [key, allowed] of [["sources", KFH_SOURCES], ["campaigns", KFH_CAMPAIGNS], ["contents", KFH_CONTENTS]] as const) {
    const rows = discovery[key];
    if (!Array.isArray(rows) || rows.length > allowed.length) return false;
    const seen = new Set<string>();
    let total = 0;
    for (const row of rows) {
      if (!exact(row, ["value", "count"]) || typeof row.value !== "string" || !(allowed as readonly string[]).includes(row.value)
        || seen.has(row.value) || !isCount(row.count) || row.count === 0) return false;
      seen.add(row.value); total += row.count;
    }
    if (!Number.isSafeInteger(total) || total !== views) return false;
  }
  // These windows overlap by definition. A contradictory report is unavailable.
  for (const key of KFH_COUNT_KEYS) {
    if (windows.latest_complete_day.counts![key] > windows.last_7_complete_days.counts![key]
      || windows.last_7_complete_days.counts![key] + windows.previous_7_complete_days.counts![key] > windows.last_30_complete_days.counts![key]) return false;
  }
  return true;
}
