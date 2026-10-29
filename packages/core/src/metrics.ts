/**
 * Pure metric functions. Inputs are already-filtered issues; "now" is a
 * reference date (normally `meta.generatedAt`, never the real clock).
 */
import {
  differenceInBusinessDays,
  differenceInDays,
  eachDayOfInterval,
  eachHourOfInterval,
  endOfDay,
  endOfHour,
  startOfDay,
  startOfHour,
  subBusinessDays,
} from "date-fns"
import { categoryForStatus, compareStatus, statusColorVar } from "./constants"
import type { DateRange, Issue, Objective, ProgramIncrement, Sprint, StatusCategory, Team, Transition } from "./types"

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

/** Time-series granularity: "hour" for single-day views (Today), otherwise "day". */
export type Bucket = "day" | "hour"

function buckets(range: DateRange, bucket: Bucket): Date[] {
  if (bucket === "day") return days(range)
  if (range.end < range.start) return []
  return eachHourOfInterval({ start: startOfHour(range.start), end: startOfHour(range.end) })
}
const bucketStart = (d: Date, bucket: Bucket) => (bucket === "hour" ? startOfHour(d) : startOfDay(d))
const bucketEnd = (d: Date, bucket: Bucket) => (bucket === "hour" ? endOfHour(d) : endOfDay(d))
const inRange = (d: Date, range: DateRange) => d >= range.start && d <= range.end

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

/**
 * Points added / removed after the sprint started (new issues + estimate
 * changes). `within` narrows it to part of the sprint, e.g. one day.
 */
