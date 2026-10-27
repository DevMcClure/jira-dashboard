import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type FilterFn,
  type SortFn,
} from "@tanstack/react-table"
import { UNASSIGNED } from "@/components/filters/GlobalFilters"
import { compareStatus, PRIORITIES } from "@jira-dashboard/core/constants"
import { ticketAgeDays } from "@jira-dashboard/core/metrics"
import type { Issue, JiraDataset, StatusCategory } from "@jira-dashboard/core/types"

/** Stable (module-scope) feature registry for the tickets table. */
export const ticketFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  columnFacetingFeature,
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, datetime: sortFn_datetime, text: sortFn_text },
  columnVisibilityFeature,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})

export type TicketFeatures = typeof ticketFeatures

/** One flattened, display-ready row per issue. */
export type TicketRow = {
  key: string
  summary: string
  type: string
  status: string
  statusCategory: StatusCategory
  priority: string
  /** Assignee id, or UNASSIGNED — the faceting/filter value. */
  assignee: string
  assigneeName: string
  sprint: string
  sprintCount: number
  storyPoints: number | null
  created: Date
  updated: Date
  age: number
}

export function toTicketRows(issues: Issue[], dataset: JiraDataset): TicketRow[] {
  const now = dataset.meta.generatedAt
  return issues.map((i) => {
    const lastSprint = i.sprintIds.at(-1)
    return {
      key: i.key,
      summary: i.summary,
      type: i.type,
      status: i.status,
      statusCategory: i.statusCategory,
      priority: i.priority ?? "Medium",
      assignee: i.assigneeId ?? UNASSIGNED,
      assigneeName: i.assigneeId ? (dataset.personById.get(i.assigneeId)?.displayName ?? i.assigneeId) : "Unassigned",
      sprint: lastSprint !== undefined ? (dataset.sprintById.get(lastSprint)?.name ?? `Sprint ${lastSprint}`) : "—",
      sprintCount: i.sprintIds.length,
      storyPoints: i.storyPoints,
      created: i.created,
      updated: i.updated,
      age: ticketAgeDays(i, now),
    }
  })
}

/** Multi-select facet filter: value is a list of accepted strings. */
export const inSet: FilterFn<TicketFeatures, TicketRow> = (row, columnId, value: string[]) =>
  value.includes(String(row.getValue(columnId)))
inSet.autoRemove = (value) => !Array.isArray(value) || value.length === 0

/** Search box: matches key or summary, case-insensitive. */
export const searchKeyOrSummary: FilterFn<TicketFeatures, TicketRow> = (row, _columnId, query: string) => {
  const q = query.trim().toLowerCase()
  return !q || row.original.key.toLowerCase().includes(q) || row.original.summary.toLowerCase().includes(q)
}

export const sortByStatus: SortFn<TicketFeatures, TicketRow> = (a, b) =>
  compareStatus(a.original.status, b.original.status)

const PRIORITY_RANK = new Map<string, number>(PRIORITIES.map((p, i) => [p, i]))
/** Ascending = least urgent first (Lowest … Highest). */
export const sortByPriority: SortFn<TicketFeatures, TicketRow> = (a, b) =>
  (PRIORITY_RANK.get(b.original.priority) ?? 2) - (PRIORITY_RANK.get(a.original.priority) ?? 2)

export const sortByAssignee: SortFn<TicketFeatures, TicketRow> = (a, b) =>
  a.original.assigneeName.localeCompare(b.original.assigneeName)

export const COLUMN_LABELS: Record<string, string> = {
  key: "Key",
  summary: "Summary",
  type: "Type",
  status: "Status",
  priority: "Priority",
  assignee: "Assignee",
  sprint: "Sprint",
  storyPoints: "Points",
  created: "Created",
  updated: "Updated",
  age: "Age",
}
