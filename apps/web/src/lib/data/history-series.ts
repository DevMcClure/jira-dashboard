/**
 * Shapes stored daily snapshots for the History page: one row per day in the
 * range (a day without a snapshot is kept as a gap, not hidden), and the
 * statuses seen, in workflow order. Pure; the snapshots come from the server.
 */
import { addDays, format, startOfDay, subDays } from "date-fns"
import { compareStatus } from "@jira-dashboard/core/constants"
import type { HealthLevel } from "@jira-dashboard/core/metrics"
import { dayKey, parseDay, type SnapshotSummary } from "@jira-dashboard/core/snapshot"
import type { JiraDataset } from "@jira-dashboard/core/types"

export type HistoryRow = {
  date: string
  /** "14 Oct", for axes. */
  label: string
  /** No snapshot was stored for this day. */
  missing: boolean
  sprint: string | null
  remaining: number | null
  ideal: number | null
  wip: number | null
  cycleTimeP85: number | null
  health: HealthLevel | null
  stale: boolean
  backfilled: boolean
  statusCounts: Record<string, number>
}

export function historySeries(snapshots: SnapshotSummary[], from: string, to: string): { rows: HistoryRow[]; statuses: string[] } {
  const byDate = new Map(snapshots.map((s) => [s.date, s]))
  const rows: HistoryRow[] = []
  for (let d = parseDay(from); d <= parseDay(to); d = addDays(d, 1)) {
    const date = dayKey(d)
    const s = byDate.get(date)
    rows.push({
      date,
      label: format(d, "d MMM"),
      missing: !s,
      sprint: s?.sprint?.name ?? null,
      remaining: s?.burndown?.remaining ?? null,
      ideal: s?.burndown?.ideal ?? null,
      wip: s?.flow.wip ?? null,
      cycleTimeP85: s?.flow.cycleTimeP85 ?? null,
      health: s?.health ?? null,
      stale: s?.stale ?? false,
      backfilled: s?.backfilled ?? false,
      statusCounts: s?.statusCounts ?? {},
    })
  }
  const statuses = [...new Set(snapshots.flatMap((s) => Object.keys(s.statusCounts)))].sort(compareStatus)
  return { rows, statuses }
}

/** "14 Oct · WEB 26.4.4 (backfilled)", for tooltips and labels. */
export function historyDayLabel(row: HistoryRow | undefined): string {
  if (!row) return ""
  const flags = [row.backfilled && "backfilled", row.stale && "stale"].filter(Boolean).join(", ")
  return `${row.label}${row.sprint ? ` · ${row.sprint}` : ""}${flags ? ` (${flags})` : ""}`
}

export type HistoryRange = { id: string; label: string; from: string; to: string }

/** The ranges offered: the last 30 days, this PI so far and the previous PI, ending at the data's "now". */
export function historyRanges(dataset: JiraDataset): HistoryRange[] {
  const now = startOfDay(dataset.meta.generatedAt)
  const ranges: HistoryRange[] = [{ id: "30d", label: "Last 30 days", from: dayKey(subDays(now, 29)), to: dayKey(now) }]
  const pis = dataset.programIncrements.filter((p) => p.startDate <= dataset.meta.generatedAt)
  const current = pis.findLast((p) => p.endDate >= dataset.meta.generatedAt)
  const previous = pis.filter((p) => p.endDate < dataset.meta.generatedAt).at(-1)
  if (current) ranges.push({ id: "pi", label: current.name, from: dayKey(current.startDate), to: dayKey(now) })
  if (previous) ranges.push({ id: "prev-pi", label: previous.name, from: dayKey(previous.startDate), to: dayKey(previous.endDate) })
  return ranges
}
