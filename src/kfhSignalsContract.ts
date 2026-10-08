// Unattributed product signals (report 1.3). Plain daily totals only:
// no outreach labels, visit token, listing identity or cross-event join.
export const KFH_SIGNAL_KEYS = ["resource_opens", "install_prompt_shows", "install_prompt_dismissals"] as const;
export const KFH_SIGNAL_WINDOW_KEYS = ["today", "latest_complete_day", "last_7_complete_days", "previous_7_complete_days", "last_30_complete_days"] as const;
export type SignalKey = typeof KFH_SIGNAL_KEYS[number];
export type SignalCounts = Record<SignalKey, number>;
export type ProductSignals = {
  availability: "available" | "unavailable";
  windows: Record<typeof KFH_SIGNAL_WINDOW_KEYS[number], SignalCounts> | null;
};

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: unknown, keys: readonly string[]): v is Record<string, unknown> => object(v)
  && Object.keys(v).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(v, key));
const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

// A missing signal table or failed query is unavailable without affecting the core report.
export function isKfhProductSignals(value: unknown, sourceAvailable: boolean): value is ProductSignals {
  if (!exact(value, ["availability", "windows"])) return false;
  if (value.availability === "unavailable") return value.windows === null;
  if (value.availability !== "available" || !sourceAvailable || !exact(value.windows, KFH_SIGNAL_WINDOW_KEYS)) return false;
  const windows = value.windows as Record<string, unknown>;
  for (const key of KFH_SIGNAL_WINDOW_KEYS) {
    const counts = windows[key];
    if (!exact(counts, KFH_SIGNAL_KEYS) || !Object.values(counts).every(count)) return false;
  }
  const w = windows as Record<typeof KFH_SIGNAL_WINDOW_KEYS[number], SignalCounts>;
  // These windows overlap by definition. A contradictory report is invalid.
  for (const key of KFH_SIGNAL_KEYS) {
    if (w.latest_complete_day[key] > w.last_7_complete_days[key]
      || !Number.isSafeInteger(w.last_7_complete_days[key] + w.previous_7_complete_days[key])
      || w.last_7_complete_days[key] + w.previous_7_complete_days[key] > w.last_30_complete_days[key]) return false;
  }
  return true;
}
