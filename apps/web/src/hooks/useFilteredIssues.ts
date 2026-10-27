import { useMemo } from "react"
import type { Filters } from "@/context/data-context"
import { inScope } from "@jira-dashboard/core/scope"
import type { Issue } from "@jira-dashboard/core/types"
import { useData } from "./useData"
import { useEffectiveFilters } from "./useEffectiveFilters"
import { useScope } from "./useScope"

export function matchesFilters(issue: Issue, f: Filters): boolean {
  if (f.sprintIds.length && !issue.sprintIds.some((id) => f.sprintIds.includes(id))) return false
  if (f.teamIds.length && !(issue.teamId && f.teamIds.includes(issue.teamId))) return false
  if (f.assigneeIds.length && !f.assigneeIds.includes(issue.assigneeId)) return false
  return true
}

/**
 * Issues in the header scope (current sprint or a PI) matching the header
 * filters and any team scope. Picked sprints replace the scope's sprints.
 */
export function useFilteredIssues(): Issue[] {
  const { dataset } = useData()
  const filters = useEffectiveFilters()
  const scope = useScope()
  return useMemo(() => {
    const scopeIds = new Set(filters.sprintIds.length ? [] : scope.sprints.map((s) => s.id))
    return dataset.issues.filter((i) => inScope(i, scopeIds) && matchesFilters(i, filters))
  }, [dataset, filters, scope])
}

/**
 * Issues for history views (sprint health, burndown, velocity): the header's
 * team/assignee filters only. Those views pick each sprint's tickets themselves,
 * so closed sprints outside the current-sprint scope still have their tickets.
 */
export function useHistoryIssues(): Issue[] {
  const { dataset } = useData()
  const filters = useEffectiveFilters()
  return useMemo(
    () => dataset.issues.filter((i) => matchesFilters(i, { ...filters, sprintIds: [] })),
    [dataset, filters],
  )
}
