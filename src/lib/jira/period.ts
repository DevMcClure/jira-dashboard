import { differenceInCalendarDays, endOfDay, format, startOfDay, subDays } from "date-fns"
import type { DateRange, Issue, ProgramIncrement, Sprint } from "./types"

/** The header's time-period choices. "now" is always the export's generatedAt. */
export type Period = "today" | "yesterday" | "7d" | "14d" | "sprint" | "pi" | "all" | "custom"

/** Two days picked in a calendar (any time of day; only the dates matter). */
export type DayRange = { from: Date; to: Date }

export const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "sprint", label: "Current sprint" },
  { value: "pi", label: "This PI" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range…" },
]

/** Phrase that completes "+3 started …", e.g. "today", "in the last 7 days". */
export const PERIOD_PHRASE: Record<Period, string> = {
  today: "today",
  yesterday: "yesterday",
  "7d": "in the last 7 days",
  "14d": "in the last 14 days",
  sprint: "this sprint",
  pi: "this PI",
  all: "in total",
  custom: "in the selected dates",
}

/**
 * A picked range as whole local days, inclusive: start of the earlier day to
 * the end of the later one, capped at `now` (decision 0021).
 */
export function customRange({ from, to }: DayRange, now: Date): DateRange {
  const [a, b] = from <= to ? [from, to] : [to, from]
  const start = startOfDay(a)
  const end = endOfDay(b) < now ? endOfDay(b) : now
  return { start, end: end < start ? start : end }
}

const dates = (r: DateRange) => {
  const fmt = r.start.getFullYear() === r.end.getFullYear() ? "d MMM" : "d MMM yyyy"
  return `${format(r.start, fmt)} – ${format(r.end, fmt)}`
}

/** "Last 7 days", or the dates for a custom range ("12 Oct – 19 Oct"). */
export function periodLabel(period: Period, range: DateRange): string {
  return period === "custom" ? dates(range) : PERIODS.find((p) => p.value === period)!.label
}

/** Completes "+3 started …": "in the last 7 days", or "between 12 Oct and 19 Oct". */
export function periodPhrase(period: Period, range: DateRange): string {
  if (period !== "custom") return PERIOD_PHRASE[period]
  return `between ${format(range.start, "d MMM")} and ${format(range.end, "d MMM")}`
}

/**
 * Resolve a period to a concrete range ending at `now` (except "yesterday",
 * which is the whole previous calendar day).
 * - "sprint": from the earliest start of the active sprints in scope (falls back to 14 days)
 * - "pi": from the start of `pi` to its end or `now`, whichever is first (falls back to "all")
 * - "all": from the earliest started sprint, or the oldest ticket if there are no sprints
 */
export function periodRange(
  period: Period,
  now: Date,
  sprints: Sprint[],
  issues: Issue[],
  pi: ProgramIncrement | null = null,
  custom: DayRange | null = null,
): DateRange {
  const daysBack = (n: number) => ({ start: startOfDay(subDays(now, n - 1)), end: now })
  switch (period) {
    case "today":
      return { start: startOfDay(now), end: now }
    case "yesterday": {
      const day = subDays(now, 1)
      return { start: startOfDay(day), end: endOfDay(day) }
    }
    case "7d":
      return daysBack(7)
    case "14d":
      return daysBack(14)
    case "sprint": {
      const starts = sprints.filter((s) => s.state === "active" && s.startDate).map((s) => s.startDate!.getTime())
      return starts.length ? { start: startOfDay(new Date(Math.min(...starts))), end: now } : daysBack(14)
    }
    case "pi":
      if (pi) return { start: startOfDay(pi.startDate), end: pi.endDate < now ? pi.endDate : now }
      return periodRange("all", now, sprints, issues)
    case "custom":
      // Chosen but no dates yet (shouldn't happen): show the last week.
      return custom ? customRange(custom, now) : daysBack(7)
    case "all": {
      const starts = sprints.filter((s) => s.state !== "future" && s.startDate).map((s) => s.startDate!.getTime())
      const first = starts.length ? Math.min(...starts) : Math.min(now.getTime(), ...issues.map((i) => i.created.getTime()))
      return { start: startOfDay(new Date(first)), end: now }
    }
  }
}

/** Time-series charts bucket by hour when the range is a single day, otherwise by day. */
export function bucketFor(range: DateRange): "hour" | "day" {
  return differenceInCalendarDays(range.end, range.start) < 1 ? "hour" : "day"
}
