import { useMemo } from "react"
import { bucketFor, PERIOD_PHRASE, PERIODS, periodRange } from "@/lib/jira/period"
import { useData } from "./useData"
import { useFilteredIssues } from "./useFilteredIssues"
import { useScope } from "./useScope"
import { useScopedSprints } from "./useScopedSprints"

/** The selected period resolved to a date range (ending at the export's "now"). */
export function usePeriod() {
  const { dataset, period } = useData()
  const sprints = useScopedSprints()
  const issues = useFilteredIssues()
  const { pi } = useScope()
  const now = dataset.meta.generatedAt
  return useMemo(() => {
    const range = periodRange(period, now, sprints, issues, pi)
    return {
      period,
      range,
      bucket: bucketFor(range),
      label: PERIODS.find((p) => p.value === period)!.label,
      /** Completes "+3 started …" — "today", "in the last 7 days", … */
      phrase: PERIOD_PHRASE[period],
    }
  }, [period, now, sprints, issues, pi])
}
