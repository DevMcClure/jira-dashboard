import { createContext } from "react"
import type { DataMode } from "@/lib/data/data-mode"
import type { DataOrigin } from "@/lib/data/data-source"
import type { DayRange, Period } from "@jira-dashboard/core/period"
import type { Scope } from "@jira-dashboard/core/scope"
import type { DateRange, JiraDataset } from "@jira-dashboard/core/types"

/** Empty array = no filter ("All"). `null` in assigneeIds = Unassigned. */
export type Filters = {
  sprintIds: number[]
  teamIds: string[]
  assigneeIds: (string | null)[]
}

export const EMPTY_FILTERS: Filters = { sprintIds: [], teamIds: [], assigneeIds: [] }

export type LoadResult = { ok: true; dataset: JiraDataset } | { ok: false; problems: string[] }

export type DataContextValue = {
  /** What the pages show: the loaded data, or that data replayed to the "As of" day. */
  dataset: JiraDataset
  /** The data as loaded, before any "As of" replay (for labels about the data itself). */
  liveDataset: JiraDataset
  /** The past day being shown, or null for now. */
  asOf: Date | null
  /** Show the end of a past day (null: back to now). Null where "As of" isn't offered: the static build and reports. */
  setAsOf: ((day: Date | null) => void) | null
  /** Sample, uploaded file, or the server's dataset. */
  source: DataOrigin
  /** Which build this is: "static" (sample + uploads) or "api" (the server's data). */
  dataMode: DataMode
  /** The raw JSON text currently loaded (for "Download current data"). */
  rawJson: string
  loadFromFile: (file: File) => Promise<LoadResult>
  resetToSample: () => void
  /** api mode: load the server's newest data, keeping filters, scope and period where they still apply. */
  refresh: () => Promise<void>
  /** api mode: make a file the server's current data (admins only; the server checks). Null in the static build. */
  publishFile: ((file: File) => Promise<LoadResult>) | null
  filters: Filters
  setFilters: (next: Filters) => void
  /** Sprint shown in the Overview burndown; null = pick automatically. */
  burndownSprintId: number | null
  setBurndownSprintId: (id: number | null) => void
  /** Current sprint, or one whole PI. Defaults to the current sprint. */
  scope: Scope
  setScope: (scope: Scope) => void
  /** Time period for activity (deltas, movements, charts). Defaults to "today". */
  period: Period
  setPeriod: (period: Period) => void
  /** The dates picked for the "custom" period; null until a range is chosen. */
  customDates: DayRange | null
  setCustomDates: (dates: DayRange | null) => void
  /** Fixed dates that replace the period's range (frozen reports only); null normally. */
  fixedRange: DateRange | null
}

export const DataContext = createContext<DataContextValue | null>(null)
