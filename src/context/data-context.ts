import { createContext } from "react"
import type { JiraDataset } from "@/lib/jira/types"

/** Empty array = no filter ("All"). `null` in assigneeIds = Unassigned. */
export type Filters = {
  sprintIds: number[]
  teamIds: string[]
  assigneeIds: (string | null)[]
}

export const EMPTY_FILTERS: Filters = { sprintIds: [], teamIds: [], assigneeIds: [] }

export type DataSource =
  | { kind: "sample" }
  | { kind: "upload"; fileName: string; loadedAt: string }

export type LoadResult = { ok: true; dataset: JiraDataset } | { ok: false; problems: string[] }

export type DataContextValue = {
  dataset: JiraDataset
  source: DataSource
  /** The raw JSON text currently loaded (for "Download current data"). */
  rawJson: string
  loadFromFile: (file: File) => Promise<LoadResult>
  resetToSample: () => void
  filters: Filters
  setFilters: (next: Filters) => void
  /** Sprint shown in the Overview burndown; null = pick automatically. */
  burndownSprintId: number | null
  setBurndownSprintId: (id: number | null) => void
}

export const DataContext = createContext<DataContextValue | null>(null)
