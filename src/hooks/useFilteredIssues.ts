import { useMemo } from "react"
import type { Filters } from "@/context/data-context"
import type { Issue } from "@/lib/jira/types"
import { useData } from "./useData"

export function matchesFilters(issue: Issue, f: Filters): boolean {
  if (f.sprintIds.length && !issue.sprintIds.some((id) => f.sprintIds.includes(id))) return false
  if (f.teamIds.length && !(issue.teamId && f.teamIds.includes(issue.teamId))) return false
  if (f.assigneeIds.length && !f.assigneeIds.includes(issue.assigneeId)) return false
  return true
}

/** Issues matching the global header filters (sprints, teams, assignees). */
export function useFilteredIssues(): Issue[] {
  const { dataset, filters } = useData()
  return useMemo(
    () => dataset.issues.filter((i) => matchesFilters(i, filters)),
    [dataset, filters],
  )
}
