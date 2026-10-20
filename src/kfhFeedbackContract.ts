// "Did this help you find food?" answers (report 1.4). UTC calendar-month totals
// built from plain daily buckets: no listing, visit token, outreach label or
// per-event time. Answers come from visitors who chose to respond; they are not
// people served. Listing opens ride along so the response rate is visible.
export const KFH_FEEDBACK_ANSWERS = ["yes", "not_this_time"] as const;
export const KFH_FEEDBACK_COUNT_KEYS = ["yes", "not_this_time", "resource_opens"] as const;
export const KFH_FEEDBACK_MONTH_KEYS = ["previous_month", "current_month"] as const;
export type FeedbackAnswer = typeof KFH_FEEDBACK_ANSWERS[number];
export type FeedbackMonthKey = typeof KFH_FEEDBACK_MONTH_KEYS[number];
export type FeedbackCounts = Record<typeof KFH_FEEDBACK_COUNT_KEYS[number], number>;
export type FeedbackMonth = { month: string; start_day: string; end_day: string; partial: boolean; counts: FeedbackCounts };
export type HelpFeedback = {
  availability: "available" | "unavailable";
  months: Record<FeedbackMonthKey, FeedbackMonth> | null;
};

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: unknown, keys: readonly string[]): v is Record<string, unknown> => object(v)
  && Object.keys(v).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(v, key));
const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

// The previous complete UTC month and the current month to date.
export function kfhFeedbackMonths(now: Date): Record<FeedbackMonthKey, Omit<FeedbackMonth, "counts">> {
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const year = now.getUTCFullYear(), month = now.getUTCMonth();
  const previousStart = new Date(Date.UTC(year, month - 1, 1));
  return {
    previous_month: { month: iso(previousStart).slice(0, 7), start_day: iso(previousStart), end_day: iso(new Date(Date.UTC(year, month, 0))), partial: false },
    current_month: { month: iso(now).slice(0, 7), start_day: iso(new Date(Date.UTC(year, month, 1))), end_day: iso(now), partial: true },
  };
}

// A missing feedback table or failed query is unavailable without affecting the rest of the report.
export function isKfhHelpFeedback(value: unknown, sourceAvailable: boolean, generatedAt: string): value is HelpFeedback {
  if (!exact(value, ["availability", "months"])) return false;
  if (value.availability === "unavailable") return value.months === null;
  if (value.availability !== "available" || !sourceAvailable || !exact(value.months, KFH_FEEDBACK_MONTH_KEYS)) return false;
  const expected = kfhFeedbackMonths(new Date(generatedAt));
  for (const key of KFH_FEEDBACK_MONTH_KEYS) {
    const month = (value.months as Record<string, unknown>)[key];
    if (!exact(month, ["month", "start_day", "end_day", "partial", "counts"])) return false;
    const want = expected[key];
    if (month.month !== want.month || month.start_day !== want.start_day || month.end_day !== want.end_day || month.partial !== want.partial) return false;
    if (!exact(month.counts, KFH_FEEDBACK_COUNT_KEYS) || !Object.values(month.counts).every(count)
      || !Number.isSafeInteger((month.counts.yes as number) + (month.counts.not_this_time as number))) return false;
  }
  return true;
}
