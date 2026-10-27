/**
 * A daily snapshot: one team on one day, built from the dataset replayed to
 * the end of that day (`datasetAsOf`) with the same metric functions the
 * dashboard uses. Stored by the server (B4); docs/plan-backend.md → "MongoDB
 * data model" and docs/decisions/0038. `schemaVersion` lets readers handle
 * older documents as the shape grows.
 */
import { differenceInBusinessDays, endOfDay, format, isSameDay, startOfDay, subDays } from "date-fns"
import { z } from "zod"
import { datasetAsOf } from "./asof"
import { flowItems, flowLoad, teamFlow } from "./flow"
import {
  activitySummary,
  burndown,
  countByStatus,
  objectiveHealth,
  objectiveProgress,
  piElapsedPct,
  scopeChange,
  sprintHealth,
  ticketAgeDays,
  timeInCurrentStatus,
} from "./metrics"
import type { JiraDataset, Sprint, Team } from "./types"

export const SNAPSHOT_SCHEMA_VERSION = 1
/** Flow numbers look back this many days (ending on the snapshot day). */
export const SNAPSHOT_FLOW_WINDOW_DAYS = 28

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const health = z.enum(["on_track", "at_risk", "off_track", "completed"])
const count = z.number().int().nonnegative()

export const snapshotSchema = z.object({
  schemaVersion: z.literal(SNAPSHOT_SCHEMA_VERSION),
  teamId: z.string(),
  /** The day, in the teams' time zone (yyyy-MM-dd). */
  date: z.string().regex(DAY_PATTERN),
  /** The moment replayed to: the end of the day, or the data's "now" if that's earlier (ISO). */
  asOf: z.string(),
  takenAt: z.string(),
  ingestId: z.string().nullable(),
  /** The data was generated before the day ended, so the end of the day isn't in it. */
  stale: z.boolean(),
  /** Rebuilt later from the changelog rather than taken on the day after. */
  backfilled: z.boolean(),
  /** The team's sprint that ran that day (including the day it closed); null between sprints. */
  sprint: z.object({ id: z.number(), name: z.string(), dayOfSprint: z.number().int(), workingDaysTotal: z.number().int() }).nullable(),
  pi: z.object({ id: z.string(), name: z.string(), pctTimeElapsed: z.number() }).nullable(),
  /** That day's point of the sprint burndown (the same function as the dashboard's chart). */
  burndown: z.object({ ideal: z.number(), remaining: z.number() }).nullable(),
  /** The sprint's tickets and points at the end of the day. */
  totals: z.object({ tickets: count, points: z.number(), pointsDone: z.number(), pointsRemaining: z.number(), scopeAddedToday: z.number() }),
  statusCounts: z.record(z.string(), count),
  health: health.nullable(),
  /** The team's activity during the day. */
  activity: z.object({ moves: count, created: count, resolved: count, blockedNew: count }),
  /** Over the trailing 28 days, working hours, from the start of work. */
  flow: z.object({
    /** Items finished in the window. */
    velocity: count,
    /** Items in an active or waiting state at the end of the day. */
    wip: count,
    avgAgeDays: z.number().nullable(),
    /** Active ÷ (active + waiting) time of items finished in the window, 0–1. */
    efficiency: z.number().nullable(),
    cycleTimeP85: z.number().nullable(),
  }),
  objectives: z.array(z.object({ id: z.string(), progress: z.number(), health: z.enum(["on_track", "at_risk", "off_track", "completed", "no_data"]) })),
  issues: z.array(
    z.object({
      key: z.string(),
      type: z.string(),
      status: z.string(),
      points: z.number().nullable(),
      assigneeId: z.string().nullable(),
      epicKey: z.string().nullable(),
      ageDays: z.number(),
      daysInStatus: z.number(),
    }),
  ),
})

export type Snapshot = z.infer<typeof snapshotSchema>

/** A snapshot without its per-ticket rows: what history lists carry. */
export const snapshotSummarySchema = snapshotSchema.omit({ issues: true })
export type SnapshotSummary = z.infer<typeof snapshotSummarySchema>

/** Validate a `{ snapshots: [...] }` list from the server; throws on anything else. */
export function parseSnapshotList(raw: unknown): SnapshotSummary[] {
  const result = z.object({ snapshots: z.array(snapshotSummarySchema) }).safeParse(raw)
  if (!result.success) throw new Error("The server sent snapshots in a shape this app doesn't understand.")
  return result.data.snapshots
}

const round1 = (n: number) => Math.round(n * 10) / 10
const DAY_MS = 86_400_000

/** "2026-10-19" → local midnight that day. */
export function parseDay(day: string): Date {
  if (!DAY_PATTERN.test(day)) throw new Error(`Not a day (yyyy-MM-dd): ${day}`)
  const [y, m, d] = day.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  if (date.getMonth() !== m - 1) throw new Error(`Not a day (yyyy-MM-dd): ${day}`)
  return date
}

export const dayKey = (d: Date) => format(d, "yyyy-MM-dd")

/**
 * The team's sprint for the day: one that ran during it (still active at the
 * end of the day, or completed during it), the latest started if several. So a
 * sprint's last day, when it closes in the afternoon, still belongs to it.
 */
