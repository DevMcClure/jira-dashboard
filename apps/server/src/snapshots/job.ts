/**
 * The snapshot job: for each requested day, replay the server's current
 * dataset to the end of that day and store one snapshot per team. Run by the
 * schedule (yesterday, every morning), the admin "Take snapshot now" route
 * and the backfill command; docs/decisions/0038.
 */
import { parseExportText } from "@jira-dashboard/core/adapter"
import { buildSnapshots, dayKey, parseDay } from "@jira-dashboard/core/snapshot"
import { addDays } from "date-fns"
import type { FastifyBaseLogger } from "fastify"
import type { DatasetStore } from "../dataset-store"
import type { SaveResult, SnapshotStore } from "./store"

export type DayResult =
  | { date: string; stale: boolean; teams: { teamId: string; result: SaveResult }[] }
  | { date: string; error: string }

export class NoDataError extends Error {
  constructor() {
    super("The server has no data yet, so there's nothing to snapshot.")
    this.name = "NoDataError"
  }
}

/** The calendar day before `now` in `timeZone` (yyyy-MM-dd). */
export function previousDay(now: Date, timeZone: string): string {
  // en-CA formats as yyyy-MM-dd. A day back from the job's 06:00 is safely inside yesterday, DST or not.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(now.getTime() - 86_400_000),
  )
}

/** Every day from `from` to `to`, inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = []
  for (let d = parseDay(from); d <= parseDay(to); d = addDays(d, 1)) days.push(dayKey(d))
  return days
}

type Deps = {
  datasets: DatasetStore
  snapshots: SnapshotStore
  log: Pick<FastifyBaseLogger, "info" | "warn">
  now?: () => Date
}

export function createSnapshotJob({ datasets, snapshots, log, now = () => new Date() }: Deps) {
  return {
    /**
     * Snapshot each day. A day the latest data doesn't reach yet is still
     * recorded, flagged stale (the Trawler may not have run); days that haven't
     * started are refused. A backfill only rebuilds days the data covers, marks
     * its documents, and doesn't replace ones taken on the day unless forced.
     */
    async run(days: string[], { backfilled = false, force = false } = {}): Promise<DayResult[]> {
      const current = await datasets.current()
      if (!current) throw new NoDataError()
      const dataset = parseExportText(current.json)
      const today = dayKey(now())
      const results: DayResult[] = []
      for (const date of days) {
        if (!backfilled && date > today) {
          results.push({ date, error: `${date} hasn't happened yet.` })
          continue
        }
        let built
        try {
          built = buildSnapshots(dataset, date, { ingestId: current.ingest.id, takenAt: now(), backfilled, staleAfterNow: !backfilled })
        } catch (err) {
          results.push({ date, error: (err as Error).message })
          continue
        }
        const teams = []
        for (const snapshot of built) teams.push({ teamId: snapshot.teamId, result: await snapshots.save(snapshot, { force }) })
        results.push({ date, stale: built.some((s) => s.stale), teams })
        const written = teams.filter((t) => t.result === "written").length
        log.info({ date, backfilled, written, teams: teams.length, stale: built.some((s) => s.stale) }, "snapshot")
      }
      return results
    },
  }
}

export type SnapshotJob = ReturnType<typeof createSnapshotJob>
