import type { ObjectiveProgress } from "@jira-dashboard/core/metrics"
import type { Issue } from "@jira-dashboard/core/types"

/** One Objective issue with its epics' rollup, computed once by the page and passed down. */
export type IssueObjectiveRowData = {
  objective: Issue
  epicKeys: string[]
  /** The PI it's matched to through its epics, or null. */
  piName: string | null
  tickets: Issue[]
  progress: ObjectiveProgress
}
