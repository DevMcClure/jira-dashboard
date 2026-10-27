/**
 * When fresh server data arrives, keep the reader's view (filters, scope,
 * period) but drop anything the new data no longer has, so a filter never
 * points at a sprint, team or person that's gone.
 */
import type { Period } from "@jira-dashboard/core/period"
import { SPRINT_SCOPE, type Scope } from "@jira-dashboard/core/scope"
import type { JiraDataset } from "@jira-dashboard/core/types"
import type { Filters } from "./data-context"

export function keepFilters(filters: Filters, dataset: JiraDataset): Filters {
  return {
    sprintIds: filters.sprintIds.filter((id) => dataset.sprintById.has(id)),
    teamIds: filters.teamIds.filter((id) => dataset.teamById.has(id)),
    assigneeIds: filters.assigneeIds.filter((id) => id === null || dataset.personById.has(id)),
  }
}

export const keepScope = (scope: Scope, dataset: JiraDataset): Scope =>
  scope.kind === "pi" && !dataset.piById.has(scope.piId) ? SPRINT_SCOPE : scope

export const keepPeriod = (period: Period, dataset: JiraDataset): Period =>
  period === "pi" && !dataset.programIncrements.length ? "today" : period

export const keepSprintId = (id: number | null, dataset: JiraDataset): number | null =>
  id !== null && dataset.sprintById.has(id) ? id : null
