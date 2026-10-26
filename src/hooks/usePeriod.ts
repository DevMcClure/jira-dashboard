import { format } from "date-fns"
import { useMemo } from "react"
import { bucketFor, periodLabel, periodPhrase, periodRange } from "@/lib/jira/period"
import { useData } from "./useData"
import { useFilteredIssues } from "./useFilteredIssues"
import { useScope } from "./useScope"
import { useScopedSprints } from "./useScopedSprints"

/**
 * The selected period resolved to a date range (ending at the export's "now").
 * A custom period uses the picked days; a report's fixed dates (frozen, or a
 * saved custom range) replace either.
 */
export function usePeriod() {
  const { dataset, period, customDates, fixedRange } = useData()
  const sprints = useScopedSprints()
  const issues = useFilteredIssues()
  const { pi } = useScope()
  const now = dataset.meta.generatedAt
  return useMemo(() => {
    const range = fixedRange ?? periodRange(period, now, sprints, issues, pi, customDates)
    // Fixed dates on a preset (a frozen report) say so; a custom range is just its dates.
    const frozenPreset = fixedRange !== null && period !== "custom"
    const dates = `${format(range.start, "d MMM")} – ${format(range.end, "d MMM")}`
    return {
      period,
      range,
      bucket: bucketFor(range),
      label: frozenPreset ? `Frozen: ${dates}` : periodLabel(period, range),
      /** Completes "+3 started …" — "today", "in the last 7 days", "between 12 Oct and 19 Oct". */
      phrase: frozenPreset ? `between ${dates.replace(" – ", " and ")}` : periodPhrase(period, range),
    }
  }, [period, customDates, fixedRange, now, sprints, issues, pi])
}