function sprintOfDay(past: JiraDataset, team: Team, dayStart: Date): Sprint | null {
  const ran = past.sprints.filter(
    (s) => s.teamId === team.id && (s.state === "active" || (s.state === "closed" && s.completeDate !== null && s.completeDate >= dayStart)),
  )
  return ran.sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0))[0] ?? null
}

type Options = {
  ingestId: string | null
  takenAt: Date
  backfilled: boolean
  /**
   * For a day after the data's "now" (no newer data arrived): record the latest
   * known state, flagged stale, instead of refusing. The daily job does; a
   * backfill doesn't, since it would only copy the latest state backwards.
   */
  staleAfterNow?: boolean
}

/** One snapshot per team for `day`. A day after the data's "now" throws, unless `staleAfterNow`. */
export function buildSnapshots(dataset: JiraDataset, day: string, { ingestId, takenAt, backfilled, staleAfterNow = false }: Options): Snapshot[] {
  const dayStart = parseDay(day)
  const dayEnd = endOfDay(dayStart)
  const now = dataset.meta.generatedAt
  if (dayStart > now && !staleAfterNow) throw new Error(`${day} is after the data's "now" (${dayKey(now)}).`)
  const at = dayEnd < now ? dayEnd : now
  const past = datasetAsOf(dataset, at)
  const items = flowItems(past.issues)
  const flowOpts = { mode: "working" as const, now: at }
  const flowWindow = { start: startOfDay(subDays(dayStart, SNAPSHOT_FLOW_WINDOW_DAYS - 1)), end: at }
  const today = { start: dayStart, end: at }

  return dataset.teams.map((team): Snapshot => {
    const own = past.issues.filter((i) => i.teamId === team.id)
    const ownKeys = new Set(own.map((i) => i.key))
    const sprint = sprintOfDay(past, team, dayStart)
    const inSprint = sprint ? past.issues.filter((i) => i.sprintIds.includes(sprint.id)) : []
    // The burndown uses the sprint as recorded now (its real completion), like the live chart does.
    const liveSprint = sprint ? (dataset.sprintById.get(sprint.id) ?? sprint) : null
    const point = liveSprint ? burndown(liveSprint, past.issues, at).find((p) => isSameDay(p.date, dayStart)) : undefined
    const points = inSprint.reduce((s, i) => s + (i.storyPoints ?? 0), 0)
    const pointsDone = inSprint.filter((i) => i.statusCategory === "done").reduce((s, i) => s + (i.storyPoints ?? 0), 0)
    const pi = sprint?.piId ? (past.piById.get(sprint.piId) ?? null) : (past.programIncrements.find((p) => p.state === "active") ?? null)
    const activity = activitySummary(own, past.transitions.filter((t) => ownKeys.has(t.issueKey)), today)
    const tf = teamFlow(items, [team], flowWindow, flowOpts, "started")[0]
    const load = flowLoad(items.filter((i) => i.teamId === team.id), today, flowOpts)

    return {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      teamId: team.id,
      date: day,
      asOf: at.toISOString(),
      takenAt: takenAt.toISOString(),
      ingestId,
      stale: now < dayEnd,
      backfilled,
      sprint:
        sprint && sprint.startDate && sprint.endDate
          ? {
              id: sprint.id,
              name: sprint.name,
              dayOfSprint: Math.max(1, differenceInBusinessDays(dayStart, startOfDay(sprint.startDate)) + 1),
              workingDaysTotal: differenceInBusinessDays(startOfDay(sprint.endDate), startOfDay(sprint.startDate)) + 1,
            }
          : null,
      pi: pi ? { id: pi.id, name: pi.name, pctTimeElapsed: round1(piElapsedPct(pi, at)) / 100 } : null,
      burndown: point && point.remaining !== null ? { ideal: point.ideal, remaining: point.remaining } : null,
      totals: {
        tickets: inSprint.length,
        points,
        pointsDone,
        pointsRemaining: points - pointsDone,
        scopeAddedToday: sprint ? scopeChange(sprint, past.issues, today).added : 0,
      },
      statusCounts: Object.fromEntries(countByStatus(inSprint).map((s) => [s.status, s.count])),
      health: sprint ? sprintHealth(sprint, past.issues, at).level : null,
      activity: { moves: activity.moves, created: activity.created, resolved: activity.resolved, blockedNew: activity.blocked },
      flow: {
        velocity: tf.velocity,
        wip: tf.wip,
        avgAgeDays: load.avgAgeDays === null ? null : round1(load.avgAgeDays),
        efficiency: tf.efficiency === null ? null : tf.efficiency / 100,
        cycleTimeP85: tf.flowTime.p85 === null ? null : round1(tf.flowTime.p85),
      },
      objectives: pi
        ? pi.objectives
            .filter((o) => o.teamId === team.id)
            .map((o) => ({
              id: o.id,
              progress: objectiveProgress(o, pi, past.issues, at).pctDone / 100,
              health: objectiveHealth(o, pi, past.issues, at).level,
            }))
        : [],
      issues: inSprint
        .map((i) => ({
          key: i.key,
          type: i.type,
          status: i.status,
          points: i.storyPoints,
          assigneeId: i.assigneeId,
          epicKey: i.epicKey,
          ageDays: ticketAgeDays(i, at),
          daysInStatus: round1(timeInCurrentStatus(i, at) / DAY_MS),
        }))
        .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })),
    }
  })
}
