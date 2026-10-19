/**
 * Pure metric functions. Inputs are already-filtered issues; "now" is a
 * reference date (normally `meta.generatedAt`, never the real clock).
 */
import { differenceInDays, eachDayOfInterval, endOfDay, startOfDay } from "date-fns"
import { categoryForStatus, compareStatus, statusColorVar } from "./constants"
import type { DateRange, Issue, Sprint, StatusCategory, Team, Transition } from "./types"

const DAY_MS = 86_400_000

// ---------------------------------------------------------------------------
// Point-in-time replay helpers
// ---------------------------------------------------------------------------

/** Status of an issue at time `t`, or null if it didn't exist yet. */
export function statusAt(issue: Issue, t: Date): string | null {
  if (issue.created > t) return null
  const changes = issue.changelog.filter((c) => c.field === "status")
  if (changes.length === 0) return issue.status
  let status = changes[0].from ?? "To Do"
  for (const c of changes) {
    if (c.at > t) break
    if (c.to !== null) status = c.to
  }
  return status
}

export function categoryAt(issue: Issue, t: Date): StatusCategory | null {
  const s = statusAt(issue, t)
  return s === null ? null : categoryForStatus(s, issue)
}

/** Story points at time `t`, replaying `storyPoints` changes. */
export function pointsAt(issue: Issue, t: Date): number {
  const changes = issue.changelog.filter((c) => c.field === "storyPoints")
  if (changes.length === 0) return issue.storyPoints ?? 0
  let points = toNumber(changes[0].from)
  for (const c of changes) {
    if (c.at > t) break
    points = toNumber(c.to)
  }
  return points
}

function toNumber(v: string | null): number {
  const n = v === null ? NaN : Number(v)
  return Number.isFinite(n) ? n : 0
}

const points = (i: Issue) => i.storyPoints ?? 0
const inSprint = (sprint: Sprint) => (i: Issue) => i.sprintIds.includes(sprint.id)
const minDate = (...ds: Date[]) => new Date(Math.min(...ds.map((d) => d.getTime())))

function days(range: DateRange): Date[] {
  if (range.end < range.start) return []
  return eachDayOfInterval({ start: startOfDay(range.start), end: startOfDay(range.end) })
}

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

export function countByStatusCategory(issues: Issue[]) {
  const out = { todo: 0, in_progress: 0, done: 0, total: issues.length }
  for (const i of issues) out[i.statusCategory]++
  return out
}

export function countByStatus(issues: Issue[]) {
  const counts = new Map<string, { count: number; category: StatusCategory }>()
  for (const i of issues) {
    const c = counts.get(i.status) ?? { count: 0, category: i.statusCategory }
    c.count++
    counts.set(i.status, c)
  }
  return [...counts.entries()]
    .sort(([a], [b]) => compareStatus(a, b))
    .map(([status, { count, category }]) => ({
      status,
      count,
      colorVar: statusColorVar(status, category),
    }))
}

export function remainingPoints(issues: Issue[]): number {
  return issues.filter((i) => i.statusCategory !== "done").reduce((sum, i) => sum + points(i), 0)
}

export function createdSince(issues: Issue[], date: Date): number {
  return issues.filter((i) => i.created >= date).length
}

export function resolvedSince(issues: Issue[], date: Date): number {
  return issues.filter((i) => i.resolved !== null && i.resolved >= date).length
}

// ---------------------------------------------------------------------------
// Sprints
// ---------------------------------------------------------------------------

export type BurndownPoint = { date: Date; ideal: number; remaining: number | null }

/**
 * Per-day ideal vs actual remaining points from sprint start to end.
 * Day 0 is measured at the sprint start; later days at end of day (capped at
 * `now`). Days after `now` have `remaining: null`. Points added mid-sprint
 * (new issues or estimate increases) raise `remaining`.
 */
export function burndown(sprint: Sprint, issues: Issue[], now?: Date): BurndownPoint[] {
  const { startDate: start, endDate: end } = sprint
  if (!start || !end) return []
  const scoped = issues.filter(inSprint(sprint))
  const cap = minDate(sprint.completeDate ?? end, now ?? end)

  const remainingAt = (t: Date) =>
    scoped.reduce((sum, i) => {
      const cat = categoryAt(i, t)
      return cat === null || cat === "done" ? sum : sum + pointsAt(i, t)
    }, 0)

  const dayList = days({ start, end })
  const committed = remainingAt(start)
  const span = Math.max(1, dayList.length - 1)

  return dayList.map((date, idx) => {
    const t = idx === 0 ? start : minDate(endOfDay(date), cap)
    const isFuture = idx > 0 && startOfDay(date) > cap
    return {
      date,
      ideal: round1(committed * (1 - idx / span)),
      remaining: isFuture ? null : remainingAt(t),
    }
  })
}

