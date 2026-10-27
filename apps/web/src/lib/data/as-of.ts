import { endOfDay, startOfDay, subDays } from "date-fns"
import type { JiraDataset } from "@jira-dashboard/core/types"

/**
 * The days the "As of" control offers: from the first day the data covers to
 * the day before its "now" (today itself is the live view). Null when there's
 * no earlier day.
 */
export function asOfBounds(dataset: JiraDataset): { first: Date; last: Date } | null {
  const starts = [...dataset.issues.map((i) => i.created), ...dataset.sprints.flatMap((s) => (s.startDate ? [s.startDate] : []))]
  if (!starts.length) return null
  const first = startOfDay(new Date(Math.min(...starts.map((d) => d.getTime()))))
  const last = startOfDay(subDays(dataset.meta.generatedAt, 1))
  return last < first ? null : { first, last }
}

/** The moment a past day is shown at: the end of it. */
export const asOfMoment = (day: Date) => endOfDay(day)
