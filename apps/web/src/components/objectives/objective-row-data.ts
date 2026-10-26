import type { ObjectiveHealthLevel, ObjectiveProgress } from "@jira-dashboard/core/metrics"
import type { Objective } from "@jira-dashboard/core/types"

/** One objective with its rollups, computed once by the page and passed down. */
export type ObjectiveRowData = {
  objective: Objective
  progress: ObjectiveProgress
  health: { level: ObjectiveHealthLevel; pctDone: number; pctElapsed: number }
  forecast: number | null
}