/** Points added / removed after the sprint started (new issues + estimate changes). */
export function scopeChange(sprint: Sprint, issues: Issue[]) {
  const { startDate: start } = sprint
  const end = sprint.completeDate ?? sprint.endDate
  if (!start || !end) return { added: 0, removed: 0, net: 0 }
  let added = 0
  let removed = 0
  for (const i of issues.filter(inSprint(sprint))) {
    if (i.created > start && i.created <= end) added += pointsAt(i, i.created)
    for (const c of i.changelog) {
      if (c.field !== "storyPoints" || c.at <= start || c.at > end) continue
      const delta = toNumber(c.to) - toNumber(c.from)
      if (delta > 0) added += delta
      else removed -= delta
    }
  }
  return { added, removed, net: added - removed }
}

export type HealthLevel = "on_track" | "at_risk" | "off_track" | "completed"

/**
 * % done (by points, falling back to counts when nothing is estimated) vs %
 * time elapsed. At risk if done trails elapsed by >15pts, off track if >30pts.
 */
export function sprintHealth(sprint: Sprint, issues: Issue[], now: Date) {
  const closed = sprint.state === "closed"
  const t = closed ? (sprint.completeDate ?? sprint.endDate ?? now) : now
  const scoped = issues.filter(inSprint(sprint)).filter((i) => i.created <= t)

  const total = scoped.reduce((s, i) => s + pointsAt(i, t), 0)
  const done = scoped.filter((i) => categoryAt(i, t) === "done")
  const donePoints = done.reduce((s, i) => s + pointsAt(i, t), 0)
  const pctDone =
    total > 0
      ? (donePoints / total) * 100
      : scoped.length > 0
        ? (done.length / scoped.length) * 100
        : 0

  const { startDate: start, endDate: end } = sprint
  const duration = start && end ? end.getTime() - start.getTime() : 0
  const pctElapsed =
    closed ? 100 : duration > 0 ? clamp(((now.getTime() - start!.getTime()) / duration) * 100, 0, 100) : 0
  const daysLeft = closed || !end ? 0 : Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS))

  const gap = pctElapsed - pctDone
  const level: HealthLevel = closed
    ? "completed"
    : gap > 30
      ? "off_track"
      : gap > 15
        ? "at_risk"
        : "on_track"

  return {
    pctDone: Math.round(pctDone),
    pctElapsed: Math.round(pctElapsed),
    daysLeft,
    level,
    donePoints,
    totalPoints: total,
  }
}

/** Completed (and committed) points per closed sprint of a team, oldest first. */
export function velocity(team: Team, sprints: Sprint[], issues: Issue[]) {
  return sprints
    .filter((s) => s.teamId === team.id && s.state === "closed" && s.startDate)
    .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())
    .map((s) => {
      const end = s.completeDate ?? s.endDate ?? s.startDate!
      const scoped = issues.filter(inSprint(s))
      const committed = scoped
        .filter((i) => i.created <= s.startDate! && categoryAt(i, s.startDate!) !== "done")
        .reduce((sum, i) => sum + pointsAt(i, s.startDate!), 0)
      const completed = scoped
        .filter((i) => categoryAt(i, end) === "done")
        .reduce((sum, i) => sum + pointsAt(i, end), 0)
      return { sprintId: s.id, sprintName: s.name, committed, completed }
    })
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export type Workload = {
  personId: string | null
  todo: number
  in_progress: number
  done: number
  total: number
  points: number
  openPoints: number
}

/** Per assignee (null = Unassigned), sorted by open points then open count. */
export function workloadByPerson(issues: Issue[]): Workload[] {
  const map = new Map<string | null, Workload>()
  for (const i of issues) {
    const w = map.get(i.assigneeId) ?? {
      personId: i.assigneeId,
      todo: 0,
      in_progress: 0,
      done: 0,
      total: 0,
      points: 0,
      openPoints: 0,
    }
    w[i.statusCategory]++
    w.total++
    w.points += points(i)
    if (i.statusCategory !== "done") w.openPoints += points(i)
    map.set(i.assigneeId, w)
  }
  const open = (w: Workload) => w.todo + w.in_progress
  return [...map.values()].sort(
    (a, b) => b.openPoints - a.openPoints || open(b) - open(a) || b.total - a.total,
  )
}

// ---------------------------------------------------------------------------
// Movement over time
// ---------------------------------------------------------------------------

export type DailyStatusCounts = { date: Date; total: number; counts: Record<string, number> }

export function transitionsPerDay(transitions: Transition[], range: DateRange): DailyStatusCounts[] {
  const rows = days(range).map((date) => ({ date, total: 0, counts: {} as Record<string, number> }))
  const index = new Map(rows.map((r) => [r.date.getTime(), r]))
  for (const t of transitions) {
    const row = index.get(startOfDay(t.at).getTime())
    if (!row) continue
    row.total++
    row.counts[t.to] = (row.counts[t.to] ?? 0) + 1
  }
  return rows
}

export function createdVsResolvedPerDay(issues: Issue[], range: DateRange) {
  const rows = days(range).map((date) => ({ date, created: 0, resolved: 0 }))
  const index = new Map(rows.map((r) => [r.date.getTime(), r]))
  for (const i of issues) {
    const c = index.get(startOfDay(i.created).getTime())
    if (c) c.created++
    if (i.resolved) {
      const r = index.get(startOfDay(i.resolved).getTime())
      if (r) r.resolved++
    }
  }
  return rows
}

