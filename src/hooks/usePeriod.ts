import { format } from "date-fns"
import { useMemo } from "react"
import { bucketFor, PERIOD_PHRASE, PERIODS, periodRange } from "@/lib/jira/period"
import { useData } from "./useData"
import { useFilteredIssues } from "./useFilteredIssues"
import { useScope } from "./useScope"
import { useScopedSprints } from "./useScopedSprints"

/**
 * The selected period resolved to a date range (ending at the export's "now").
 * A frozen report replaces it with its pinned dates.
 */
export function usePeriod() {
  const { dataset, period, fixedRange } = useData()
  const sprints = useScopedSprints()
  const issues = useFilteredIssues()
  const { pi } = useScope()
  const now = dataset.meta.generatedAt
  return useMemo(() => {
    const range = fixedRange ?? periodRange(period, now, sprints, issues, pi)
    const dates = `${format(range.start, "d MMM")} – ${format(range.end, "d MMM")}`
    return {
      period,
      range,
      bucket: bucketFor(range),
      label: fixedRange ? `Frozen: ${dates}` : PERIODS.find((p) => p.value === period)!.label,
      /** Completes "+3 started …" — "today", "in the last 7 days", … */
      phrase: fixedRange ? `between ${dates}` : PERIOD_PHRASE[period],
    }
  }, [period, fixedRange, now, sprints, issues, pi])
}