export function scopeChange(sprint: Sprint, issues: Issue[], within?: DateRange) {
  const { startDate: start } = sprint
  const sprintEnd = sprint.completeDate ?? sprint.endDate
  if (!start || !sprintEnd) return { added: 0, removed: 0, net: 0 }
  const from = within && within.start > start ? within.start : null
  const end = within && within.end < sprintEnd ? within.end : sprintEnd
  const counts = (t: Date) => t > start && t <= end && (!from || t >= from)
  let added = 0
  let removed = 0
  for (const i of issues.filter(inSprint(sprint))) {
    if (counts(i.created)) added += pointsAt(i, i.created)
    for (const c of i.changelog) {
      if (c.field !== "storyPoints" || !counts(c.at)) continue
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

  return {
    pctDone: Math.round(pctDone),
    pctElapsed: Math.round(pctElapsed),
    daysLeft,
    level: healthLevel(pctDone, pctElapsed, closed),
    donePoints,
    totalPoints: total,
  }
}

/** At risk if done trails elapsed by >15pts, off track if >30pts. */
export function healthLevel(pctDone: number, pctElapsed: number, closed: boolean): HealthLevel {
  if (closed) return "completed"
  const gap = pctElapsed - pctDone
  return gap > 30 ? "off_track" : gap > 15 ? "at_risk" : "on_track"
}

/** Completed (and committed) points per closed sprint of a team, oldest first. */
export function velocity(team: Team, sprints: Sprint[], issues: Issue[]) {
  return sprints
    .filter((s) => s.teamId === team.id && s.state === "closed" && s.startDate)
    .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())
    .map((s) => sprintVelocity(s, issues))
}

/** Points committed at a sprint's start, and done by its end (or now, if still running). */
export function sprintVelocity(sprint: Sprint, issues: Issue[]) {
  const start = sprint.startDate
  if (!start) return { sprintId: sprint.id, sprintName: sprint.name, committed: 0, completed: 0 }
  const end = sprint.completeDate ?? sprint.endDate ?? start
  const scoped = issues.filter(inSprint(sprint))
  const committed = scoped
    .filter((i) => i.created <= start && categoryAt(i, start) !== "done")
    .reduce((sum, i) => sum + pointsAt(i, start), 0)
  const completed = scoped
    .filter((i) => categoryAt(i, end) === "done")
    .reduce((sum, i) => sum + pointsAt(i, end), 0)
  return { sprintId: sprint.id, sprintName: sprint.name, committed, completed }
}

// ---------------------------------------------------------------------------
// Program increments
// ---------------------------------------------------------------------------

const inPi = (pi: ProgramIncrement) => (i: Issue) => i.sprintIds.some((id) => pi.sprintIds.includes(id))

export type BurnupPoint = { date: Date; scope: number; done: number | null }

/**
 * Per-day total scope vs done points across a PI's sprints, replaying
 * changelogs. Scope keeps counting future days (it's known); done is null
 * after `now`.
 */
export function piBurnup(pi: ProgramIncrement, issues: Issue[], now: Date): BurnupPoint[] {
  const scoped = issues.filter(inPi(pi))
  const cap = minDate(pi.endDate, now)
  return days({ start: pi.startDate, end: pi.endDate }).map((date) => {
    const isFuture = startOfDay(date) > cap
    const t = minDate(endOfDay(date), cap)
    let scope = 0
    let done = 0
    for (const i of scoped) {
      const cat = categoryAt(i, t)
      if (cat === null) continue
      const p = pointsAt(i, t)
      scope += p
      if (cat === "done") done += p
    }
    return { date, scope, done: isFuture ? null : done }
  })
}

/** PI progress: % of points done vs % of the PI elapsed, with the sprint health thresholds. */
export function piHealth(pi: ProgramIncrement, issues: Issue[], now: Date) {
  const scoped = issues.filter(inPi(pi))
  const closed = pi.state === "closed"
  const totalPoints = scoped.reduce((s, i) => s + points(i), 0)
  const done = scoped.filter((i) => i.statusCategory === "done")
  const donePoints = done.reduce((s, i) => s + points(i), 0)
  const pctDone =
    totalPoints > 0 ? (donePoints / totalPoints) * 100 : scoped.length ? (done.length / scoped.length) * 100 : 0
  const pctElapsed = piElapsedPct(pi, now)
  const daysLeft = closed ? 0 : Math.max(0, Math.ceil((pi.endDate.getTime() - now.getTime()) / DAY_MS))
  return {
    pctDone: Math.round(pctDone),
    pctElapsed: Math.round(pctElapsed),
    daysLeft,
    level: healthLevel(pctDone, pctElapsed, closed),
    donePoints,
    totalPoints,
    ticketCount: scoped.length,
  }
}

/** % of the PI's time gone at `now` (100 once closed). */
export function piElapsedPct(pi: ProgramIncrement, now: Date): number {
  if (pi.state === "closed") return 100
  const duration = pi.endDate.getTime() - pi.startDate.getTime()
  return duration > 0 ? clamp(((now.getTime() - pi.startDate.getTime()) / duration) * 100, 0, 100) : 0
}

// ---------------------------------------------------------------------------
// PI objectives
// ---------------------------------------------------------------------------

/** Sprint health levels plus "no tickets linked", which objectives can have. */
export type ObjectiveHealthLevel = HealthLevel | "no_data"

/**
 * An objective's tickets: stories of its epics plus directly linked issues,
 * excluding the Epic issues themselves, and only those in the PI's sprints.
 * `issues` is already filtered (teams, assignees, picked sprints).
 */
export function objectiveIssues(objective: Objective, pi: ProgramIncrement, issues: Issue[]): Issue[] {
  const epics = new Set(objective.epicKeys)
  const keys = new Set(objective.issueKeys)
  const sprints = new Set(pi.sprintIds)
  return issues.filter(
    (i) =>
      i.type !== "Epic" &&
      ((i.epicKey !== null && epics.has(i.epicKey)) || keys.has(i.key)) &&
      i.sprintIds.some((id) => sprints.has(id)),
  )
}

export type ObjectiveProgress = {
  pctDone: number
  donePoints: number
  totalPoints: number
  done: number
  total: number
  /** False when nothing is estimated, so pctDone is by ticket count. */
  byPoints: boolean
}

/** Done vs total at time `t` (replaying changelogs), or as of the export when `t` is omitted. Unrounded %. */
function progressOf(scoped: Issue[], t?: Date) {
  let total = 0
  let done = 0
  let totalPoints = 0
  let donePoints = 0
  for (const i of scoped) {
    const cat = t ? categoryAt(i, t) : i.statusCategory
    if (cat === null) continue
    const p = t ? pointsAt(i, t) : points(i)
    total++
    totalPoints += p
    if (cat === "done") {
      done++
      donePoints += p
    }
  }
  const byPoints = totalPoints > 0
  const pct = byPoints ? (donePoints / totalPoints) * 100 : total ? (done / total) * 100 : 0
  return { pct, done, total, donePoints, totalPoints, byPoints }
}

/** Points done ÷ points in scope for the objective's tickets (ticket counts when nothing is estimated). */
export function objectiveProgress(objective: Objective, pi: ProgramIncrement, issues: Issue[], at?: Date): ObjectiveProgress {
  const { pct, ...rest } = progressOf(objectiveIssues(objective, pi, issues), at)
  return { pctDone: Math.round(pct), ...rest }
}

/** The tickets (not epics) under these epics, in any sprint: an Objective issue's work (decision 0050). */
export function epicTickets(epicKeys: string[], issues: Issue[]): Issue[] {
  const epics = new Set(epicKeys)
  return issues.filter((i) => i.type !== "Epic" && i.epicKey !== null && epics.has(i.epicKey))
}

/** Done vs total of these epics' tickets, by points (or ticket count when nothing is estimated). Rounded %. */
export function epicsProgress(epicKeys: string[], issues: Issue[]): ObjectiveProgress {
  const { pct, ...rest } = progressOf(epicTickets(epicKeys, issues))
  return { pctDone: Math.round(pct), ...rest }
}

/** Progress vs % of the PI gone, with the sprint thresholds; "no_data" when no tickets are linked. */
export function objectiveHealth(objective: Objective, pi: ProgramIncrement, issues: Issue[], now: Date) {
  const scoped = objectiveIssues(objective, pi, issues)
  const pctElapsed = piElapsedPct(pi, now)
  const { pct } = progressOf(scoped)
  const level: ObjectiveHealthLevel = scoped.length
    ? healthLevel(pct, pctElapsed, pi.state === "closed")
    : "no_data"
  return { level, pctDone: Math.round(pct), pctElapsed: Math.round(pctElapsed) }
}

const FORECAST_WINDOW_DAYS = 10

/**
 * Projected % done at the PI's end: today's % plus the average daily gain over
 * the last 10 working days (or since the PI started, if sooner) times the
 * working days left, capped at 100. A closed PI returns its final %; a future
 * PI or an objective without tickets returns null. Working days skip weekends only.
 */
export function objectiveForecast(objective: Objective, pi: ProgramIncrement, issues: Issue[], now: Date): number | null {
  const scoped = objectiveIssues(objective, pi, issues)
  if (!scoped.length || pi.state === "future") return null
  const current = progressOf(scoped).pct
  if (pi.state === "closed") return Math.round(current)

  const windowStart = subBusinessDays(now, FORECAST_WINDOW_DAYS)
  const from = windowStart < pi.startDate ? pi.startDate : windowStart
  const days = Math.max(1, differenceInBusinessDays(now, from))
  const rate = (current - progressOf(scoped, from).pct) / days
  const left = Math.max(0, differenceInBusinessDays(pi.endDate, now))
  return Math.round(clamp(current + Math.max(0, rate) * left, 0, 100))
}

/**
 * PI predictability: Σ actual BV ÷ Σ planned BV of committed objectives, as a
 * %. Uncommitted objectives add their actual BV only, so it can exceed 100%.
 * Null when no committed objective has both values (e.g. the PI isn't assessed yet).
 */
export function piPredictability(objectives: Objective[]): { pct: number; planned: number; actual: number } | null {
  const committed = objectives.filter(
    (o) => o.committed && o.plannedBusinessValue !== null && o.actualBusinessValue !== null,
  )
  const planned = committed.reduce((s, o) => s + o.plannedBusinessValue!, 0)
  if (!committed.length || planned === 0) return null
  const actual =
    committed.reduce((s, o) => s + o.actualBusinessValue!, 0) +
    objectives.filter((o) => !o.committed).reduce((s, o) => s + (o.actualBusinessValue ?? 0), 0)
  return { pct: Math.round((actual / planned) * 100), planned, actual }
}

export type EpicProgress = {
  epicKey: string
  teamIds: string[]
  total: number
  done: number
  points: number
  donePoints: number
  /** By points, falling back to ticket counts when nothing is estimated. */
  pctDone: number
}

/** Progress per epic (issues without an epic are skipped), least done first. */
export function epicProgress(issues: Issue[]): EpicProgress[] {
  const map = new Map<string, EpicProgress & { teams: Set<string> }>()
  for (const i of issues) {
    if (!i.epicKey) continue
    const e = map.get(i.epicKey) ?? {
      epicKey: i.epicKey,
      teamIds: [],
      teams: new Set<string>(),
      total: 0,
      done: 0,
      points: 0,
      donePoints: 0,
      pctDone: 0,
    }
    e.total++
    e.points += points(i)
    if (i.statusCategory === "done") {
      e.done++
      e.donePoints += points(i)
    }
    if (i.teamId) e.teams.add(i.teamId)
    map.set(i.epicKey, e)
  }
  return [...map.values()]
    .map(({ teams, ...e }) => ({
      ...e,
      teamIds: [...teams],
      pctDone: Math.round(e.points > 0 ? (e.donePoints / e.points) * 100 : (e.done / e.total) * 100),
    }))
    .sort((a, b) => a.pctDone - b.pctDone || b.points - a.points || a.epicKey.localeCompare(b.epicKey))
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

/** Status changes per bucket (day or hour), counted by destination status. */
export function transitionsPerDay(
  transitions: Transition[],
  range: DateRange,
  bucket: Bucket = "day",
): DailyStatusCounts[] {
  const rows = buckets(range, bucket).map((date) => ({ date, total: 0, counts: {} as Record<string, number> }))
  const index = new Map(rows.map((r) => [r.date.getTime(), r]))
  for (const t of transitions) {
    const row = index.get(bucketStart(t.at, bucket).getTime())
    if (!row) continue
    row.total++
    row.counts[t.to] = (row.counts[t.to] ?? 0) + 1
  }
  return rows
}

export function createdVsResolvedPerDay(issues: Issue[], range: DateRange, bucket: Bucket = "day") {
  const rows = buckets(range, bucket).map((date) => ({ date, created: 0, resolved: 0 }))
  const index = new Map(rows.map((r) => [r.date.getTime(), r]))
  for (const i of issues) {
    const c = index.get(bucketStart(i.created, bucket).getTime())
    if (c) c.created++
    if (i.resolved) {
      const r = index.get(bucketStart(i.resolved, bucket).getTime())
      if (r) r.resolved++
    }
  }
  return rows
}

/** Tickets in each status at the end of each bucket (capped at range end), replaying changelogs. */
export function cumulativeFlow(issues: Issue[], range: DateRange, bucket: Bucket = "day"): DailyStatusCounts[] {
  return buckets(range, bucket).map((date) => {
    const t = minDate(bucketEnd(date, bucket), range.end)
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

export type Kpi = { value: number; delta: number; trend: number[] }

/**
 * Headline numbers for the stat cards: current value, change within `range`
 * (the selected period), and a daily trend for the last `trendDays` days.
 * Status cards count tickets currently in that status; their delta is how many
 * distinct tickets moved into it during the period.
 */
export function kpiSummary(
  issues: Issue[],
  transitions: Transition[],
  range: DateRange,
  now: Date,
  trendDays = 14,
) {
  const trendRange = { start: new Date(now.getTime() - (trendDays - 1) * DAY_MS), end: now }
  const flow = cumulativeFlow(issues, trendRange)

  const statusKpi = (status: string): Kpi => ({
    value: issues.filter((i) => i.status === status).length,
    // Distinct tickets, so one bouncing between statuses counts once.
    delta: new Set(transitions.filter((t) => t.to === status && inRange(t.at, range)).map((t) => t.issueKey)).size,
    trend: flow.map((r) => r.counts[status] ?? 0),
  })

  return {
    total: {
      value: issues.length,
      delta: issues.filter((i) => inRange(i.created, range)).length,
      trend: flow.map((r) => r.total),
    } satisfies Kpi,
    inProgress: statusKpi("In Progress"),
    blocked: statusKpi("Blocked"),
    inReview: statusKpi("In Review"),
  }
}

/** What happened in a period: tickets created/resolved, status moves, tickets newly blocked. */
export function activitySummary(issues: Issue[], transitions: Transition[], range: DateRange) {
  const moves = transitions.filter((t) => inRange(t.at, range))
  return {
    created: issues.filter((i) => inRange(i.created, range)).length,
    resolved: issues.filter((i) => i.resolved !== null && inRange(i.resolved, range)).length,
    moves: moves.length,
    blocked: new Set(moves.filter((t) => t.to === "Blocked").map((t) => t.issueKey)).size,
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