/** Tickets in each status at end of each day (capped at range end), replaying changelogs. */
export function cumulativeFlow(issues: Issue[], range: DateRange): DailyStatusCounts[] {
  return days(range).map((date) => {
    const t = minDate(endOfDay(date), range.end)
    const counts: Record<string, number> = {}
    let total = 0
    for (const i of issues) {
      const s = statusAt(i, t)
      if (s === null) continue
      counts[s] = (counts[s] ?? 0) + 1
      total++
    }
    return { date, total, counts }
  })
}

/** Story points not done at time `t` (issues not yet created are excluded). */
export function remainingPointsAt(issues: Issue[], t: Date): number {
  return issues.reduce((sum, i) => {
    const cat = categoryAt(i, t)
    return cat === null || cat === "done" ? sum : sum + pointsAt(i, t)
  }, 0)
}

export type Kpi = { value: number; delta: number; trend: number[] }

/**
 * Headline numbers for the Overview stat cards: current value, change over the
 * last 7 days, and a daily trend (end of day) for the last `trendDays` days.
 */
export function kpiSummary(issues: Issue[], transitions: Transition[], now: Date, trendDays = 14) {
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS)
  const range = { start: new Date(now.getTime() - (trendDays - 1) * DAY_MS), end: now }
  const flow = cumulativeFlow(issues, range)
  const ends = days(range).map((d) => minDate(endOfDay(d), now))
  const done = issues.filter((i) => i.statusCategory === "done")
  const remaining = remainingPoints(issues)

  return {
    total: {
      value: issues.length,
      delta: createdSince(issues, weekAgo),
      trend: flow.map((r) => r.total),
    } satisfies Kpi,
    remaining: {
      value: remaining,
      delta: remaining - remainingPointsAt(issues, weekAgo),
      trend: ends.map((t) => remainingPointsAt(issues, t)),
    } satisfies Kpi,
    completed: {
      value: done.length,
      delta: resolvedSince(issues, weekAgo),
      trend: ends.map((t) => issues.filter((i) => categoryAt(i, t) === "done").length),
    } satisfies Kpi,
    blocked: {
      value: issues.filter((i) => i.status === "Blocked").length,
      delta: transitions.filter((t) => t.to === "Blocked" && t.at >= weekAgo && t.at <= now).length,
      trend: flow.map((r) => r.counts.Blocked ?? 0),
    } satisfies Kpi,
  }
}

// ---------------------------------------------------------------------------
// Per-issue
// ---------------------------------------------------------------------------

/** Whole days since created, or created → resolved if done. */
export function ticketAgeDays(issue: Issue, now: Date): number {
  const end = issue.statusCategory === "done" && issue.resolved ? issue.resolved : now
  return Math.max(0, differenceInDays(end, issue.created))
}

export type TimelineEvent =
  | { kind: "created"; at: Date; authorId: string | null }
  | {
      kind: "status"
      at: Date
      authorId: string | null
      from: string | null
      to: string
      /** Time spent in `from` before this move. */
      msInPrevious: number
    }
  | { kind: "assignee"; at: Date; authorId: string | null; from: string | null; to: string | null }

/** Chronological history of an issue: creation, status moves and (re)assignments. */
export function issueTimeline(issue: Issue): TimelineEvent[] {
  const events: TimelineEvent[] = [{ kind: "created", at: issue.created, authorId: issue.reporterId }]
  let prevStatusAt = issue.created
  for (const c of issue.changelog) {
    if (c.field === "status" && c.to !== null) {
      events.push({
        kind: "status",
        at: c.at,
        authorId: c.authorId,
        from: c.from,
        to: c.to,
        msInPrevious: Math.max(0, c.at.getTime() - prevStatusAt.getTime()),
      })
      prevStatusAt = c.at
    } else if (c.field === "assignee") {
      events.push({ kind: "assignee", at: c.at, authorId: c.authorId, from: c.from, to: c.to })
    }
  }
  return events
}

/** How long the issue has been in its current status (since its last move, or creation). */
export function timeInCurrentStatus(issue: Issue, now: Date): number {
  const last = issue.changelog.findLast((c) => c.field === "status")
  return Math.max(0, now.getTime() - (last?.at ?? issue.created).getTime())
}

/** Days from first move into an in-progress status to resolution; null if not done. */
export function cycleTimeDays(issue: Issue): number | null {
  if (issue.statusCategory !== "done") return null
  const statusChanges = issue.changelog.filter((c) => c.field === "status" && c.to !== null)
  const started = statusChanges.find((c) => categoryForStatus(c.to!, issue) === "in_progress")
  const finished = issue.resolved ?? statusChanges.findLast((c) => categoryForStatus(c.to!, issue) === "done")?.at
  if (!started || !finished) return null
  return Math.max(0, (finished.getTime() - started.at.getTime()) / DAY_MS)
}

// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}
