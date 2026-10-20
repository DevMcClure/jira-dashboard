import { differenceInCalendarDays, startOfDay, subDays } from "date-fns"
import type { DateRange, Issue, Sprint } from "./types"

/** The header's time-period choices. "now" is always the export's generatedAt. */
export type Period = "today" | "7d" | "14d" | "sprint" | "all"

export const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "sprint", label: "Current sprint" },
  { value: "all", label: "All time" },
]

/** Phrase that completes "+3 started …", e.g. "today", "in the last 7 days". */
export const PERIOD_PHRASE: Record<Period, string> = {
  today: "today",
  "7d": "in the last 7 days",
  "14d": "in the last 14 days",
  sprint: "this sprint",
  all: "in total",
}

/**
 * Resolve a period to a concrete range ending at `now`.
 * - "sprint": from the earliest start of the active sprints in scope (falls back to 14 days)
 * - "all": from the earliest started sprint, or the oldest ticket if there are no sprints
 */
export function periodRange(period: Period, now: Date, sprints: Sprint[], issues: Issue[]): DateRange {
  const daysBack = (n: number) => ({ start: startOfDay(subDays(now, n - 1)), end: now })
  switch (period) {
    case "today":
      return { start: startOfDay(now), end: now }
    case "7d":
      return daysBack(7)
    case "14d":
      return daysBack(14)
    case "sprint": {
      const starts = sprints.filter((s) => s.state === "active" && s.startDate).map((s) => s.startDate!.getTime())
      return starts.length ? { start: startOfDay(new Date(Math.min(...starts))), end: now } : daysBack(14)
    }
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
