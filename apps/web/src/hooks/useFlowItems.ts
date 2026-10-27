import { startOfDay, subWeeks } from "date-fns"
import { useMemo } from "react"
import { flowItems } from "@jira-dashboard/core/flow"
import type { DateRange } from "@jira-dashboard/core/types"
import { useData } from "./useData"
import { useFlowConfig } from "./useFlowConfig"
import { useHistoryIssues } from "./useFilteredIssues"
import { usePeriod } from "./usePeriod"
import { useHistorySprints } from "./useScopedSprints"

/** Weekly flow charts need history, so their window is at least this long. */
const MIN_CHART_WEEKS = 8

/**
 * The Flow page's inputs (docs/decisions/0016): flow items from the scope's PI
 * sprints (or picked sprints), narrowed by the team and assignee filters; the
 * header period for KPIs; and a chart window of at least 8 weeks ending now.
 */
export function useFlowItems() {
  const { dataset } = useData()
  const historyIssues = useHistoryIssues()
  const sprints = useHistorySprints()
  const { range, label, phrase } = usePeriod()
  const now = dataset.meta.generatedAt
  const { config: cfg } = useFlowConfig()

  return useMemo(() => {
    const ids = new Set(sprints.map((s) => s.id))
    // An export without sprints: every ticket is in scope.
    const scoped = dataset.sprints.length ? historyIssues.filter((i) => i.sprintIds.some((id) => ids.has(id))) : historyIssues
    const minStart = startOfDay(subWeeks(now, MIN_CHART_WEEKS))
    const chartRange: DateRange = { start: range.start < minStart ? range.start : minStart, end: now }
    return { items: flowItems(scoped, cfg), cfg, sprints, range, chartRange, now, periodLabel: label, periodPhrase: phrase }
  }, [dataset, historyIssues, sprints, range, label, phrase, now, cfg])
}
