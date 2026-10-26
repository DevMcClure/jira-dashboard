import type { ObjectiveHealthLevel, ObjectiveProgress } from "@/lib/jira/metrics"
import type { Objective } from "@/lib/jira/types"

/** One objective with its rollups, computed once by the page and passed down. */
export type ObjectiveRowData = {
  objective: Objective
  progress: ObjectiveProgress
  health: { level: ObjectiveHealthLevel; pctDone: number; pctElapsed: number }
  forecast: number | null
}
